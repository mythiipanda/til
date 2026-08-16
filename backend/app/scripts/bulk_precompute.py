"""
Bulk hub precompute runner: research N catalog topics into fully-precomputed
hubs concurrently on Mistral, persisting each hub + dossier + index entry as it
completes (crash-safe). Run:  python -m app.scripts.bulk_precompute [count]
"""

import asyncio
import logging
import os
import sys
import time

os.environ["MAX_CONCURRENT_LLM_CALLS"] = "6"  # batch throughput over latency
os.environ["PRECOMPUTE_CONCURRENCY"] = "4"

if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

logging.basicConfig(level=logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpx2").setLevel(logging.WARNING)
logging.getLogger("primp").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)
logging.getLogger("app.services.precompute").setLevel(logging.INFO)

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env.local"))
load_dotenv()

from app.services.precompute import list_precomputed_hubs, precompute_bulk


async def main():
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 500
    started = time.time()
    print(f"STARTING bulk precompute: {count} hubs target | existing: {len(list_precomputed_hubs())}", flush=True)
    hubs = await precompute_bulk(count=count, concurrency=4)
    total = len(list_precomputed_hubs())
    print(f"\n{'=' * 70}", flush=True)
    print(
        f"BULK DONE: {len(hubs)} new hubs in {time.time() - started:.0f}s ({time.time() - started:.1f} min)", flush=True
    )
    print(f"TOTAL PRE-RESEARCHED HUBS NOW: {total}", flush=True)
    print(f"{'=' * 70}", flush=True)
    for h in hubs[:15]:
        print(f"[{h.category:14}] {h.topic}  ({h.id})", flush=True)
    if len(hubs) > 15:
        print(f"... and {len(hubs) - 15} more", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
