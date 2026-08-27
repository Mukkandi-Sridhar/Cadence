"""
Events router — CRUD backed by Supabase, in-memory fallback.

Provides:
  GET  /api/v1/events        — list all events (newest first)
  POST /api/v1/events        — create a new event
  GET  /api/v1/events/{id}   — get event detail
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

router = APIRouter(tags=["events"])

# ── In-memory fallback cache ──────────────────────────────────────────────────
_events_cache: dict[str, dict[str, Any]] = {}


# ── Pydantic models ───────────────────────────────────────────────────────────


class EventCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    event_date: str = Field(..., description="ISO date string, e.g. 2026-08-27")


class EventResponse(BaseModel):
    id: str
    name: str
    event_date: str
    created_at: str


# ── Helpers ───────────────────────────────────────────────────────────────────


def _save_event(event: dict[str, Any]) -> None:
    _events_cache[event["id"]] = event
    try:
        sb = get_supabase()
        sb.table("events").upsert(event).execute()
    except Exception as err:
        logger.debug("supabase_event_upsert_fallback", error=str(err))


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/events", response_model=list[EventResponse])
async def list_events() -> list[EventResponse]:
    """Return all events, sorted by newest first."""
    try:
        sb = get_supabase()
        res = sb.table("events").select("*").order("created_at", desc=True).execute()
        if res.data:
            return [EventResponse(**dict(e)) for e in res.data if isinstance(e, dict)]
    except Exception as err:
        logger.debug("supabase_list_events_fallback", error=str(err))

    events = sorted(_events_cache.values(), key=lambda e: e["created_at"], reverse=True)
    return [EventResponse(**e) for e in events]


@router.post("/events", response_model=EventResponse, status_code=201)
async def create_event(body: EventCreate) -> EventResponse:
    """Create a new event."""
    event_id = f"evt-{uuid.uuid4().hex[:12]}"
    now = datetime.now(UTC).isoformat()
    event = {
        "id": event_id,
        "name": body.name,
        "event_date": body.event_date,
        "created_at": now,
    }
    _save_event(event)
    logger.info("event_created", event_id=event_id, name=body.name)
    return EventResponse(**event)


@router.get("/events/{event_id}", response_model=EventResponse)
async def get_event(event_id: str) -> EventResponse:
    """Get a single event by ID."""
    try:
        sb = get_supabase()
        res = sb.table("events").select("*").eq("id", event_id).execute()
        if res.data and len(res.data) > 0 and isinstance(res.data[0], dict):
            return EventResponse(**dict(res.data[0]))
    except Exception as err:
        logger.debug("supabase_get_event_fallback", error=str(err))

    event = _events_cache.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found")
    return EventResponse(**event)
