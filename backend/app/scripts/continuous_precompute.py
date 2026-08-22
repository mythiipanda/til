"""Continuous Hub Precomputation Runner.

Runs an infinite autonomous loop that continuously discovers high-curiosity
Wikipedia topics across all 21 categories, researches them headlessly through
the LangGraph pipeline, and persists each completed hub (root node + 3 child
branches + full monograph dossier) directly into Supabase Postgres and local cache.

Gracefully handles Ctrl+C (SIGINT) so you can stop whenever you want with
zero data loss.

Usage:
  cd backend
  uv run python -m app.scripts.continuous_precompute
  uv run python -m app.scripts.continuous_precompute --topics-file launch_topics.txt

Options:
  --concurrency N   Number of parallel topics to research (default: 4)
  --engine NAME     Inference engine to use: mistral, cerebras, openrouter (default: mistral)
  --category NAME   Target a specific category only (default: all 21 categories)
  --topics-file P   Seed a curated list and exit. One "Topic | Category" pair
                    per line ("|" optional when the category is the default).
                    Idempotent: topics already in Supabase/local cache are skipped.
"""

import argparse
import asyncio
import logging
import os
import signal
import sys
import time

if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Quiet down noisy HTTP libraries
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpx2").setLevel(logging.WARNING)
logging.getLogger("primp").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)
logging.getLogger("app.services.cache").setLevel(logging.WARNING)
logging.getLogger("app.services.llm").setLevel(logging.WARNING)
logging.getLogger("app.services.random_topic").setLevel(logging.WARNING)

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env.local"))
load_dotenv()

from app.services.precompute import list_precomputed_hubs, precompute_topic
from app.services.random_topic import CATEGORY_WIKI_MAP, pick_random_topic
from app.services.supabase import fetch_hubs_from_supabase, is_supabase_configured

logger = logging.getLogger("continuous_precompute")

# Global graceful shutdown flag
SHUTDOWN = False


def _signal_handler(sig, frame):
    global SHUTDOWN
    print("\n\n[!] Interrupt received (Ctrl+C). Finishing active jobs and exiting cleanly...", flush=True)
    SHUTDOWN = True


signal.signal(signal.SIGINT, _signal_handler)
if hasattr(signal, "SIGTERM"):
    signal.signal(signal.SIGTERM, _signal_handler)


async def load_known_topics() -> set[str]:
    """Lowercased topics already persisted in Supabase or the local cache."""
    known: set[str] = set()
    if is_supabase_configured():
        sb_hubs = await fetch_hubs_from_supabase(limit=5000)
        for h in sb_hubs:
            if h.get("topic"):
                known.add(h["topic"].strip().lower())
    for h in list_precomputed_hubs():
        if h.get("topic"):
            known.add(h["topic"].strip().lower())
    return known


