import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


class CacheService:
    """Multi-tier cache: Azure Redis (when configured) with an in-memory fallback.

    Used to deduplicate expensive work (e.g. the live signal-pool fetch in
    random_topic) so repeated calls within the TTL window hit the cache instead
    of re-querying upstream APIs.
    """

    def __init__(self):
        self._memory_cache: dict[str, dict[str, Any] | list[Any]] = {}
        self._redis_client = None
        self._init_redis()

    def _init_redis(self):
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                import redis

                self._redis_client = redis.from_url(redis_url, decode_responses=True)
                logger.info("Connected to Redis cache")
            except Exception as e:
                logger.warning(f"Failed to connect to Redis ({e}), using in-memory fallback")
                self._redis_client = None

    def get(self, key: str) -> dict[str, Any] | list[Any] | None:
        # 1. Check Redis
        if self._redis_client:
            try:
                val = self._redis_client.get(key)
                if val:
                    return json.loads(val)
            except Exception as e:
                logger.error(f"Redis get error: {e}")

        # 2. Check Memory Cache
        normalized_key = key.lower().strip()
        if normalized_key in self._memory_cache:
            return self._memory_cache[normalized_key]

        return None

    def set(self, key: str, value: dict[str, Any] | list[Any], ttl_seconds: int = 86400):
        normalized_key = key.lower().strip()
        self._memory_cache[normalized_key] = value

        if self._redis_client:
            try:
                self._redis_client.setex(normalized_key, ttl_seconds, json.dumps(value))
            except Exception as e:
                logger.error(f"Redis set error: {e}")


cache_service = CacheService()
