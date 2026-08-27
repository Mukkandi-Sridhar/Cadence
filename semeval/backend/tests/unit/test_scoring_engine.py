"""
Unit tests for the deterministic scoring engine (R1).

These tests cover:
- Perfect score (all 5s, no redistribution)
- Zero score (all 0s)
- Weight redistribution when dimensions are skipped
- All dimensions skipped
- Rounding behaviour
- Weight validation (not summing to 100)
- Sub-score range validation
- Default rubric weights from the spec
- Known exact answers to catch floating-point regressions
"""

from __future__ import annotations

import pytest

from semeval.scoring.engine import (
    DimensionInput,
    DimensionStatus,
    ScoringError,
    compute_score,
)

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_dim(
    name: str,
    weight: float,
    sub_score: float,
    status: DimensionStatus = DimensionStatus.SCORED,
) -> DimensionInput:
    return DimensionInput(
        dimension=name,
        weight=weight,
        raw_sub_score=sub_score,
        status=status,
    )


def _default_rubric_full_score(sub_score: float) -> list[DimensionInput]:
    """
    Default rubric from the spec:
      Content and topic coverage        30
      Structure and clarity             15
      Depth and technical accuracy      15
      Delivery and pace                 15
      Engagement and audience contact   10
      Q&A handling                      10
      Time management                    5
    Total: 100
    """
    weights = [
        ("Content and topic coverage", 30),
        ("Structure and clarity", 15),
        ("Depth and technical accuracy", 15),
        ("Delivery and pace", 15),
        ("Engagement and audience contact", 10),
        ("Q&A handling", 10),
        ("Time management", 5),
    ]
    return [_make_dim(name, w, sub_score) for name, w in weights]


# ─────────────────────────────────────────────────────────────────────────────
# Basic correctness
# ─────────────────────────────────────────────────────────────────────────────


class TestScoringBasics:
    def test_perfect_score_all_5s(self) -> None:
        """All sub-scores = 5 → total = 100."""
        dims = _default_rubric_full_score(5.0)
        result = compute_score(dims)
        assert result.total_score == 100
        assert result.skipped_dimension_count == 0
        assert result.active_dimension_count == 7

    def test_zero_score_all_0s(self) -> None:
        """All sub-scores = 0 → total = 0."""
        dims = _default_rubric_full_score(0.0)
        result = compute_score(dims)
        assert result.total_score == 0

    def test_uniform_mid_score(self) -> None:
        """All sub-scores = 2.5 → total = 50 (exactly half of 100)."""
        dims = _default_rubric_full_score(2.5)
        result = compute_score(dims)
        assert result.total_score == 50

    def test_known_exact_answer(self) -> None:
        """
        Worked example from RUBRIC.md:
          Content=4, Structure=3, Depth=5, Delivery=2, Engagement=3, QnA=4, Time=5
          Scaled = (4/5)*30 + (3/5)*15 + (5/5)*15 + (2/5)*15 + (3/5)*10 + (4/5)*10 + (5/5)*5
                 = 24 + 9 + 15 + 6 + 6 + 8 + 5 = 73
        """
        dims = [
            _make_dim("Content", 30, 4.0),
            _make_dim("Structure", 15, 3.0),
            _make_dim("Depth", 15, 5.0),
            _make_dim("Delivery", 15, 2.0),
            _make_dim("Engagement", 10, 3.0),
            _make_dim("QnA", 10, 4.0),
            _make_dim("Time", 5, 5.0),
        ]
        result = compute_score(dims)
        assert result.total_score == 73

    def test_result_is_integer_in_range(self) -> None:
        """Total score is always in [0, 100]."""
        for sub in [0.0, 1.0, 2.0, 3.0, 4.0, 5.0]:
            result = compute_score(_default_rubric_full_score(sub))
            assert isinstance(result.total_score, int)
            assert 0 <= result.total_score <= 100


# ─────────────────────────────────────────────────────────────────────────────
# Weight redistribution
# ─────────────────────────────────────────────────────────────────────────────


