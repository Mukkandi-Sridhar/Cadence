"""
Sessions router — CRUD + event history backed by Supabase & Postgres.

Provides:
  GET  /api/v1/sessions          — list all sessions (newest first)
  POST /api/v1/sessions          — create a new session
  GET  /api/v1/sessions/{id}     — get session detail
  POST /api/v1/sessions/{id}/events — append a session event
  GET  /api/v1/sessions/{id}/events — list session events
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from semeval.db.supabase_client import get_supabase

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["sessions"])

# ── In-memory fallback cache ──────────────────────────────────────────────────
_sessions_cache: dict[str, dict[str, Any]] = {}
_events_cache: dict[str, list[dict[str, Any]]] = {}


# ── Pydantic models ───────────────────────────────────────────────────────────


class SessionCreate(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    coverage_points: list[str] = Field(default_factory=list)
    target_duration_seconds: int = Field(default=600, ge=30, le=7200)
    presenter_names: list[str] = Field(default_factory=list, min_length=1)


class SessionEventCreate(BaseModel):
    event_type: str = Field(
        ...,
        description="e.g. RECORDING_STARTED, TRANSCRIPT_CHUNK, AUDIO_HEALTH, EVALUATION_COMPLETE",
    )
    payload: dict[str, Any] = Field(default_factory=dict)


class SessionResponse(BaseModel):
    id: str
    topic: str
    coverage_points: list[str]
    target_duration_seconds: int
    presenter_names: list[str]
    status: str
    created_at: str
    updated_at: str


class SessionEventResponse(BaseModel):
    id: str
    session_id: str
    event_type: str
    payload: dict[str, Any]
    created_at: str


# ── Helpers ───────────────────────────────────────────────────────────────────


def _save_session(session: dict[str, Any]) -> None:
    """Save session to in-memory cache and attempt Supabase sync."""
    _sessions_cache[session["id"]] = session
    try:
        sb = get_supabase()
        sb.table("session_records").upsert(session).execute()
    except Exception as err:
        logger.debug("supabase_session_upsert_fallback", error=str(err))


def _save_event(event: dict[str, Any]) -> None:
    """Save event to in-memory cache and attempt Supabase sync."""
    sid = event["session_id"]
    if sid not in _events_cache:
        _events_cache[sid] = []
    _events_cache[sid].append(event)
    try:
        sb = get_supabase()
        sb.table("session_event_logs").upsert(event).execute()
    except Exception as err:
        logger.debug("supabase_event_upsert_fallback", error=str(err))


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions() -> list[SessionResponse]:
    """Return all sessions sorted by newest first."""
    try:
        sb = get_supabase()
        res = sb.table("session_records").select("*").order("created_at", desc=True).execute()
        if res.data:
            return [SessionResponse(**dict(s)) for s in res.data if isinstance(s, dict)]
    except Exception as err:
        logger.debug("supabase_list_sessions_fallback", error=str(err))

    sessions = sorted(_sessions_cache.values(), key=lambda s: s["created_at"], reverse=True)
    return [SessionResponse(**s) for s in sessions]


@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session(body: SessionCreate) -> SessionResponse:
    """Create a new evaluation session."""
    session_id = f"sess-{uuid.uuid4().hex[:12]}"
    now = datetime.now(UTC).isoformat()
    session = {
        "id": session_id,
        "topic": body.topic,
        "coverage_points": body.coverage_points,
        "target_duration_seconds": body.target_duration_seconds,
        "presenter_names": body.presenter_names,
        "status": "PENDING",
        "created_at": now,
        "updated_at": now,
    }
    _save_session(session)
    logger.info("session_created", session_id=session_id, topic=body.topic)
    return SessionResponse(**session)


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str) -> SessionResponse:
    """Get a single session by ID."""
    try:
        sb = get_supabase()
        res = sb.table("session_records").select("*").eq("id", session_id).execute()
        if res.data and len(res.data) > 0 and isinstance(res.data[0], dict):
            return SessionResponse(**dict(res.data[0]))
    except Exception as err:
        logger.debug("supabase_get_session_fallback", error=str(err))

    session = _sessions_cache.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    return SessionResponse(**session)


@router.post("/sessions/{session_id}/events", response_model=SessionEventResponse, status_code=201)
async def create_session_event(session_id: str, body: SessionEventCreate) -> SessionEventResponse:
    """Append an event to a session's history timeline."""
    session = await get_session(session_id)  # verifies existence

    event = {
        "id": f"evt-{uuid.uuid4().hex[:10]}",
        "session_id": session_id,
        "event_type": body.event_type,
        "payload": body.payload,
        "created_at": datetime.now(UTC).isoformat(),
    }

    _save_event(event)

    # Auto-update session status on key events
    status_map = {
        "RECORDING_STARTED": "RECORDING",
        "RECORDING_STOPPED": "PROCESSING",
        "EVALUATION_COMPLETE": "SCORED",
        "EVALUATION_FAILED": "FAILED",
    }
    if body.event_type in status_map:
        updated = session.model_dump()
        updated["status"] = status_map[body.event_type]
        updated["updated_at"] = event["created_at"]
        _save_session(updated)

    logger.info("session_event_created", session_id=session_id, event_type=body.event_type)
    return SessionEventResponse(**event)


@router.get("/sessions/{session_id}/events", response_model=list[SessionEventResponse])
async def list_session_events(session_id: str) -> list[SessionEventResponse]:
    """Return full chronological event log for a session."""
    try:
        sb = get_supabase()
        res = (
            sb.table("session_event_logs")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at", desc=False)
            .execute()
        )
        if res.data:
            return [SessionEventResponse(**dict(e)) for e in res.data if isinstance(e, dict)]
    except Exception as err:
        logger.debug("supabase_list_events_fallback", error=str(err))

    events = _events_cache.get(session_id, [])
    return [SessionEventResponse(**e) for e in events]
