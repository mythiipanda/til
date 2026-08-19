"""Supabase REST layer tests (mocked HTTP)."""

import pytest
from conftest import FakeResponse, patch_shared_client

from app import services
from app.services import supabase
from app.services.supabase import (
    fetch_hub_by_id_from_supabase,
    fetch_hubs_from_supabase,
    get_shared_client,
    is_supabase_configured,
    upsert_hubs_batch,
)

# Bypass `is_supabase_configured()` early returns so the HTTP paths run.
_FAKE_URL = "https://fake.supabase.co"
_FAKE_KEY = "fake-key"


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setattr(supabase, "SUPABASE_URL", _FAKE_URL)
    monkeypatch.setattr(supabase, "SUPABASE_KEY", _FAKE_KEY)


def _handler(status, json_data=None):
    def handler(url, params, json=None):
        return FakeResponse(status, json_data)

    return handler


async def test_is_supabase_configured_false(monkeypatch):
    monkeypatch.setattr(supabase, "SUPABASE_URL", "")
    monkeypatch.setattr(supabase, "SUPABASE_KEY", "")
    assert is_supabase_configured() is False


async def test_is_supabase_configured_true():
    assert is_supabase_configured() is True


async def test_fetch_hubs_success(monkeypatch):
    rows = [
        {"id": "1", "topic": "Antikythera", "category": "History", "summary": "s", "image_url": "https://img"},
    ]
    patch_shared_client(monkeypatch, supabase, _handler(200, rows))
    result = await fetch_hubs_from_supabase(limit=10)
    assert result == [
        {
            "id": "1",
            "topic": "Antikythera",
            "category": "History",
            "summary": "s",
            "imageUrl": "https://img",
        }
    ]


async def test_fetch_hubs_non_200(monkeypatch):
    patch_shared_client(monkeypatch, supabase, _handler(500))
    assert await fetch_hubs_from_supabase() == []


async def test_fetch_hubs_exception(monkeypatch):
    def boom(url, params, json=None):
        raise RuntimeError("network down")

    patch_shared_client(monkeypatch, supabase, boom)
    assert await fetch_hubs_from_supabase() == []


async def test_fetch_hub_by_id(monkeypatch):
    row = {
        "id": "h1",
        "topic": "T",
        "category": "Science",
        "root_node": {"id": "r", "title": "R", "summary": "S"},
        "children": [],
        "dossier": {"nodeId": "r"},
    }
    patch_shared_client(monkeypatch, supabase, _handler(200, [row]))
    result = await fetch_hub_by_id_from_supabase("h1")
    assert result["id"] == "h1"
    assert result["root"]["title"] == "R"


async def test_fetch_hub_by_id_missing(monkeypatch):
    patch_shared_client(monkeypatch, supabase, _handler(200, []))
    assert await fetch_hub_by_id_from_supabase("nope") is None


async def test_fetch_hub_by_id_exception(monkeypatch):
    def boom(url, params, json=None):
        raise RuntimeError("down")

    patch_shared_client(monkeypatch, supabase, boom)
    assert await fetch_hub_by_id_from_supabase("h1") is None


async def test_upsert_hubs_empty():
    assert await upsert_hubs_batch([]) == 0


async def test_upsert_hubs_batch_chunked(monkeypatch):
    hubs = [{"id": f"h{i}", "topic": f"T{i}"} for i in range(60)]  # 2 chunks of 50
    client = patch_shared_client(monkeypatch, supabase, _handler(200, []))
    count = await upsert_hubs_batch(hubs)
    assert count == 60
    assert len(client.requests) == 2


async def test_upsert_hubs_non_2xx_counts_zero(monkeypatch):
    hubs = [{"id": "h1", "topic": "T"}]
    patch_shared_client(monkeypatch, supabase, _handler(500))
    assert await upsert_hubs_batch(hubs) == 0


async def test_shared_client_reused_and_closed(monkeypatch):
    a = await get_shared_client()
    b = await get_shared_client()
    assert a is b
    await supabase.aclose_shared_client()
    assert await get_shared_client() is not a


async def test_unconfigured_returns_empty(monkeypatch):
    monkeypatch.setattr(supabase, "SUPABASE_URL", "")
    monkeypatch.setattr(supabase, "SUPABASE_KEY", "")
    assert await fetch_hubs_from_supabase() == []
    assert await fetch_hub_by_id_from_supabase("x") is None


def test_services_module_importable():
    assert hasattr(services, "cache")