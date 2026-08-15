# TILEARNED — Handoff, Plans & Context

> Full context for a fresh agent continuing this project on a new machine.
> Read this first, then `README.md` for architecture, then `AGENTS.md` for agent rules.

---

## 1. The Product Vision

**An agentic, infinite-canvas discovery engine.** It's "random Wikipedia, but alive and
agentic" — a user picks one of 5 pillar categories, gets a curiosity-ranked random topic,
then **watches a swarm of AI sub-agents research it live**: real web retrieval, grounded
sources, a full dossier, map coordinates, images, and rabbit-hole sub-topics — all
streaming onto a spatial React Flow canvas in real time. Follow-up questions get answered
by a lightweight ReAct agent with real citations.

The key product insight: **the research itself is the entertainment.** The UI should be
designed so watching the swarm work feels alive (Manus-style thinking traces, live tool
calls, sources appearing in real time).

Branding: **TDILEARNED**

---

## 2. Current Architecture (VERIFIED WORKING)

```
Browser / Next.js canvas (React Flow + Zustand store)
   │  GET /api/v1/research/stream   (SSE)
   │  GET /api/v1/chat/stream       (SSE)
   ▼
FastAPI backend (backend/)
   ├─ research_graph.py    LangGraph map-reduce swarm
   │    Planner → Send()×N parallel Researchers → Aggregator
   │    → Reference Extractor → Synthesizer → Spatial Enricher
   ├─ research_agent.py    SSE adapter draining graph event queue
   ├─ chat_agent.py        ReAct follow-up loop (bounded 2-round)
   ├─ random_topic.py      Curiosity-ranked topic picker
   ├─ tools.py             Retrieval ladder + media/geo tools
   ├─ llm.py               Model-agnostic get_llm() factory + concurrency guard
   ├─ cache.py             Redis → in-memory multi-tier cache
   └─ api/endpoints.py     The 5 live routes
```

### The retrieval ladder (`tools.py::search_web_ladder`)
Tavily (keyed, best) → DuckDuckGo (`ddgs`, keyless) → Wikipedia (keyless floor).
Results are deduped by URL, lexically relevance-filtered, and reliability-sorted
(Wikipedia 0.96 > Tavily 0.85 > DDG 0.75). **No fabricated URLs — every source is real.**

### Anti-hallucination rules (non-negotiable)
- Findings must be extracted from **fetched page content** with verbatim quotes.
- Every source URL comes from an actual retrieval result.
- Synthesizer writes the dossier **strictly from grounded evidence blocks**.
- Chat agent answers **only from SOURCE blocks**, never from imagination.

### The 5 API endpoints (`/api/v1`)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Engine info + version |
| GET | `/graph/random-topic?category=` | Live Wikipedia sample → Cerebras rerank → one topic + reason |
| GET | `/research/stream?topic=&category=&parent_id=` | SSE map-reduce graph |
| GET | `/research/dossier/{node_id}` | Dossier from Redis-backed cache (7d TTL) |
| GET | `/chat/stream?node_title=&question=&ancestors=` | SSE ReAct follow-up |

### SSE event contract
`plan`, `thought`, `tool_call`, `tool_result`, `source`, `node_stream`, `dossier`,
`answer_start`, `token`, `done`, `error`. Each is a `data: {"event": "...", "data": {...}}` line.

---

## 3. Current State — What's DONE & VERIFIED

- **Full map-reduce graph works end-to-end** — real live research runs (History,
  Space, Technology topics), 3–5 parallel angles, 10–12 grounded findings, real
  Wikipedia/Tavily sources, dossier + 4 nodes with images, zero fabricated URLs.
- **Tavily tier works** (API key added; verified returning real results).
- **Follow-up chat works** — grounded, cited answers (Hannibal/elephants example).
- **Images work** — `wikipedia_page_images()` resolves topic → article → embedded
  page images; Commons File-namespace search (`gsrnamespace=6`) tops up; `utm_*`
  params stripped.
