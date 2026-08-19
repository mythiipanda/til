"""Precompute batch logic tests (graph + picker mocked)."""

import pytest
from conftest import install_sync_cache

from app.schemas.graph import NodeSchema
from app.services import precompute
from app.services.precompute import (
    _append_index,
    _catalog_topics,
    _dossier_from_events,
    _hub_key,
    _node_streams,
    get_precomputed_hub,
    list_precomputed_hubs,
    precompute_batch,
    precompute_bulk,
    precompute_one,
    precompute_topic,
)


@pytest.fixture(autouse=True)
def _cache(monkeypatch):
    return install_sync_cache(monkeypatch, precompute)


def _root():
    return NodeSchema(id="r1", title="Antikythera", summary="S", imageUrl="https://i", curiosity_score=8)


def _events():
    return [
        {"event": "plan", "data": {"steps": []}},
        {"event": "node_stream", "data": {"node": {"id": "r1", "title": "Antikythera", "summary": "S"}, "is_root": True}},
        {"event": "node_stream", "data": {"node": {"id": "c1", "title": "Child", "summary": "Cs"}, "is_root": False}},
        {"event": "dossier", "data": {"node_id": "r1", "dossier": {"title": "D", "nodeId": "r1"}}},
        {"event": "done", "data": {}},
    ]


def test_hub_key():
    assert _hub_key("abc") == "precomputed:hub:abc"


def test_list_precomputed_hubs_empty():
    assert list_precomputed_hubs() == []


def test_get_precomputed_hub_roundtrip(monkeypatch):
    cache = install_sync_cache(monkeypatch, precompute)
    hub = {"id": "h", "topic": "T", "category": "C", "root": _root().model_dump(), "children": []}
    cache.set("precomputed:hub:h", hub)
    assert get_precomputed_hub("h").topic == "T"


def test_get_precomputed_hub_corrupt(monkeypatch):
    cache = install_sync_cache(monkeypatch, precompute)
    cache.set("precomputed:hub:h", {"id": "h"})  # missing required fields
    assert get_precomputed_hub("h") is None


def test_get_precomputed_hub_missing():
    assert get_precomputed_hub("nope") is None


def test_dossier_from_events():
    assert _dossier_from_events(_events())["nodeId"] == "r1"
    assert _dossier_from_events([{"event": "plan", "data": {}}]) is None


def test_node_streams():
    streams = _node_streams(_events())
    assert len(streams) == 2
    assert streams[0] == ({"id": "r1", "title": "Antikythera", "summary": "S"}, True)
    assert streams[1][1] is False


def test_append_index_dedupes(monkeypatch):
    install_sync_cache(monkeypatch, precompute)
    _append_index({"topic": "A", "id": "1", "category": "C"})
    _append_index({"topic": "A", "id": "2", "category": "C"})
    _append_index({"topic": "B", "id": "3", "category": "C"})
    assert len(list_precomputed_hubs()) == 2


async def test_precompute_topic_success(monkeypatch):
    async def fake_run_research_graph(**kwargs):
        sink = kwargs["sink"]
        for ev in _events():
            await sink.emit(ev["event"], ev["data"])

    monkeypatch.setattr(precompute, "run_research_graph", fake_run_research_graph)
    # precompute_topic does a local `from app.services.supabase import ...`; patch the real module.
    from app.services import supabase as supabase_mod

    monkeypatch.setattr(supabase_mod, "is_supabase_configured", lambda: False)

    hub = await precompute_topic("Antikythera", "History")
    assert hub is not None
    assert hub.root.title == "Antikythera"
    assert len(hub.children) == 1
    assert get_precomputed_hub(hub.id) is not None


async def test_precompute_topic_graph_fails(monkeypatch):
    async def fake_run_research_graph(**kwargs):
        raise RuntimeError("graph dead")

    monkeypatch.setattr(precompute, "run_research_graph", fake_run_research_graph)
    assert await precompute_topic("T", "C") is None


async def test_precompute_topic_no_nodes(monkeypatch):
    async def fake_run_research_graph(**kwargs):
        sink = kwargs["sink"]
        await sink.emit("done", {})

    monkeypatch.setattr(precompute, "run_research_graph", fake_run_research_graph)
    assert await precompute_topic("T", "C") is None


async def test_precompute_one(monkeypatch):
    class _Picked:
        node = NodeSchema(id="p", title="Picked topic", summary="S")

    async def fake_pick(cat):
        return _Picked()

    monkeypatch.setattr(precompute, "pick_random_topic", fake_pick)
    monkeypatch.setattr(precompute, "precompute_topic", _fake_hub)
    hub = await precompute_one("History")
    assert hub.topic == "Picked topic"


async def test_precompute_one_pick_fails(monkeypatch):
    async def fake_pick(cat):
        raise RuntimeError("picker down")

    monkeypatch.setattr(precompute, "pick_random_topic", fake_pick)
    assert await precompute_one("History") is None


async def _fake_hub(topic, category):
    return type("H", (), {"id": "h1", "topic": topic, "category": category, "root": _root()})()


def test_catalog_topics_round_robin(monkeypatch):
    cache = install_sync_cache(monkeypatch, precompute)
    cache.set("topics:catalog:history", [{"title": "H1"}, {"title": "H2"}])
    cache.set("topics:catalog:science", [{"title": "S1"}])
    topics = _catalog_topics(["History", "Science"])
    assert topics == [("H1", "History"), ("S1", "Science"), ("H2", "History")]


def test_catalog_topics_ignores_missing(monkeypatch):
    install_sync_cache(monkeypatch, precompute)
    assert _catalog_topics(["Unknown"]) == []


async def test_precompute_bulk(monkeypatch):
    cache = install_sync_cache(monkeypatch, precompute)
    cache.set("topics:catalog:history", [{"title": "T1"}, {"title": "T2"}])
    cache.set("topics:catalog:science", [{"title": "S1"}])
    monkeypatch.setattr(precompute, "CATEGORY_WIKI_MAP", {"History": "History", "Science": "Science"})
    monkeypatch.setattr(precompute, "precompute_topic", _fake_hub)

    hubs = await precompute_bulk(count=10, concurrency=2, categories=["History", "Science"])
    assert len(hubs) == 3
    assert len(list_precomputed_hubs()) == 3


async def test_precompute_batch(monkeypatch):
    monkeypatch.setattr(precompute, "CATEGORY_WIKI_MAP", {"History": "History"})
    monkeypatch.setattr(precompute, "precompute_one", lambda cat: _fake_hub("Antikythera", cat))
    summaries = await precompute_batch(["History"])
    assert summaries[0].topic == "Antikythera"


async def test_precompute_batch_skips_failures(monkeypatch):
    monkeypatch.setattr(precompute, "CATEGORY_WIKI_MAP", {"History": "History", "Science": "Science"})

    async def _none(cat):
        return None

    monkeypatch.setattr(precompute, "precompute_one", _none)
    assert await precompute_batch(["History", "Science"]) == []