"""
OpenAI LLM adapter implementation.
Calls AsyncOpenAI with JSON mode, temperature=0, pinned seed, and prompt hashing.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

import structlog
from jsonschema import validate
from openai import AsyncOpenAI

from semeval.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


class OpenAIAdapter:
    """Adapter for OpenAI API (primary model)."""

    def __init__(self, api_key: str | None = None) -> None:
        key = api_key or settings.openai_api_key
        self.client = AsyncOpenAI(api_key=key) if key else None

    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        model: str = "gpt-4o",
        temperature: float = 0.0,
        seed: int | None = 42,
    ) -> dict[str, Any]:
        """
        Generate JSON output using OpenAI API, enforced by jsonschema boundary.
        """
        if not self.client:
            raise ValueError("OPENAI_API_KEY is not configured.")

        prompt_text = f"{system_prompt}\n{user_prompt}"
        prompt_hash = hashlib.sha256(prompt_text.encode("utf-8")).hexdigest()

        logger.info(
            "llm_openai_request",
            model=model,
            temperature=temperature,
            seed=seed,
            prompt_hash=prompt_hash[:12],
        )

        response = await self.client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=temperature,
            seed=seed,
        )

        content = response.choices[0].message.content or "{}"
        parsed_json = json.loads(content)

        # Validate strictly against JSON schema boundary (Rule R6)
        validate(instance=parsed_json, schema=schema)

        logger.info(
            "llm_openai_success",
            model=model,
            prompt_hash=prompt_hash[:12],
        )

        return {
            "output": parsed_json,
            "model_name": model,
            "model_version": settings.llm_primary_model_version,
            "prompt_hash": prompt_hash,
            "temperature": temperature,
            "seed": seed,
        }
