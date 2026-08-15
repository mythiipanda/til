"""Interactive CLI to drive the TILEARNED agent stack end-to-end from the terminal.

Commands:
  pick [category]     Pick a curiosity-ranked random topic (default: History)
  research [topic]    Run the full map-reduce research graph, streamed live
  ask <question>      ReAct follow-up chat about the last researched topic
  sources             Show sources discovered by the last research run
  dossier [node_id]   Show the dossier of a node (default: last root)
  nodes               Show all nodes emitted by the last research run
  cats                List the 5 pillar categories
  help                Show this help
  quit / exit         Leave the CLI

Usage:  .venv/Scripts/python.exe app/scripts/agent_cli.py
"""

import asyncio
import json
import os
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))

sys.path.insert(0, BACKEND_DIR)

load_dotenv(os.path.join(PROJECT_ROOT, ".env.local"))
load_dotenv()

CATEGORIES = ["Science", "History", "Mathematics", "Technology", "Philosophy"]

CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
DIM = "\033[2m"
BOLD = "\033[1m"
RESET = "\033[0m"


class CliState:
    def __init__(self) -> None:
        self.topic: str | None = None
        self.category: str | None = None
        self.nodes: list[dict] = []
        self.sources: list[dict] = []
        self.dossiers: dict[str, dict] = {}


def _event_icon(event: str) -> str:
    return {
        "plan": "📋",
        "thought": "💭",
        "tool_call": "🔧",
        "tool_result": "✅",
        "source": "📄",
        "node_stream": "🌐",
        "dossier": "📜",
        "answer_start": "🗨️",
        "done": "🏁",
    }.get(event, "•")


def _print_event(ev: dict) -> None:
    event = ev.get("event") or ""
    d = ev.get("data", {}) or {}
    icon = _event_icon(event)

    if event == "plan":
        print(f"{MAGENTA}{icon} PLAN{RESET} — {BOLD}{d.get('topic', '')}{RESET}")
        for a in d.get("angles", []):
            print(f"  {BLUE}▶ {a.get('title')}{RESET} {DIM}({a.get('id')}){RESET}")
    elif event == "thought":
        print(f"{CYAN}{icon} {d.get('agent', 'Agent')}:{RESET} {d.get('text', '')}")
    elif event == "tool_call":
        print(f"{YELLOW}{icon} {d.get('tool')} query: {d.get('query', '')}{RESET}")
    elif event == "tool_result":
        print(f"  {GREEN}{d.get('preview', '')}{RESET}")
    elif event == "source":
        print(
            f"{BLUE}{icon} {d.get('title', '')[:70]}{RESET}\n"
            f"  {DIM}{d.get('url', '')}{RESET}"
        )
    elif event == "node_stream":
        n = d.get("node", {}) or {}
        role = "ROOT" if d.get("is_root") else "child"
        print(
            f"{GREEN}{icon} Node ({role}): {BOLD}{n.get('title')}{RESET} "
            f"{DIM}cat={n.get('category')} conf={n.get('confidence')}{RESET}"
        )
        for rh in (n.get("rabbit_holes") or [])[:3]:
            print(f"  {DIM}↳ {rh}{RESET}")
    elif event == "dossier":
        dd = d.get("dossier", {}) or {}
        print(
            f"{GREEN}{icon} Dossier: {BOLD}{dd.get('title')}{RESET} "
            f"{DIM}(era={dd.get('era')} score={dd.get('curiosityScore')}){RESET}\n"
            f"  {dd.get('tagline', '')}\n"
            f"  {DIM}wow: {dd.get('wowFact', '')[:180]}{RESET}"
        )
    elif event == "answer_start":
        cites = [c.get("url") for c in d.get("cites", [])]
        print(f"{MAGENTA}{icon} Answer (citing {len(cites)} sources):{RESET}")
    elif event == "token":
        sys.stdout.write(d.get("token", ""))
        sys.stdout.flush()
    elif event == "done":
        print(f"\n{DIM}{'─' * 60}{RESET}")
        print(f"{GREEN}{icon} Done — {d.get('execution_time_ms', 0) / 1000:.1f}s{RESET}")
    else:
        print(f"{DIM}{icon} {event}{RESET} {json.dumps(d)[:160]}")


