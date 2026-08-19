"""LLM provider factory + structured fallback tests (mocked HTTP/LLM)."""

import pytest
from conftest import FakeLLM, FakeResponse, patch_httpx_async_client
from langchain_core.messages import SystemMessage
from pydantic import BaseModel

from app.services import llm
from app.services.llm import (
    FallbackLLM,
    GuardedChatOpenAI,
    _parse_engine_and_model,
    _resolve,
    _StructuredWithFallback,
    fetch_cerebras_models,
    fetch_mistral_models,
    fetch_openrouter_free_models,
    get_available_models,
    get_available_models_async,
    get_llm,
    get_llm_with_fallback,
)


class _Dummy(BaseModel):
    value: str


def _clear_caches(monkeypatch):
    for name in ("_cerebras_cache", "_mistral_cache", "_openrouter_free_cache"):
        monkeypatch.setattr(llm, name, [])
    for name in ("_cerebras_cache_time", "_mistral_cache_time", "_openrouter_free_cache_time"):
        monkeypatch.setattr(llm, name, 0.0)


@pytest.fixture(autouse=True)
def _clear(monkeypatch):
    _clear_caches(monkeypatch)
    monkeypatch.delenv("CEREBRAS_API_KEY", raising=False)
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)


# --------------------------------------------------------------------------- #
# Parsing / resolution
# --------------------------------------------------------------------------- #


def test_parse_engine_and_model():
    assert _parse_engine_and_model("cerebras") == ("cerebras", None)
    assert _parse_engine_and_model("openrouter:deepseek/deepseek-chat:free") == (
        "openrouter",
        "deepseek/deepseek-chat:free",
    )
    assert _parse_engine_and_model("  Mistral ", "ministral-3b") == ("mistral", "ministral-3b")


def test_resolve_cerebras(monkeypatch):
    monkeypatch.setenv("CEREBRAS_API_KEY", "k")
    cfg = _resolve("cerebras")
    assert cfg.engine == "cerebras"
    assert cfg.model == "gemma-4-31b"
    assert cfg.base_url == "https://api.cerebras.ai/v1"
    assert "X-Cerebras-3rd-Party-Integration" in cfg.default_headers


def test_resolve_mistral(monkeypatch):
    monkeypatch.setenv("MISTRAL_API_KEY", "k")
    cfg = _resolve("mistral", "ministral-8b-2512")
    assert cfg.model == "ministral-8b-2512"


