"""
Scoring router — POST /api/v1/presentations/{id}/score

Combines the presentation's saved transcript + topic + optional custom
evaluation instructions with a human-provided physical-delivery rating.

Six dimensions are scored by the LLM from the transcript alone (it never
sees the presenter, so it cannot judge body language). The seventh —
physical confidence & body language — is supplied directly by the human
evaluator. The LLM never computes the final total; `scoring.engine.compute_score`
does that deterministically from all seven per-dimension inputs (Rule R1).
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from semeval.api.routers.presentations import _fetch_presentation, _save_presentation
from semeval.config import get_settings
from semeval.db.supabase_client import get_supabase
from semeval.scoring.engine import DimensionInput, DimensionStatus, compute_score

logger = structlog.get_logger(__name__)
settings = get_settings()

router = APIRouter(tags=["score"])

# ── In-memory fallback cache ──────────────────────────────────────────────────
_scores_cache: dict[str, dict[str, Any]] = {}


# ── Request / Response models ─────────────────────────────────────────────────


class ScoreRequest(BaseModel):
    human_physical_score: int = Field(..., ge=1, le=5)
    human_note: str | None = Field(default=None, max_length=2000)


class EvidenceItem(BaseModel):
    span: str
    reason: str


class DimensionScoreOut(BaseModel):
    dimension: str
    weight: float
    raw_sub_score: float | None
    scaled_score: float | None
    status: str
    source: str  # "AI" | "HUMAN"
    evidence: list[EvidenceItem]


class FeedbackItem(BaseModel):
    text: str
    span: str


class ScoreResponse(BaseModel):
    id: str
    presentation_id: str
    total_score: int
    dimension_scores: list[DimensionScoreOut]
    positives: list[FeedbackItem]
    negatives: list[FeedbackItem]
    human_physical_score: int
    human_note: str | None
    model_name: str
    model_version: str
    prompt_hash: str
    created_at: str


# ── Rubric ─────────────────────────────────────────────────────────────────────
# Six AI dimensions + one human dimension. Weights sum to 100.

_AI_DIMENSION_WEIGHTS: dict[str, float] = {
    "Introduction & Opening": 10.0,
    "Content Depth & Explanation": 25.0,
    "Structure & Flow (Phases)": 15.0,
    "Tone, Language & Clarity": 10.0,
    "Verbal Communication & Confidence": 15.0,
    "Closing & End Card": 10.0,
}
_HUMAN_DIMENSION = "Physical Confidence & Body Language"
_HUMAN_DIMENSION_WEIGHT = 15.0


def _build_system_prompt() -> str:
    dims = "\n".join(f"{i}. {name}" for i, name in enumerate(_AI_DIMENSION_WEIGHTS, start=1))
    return f"""You are an extremely strict, skeptical presentation evaluator for academic and \
professional seminars. You are not here to be encouraging — you are here to be accurate. \
Presenters and their organizers WANT high scores; your job is to resist that pressure and \
score only what the transcript actually demonstrates. Never round up. Never give credit for \
what a "good presentation would probably include" — only for what is verifiably present.

You evaluate EXACTLY these {len(_AI_DIMENSION_WEIGHTS)} dimensions (use these EXACT names):
{dims}

You do NOT evaluate physical delivery, body language, gestures, or facial expressions — you \
have no visual/audio access to the presenter, only a text transcript. That dimension is scored \
separately by a human observer.

STRICT 0.0-5.0 GRADING SCALE (apply literally, do not cluster everything at 3):
- 0.0-1.5  POOR / INCOMPLETE: missing, off-topic, under 40 words, no real structure or content.
- 2.0-2.5  BELOW AVERAGE: superficial mention, disorganized, vague claims without explanation.
- 3.0-3.5  SATISFACTORY: meets the baseline — present, on-topic, understandable — nothing more.
- 4.0-4.5  VERY GOOD: clear structure, real explanatory depth, precise language, strong evidence \
in the transcript of the dimension being executed well.
- 5.0      EXCEPTIONAL: reserve for flawless, unambiguous mastery. This should be rare.