async def _run(cmd: str, args: list[str], state: CliState) -> None:
    from app.services.chat_agent import stream_chat
    from app.services.random_topic import pick_random_topic
    from app.services.research_agent import DOSSIER_STORE, stream_deep_research

    if cmd in ("help", "?"):
        _help()
        return

    if cmd in ("cats", "categories"):
        print(f"{BOLD}5 Pillar Categories:{RESET}")
        for i, c in enumerate(CATEGORIES, 1):
            print(f"  {i}. {c}")
        return

    if cmd in ("quit", "exit"):
        print("Bye!")
        sys.exit(0)

    if cmd == "pick":
        category = (args[0] if args else "History").strip().title()
        print(f"{BOLD}Picking a random topic from {category}...{RESET}")
        resp = await pick_random_topic(category)
        node = resp.node
        state.topic = node.title
        state.category = resp.category
        print(f"\n  {GREEN}{BOLD}{node.title}{RESET}")
        print(f"  {node.summary}")
        print(f"  {DIM}why: {resp.reason}{RESET}")
        print(f"  {DIM}image_query: {node.image_search_query}{RESET}\n")
        return

    if cmd == "research":
        topic = " ".join(args) or state.topic
        if not topic:
            print(f"{RED}No topic. Use: research <topic> or pick one first.{RESET}")
            return
        research_category = state.category
        image_query = None
        print(f"{BOLD}Running deep research on: {topic}{RESET}")
        print(f"{DIM}Waiting for the map-reduce swarm...{RESET}\n")
        events: list[dict] = []
        async for chunk in stream_deep_research(topic, research_category, image_query=image_query):
            if chunk.startswith("data: "):
                try:
                    ev = json.loads(chunk[len("data: ") :])
                except json.JSONDecodeError:
                    continue
                events.append(ev)
                _print_event(ev)
                if ev.get("event") == "node_stream":
                    state.nodes.append(ev["data"].get("node", {}))
                elif ev.get("event") == "source":
                    state.sources.append(ev["data"])
                elif ev.get("event") == "dossier":
                    nid = ev["data"].get("node_id")
                    if nid:
                        state.dossiers[nid] = ev["data"].get("dossier", {})
                elif ev.get("event") == "done":
                    state.topic = topic
        print(f"\n{DIM}events: {len(events)} | nodes: {len(state.nodes)} | sources: {len(state.sources)}{RESET}")
        return

    if cmd == "ask":
        question = " ".join(args)
        topic = state.topic or "the topic"
        if not question:
            print(f"{RED}Usage: ask <your question>{RESET}")
            return
        print(f"{BOLD}Follow-up guide answering about: {topic}{RESET}")
        print(f"{DIM}Q: {question}{RESET}\n")
        async for chunk in stream_chat(topic, question, [state.category or "", topic]):
            if chunk.startswith("data: "):
                try:
                    ev = json.loads(chunk[len("data: ") :])
                except json.JSONDecodeError:
                    continue
                _print_event(ev)
        return

    if cmd == "sources":
        if not state.sources:
            print(f"{YELLOW}No sources yet. Run: research <topic>{RESET}")
            return
        print(f"{BOLD}{len(state.sources)} sources:{RESET}")
        for s in state.sources:
            print(f"  {BLUE}• {s.get('title', '')[:70]}{RESET}")
            print(f"    {DIM}{s.get('url', '')} | score={s.get('reliabilityScore')}{RESET}")
        return

    if cmd == "nodes":
        if not state.nodes:
            print(f"{YELLOW}No nodes yet. Run: research <topic>{RESET}")
            return
        print(f"{BOLD}{len(state.nodes)} nodes:{RESET}")
        for n in state.nodes:
            print(f"  {GREEN}• {n.get('title')} {DIM}({n.get('id')}){RESET}")
        return

    if cmd == "dossier":
        node_id = args[0] if args else (next(iter(state.dossiers.keys())) if state.dossiers else None)
        if not node_id:
            print(f"{YELLOW}No dossier available yet. Run: research <topic>{RESET}")
            return
        dd = state.dossiers.get(node_id) or DOSSIER_STORE.get(node_id)
        if not dd:
            print(f"{RED}No dossier for {node_id}{RESET}")
            return
        print(f"{BOLD}{dd.get('title')} — {dd.get('tagline')}{RESET}")
        print(f"  {DIM}era: {dd.get('era')} | curiosity: {dd.get('curiosityScore')}/10{RESET}")
        print(f"\n  {dd.get('abstract', '')}")
        print(f"\n  {GREEN}Sources ({len(dd.get('sources', []))}):{RESET}")
        for s in dd.get("sources", [])[:8]:
            print(f"    {BLUE}• {s.get('title', '')[:60]}{RESET}")
            print(f"      {DIM}{s.get('url', '')}{RESET}")
        if dd.get("timeline"):
            print(f"\n  {GREEN}Timeline:{RESET}")
            for t in dd.get("timeline", [])[:8]:
                print(f"    {YELLOW}{t.get('date', '')}{RESET} — {t.get('headline', '')}")
        if dd.get("rabbitHoles"):
            print(f"\n  {GREEN}Rabbit holes:{RESET}")
            for rh in dd.get("rabbitHoles", []):
                print(f"    {MAGENTA}↳ {rh.get('title')}{RESET} {DIM}{rh.get('teaser', '')[:80]}{RESET}")
        return

    print(f"{RED}Unknown command: {cmd}. Type 'help'.{RESET}")


def _help() -> None:
    print(f"""{BOLD}TILEARNED Agent CLI{RESET}
  {CYAN}pick [category]{RESET}    random curiosity-ranked topic (default History)
  {CYAN}research [topic]{RESET}   full map-reduce deep research, streamed live
  {CYAN}ask <question>{RESET}     ReAct follow-up chat about the last topic
  {CYAN}sources{RESET}            sources discovered by the last research run
  {CYAN}dossier [node_id]{RESET}  dossier for a node (default: last)
  {CYAN}nodes{RESET}              nodes emitted by the last research run
  {CYAN}cats{RESET}               list the 5 pillar categories
  {CYAN}help{RESET}               this help
  {CYAN}quit{RESET}               leave""")


async def main() -> None:
    state = CliState()
    print(f"{BOLD}╔{'═' * 58}╗{RESET}")
    print(f"{BOLD}║  TILEARNED — Agentic Discovery Engine CLI{RESET}  ".ljust(60) + "║")
    print(f"{BOLD}╚{'═' * 58}╝{RESET}")
    print(f"{DIM}Type 'help' for commands. Start with: pick History{RESET}\n")

    while True:
        try:
            line = await asyncio.to_thread(input, f"{GREEN}til›{RESET} ")
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            break
        if not line.strip():
            continue
        parts = line.strip().split()
        cmd = parts[0].lower()
        args = parts[1:]
        try:
            await _run(cmd, args, state)
        except KeyboardInterrupt:
            print(f"\n{RED}[interrupted]{RESET}")
        except Exception as e:
            print(f"\n{RED}Error: {e}{RESET}")


if __name__ == "__main__":
    asyncio.run(main())
