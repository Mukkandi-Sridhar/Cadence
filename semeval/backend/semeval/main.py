"""FastAPI application factory."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from semeval.api.routers import evaluate, health, sessions, stream
from semeval.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and shutdown."""
    logger.info("semeval_starting", disable_auth=settings.disable_auth)
    if settings.disable_auth:
        logger.warning(
            "AUTH_DISABLED",
            message="DISABLE_AUTH=true — never run this in production",
        )
    yield
    logger.info("semeval_stopping")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Semeval — Seminar Evaluation Platform",
        version="0.1.0",
        description=(
            "Multi-agent AI-powered presentation evaluation. "
            "Audio → Transcript → Agents → Deterministic Score."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Root Route ─────────────────────────────────────────────────────────────
    @app.get("/", include_in_schema=False)
    async def root_index() -> dict[str, str]:
        return {
            "name": "Cadence — Seminar Evaluation API",
            "version": "0.1.0",
            "docs": "/docs",
            "health": "/api/v1/health",
            "evaluate": "/api/v1/evaluate",
            "sessions": "/api/v1/sessions",
            "stream": "/api/v1/stream/{recording_id}",
        }

    # ── API Routers ────────────────────────────────────────────────────────────
    app.include_router(health.router, prefix="/api/v1")
    app.include_router(sessions.router, prefix="/api/v1")
    app.include_router(evaluate.router, prefix="/api/v1")
    app.include_router(stream.router, prefix="/api/v1")

    return app


app = create_app()
