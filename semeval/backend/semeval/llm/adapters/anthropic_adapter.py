"""
Anthropic LLM adapter implementation for fallback support.
Calls AsyncAnthropic with JSON response parsing and jsonschema boundary validation.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

import structlog
from anthropic import AsyncAnthropic
from jsonschema import validate

from semeval.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


class AnthropicAdapter:
    """Adapter for Anthropic API (fallback model)."""

    def __init__(self, api_key: str | None = None) -> None:
        key = api_key or settings.anthropic_api_key
        self.client = AsyncAnthropic(api_key=key) if key else None

    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        model: str = "claude-3-5-sonnet-20241022",
        temperature: float = 0.0,
        seed: int | None = 42,
    ) -> dict[str, Any]:
        """Generate JSON output using Anthropic API."""
        if not self.client:
            raise ValueError("ANTHROPIC_API_KEY is not configured.")

        prompt_text = f"{system_prompt}\n{user_prompt}"
        prompt_hash = hashlib.sha256(prompt_text.encode("utf-8")).hexdigest()

        full_system = (
            f"{system_prompt}\n\nIMPORTANT: You must respond ONLY with a valid JSON object "
            "matching the requested schema. Do not include markdown codeblocks or prose."
        )

        logger.info(
            "llm_anthropic_request",
            model=model,
            temperature=temperature,
            prompt_hash=prompt_hash[:12],
        )

        response = await self.client.messages.create(
            model=model,
            max_tokens=4096,
            system=full_system,
            messages=[{"role": "user", "content": user_prompt}],
        )

        block = response.content[0] if response.content else None
        raw_text = getattr(block, "text", "{}") if block else "{}"
        parsed_json = json.loads(raw_text)

        # Validate strictly against JSON schema boundary (Rule R6)
        validate(instance=parsed_json, schema=schema)

        logger.info(
            "llm_anthropic_success",
            model=model,
            prompt_hash=prompt_hash[:12],
        )

        return {
            "output": parsed_json,
            "model_name": model,
            "model_version": model,
            "prompt_hash": prompt_hash,
            "temperature": temperature,
            "seed": seed,
        }
