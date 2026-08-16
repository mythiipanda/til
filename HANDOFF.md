# TILEARNED — Handoff, Plans & Context

> Full context for a fresh agent continuing this project on a new machine.
> Read this first, then `README.md` for architecture, then `AGENTS.md` for agent rules.

---

## 1. The Product Vision

**An agentic, infinite-canvas discovery engine.** It's "random Wikipedia, but alive and
agentic" — the user picks a category, gets a curiosity-ranked random topic, then
**watches a swarm of AI sub-agents research it live**: real web retrieval, grounded
sources, a full dossier, map coordinates, images, and rabbit-hole sub-topics — all
streaming onto a spatial React Flow canvas in real time. Follow-up questions get answered
by a lightweight ReAct agent with real citations. Plus: **hundreds of topics pre-researched
offline**, so the user can instantly browse "already-explored" hubs like an AI Wikipedia
before diving deeper.

The key product insight: **the research itself is the entertainment.** The UI should be
designed so watching the swarm work feels alive (Manus-style thinking traces, live tool
calls, sources appearing in real time).

Branding: **TDILEARNED**

---

## 2. Current Architecture (VERIFIED WORKING)

```
Browser / Next.js canvas (React Flow + Zustand store)   ← FRONTEND IS STUBBED/JUNK
   │  GET /api/v1/research/stream   (SSE, live research)
   │  GET /api/v1/chat/stream       (SSE, follow-up Q&A)
   │  GET /api/v1/graph/precomputed (list 800+ ready hubs)
   │  GET /api/v1/graph/catalog     (2000+ real Wikipedia topics)
   ▼
FastAPI backend (backend/)
   ├─ research_graph.py    LangGraph map-reduce swarm (engine-configurable)
   │    Planner → Send()×N parallel Researchers → Aggregator
   │    → Reference Extractor → Synthesizer → Spatial Enricher
   ├─ research_agent.py    SSE adapter draining graph event queue
   ├─ chat_agent.py        ReAct follow-up loop (bounded 2-round)
   ├─ random_topic.py      Curiosity-ranked topic picker + deep crawl pools
   ├─ catalog.py           2000+ topic catalog from deep-crawl harvest
   ├─ precompute.py        Offline bulk hub precompute (concurrent, crash-safe)
   ├─ tools.py             Retrieval ladder + media/geo tools
   ├─ llm.py               Model-agnostic get_llm() factory + concurrency guard
   ├─ cache.py             Redis → disk JSON → in-memory multi-tier cache
   ├─ api/endpoints.py     The 5 live routes + precomputed/catalog
   └─ api/viewer.py        Mockup HTML viewer (backend-served, test-only)
```

### Engine routing (user-corrected, non-negotiable)
- **Cerebras = live** interactive research (`/research/stream`), follow-up chat
  (`/chat/stream`), and the random-topic picker.
- **Mistral = offline batch precompute** (`PRECOMPUTE_ENGINE` env, default `"mistral"`).
  `MISTRAL_API_KEY` is set in both `.env` and `.env.local`. `REDIS_URL` is NOT set →
  cache falls back to disk JSON.

### The retrieval ladder (`tools.py::search_web_ladder`)
Tavily (keyed, best) → DuckDuckGo (`ddgs`, keyless) → Wikipedia (keyless floor).
Results are deduped by URL, lexically relevance-filtered, and reliability-sorted
(Wikipedia 0.96 > Tavily 0.85 > DDG 0.75). **No fabricated URLs — every source is real.**

### Anti-hallucination rules (non-negotiable)
- Findings must be extracted from **fetched page content** with verbatim quotes.
- Every source URL comes from an actual retrieval result.
- Synthesizer writes the dossier **strictly from grounded evidence blocks**.
- Chat agent answers **only from SOURCE blocks**, never from imagination.

### API endpoints (`/api/v1`)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Engine info + version |
| GET | `/graph/random-topic?category=` | Live Wikipedia sample → Cerebras rerank → one topic + reason |
| GET | `/graph/catalog?limit=` | 2000+ real Wikipedia topics; precomputed hubs surfaced first |
| GET | `/graph/precomputed` | List of all fully-researched hubs (summaries) |
| GET | `/graph/precomputed/{hub_id}` | Full hub: root NodeSchema + child branches |
| GET | `/research/stream?topic=&category=&parent_id=` | SSE map-reduce graph |
| GET | `/research/dossier/{node_id}` | Dossier from cache (persisted with each hub) |
| GET | `/chat/stream?node_title=&question=&ancestors=` | SSE ReAct follow-up |

