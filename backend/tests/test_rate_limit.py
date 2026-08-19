"""Rate limiter client-IP resolution and sliding-window enforcement tests."""

from collections import defaultdict

from starlette.datastructures import Headers, Scope
from starlette.requests import Request

from app.api.middleware.rate_limit import RateLimiter, resolve_client_ip


def _request(headers: dict[str, str], client_host: str = "1.2.3.4") -> Request:
    scope: Scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/health",
        "headers": Headers(headers).raw,
        "client": (client_host, 1234),
        "server": ("server", 80),
        "scheme": "http",
        "query_string": b"",
        "root_path": "",
        "app": None,
    }
    return Request(scope)


def test_prefers_x_cf_client_ip():
    r = _request({"x-cf-client-ip": "203.0.113.9", "x-forwarded-for": "10.0.0.1, 203.0.113.9"})
    assert resolve_client_ip(r) == "203.0.113.9"


def test_uses_last_xff_hop_after_arr():
    # Azure ARR appends the real client IP as the LAST hop; earlier hops are
    # client-supplied and spoofable.
    r = _request({"x-forwarded-for": "66.249.65.1, 198.51.100.7"})
    assert resolve_client_ip(r) == "198.51.100.7"


def test_falls_back_to_x_real_ip():
    r = _request({"x-real-ip": "192.0.2.5"})
    assert resolve_client_ip(r) == "192.0.2.5"


def test_falls_back_to_socket_host():
    r = _request({}, client_host="9.9.9.9")
    assert resolve_client_ip(r) == "9.9.9.9"


def test_does_not_trust_first_xff_hop():
    # Regression: trusting the first hop would let anyone spoof their IP.
    r = _request({"x-forwarded-for": "6.6.6.6, 198.51.100.7"})
    assert resolve_client_ip(r) != "6.6.6.6"


async def test_limiter_rejects_over_limit(monkeypatch):
    import time

    limiter = RateLimiter(max_requests=2, window_seconds=60)
    timestamps: list[float] = []

    monkeypatch.setattr(
        "app.api.middleware.rate_limit._MEMORY_TIMESTAMPS",
        defaultdict(list, {"k": timestamps}),
    )
    monkeypatch.setattr(time, "time", lambda: 100.0)

    # k = ratelimit:/api/v1/health:203.0.113.9 — built from path + IP
    from fastapi import HTTPException

    r = _request({"x-cf-client-ip": "203.0.113.9"})
    # Allow up to 2
    await limiter(r)
    await limiter(r)
    try:
        await limiter(r)
        assert False, "third request should be rejected"
    except HTTPException as e:
        assert e.status_code == 429
        assert "Rate limit exceeded" in str(e.detail)


async def test_limiter_allows_within_window(monkeypatch):
    import time

    limiter = RateLimiter(max_requests=3, window_seconds=60)
    monkeypatch.setattr(
        "app.api.middleware.rate_limit._MEMORY_TIMESTAMPS",
        defaultdict(list),
    )
    monkeypatch.setattr(time, "time", lambda: 500.0)

    r = _request({"x-cf-client-ip": "203.0.113.9"})
    await limiter(r)
    await limiter(r)
    await limiter(r)  # exactly at the limit, allowed
