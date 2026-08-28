"""
Regression test for the duration-based hard-cap bug found by the LLM
stress test (2026-08-28): a short client-reported duration used to crush
scores independent of word count, even for a long, accurate transcript.
Fixed by making the mandatory length penalty word-count-only — see
_length_penalty_flags in semeval/api/routers/score.py.
"""

from __future__ import annotations

from semeval.api.routers.score import _length_penalty_flags


def test_short_word_count_flagged_regardless_of_duration() -> None:
    # word_count alone drives the flags now; duration isn't even a parameter.
    is_very_short, is_short = _length_penalty_flags(word_count=10)
    assert is_very_short is True
    assert is_short is True


def test_good_word_count_not_penalized_by_a_glitched_short_duration() -> None:
    # This is the exact case that broke: an 84-word, on-topic transcript
    # paired with a bogus 10-second stated duration must NOT be capped.
    is_very_short, is_short = _length_penalty_flags(word_count=84)
    assert is_very_short is False
    assert is_short is False


def test_boundary_values() -> None:
    assert _length_penalty_flags(word_count=24) == (True, True)
    assert _length_penalty_flags(word_count=25) == (False, True)
    assert _length_penalty_flags(word_count=39) == (False, True)
    assert _length_penalty_flags(word_count=40) == (False, False)