### Mockup HTML viewer (backend-served, for testing only)
- `GET /view` — hub index, searchable + filterable by category.
- `GET /view/{hub_id}` — full article-style page: dossier (tagline/abstract/core thesis/
  timeline/mechanisms/gallery/geography/sources/rabbit holes) + child branches + **live
  follow-up Q&A box** (streams `/chat/stream`) + **deep-research button** (streams
  `/research/stream`). All client-side JS consuming SSE. Not the real product UI — the
  real frontend will be redesigned from scratch.

### SSE event contract
`plan`, `thought`, `tool_call`, `tool_result`, `source`, `node_stream`, `dossier`,
`answer_start`, `token`, `done`, `error`. Each is a `data: {"event": "...", "data": {...}}` line.

---

## 3. Current State — What's DONE & VERIFIED

### Topic picker (rewritten)
- **Deep Wikipedia crawl** → per-category pools of 200 real article titles
  (`CRAWL_MAX_SUBCATS_PER_LEVEL=24`, `CRAWL_CONCURRENCY=3`).
- **429-safe crawling**: `_rate_limited_get` (exponential backoff, 4 retries on 429/5xx).
- **LLM seed queries** (`_llm_seed_queries`) generate probing Wikipedia search terms per
  category, so the crawl finds *interesting* subcategories, not just popular ones.
- **Pageviews ranking** (`_batch_extracts` + Wikimedia pageviews API with 7-day walk-back)
  surfaces high-interest candidates.
- **Live signal pool** (`signals:pool:{cat}`) merges Google News / On-This-Day / Reddit /
  HN / Wikipedia trending, time-boxed (`SIGNAL_FETCH_TIMEOUT=4.0`) with stale-cache fallback.
- Verified quality picks (vs old junk like "Biography" / "Criticism of technology"):
  "The Dead Sea Scrolls' Secret Dates", "The Medieval Dancing Plague", "Galileo's Clash
  With the Cosmos", "The Mystery of Easter Island", "The 142nd Meridian's Global Journey".

### Catalog (2000+ real topics)
- `catalog.py::build_catalog` deep-crawls all 21 categories and merges pools + hubs into
  `catalog:index` (2115 entries; 876 flagged `precomputed`, surfaced first).
- Endpoint `/graph/catalog` returns them pageview-sorted; CLI command `catalog`.

### Precompute pipeline (876 hubs on disk)
- `precompute.py` runs the map-reduce graph headlessly on Mistral, captures
  root node + child branches + dossier, persists each as a hub.
- **`precompute_topic(topic, category)`** — research a specific topic directly (used by
  bulk runs, bypasses the slow picker).
- **`precompute_bulk(count, concurrency)`** — sources topics round-robin from catalog
  pools (highest-pageview first), dedupes vs existing hubs, runs concurrently on Mistral,
  persists each hub + dossier + index entry **incrementally (crash-safe)** — partial runs
  survive interruption.
- **876 pre-researched hubs cached locally** (disk ~14 MB) as of the last bulk run
  (two runs: 60 + 420 + a partial third run of ~370 before being aborted).
  Per-category spread varies (Politics 88 … Nature 1). More remain in the pools
  (~1600 topics) — rerun `bulk_precompute.py` to grow the library.
- **Bulk runner**: `python -m app.scripts.bulk_precompute [count]` — sets
  `MAX_CONCURRENT_LLM_CALLS=6`, `PRECOMPUTE_CONCURRENCY=4`. Throughput ≈19s/hub.
  CLI: `precompute [count|cats]`.
- Hub cache keys: `precomputed:hub:{id}`, `dossier:{root_node_id}`, `precomputed:index`
  (30d TTL); catalog `catalog:index`.

### Cache (disk-backed fallback)
- `cache.py` tiers: Redis (when `REDIS_URL` set) → disk JSON (`backend/app/.cache/
  cache.json`, gitignored) → memory. Verified to survive restarts.

### Engine-configurable research graph
- `research_graph.py::_llm(config,...)` reads `llm_engine` from config; all 4 graph LLM
  calls are engine-aware; `run_research_graph(..., engine="cerebras")` default.
