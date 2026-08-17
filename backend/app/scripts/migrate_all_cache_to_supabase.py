"""
Migration Script: Migrate all 876+ precomputed hubs and dossiers from disk cache into Supabase Postgres.
"""

import asyncio
import json
import logging
import os
import sys
from dotenv import load_dotenv

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

load_dotenv()

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.services.supabase import is_supabase_configured, upsert_hubs_batch

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

CACHE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".cache", "cache.json")


def load_cache() -> dict:
    if not os.path.exists(CACHE_PATH):
        logger.error(f"Cache file not found at: {CACHE_PATH}")
        return {}
    with open(CACHE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


async def main():
    if not is_supabase_configured():
        logger.error("Supabase URL or key not configured in environment (.env).")
        return

    logger.info(f"Loading disk cache from {CACHE_PATH}...")
    cache_data = load_cache()
    if not cache_data:
        logger.error("No data found in cache.json.")
        return

    # 1. Index all dossiers by nodeId
    dossiers_by_node_id = {}
    for k, v in cache_data.items():
        if k.startswith("dossier:"):
            node_id = k.replace("dossier:", "").strip()
            dossiers_by_node_id[node_id] = v.get("value")

    logger.info(f"Found {len(dossiers_by_node_id)} detailed dossiers in cache.")

    # 2. Extract all precomputed hubs
    hubs_to_migrate = []
    seen_topics = set()

    for k, v in cache_data.items():
        if k.startswith("precomputed:hub:"):
            hub_val = v.get("value")
            if not isinstance(hub_val, dict):
                continue

            hub_id = hub_val.get("id") or k.replace("precomputed:hub:", "").strip()
            topic = hub_val.get("topic") or "Unknown Topic"
            topic_clean = topic.strip().lower()

            if topic_clean in seen_topics:
                continue
            seen_topics.add(topic_clean)

            category = hub_val.get("category") or "General"
            root_node = hub_val.get("root") or {}
            children = hub_val.get("children") or []
            root_node_id = root_node.get("id") if isinstance(root_node, dict) else None

            # Retrieve matched dossier
            matched_dossier = dossiers_by_node_id.get(root_node_id) if root_node_id else None

            summary = root_node.get("summary", "") if isinstance(root_node, dict) else ""
            image_url = root_node.get("imageUrl") if isinstance(root_node, dict) else None
            curiosity_score = root_node.get("curiosity_score") if isinstance(root_node, dict) else 8

            hubs_to_migrate.append({
                "id": hub_id,
                "topic": topic,
                "category": category,
                "summary": summary[:300] if summary else f"Exploration into {topic}",
                "image_url": image_url,
                "root_node": root_node,
                "children": children,
                "dossier": matched_dossier or {},
                "curiosity_score": curiosity_score or 8,
            })

    logger.info(f"Extracted {len(hubs_to_migrate)} unique precomputed hubs to migrate to Supabase Postgres!")

    # 3. Batch upsert into Supabase in chunks of 50
    logger.info("Starting batch migration to Supabase cloud database...")
    upserted_count = await upsert_hubs_batch(hubs_to_migrate)

    logger.info("=" * 70)
    logger.info(f"✔ MIGRATION SUCCESSFUL: {upserted_count}/{len(hubs_to_migrate)} hubs migrated to Supabase Postgres!")
    logger.info("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
