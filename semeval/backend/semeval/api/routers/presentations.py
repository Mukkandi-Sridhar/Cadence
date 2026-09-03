"""
Presentations router — CRUD backed by Supabase, in-memory fallback.

A presentation belongs to an event: team name, members, topic, and an
optional custom evaluation instructions block. A rough live transcript is
captured client-side (Web Speech API) for real-time captions; the accurate
transcript actually used for scoring comes from POST .../transcribe, which
runs the recorded audio through OpenAI's gpt-4o-transcribe once recording
stops.

Provides:
  GET   /api/v1/events/{event_id}/presentations       — list presentations in an event
  POST  /api/v1/events/{event_id}/presentations       — create a presentation
  GET   /api/v1/presentations/{id}                    — get presentation detail
  PATCH /api/v1/presentations/{id}                    — save transcript / duration / status
  POST  /api/v1/presentations/{id}/transcribe          — transcribe recorded audio accurately
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from semeval.api.rate_limit import rate_limit_costly_endpoint
from semeval.config import get_settings
from semeval.db.supabase_client import get_supabase

logger = structlog.get_logger(__name__)
settings = get_settings()

router = APIRouter(tags=["presentations"])

# ── In-memory fallback cache ──────────────────────────────────────────────────
_presentations_cache: dict[str, dict[str, Any]] = {}

PRESENTATION_STATUSES = ("DRAFT", "RECORDING", "RECORDED", "SCORED")

# OpenAI's transcription endpoint rejects uploads larger than 25MB.
_MAX_AUDIO_BYTES = 25 * 1024 * 1024


# ── Pydantic models ───────────────────────────────────────────────────────────


class PresentationCreate(BaseModel):
    team_name: str = Field(..., min_length=1, max_length=200)
    members: list[str] = Field(..., min_length=1)
    topic: str = Field(..., min_length=1, max_length=500)
    custom_instructions: str | None = Field(default=None, max_length=4000)


class TranscriptSegmentIn(BaseModel):
    id: str
    text: str
    start_ms: int
    end_ms: int


class PresentationUpdate(BaseModel):
    transcript_text: str | None = None
    transcript_segments: list[TranscriptSegmentIn] | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    status: str | None = None


class TranscribeResponse(BaseModel):
    transcript_text: str


class PresentationResponse(BaseModel):
    id: str
    event_id: str
    team_name: str
    members: list[str]
    topic: str
    custom_instructions: str | None
    status: str
    transcript_text: str
    transcript_segments: list[dict[str, Any]]
    duration_seconds: int
    created_at: str
    updated_at: str


# ── Helpers ───────────────────────────────────────────────────────────────────


def _save_presentation(pres: dict[str, Any]) -> None:
    _presentations_cache[pres["id"]] = pres
    try:
        sb = get_supabase()
        sb.table("cadence_presentations").upsert(pres).execute()
    except Exception as err:
        err_str = str(err)
        if "23503" in err_str or "cadence_presentations_event_id_fkey" in err_str:
            event_id = pres.get("event_id")
            if event_id:
                from semeval.api.routers.events import _events_cache, _save_event

                parent_event = _events_cache.get(event_id)
                if parent_event:
                    logger.info("syncing_cached_parent_event_to_supabase", event_id=event_id)
                    _save_event(parent_event)
                    try:
                        sb = get_supabase()
                        sb.table("cadence_presentations").upsert(pres).execute()
                        return
                    except Exception as retry_err:
                        logger.error(
                            "supabase_presentation_upsert_retry_failed",
                            error=str(retry_err),
                        )
        logger.error("supabase_presentation_upsert_fallback", error=err_str)


def _fetch_presentation(presentation_id: str) -> dict[str, Any] | None:
    try:
        sb = get_supabase()
        res = sb.table("cadence_presentations").select("*").eq("id", presentation_id).execute()
        if res.data and len(res.data) > 0 and isinstance(res.data[0], dict):
            return dict(res.data[0])
    except Exception as err:
        logger.error("supabase_get_presentation_fallback", error=str(err))
    return _presentations_cache.get(presentation_id)


def _delete_presentation(presentation_id: str) -> None:
    _presentations_cache.pop(presentation_id, None)
    try:
        sb = get_supabase()
        sb.table("cadence_presentations").delete().eq("id", presentation_id).execute()
    except Exception as err:
        logger.error("supabase_presentation_delete_fallback", error=str(err))

    from semeval.api.routers.score import _delete_score

    _delete_score(presentation_id)


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/events/{event_id}/presentations", response_model=list[PresentationResponse])
async def list_presentations(event_id: str) -> list[PresentationResponse]:
    """List all presentations for an event, newest first."""
    try:
        sb = get_supabase()
        res = (
            sb.table("cadence_presentations")
            .select("*")
            .eq("event_id", event_id)
            .order("created_at", desc=True)
            .execute()
        )
        if res.data:
            return [PresentationResponse(**dict(p)) for p in res.data if isinstance(p, dict)]
    except Exception as err:
        logger.error("supabase_list_presentations_fallback", error=str(err))

    presentations = [p for p in _presentations_cache.values() if p.get("event_id") == event_id]
    presentations.sort(key=lambda p: p["created_at"], reverse=True)
    return [PresentationResponse(**p) for p in presentations]


@router.post(
    "/events/{event_id}/presentations",
    response_model=PresentationResponse,
    status_code=201,
)
async def create_presentation(event_id: str, body: PresentationCreate) -> PresentationResponse:
    """Create a new presentation under an event."""
    presentation_id = f"pres-{uuid.uuid4().hex[:12]}"
    now = datetime.now(UTC).isoformat()
    pres = {
        "id": presentation_id,
        "event_id": event_id,
        "team_name": body.team_name,
        "members": body.members,
        "topic": body.topic,
        "custom_instructions": body.custom_instructions,
        "status": "DRAFT",
        "transcript_text": "",
        "transcript_segments": [],
        "duration_seconds": 0,
        "created_at": now,
        "updated_at": now,
    }
    _save_presentation(pres)
    logger.info("presentation_created", presentation_id=presentation_id, event_id=event_id)
    return PresentationResponse(**pres)


@router.get("/presentations/{presentation_id}", response_model=PresentationResponse)
async def get_presentation(presentation_id: str) -> PresentationResponse:
    """Get a single presentation by ID."""
    pres = _fetch_presentation(presentation_id)
    if not pres:
        raise HTTPException(status_code=404, detail=f"Presentation '{presentation_id}' not found")
    return PresentationResponse(**pres)


@router.patch("/presentations/{presentation_id}", response_model=PresentationResponse)
async def update_presentation(
    presentation_id: str, body: PresentationUpdate
) -> PresentationResponse:
    """Save transcript / duration / status — called when recording starts/stops."""
    pres = _fetch_presentation(presentation_id)
    if not pres:
        raise HTTPException(status_code=404, detail=f"Presentation '{presentation_id}' not found")

    if body.transcript_text is not None:
        pres["transcript_text"] = body.transcript_text
    if body.transcript_segments is not None:
        pres["transcript_segments"] = [s.model_dump() for s in body.transcript_segments]
    if body.duration_seconds is not None:
        pres["duration_seconds"] = body.duration_seconds
    if body.status is not None:
        if body.status not in PRESENTATION_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status '{body.status}'")
        pres["status"] = body.status
    pres["updated_at"] = datetime.now(UTC).isoformat()

    _save_presentation(pres)
    logger.info("presentation_updated", presentation_id=presentation_id, status=pres["status"])
    return PresentationResponse(**pres)


@router.delete("/presentations/{presentation_id}", status_code=204)
async def delete_presentation(presentation_id: str) -> None:
    """Delete a presentation by ID."""
    pres = _fetch_presentation(presentation_id)
    if not pres:
        raise HTTPException(status_code=404, detail=f"Presentation '{presentation_id}' not found")
    _delete_presentation(presentation_id)
    logger.info("presentation_deleted", presentation_id=presentation_id)


@router.post(
    "/presentations/{presentation_id}/transcribe",
    response_model=TranscribeResponse,
    dependencies=[Depends(rate_limit_costly_endpoint)],
)
async def transcribe_presentation(
    presentation_id: str,
    audio: UploadFile = File(...),
    duration_seconds: int = Form(...),
) -> TranscribeResponse:
    """
    Accurately transcribe the recorded audio via OpenAI's gpt-4o-transcribe,
    replacing the rough live Web-Speech draft as the transcript used for
    scoring. Saves the result onto the presentation (status -> RECORDED).
    """
    pres = _fetch_presentation(presentation_id)
    if not pres:
        raise HTTPException(status_code=404, detail=f"Presentation '{presentation_id}' not found")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No audio data received.")

    # The transcription API rejects files over 25MB. At the client's 24kbps
    # mono encoding that's ~2 hours of speech, so hitting this means something
    # is wrong — say so plainly instead of forwarding an opaque provider error.
    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Recording is too large to transcribe "
                f"({len(audio_bytes) / 1_000_000:.1f}MB, limit 25MB). "
                "Please record in shorter segments."
            ),
        )

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        result = await client.audio.transcriptions.create(
            model="gpt-4o-transcribe",
            file=(
                audio.filename or "recording.webm",
                audio_bytes,
                audio.content_type or "audio/webm",
            ),
        )
        transcript_text = (result.text or "").strip()
    except Exception as e:
        logger.error("transcription_failed", presentation_id=presentation_id, error=str(e))
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}") from e

    # Never let a silent/empty result wipe a transcript that's already saved —
    # the client falls back to its live captions in that case, and clobbering
    # good text with "" here would leave nothing to score.
    if not transcript_text and pres.get("transcript_text"):
        logger.warning(
            "transcription_empty_kept_existing",
            presentation_id=presentation_id,
            audio_bytes=len(audio_bytes),
        )
        return TranscribeResponse(transcript_text=str(pres["transcript_text"]))

    pres["transcript_text"] = transcript_text
    pres["duration_seconds"] = duration_seconds
    pres["status"] = "RECORDED"
    pres["updated_at"] = datetime.now(UTC).isoformat()
    _save_presentation(pres)

    logger.info(
        "presentation_transcribed",
        presentation_id=presentation_id,
        word_count=len(transcript_text.split()),
    )
    return TranscribeResponse(transcript_text=transcript_text)
