# TDILEARNED — Agentic Infinite-Canvas Discovery Engine

> Turn curiosity into spatial mindmaps — powered by Cerebras CS-3 live inference, a LangGraph map-reduce research swarm, and an infinite React Flow canvas.

Pick a topic, watch a multi-agent pipeline research it live across the web, and explore the results as an interactive node graph. Then keep asking questions.

**Live:** [tdilearned.vercel.app](https://tdilearned.vercel.app)

## Screenshots

| Infinite spatial canvas | Precomputed discovery hub |
|-------------------------|---------------------------|
| ![Canvas](screenshots/home.png) | ![Hub](screenshots/hub.PNG) |

| Agent research activity | AI chat drawer |
|-------------------------|----------------|
| ![Agent](screenshots/agent.PNG) | ![Chat](screenshots/chat.PNG) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│            Next.js 15 Frontend  (Vercel)                        │
│     React Flow infinite canvas · Zustand store · Tailwind       │
└────────┬───────────────────────────────────────┬────────────────┘
         │ SSE /research/stream                  │ SSE /chat/stream
         ▼                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              FastAPI Backend  (Azure App Service B1)            │
│                                                                 │
│  ┌─────────────┐   ┌───────────────────────────────────────┐   │
│  │ random-topic│   │   LangGraph Deep Research (map-reduce) │   │
│  │   picker    │   │  Planner → Researchers×N → Aggregator │   │
│  └─────────────┘   │  → Verifier → Synthesizer → Enricher  │   │
│                    └─────────────────┬─────────────────────┘   │
│  ┌─────────────┐                     │ asyncio.Queue → SSE      │
│  │  Chat Agent │   ┌─────────────────▼─────────────────────┐   │
│  │ (ReAct loop)│──▶│    Retrieval Ladder (tools.py)         │   │
│  └─────────────┘   │  Tavily → DuckDuckGo → Wikipedia       │   │
│                    │  + page fetch + Wikimedia images + OSM  │   │
│                    └───────────────────────────────────────┘   │
│                                                                 │
│  LLM factory: Cerebras CS-3 (gemma-4-31b) · Mistral fallback   │
│  Database: Supabase Postgres  (886 precomputed discovery hubs)  │
└────────┬────────────────────────────────────────────────────────┘
         │ media?url=<encoded>
         ▼
┌─────────────────────────────────────────────────────────────────┐
│    Cloudflare Workers — Zero-Cost Edge Media Proxy              │
│    <your-worker>.workers.dev                                    │
│    Cache-Control: public, max-age=31536000, immutable           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Production URLs

| Service | URL |
|---------|-----|
| Frontend | `https://tdilearned.vercel.app` |

Your backend, media proxy, and database URLs are deployment-specific — set them via the environment variables in the sections below.

---

## Research Pipeline

A single `GET /api/v1/research/stream?topic=...` runs this LangGraph:

| # | Stage | What it does |
|---|-------|-------------|
| 1 | **Plan** | Breaks the topic into 3–5 targeted research angles via Cerebras structured generation |
| 2 | **Research ×N** | `Send()` fans each angle to its own researcher in parallel — Tavily → DDG → Wikipedia with verbatim quotes |
| 3 | **Aggregate** | Waits for all parallel researchers, validates coverage |
| 4 | **Verify** | Deduplicates by URL — zero fabricated sources |
| 5 | **Synthesize** | Writes dossier strictly from retrieved evidence |
| 6 | **Enrich** | OSM geocoding, Wikipedia embedded images, builds React Flow nodes with coordinates |

All events stream over **Server-Sent Events** in real time.

### SSE Event Contract

| Event | Payload |
|-------|---------|
| `plan` | Research DAG steps |
| `thought` | Agent reasoning / status |
| `tool_call` / `tool_result` | Live tool activity |
| `source` | A verified retrieved source |
| `node_stream` | React Flow node (`is_root` = center node) |
| `dossier` | Full `ResearchDossierSchema` |
| `answer_start` / `token` | Chat stream token-by-token |
| `done` | Summary (timing, counts, root id) |

---

## API Endpoints (`/api/v1`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + engine info |
| GET | `/graph/random-topic?category=History` | Curiosity-ranked random topic |
| GET | `/graph/precomputed` | All 886 precomputed discovery hubs from Supabase |
| GET | `/research/stream?topic=&category=` | SSE — full map-reduce research |
| GET | `/research/dossier/{node_id}` | Fetch stored dossier by node id |
| GET | `/chat/stream?node_title=&question=&ancestors=` | SSE — ReAct follow-up chat |

---

## Project Structure

```
.
├── app/                          # Next.js 15 App Router (frontend)
│   ├── api/media/route.ts        # Local media proxy fallback
│   ├── page.tsx                  # Root canvas page
│   └── layout.tsx
├── components/                   # React components
│   ├── Canvas.tsx                # React Flow infinite canvas
│   ├── NodeCard.tsx              # Discovery hub node
│   ├── ChatDrawer.tsx            # SSE chat sidebar
│   └── DossierModal.tsx          # Full research dossier modal
├── lib/
│   └── useMindMapStore.ts        # Zustand global canvas state (single source of truth)
├── types/                        # Shared TypeScript types (graph.ts)
├── cloudflare/                   # Cloudflare Workers edge media proxy
│   ├── src/index.ts
│   └── wrangler.toml
├── .env.example                  # Environment variable template
└── backend/
    ├── app/
    │   ├── main.py               # FastAPI app + CORS
    │   ├── api/endpoints.py      # All /api/v1 routes
    │   ├── schemas/              # Pydantic v2 contracts
    │   │   ├── graph.py          # NodeSchema, CoordinatesSchema
    │   │   └── research.py       # ResearchDossierSchema
    │   └── services/
    │       ├── llm.py            # Model-agnostic get_llm() factory
    │       ├── research_graph.py # LangGraph map-reduce research
    │       ├── research_agent.py # SSE adapter for the graph queue
    │       ├── chat_agent.py     # ReAct follow-up chat loop
    │       ├── random_topic.py   # Curiosity-ranked topic picker
    │       ├── tools.py          # Retrieval ladder + media + geocoding
    │       ├── supabase_client.py# Supabase Postgres client
    │       ├── cache.py          # Redis + in-memory fallback
    │       └── scripts/
    │           ├── migrate_to_supabase.py  # Seed hubs into Supabase
    │           ├── capture_journey.py      # Demo trace writer
    │           └── signal_collector.py     # Live curiosity signals
    ├── pyproject.toml            # uv-managed Python deps
    └── requirements.txt          # Pinned flat deps for Azure deployment
```

---

## Local Setup

### Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- [uv](https://docs.astral.sh/uv/) — `pip install uv` or `winget install astral-sh.uv`
- (Optional) A Cloudflare account + `wrangler` for the edge media proxy
- (Optional) Azure CLI for deploying the backend yourself

### 1. Clone and configure

```bash
git clone https://github.com/YOUR_USERNAME/tdilearned.git
cd tdilearned
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required
CEREBRAS_API_KEY=csk-...
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...

# Strongly recommended
TAVILY_API_KEY=tvly-...

# Optional
MISTRAL_API_KEY=...

# Frontend config (use localhost for local dev)
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_CF_PROXY_URL=   # blank = falls back to local /api/media route
```

### 2. Start the backend

```bash
cd backend
uv sync                          # installs all Python deps including dev tools
cp ../.env.local .env.local      # share env with the backend process
uv run uvicorn app.main:app --reload --port 8000
```

Verify it's up:

```bash
curl http://localhost:8000/health
# → {"status": "ok", ...}
```

### 3. Start the frontend

From the repo root in a new terminal:

```bash
npm install
npm run dev                      # http://localhost:3000
```

### 4. (Optional) Local Cloudflare edge proxy

```bash
cd cloudflare
npm install
npx wrangler dev                 # runs proxy locally on localhost:8787
# Set NEXT_PUBLIC_CF_PROXY_URL=http://localhost:8787 in .env.local
```

### 5. Seed discovery hubs into Supabase

If you are setting up a fresh Supabase project, create the table first:

```sql
CREATE TABLE discovery_hubs (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  summary            TEXT NOT NULL DEFAULT '',
  category           TEXT NOT NULL DEFAULT 'General',
  coordinates        JSONB NOT NULL DEFAULT '{"lat": 0, "lng": 0}',
  image_search_query TEXT NOT NULL DEFAULT '',
  rabbit_holes       JSONB NOT NULL DEFAULT '[]',
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
```

Then seed 886 precomputed hubs:

```bash
cd backend
uv run python app/scripts/migrate_to_supabase.py
```

---

## Deploying to Production

### Backend → Azure App Service

```bash
# One-time login
az login

# Create resource group
az group create --name <your-rg> --location eastus

# Deploy (Oryx auto-builds Python from requirements.txt)
az webapp up \
  --resource-group <your-rg> \
  --name <your-app> \
  --runtime "PYTHON:3.11" \
  --sku B1 \
  --location eastus

# Set startup command (uvicorn on port 8000)
az webapp config set \
  --resource-group <your-rg> \
  --name <your-app> \
  --startup-file "uvicorn app.main:app --host 0.0.0.0 --port 8000"

# Inject production secrets
az webapp config appsettings set \
  --resource-group <your-rg> \
  --name <your-app> \
  --settings \
    CEREBRAS_API_KEY="csk-..." \
    CEREBRAS_MODEL="gemma-4-31b" \
    MISTRAL_API_KEY="..." \
    TAVILY_API_KEY="tvly-..." \
    NEXT_PUBLIC_SUPABASE_URL="https://<your-project>.supabase.co" \
    NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..." \
    NEXT_PUBLIC_CF_PROXY_URL="https://<your-worker>.workers.dev" \
    SCM_DO_BUILD_DURING_DEPLOYMENT="true"
```

Verify:

```bash
curl https://<your-app>.azurewebsites.net/api/v1/graph/precomputed | python -m json.tool | head -5
```

To redeploy after code changes:

```bash
cd backend
az webapp up --resource-group <your-rg> --name <your-app>
```

### Frontend → Vercel

```bash
# From repo root
npx vercel --prod --yes \
  --env NEXT_PUBLIC_BACKEND_URL="https://<your-app>.azurewebsites.net" \
  --env NEXT_PUBLIC_CF_PROXY_URL="https://<your-worker>.workers.dev" \
  --env NEXT_PUBLIC_SUPABASE_URL="https://<your-project>.supabase.co" \
  --env NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..."
```

Or connect your GitHub repo in the [Vercel dashboard](https://vercel.com) — pushes to `main` auto-deploy. Set the same env vars under **Project → Settings → Environment Variables**.

To redeploy after code changes:

```bash
npx vercel --prod
```

### Cloudflare Edge Media Proxy

```bash
cd cloudflare
npm install
npx wrangler deploy
# → Deployed to: https://<your-worker>.tdilearned.workers.dev
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `CEREBRAS_API_KEY` | ✅ | Cerebras CS-3 inference key ([cloud.cerebras.ai](https://cloud.cerebras.ai)) |
| `CEREBRAS_MODEL` | No | Default: `gemma-4-31b` |
| `MISTRAL_API_KEY` | No | Alternate LLM provider ([mistral.ai](https://mistral.ai)) |
| `MISTRAL_MODEL` | No | Default: `ministral-8b-2512` |
| `TAVILY_API_KEY` | Recommended | Enables highest-quality search tier ([tavily.com](https://tavily.com)) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase publishable key |
| `NEXT_PUBLIC_BACKEND_URL` | ✅ | FastAPI URL (`http://localhost:8000` locally, Azure URL in prod) |
| `NEXT_PUBLIC_CF_PROXY_URL` | Recommended | Cloudflare Worker URL for edge-cached media |
| `REDIS_URL` | No | Azure Redis URL; falls back to in-memory cache if absent |

---

## Quality Gates

```bash
# Backend (run from /backend)
uv run ruff format app       # auto-format
uv run ruff check app        # lint (must be clean)
uv run mypy app              # static typing (0 errors target)

# Frontend (run from repo root)
npx tsc --noEmit             # TypeScript (0 errors)
npm run lint                 # ESLint
```

### Performance Targets

| Metric | Target |
|--------|--------|
| Cerebras structured JSON (node expansion) | < 300ms |
| Chat first token latency (TTFT) | < 120ms |
| Precomputed hub load (`/graph/precomputed`) | < 200ms (886 hubs from Supabase) |
| Media assets (Cloudflare edge) | `Cache-Control: public, max-age=31536000, immutable` |

---

## LLM Factory

All agents share a single factory in `backend/app/services/llm.py`:

```python
llm = get_llm("cerebras")   # Cerebras CS-3 — primary (gemma-4-31b, ~3000 tok/s)
llm = get_llm("mistral")    # Mistral — alternate/fallback (ministral-8b-2512)
```

Both providers are OpenAI-API-compatible and wrapped in `ChatOpenAI`. If a key is missing, `get_llm()` returns `None` and callers degrade to keyless retrieval paths.

---

## Design Principles

- **No fake content** — every claim is grounded in fetched sources with verbatim quotes and real URLs.
- **Model-agnostic** — swap providers via `get_llm()`, no per-agent rewiring.
- **Keyless-friendly** — DuckDuckGo + Wikipedia always available as fallbacks.
- **Single state source** — all canvas state lives in `useMindMapStore.ts`; no local React state duplication.
- **Edge-cached media** — all Wikimedia / OSM assets flow through the Cloudflare Worker for zero-egress immutable caching. Direct fetches from client components are forbidden.
- **Async-only backend** — every I/O operation uses `async`/`await`; no blocking calls in the FastAPI event loop.

---

## TDILEARNED
