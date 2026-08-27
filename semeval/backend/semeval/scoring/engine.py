"""
Deterministic scoring engine (Rule R1).

The LLM NEVER computes the final score.
Agents emit per-dimension sub-scores (0-5) and evidence.
This module computes the weighted total using pure arithmetic.

Formula:
    effective_weight_i = weight_i * (100 / sum_of_active_weights)
    scaled_score_i     = (raw_sub_score_i / 5.0) * effective_weight_i
    total_score        = round(sum(scaled_score_i for scored dimensions))

Skipped/insufficient-evidence dimensions have their weight proportionally
redistributed to the remaining scored dimensions.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum


class DimensionStatus(StrEnum):
    SCORED = "SCORED"
    SKIPPED = "SKIPPED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"


@dataclass(frozen=True)
class DimensionInput:
    """Input to the scoring engine for one rubric dimension."""

    dimension: str
    weight: float          # 0-100; all active weights must sum to 100
    raw_sub_score: float   # 0-5 from the agent; None if not scored
    status: DimensionStatus
    model_used: str | None = None

    def is_active(self) -> bool:
        """An active dimension contributes to the final score."""
        return self.status in (DimensionStatus.SCORED, DimensionStatus.LOW_CONFIDENCE)


@dataclass(frozen=True)
class DimensionResult:
    """Output of the scoring engine for one dimension."""

    dimension: str
    weight: float
    effective_weight: float   # after redistribution
    raw_sub_score: float | None
    scaled_score: float | None
    status: DimensionStatus
    model_used: str | None


@dataclass(frozen=True)
class ScoringResult:
    """Final output of the deterministic scoring engine."""

    total_score: int            # 0-100, rounded
    dimension_results: list[DimensionResult]
    # Weights that were redistributed (diagnostic)
    redistributed_weight: float
    active_dimension_count: int
    skipped_dimension_count: int


class ScoringError(Exception):
    """Raised when scoring inputs violate invariants."""


def compute_score(dimensions: Sequence[DimensionInput]) -> ScoringResult:
    """
    Deterministically compute the final score from dimension inputs.

    Rules:
    1. Verify declared weights sum to 100 (±0.01 float tolerance).
    2. Separate dimensions into active vs. skipped.
    3. Redistribute skipped weights proportionally to active dimensions.
    4. Compute scaled_score = (raw_sub_score / 5.0) * effective_weight.
    5. total_score = round(sum(scaled_scores)).

    Raises ScoringError on invalid inputs (not caught here — caller handles).
    """
    if not dimensions:
        raise ScoringError("No dimensions provided to scoring engine.")

    # ── Validate weight sum ───────────────────────────────────────────────────
    declared_total = sum(d.weight for d in dimensions)
    if abs(declared_total - 100.0) > 0.01:
        raise ScoringError(
            f"Dimension weights sum to {declared_total:.4f}, expected 100.0. "
            "Fix the rubric before scoring."
        )

    # ── Validate sub-scores are in range for active dimensions ───────────────
    for d in dimensions:
        if d.is_active():
            if not (0.0 <= d.raw_sub_score <= 5.0):
                raise ScoringError(
                    f"Dimension '{d.dimension}' has raw_sub_score={d.raw_sub_score} "
                    "outside [0, 5]."
                )

    # ── Split active / skipped ────────────────────────────────────────────────
    active = [d for d in dimensions if d.is_active()]
    skipped = [d for d in dimensions if not d.is_active()]

    redistributed_weight = sum(d.weight for d in skipped)
    active_weight_sum = sum(d.weight for d in active)

    if not active:
        # All dimensions were skipped — cannot score
        empty_results = [
            DimensionResult(
                dimension=d.dimension,
                weight=d.weight,
                effective_weight=0.0,
                raw_sub_score=None,
                scaled_score=None,
                status=d.status,
                model_used=d.model_used,
            )
            for d in dimensions
        ]
        return ScoringResult(
            total_score=0,
            dimension_results=empty_results,
            redistributed_weight=redistributed_weight,
            active_dimension_count=0,
            skipped_dimension_count=len(skipped),
        )

    # ── Compute effective weights (proportional redistribution) ───────────────
    # Each active dimension's effective weight = declared_weight * (100 / active_weight_sum)
    results: list[DimensionResult] = []
    scaled_scores: list[float] = []

    for d in dimensions:
        if d.is_active():
            effective_weight = d.weight * (100.0 / active_weight_sum)
            scaled = (d.raw_sub_score / 5.0) * effective_weight
            scaled_scores.append(scaled)
            results.append(
                DimensionResult(
                    dimension=d.dimension,
                    weight=d.weight,
                    effective_weight=effective_weight,
                    raw_sub_score=d.raw_sub_score,
                    scaled_score=scaled,
                    status=d.status,
                    model_used=d.model_used,
                )
            )
        else:
            results.append(
                DimensionResult(
                    dimension=d.dimension,
                    weight=d.weight,
                    effective_weight=0.0,
                    raw_sub_score=None,
                    scaled_score=None,
                    status=d.status,
                    model_used=d.model_used,
                )
            )

    total_score = round(sum(scaled_scores))
    # Clamp to [0, 100] as a safety net (should never be needed with valid inputs)
    total_score = max(0, min(100, total_score))

    return ScoringResult(
        total_score=total_score,
        dimension_results=results,
        redistributed_weight=redistributed_weight,
        active_dimension_count=len(active),
        skipped_dimension_count=len(skipped),
    )
