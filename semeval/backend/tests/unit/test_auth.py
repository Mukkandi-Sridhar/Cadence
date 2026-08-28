"""Unit tests for the site-wide HTTP Basic Auth gate (semeval/api/auth.py)."""

from __future__ import annotations

import base64

from semeval.api.auth import _is_valid_basic_auth


def _basic_header(username: str, password: str) -> str:
    raw = f"{username}:{password}".encode()
    return "Basic " + base64.b64encode(raw).decode()


def test_correct_password_is_valid_regardless_of_username() -> None:
    assert _is_valid_basic_auth(_basic_header("anyone", "correct-horse"), "correct-horse")
    assert _is_valid_basic_auth(_basic_header("", "correct-horse"), "correct-horse")


def test_wrong_password_is_rejected() -> None:
    assert not _is_valid_basic_auth(_basic_header("judge", "wrong"), "correct-horse")


def test_missing_or_malformed_header_is_rejected() -> None:
    assert not _is_valid_basic_auth(None, "correct-horse")
    assert not _is_valid_basic_auth("", "correct-horse")
    assert not _is_valid_basic_auth("Bearer sometoken", "correct-horse")
    assert not _is_valid_basic_auth("Basic not-valid-base64!!!", "correct-horse")


def test_blank_expected_password_is_the_middlewares_job_to_prevent() -> None:
    # This function does a plain string comparison, so "" == "" is
    # technically valid — the actual guard is one layer up: the middleware
    # never calls this at all when access_password is unset (see
    # BasicAuthGateMiddleware, which no-ops the whole gate in that case).
    assert _is_valid_basic_auth(_basic_header("x", ""), "")
