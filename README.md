# TILEARNED — Agentic Infinite-Canvas Discovery Engine

An agentic discovery engine that turns curiosity into spatial mindmaps. Pick one of five
pillar topics, get a curiosity-ranked random topic, and watch a swarm of AI sub-agents
research it live — streaming grounded sources, an interactive dossier, maps, and imagery
onto an infinite canvas in real time. Then keep asking questions.

The research pipeline is **real, not scripted**: a LangGraph map-reduce swarm performs
actual web retrieval (Tavily → DuckDuckGo → Wikipedia), extracts verbatim evidence from
real pages, and synthesizes every fact strictly from what it found. No fabricated URLs,
no hard-coded topics, no canned narratives.

---

## Architecture at a Glance

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Browser / Next.js Canvas (React Flow)                │
│      Zustand store consumes SSE and paints nodes/edges onto the canvas      │
└──────────────┬──────────────────────────────────┬──────────────────────────┘
               │ GET /research/stream (SSE)        │ GET /chat/stream (SSE)
               ▼                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          FastAPI Backend (/api/v1)                         │
│                                                                             │
│  ┌─────────────────┐   ┌──────────────────────────────────────────────┐     │
│  │  random-topic   │   │        Deep Research Graph (LangGraph)        │     │
│  │   picker        │   │                                              │     │
│  │  (Wikipedia     │   │  Planner → Send()×N Researchers → Aggregator │     │
│  │   category +    │   │  → Reference Extractor → Synthesizer         │     │
│  │   live signals) │   │  → Spatial Enricher                          │     │
│  └─────────────────┘   └──────────────┬───────────────────────────────┘     │
│                                       │ events via asyncio.Queue → SSE      │
│  ┌─────────────────┐   ┌──────────────▼───────────────────────────────┐     │
│  │  Follow-up Chat  │   │            Retrieval Ladder (tools)          │     │
│  │  (ReAct loop)    │──▶│  Tavily → DuckDuckGo → Wikipedia (keyless)   │     │
│  └─────────────────┘   │  + page-content extraction + relevance filter │     │
│                        │  + Wikimedia page images + OSM geocoder       │     │
│                        └───────────────────────────────────────────────┘     │
│                                                                             │
│   LLM factory (get_llm): Cerebras CS-3 live inference, Mistral available    │
│   Multi-tier cache: Azure Redis → in-memory fallback                        │
└──────────────┬──────────────────────────────────────────────────────────────┘
               │ media?url=<encoded>  (via Cloudflare or /api/media fallback)
               ▼
┌────────────────────────────────────────────────────────────────────────────┐
│        Cloudflare Worker — Zero-Cost Edge Media Proxy                      │
│   Whitelisted Wikimedia Commons / OpenStreetMap hosts, compliant UA,       │
│   Cache-Control: public, max-age=31536000, immutable                       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## The Research Pipeline (start-to-finish)

A single request to `/api/v1/research/stream?topic=...` runs this graph:

| # | Stage | Agent | What it does |
|---|-------|-------|--------------|
| 1 | **Plan** | Planner | Breaks the topic into 3–5 targeted, non-overlapping research angles (structured Cerebras call). Emits a `plan` SSE event with the DAG steps. |
| 2 | **Research** | Deep Retrieval ×N (parallel) | `Send()` fans each angle out to its own researcher. Each searches the retrieval ladder, fetches real page content, and extracts 2–4 grounded findings with **verbatim quotes + real URLs**. |
| 3 | **Aggregate** | Aggregator | Waits for all parallel researchers; collects findings and validates every angle is covered. |
| 4 | **Verify** | Reference Extractor | Deduplicates by URL into a curated source list. **No fabricated URLs** — every source came from an actual retrieval. |
| 5 | **Synthesize** | Storyteller | Writes the dossier (title, abstract, timeline, mechanisms, rabbit holes, wow-fact, audio script) **strictly from the grounded evidence**. |
| 6 | **Enrich** | Spatial Architect | Geocodes the location via OSM, fetches images embedded on the topic's Wikipedia article, builds root + 3 child React Flow nodes with coordinates. |

