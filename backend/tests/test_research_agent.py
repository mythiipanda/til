"""Research agent SSE adapter tests (graph mocked, sink-driven)."""

import asyncio
import json

import pytest
from conftest import install_sync_cache

from app.services import research_agent
from app.services.research_agent import emit_sse, get_dossier, stream_deep_research


@pytest.fixture(autouse=True)
def _cache(monkeypatch):
    return install_sync_cache(monkeypatch, research_agent)


def _parse(chunk: str):
    return json.loads(chunk[len("data: ") :].strip())


async def test_emit_sse_roundtrip():
    chunk = emit_sse("thought", {"text": "hi"})
    parsed = _parse(chunk)
    assert parsed["event"] == "thought"
    assert parsed["data"] == {"text": "hi"}


def test_get_dossier_roundtrip(monkeypatch):
    cache = install_sync_cache(monkeypatch, research_agent)
    cache.set("dossier:n1", {"title": "T"})
    assert get_dossier("n1") == {"title": "T"}
    assert get_dossier("missing") is None


async def test_stream_deep_research_happy_path(monkeypatch):
    async def fake_run_research_graph(**kwargs):
        sink = kwargs["sink"]
        await sink.emit("plan", {"steps": []})
        await sink.emit("thought", {"agent": "Planner", "text": "thinking"})
        await sink.emit("dossier", {"node_id": "n1", "dossier": {"title": "T", "nodeId": "n1"}})
        await sink.emit("node_stream", {"id": "n1", "title": "T"})
        await sink.emit("done", {"root_id": "n1"})

    monkeypatch.setattr(research_agent, "run_research_graph", fake_run_research_graph)
    chunks = [chunk async for chunk in stream_deep_research(topic="Antikythera", model="cerebras")]
    events = [_parse(c) for c in chunks]

    types = [e["event"] for e in events]
    assert types[-1] == "done"
    assert types[0] == "plan"
    # dossier persisted to cache
    assert get_dossier("n1") == {"title": "T", "nodeId": "n1"}


async def test_stream_deep_research_surfaces_graph_error(monkeypatch):
    async def fake_run_research_graph(**kwargs):
        raise RuntimeError("graph exploded")

    monkeypatch.setattr(research_agent, "run_research_graph", fake_run_research_graph)
    chunks = [chunk async for chunk in stream_deep_research(topic="T")]
    events = [_parse(c) for c in chunks]
    assert events[-1]["event"] == "error"
    assert "graph exploded" in events[-1]["data"]["message"]


async def test_stream_deep_research_persists_leftover_dossier(monkeypatch):
    async def fake_run_research_graph(**kwargs):
        sink = kwargs["sink"]
        await sink.emit("done", {})
        # event emitted after done must still be drained
        await sink.emit("dossier", {"node_id": "leftover", "dossier": {"title": "L", "nodeId": "leftover"}})

    monkeypatch.setattr(research_agent, "run_research_graph", fake_run_research_graph)
    chunks = [chunk async for chunk in stream_deep_research(topic="T")]
    events = [_parse(c) for c in chunks]
    assert events[-1]["event"] == "done"
    assert get_dossier("leftover") is not None


async def test_stream_deep_research_dossier_without_node_id_not_cached(monkeypatch):
    async def fake_run_research_graph(**kwargs):
        sink = kwargs["sink"]
        await sink.emit("dossier", {"dossier": {"title": "NoId"}})
        await sink.emit("done", {})

    monkeypatch.setattr(research_agent, "run_research_graph", fake_run_research_graph)
    chunks = [chunk async for chunk in stream_deep_research(topic="T")]
    assert len(chunks) >= 2


async def test_stream_deep_research_cancelled_midstream(monkeypatch):
    async def fake_run_research_graph(**kwargs):
        sink = kwargs["sink"]
        await sink.emit("plan", {"steps": []})
        await asyncio.sleep(5)

    monkeypatch.setattr(research_agent, "run_research_graph", fake_run_research_graph)

    gen = stream_deep_research(topic="T")
    first = await anext(gen)
    assert _parse(first)["event"] == "plan"
    await gen.aclose()  # close early → finally block cancels the task