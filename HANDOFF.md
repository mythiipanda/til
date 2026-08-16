# TDILEARNED — Master Handoff & Architecture Guide

> **Live Production State**: Verified end-to-end working system.
> **Branding**: **TDILEARNED (Today I Learned)**
> **Tech Stack**: Next.js 15 App Router, React Flow (@xyflow/react), Zustand, Tailwind CSS, FastAPI, LangGraph, Cerebras CS-3 (Live Inference), Mistral (Batch Precompute), DuckDuckGo / Tavily / Wikipedia retrieval ladder.

---

## 1. Product Vision & User Experience

**TDILEARNED** is an infinite-canvas knowledge discovery engine. It turns curiosity into an interactive, spatial mindmap where users can explore fascinating historical, scientific, and cultural breakthroughs.

The core insight: **The research itself is engaging and transparent.**
- Users select an instant pre-researched topic or start a custom live research inquiry.
- A swarm of sub-agents autonomously plans angles, retrieves verified web & encyclopedia sources, cross-verifies facts, synthesizes long-form monographs, and pins archival images & map coordinates onto an infinite canvas.
- When users explore subtopic rabbit holes or ask follow-up questions, full discovery context is preserved across the frontend and backend.

---

## 2. Verified Working Features

### 2.1. Spatial Infinite Canvas & Dynamic Layout
- **Full-Bleed Canvas**: Centered, high-contrast monochrome design system with `@xyflow/react`.
- **Large Knowledge Cards**: Main topics (`420px`) and subtopics (`380px`) with high-res archival image headers, markdown summaries, did-you-know callouts, and clickable rabbit hole vectors.
- **Dynamic Radial Expansion**: Connected subtopic nodes expand in wide radial orbits (`560px` radius) around their parent card.

### 2.2. Manus / Gemini-Style Sequential Research Swarm
- **5 Sequential Research Phases**:
  1. `Phase 1`: Formulating research angles & exploration scope (Planner)
  2. `Phase 2`: Deep web & encyclopedia retrieval (Parallel Web Search & Extraction)
  3. `Phase 3`: Cross-verifying claims & curating verified citations (Reference Extractor)
  4. `Phase 4`: Synthesizing story monograph, mechanisms & timeline (Storyteller)
  5. `Phase 5`: Curating archival media & geographic coordinates (Spatial Architect)
- **Live Activity Panel**: Real-time progress counter (`PHASE X OF 5`), animated phase indicators, live tool call chips, verified source links, and expandable reasoning notes.
- **Guaranteed Completion**: Upon research completion, all phases transition to checked `[✓]`, the full monograph dossier is preserved in client cache, and focus smoothly targets the newly researched card.

### 2.3. End-to-End Context Inheritance & Authentic Concept Naming
- **Unbroken Context Trail**: Subtopic expansions pass `context_chain`, `parent_summary`, and `teaser_context` to the backend planner, ensuring deep dives research the exact historical/scientific breakthrough rather than generic definitions.
- **Zero Metaphorical Clickbait**: Model schemas strictly enforce authentic entity and concept names (e.g. *"Black-Scholes Model"*, *"Fast Fourier Transform"*), moving curiosity hooks to taglines and wow-facts.
- **Clean Q&A Retrieval**: User questions have prompt boilerplate stripped before web search, and Cerebras responds as an authoritative educator without robotic meta-disclaimers.

---

## 3. How to Run the Services

### 3.1. Running Frontend (Next.js 15)
```bash
# In the root project directory:
npm run dev
# Active on: http://localhost:3000
```

### 3.2. Running Backend (FastAPI with `uv`)
```bash
# In the root project directory:
uv run --project backend uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Or inside the backend/ directory:
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Active on: http://localhost:8000
```

### 3.3. Running Bulk Offline Precomputation
To precompute hundreds or thousands more deep-dive hubs and dossiers in the background using Mistral:

```bash
# From project root:
uv run --project backend python -m app.scripts.bulk_precompute 1000

# Or from backend/ directory:
cd backend
uv run python -m app.scripts.bulk_precompute 1000
```
*(Replace `1000` with the desired number of hubs to generate. The script is crash-safe and appends each new hub and dossier to disk immediately upon completion).*

---

## 4. Next Steps & Roadmap for Full Consumer Product

### 4.1. Context & Graph Memory
- **Persistent Graph Sessions**: Add IndexedDB or Supabase session saving so users can save, share, or resume their discovery graphs via unique URLs.
- **Multi-Branch Context Merging**: Allow users to connect two separate nodes on the canvas to synthesize an AI bridge comparing both concepts.

### 4.2. Chat & Follow-Up Interface
- **Inline Canvas Notes / Sticky Annotations**: Allow users to drag follow-up Q&A answers directly onto the canvas as connected note cards.
- **Voice & Audio Tour**: Hook up the generated `audioTourScript` to an edge TTS provider (e.g. OpenAI TTS or ElevenLabs) so users can listen to podcast-style overviews of any topic.

### 4.3. Rich Media & Interactive Visualizations
- **Interactive Mini-Maps**: Embed Leaflet / Mapbox interactive views for geographic coordinates in the dossier drawer.
- **Timeline Slider**: Add an interactive horizontal timeline scrubber at the bottom of the dossier drawer.

### 4.4. Performance & Scalability
- **Cloudflare Edge Proxy Activation**: Deploy the Cloudflare worker (`/cloudflare`) to cache all Wikimedia Commons thumbnails and OpenStreetMap tiles with zero egress cost.
- **Redis Multi-Tier Cache**: Connect a hosted Redis instance via `REDIS_URL` for instant sub-millisecond precomputed hub responses in production.

---

## 5. Verification Checklist
- [x] `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
- [x] Backend SSE research stream executes end-to-end through all 5 phases.
- [x] Node and dossier schemas align cleanly between FastAPI and TypeScript types.
- [x] Git commits staged per logical change.