MANDATORY PENALTY RULES:
- If total transcript word count is under 40 words, OR the talk is a single line/sentence: cap \
EVERY dimension's raw_sub_score at 0.5-1.5, regardless of how polished that one line sounds.
- If a dimension has no explicit, quotable evidence in the transcript, set its status to \
INSUFFICIENT_EVIDENCE and its raw_sub_score to 0.0-1.0 — do not guess generously.
- If the transcript drifts off the stated topic, penalize "Content Depth & Explanation" and \
"Structure & Flow (Phases)" heavily, even if delivery elsewhere is fine.
- When evidence is ambiguous or borderline between two bands, ALWAYS choose the lower band.
- Do not give 4.0+ on any dimension unless you can quote at least one specific, substantive \
piece of transcript evidence that clearly earns it.

EVIDENCE RULES:
- Every "evidence_spans" entry, and every "positives"/"negatives" entry, MUST include a `span` \
that is a verbatim, exact substring quoted from the transcript. Never paraphrase the span.
- "positives" = specific things the presenter demonstrably did well, each grounded in a quote.
- "negatives" = specific, actionable weaknesses, each grounded in a quote (or explicitly noting \
absence of expected content, e.g. "no closing summary was given").
- Provide at least 1 and at most 4 items each for positives and negatives.

If the organizer supplied ADDITIONAL EVALUATION CRITERIA, treat them as extra required criteria \
you must weigh heavily within the 6 dimensions above — do not invent new dimensions for them.

Return ONLY JSON with this exact structure (all 6 dimensions must appear, in this order):
{{
  "dimensions": [
    {{"dimension": "Introduction & Opening", "raw_sub_score": 1.5, "status": "SCORED",
      "evidence_spans": [{{"span": "...", "reason": "..."}}]}},
    ...
  ],
  "positives": [{{"text": "...", "span": "..."}}],
  "negatives": [{{"text": "...", "span": "..."}}]
}}"""


def _build_user_prompt(
    topic: str,
    team_name: str,
    members: list[str],
    custom_instructions: str | None,
    transcript_full: str,
    word_count: int,
    wpm: float,
    duration_seconds: int,
) -> str:
    no_transcript_msg = "[No transcript captured — score every AI dimension in the 0.0-1.5 band.]"
    transcript_section = transcript_full if transcript_full else no_transcript_msg
    custom_section = (
        f"\nADDITIONAL EVALUATION CRITERIA FROM ORGANIZER (weigh heavily):\n{custom_instructions}\n"
        if custom_instructions and custom_instructions.strip()
        else ""
    )
    return f"""TOPIC: {topic}
TEAM: {team_name}
MEMBERS: {", ".join(members) if members else "(not specified)"}
{custom_section}
DURATION: {duration_seconds}s
WORD COUNT: {word_count} ({wpm:.0f} WPM)

FULL TRANSCRIPT:
{transcript_section}

