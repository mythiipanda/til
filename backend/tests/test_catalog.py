"""Catalog build + merge logic tests."""

import pytest
from conftest import install_sync_cache

from app.services import catalog
from app.services.catalog import _entry, _merge_hubs, build_catalog, get_catalog


@pytest.fixture(autouse=True)
def _cache(monkeypatch):
    return install_sync_cache(monkeypatch, catalog)


def test_entry_builds_shape():
    e = _entry({"title": "Antikythera mechanism", "summary": "x" * 500, "image_search_query": "Antikythera"}, "History")
    assert e["title"] == "Antikythera mechanism"
    assert len(e["summary"]) == 280
    assert e["pageviews"] == 0
    assert e["precomputed"] is False


def test_entry_falls_back_to_title_as_image_query():
    e = _entry({"title": "Black-Scholes", "pageviews": "123"}, "Mathematics")
    assert e["image_search_query"] == "Black-Scholes"
    assert e["pageviews"] == 123


def test_get_catalog_empty_by_default():
    assert get_catalog() == []


def test_merge_hubs_returns_catalog_when_no_index():
    catalog_in = [{"title": "A", "summary": "s", "category": "C"}]
    assert _merge_hubs(catalog_in) == catalog_in


def test_merge_hubs_appends_new_hub(monkeypatch):
    cache = install_sync_cache(monkeypatch, catalog)
    cache.set("precomputed:index", [{"topic": "The Antikythera Mechanism", "summary": "s", "category": "History"}])
    merged = _merge_hubs([{"title": "A", "summary": "s", "category": "C"}])
    assert len(merged) == 2
    hub_entry = merged[1]
    assert hub_entry["precomputed"] is True
    assert hub_entry["image_search_query"] == "The Antikythera Mechanism"


def test_merge_hubs_dedupes_by_existing_title(monkeypatch):
    cache = install_sync_cache(monkeypatch, catalog)
    cache.set("precomputed:index", [{"topic": "Antikythera mechanism", "summary": "s", "category": "History"}])
    merged = _merge_hubs([{"title": "Antikythera mechanism", "summary": "s", "category": "C"}])
    assert len(merged) == 1


async def test_build_catalog_dedupes_and_merges(monkeypatch):
    async def fake_pool(cat):
        if cat == "History":
            return [
                {"title": "A", "summary": "s1", "pageviews": 5},
                {"title": "A", "summary": "dup", "pageviews": 5},
            ]
        return [{"title": "B", "summary": "s2", "pageviews": 50}]

    monkeypatch.setattr(catalog, "_catalog_pool", fake_pool)
    monkeypatch.setattr(catalog, "CATEGORY_WIKI_MAP", {"History": "History", "Science": "Science"})

    cache = install_sync_cache(monkeypatch, catalog)
    cache.set("precomputed:index", [{"topic": "C", "summary": "s", "category": "Science"}])

    result = await build_catalog(min_size=0)
    titles = [e["title"] for e in result]
    assert titles == ["B", "A", "C"]  # sorted by pageviews desc, then hubs appended
    assert result[0]["precomputed"] is False
    assert result[-1]["precomputed"] is True


async def test_build_catalog_handles_failed_pool(monkeypatch):
    async def failing_pool(cat):
        raise RuntimeError("crawl failed")

    monkeypatch.setattr(catalog, "_catalog_pool", failing_pool)
    monkeypatch.setattr(catalog, "CATEGORY_WIKI_MAP", {"History": "History"})
    result = await build_catalog(min_size=0)
    assert result == []