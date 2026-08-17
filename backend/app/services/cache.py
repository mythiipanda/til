import json
import logging
import os
import tempfile
import threading
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_CACHE_DIR = os.getenv("CACHE_DIR", str(Path(__file__).resolve().parent.parent / ".cache"))
DISK_TTL_FLOOR = 60  # don't bother persisting entries with TTL under 60s
PERSIST_THROTTLE_SECONDS = float(os.getenv("CACHE_PERSIST_THROTTLE_SECONDS", "5"))


class CacheService:
    """Two-tier cache: disk JSON (fallback) → memory.

    Used to deduplicate expensive work (deep category crawls, LLM seed-query
    pools, live signal pools) so repeated calls within the TTL window hit the
    cache instead of re-querying upstream APIs.

    The disk tier keeps these expensive pools alive across process restarts —
    critical for production cold starts.

    Persistence is throttled (at most one write every PERSIST_THROTTLE_SECONDS),
    performed on a background thread, and written atomically (temp file + rename)
    so a crash can never truncate the cache file or block the event loop.
    """

    def __init__(self):
        self._memory_cache: dict[str, tuple[float, dict[str, Any] | list[Any]]] = {}
        self._disk_path = Path(DEFAULT_CACHE_DIR) / "cache.json"
        self._lock = threading.Lock()
        self._last_persist = 0.0
        self._load_disk()

    # ------------------------------------------------------------------ #
    # Disk persistence
    # ------------------------------------------------------------------ #

    def _load_disk(self):
        if not self._disk_path.exists():
            return
        try:
            payload = json.loads(self._disk_path.read_text(encoding="utf-8"))
            now = time.time()
            loaded = 0
            with self._lock:
                for key, entry in payload.items():
                    expires = entry.get("expires", 0)
                    if expires > now:
                        self._memory_cache[key] = (expires, entry["value"])
                        loaded += 1
            logger.info(f"Loaded {loaded} entries from disk cache")
        except Exception as e:
            logger.warning(f"Failed to load disk cache ({e})")

    def _persist(self):
        try:
            self._disk_path.parent.mkdir(parents=True, exist_ok=True)
            now = time.time()
            with self._lock:
                payload = {
                    key: {"expires": expires, "value": value}
                    for key, (expires, value) in self._memory_cache.items()
                    if expires > now
                }
            serialized = json.dumps(payload, ensure_ascii=False)
            fd, tmp_path = tempfile.mkstemp(dir=str(self._disk_path.parent), suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    f.write(serialized)
                os.replace(tmp_path, self._disk_path)
            except Exception:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                raise
        except Exception as e:
            logger.warning(f"Failed to persist disk cache ({e})")

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def get(self, key: str) -> dict[str, Any] | list[Any] | None:
        normalized_key = key.lower().strip()
        now = time.time()
        with self._lock:
            entry = self._memory_cache.get(normalized_key)
            if entry:
                expires, value = entry
                if expires > now:
                    return value
                self._memory_cache.pop(normalized_key, None)
        return None

    def set(self, key: str, value: dict[str, Any] | list[Any], ttl_seconds: int = 86400):
        normalized_key = key.lower().strip()
        expires = time.time() + ttl_seconds
        with self._lock:
            self._memory_cache[normalized_key] = (expires, value)

        if ttl_seconds >= DISK_TTL_FLOOR and time.time() - self._last_persist >= PERSIST_THROTTLE_SECONDS:
            self._last_persist = time.time()
            threading.Thread(target=self._persist, daemon=True).start()

    def flush(self):
        """Persist immediately (best-effort), used on shutdown."""
        self._persist()


cache_service = CacheService()
