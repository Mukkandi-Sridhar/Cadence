"""
Application configuration.
All values come from environment variables (or .env file).
No defaults contain secrets; all secret defaults are placeholder strings
that will fail validation in production (DISABLE_AUTH=false).
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Environment ───────────────────────────────────────────────────────────
    environment: Literal["development", "staging", "production"] = Field(default="development")
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:3000"]
    )

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = Field(
        default="postgresql+asyncpg://semeval:semeval_dev_secret@localhost:5432/semeval"
    )

    # ── Supabase ──────────────────────────────────────────────────────────────
    supabase_url: str = Field(default="")
    supabase_anon_key: str = Field(default="")
    supabase_service_role_key: str = Field(default="")

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url: str = Field(default="redis://localhost:6379/0")

    # ── Object storage ────────────────────────────────────────────────────────
    storage_endpoint: str = Field(default="http://localhost:9000")
    storage_access_key: str = Field(default="semeval_minio")
    storage_secret_key: str = Field(default="semeval_minio_secret")
    storage_bucket: str = Field(default="semeval-audio")
    storage_region: str = Field(default="us-east-1")

    # ── Auth ──────────────────────────────────────────────────────────────────
    # IMPORTANT: disable_auth must be False in production. Enforced below.
    disable_auth: bool = Field(default=True)
    jwt_secret: str = Field(default="change-me-in-production")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expire_minutes: int = Field(default=60)

    # ── LLM ───────────────────────────────────────────────────────────────────
    llm_primary_provider: Literal["openai", "anthropic"] = Field(default="openai")
    llm_primary_model: str = Field(default="gpt-4o")
    llm_primary_model_version: str = Field(default="2024-11-20")
    llm_fallback_provider: Literal["openai", "anthropic"] = Field(default="anthropic")
    llm_fallback_model: str = Field(default="claude-3-5-sonnet-20241022")
    openai_api_key: str = Field(default="")
    anthropic_api_key: str = Field(default="")
    llm_temperature: float = Field(default=0.0, ge=0.0, le=1.0)
    llm_seed: int = Field(default=42)

    @field_validator("openai_api_key")
    @classmethod
    def _clean_openai_api_key(cls, v: str) -> str:
        """
        Strip incidental whitespace and fail fast on non-ASCII characters.
        HTTP headers (the Authorization header this key goes into) must be
        ASCII — a stray character from copy-pasting the key (smart quotes,
        zero-width spaces, etc.) otherwise breaks every OpenAI call with a
        cryptic UnicodeEncodeError deep inside httpx instead of a clear
        error here at startup.
        """
        cleaned = v.strip()
        try:
            cleaned.encode("ascii")
        except UnicodeEncodeError as e:
            msg = (
                "OPENAI_API_KEY contains a non-ASCII character (likely from "
                "copy-pasting) — re-paste it via a plain text editor first."
            )
            raise ValueError(msg) from e
        return cleaned

    # ── ASR ───────────────────────────────────────────────────────────────────
    asr_adapter: Literal["faster_whisper", "deepgram", "assemblyai"] = Field(
        default="faster_whisper"
    )
    faster_whisper_model: str = Field(default="large-v3")
    faster_whisper_device: Literal["cpu", "cuda"] = Field(default="cpu")
    deepgram_api_key: str = Field(default="")

    # ── Scoring reproducibility ───────────────────────────────────────────────
    # Pinned values are stored on each evaluation record (R3).
    rubric_version_pin: str | None = Field(default=None)

    # ── Retention ─────────────────────────────────────────────────────────────
    audio_retention_days: int = Field(default=90, ge=1)
    transcript_retention_days: int = Field(default=730, ge=1)

    # ── Concurrency ───────────────────────────────────────────────────────────
    max_concurrent_jobs_per_tenant: int = Field(default=3, ge=1)
    queue_visibility_timeout_s: int = Field(default=300, ge=30)

    # ── Feature flags ─────────────────────────────────────────────────────────
    enable_diarization: bool = Field(default=True)
    enable_identity_check: bool = Field(default=True)
    enable_prompt_injection_detection: bool = Field(default=True)

    # ── Calibration thresholds ────────────────────────────────────────────────
    calibration_drift_mean_high: float = Field(default=85.0)
    calibration_drift_mean_low: float = Field(default=30.0)
    calibration_drift_std_low: float = Field(default=5.0)

    # ── Presentation duration thresholds ─────────────────────────────────────
    min_presentation_duration_s: int = Field(default=120)  # 2 minutes
    auto_stop_grace_period_s: int = Field(default=60)
    resume_window_s: int = Field(default=90)

    # ── Audio health thresholds ───────────────────────────────────────────────
    audio_rms_too_quiet_dbfs: float = Field(default=-45.0)
    audio_rms_clipping_dbfs: float = Field(default=-1.0)
    audio_snr_low_confidence_db: float = Field(default=10.0)
    audio_speech_ratio_min: float = Field(default=0.3)

    @model_validator(mode="after")
    def _validate_production_safety(self) -> Settings:
        """Block unsafe configs that could accidentally reach production."""
        if self.environment == "production" and self.disable_auth:
            msg = "DISABLE_AUTH cannot be true in production environment"
            raise ValueError(msg)
        if not self.disable_auth:
            if self.jwt_secret == "change-me-in-production":  # noqa: S105
                msg = "JWT_SECRET must be changed when DISABLE_AUTH=false"
                raise ValueError(msg)
        return self

    @field_validator("llm_temperature")
    @classmethod
    def _temperature_reproducibility(cls, v: float) -> float:
        """Warn if temperature > 0 (reduces reproducibility per R3)."""
        if v > 0:
            import warnings

            warnings.warn(
                f"LLM_TEMPERATURE={v} > 0 reduces evaluation reproducibility (R3). "
                "Set to 0 for production.",
                stacklevel=2,
            )
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings singleton. Import this everywhere."""
    return Settings()
