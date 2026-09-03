"""
Regression test: the health endpoints must answer HEAD, not just GET.

An external uptime monitor reported the whole site down with 405 Method
Not Allowed while it was serving users fine. Cause: uptime monitors default
to HEAD, and FastAPI's APIRoute — unlike plain Starlette's Route — does not
add HEAD automatically alongside GET.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from semeval.main import create_app


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(create_app())


@pytest.mark.parametrize("path", ["/health", "/api/v1/health"])
def test_health_answers_head(client: TestClient, path: str) -> None:
    assert client.head(path).status_code == 200


@pytest.mark.parametrize("path", ["/health", "/api/v1/health"])
def test_health_still_answers_get(client: TestClient, path: str) -> None:
    res = client.get(path)
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_unsupported_method_still_rejected(client: TestClient) -> None:
    # Accepting HEAD must not have loosened the route into accepting anything.
    assert client.post("/api/v1/health").status_code == 405
