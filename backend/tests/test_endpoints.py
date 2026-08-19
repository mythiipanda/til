"""FastAPI endpoint tests via TestClient (services mocked)."""

import json

from fastapi.testclient import TestClient

from app.main import app


def test_health():
    with TestClient(app) as c:
        r = c.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert body["version"]


def test_root():
    with TestClient(app) as c:
        r = c.get("/")
    assert r.status_code == 200
    assert "docs_url" in r.json()


def test_models_endpoint(monkeypatch):
    async def fake_models():
        from app.schemas.graph import ModelCatalogResponse, ModelOptionSchema

        return ModelCatalogResponse(
            default_model="cerebras:gemma-4-31b",
            models=[ModelOptionSchema(id="cerebras:gemma-4-31b", name="Gemma", provider="cerebras", provider_label="Cerebras", model_id="gemma-4-31b")],
        )

    monkeypatch.setattr("app.api.endpoints.get_available_models_async", fake_models)
    with TestClient(app) as c:
        r = c.get("/api/v1/models")
    assert r.status_code == 200
    assert r.json()["default_model"] == "cerebras:gemma-4-31b"


def test_random_topic_endpoint(monkeypatch):
    from app.schemas.graph import NodeSchema, RandomTopicResponse

    async def fake_pick(category):
        return RandomTopicResponse(
            node=NodeSchema(id="n", title="Antikythera", summary="S", category=category),
            reason="r",
            category=category,
        )

    monkeypatch.setattr("app.api.endpoints.pick_random_topic", fake_pick)
    with TestClient(app) as c:
        r = c.get("/api/v1/graph/random-topic?category=History")
    assert r.status_code == 200
    assert r.json()["node"]["title"] == "Antikythera"


def test_catalog_endpoint(monkeypatch):
    monkeypatch.setattr("app.api.endpoints.get_catalog", lambda: [{"title": "A", "summary": "s", "category": "History"}])
    monkeypatch.setattr("app.api.endpoints.is_supabase_configured", lambda: False)
    monkeypatch.setattr("app.api.endpoints.fetch_hubs_from_supabase", lambda limit=2000: [])
    with TestClient(app) as c:
        r = c.get("/api/v1/graph/catalog?limit=10")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["topics"][0]["title"] == "A"


def test_catalog_endpoint_merges_supabase_hubs(monkeypatch):
    monkeypatch.setattr("app.api.endpoints.get_catalog", lambda: [{"title": "A", "summary": "s", "category": "History"}])

    async def fake_fetch(limit=2000):
        return [{"id": "h1", "topic": "Hub Topic", "summary": "s", "category": "Science"}]

    monkeypatch.setattr("app.api.endpoints.is_supabase_configured", lambda: True)
    monkeypatch.setattr("app.api.endpoints.fetch_hubs_from_supabase", fake_fetch)
    with TestClient(app) as c:
        r = c.get("/api/v1/graph/catalog")
    topics = r.json()["topics"]
    assert any(t["title"] == "Hub Topic" and t["precomputed"] for t in topics)


def test_list_precomputed_supabase(monkeypatch):
    async def fake_fetch(limit=2000):
        return [{"id": "h1", "topic": "T", "category": "C", "summary": "s", "imageUrl": "https://i"}]

    monkeypatch.setattr("app.api.endpoints.is_supabase_configured", lambda: True)
    monkeypatch.setattr("app.api.endpoints.fetch_hubs_from_supabase", fake_fetch)
    with TestClient(app) as c:
        r = c.get("/api/v1/graph/precomputed")
    assert r.status_code == 200
    assert r.json()[0]["id"] == "h1"


def test_list_precomputed_cached_fallback(monkeypatch):
    async def fake_fetch(limit=2000):
        return []

    monkeypatch.setattr("app.api.endpoints.is_supabase_configured", lambda: True)
    monkeypatch.setattr("app.api.endpoints.fetch_hubs_from_supabase", fake_fetch)
    monkeypatch.setattr(
        "app.api.endpoints.list_precomputed_hubs",
        lambda: [{"id": "c1", "topic": "Cached", "category": "C", "summary": "s"}],
    )
    with TestClient(app) as c:
        r = c.get("/api/v1/graph/precomputed")
    assert r.json()[0]["id"] == "c1"


