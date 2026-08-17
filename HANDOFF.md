# TDILEARNED — Master Handoff & Future Action Plan

> **System Status**: Verified working end-to-end (Frontend Canvas + FastAPI + Cerebras Live Research + Mistral Bulk Precompute).
> **Branding**: **TDILEARNED (Today I Learned)**
> **Last Updated**: August 16, 2026

---

## 1. Executive Product Vision

**TDILEARNED** is an agentic, infinite-canvas discovery engine ("Wikipedia meets Manus").
- Users pick a curated topic or start an autonomous research inquiry.
- A swarm of sub-agents plans research angles, retrieves live web & encyclopedia sources, cross-verifies facts, synthesizes deep-dive monographs with timelines and mechanisms, and pins visual artifacts onto a spatial mindmap.
- **Key Insight**: The research process itself is the entertainment — watching thoughts, tool executions, and citations appear in real time.

---

## 2. Verified Working Features & Architecture

```
Browser (Next.js 15 App Router + React Flow + Zustand)
   │  GET /api/v1/research/stream    (SSE: plan, thoughts, tools, sources, nodes, dossier, done)
   │  GET /api/v1/chat/stream        (SSE: follow-up Q&A with source citations)
   │  GET /api/v1/graph/precomputed  (List 877+ ready hubs instantly)
   │  GET /api/v1/graph/catalog      (2,000+ real Wikipedia discovery candidates)
   ▼
FastAPI Backend (backend/)
   ├─ research_graph.py   LangGraph 5-phase swarm (Planner → Researchers → Aggregator → Extractor → Synthesizer → Spatial)
   ├─ research_agent.py   SSE adapter draining graph events to client
   ├─ chat_agent.py       ReAct follow-up loop with source grounding
   ├─ random_topic.py     Curiosity-ranked Wikipedia topic selector
   ├─ precompute.py       Offline bulk hub precompute runner (Mistral)
   ├─ tools.py            Retrieval ladder (Tavily → DuckDuckGo → Wikipedia) + Media/Geo tools
   ├─ llm.py              Cerebras (Live) & Mistral (Batch) provider factory with concurrency guard
   └─ cache.py            Redis / Disk JSON multi-tier cache
```

### 2.1. Verified Milestones
- **877+ Pre-Researched Hubs**: Persisted to disk with full monographs, timelines, mechanisms, and child vectors.
- **Bulk Precompute Runner**: Tested & verified (`python -m app.scripts.bulk_precompute 1` completed cleanly in 49s).
- **Zustand Monograph Cache**: `dossiersByNodeId` in `useMindMapStore.ts` prevents subtopics from falling back to empty cards.
- **Authentic Entity Naming**: Eliminated metaphorical clickbait (e.g., *"Magic Math Switch"*) in favor of real scientific/historical concepts.
- **Robust Type Safety**: `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.

---

## 3. High-Priority Gaps & Next Steps for Tomorrow

### Gap 1: Real-Time SSE Chunking & Activity Pacing
- **The Issue**: Because Cerebras processes generation at ~3,000 tokens/sec, Phases 3–5 (claim verification, monograph synthesis, spatial pinning) finish in under 1.5 seconds. When the browser receives these events in a fast TCP burst, the Activity Panel appears to sit on Phase 2 and then suddenly mark everything as done.
- **Action Plan**:
  1. In `research_agent.py` and `research_graph.py`, introduce an async queue rate-limiter or small micro-yield cadence so the browser renders each phase transition and source citation with fluid animations.
  2. Stream intermediate researcher findings live as DuckDuckGo / Tavily return search snippets rather than waiting for full page extraction.

### Gap 2: Follow-Up Chat & Mindmap Interactivity
- **The Issue**: The current chat composer floats at the bottom of the screen as a single input without permanent conversation history on the canvas.
- **Action Plan**:
  1. Allow users to "pin" chat answers directly onto the React Flow canvas as connected sticky note cards.
  2. Maintain multi-turn memory per node so users can have extended conversations about specific subtopics.

### Gap 3: Recursive Multi-Level Context Passing
- **The Issue**: When expanding 3+ levels deep (e.g. *2008 Crisis* $\rightarrow$ *Subprime Mortgages* $\rightarrow$ *CDOs* $\rightarrow$ *Tranches*), deep subtopics need the full ancestral chain to avoid drifting into generic definitions.
- **Action Plan**:
  1. Pass the full node ancestor chain in `startResearch(topic, category, parentId)` from the Zustand store.
  2. Include parent summary and root topic in the initial `Planner` prompt.

### Gap 4: Audio Tour & Interactive Visuals
- **The Issue**: The backend synthesizes `audioTourScript` and OpenStreetMap coordinates, but they are only rendered as static text in the dossier.
- **Action Plan**:
  1. Connect `audioTourScript` to an edge TTS provider (e.g., OpenAI TTS or browser Web Speech API) with play/pause controls.
  2. Embed an interactive mini-map component in the dossier for geographic coordinates.

---

## 4. Operational Execution Commands

### 4.1. Start Local Frontend (Next.js 15)
```bash
# In project root:
npm run dev
# Running on http://localhost:3000
```

### 4.2. Start Local Backend (FastAPI with `uv`)
```bash
# In project root:
uv run --project backend uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Running on http://localhost:8000
```

### 4.3. Run Bulk Precomputation (Generate 2,000+ Topics)
#### Windows Command Prompt (`cmd.exe`) — Run from anywhere:
```cmd
cd /d C:\Users\15980\Downloads\til\backend && uv run python -m app.scripts.bulk_precompute 2000
```

#### Windows PowerShell — Run from anywhere:
```powershell
uv run --project C:\Users\15980\Downloads\til\backend python -m app.scripts.bulk_precompute 2000
```

---

## 5. Verification Checklist Before Finalizing Tomorrow
- [ ] Static Types: `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
- [ ] Backend Code Quality: `ruff check backend/` completes cleanly.
- [ ] Live Research Flow: Expand a subtopic on canvas and verify continuous, fluid event delivery in the Activity Panel.
- [ ] Dossier View: Verify full story, timeline, mechanisms, and sources open smoothly for both root and child nodes.
Q&A very unoptimal needs fixing, alot of "not backed by context and the pre built questions are bad and this q&a should be very general purpose do some looking