def test_resolve_openrouter(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    cfg = _resolve("openrouter:meta-llama/llama-3.3-70b:free")
    assert cfg.engine == "openrouter"
    assert "reasoning" in cfg.extra_body


def test_resolve_unknown_engine():
    with pytest.raises(ValueError):
        _resolve("gpt-4")


def test_get_llm_without_key_returns_none():
    assert get_llm("cerebras") is None


def test_get_llm_with_key_returns_guarded(monkeypatch):
    monkeypatch.setenv("CEREBRAS_API_KEY", "k")
    client = get_llm("cerebras")
    assert isinstance(client, GuardedChatOpenAI)


# --------------------------------------------------------------------------- #
# Model discovery (HTTP mocked)
# --------------------------------------------------------------------------- #


async def test_fetch_cerebras_no_key_returns_fallback():
    models = await fetch_cerebras_models()
    assert any("gemma-4-31b" in m["id"] for m in models)


async def test_fetch_cerebras_parses(monkeypatch):
    monkeypatch.setenv("CEREBRAS_API_KEY", "k")
    handler = lambda *a, **k: FakeResponse(
        200, {"data": [{"id": "gpt-oss-120b"}, {"id": "gemma-4-31b-it"}]}
    )
    patch_httpx_async_client(monkeypatch, llm, handler)
    models = await fetch_cerebras_models()
    names = {m["model_id"] for m in models}
    assert "gpt-oss-120b" in names
    assert all(m["is_free"] for m in models)


async def test_fetch_cerebras_error_falls_back(monkeypatch):
    monkeypatch.setenv("CEREBRAS_API_KEY", "k")
    patch_httpx_async_client(monkeypatch, llm, lambda *a, **k: FakeResponse(500))
    models = await fetch_cerebras_models()
    assert models  # fallback list


async def test_fetch_mistral_filters_non_chat(monkeypatch):
    monkeypatch.setenv("MISTRAL_API_KEY", "k")
    handler = lambda *a, **k: FakeResponse(
        200,
        {
            "data": [
                {"id": "ministral-8b-2512"},
                {"id": "mistral-embed"},
                {"id": "mistral-moderation-latest"},
                {"id": "mistral-ocr-latest"},
            ]
        },
    )
    patch_httpx_async_client(monkeypatch, llm, handler)
    models = await fetch_mistral_models()
    ids = {m["model_id"] for m in models}
    assert ids == {"ministral-8b-2512"}


async def test_fetch_openrouter_filters_nonfree_and_rerank(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    handler = lambda *a, **k: FakeResponse(
        200,
        {
            "data": [
                {
                    "id": "deepseek/deepseek-chat:free",
                    "name": "DeepSeek Chat (free)",
                    "architecture": {"output_modalities": ["text"]},
                },
                {
                    "id": "nvidia/nemotron:free",
                    "name": "Nemotron",
                    "architecture": {"output_modalities": ["text"]},
                },
                {
                    "id": "openai/gpt-image:free",
                    "name": "GPT Image",
                    "architecture": {"output_modalities": ["image"]},
                },
                {
                    "id": "x/content-safety:free",
                    "name": "Guard",
                    "architecture": {"output_modalities": ["text"]},
                },
                {
                    "id": "vendor/rerank:free",
                    "name": "Rerank",
                    "architecture": {"output_modalities": ["text"]},
                },
                {
                    "id": "vendor/paid-model",
                    "name": "Paid",
                    "architecture": {"output_modalities": ["text"]},
                },
            ]
        },
    )
    patch_httpx_async_client(monkeypatch, llm, handler)
    models = await fetch_openrouter_free_models()
    ids = {m["model_id"] for m in models}
    assert ids == {"deepseek/deepseek-chat:free", "nvidia/nemotron:free"}


async def test_fetch_openrouter_cleans_names(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    handler = lambda *a, **k: FakeResponse(
        200,
        {
            "data": [
                {
                    "id": "google/gemma:free",
                    "name": "Gemma (free)",
                    "architecture": {"output_modalities": ["text"]},
                }
            ]
        },
    )
    patch_httpx_async_client(monkeypatch, llm, handler)
    models = await fetch_openrouter_free_models()
    assert models[0]["name"] == "Gemma"


async def test_fetch_openrouter_no_key_still_succeeds():
    # No key: headers simply omit Authorization, request should still go out
    handler = lambda *a, **k: FakeResponse(200, {"data": []})
    import app.services.llm as llm_mod

    monkeypatch = pytest.MonkeyPatch()
    try:
        patch_httpx_async_client(monkeypatch, llm_mod, handler)
        models = await fetch_openrouter_free_models()
        assert isinstance(models, list)
    finally:
        monkeypatch.undo()


# --------------------------------------------------------------------------- #
# Catalog assembly
# --------------------------------------------------------------------------- #


async def test_get_available_models_async_default_pick(monkeypatch):
    monkeypatch.setenv("CEREBRAS_API_KEY", "k")
    monkeypatch.setenv("MISTRAL_API_KEY", "k")
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    handler = lambda *a, **k: FakeResponse(200, {"data": []})
    patch_httpx_async_client(monkeypatch, llm, handler)
    catalog = await get_available_models_async()
    assert catalog.default_model == "cerebras:gemma-4-31b"
    assert len(catalog.models) > 0
    assert all(m.is_available for m in catalog.models)


def test_get_available_models_sync():
    catalog = get_available_models()
    assert catalog.models
    assert catalog.default_model


# --------------------------------------------------------------------------- #
# Structured-with-fallback
# --------------------------------------------------------------------------- #


async def test_structured_primary_success():
    primary = FakeLLM(structured_result=_Dummy(value="ok"))
    swf = _StructuredWithFallback(primary, None, _Dummy)
    res = await swf.ainvoke([SystemMessage(content="x")])
    assert res.value == "ok"


async def test_structured_primary_fails_fallback_succeeds():
    class Raising:
        def __init__(self):
            self._obj = FakeLLM()

        def with_structured_output(self, schema):
            out = self._obj.with_structured_output(schema)
            out._raises = RuntimeError("boom")
            return out

    primary = Raising()
    fallback = FakeLLM(structured_result=_Dummy(value="fb"))
    swf = _StructuredWithFallback(primary, fallback, _Dummy)
    res = await swf.ainvoke([SystemMessage(content="x")])
    assert res.value == "fb"


async def test_structured_json_repair_from_error():
    class ErrorWithJSON:
        def __init__(self):
            self._obj = FakeLLM()

        def with_structured_output(self, schema):
            out = self._obj.with_structured_output(schema)
            out._raises = RuntimeError('got {"value": "from-error"} in message')
            return out

    swf = _StructuredWithFallback(ErrorWithJSON(), None, _Dummy)
    res = await swf.ainvoke([SystemMessage(content="x")])
    assert res.value == "from-error"


async def test_structured_all_fail_uses_json_repair():
    class AlwaysFail:
        def __init__(self):
            self._obj = FakeLLM()

        def with_structured_output(self, schema):
            out = self._obj.with_structured_output(schema)
            out._raises = RuntimeError("nope")
            return out

    class RepairLLM:
        def __init__(self):
            self._obj = FakeLLM()

        def with_structured_output(self, schema):
            out = self._obj.with_structured_output(schema)
            out._raises = RuntimeError("nope")
            return out

        async def ainvoke(self, messages, **kwargs):
            class _Res:
                content = 'Here is the JSON: {"value": "repaired"}'

            return _Res()

    swf = _StructuredWithFallback(AlwaysFail(), RepairLLM(), _Dummy)
    res = await swf.ainvoke([SystemMessage(content="x")])
    assert res.value == "repaired"


async def test_structured_no_providers_raises():
    swf = _StructuredWithFallback(None, None, _Dummy)
    with pytest.raises(RuntimeError):
        await swf.ainvoke([SystemMessage(content="x")])


# --------------------------------------------------------------------------- #
# FallbackLLM
# --------------------------------------------------------------------------- #


async def test_fallback_llm_is_available():
    assert FallbackLLM(FakeLLM(), None).is_available
    assert not FallbackLLM(None, None).is_available


async def test_fallback_llm_primary_ainvoke():
    primary = FakeLLM()
    fallback = FakeLLM()
    res = await FallbackLLM(primary, fallback).ainvoke([])
    assert res.content == "ok"
    assert fallback.messages == []  # never used


async def test_fallback_llm_primary_error_falls_back():
    primary = FakeLLM(structured_raises=RuntimeError("boom"))
    fallback = FakeLLM()
    res = await FallbackLLM(primary, fallback).ainvoke([])
    assert res.content == "ok"


async def test_fallback_llm_stream():
    chunks = [c async for c in FallbackLLM(FakeLLM(), None).astream([])]
    assert len(chunks) == 2


async def test_fallback_llm_stream_falls_back():
    primary = FakeLLM(raises_stream=True)
    fallback = FakeLLM()
    chunks = [c async for c in FallbackLLM(primary, fallback).astream([])]
    assert len(chunks) == 2


async def test_fallback_llm_none_raises():
    with pytest.raises(RuntimeError):
        await FallbackLLM(None, None).ainvoke([])
    with pytest.raises(RuntimeError):
        async for _ in FallbackLLM(None, None).astream([]):
            pass


def test_get_llm_with_fallback_no_keys(monkeypatch):
    fb = get_llm_with_fallback("cerebras")
    assert fb._primary is None and fb._fallback is None


def test_get_llm_with_fallback_primary_and_fallback(monkeypatch):
    monkeypatch.setenv("CEREBRAS_API_KEY", "k")
    monkeypatch.setenv("MISTRAL_API_KEY", "k")
    fb = get_llm_with_fallback("cerebras")
    assert fb._primary is not None
    assert fb._fallback is not None


def test_get_llm_with_fallback_same_engine_switches(monkeypatch):
    monkeypatch.setenv("MISTRAL_API_KEY", "k")
    monkeypatch.setenv("CEREBRAS_API_KEY", "k")
    fb = get_llm_with_fallback("mistral", fallback_engine="mistral")
    assert fb._primary is not None
    assert fb._fallback is not None
    assert fb._primary.model_name != fb._fallback.model_name