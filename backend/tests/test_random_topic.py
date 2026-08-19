"""Curiosity topic picker tests (pools + LLM mocked)."""

import httpx
import pytest
from conftest import FakeLLM, FakeResponse, install_sync_cache

from app.schemas.graph import NodeSchema
from app.services import random_topic
from app.services.random_topic import (
    _clean_category,
    _fetch_category_members,
    _is_interesting_title,
    _llm_pick,
    _rate_limited_get,
    _to_node,
    _TopicPick,
    pick_random_topic,
)


@pytest.fixture(autouse=True)
def _cache(monkeypatch):
    install_sync_cache(monkeypatch, random_topic)
    # pick_random_topic pulls catalog candidates through the real catalog.cache_service
    # (a local import); isolate it too so the on-disk dev cache can't leak in.
    from app.services import catalog as catalog_mod

    return install_sync_cache(monkeypatch, catalog_mod)


# --------------------------------------------------------------------------- #
# Category + title cleaning
# --------------------------------------------------------------------------- #


def test_clean_category_exact():
    assert _clean_category("science") == "Science"
    assert _clean_category("history") == "History"


def test_clean_category_fuzzy_match():
    assert _clean_category("Histories") == "History"
    assert _clean_category("Food and Drink") == "Food and drink"


def test_clean_category_unknown_defaults_to_history():
    assert _clean_category("Astrology") == "History"


def test_is_interesting_title_rejects_meta():
    assert _is_interesting_title("List of Roman emperors", "History") is False
    assert _is_interesting_title("History", "History") is False
    assert _is_interesting_title("Wikipedia:Portal", "History") is False
    assert _is_interesting_title("Physics", "Science") is False  # single word


def test_is_interesting_title_accepts_concrete():
    assert _is_interesting_title("Antikythera mechanism", "History") is True


# --------------------------------------------------------------------------- #
# HTTP helpers
# --------------------------------------------------------------------------- #


async def test_rate_limited_get_retries_on_429(monkeypatch):
    async def _no_sleep(*a, **k):
        pass

    monkeypatch.setattr(random_topic.asyncio, "sleep", _no_sleep)
    calls = {"n": 0}

    async def client_get(url, params):
        calls["n"] += 1
        if calls["n"] < 3:
            return FakeResponse(429)
        return FakeResponse(200, {"ok": True})

    class FakeClient:
        async def get(self, url, params=None):
            return await client_get(url, params)

        def build_request(self, *a, **k):
            return None

    resp = await _rate_limited_get(FakeClient(), "https://x", {}, retries=4)
    assert resp.status_code == 200


async def test_rate_limited_get_exhausts_retries():
    class FakeClient:
        async def get(self, url, params=None):
            return FakeResponse(429)

        def build_request(self, *a, **k):
            return None

    with pytest.raises(httpx.HTTPStatusError):
        await _rate_limited_get(FakeClient(), "https://x", {}, retries=2)


async def test_rate_limited_get_raises_http_status_error():
    class FakeClient:
        async def get(self, url, params=None):
            return FakeResponse(404)

    with pytest.raises(httpx.HTTPStatusError):
        await _rate_limited_get(FakeClient(), "https://x", {}, retries=2)


async def test_fetch_category_members_paginates(monkeypatch):
    responses = iter(
        [
            FakeResponse(
                200,
                {
                    "query": {
                        "categorymembers": [
                            {"ns": 14, "title": "Category:Sub"},
                            {"ns": 0, "title": "Antikythera mechanism"},
                        ]
                    },
                    "continue": {"cmcontinue": "next"},
                },
            ),
            FakeResponse(200, {"query": {"categorymembers": [{"ns": 0, "title": "Second page"}]}}),
        ]
    )

    class FakeClient:
        async def get(self, url, params=None):
            return next(responses)

    monkeypatch.setattr(random_topic, "_rate_limited_get", lambda c, u, p: c.get(u, p))
    subcats, pages = await _fetch_category_members(FakeClient(), "Category:History")
    assert subcats == ["Category:Sub"]
    assert pages == ["Antikythera mechanism", "Second page"]


# --------------------------------------------------------------------------- #
# LLM pick
# --------------------------------------------------------------------------- #


async def test_llm_pick_success(monkeypatch):
    pick = _TopicPick(title="Antikythera mechanism", summary="Ancient computer", reason="Explore", image_search_query="A")
    monkeypatch.setattr(random_topic, "get_llm_with_fallback", lambda *a, **k: FakeLLM(structured_result=pick))
    result = await _llm_pick("History", [{"title": "Antikythera mechanism", "summary": "s", "pageviews": 1}])
    assert result.title == "Antikythera mechanism"


