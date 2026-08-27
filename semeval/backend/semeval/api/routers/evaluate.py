"""
Evaluation router — POST /api/v1/evaluate

Accepts full transcript text + session metadata.
Calls LLM (OpenAI gpt-4o) with a structured rubric prompt.
Runs deterministic scoring engine (Rule R1).
Returns evidence-backed JSON evaluation.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from semeval.config import get_settings
from semeval.scoring.engine import DimensionInput, DimensionStatus, compute_score

logger = structlog.get_logger(__name__)
settings = get_settings()

router = APIRouter(tags=["evaluate"])


# ── Request / Response models ─────────────────────────────────────────────────


class TranscriptSegment(BaseModel):
    id: str
    speaker: str
    text: str
    start_ms: int
    end_ms: int
    confidence: float = 0.95


class EvaluateRequest(BaseModel):
    session_id: str
    recording_id: str
    presenter_name: str
    topic: str
    coverage_points: list[str] = Field(default_factory=list)
    transcript_segments: list[TranscriptSegment] = Field(default_factory=list)
    elapsed_seconds: int = Field(ge=0)
    target_duration_seconds: int = Field(ge=30, le=7200)


class EvidenceSpan(BaseModel):
    id: str
    transcript_span: str
    start_ms: int
    end_ms: int
    reason: str
    verified: bool = True


class DimensionScore(BaseModel):
    dimension: str
    weight: float
    raw_sub_score: float | None
    scaled_score: float | None
    status: str
    evidence: list[EvidenceSpan]


class StrengthImprovement(BaseModel):
    text: str
    start_ms: int
    end_ms: int
    span: str


class EvaluateResponse(BaseModel):
    id: str
    recording_id: str
    presenter_name: str
    total_score: int
    audio_quality: str
    model_name: str
    model_version: str
    prompt_hash: str
    temperature: float
    seed: int
    dimension_scores: list[DimensionScore]
    strengths: list[StrengthImprovement]
    improvements: list[StrengthImprovement]
    transcript_word_count: int
    calculated_wpm: float
    duration_ratio: float


# ── LLM Rubric Evaluation ─────────────────────────────────────────────────────

_RUBRIC_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["dimensions", "strengths", "improvements"],
    "properties": {
        "dimensions": {
            "type": "array",
            "minItems": 7,
            "maxItems": 7,
            "items": {
                "type": "object",
                "required": ["dimension", "raw_sub_score", "status", "evidence_spans"],
                "properties": {
                    "dimension": {"type": "string"},
                    "raw_sub_score": {"type": "number", "minimum": 0, "maximum": 5},
                    "status": {
                        "type": "string",
                        "enum": [
                            "SCORED",
                            "SKIPPED",
                            "INSUFFICIENT_EVIDENCE",
                            "LOW_CONFIDENCE",
                        ],
                    },
                    "evidence_spans": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["span", "reason"],
                            "properties": {
                                "span": {"type": "string"},
                                "reason": {"type": "string"},
                            },
                        },
                    },
                },
            },
        },
        "strengths": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["text", "span"],
                "properties": {
                    "text": {"type": "string"},
                    "span": {"type": "string"},
                },
            },
        },
        "improvements": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["text", "span"],
                "properties": {
                    "text": {"type": "string"},
                    "span": {"type": "string"},
                },
            },
        },
    },
    "additionalProperties": False,
}

_DIMENSION_WEIGHTS: dict[str, float] = {
    "Content and topic coverage": 30.0,
    "Structure and clarity": 15.0,
    "Depth and technical accuracy": 15.0,
    "Delivery and pace": 15.0,
    "Engagement and audience contact": 10.0,
    "Q&A handling": 10.0,
    "Time management": 5.0,
}


async def _call_llm(system: str, user: str) -> dict[str, Any]:
    """Call OpenAI gpt-4o, return parsed JSON + provenance."""
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


def _build_system_prompt() -> str:
    return (
        "You are a strict, highly critical academic seminar presentation evaluator.\n"
        "Be rigorous, realistic, and do NOT inflate scores.\n"
        "\n"
        "RUBRIC DIMENSIONS (use EXACTLY these names):\n"
        "1. Content and topic coverage\n"
        "2. Structure and clarity\n"
        "3. Depth and technical accuracy\n"
        "4. Delivery and pace\n"
        "5. Engagement and audience contact\n"
        "6. Q&A handling\n"
        "7. Time management\n"
        "\n"
        "STRICT GRADING SCALE (0.0 to 5.0):\n"
        "- 0.0 - 1.5: POOR / INCOMPLETE — Short speech (<40 words), missing depth, or 1-line talk.\n"  # noqa: E501
        "- 2.0 - 2.5: BELOW AVERAGE — Basic mention without depth or disorganized.\n"
        "- 3.0 - 3.5: SATISFACTORY — Meets baseline expectations ONLY.\n"
        "- 4.0 - 4.5: VERY GOOD — Deep technical insights, highly clear.\n"
        "- 5.0: EXCEPTIONAL — Flawless, master-class presentation.\n"
        "\n"
        "STRICT PENALTY RULES:\n"
        "- SHORT PRESENTATIONS (<40 words or 1-2 lines spoken): PENALIZE HEAVILY (raw_sub_score 0.5-1.5).\n"  # noqa: E501
        "- Do NOT give 3.0, 4.0, or 5.0 to short 1-line presentations!\n"
        "- If a dimension has no explicit evidence, set status to INSUFFICIENT_EVIDENCE.\n"
        "- All evidence_spans MUST be verbatim quoted text from the transcript.\n"
        "\n"
        "YOU MUST RETURN JSON WITH THIS EXACT STRUCTURE:\n"
        "{\n"
        '  "dimensions": [\n'
        '    {"dimension": "Content and topic coverage", "raw_sub_score": 1.5, "status": "SCORED", "evidence_spans": []},\n'  # noqa: E501
        '    {"dimension": "Structure and clarity", "raw_sub_score": 1.5, "status": "SCORED", "evidence_spans": []},\n'  # noqa: E501
        '    {"dimension": "Depth and technical accuracy", "raw_sub_score": 1.0, "status": "SCORED", "evidence_spans": []},\n'  # noqa: E501
        '    {"dimension": "Delivery and pace", "raw_sub_score": 1.5, "status": "SCORED", "evidence_spans": []},\n'  # noqa: E501
        '    {"dimension": "Engagement and audience contact", "raw_sub_score": 1.0, "status": "SCORED", "evidence_spans": []},\n'  # noqa: E501
        '    {"dimension": "Q&A handling", "raw_sub_score": 1.0, "status": "SCORED", "evidence_spans": []},\n'  # noqa: E501
        '    {"dimension": "Time management", "raw_sub_score": 1.0, "status": "SCORED", "evidence_spans": []}\n'  # noqa: E501
        '  ],\n'
        '  "strengths": [{ "text": "Clear opening phrase", "span": "quote" }],\n'
        '  "improvements": [{ "text": "Presentation was incomplete (only 1 line spoken). Need full 5-10 minute presentation.", "span": "quote" }]\n'  # noqa: E501
        "}\n"
    )


def _build_user_prompt(
    req: EvaluateRequest,
    transcript_full: str,
    word_count: int,
    wpm: float,
) -> str:
    no_points_msg = "- [No specific points provided — auto-evaluate from speech content]"
    coverage_text = (
        "\n".join(f"- {p}" for p in req.coverage_points)
        if req.coverage_points
        else no_points_msg
    )
    no_transcript_msg = "[No transcript captured — score based on available session metadata]"
    transcript_section = transcript_full if transcript_full else no_transcript_msg
    summary_line = "Evaluate this presentation strictly against the rubric and rules. Return assessment as JSON."  # noqa: E501
    return f"""TOPIC: {req.topic}