class TestWeightRedistribution:
    def test_one_dimension_skipped(self) -> None:
        """
        Q&A skipped (weight=10). Remaining 90 points redistributed.
        All other sub-scores = 5 → total should still be 100.
        """
        dims = [
            _make_dim("Content", 30, 5.0),
            _make_dim("Structure", 15, 5.0),
            _make_dim("Depth", 15, 5.0),
            _make_dim("Delivery", 15, 5.0),
            _make_dim("Engagement", 10, 5.0),
            _make_dim("QnA", 10, 0.0, DimensionStatus.SKIPPED),
            _make_dim("Time", 5, 5.0),
        ]
        result = compute_score(dims)
        assert result.total_score == 100
        assert result.skipped_dimension_count == 1
        assert result.active_dimension_count == 6
        assert abs(result.redistributed_weight - 10.0) < 0.001

    def test_two_dimensions_skipped_scores_still_sum_correctly(self) -> None:
        """
        QnA + Time skipped (weights 10+5=15). All remaining sub-scores = 5 → total = 100.
        """
        dims = [
            _make_dim("Content", 30, 5.0),
            _make_dim("Structure", 15, 5.0),
            _make_dim("Depth", 15, 5.0),
            _make_dim("Delivery", 15, 5.0),
            _make_dim("Engagement", 10, 5.0),
            _make_dim("QnA", 10, 0.0, DimensionStatus.SKIPPED),
            _make_dim("Time", 5, 0.0, DimensionStatus.SKIPPED),
        ]
        result = compute_score(dims)
        assert result.total_score == 100
        assert result.redistributed_weight == pytest.approx(15.0, abs=0.001)

    def test_skipped_dimension_excluded_from_effective_weight(self) -> None:
        """Skipped dimension must have effective_weight == 0."""
        dims = [
            _make_dim("Content", 30, 5.0),
            _make_dim("Structure", 15, 5.0),
            _make_dim("Depth", 15, 5.0),
            _make_dim("Delivery", 15, 5.0),
            _make_dim("Engagement", 10, 5.0),
            _make_dim("QnA", 10, 0.0, DimensionStatus.SKIPPED),
            _make_dim("Time", 5, 5.0),
        ]
        result = compute_score(dims)
        qna_result = next(r for r in result.dimension_results if r.dimension == "QnA")
        assert qna_result.effective_weight == 0.0
        assert qna_result.scaled_score is None

    def test_all_dimensions_skipped_returns_zero(self) -> None:
        """If every dimension is skipped, total = 0 and active_count = 0."""
        dims = [
            _make_dim(f"dim_{i}", 100 / 7, 3.0, DimensionStatus.SKIPPED)
            for i in range(7)
        ]
        # Adjust last weight to make sum exactly 100
        adjusted = list(dims)
        adjusted[-1] = DimensionInput(
            dimension="dim_6",
            weight=100 - sum(d.weight for d in adjusted[:-1]),
            raw_sub_score=3.0,
            status=DimensionStatus.SKIPPED,
        )
        result = compute_score(adjusted)
        assert result.total_score == 0
        assert result.active_dimension_count == 0

    def test_insufficient_evidence_treated_as_skipped(self) -> None:
        """INSUFFICIENT_EVIDENCE status redistributes weight like SKIPPED."""
        dims = [
            _make_dim("Content", 50, 5.0),
            _make_dim("Delivery", 50, 0.0, DimensionStatus.INSUFFICIENT_EVIDENCE),
        ]
        result = compute_score(dims)
        assert result.total_score == 100  # Only Content active, gets full weight
        assert result.redistributed_weight == pytest.approx(50.0, abs=0.001)

    def test_low_confidence_treated_as_active(self) -> None:
        """LOW_CONFIDENCE dimensions are still scored (just flagged)."""
        dims = [
            _make_dim("Content", 50, 4.0),
            _make_dim("Delivery", 50, 2.0, DimensionStatus.LOW_CONFIDENCE),
        ]
        result = compute_score(dims)
        # (4/5)*50 + (2/5)*50 = 40 + 20 = 60
        assert result.total_score == 60
        assert result.redistributed_weight == pytest.approx(0.0, abs=0.001)

    def test_redistribution_preserves_proportionality(self) -> None:
        """
        Two equal-weight active dimensions (30 each), one skipped (40).
        Active weights are 30 and 30 → each effective weight = 30 * (100/60) = 50.
        Both sub-scores = 5 → total = 100.
        """
        dims = [
            _make_dim("A", 30, 5.0),
            _make_dim("B", 30, 5.0),
            _make_dim("C", 40, 0.0, DimensionStatus.SKIPPED),
        ]
        result = compute_score(dims)
        assert result.total_score == 100
        a = next(r for r in result.dimension_results if r.dimension == "A")
        b = next(r for r in result.dimension_results if r.dimension == "B")
        assert a.effective_weight == pytest.approx(50.0, abs=0.01)
        assert b.effective_weight == pytest.approx(50.0, abs=0.01)


# ─────────────────────────────────────────────────────────────────────────────
# Input validation
# ─────────────────────────────────────────────────────────────────────────────


class TestInputValidation:
    def test_weights_not_summing_to_100_raises(self) -> None:
        """Weight sum != 100 must raise ScoringError."""
        dims = [
            _make_dim("A", 50, 3.0),
            _make_dim("B", 49, 3.0),  # sum = 99
        ]
        with pytest.raises(ScoringError, match="sum to"):
            compute_score(dims)

    def test_sub_score_above_5_raises(self) -> None:
        dims = [
            _make_dim("A", 60, 5.1),
            _make_dim("B", 40, 3.0),
        ]
        with pytest.raises(ScoringError, match="outside"):
            compute_score(dims)

    def test_sub_score_below_0_raises(self) -> None:
        dims = [
            _make_dim("A", 60, -0.1),
            _make_dim("B", 40, 3.0),
        ]
        with pytest.raises(ScoringError, match="outside"):
            compute_score(dims)

    def test_empty_dimensions_raises(self) -> None:
        with pytest.raises(ScoringError, match="No dimensions"):
            compute_score([])

    def test_weight_tolerance_allows_float_imprecision(self) -> None:
        """Weights summing to 99.999 (float arithmetic artifact) should pass."""
        dims = [
            _make_dim("A", 33.333, 5.0),
            _make_dim("B", 33.333, 5.0),
            _make_dim("C", 33.334, 5.0),  # 33.333 + 33.333 + 33.334 = 100.000
        ]
        result = compute_score(dims)
        assert result.total_score == 100


# ─────────────────────────────────────────────────────────────────────────────
# Reproducibility (R3)
# ─────────────────────────────────────────────────────────────────────────────


class TestReproducibility:
    def test_same_inputs_always_same_output(self) -> None:
        """The scoring function is deterministic — no random state."""
        dims = _default_rubric_full_score(3.7)
        results = [compute_score(dims) for _ in range(100)]
        scores = [r.total_score for r in results]
        assert len(set(scores)) == 1, f"Got multiple different scores: {set(scores)}"

    def test_order_of_dimensions_does_not_matter(self) -> None:
        """Score is independent of the order dimensions are passed in."""
        import random

        dims = _default_rubric_full_score(3.7)
        reference = compute_score(dims)
        for _ in range(20):
            shuffled = list(dims)
            random.shuffle(shuffled)
            assert compute_score(shuffled).total_score == reference.total_score
