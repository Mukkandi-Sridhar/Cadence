"""
Time management sub-score curve (computed purely in code — R1).

Target duration T, actual duration A.
ratio = A / T

Score curve (produces a sub-score in [0, 5]):

  ratio <= 0.5:         0   (severely short — insufficient sample territory)
  0.5 < ratio <= 0.8:   lerp(1, 3, t) where t = (ratio - 0.5) / 0.3
  0.8 < ratio <= 1.0:   lerp(3, 5, t) where t = (ratio - 0.8) / 0.2
  1.0 < ratio <= 1.1:   lerp(5, 4, t) where t = (ratio - 1.0) / 0.1  (small overrun OK)
  1.1 < ratio <= 1.3:   lerp(4, 2, t) where t = (ratio - 1.1) / 0.2
  ratio > 1.3:          0   (severe overrun)

The curve rewards landing in the 80-110% window and penalises both directions
without a cliff. Overrunning by 10% is still penalised slightly (5→4), but not
catastrophically. Severe overrun (>130%) is treated the same as severe underrun.
"""

from __future__ import annotations


def _lerp(a: float, b: float, t: float) -> float:
    """Linear interpolation: t in [0, 1]."""
    return a + (b - a) * t


def compute_time_management_sub_score(
    target_duration_s: int,
    actual_duration_s: int,
) -> float:
    """
    Return a sub-score in [0.0, 5.0] for time management.

    Args:
        target_duration_s: Organizer-set target in seconds.
        actual_duration_s: Measured presentation duration in seconds.

    Returns:
        Float sub-score in [0.0, 5.0].

    Raises:
        ValueError: If either duration is non-positive.
    """
    if target_duration_s <= 0:
        raise ValueError(f"target_duration_s must be > 0, got {target_duration_s}")
    if actual_duration_s < 0:
        raise ValueError(f"actual_duration_s must be >= 0, got {actual_duration_s}")

    ratio = actual_duration_s / target_duration_s

    if ratio <= 0.5:
        return 0.0

    if ratio <= 0.8:
        t = (ratio - 0.5) / 0.3
        return _lerp(1.0, 3.0, t)

    if ratio <= 1.0:
        t = (ratio - 0.8) / 0.2
        return _lerp(3.0, 5.0, t)

    if ratio <= 1.1:
        t = (ratio - 1.0) / 0.1
        return _lerp(5.0, 4.0, t)

    if ratio <= 1.3:
        t = (ratio - 1.1) / 0.2
        return _lerp(4.0, 2.0, t)

    # ratio > 1.3: severe overrun
    return 0.0
