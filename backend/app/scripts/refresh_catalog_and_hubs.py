"""
Script to refresh catalog with 2000+ topics across all 21 categories
and precompute top hubs with updated LLM schema (including suggested_questions).
"""

import asyncio
import os
import sys
import time

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env.local"))
load_dotenv()

from app.services.catalog import build_catalog
from app.services.precompute import list_precomputed_hubs
from app.services.random_topic import CATEGORY_WIKI_MAP


async def main():
    print("=== REBUILDING TOPIC CATALOG (2000+ TARGET) ===", flush=True)
    started = time.time()
    
    # 1. Rebuild full catalog across all 21 categories
    catalog = await build_catalog(min_size=2000)
    print(f"✔ Catalog Built: {len(catalog)} topics across {len(CATEGORY_WIKI_MAP)} categories in {time.time() - started:.1f}s", flush=True)

    # 2. Check precomputed hubs status
    existing_hubs = list_precomputed_hubs()
    print(f"Current precomputed hubs count: {len(existing_hubs)}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