Everything streams over **Server-Sent Events** in real time.

### SSE event contract

The backend emits one `data: {json}` line per event:

| Event | Purpose |
|-------|---------|
| `plan` | Research DAG steps (from the planner) |
| `thought` | An agent's reasoning/status text |
| `tool_call` / `tool_result` | Live tool activity (WebSearch, WikimediaArchive, OpenStreetMapGeocoder) |
| `source` | A discovered, verifiable source |
| `node_stream` | A React Flow node to render (`is_root` flags the center node) |
| `dossier` | The full interactive dossier (`ResearchDossierSchema`) |
| `answer_start` / `token` | Follow-up chat streaming answer (token-by-token) |
| `done` | Execution summary (timing, source/finding counts, root id) |

### Follow-up chat (ReAct-style tool loop)

`/api/v1/chat/stream` runs a deliberately **simple** agent (the deep map-reduce graph is
overkill for Q&A): a bounded 2-round loop that searches the retrieval ladder, fetches page
content, decides whether more evidence is needed, then streams a grounded, cited answer
token-by-token. It never answers from imagination — only from the evidence blocks fetched.

---

## Model-Agnostic LLM Factory

All agents obtain their LLM through `backend/app/services/llm.py::get_llm()`. Swapping
hardware providers is a config change, not a code change:

```python
llm = get_llm("cerebras")   # live research + chat  → Cerebras CS-3 (gemma-4-31b)
llm = get_llm("mistral")    # batch / alternate      → Mistral (ministral-8b-2512)
```

Both providers expose OpenAI-compatible APIs and are wrapped in `ChatOpenAI`. If no API
key is configured for a provider, `get_llm()` returns `None` and callers degrade to their
keyless paths (e.g. Wikipedia-only retrieval, snippet-based findings).

---

## The Retrieval Ladder

Every web search goes through `search_web_ladder()` in `backend/app/services/tools.py`:

1. **Tavily** (if `TAVILY_API_KEY` set) — highest-quality results.
2. **DuckDuckGo** (`ddgs`) — keyless fallback, always available.
3. **Wikipedia** — guaranteed keyless floor, reliability-weighted highest.

Results are:
- **Deduplicated by URL**
- **Filtered by lexical relevance** to the query (keeps out DDG noise like "MD vs DO" hits)
- **Sorted by reliability score** (Wikipedia 0.96 > Tavily 0.85 > DDG 0.75)

Supporting tools:

| Tool | Purpose |
|------|---------|
| `fetch_page_content()` | Fetches and strips a page to readable text for evidence extraction |
| `wikipedia_page_images()` | Resolves a topic to its Wikipedia article and pulls the images editors embedded on that page (highest relevance) |
| `_commons_search()` | Wikimedia Commons file-namespace search — top-up when a page has few images |
| `osm_geocoder_tool()` | Nominatim geocoding for coordinates + location names |
| `proxy_media_url()` | Routes media through the Cloudflare edge proxy (or `/api/media` fallback) |

---

## API Endpoints (`/api/v1`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health + engine info |
| GET | `/graph/random-topic?category=History` | Curiosity-ranked random topic (one of Science, History, Mathematics, Technology, Philosophy) |
| GET | `/research/stream?topic=&category=` | **SSE** — runs the full map-reduce research graph |
| GET | `/research/dossier/{node_id}` | Fetch a stored dossier by node id |
| GET | `/chat/stream?node_title=&question=&ancestors=` | **SSE** — ReAct follow-up chat |

---

## Project Structure

