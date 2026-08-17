import asyncio
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")).rstrip("/")
SUPABASE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_ANON_KEY", os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""))
)

_client_lock = asyncio.Lock()
_shared_client: httpx.AsyncClient | None = None


async def get_shared_client() -> httpx.AsyncClient:
    """Return a process-wide httpx.AsyncClient with connection pooling.

    Supabase REST is hit from several hot paths (catalog merge, hub listing,
    precomputed fetch). Reusing one pooled client keeps the TLS connection
    warm instead of re-handshaking on every call.
    """
    global _shared_client
    if _shared_client is None:
        async with _client_lock:
            if _shared_client is None:
                _shared_client = httpx.AsyncClient(
                    timeout=15.0,
                    headers={"User-Agent": "TDILEARNED/2.0 (backend)"},
                    limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
                )
    return _shared_client


async def aclose_shared_client() -> None:
    """Close the pooled client on application shutdown."""
    global _shared_client
    if _shared_client is not None:
        await _shared_client.aclose()
        _shared_client = None


def is_supabase_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY)


def _get_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def fetch_hubs_from_supabase(limit: int = 2000) -> list[dict[str, Any]]:
    """Query precomputed discovery hubs from Supabase Postgres."""
    if not is_supabase_configured():
        return []

    url = f"{SUPABASE_URL}/rest/v1/precomputed_hubs?select=id,topic,category,summary,image_url&order=created_at.desc&limit={limit}"
    try:
        client = await get_shared_client()
        resp = await client.get(url, headers=_get_headers(), timeout=15.0)
        if resp.status_code == 200:
            rows = resp.json()
            return [
                {
                    "id": row.get("id"),
                    "topic": row.get("topic"),
                    "category": row.get("category"),
                    "summary": row.get("summary"),
                    "imageUrl": row.get("image_url"),
                }
                for row in rows
            ]
        else:
            logger.warning(f"Supabase fetch hubs failed [{resp.status_code}]: {resp.text}")
    except Exception as e:
        logger.warning(f"Failed to query Supabase hubs: {e}")
    return []


async def fetch_hub_by_id_from_supabase(hub_id: str) -> dict[str, Any] | None:
    """Fetch full precomputed hub graph and dossier by ID or topic slug."""
    if not is_supabase_configured():
        return None

    # Query by ID or topic match
    url = f"{SUPABASE_URL}/rest/v1/precomputed_hubs?or=(id.eq.{hub_id},topic.ilike.{hub_id})&limit=1"
    try:
        client = await get_shared_client()
        resp = await client.get(url, headers=_get_headers(), timeout=15.0)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                row = data[0]
                return {
                    "id": row.get("id"),
                    "topic": row.get("topic"),
                    "category": row.get("category"),
                    "root": row.get("root_node"),
                    "children": row.get("children", []),
                    "dossier": row.get("dossier"),
                }
    except Exception as e:
        logger.warning(f"Failed to fetch hub '{hub_id}' from Supabase: {e}")
    return None


async def upsert_hubs_batch(hubs_data: list[dict[str, Any]]) -> int:
    """Batch upsert multiple precomputed hubs into Supabase Postgres database."""
    if not is_supabase_configured() or not hubs_data:
        return 0

    url = f"{SUPABASE_URL}/rest/v1/precomputed_hubs"
    headers = _get_headers()
    headers["Prefer"] = "resolution=merge-duplicates,return=minimal"

    CHUNK_SIZE = 50
    success_count = 0

    client = await get_shared_client()
    for i in range(0, len(hubs_data), CHUNK_SIZE):
        chunk = hubs_data[i : i + CHUNK_SIZE]
        try:
            resp = await client.post(url, headers=headers, json=chunk, timeout=60.0)
            if resp.status_code in (200, 201, 204):
                success_count += len(chunk)
                logger.info(
                    f"Upserted chunk {i // CHUNK_SIZE + 1}/{(len(hubs_data) - 1) // CHUNK_SIZE + 1} ({len(chunk)} hubs)"
                )
            else:
                logger.error(f"Supabase chunk upsert failed [{resp.status_code}]: {resp.text[:200]}")
        except Exception as e:
            logger.error(f"Exception during Supabase batch upsert: {e}")

    return success_count
