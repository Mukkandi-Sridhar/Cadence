"""Unit tests for the per-IP rate limiter (semeval/api/rate_limit.py)."""

from __future__ import annotations

import uuid

from semeval.api.rate_limit import _check_rate_limit


def _unique_key() -> str:
    # Each test gets its own key since _hits is module-level shared state.
    return f"test-{uuid.uuid4()}"


def test_requests_within_limit_are_allowed() -> None:
    key = _unique_key()
    for i in range(5):
        assert _check_rate_limit(key, max_requests=5, window_s=60, now=float(i)) is None


def test_request_over_limit_is_blocked_with_retry_after() -> None:
    key = _unique_key()
    for i in range(5):
        _check_rate_limit(key, max_requests=5, window_s=60, now=float(i))
    retry_after = _check_rate_limit(key, max_requests=5, window_s=60, now=5.0)
    assert retry_after is not None
    assert retry_after > 0


def test_window_expiry_allows_requests_again() -> None:
    key = _unique_key()
    for i in range(5):
        _check_rate_limit(key, max_requests=5, window_s=60, now=float(i))
    assert _check_rate_limit(key, max_requests=5, window_s=60, now=5.0) is not None
    # Far enough past the window that the earliest hits have expired.
    assert _check_rate_limit(key, max_requests=5, window_s=60, now=100.0) is None


def test_different_keys_are_independent() -> None:
    key_a, key_b = _unique_key(), _unique_key()
    for i in range(5):
        _check_rate_limit(key_a, max_requests=5, window_s=60, now=float(i))
    # key_a is now at its limit; key_b should be unaffected.
    assert _check_rate_limit(key_b, max_requests=5, window_s=60, now=0.0) is None
