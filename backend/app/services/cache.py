import json
import logging
import os
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_CACHE_DIR = os.getenv("CACHE_DIR", str(Path(__file__).resolve().parent.parent / ".cache"))
DISK_TTL_FLOOR = 60  # don't bother persisting entries with TTL under 60s


class CacheService:
    """Multi-tier cache: Azure Redis (when configured) → disk JSON (fallback) → memory.

    Used to deduplicate expensive work (deep category crawls, LLM seed-query
    pools, live signal pools) so repeated calls within the TTL window hit the
    cache instead of re-querying upstream APIs.

    The disk tier keeps these expensive pools alive across process restarts even
    when no Redis is configured — critical for production cold starts.
    """

    def __init__(self):
        self._memory_cache: dict[str, tuple[float, dict[str, Any] | list[Any]]] = {}
        self._redis_client = None
        self._disk_path = Path(DEFAULT_CACHE_DIR) / "cache.json"
        self._init_redis()
        self._load_disk()

    def _init_redis(self):
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                import redis

                self._redis_client = redis.from_url(redis_url, decode_responses=True)
                logger.info("Connected to Redis cache")
            except Exception as e:
                logger.warning(f"Failed to connect to Redis ({e}), using disk/memory fallback")
                self._redis_client = None

    # ------------------------------------------------------------------ #
    # Disk persistence
    # ------------------------------------------------------------------ #

    def _load_disk(self):
        if not self._disk_path.exists():
            return
        try:
            payload = json.loads(self._disk_path.read_text(encoding="utf-8"))
            now = time.time()
            for key, entry in payload.items():
                expires = entry.get("expires", 0)
                if expires > now:
                    self._memory_cache[key] = (expires, entry["value"])
            logger.info(f"Loaded {len(self._memory_cache)} entries from disk cache")
        except Exception as e:
            logger.warning(f"Failed to load disk cache ({e})")

    def _persist(self):
        try:
            self._disk_path.parent.mkdir(parents=True, exist_ok=True)
            now = time.time()
            payload = {
                key: {"expires": expires, "value": value}
                for key, (expires, value) in self._memory_cache.items()
                if expires > now
            }
            self._disk_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        except Exception as e:
            logger.warning(f"Failed to persist disk cache ({e})")

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def get(self, key: str) -> dict[str, Any] | list[Any] | None:
        normalized_key = key.lower().strip()

        # 1. Redis
        if self._redis_client:
            try:
                val = self._redis_client.get(normalized_key)
                if val:
                    return json.loads(val)
            except Exception as e:
                logger.error(f"Redis get error: {e}")

        # 2. Memory + disk (expiry-checked)
        entry = self._memory_cache.get(normalized_key)
        if entry:
            expires, value = entry
            if expires > time.time():
                return value
            self._memory_cache.pop(normalized_key, None)

        return None

    def set(self, key: str, value: dict[str, Any] | list[Any], ttl_seconds: int = 86400):
        normalized_key = key.lower().strip()
        expires = time.time() + ttl_seconds
        self._memory_cache[normalized_key] = (expires, value)

        if self._redis_client:
            try:
                self._redis_client.setex(normalized_key, ttl_seconds, json.dumps(value))
            except Exception as e:
                logger.error(f"Redis set error: {e}")

        if ttl_seconds >= DISK_TTL_FLOOR:
            self._persist()


cache_service = CacheService()
