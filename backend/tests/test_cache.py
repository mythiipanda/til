"""CacheService disk + memory tier tests."""

import json
import time

from app.services.cache import CacheService


def _cache(tmp_path):
    service = CacheService()
    service._disk_path = tmp_path / "cache.json"
    service._last_persist = float("inf")  # suppress background throttled writes
    service._memory_cache = {}  # constructor loads the real disk cache; isolate the test
    return service


def test_get_set_roundtrip(tmp_path):
    c = _cache(tmp_path)
    c.set("key:one", {"a": 1})
    assert c.get("KEY:one") == {"a": 1}  # keys normalized (case + whitespace)


def test_get_expired_returns_none(monkeypatch, tmp_path):
    c = _cache(tmp_path)
    now = [1000.0]
    monkeypatch.setattr(time, "time", lambda: now[0])
    c.set("k", {"v": 1}, ttl_seconds=10)
    now[0] = 1011.0
    assert c.get("k") is None
    assert c.get("k") is None  # already pruned


def test_set_short_ttl_does_not_persist_to_disk(monkeypatch, tmp_path):
    c = _cache(tmp_path)
    now = [1000.0]
    monkeypatch.setattr(time, "time", lambda: now[0])
    monkeypatch.setattr(c, "_persist", lambda: (_ for _ in ()).throw(AssertionError("should not persist")))
    c.set("k", {"v": 1}, ttl_seconds=10)  # below DISK_TTL_FLOOR=60
    assert c.get("k") == {"v": 1}


def test_persist_and_reload(tmp_path):
    c = _cache(tmp_path)
    c._last_persist = 0.0
    c.set("k", {"v": [1, 2, 3]}, ttl_seconds=3600)
    c.flush()

    # Reload from disk into a fresh instance
    c2 = _cache(tmp_path)
    c2._load_disk()
    assert c2.get("k") == {"v": [1, 2, 3]}


def test_reload_skips_expired_entries(monkeypatch, tmp_path):
    c = _cache(tmp_path)
    c._last_persist = 0.0
    now = [1000.0]
    monkeypatch.setattr(time, "time", lambda: now[0])
    c.set("fresh", {"v": 1}, ttl_seconds=3600)
    c.set("stale", {"v": 2}, ttl_seconds=10)
    c.flush()

    now[0] = 2000.0
    c2 = _cache(tmp_path)
    c2._load_disk()
    assert c2.get("fresh") == {"v": 1}
    assert c2.get("stale") is None


def test_load_disk_tolerates_corrupt_file(tmp_path, caplog):
    (tmp_path / "cache.json").write_text("{not json", encoding="utf-8")
    c = _cache(tmp_path)
    c._load_disk()  # must not raise
    assert c.get("anything") is None


def test_load_disk_missing_file(tmp_path):
    c = _cache(tmp_path)
    c._load_disk()
    assert c.get("anything") is None


def test_persist_creates_parent_dirs(tmp_path):
    c = CacheService()
    c._disk_path = tmp_path / "nested" / "deep" / "cache.json"
    c._last_persist = 0.0
    c.set("k", {"v": 1}, ttl_seconds=3600)
    c.flush()
    assert c._disk_path.exists()


def test_flush_with_empty_cache_writes_empty_file(tmp_path):
    c = _cache(tmp_path)
    c.flush()
    assert c._disk_path.exists()
    assert json.loads(c._disk_path.read_text(encoding="utf-8")) == {}