"""
Unit tests for the time management scoring curve.

Boundary conditions tested:
- ratio = 0      → 0
- ratio = 0.5    → 0 (boundary, still zero)
- ratio = 0.5001 → just above 0 (enters lerp zone)
- ratio = 0.65   → lerp(1, 3) midpoint → 2.0
- ratio = 0.8    → lerp end → 3.0
- ratio = 1.0    → perfect → 5.0
- ratio = 1.05   → small overrun → lerp(5, 4) midpoint → 4.5
- ratio = 1.1    → just at overrun boundary → 4.0
- ratio = 1.2    → mid overrun → lerp(4, 2) midpoint → 3.0
- ratio = 1.3    → boundary → 2.0
- ratio = 1.301  → severe overrun → 0
- ratio = 2.0    → severe overrun → 0
"""

from __future__ import annotations

import pytest

from semeval.scoring.time_management import compute_time_management_sub_score


class TestTimeManagementCurve:
    # ── Severe underrun ──────────────────────────────────────────────────────

    def test_zero_actual_duration(self) -> None:
        assert compute_time_management_sub_score(600, 0) == pytest.approx(0.0)

    def test_ratio_exactly_half(self) -> None:
        """ratio == 0.5 → 0 (boundary is inclusive)."""
        assert compute_time_management_sub_score(600, 300) == pytest.approx(0.0)

    def test_ratio_below_half(self) -> None:
        assert compute_time_management_sub_score(600, 100) == pytest.approx(0.0)

    # ── Recovery zone (0.5 < ratio <= 0.8) ──────────────────────────────────

    def test_ratio_just_above_half(self) -> None:
        """ratio = 0.51 → lerp(1, 3, (0.51-0.5)/0.3) = lerp(1, 3, 0.0333) ≈ 1.067."""
        score = compute_time_management_sub_score(600, 306)  # 306/600 = 0.51
        assert score == pytest.approx(1.0 + 2.0 * (0.01 / 0.3), abs=0.01)

    def test_ratio_midpoint_recovery(self) -> None:
        """ratio = 0.65 → t = (0.65-0.5)/0.3 = 0.5 → lerp(1, 3, 0.5) = 2.0."""
        score = compute_time_management_sub_score(600, 390)  # 390/600 = 0.65
        assert score == pytest.approx(2.0, abs=0.001)

    def test_ratio_at_08(self) -> None:
        """ratio = 0.8 → t = (0.8-0.5)/0.3 = 1.0 → lerp(1, 3, 1.0) = 3.0."""
        score = compute_time_management_sub_score(600, 480)
        assert score == pytest.approx(3.0, abs=0.001)

    # ── Approaching perfect (0.8 < ratio <= 1.0) ─────────────────────────────

    def test_ratio_at_09(self) -> None:
        """ratio = 0.9 → t = (0.9-0.8)/0.2 = 0.5 → lerp(3, 5, 0.5) = 4.0."""
        score = compute_time_management_sub_score(600, 540)
        assert score == pytest.approx(4.0, abs=0.001)

    def test_ratio_exactly_1(self) -> None:
        """Perfect timing → 5.0."""
        score = compute_time_management_sub_score(600, 600)
        assert score == pytest.approx(5.0, abs=0.001)

    def test_ratio_at_095(self) -> None:
        """ratio = 0.95 → t = 0.75 → lerp(3, 5, 0.75) = 4.5."""
        score = compute_time_management_sub_score(600, 570)
        assert score == pytest.approx(4.5, abs=0.001)

    # ── Small overrun (1.0 < ratio <= 1.1) ───────────────────────────────────

    def test_ratio_at_1_05(self) -> None:
        """ratio = 1.05 → t = 0.5 → lerp(5, 4, 0.5) = 4.5."""
        score = compute_time_management_sub_score(600, 630)
        assert score == pytest.approx(4.5, abs=0.001)

    def test_ratio_at_11(self) -> None:
        """ratio = 1.1 → boundary → lerp(5, 4, 1.0) = 4.0."""
        score = compute_time_management_sub_score(600, 660)
        assert score == pytest.approx(4.0, abs=0.001)

    # ── Significant overrun (1.1 < ratio <= 1.3) ─────────────────────────────

    def test_ratio_at_12(self) -> None:
        """ratio = 1.2 → t = (1.2-1.1)/0.2 = 0.5 → lerp(4, 2, 0.5) = 3.0."""
        score = compute_time_management_sub_score(600, 720)
        assert score == pytest.approx(3.0, abs=0.001)

    def test_ratio_at_13(self) -> None:
        """ratio = 1.3 → t = 1.0 → lerp(4, 2, 1.0) = 2.0."""
        score = compute_time_management_sub_score(600, 780)
        assert score == pytest.approx(2.0, abs=0.001)

    # ── Severe overrun (ratio > 1.3) ──────────────────────────────────────────

    def test_ratio_just_above_13(self) -> None:
        """ratio = 1.31 → 0."""
        score = compute_time_management_sub_score(600, 786)
        assert score == pytest.approx(0.0, abs=0.001)

    def test_ratio_double(self) -> None:
        """Double the target → 0."""
        score = compute_time_management_sub_score(600, 1200)
        assert score == pytest.approx(0.0)

    # ── Output range ──────────────────────────────────────────────────────────

    def test_output_always_in_0_to_5(self) -> None:
        """Score is always in [0, 5] for any non-negative actual duration."""
        for actual in range(0, 3600, 30):
            score = compute_time_management_sub_score(600, actual)
            assert 0.0 <= score <= 5.0, f"Out of range at actual={actual}: {score}"

    # ── Input validation ──────────────────────────────────────────────────────

    def test_zero_target_raises(self) -> None:
        with pytest.raises(ValueError, match="target_duration_s must be > 0"):
            compute_time_management_sub_score(0, 300)

    def test_negative_target_raises(self) -> None:
        with pytest.raises(ValueError, match="target_duration_s must be > 0"):
            compute_time_management_sub_score(-60, 300)

    def test_negative_actual_raises(self) -> None:
        with pytest.raises(ValueError, match="actual_duration_s must be >= 0"):
            compute_time_management_sub_score(600, -1)
