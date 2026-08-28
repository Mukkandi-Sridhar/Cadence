"""
Site-wide HTTP Basic Auth gate.

Single shared password, not per-user accounts — this app has no user model
(one shared tool for a college event's organizers/judges, not multi-tenant
SaaS), so a login system would be unused scaffolding. HTTP Basic means the
browser's native credential prompt covers the whole site — API, SPA, and
static assets — in one shot, with zero frontend changes required.

Applied as ASGI middleware rather than a FastAPI route dependency because
the built frontend is served via a raw StaticFiles mount and a catch-all
route (semeval/main.py), neither of which a per-router `dependencies=[]`
would reach.
"""

from __future__ import annotations

import base64
import secrets

from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp, Receive, Scope, Send

from semeval.config import get_settings

_EXEMPT_PATHS = frozenset({"/health", "/api/v1/health"})


def _is_valid_basic_auth(header_value: str | None, expected_password: str) -> bool:
    """Pure so it's trivially unit-testable without spinning up the app."""
    if not header_value or not header_value.startswith("Basic "):
        return False
    try:
        decoded = base64.b64decode(header_value[len("Basic ") :]).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return False
    _username, _, password = decoded.partition(":")
    return secrets.compare_digest(password, expected_password)


class BasicAuthGateMiddleware:
    """
    No-ops entirely when DISABLE_AUTH=true or ACCESS_PASSWORD is unset —
    deliberately fails open rather than crashing or silently locking
    everyone out, matching the lesson from tonight's config-validator
    outage: a misconfigured secret should degrade, not take the app down.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        settings = get_settings()
        if settings.disable_auth or not settings.access_password:
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        if request.url.path in _EXEMPT_PATHS:
            await self.app(scope, receive, send)
            return

        if _is_valid_basic_auth(request.headers.get("authorization"), settings.access_password):
            await self.app(scope, receive, send)
            return

        response = Response(
            status_code=401,
            content="Access denied.",
            headers={"WWW-Authenticate": 'Basic realm="Cadence"'},
        )
        await response(scope, receive, send)
