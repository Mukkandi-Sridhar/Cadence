"""
Regression test: scoring must refuse a presentation with no transcript.

Found during a full-pipeline audit. The client saved the transcript
fire-and-forget while the "Get Score" button was already enabled, so
clicking quickly enough scored an empty transcript — the LLM was handed
"[No transcript captured]" and returned a meaningless ~4/100 that looked
like a real evaluation of the talk. The client now waits for the save to
be confirmed; this is the server-side backstop.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from semeval.api.routers import presentations, score


@pytest.fixture
def presentation_without_transcript() -> str:
    presentation_id = "pres-empty-transcript-test"
    presentations._presentations_cache[presentation_id] = {
        "id": presentation_id,
        "event_id": "evt-test",
        "team_name": "Team Test",
        "members": ["Tester"],
        "topic": "sunlight benefits",
        "custom_instructions": None,
        "status": "RECORDED",
        "transcript_text": "",
        "transcript_segments": [],
        "duration_seconds": 30,
        "created_at": "2026-08-27T00:00:00+00:00",
        "updated_at": "2026-08-27T00:00:00+00:00",
    }
    yield presentation_id
    presentations._presentations_cache.pop(presentation_id, None)


async def test_scoring_empty_transcript_is_rejected(
    presentation_without_transcript: str,
) -> None:
    req = score.ScoreRequest(human_physical_score=4)

    with pytest.raises(HTTPException) as exc:
        await score.score_presentation(presentation_without_transcript, req)

    assert exc.value.status_code == 400
    assert "nothing to score" in exc.value.detail


async def test_scoring_whitespace_only_transcript_is_rejected(
    presentation_without_transcript: str,
) -> None:
    presentations._presentations_cache[presentation_without_transcript]["transcript_text"] = (
        "   \n  "
    )
    req = score.ScoreRequest(human_physical_score=3)

    with pytest.raises(HTTPException) as exc:
        await score.score_presentation(presentation_without_transcript, req)

    assert exc.value.status_code == 400
