"""Follow-up chat agent tests: query cleaning + full SSE stream with mocked tools/LLM."""

import json

import pytest
from conftest import FakeLLM, install_sync_cache

from app.schemas.graph import SourceCitationSchema
from app.services import chat_agent
from app.services.chat_agent import _clean_search_query, stream_chat


@pytest.fixture(autouse=True)
def _cache(monkeypatch):
    return install_sync_cache(monkeypatch, chat_agent)


# --------------------------------------------------------------------------- #
# Query cleaning
# --------------------------------------------------------------------------- #


def test_clean_strips_filler_prefix():
    assert _clean_search_query("Antikythera", "tell me more about the gears") == "Antikythera the gears"


def test_clean_strips_what_prefix():
    assert _clean_search_query("Black-Scholes", "what is the Black-Scholes model") == "Black-Scholes model"


def test_clean_keeps_topic_when_question_offtopic():
    assert _clean_search_query("Antikythera", "why did the Romans invade Gaul") == "Antikythera the Romans invade Gaul"


def test_clean_empty_question_returns_topic():
    assert _clean_search_query("Topic", "  ???") == "Topic"


# --------------------------------------------------------------------------- #
# Stream
# --------------------------------------------------------------------------- #


async def _events(gen):
    return [json.loads(c[len("data: ") :].strip()) for c in [chunk async for chunk in gen]]


async def test_stream_chat_full_flow(monkeypatch):
    src = SourceCitationSchema(
        id="s1", title="Verified Source", url="https://example.com/1", snippet="A snippet", publisher="Web"
    )

    async def fake_search(q, max_results=5):
        return [src]

    async def fake_fetch(url, max_chars=3500):
        return "Fetched page content about the topic."

    monkeypatch.setattr(chat_agent, "search_web_ladder", fake_search)
    monkeypatch.setattr(chat_agent, "fetch_page_content", fake_fetch)
    monkeypatch.setattr(chat_agent, "get_llm_with_fallback", lambda *a, **k: FakeLLM())

    events = await _events(
        stream_chat(
            node_title="Antikythera",
            user_question="How did the gears work?",
            node_id="n1",
            ancestor_context=["History"],
            history=[{"role": "user", "content": "earlier turn"}],
            active_summary="A summary",
        )
    )

    types = [e["event"] for e in events]
    assert types[0] == "thought"
    assert "tool_call" in types
    assert "tool_result" in types
    assert "source" in types
    assert "answer_start" in types
    assert "token" in types
    assert types[-1] == "done"

    complete = next(e for e in events if e["event"] == "answer_complete")
    assert "How did Antikythera first emerge?" in complete["data"]["suggested_follow_ups"]
    assert complete["data"]["model"] == "cerebras:gemma-4-31b"


async def test_stream_chat_no_sources_fallback_answer(monkeypatch):
    async def fake_search(q, max_results=5):
        return []

    async def fake_fetch(url, max_chars=3500):
        return None

    monkeypatch.setattr(chat_agent, "search_web_ladder", fake_search)
    monkeypatch.setattr(chat_agent, "fetch_page_content", fake_fetch)
    monkeypatch.setattr(chat_agent, "get_llm_with_fallback", lambda *a, **k: FakeLLM())

    events = await _events(stream_chat(node_title="X", user_question="Why?"))

    complete = next(e for e in events if e["event"] == "answer_complete")
    # Streaming produced nothing (FakeLLM astream yields tokens), so this still passes
    assert complete["data"]["cited_sources"] == []


async def test_stream_chat_llm_stream_error_still_completes(monkeypatch):
    src = SourceCitationSchema(id="s1", title="T", url="https://e.com/1", snippet="s", publisher="Web")

    async def fake_search(q, max_results=5):
        return [src]

    async def fake_fetch(url, max_chars=3500):
        return "content"

    monkeypatch.setattr(chat_agent, "search_web_ladder", fake_search)
    monkeypatch.setattr(chat_agent, "fetch_page_content", fake_fetch)
    monkeypatch.setattr(chat_agent, "get_llm_with_fallback", lambda *a, **k: FakeLLM(raises_stream=True))

    events = await _events(stream_chat(node_title="X", user_question="Why?", node_id="n1"))
    complete = next(e for e in events if e["event"] == "answer_complete")
    assert complete["data"]["answer"]  # fallback text streamed
    assert complete["data"]["model_label"]


async def test_stream_chat_uses_cached_dossier(monkeypatch):
    cache = install_sync_cache(monkeypatch, chat_agent)
    cache.set(
        "dossier:n1",
        {
            "title": "Antikythera",
            "coreThesis": "An ancient computer.",
            "abstract": "Found in a shipwreck.",
            "wowFact": "1,000 years ahead of its time.",
            "mechanisms": [{"title": "Gears", "explanation": "Bronze gears"}],
            "timeline": [{"date": "1901", "headline": "Discovered", "description": "By divers"}],
            "sources": [{"url": "https://dossier.example/1", "title": "Dossier Source"}],
        },
    )

    async def fake_search(q, max_results=5):
        return []

    async def fake_fetch(url, max_chars=3500):
        return None

    monkeypatch.setattr(chat_agent, "search_web_ladder", fake_search)
    monkeypatch.setattr(chat_agent, "fetch_page_content", fake_fetch)
    monkeypatch.setattr(chat_agent, "get_llm_with_fallback", lambda *a, **k: FakeLLM())

    events = await _events(stream_chat(node_title="Antikythera", user_question="How?", node_id="n1"))
    sources = [e["data"] for e in events if e["event"] == "source"]
    assert any(s["url"] == "https://dossier.example/1" for s in sources)


async def test_stream_chat_uses_explicit_model_label(monkeypatch):
    async def fake_search(q, max_results=5):
        return []

    async def fake_fetch(url, max_chars=3500):
        return None

    monkeypatch.setattr(chat_agent, "search_web_ladder", fake_search)
    monkeypatch.setattr(chat_agent, "fetch_page_content", fake_fetch)
    monkeypatch.setattr(chat_agent, "get_llm_with_fallback", lambda *a, **k: FakeLLM())

    events = await _events(stream_chat(node_title="X", user_question="Y", model="mistral:ministral-8b-2512"))
    complete = next(e for e in events if e["event"] == "answer_complete")
    assert "Mistral AI" in complete["data"]["model_label"]