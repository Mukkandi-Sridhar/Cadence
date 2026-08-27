"""
SSE streaming router — GET /api/v1/stream/{recording_id}

Provides a Server-Sent Events (SSE) endpoint for real-time events:
  - transcript: live speech recognition segments
  - audio_health: mic level / SNR / clipping metrics
  - job_status: evaluation pipeline progress

In production this would be backed by Redis pub/sub.
Currently provides a heartbeat connection to confirm the stream is live.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

import structlog
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["stream"])


async def _sse_event(event_type: str, data: dict) -> str:  # type: ignore[type-arg]
    """Format a Server-Sent Event."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


async def _recording_event_stream(recording_id: str) -> AsyncIterator[str]:
    """
    Async generator that yields SSE events for a recording session.
    Sends a heartbeat every 5 seconds to keep the connection alive.
    In production this subscribes to Redis pub/sub for live events.
    """
    logger.info("sse_stream_connected", recording_id=recording_id)
    heartbeat_count = 0

    try:
        while True:
            heartbeat_count += 1
            # Send heartbeat / connection confirmation
            yield await _sse_event("heartbeat", {
                "recording_id": recording_id,
                "count": heartbeat_count,
                "status": "streaming",
            })
            await asyncio.sleep(5)
    except asyncio.CancelledError:
        logger.info("sse_stream_disconnected", recording_id=recording_id)


@router.get("/stream/{recording_id}")
async def stream_recording_events(recording_id: str) -> StreamingResponse:
    """
    SSE endpoint for real-time recording events.
    Frontend connects here during LiveRecording to receive live transcript,
    audio health metrics, and evaluation pipeline job status updates.
    """
    return StreamingResponse(
        _recording_event_stream(recording_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        },
    )
