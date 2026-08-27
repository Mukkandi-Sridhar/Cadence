"""
Sessions router — CRUD + event history.

Provides:
  GET  /api/v1/sessions          — list all sessions (newest first)
  POST /api/v1/sessions          — create a new session
  GET  /api/v1/sessions/{id}     — get session detail
  POST /api/v1/sessions/{id}/events — append a session event (transcript chunk, stage update, etc.)
  GET  /api/v1/sessions/{id}/events — list session events
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["sessions"])

# ── In-memory store (Phase 0 — replace with DB in Phase 1) ───────────────────
_sessions: dict[str, dict[str, Any]] = {}
_session_events: dict[str, list[dict[str, Any]]] = {}


# ── Pydantic models ───────────────────────────────────────────────────────────


class SessionCreate(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    coverage_points: list[str] = Field(default_factory=list)
    target_duration_seconds: int = Field(default=600, ge=30, le=7200)
    presenter_names: list[str] = Field(default_factory=list, min_length=1)


class SessionEventCreate(BaseModel):
    event_type: str = Field(
        ...,
        description="e.g. TRANSCRIPT_CHUNK, AUDIO_HEALTH, STAGE_UPDATE, EVALUATION_COMPLETE",
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


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions() -> list[SessionResponse]:
    """Return all sessions sorted by newest first."""
    sessions = sorted(_sessions.values(), key=lambda s: s["created_at"], reverse=True)
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
    _sessions[session_id] = session
    _session_events[session_id] = []
    logger.info("session_created", session_id=session_id, topic=body.topic)
    return SessionResponse(**session)


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str) -> SessionResponse:
    """Get a single session by ID."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    return SessionResponse(**session)


@router.post("/sessions/{session_id}/events", response_model=SessionEventResponse, status_code=201)
async def create_session_event(session_id: str, body: SessionEventCreate) -> SessionEventResponse:
    """Append an event to a session's history timeline."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")

    event = {
        "id": f"evt-{uuid.uuid4().hex[:10]}",
        "session_id": session_id,
        "event_type": body.event_type,
        "payload": body.payload,
        "created_at": datetime.now(UTC).isoformat(),
    }

    # Auto-update session status on key events
    status_map = {
        "RECORDING_STARTED": "RECORDING",
        "RECORDING_STOPPED": "PROCESSING",
        "EVALUATION_COMPLETE": "SCORED",
        "EVALUATION_FAILED": "FAILED",
    }
    if body.event_type in status_map:
        _sessions[session_id]["status"] = status_map[body.event_type]
        _sessions[session_id]["updated_at"] = event["created_at"]

    _session_events[session_id].append(event)
    logger.info("session_event_created", session_id=session_id, event_type=body.event_type)
    return SessionEventResponse(**event)


@router.get("/sessions/{session_id}/events", response_model=list[SessionEventResponse])
async def list_session_events(session_id: str) -> list[SessionEventResponse]:
    """Return full chronological event log for a session."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    return [SessionEventResponse(**e) for e in _session_events[session_id]]
