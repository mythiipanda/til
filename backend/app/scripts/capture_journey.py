"""Capture the FULL journey start-to-finish into one readable markdown file.

Flow: 5 general topic roots -> pick one category -> random topic within it ->
full map-reduce research agent run -> follow-up chat question -> saved as
backend/data/full_journey.md

Usage:  .venv/Scripts/python.exe app/scripts/capture_journey.py [category] [question]
"""

import asyncio
import json
import os
import sys
from collections import Counter

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
OUT_PATH = os.path.join(BACKEND_DIR, "data", "full_journey.md")

sys.path.insert(0, BACKEND_DIR)

load_dotenv(os.path.join(PROJECT_ROOT, ".env.local"))
load_dotenv()

GENERAL_TOPICS = ["Science", "History", "Mathematics", "Technology", "Philosophy"]

LINE = "=" * 72


def _render_topic(topic_resp) -> str:
    t = topic_resp.node
    out = [
        f"**Title**: {t.title}",
        f"**Summary**: {t.summary}",
        f"**Reason**: {topic_resp.reason}",
        f"**Image query**: {t.image_search_query}",
    ]
    return "\n".join(out)


def _render_event(ev: dict) -> str | None:
    event = ev.get("event")
    d = ev.get("data", {})
    if event == "plan":
        angles = d.get("angles", [])
        lines = ["**Plan** — " + str(d.get("topic", "")) + ":", ""]
        for a in angles:
            lines.append(f"- `{a.get('id')}` **{a.get('title')}** — {a.get('prompt', '')[:140]}")
        return "\n".join(lines)
    if event == "thought":
        return f"💭 **{d.get('agent', 'Agent')}**: {d.get('text', '')}"
    if event == "tool_call":
        return f"🔧 **{d.get('tool')}** query: `{d.get('query', '')}` (status: {d.get('status')})"
    if event == "tool_result":
        return f"✅ **{d.get('tool')}** → {d.get('preview', '')}"
    if event == "source":
        return f"📄 {d.get('title', '')} — {d.get('url', '')}"
    if event == "node_stream":
        n = d.get("node", {})
        hops = " | ".join(n.get("rabbit_holes", [])[:3])
        return (
            f"🌐 **Node**: {n.get('title')} (cat: {n.get('category')}, confidence: {n.get('confidence')})\n"
            f"     image: {n.get('imageUrl')}\n"
            f"     rabbit holes: {hops}"
        )
    if event == "dossier":
        dd = d.get("dossier", {})
        return (
            f"📜 **Dossier: {dd.get('title')}** (era: {dd.get('era')}, curiosity: {dd.get('curiosityScore')})\n"
            f"  - tagline: {dd.get('tagline')}\n"
            f"  - wow: {dd.get('wowFact')}\n"
            f"  - abstract: {dd.get('abstract', '')[:300]}..."
        )
    if event == "answer_start":
        cites = [c.get("url") for c in d.get("cites", [])]
        return f"🗨️ **Answer start** — citing {len(cites)} source(s): {', '.join(cites[:3])}"
    if event == "token":
        return None
    if event == "done":
        return f"🏁 **Done** — execution: {d.get('execution_time_ms', 0) / 1000:.1f}s"
    return None


