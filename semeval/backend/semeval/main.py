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

    # ── CORS (Permissive for all origins + Render subdomains) ──────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_origin_regex=r"https://.*\.onrender\.com",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Root & Health Check Routes ─────────────────────────────────────────────
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

    @app.get("/health", include_in_schema=False)
    @app.get("/api/v1/health", include_in_schema=False)
    async def direct_health_check() -> dict[str, str]:
        return {"status": "ok", "version": "0.1.0"}

    # ── API Routers ────────────────────────────────────────────────────────────
    app.include_router(health.router, prefix="/api/v1")
    app.include_router(sessions.router, prefix="/api/v1")
    app.include_router(evaluate.router, prefix="/api/v1")
    app.include_router(stream.router, prefix="/api/v1")

    # ── Static Frontend SPA Serving (if dist directory exists) ─────────────────
    import os

    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    dist_dir = os.environ.get("FRONTEND_DIST_DIR", "/app/frontend_dist")
    if not os.path.exists(dist_dir):
        # Fallback to local monorepo path
        local_dist = os.path.join(
            os.path.dirname(__file__), "..", "..", "frontend", "dist"
        )
        if os.path.exists(local_dist):
            dist_dir = local_dist

    if os.path.exists(dist_dir):
        assets_dir = os.path.join(dist_dir, "assets")
        if os.path.exists(assets_dir):
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        index_file = os.path.join(dist_dir, "index.html")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(full_path: str) -> FileResponse:
            # Do not intercept API, docs, or OpenAPI routes
            if full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail="Not Found")
            target_path = os.path.join(dist_dir, full_path)
            if full_path and os.path.exists(target_path) and os.path.isfile(target_path):
                return FileResponse(target_path)
            return FileResponse(index_file)

    return app


app = create_app()