async def test_llm_pick_none_when_no_llm(monkeypatch):
    monkeypatch.setattr(random_topic, "get_llm_with_fallback", lambda *a, **k: None)
    assert await _llm_pick("History", []) is None


async def test_llm_pick_none_on_error(monkeypatch):
    monkeypatch.setattr(
        random_topic, "get_llm_with_fallback", lambda *a, **k: FakeLLM(structured_raises=RuntimeError("boom"))
    )
    assert await _llm_pick("History", []) is None


# --------------------------------------------------------------------------- #
# pick_random_topic
# --------------------------------------------------------------------------- #


async def test_pick_uses_llm_result(monkeypatch):
    cache = install_sync_cache(monkeypatch, random_topic)
    cache.set("topics:crawl:history", [{"title": "Antikythera mechanism", "summary": "s", "image_search_query": "A", "pageviews": 5}])
    cache.set("topics:seed:history", [])

    async def _pick_llm(*a, **k):
        return _TopicPick(title="Antikythera mechanism", summary="s", reason="r", image_search_query="A", curiosity_score=9)

    monkeypatch.setattr(random_topic, "_llm_pick", _pick_llm)

    res = await pick_random_topic("history")
    assert res.node.title == "Antikythera mechanism"
    assert res.reason == "r"
    assert res.category == "History"


async def test_pick_random_choice_fallback(monkeypatch):
    cache = install_sync_cache(monkeypatch, random_topic)
    cache.set("topics:crawl:history", [{"title": "A topic", "summary": "s", "image_search_query": "A", "pageviews": 1}])
    cache.set("topics:seed:history", [])

    async def _pick_none(*a, **k):
        return None

    monkeypatch.setattr(random_topic, "_llm_pick", _pick_none)

    res = await pick_random_topic("History")
    assert res.node.title == "A topic"
    assert "Random pick" in res.reason


async def test_pick_catalog_source(monkeypatch):
    install_sync_cache(monkeypatch, random_topic)

    async def fake_seed(cat):
        raise AssertionError("seed should not run when catalog has candidates")

    monkeypatch.setattr(random_topic, "_seed_query_pool", fake_seed)
    async def _pick_none(*a, **k):
        return None

    monkeypatch.setattr(random_topic, "_llm_pick", _pick_none)

    # Seed the real catalog.cache_service so get_catalog() (local import inside
    # pick_random_topic) returns candidates.
    from app.services import catalog as catalog_mod

    install_sync_cache(monkeypatch, catalog_mod).set(
        "catalog:index", [{"title": "Catalog topic", "summary": "s", "category": "History", "image_search_query": "A"}]
    )

    res = await pick_random_topic("History")
    assert res.node.title == "Catalog topic"


async def test_pick_seed_query_source(monkeypatch):
    install_sync_cache(monkeypatch, random_topic)

    async def fake_seed(cat):
        return [{"title": "Seed topic", "summary": "s", "image_search_query": "A", "pageviews": 0}]

    monkeypatch.setattr(random_topic, "_seed_query_pool", fake_seed)
    async def _pick_none(*a, **k):
        return None

    monkeypatch.setattr(random_topic, "_llm_pick", _pick_none)

    res = await pick_random_topic("History")
    assert res.node.title == "Seed topic"


async def test_pick_fallback_any_page(monkeypatch):
    install_sync_cache(monkeypatch, random_topic)

    async def fake_seed(cat):
        return []

    async def fake_any():
        return [{"title": "Fallback page", "summary": "s", "image_search_query": "F"}]

    monkeypatch.setattr(random_topic, "_seed_query_pool", fake_seed)
    monkeypatch.setattr(random_topic, "_fallback_any_page", fake_any)
    async def _pick_none(*a, **k):
        return None

    monkeypatch.setattr(random_topic, "_llm_pick", _pick_none)

    res = await pick_random_topic("History")
    assert res.node.title == "Fallback page"


async def test_pick_last_resort_antikythera(monkeypatch):
    install_sync_cache(monkeypatch, random_topic)

    async def fake_seed(cat):
        return []

    async def fake_any():
        return []

    monkeypatch.setattr(random_topic, "_seed_query_pool", fake_seed)
    monkeypatch.setattr(random_topic, "_fallback_any_page", fake_any)
    async def _pick_none(*a, **k):
        return None

    monkeypatch.setattr(random_topic, "_llm_pick", _pick_none)

    res = await pick_random_topic("History")
    assert res.node.title == "The Antikythera Mechanism"
    assert res.node.curiosity_score == 10


# --------------------------------------------------------------------------- #
# _to_node
# --------------------------------------------------------------------------- #


def test_to_node_builds_node():
    node = _to_node({"title": "T", "summary": "S"}, "History")
    assert isinstance(node, NodeSchema)
    assert node.category == "History"
    assert node.wow_fact.startswith("A remarkable turning point")