- Mistral structured output verified live.

### Other working pieces
- Full map-reduce graph end-to-end (real live research, 3–5 parallel angles, dossier +
  nodes with images, zero fabricated URLs).
- Follow-up chat grounded + cited (2-round ReAct, forced final answer).
- Images via `wikipedia_page_images()` + Commons File-namespace (`gsrnamespace=6`),
  `utm_*` stripped.
- Interactive CLI (`agent_cli.py`): `pick / research / ask / sources / nodes / dossier /
  cats / precompute / catalog / quit`.
- Quality gates pass: `ruff check app`, `mypy app`, `ruff format --check app`.

---

## 4. Known Issues / Open Concerns

1. **Frontend is JUNK and will be redesigned from scratch.** `useMindMapStore.ts`,
   `PromptBar.tsx`, `mockData.ts` still use mocks/hardcoded topics. The user has told us
   to ignore the current frontend — **Antigravity will plan/design the real web UI** using
   https://www.beautifului.dev/ as the styling reference (mandated in AGENTS.md).
2. **Cerebras 429s under true concurrency** — mitigated by the global semaphore
   (`MAX_CONCURRENT_LLM_CALLS`, default 2) + `max_retries`. Live load is fine; batch uses
   Mistral anyway.
3. **Mistral synthesizer length-limit** hit once mid-bulk (`completion_tokens=2500`);
   the graph recovered (retry fallback). Rare, non-fatal.
4. **`signal_collector.py` still uses raw `ChatOpenAI`** instead of the `get_llm()` factory
   (pre-dates the factory). Low risk; migrate for consistency.
5. **No tests** — no pytest suite, no Playwright E2E. AGENTS.md benchmarks (300ms node
   expansion, <120ms TTFT) are aspirational targets, not measured.
6. **`.env`/`.env.local` are gitignored** (correct). A new machine must recreate them from
   `.env.example`. `REDIS_URL` intentionally unset (disk cache fallback works).

---

## 5. Roadmap (in agreed order)

### Phase A — Backend production hardening ✅ (done)
Deep crawl, 429-safe crawling, LLM seed queries, pageviews ranking, signal pool,
dossier persistence, disk cache fallback, engine routing.

### Phase B — Precompute pipeline ✅ (mostly done, can grow)
- ✅ 876 hubs pre-researched and cached (bulk runner + crash-safe incremental index).
- ⬜ Rerun `bulk_precompute.py` to grow toward ~2000 hubs from remaining catalog pools.
- ⬜ Redis caching is unused (no `REDIS_URL`); disk cache is sufficient locally.

### Phase C — Frontend (NEXT — Antigravity will plan/design)
- **Design pass first** using BeautifulUI primitives; the current React Flow/Zustand
  store can be replaced wholesale ("do not preserve backward compatibility").
- Landing: category tiles → random-topic card with reason → dive in.
- Live research spectacle: thinking traces, tool chips, source rail, node streams onto
  spatial canvas.
- **Pre-researched hub browsing**: `/graph/precomputed` list → instant full canvas from a
  hub (root + branches + dossier). This is the "AI Wikipedia" surface.
- Follow-up chat drawer consuming `/chat/stream`.

### Phase D — Verification
pytest suite + Playwright E2E per AGENTS.md benchmarks.

---

## 6. Design Directives (from user)

- "no hard coding" — topics, fallbacks, content must come from live services/LLMs.
- "Prefer established, well-maintained libraries over custom implementations."
- "Do not preserve backward compatibility" — clean breaks are fine.
- "Choose the simplest implementation that fully meets the current requirements."
- Wikipedia must be one of the retrieval sources (it is — keyless floor).
- Cerebras for live inference; Mistral for batch precompute.
- Use UV for Python packages (`uv sync`, `uv run`).
- Frontend styling reference: https://www.beautifului.dev/
- User will have Antigravity plan/design the web interface next.

---

## 7. Setup on a New Machine