- **Signal collector works** — Google News, On-This-Day, Reddit, Hacker News, and
  Wikipedia trending (now with 7-day walk-back fallback after a 404 fix).
- **Cerebras concurrency guard** — global `asyncio.Semaphore` (max 2 in-flight,
  `MAX_CONCURRENT_LLM_CALLS` env) + OpenAI `max_retries` for 429/5xx backoff.
  Verified with 4 parallel live calls, all succeeded, no 429s.
- **Dossiers persist** in Redis-backed cache (survives restarts).
- **SSE robustness** — graph task errors surface as `error` events; background task
  cleaned up on client disconnect.
- **Interactive CLI** (`backend/app/scripts/agent_cli.py`) to drive the whole stack
  from the terminal: `pick / research / ask / sources / nodes / dossier / cats / quit`.
- **`start-dev.ps1`** launches backend + frontend + opens the browser with one command.
- Quality gates pass: `ruff check app`, `mypy app`, `ruff format --check app`, `tsc --noEmit`.

---

## 4. Known Issues / Open Concerns

1. **Frontend is NOT wired to the backend.** `useMindMapStore.ts` calls the real
   endpoints but the landing UI still renders mock pillar nodes (`initTopDownUniverse`)
   and falls back to `PRECOMPUTED_HUBS` mock data on any error. The "Surprise Me"
   button uses a hardcoded `RANDOM_TOPICS` list instead of `/graph/random-topic`.
   The store's `node_stream` → canvas layout logic is basic (offset stacking).
   **This is the #1 remaining gap.**
2. **Node-type mismatch FIXED** (`mindmap` → `mindMapNode`) — custom canvas nodes now render.
3. **Cerebras 429s under true concurrency** — mitigated by the semaphore but not stress-tested
   beyond 4 concurrent calls. A load test with many parallel researchers is worth doing.
4. **No precompute pipeline yet** — the plan is to run research offline on ~20–30
   topics and cache nodes + dossiers into Redis so the UI loads pre-explored canvases
   instantly (user explicitly asked for "preloaded interesting stuff").
5. **`signal_collector.py` still uses raw `ChatOpenAI` directly** instead of the
   `get_llm()` factory (pre-dates the factory). Not guarded by the semaphore — low
   risk but should be migrated for consistency.
6. **No tests** — no pytest suite, no Playwright E2E. AGENTS.md lists benchmarks
   (300ms node expansion, <120ms TTFT) that are aspirational targets, not measured.
7. **`.env`/`.env.local` are gitignored** (correct — they hold API keys). A new
   machine must recreate them manually from `.env.example`.

---

## 5. Roadmap (in agreed order)

### Phase A — Backend production hardening ✅ (mostly done)
- ✅ Signal collector 404/KeyError fix
- ✅ Node-type mismatch fix
- ✅ Cerebras semaphore + 429 retry
- ✅ Dossier persistence (Redis-backed)
- ✅ SSE disconnect/error handling
- ⬜ Migrate `signal_collector.py` to `get_llm()` factory (low priority)

### Phase B — Precompute pipeline (NEXT)
- Build `precompute_batch.py`: run the research graph offline on a curated list of
  topics (sourced via `pick_random_topic` across the 5 categories to stay non-hardcoded),
  write nodes + dossiers + images into Redis cache.
- Frontend then loads "already-explored" canvases instantly; live research reserved
  for fresh topics.
- Consider a `/graph/precomputed-topics` endpoint listing cached topics for the UI.

### Phase C — Frontend rewiring
- Wire landing → `/graph/random-topic` (show topic + reason card before diving in).
- Wire "Surprise Me" → real random topic, kill hardcoded `RANDOM_TOPICS`.
- Wire `node_stream` layout properly (root center, rabbit-hole children fanned out).
- Remove `PRECOMPUTED_HUBS` mock-data fallback path (or keep only as a last resort
  when the backend is genuinely down).