async def main() -> None:
    requested_category = sys.argv[1] if len(sys.argv) > 1 else None
    chat_question = sys.argv[2] if len(sys.argv) > 2 else None

    from app.services.chat_agent import stream_chat
    from app.services.random_topic import pick_random_topic
    from app.services.research_agent import stream_deep_research

    lines: list[str] = [f"# Full Journey Trace — {__import__('datetime').date.today()}\n"]
    lines.append("This file captures the complete agentic pipeline start-to-finish.\n")

    # ---- Step 0: the five general topic roots ----
    lines.append("\n## Step 0 — The 5 General Topic Roots\n")
    lines.append("A user lands on the infinite canvas and sees these pillar topics:\n")
    lines.append("| # | Pillar Topic |")
    lines.append("|---|--------------|")
    for i, cat in enumerate(GENERAL_TOPICS, 1):
        lines.append(f"| {i} | {cat} |")
    lines.append("")

    # ---- Step 1: pick a category (hardcoded roots -> one click) ----
    import random

    category = requested_category or random.choice(GENERAL_TOPICS)
    lines.append("## Step 1 — Click a Pillar\n")
    lines.append(f"User clicks **{category}** (one of the 5 pillars).")
    lines.append("")

    # ---- Step 2: random topic picker (live Wikipedia category members) ----
    lines.append("## Step 2 — Pick a Random Topic\n")
    lines.append(
        "The picker samples live Wikipedia category members, reranks them with Cerebras for curiosity, and returns one topic.\n"
    )
    topic_resp = await pick_random_topic(category)
    topic = topic_resp.node.title
    lines.append(f"> {_render_topic(topic_resp).replace(chr(10), chr(10) + '> ')}")
    lines.append("")

    # ---- Step 3: full map-reduce research agent run ----
    lines.append("## Step 3 — Deep Research Agent Run\n")
    lines.append(
        f'The map-reduce LangGraph agent now researches **"{topic}"** — planner → parallel sub-researchers → aggregator → reference extractor → synthesizer → spatial enricher.\n'
    )
    lines.append(f"```\n{LINE}\n")
    lines.append("RAW SSE EVENT STREAM\n")
    lines.append(LINE + "\n")

    sse_chunks: list[str] = []
    events: list[dict] = []
    async for chunk in stream_deep_research(topic, category, image_query=topic_resp.node.image_search_query):
        sse_chunks.append(chunk)
        if chunk.startswith("data: "):
            try:
                payload = json.loads(chunk[len("data: ") :])
                events.append(payload)
            except json.JSONDecodeError:
                pass

    rendered = []
    for ev in events:
        text = _render_event(ev)
        if text:
            rendered.append(text)
    lines.append("\n\n".join(rendered))
    lines.append("\n```\n")

    # ---- Step 3b: event histogram ----
    types = Counter(e.get("event") for e in events)
    lines.append("\n### Event histogram\n")
    lines.append("| event | count |")
    lines.append("|-------|-------|")
    for event_type, count in sorted(types.items(), key=lambda kv: -kv[1]):
        lines.append(f"| {event_type} | {count} |")
    lines.append("")

    # ---- Step 4: follow-up chat question ----
    lines.append("## Step 4 — Follow-up Chat Question\n")
    question = chat_question or "What is the most surprising thing about this topic?"
    lines.append(f'User asks in the chat drawer: **"{question}"**\n')
    lines.append("The lightweight ReAct follow-up agent searches fresh sources and streams a grounded answer.\n")
    lines.append(f"```\n{LINE}\n")
    lines.append("FOLLOW-UP CHAT SSE STREAM\n")
    lines.append(LINE + "\n")

    chat_events: list[dict] = []
    async for chunk in stream_chat(topic, question, [category, topic]):
        if chunk.startswith("data: "):
            try:
                payload = json.loads(chunk[len("data: ") :])
                chat_events.append(payload)
            except json.JSONDecodeError:
                pass

    rendered_chat = []
    answer_words: list[str] = []
    for ev in chat_events:
        if ev.get("event") == "token":
            answer_words.append(ev["data"]["token"])
        else:
            if answer_words:
                rendered_chat.append("".join(answer_words))
                answer_words = []
            text = _render_event(ev)
            if text:
                rendered_chat.append(text)
    if answer_words:
        rendered_chat.append("".join(answer_words))
    lines.append("\n\n".join(rendered_chat))
    lines.append("\n```\n")

    lines.append("")
    lines.append(
        f"---\n\n*Captured by `capture_journey.py` — {__import__('datetime').datetime.now().isoformat(timespec='seconds')}*"
    )

    await asyncio.to_thread(_write_file, "\n".join(lines))

    print(f"[journey] category = {category}")
    print(f"[journey] topic = '{topic}'")
    print(f"[journey] events = {len(events)}, chat tokens = {sum(1 for e in chat_events if e.get('event') == 'token')}")
    print(f"[journey] done -> {OUT_PATH}")


def _write_file(text: str) -> None:
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(text)


if __name__ == "__main__":
    asyncio.run(main())