```bash
git clone https://github.com/mythiipanda/til.git
cd til
# recreate env files (gitignored — copy from the old machine or fill .env.example):
#   CEREBRAS_API_KEY, CEREBRAS_MODEL, MISTRAL_API_KEY, MISTRAL_MODEL,
#   TAVILY_API_KEY, REDIS_URL, NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_CF_PROXY_URL

# Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal) — current UI is stub/junk; will be redesigned
npm install
npm run dev

# Or the one-command launcher
.\start-dev.ps1

# Interactive agent CLI (drives agents without the UI)
cd backend
.venv/Scripts/python.exe app/scripts/agent_cli.py

# Bulk precompute more hubs (crash-safe; ~19s/hub on Mistral)
cd backend
.venv/Scripts/python.exe app/scripts/bulk_precompute.py 500

# Mockup hub viewer (backend-served test UI)
# http://127.0.0.1:8000/view
```

### Verification commands (quality gates)
```bash
cd backend
uv run ruff check app
uv run ruff format --check app
uv run mypy app
# frontend
npx tsc --noEmit
```

---

## 8. Gotchas & Hard-Won Lessons

- **ChatOpenAI `api_key` must be `SecretStr`**; use `max_completion_tokens` not
  `max_tokens` (mypy + newer SDK reject `max_tokens`).
- **Wikimedia Commons search needs `gsrnamespace=6`** (File namespace) — default (0)
  returns nothing useful for images.
- **Page images beat Commons keyword search** for relevance — resolve the topic to its
  Wikipedia article first, pull `prop=images` → `imageinfo`, top up with Commons.
- **Strip `utm_*` params** from media URLs (`thumb_url.split("?")[0]`).
- **Cerebras queues concurrent requests** → returns 429 `queue_exceeded`. The semaphore
  in `llm.py` caps in-flight calls (2 by default; raise via `MAX_CONCURRENT_LLM_CALLS`).
- **FastAPI `load_dotenv()` walks up** from `main.py` to the project root, so the root
  `.env` is picked up automatically. Test scripts must `load_dotenv()` explicitly.
- **Windows console is cp1252** — any script printing Unicode needs
  `sys.stdout.reconfigure(encoding="utf-8")` (see `agent_cli.py`).
- **LangChain `with_structured_output` + `.ainvoke`** is the reliable way to get
  validated JSON from the models; override `angle_id` programmatically after extraction.
- **The chat agent's model hedges** — force a committed answer on the final round
  ("You MUST now answer"), feed search snippets into evidence, cap rounds at 2.
- **Wikipedia 429 throttling** on deep crawls — use `_rate_limited_get` (backoff retries)
  and a bounded crawl semaphore; reduce `CRAWL_MAX_SUBCATS_PER_LEVEL` if retries exhaust.
- **Bulk precompute topics come from catalog pools** (real Wikipedia titles) — hub `topic`
  is the real title while `root.title` is the creative dossier hook title. Exact-title
  dedup between hubs and catalog does not work.

---

## 9. Files That Matter Most

| Path | Why |
|------|-----|
| `README.md` | Full architecture, SSE contracts, setup |
| `AGENTS.md` | Agent roster, rules, verification benchmarks |
| `backend/app/services/research_graph.py` | The map-reduce LangGraph swarm (engine-aware) |
| `backend/app/services/tools.py` | Retrieval ladder + media/geo tools |
| `backend/app/services/llm.py` | `get_llm()` factory + concurrency guard |
| `backend/app/services/research_agent.py` | SSE adapter + dossier persistence |
| `backend/app/services/chat_agent.py` | ReAct follow-up loop |
| `backend/app/services/random_topic.py` | Curiosity-ranked picker + deep crawl pools |
| `backend/app/services/catalog.py` | 2000+ topic catalog |
| `backend/app/services/precompute.py` | Bulk hub precompute (concurrent, crash-safe) |
| `backend/app/services/cache.py` | Redis → disk JSON → memory cache |
| `backend/app/api/endpoints.py` | All REST/SSE routes |
| `backend/app/api/viewer.py` | Mockup HTML hub viewer (test-only) |
| `backend/app/scripts/agent_cli.py` | Interactive terminal driver |
| `backend/app/scripts/bulk_precompute.py` | Bulk hub precompute runner |
| `backend/app/scripts/capture_journey.py` | Full-journey markdown demo trace |
| `backend/app/scripts/signal_collector.py` | Live trending/on-this-day signals |
| `lib/store/useMindMapStore.ts` | Frontend state (JUNK — to be redesigned) |
| `cloudflare/src/index.ts` | Edge media proxy worker |