- Fix the `ChatDrawer` SSE consumption if needed.

### Phase D — Design pass (BeautifulUI)
Use https://www.beautifului.dev/ primitives (the styling reference mandated in AGENTS.md):
- **Landing**: 5 pillar tiles as giant BeautifulUI **Recommendation Cards**.
- **Research spectacle**: expandable **Thinking** trace (Steps/Reasoning/Search tabs),
  **Tool Chips**, **Task Rows** with running→completed states, live **Context Card**
  source rail.
- **Canvas**: React Flow spatial mindmap; BeautifulUI **Insight Cards** replace stats modal.
- **Dossier**: magazine-spread styling (hero image, timeline, mechanisms, geography map).
- **Chat**: BeautifulUI **Streaming Text** with inline source pills + follow-up chips.
- Dark theme, sky/indigo accent (current `#090d16` bg / `#38bdf8` accent).

---

## 6. Design Directives (from user)

- "no hard coding" — topics, fallbacks, content must come from live services/LLMs.
- "Prefer established, well-maintained libraries over custom implementations."
- "Do not preserve backward compatibility" — clean breaks are fine.
- "Choose the simplest implementation that fully meets the current requirements."
- Wikipedia must be one of the retrieval sources (it is — keyless floor).
- Cerebras for live inference; Mistral available as alternate batch provider.
- Use UV for Python packages (`uv sync`, `uv run`).
- Frontend is currently "still ass" — the user deprioritized it until the backend
  was production-ready. Now it's the focus.

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

# Frontend (separate terminal)
npm install
npm run dev

# Or the one-command launcher
.\start-dev.ps1

# Interactive agent CLI (drives agents without the UI)
cd backend
.venv/Scripts/python.exe app/scripts/agent_cli.py

# Full journey demo trace → backend/data/full_journey.md
.venv/Scripts/python.exe app/scripts/capture_journey.py History "your question"
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
- **Cerebras queues concurrent requests** → return 429 `queue_exceeded`. The semaphore
  in `llm.py` caps in-flight calls at 2 by default.
- **FastAPI `load_dotenv()` walks up** from `main.py` to the project root, so the root
  `.env` is picked up automatically. Test scripts must `load_dotenv()` explicitly.
- **Windows console is cp1252** — any script printing Unicode needs
  `sys.stdout.reconfigure(encoding="utf-8")` (see `agent_cli.py`).
- **LangChain `with_structured_output` + `.ainvoke`** is the reliable way to get
  validated JSON from the models; override `angle_id` programmatically after extraction
  (the extraction LLM hallucinates its own angle ids).
- **The chat agent's model hedges** — force a committed answer on the final round
  ("You MUST now answer"), feed search snippets into evidence, and cap rounds at 2.

---

## 9. Files That Matter Most

| Path | Why |
|------|-----|
| `README.md` | Full architecture, SSE contracts, setup |
| `AGENTS.md` | Agent roster, rules, verification benchmarks |
| `backend/app/services/research_graph.py` | The map-reduce LangGraph swarm |
| `backend/app/services/tools.py` | Retrieval ladder + media/geo tools |
| `backend/app/services/llm.py` | `get_llm()` factory + concurrency guard |
| `backend/app/services/research_agent.py` | SSE adapter + dossier persistence |
| `backend/app/services/chat_agent.py` | ReAct follow-up loop |
| `backend/app/services/random_topic.py` | Curiosity-ranked picker + signal pool |
| `backend/app/scripts/agent_cli.py` | Interactive terminal driver |
| `backend/app/scripts/capture_journey.py` | Full-journey markdown demo trace |
| `backend/app/scripts/signal_collector.py` | Live trending/on-this-day signals |
| `lib/store/useMindMapStore.ts` | Frontend state + SSE consumption (needs rewiring) |
| `cloudflare/src/index.ts` | Edge media proxy worker |