def test_get_precomputed_supabase(monkeypatch):
    async def fake_fetch(hub_id):
        return {"id": hub_id, "topic": "T", "category": "C", "root": {"id": "r", "title": "R", "summary": "S"}, "children": [], "dossier": {}}

    monkeypatch.setattr("app.api.endpoints.is_supabase_configured", lambda: True)
    monkeypatch.setattr("app.api.endpoints.fetch_hub_by_id_from_supabase", fake_fetch)
    with TestClient(app) as c:
        r = c.get("/api/v1/graph/precomputed/h1")
    assert r.status_code == 200
    assert r.json()["root"]["title"] == "R"


def test_get_precomputed_not_found(monkeypatch):
    async def fake_fetch(hub_id):
        return None

    monkeypatch.setattr("app.api.endpoints.is_supabase_configured", lambda: True)
    monkeypatch.setattr("app.api.endpoints.fetch_hub_by_id_from_supabase", fake_fetch)
    monkeypatch.setattr("app.api.endpoints.get_precomputed_hub", lambda hub_id: None)
    with TestClient(app) as c:
        r = c.get("/api/v1/graph/precomputed/nope")
    assert r.status_code == 404


def test_get_dossier_endpoint(monkeypatch):
    monkeypatch.setattr("app.api.endpoints.get_dossier", lambda node_id: {"title": "D", "nodeId": node_id})
    with TestClient(app) as c:
        r = c.get("/api/v1/research/dossier/n1")
    assert r.status_code == 200
    assert r.json()["title"] == "D"


def test_get_dossier_not_found(monkeypatch):
    monkeypatch.setattr("app.api.endpoints.get_dossier", lambda node_id: None)
    with TestClient(app) as c:
        r = c.get("/api/v1/research/dossier/nope")
    assert r.status_code == 404


def test_research_stream_endpoint(monkeypatch):
    async def fake_stream(**kwargs):
        yield 'data: {"event": "plan", "data": {"steps": []}}\n\n'
        yield 'data: {"event": "done", "data": {}}\n\n'

    monkeypatch.setattr("app.api.endpoints.stream_deep_research", fake_stream)
    with TestClient(app) as c:
        r = c.get("/api/v1/research/stream?topic=Antikythera")
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    body = r.text
    assert "event" in body and "plan" in body


def test_chat_stream_endpoint(monkeypatch):
    async def fake_chat(**kwargs):
        yield 'data: {"event": "token", "data": {"token": "hello"}}\n\n'
        yield 'data: {"event": "done", "data": {}}\n\n'

    monkeypatch.setattr("app.api.endpoints.stream_chat", fake_chat)
    with TestClient(app) as c:
        r = c.get("/api/v1/chat/stream?node_title=Antikythera&question=How%20does%20it%20work%3F")
    assert r.status_code == 200
    assert "hello" in r.text


def test_chat_stream_parses_history(monkeypatch):
    captured = {}

    async def fake_chat(**kwargs):
        captured.update(kwargs)
        yield 'data: {"event": "done", "data": {}}\n\n'

    monkeypatch.setattr("app.api.endpoints.stream_chat", fake_chat)
    history = json.dumps([{"role": "user", "content": "hi"}, {"role": "assistant", "content": "yo"}])
    with TestClient(app) as c:
        c.get(f"/api/v1/chat/stream?node_title=T&question=Q&ancestors=A,B&history={history}")
    assert captured["ancestor_context"] == ["A", "B"]
    assert captured["history"] == [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "yo"}]


def test_validation_error_on_missing_topic():
    with TestClient(app) as c:
        r = c.get("/api/v1/research/stream")
    assert r.status_code == 422