"""Health check router."""

from __future__ import annotations

import structlog
from fastapi import APIRouter
from pydantic import BaseModel

from semeval.config import get_settings
from semeval.db.supabase_client import get_supabase

logger = structlog.get_logger(__name__)
settings = get_settings()

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    version: str
    supabase: str


def _check_supabase() -> str:
    """
    A cheap real query, not just "did the client construct". This is what
    would have caught tonight's outage immediately instead of requiring
    someone to open browser dev tools: a corrupted SUPABASE_SERVICE_ROLE_KEY
    made every request silently fall back to memory-only storage while this
    endpoint kept returning "ok" the whole time.
    """
    try:
        sb = get_supabase()
        sb.table("cadence_events").select("id").limit(1).execute()
        return "ok"
    except Exception as err:
        return f"error: {err}"


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """
    Liveness probe. Always returns 200 with status="ok" so Render/Docker
    don't restart-loop the service over a downstream dependency outage —
    the "supabase" field is what to actually watch/alert on.
    """
    supabase_status = _check_supabase()
    if supabase_status != "ok":
        logger.error("health_check_supabase_degraded", detail=supabase_status)
    return HealthResponse(status="ok", version="0.1.0", supabase=supabase_status)
