"""
ARQ worker entry point.
Defines the worker settings and registers all background job functions.
Full job implementations are added in Phase 1-3.
"""

from __future__ import annotations

from typing import Any, ClassVar

from arq.connections import RedisSettings

from semeval.config import get_settings

settings = get_settings()


async def startup(ctx: dict[str, Any]) -> None:
    """Worker startup — initialise DB pool, storage client, etc."""
    import structlog
    log = structlog.get_logger(__name__)
    log.info("arq_worker_starting")


async def shutdown(ctx: dict[str, Any]) -> None:
    """Worker shutdown."""
    import structlog
    log = structlog.get_logger(__name__)
    log.info("arq_worker_stopping")


# ── Job stubs — full implementations added in Phase 1+ ───────────────────────

async def assemble_recording(ctx: dict[str, Any], recording_id: str) -> None:
    """Merge uploaded chunks into a single audio file. (Phase 1)"""
    pass


async def run_evaluation(ctx: dict[str, Any], evaluation_id: str) -> None:
    """Run the full agent evaluation pipeline. (Phase 3)"""
    pass


class WorkerSettings:
    """ARQ worker configuration."""

    functions: ClassVar[list[Any]] = [
        assemble_recording,
        run_evaluation,
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = settings.max_concurrent_jobs_per_tenant
    job_timeout = settings.queue_visibility_timeout_s
    health_check_interval = 10