REQUIRED COVERAGE POINTS:
{coverage_text}

PRESENTER: {req.presenter_name}
ELAPSED TIME: {req.elapsed_seconds}s (target: {req.target_duration_seconds}s)
WORD COUNT: {word_count} ({wpm:.0f} WPM)

FULL TRANSCRIPT:
{transcript_section}

{summary_line}"""


@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate_presentation(req: EvaluateRequest) -> EvaluateResponse:
    """
    Main evaluation endpoint.
    Sends full transcript to LLM, runs deterministic scoring, returns evidence-backed report.
    """
    # Bound transcript segments strictly up to the stop recording cutoff timestamp
    cutoff_ms = req.elapsed_seconds * 1000 if req.elapsed_seconds > 0 else 7200000
    bounded_segments = [
        seg for seg in req.transcript_segments if seg.start_ms <= cutoff_ms
    ]

    # Build full transcript text
    transcript_full = "\n".join(
        f"[{seg.start_ms // 1000}s] {seg.speaker}: {seg.text}"
        for seg in bounded_segments
    )
    word_count = len(transcript_full.split()) if transcript_full else 0
    actual_minutes = max(0.1, req.elapsed_seconds / 60.0)
    wpm = round(word_count / actual_minutes, 1)
    duration_ratio = req.elapsed_seconds / max(1, req.target_duration_seconds)

    # Call LLM
    try:
        llm_result = await _call_llm(
            system=_build_system_prompt(),
            user=_build_user_prompt(req, transcript_full, word_count, wpm),
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    llm_output: dict[str, Any] = llm_result["output"]

    # Build dimension inputs for deterministic scoring engine
    dimension_inputs: list[DimensionInput] = []
    ordered_dimensions = list(_DIMENSION_WEIGHTS.keys())

    llm_dims: list[dict[str, Any]] = llm_output.get("dimensions", [])
    is_short_transcript = word_count < 40 or req.elapsed_seconds < 25

    for dim_name in ordered_dimensions:
        weight = _DIMENSION_WEIGHTS[dim_name]
        llm_dim = next((d for d in llm_dims if d.get("dimension") == dim_name), None)

        if llm_dim:
            status_str = llm_dim.get("status", "SCORED")
            try:
                status = DimensionStatus(status_str)
            except ValueError:
                status = DimensionStatus.SCORED

            raw = float(llm_dim.get("raw_sub_score", 3.0))
            raw = max(0.0, min(5.0, raw))
            # Strict Deterministic Cap for short/incomplete 1-line presentations
            if is_short_transcript and dim_name != "Time management":
                raw = min(raw, 1.5)
        else:
            status = DimensionStatus.INSUFFICIENT_EVIDENCE
            raw = 1.0 if is_short_transcript else 0.0

        if is_short_transcript and dim_name == "Time management":
            raw = min(raw, 1.0)

        dimension_inputs.append(
            DimensionInput(
                dimension=dim_name,
                weight=weight,
                raw_sub_score=raw,
                status=status,
                model_used=llm_result.get("model_name"),
            )
        )

    # Run deterministic scoring engine (Rule R1 — LLM never calculates total)
    scoring = compute_score(dimension_inputs)

    # Build dimension scores with evidence
    dimension_scores: list[DimensionScore] = []
    for i, dr in enumerate(scoring.dimension_results):
        llm_dim = next((d for d in llm_dims if d.get("dimension") == dr.dimension), None)
        raw_evidence = llm_dim.get("evidence_spans", []) if llm_dim else []

        # Match evidence spans back to transcript segments for timestamps
        evidence_list: list[EvidenceSpan] = []
        for j, ev in enumerate(raw_evidence):
            if isinstance(ev, dict):
                span_text = str(ev.get("span", ""))
                reason_text = str(ev.get("reason", "Verbatim evidence from speech"))
            else:
                span_text = str(ev)
                reason_text = "Verbatim evidence from speech"

            matched_seg = next(
                (
                    s
                    for s in req.transcript_segments
                    if span_text and span_text.lower() in s.text.lower()
                ),
                None,
            )
            evidence_list.append(
                EvidenceSpan(
                    id=f"ev-{i}-{j}",
                    transcript_span=span_text or transcript_full[:100],
                    start_ms=matched_seg.start_ms if matched_seg else 0,
                    end_ms=matched_seg.end_ms if matched_seg else 2000,
                    reason=reason_text,
                )
            )

        dimension_scores.append(
            DimensionScore(
                dimension=dr.dimension,
                weight=dr.weight,
                raw_sub_score=dr.raw_sub_score,
                scaled_score=round(dr.scaled_score, 2) if dr.scaled_score is not None else None,
                status=dr.status.value,
                evidence=evidence_list,
            )
        )

    # Build strengths and improvements with timestamps
    def _build_evidence_items(
        items: list[Any], label: str
    ) -> list[StrengthImprovement]:
        results = []
        for k, item in enumerate(items):
            if isinstance(item, dict):
                span_text = str(item.get("span", ""))
                text_content = str(item.get("text", f"{label} observation {k+1}"))
            else:
                span_text = str(item)
                text_content = str(item)

            matched_seg = next(
                (
                    s
                    for s in req.transcript_segments
                    if span_text and span_text.lower() in s.text.lower()
                ),
                None,
            )
            results.append(
                StrengthImprovement(
                    text=text_content,
                    start_ms=matched_seg.start_ms if matched_seg else k * 5000,
                    end_ms=matched_seg.end_ms if matched_seg else (k + 1) * 5000,
                    span=span_text or transcript_full[:120],
                )
            )
        return results

    import uuid
    from datetime import UTC, datetime

    eval_id = f"eval-{uuid.uuid4().hex[:12]}"
    strengths_items = _build_evidence_items(llm_output.get("strengths", []), "Strength")
    improvements_items = _build_evidence_items(
        llm_output.get("improvements", []), "Improvement"
    )

    response_data = EvaluateResponse(
        id=eval_id,
        recording_id=req.recording_id,
        presenter_name=req.presenter_name,
        total_score=scoring.total_score,
        audio_quality="PASS",
        model_name=llm_result.get("model_name", settings.llm_primary_model),
        model_version=llm_result.get("model_version", settings.llm_primary_model_version),
        prompt_hash=llm_result.get("prompt_hash", ""),
        temperature=0,
        seed=42,
        dimension_scores=dimension_scores,
        strengths=strengths_items,
        improvements=improvements_items,
        transcript_word_count=word_count,
        calculated_wpm=wpm,
        duration_ratio=round(duration_ratio, 2),
    )

    # ── Log & Print Structured LLM Output ────────────────────────────────────
    logger.info(
        "llm_structured_evaluation_response",
        eval_id=eval_id,
        presenter=req.presenter_name,
        total_score=scoring.total_score,
        dimensions_count=len(dimension_scores),
        strengths_count=len(strengths_items),
        improvements_count=len(improvements_items),
    )

    # ── Save Evaluation Record to Supabase DB ────────────────────────────────
    try:
        from semeval.db.supabase_client import get_supabase

        sb = get_supabase()
        db_record: dict[str, Any] = {
            "id": eval_id,
            "session_id": req.session_id,
            "recording_id": req.recording_id,
            "presenter_name": req.presenter_name,
            "total_score": scoring.total_score,
            "audio_quality": "PASS",
            "model_name": response_data.model_name,
            "model_version": response_data.model_version,
            "prompt_hash": response_data.prompt_hash,
            "temperature": 0,
            "seed": 42,
            "dimension_scores": [ds.model_dump() for ds in dimension_scores],
            "strengths": [s.model_dump() for s in strengths_items],
            "improvements": [imp.model_dump() for imp in improvements_items],
            "created_at": datetime.now(UTC).isoformat(),
        }
        sb.table("evaluation_records").upsert(db_record).execute()
        logger.info("evaluation_saved_to_supabase", eval_id=eval_id)
    except Exception as err:
        logger.warning("supabase_evaluation_save_failed", error=str(err))

    return response_data


@router.get("/evaluations/{eval_id}", response_model=EvaluateResponse)
async def get_evaluation(eval_id: str) -> EvaluateResponse:
    """Get evaluation detail from Supabase DB."""
    try:
        from semeval.db.supabase_client import get_supabase

        sb = get_supabase()
        res = sb.table("evaluation_records").select("*").eq("id", eval_id).execute()
        if res.data and len(res.data) > 0 and isinstance(res.data[0], dict):
            row = res.data[0]
            return EvaluateResponse(
                id=row["id"],
                recording_id=row["recording_id"],
                presenter_name=row["presenter_name"],
                total_score=row["total_score"],
                audio_quality=row["audio_quality"],
                model_name=row["model_name"],
                model_version=row["model_version"],
                prompt_hash=row["prompt_hash"],
                temperature=row["temperature"],
                seed=row["seed"],
                dimension_scores=[DimensionScore(**ds) for ds in row["dimension_scores"]],
                strengths=[StrengthImprovement(**s) for s in row["strengths"]],
                improvements=[StrengthImprovement(**imp) for imp in row["improvements"]],
                transcript_word_count=0,
                calculated_wpm=0.0,
                duration_ratio=1.0,
            )
    except Exception as err:
        logger.warning("supabase_get_evaluation_failed", error=str(err))

    raise HTTPException(status_code=404, detail=f"Evaluation '{eval_id}' not found")