```
.
├── app/                        # Next.js frontend (React Flow canvas, dossier modal, chat drawer)
│   └── api/media/route.ts      # Local media proxy fallback (when no Cloudflare worker)
├── components/                 # Canvas, chat, dossier, inspector, timeline/map views
├── lib/                        # Zustand mindmap store, mock data, utils
├── types/                      # Shared TypeScript graph types
├── cloudflare/                 # Edge media proxy worker (wrangler.toml + src/index.ts)
└── backend/
    ├── app/
    │   ├── api/endpoints.py    # All /api/v1 routes
    │   ├── schemas/            # Pydantic v2 contracts (graph.py, research.py)
    │   └── services/
    │       ├── llm.py          # Model-agnostic get_llm() provider factory
    │       ├── research_graph.py # LangGraph map-reduce deep research graph
    │       ├── research_agent.py # SSE adapter draining the graph's event queue
    │       ├── chat_agent.py   # Lightweight ReAct follow-up chat loop
    │       ├── random_topic.py # Curiosity-ranked topic picker (live Wikipedia + signals)
    │       ├── tools.py        # Retrieval ladder + media + geocoding tools
    │       ├── media.py        # OSM tile math
    │       ├── cache.py        # Redis + in-memory multi-tier cache
    │       └── scripts/
    │           ├── capture_journey.py  # Writes backend/data/full_journey.md demo trace
    │           └── signal_collector.py # Live trending/on-this-day curiosity signals
    ├── pyproject.toml          # uv-managed dependencies (ruff + mypy dev group)
    └── data/                   # Generated demo trace outputs (gitignored)
```

---

## Environment Variables

Create `.env.local` at the repo root (or export in your shell). See `.env.example`.

| Variable | Required | Purpose |
|----------|----------|---------|
| `CEREBRAS_API_KEY` | Yes | Live inference for the research graph + chat |
| `CEREBRAS_MODEL` | No | Default `gemma-4-31b` |
| `MISTRAL_API_KEY` | Optional | Alternate batch provider |
| `MISTRAL_MODEL` | No | Default `ministral-8b-2512` |
| `TAVILY_API_KEY` | Optional | Enables the Tavily tier of the retrieval ladder |
| `REDIS_URL` | Optional | Enables Redis caching (falls back to in-memory) |
| `NEXT_PUBLIC_BACKEND_URL` | Frontend | e.g. `http://localhost:8000` |
| `NEXT_PUBLIC_CF_PROXY_URL` | Optional | Cloudflare worker URL; media falls back to `/api/media` when empty |

---

## Getting Started

```bash
# 1. Backend (uv-managed, Python 3.11+)
cd backend
uv sync                       # installs deps incl. ruff + mypy dev group
copy ..\.env.local .env.local # (or export the env vars)
uv run uvicorn app.main:app --reload --port 8000

# 2. Frontend (repo root, in another terminal)
npm install
npm run dev                   # Next.js dev server

# 3. Edge proxy (optional, for zero-cost media caching)
cd cloudflare
npm install
npx wrangler deploy           # set NEXT_PUBLIC_CF_PROXY_URL to the deployed URL
```

**Run a full end-to-end demo trace** (5 pillars → random topic → research → chat):

```bash
cd backend
.venv/Scripts/python.exe app/scripts/capture_journey.py History "Your follow-up question"
# → writes backend/data/full_journey.md
```

---

## Verification & Quality Gates

```bash
cd backend
uv run ruff format app            # formatting
uv run ruff check app             # lint
uv run mypy app                   # static typing (0 errors)
```

### Operational benchmarks

- **TypeScript**: `npx tsc --noEmit` — 0 errors (frontend)
- **Python**: `ruff check` + `mypy app` — clean
- **Retrieval integrity**: every `source`/`dossier` URL is real (from actual retrieval, never synthesized)
- **Streaming**: research stream emits incremental `node_stream` events; chat streams token-by-token with `<120 ms` first-token target
- **Media**: all imagery routes through the edge proxy with immutable CDN caching

---

## Design Principles

- **No fake content**: every claim is grounded in fetched sources with verbatim quotes.
- **Model-agnostic**: swap Cerebras ↔ Mistral via one factory, no per-agent wiring.
- **Community-standard agent pattern**: map-reduce (Planner → parallel Researchers → Aggregator → Synthesizer) over bespoke one-shot prompts.
- **Established libraries**: LangGraph, LangChain, Tavily, FastAPI, Pydantic v2, httpx — no hand-rolled frameworks.
- **Keyless-friendly**: the whole stack degrades gracefully when optional API keys are absent.