Evaluate strictly against the rubric and penalty rules. Return assessment as JSON."""


async def _call_llm(system: str, user: str) -> dict[str, Any]:
    """Call OpenAI, return parsed JSON + provenance."""
    try:
        from openai import AsyncOpenAI

        prompt_text = f"{system}\n{user}"
        prompt_hash = hashlib.sha256(prompt_text.encode()).hexdigest()

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model=settings.llm_primary_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=0,
            seed=42,
        )
        content = response.choices[0].message.content or "{}"
        return {
            "output": json.loads(content),
            "model_name": settings.llm_primary_model,
            "model_version": settings.llm_primary_model_version,
            "prompt_hash": prompt_hash,
        }
    except Exception as e:
        logger.error("llm_call_failed", error=str(e))
        raise RuntimeError(f"LLM call failed: {e}") from e


def _match_span_to_transcript(span: str, transcript_full: str) -> str:
    return span or transcript_full[:120]


def _save_score(score: dict[str, Any]) -> None:
    _scores_cache[score["presentation_id"]] = score
    try:
        sb = get_supabase()
        sb.table("presentation_scores").upsert(score).execute()
    except Exception as err:
        logger.debug("supabase_score_upsert_fallback", error=str(err))


def _fetch_score(presentation_id: str) -> dict[str, Any] | None:
    try:
        sb = get_supabase()
        res = (
            sb.table("presentation_scores")
            .select("*")
            .eq("presentation_id", presentation_id)
            .execute()
        )
        if res.data and len(res.data) > 0 and isinstance(res.data[0], dict):
            return dict(res.data[0])
    except Exception as err:
        logger.debug("supabase_get_score_fallback", error=str(err))
    return _scores_cache.get(presentation_id)


@router.post("/presentations/{presentation_id}/score", response_model=ScoreResponse)
async def score_presentation(presentation_id: str, req: ScoreRequest) -> ScoreResponse:
    """Score a presentation: 6 AI-scored dimensions + 1 human-scored dimension."""
    pres = _fetch_presentation(presentation_id)
    if not pres:
        raise HTTPException(status_code=404, detail=f"Presentation '{presentation_id}' not found")

    transcript_full = str(pres.get("transcript_text") or "").strip()
    word_count = len(transcript_full.split()) if transcript_full else 0
    duration_seconds = int(pres.get("duration_seconds") or 0)
    actual_minutes = max(0.1, duration_seconds / 60.0)
    wpm = round(word_count / actual_minutes, 1) if duration_seconds else 0.0

    try:
        llm_result = await _call_llm(
            system=_build_system_prompt(),
            user=_build_user_prompt(
                topic=str(pres.get("topic") or ""),
                team_name=str(pres.get("team_name") or ""),
                members=list(pres.get("members") or []),
                custom_instructions=pres.get("custom_instructions"),
                transcript_full=transcript_full,
                word_count=word_count,
                wpm=wpm,
                duration_seconds=duration_seconds,
            ),
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    llm_output: dict[str, Any] = llm_result["output"]
    llm_dims: list[dict[str, Any]] = llm_output.get("dimensions", [])

    is_very_short = word_count < 25 or (duration_seconds > 0 and duration_seconds < 15)
    is_short = word_count < 40 or (duration_seconds > 0 and duration_seconds < 25)

    dimension_inputs: list[DimensionInput] = []
    dimension_evidence: dict[str, list[dict[str, Any]]] = {}
    # Display-only status shown to the user (e.g. "no evidence found for this
    # dimension"). It is intentionally NOT what's fed to compute_score below —
    # see note there.
    display_status: dict[str, DimensionStatus] = {}

    for dim_name, weight in _AI_DIMENSION_WEIGHTS.items():
        llm_dim = next((d for d in llm_dims if d.get("dimension") == dim_name), None)

        if llm_dim:
            status_str = llm_dim.get("status", "SCORED")
            try:
                display_status[dim_name] = DimensionStatus(status_str)
            except ValueError:
                display_status[dim_name] = DimensionStatus.SCORED
            raw_value = llm_dim.get("raw_sub_score")
            raw = max(0.0, min(5.0, float(raw_value))) if raw_value is not None else 0.0
            dimension_evidence[dim_name] = llm_dim.get("evidence_spans", []) or []
        else:
            display_status[dim_name] = DimensionStatus.INSUFFICIENT_EVIDENCE
            raw = 0.0
            dimension_evidence[dim_name] = []

        if is_very_short:
            raw = min(raw, 1.5)
        elif is_short:
            raw = min(raw, 2.5)

        dimension_inputs.append(
            DimensionInput(
                dimension=dim_name,
                weight=weight,
                raw_sub_score=raw,
                # Always SCORED for the six AI dimensions, regardless of what
                # the LLM reported: this rubric's 7 dimensions are always
                # applicable, and the engine EXCLUDES + redistributes the
                # weight of any non-"active" dimension to the ones that
                # remain. If a thin/empty transcript got several dimensions
                # marked INSUFFICIENT_EVIDENCE, their weight would collapse
                # onto whatever's left — including the always-active human
                # dimension — inflating the total instead of penalizing it.
                # Low/zero evidence must show up as a LOW raw_sub_score that
                # still counts, never as a dimension that vanishes.
                status=DimensionStatus.SCORED,
                model_used=llm_result.get("model_name"),
            )
        )

    # Human-provided dimension — mapped directly, never guessed by the LLM.
    dimension_inputs.append(
        DimensionInput(
            dimension=_HUMAN_DIMENSION,
            weight=_HUMAN_DIMENSION_WEIGHT,
            raw_sub_score=float(req.human_physical_score),
            status=DimensionStatus.SCORED,
            model_used="human",
        )
    )

    scoring = compute_score(dimension_inputs)

    dimension_scores: list[DimensionScoreOut] = []
    for dr in scoring.dimension_results:
        if dr.dimension == _HUMAN_DIMENSION:
            dimension_scores.append(
                DimensionScoreOut(
                    dimension=dr.dimension,
                    weight=dr.weight,
                    raw_sub_score=dr.raw_sub_score,
                    scaled_score=round(dr.scaled_score, 2) if dr.scaled_score is not None else None,
                    status=dr.status.value,
                    source="HUMAN",
                    evidence=[
                        EvidenceItem(
                            span=req.human_note or "Rated live by human evaluator",
                            reason=(
                                "Physical delivery rated directly by a human observer "
                                "(1-5), not inferred from the transcript."
                            ),
                        )
                    ],
                )
            )
            continue

        raw_evidence = dimension_evidence.get(dr.dimension, [])
        evidence_list: list[EvidenceItem] = []
        for ev in raw_evidence:
            if isinstance(ev, dict):
                span_text = str(ev.get("span", ""))
                reason_text = str(ev.get("reason", "Evidence from transcript"))
            else:
                span_text = str(ev)
                reason_text = "Evidence from transcript"
            evidence_list.append(
                EvidenceItem(
                    span=_match_span_to_transcript(span_text, transcript_full),
                    reason=reason_text,
                )
            )

        dimension_scores.append(
            DimensionScoreOut(
                dimension=dr.dimension,
                weight=dr.weight,
                raw_sub_score=dr.raw_sub_score,
                scaled_score=round(dr.scaled_score, 2) if dr.scaled_score is not None else None,
                # Display status only — see the note above on why compute_score
                # always sees DimensionStatus.SCORED for these.
                status=display_status.get(dr.dimension, DimensionStatus.SCORED).value,
                source="AI",
                evidence=evidence_list,
            )
        )

    def _build_feedback(items: list[Any]) -> list[FeedbackItem]:
        results: list[FeedbackItem] = []
        for item in items:
            if isinstance(item, dict):
                span_text = str(item.get("span", ""))
                text_content = str(item.get("text", ""))
            else:
                span_text = str(item)
                text_content = str(item)
            if not text_content:
                continue
            results.append(
                FeedbackItem(
                    text=text_content,
                    span=_match_span_to_transcript(span_text, transcript_full),
                )
            )
        return results

    positives = _build_feedback(llm_output.get("positives", []))
    negatives = _build_feedback(llm_output.get("negatives", []))

    score_id = f"score-{uuid.uuid4().hex[:12]}"
    now = datetime.now(UTC).isoformat()

    score_record = {
        "id": score_id,
        "presentation_id": presentation_id,
        "total_score": scoring.total_score,
        "dimension_scores": [ds.model_dump() for ds in dimension_scores],
        "positives": [p.model_dump() for p in positives],
        "negatives": [n.model_dump() for n in negatives],
        "human_physical_score": req.human_physical_score,
        "human_note": req.human_note,
        "model_name": llm_result.get("model_name", settings.llm_primary_model),
        "model_version": llm_result.get("model_version", settings.llm_primary_model_version),
        "prompt_hash": llm_result.get("prompt_hash", ""),
        "created_at": now,
    }
    _save_score(score_record)

    # Mark the presentation as scored.
    pres["status"] = "SCORED"
    pres["updated_at"] = now
    _save_presentation(pres)

    logger.info(
        "presentation_scored",
        presentation_id=presentation_id,
        total_score=scoring.total_score,
        human_physical_score=req.human_physical_score,
    )

    return ScoreResponse(**score_record)


@router.get("/presentations/{presentation_id}/score", response_model=ScoreResponse)
async def get_score(presentation_id: str) -> ScoreResponse:
    """Fetch an existing score for a presentation."""
    score = _fetch_score(presentation_id)
    if not score:
        raise HTTPException(
            status_code=404, detail=f"No score found for presentation '{presentation_id}'"
        )
    return ScoreResponse(**score)
