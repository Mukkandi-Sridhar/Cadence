"""
Unified provider-agnostic LLM client.
Supports primary (OpenAI gpt-4o) with automatic fallback to Anthropic (claude-3-5-sonnet)
on 5xx, rate-limit, or timeout errors. Enforces JSON schema boundary validation (R6)
and records model version, prompt hash, temperature, and seed for reproducibility (R3).
"""

from __future__ import annotations

from typing import Any

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from semeval.config import get_settings
from semeval.llm.adapters.anthropic_adapter import AnthropicAdapter
from semeval.llm.adapters.openai_adapter import OpenAIAdapter

logger = structlog.get_logger(__name__)
settings = get_settings()


class LLMClient:
    """Unified LLM Client with automatic provider fallback."""

    def __init__(self) -> None:
        self.openai_adapter = OpenAIAdapter()
        self.anthropic_adapter = AnthropicAdapter()

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        temperature: float | None = None,
        seed: int | None = None,
    ) -> dict[str, Any]:
        """
        Executes primary provider (OpenAI). On failure, attempts fallback (Anthropic).
        Returns a dict containing output JSON and model provenance metadata.
        """
        temp = temperature if temperature is not None else settings.llm_temperature
        pinned_seed = seed if seed is not None else settings.llm_seed

        # Try Primary Provider (OpenAI)
        try:
            return await self.openai_adapter.generate_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                schema=schema,
                model=settings.llm_primary_model,
                temperature=temp,
                seed=pinned_seed,
            )
        except Exception as primary_err:
            logger.warning(
                "llm_primary_failed_switching_fallback",
                primary_provider=settings.llm_primary_provider,
                error=str(primary_err),
            )

            # Fallback to Anthropic
            try:
                return await self.anthropic_adapter.generate_json(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    schema=schema,
                    model=settings.llm_fallback_model,
                    temperature=temp,
                    seed=pinned_seed,
                )
            except Exception as fallback_err:
                logger.error(
                    "llm_all_providers_failed",
                    primary_error=str(primary_err),
                    fallback_error=str(fallback_err),
                )
                msg = f"LLM failed on primary ({primary_err}) and fallback ({fallback_err})."
                raise RuntimeError(msg) from fallback_err
