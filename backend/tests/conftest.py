"""Shared test doubles: fake HTTP client, fake LLM, and tiny sync cache backend."""

import time

import httpx
from langchain_core.messages import AIMessage


class FakeResponse:
    """Minimal stand-in for httpx.Response with the members our code uses."""

    def __init__(self, status_code: int = 200, json_data: dict | list | None = None, text: str = ""):
        self.status_code = status_code
        self._json = json_data
        self.text = text

    def json(self):
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"HTTP {self.status_code}", request=None, response=httpx.Response(self.status_code)
            )


class FakeAsyncClient:
    """Async httpx.AsyncClient stand-in. `handler(url, params, json)` returns a FakeResponse."""

    def __init__(self, handler):
        self._handler = handler
        self.requests: list[tuple[str, dict | None, dict | None]] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, params=None, headers=None, timeout=None, **kw):
        self.requests.append((url, params, None))
        return self._handler(url, params)

    async def post(self, url, params=None, headers=None, json=None, timeout=None, **kw):
        self.requests.append((url, params, json))
        return self._handler(url, params, json=json)

    async def aclose(self):
        return None


def make_client(handler):
    """Build a fake client whose .get / .post route through `handler`."""
    client = FakeAsyncClient(handler)
    return client


def patch_shared_client(monkeypatch, target_module, handler) -> FakeAsyncClient:
    """Patch `target_module.get_shared_client` to return a FakeAsyncClient routed by handler."""
    client = FakeAsyncClient(handler)

    async def fake_get_shared_client():
        return client

    monkeypatch.setattr(target_module, "get_shared_client", fake_get_shared_client)
    return client


def patch_httpx_async_client(monkeypatch, target_module, handler) -> FakeAsyncClient:
    """Patch `target_module.httpx.AsyncClient` so `async with httpx.AsyncClient(...)` uses the fake."""
    client = FakeAsyncClient(handler)

    class _Factory:
        def __init__(self, *args, **kwargs):
            self._client = client

        async def __aenter__(self):
            return client

        async def __aexit__(self, *exc):
            return False

    monkeypatch.setattr(target_module.httpx, "AsyncClient", _Factory)
    return client


class FakeStructuredOutput:
    def __init__(self, result=None, raises=None):
        self._result = result
        self._raises = raises

    async def ainvoke(self, messages, **kwargs):
        if self._raises is not None:
            raise self._raises
        if self._result is None:
            raise RuntimeError("FakeStructuredOutput: no result configured")
        return self._result


class FakeLLM:
    """FallbackLLM stand-in used to exercise planner/researcher/synthesizer paths."""

    is_available = True

    def __init__(self, structured_result=None, structured_raises=None, raises_stream=False):
        self._structured_result = structured_result
        self._structured_raises = structured_raises
        self._raises_stream = raises_stream
        self.messages: list[list] = []

    def with_structured_output(self, schema):
        return FakeStructuredOutput(self._structured_result, self._structured_raises)

    async def ainvoke(self, messages, **kwargs):
        self.messages.append(messages)
        if self._structured_raises is not None:
            raise self._structured_raises
        return AIMessage(content="ok")

    async def astream(self, messages, **kwargs):
        self.messages.append(messages)
        if self._raises_stream:
            raise RuntimeError("stream failed")
        yield AIMessage(content="token one ")
        yield AIMessage(content="token two")


class FakeNoLLM:
    """A falsy LLM with the same surface, so `if llm:` guards take the fallback branch."""

    is_available = False

    def with_structured_output(self, schema):
        raise AssertionError("should not be called")

    async def ainvoke(self, *a, **kw):
        raise AssertionError("should not be called")

    async def astream(self, *a, **kw):
        raise AssertionError("should not be called")


class FakeDispatchLLM:
    """Returns a different structured result per schema type (for multi-node graph runs)."""

    is_available = True

    def __init__(self, results: dict):
        self._results = results

    def with_structured_output(self, schema):
        result = self._results.get(schema)
        return FakeStructuredOutput(result)

    async def ainvoke(self, messages, **kwargs):
        return AIMessage(content="ok")

    async def astream(self, messages, **kwargs):
        yield AIMessage(content="token")


class SyncCache:
    """In-memory CacheService that never touches the disk, for fast deterministic tests."""

    def __init__(self):
        self._mem: dict[str, tuple[float, object]] = {}

    def get(self, key):
        entry = self._mem.get(key.lower().strip())
        if entry is None:
            return None
        expires, value = entry
        if expires <= time.time():
            self._mem.pop(key.lower().strip(), None)
            return None
        return value

    def set(self, key, value, ttl_seconds=86400):
        self._mem[key.lower().strip()] = (time.time() + ttl_seconds, value)

    def flush(self):
        return None


def install_sync_cache(monkeypatch, target_module=None):
    """Replace the shared cache_service in `target_module` (or global default) with SyncCache.

    Note: modules holding a reference to the module-global `cache_service` import
    still need their own monkeypatch; pass target_module to cover that import site.
    """
    cache = SyncCache()
    if target_module is not None:
        monkeypatch.setattr(target_module, "cache_service", cache)
    else:
        from app.services import cache as cache_mod

        monkeypatch.setattr(cache_mod, "cache_service", cache)
    return cache