def parse_topics_file(path: str) -> list[tuple[str, str]]:
    """Read "Topic | Category" pairs, one per line.

    The "|" separator is optional; a bare line means "pick a sensible default
    category" (History). Blank lines and # comments are ignored. Malformed
    lines are reported but never abort the run.
    """
    entries: list[tuple[str, str]] = []
    with open(path, "r", encoding="utf-8") as fh:
        for lineno, raw in enumerate(fh, start=1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if "|" in line:
                topic, _, category = line.partition("|")
                topic = topic.strip()
                category = category.strip()
            else:
                topic, category = line, "History"
            if not topic:
                print(f"[!] Line {lineno}: missing topic, skipped", flush=True)
                continue
            if category not in CATEGORY_WIKI_MAP:
                print(
                    f"[!] Line {lineno}: unknown category '{category}', using 'History'",
                    flush=True,
                )
                category = "History"
            entries.append((topic, category))
    return entries


async def run_topics_file(args) -> None:
    """Seed a curated topic list, then exit. Per-topic failures are isolated."""
    os.environ["PRECOMPUTE_ENGINE"] = args.engine
    os.environ["MAX_CONCURRENT_LLM_CALLS"] = str(max(6, args.concurrency * 2))

    pairs = parse_topics_file(args.topics_file)
    if not pairs:
        print("[!] No usable topics found in file; nothing to do.", flush=True)
        return

    known_topics = await load_known_topics()

    print("=" * 75, flush=True)
    print(" TDILEARNED — CURATED TOPIC SEEDING", flush=True)
    print(f" Engine: {args.engine} | Concurrency: {args.concurrency}", flush=True)
    print(f" Topics in file: {len(pairs)}", flush=True)
    print("=" * 75, flush=True)

    semaphore = asyncio.Semaphore(args.concurrency)
    start_time = time.time()
    completed = 0
    failed = 0

    async def job(idx: int, topic: str, cat: str):
        nonlocal completed, failed
        if SHUTDOWN:
            return
        async with semaphore:
            if SHUTDOWN:
                return
            t0 = time.time()
            try:
                hub = await precompute_topic(topic, cat)
            except Exception as e:  # one bad topic never kills the batch
                failed += 1
                logger.warning(f'[{idx}] "{topic}" failed: {e}')
                return
            if hub is None:
                failed += 1
                logger.warning(f'[{idx}] "{topic}" returned no hub')
                return
            completed += 1
            known_topics.add(topic.strip().lower())
            elapsed = time.time() - t0
            total_time = time.time() - start_time
            print(
                f' [+] [{completed:4d}] [{cat:14}] "{topic}" '
                f"-> ID: {hub.id} ({len(hub.children)} branches) in {elapsed:.1f}s "
                f"[Elapsed: {total_time / 60:.1f}m]",
                flush=True,
            )

    tasks: set[asyncio.Task] = set()
    for idx, (topic, cat) in enumerate(pairs, start=1):
        if SHUTDOWN:
            break
        if topic.lower() in known_topics:
            print(f' [=] Skipping "{topic}" (already precomputed)', flush=True)
            continue
        task = asyncio.create_task(job(idx, topic, cat))
        tasks.add(task)
        task.add_done_callback(tasks.discard)
        while len([t for t in tasks if not t.done()]) >= args.concurrency and not SHUTDOWN:
            await asyncio.sleep(0.5)

    if tasks:
        print(f"[*] Waiting for {len(tasks)} active jobs to finish...", flush=True)
        await asyncio.gather(*tasks, return_exceptions=True)

    total_time = time.time() - start_time
    final_supabase = len(await fetch_hubs_from_supabase(limit=5000)) if is_supabase_configured() else 0
    print("\n" + "=" * 75, flush=True)
    print(" CURATED SEEDING FINISHED", flush=True)
    print(f" New Hubs Synthesized : {completed}", flush=True)
    print(f" Failures Skipped     : {failed}", flush=True)
    print(f" Total Hubs In Supabase Cloud Now : {final_supabase}", flush=True)
    print(f" Total Running Time   : {total_time / 60:.1f} minutes", flush=True)
    print("=" * 75 + "\n", flush=True)


async def main():
    parser = argparse.ArgumentParser(description="Continuous Precomputation Runner")
    parser.add_argument("--concurrency", type=int, default=4, help="Parallel worker concurrency (default: 4)")
    parser.add_argument("--engine", type=str, default="mistral", help="LLM engine: mistral, cerebras, openrouter")
    parser.add_argument("--category", type=str, default=None, help="Target specific category (optional)")
    parser.add_argument(
        "--topics-file",
        type=str,
        default=None,
        help="Curated seeding mode: seed these topics ('Topic | Category' per line) and exit",
    )
    args = parser.parse_args()

    if args.topics_file:
        await run_topics_file(args)
        return

    os.environ["PRECOMPUTE_ENGINE"] = args.engine
    os.environ["MAX_CONCURRENT_LLM_CALLS"] = str(max(6, args.concurrency * 2))

    categories = (
        [args.category] if args.category and args.category in CATEGORY_WIKI_MAP else list(CATEGORY_WIKI_MAP.keys())
    )

    print("=" * 75, flush=True)
    print(" TDILEARNED — CONTINUOUS PRECOMPUTE ENGINE", flush=True)
    print(f" Engine: {args.engine} | Concurrency: {args.concurrency}", flush=True)
    print(f" Categories: {len(categories)} ({', '.join(categories[:5])}...)", flush=True)
    print(" Press Ctrl+C at any time to stop safely.", flush=True)
    print("=" * 75, flush=True)

    # Initial count
    initial_local = len(list_precomputed_hubs())
    supabase_count = len(await fetch_hubs_from_supabase(limit=5000)) if is_supabase_configured() else 0
    print(f"[*] Initial state -> Supabase hubs: {supabase_count} | Local cache hubs: {initial_local}\n", flush=True)

    # Known existing topic lowercases to prevent duplicate work
    known_topics = await load_known_topics()

    completed_this_session = 0
    start_time = time.time()
    semaphore = asyncio.Semaphore(args.concurrency)
    category_idx = 0

    async def _research_job(topic: str, cat: str):
        nonlocal completed_this_session
        async with semaphore:
            if SHUTDOWN:
                return
            t0 = time.time()
            hub = await precompute_topic(topic, cat)
            if hub:
                completed_this_session += 1
                known_topics.add(topic.lower())
                elapsed = time.time() - t0
                total_time = time.time() - start_time
                print(
                    f' [+] [{completed_this_session:4d}] [{cat:14}] "{topic}" '
                    f"-> ID: {hub.id} ({len(hub.children)} branches) in {elapsed:.1f}s "
                    f"[Elapsed: {total_time / 60:.1f}m]",
                    flush=True,
                )

    active_tasks: set[asyncio.Task] = set()

    while not SHUTDOWN:
        # Pick category round-robin
        cat = categories[category_idx % len(categories)]
        category_idx += 1

        # Pick a fresh topic
        try:
            picked = await pick_random_topic(cat)
            topic_title = picked.node.title.strip()
        except Exception as e:
            logger.warning(f"Error picking candidate in {cat}: {e}")
            await asyncio.sleep(1.0)
            continue

        if topic_title.lower() in known_topics:
            continue

        known_topics.add(topic_title.lower())
        task = asyncio.create_task(_research_job(topic_title, cat))
        active_tasks.add(task)
        task.add_done_callback(active_tasks.discard)

        # Rate control loop: wait if concurrency limit is full
        while len(active_tasks) >= args.concurrency and not SHUTDOWN:
            await asyncio.sleep(0.5)

    # Await remaining active jobs on shutdown
    if active_tasks:
        print(f"[*] Waiting for {len(active_tasks)} active research jobs to finish...", flush=True)
        await asyncio.gather(*active_tasks, return_exceptions=True)

    total_time = time.time() - start_time
    final_supabase = len(await fetch_hubs_from_supabase(limit=5000)) if is_supabase_configured() else 0
    print("\n" + "=" * 75, flush=True)
    print(" PRECOMPUTE RUNNER FINISHED", flush=True)
    print(f" New Hubs Synthesized This Session : {completed_this_session}", flush=True)
    print(f" Total Hubs In Supabase Cloud Now  : {final_supabase}", flush=True)
    print(f" Total Running Time                : {total_time / 60:.1f} minutes", flush=True)
    print("=" * 75 + "\n", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
