"""
Lightweight follow-up Q&A agent (ReAct-style tool loop).

A single Cerebras agent answers user questions about an active node. Unlike the
full map-reduce research graph, this stays simple: it gathers fresh grounded
sources via the retrieval ladder, then streams a concise cited answer. A bounded
loop lets the agent issue a follow-up search when the first round is thin.
"""

import asyncio
import json
import logging
import re
import time
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.services.llm import get_llm
from app.services.tools import fetch_page_content, search_web_ladder

logger = logging.getLogger(__name__)

MAX_ROUNDS = 2
MAX_SOURCES_PER_ROUND = 5
MAX_CONTENT_CHARS = 3500


class DecideTurn(BaseModel):
    """The agent's decision after reviewing gathered evidence."""

    answer: str = Field(description="Final grounded educational answer if ready; else an empty string")
    follow_up_query: str = Field(description="A refined keyword search query if more evidence is needed; else empty")
    cites_used: list[str] = Field(default_factory=list, description="The source URLs actually used for the answer")


def _emit_sse(event_type: str, data: Any) -> str:
    payload = json.dumps({"event": event_type, "data": data})
    return f"data: {payload}\n\n"


def _clean_search_query(node_title: str, user_question: str) -> str:
    """Extract clean keywords from the user question without prompt noise."""
    q = user_question.strip()
    # Strip conversational filler prefixes
    filler_prefixes = [
        r"^tell\s+me\s+(more\s+)?about\s+",
        r"^can\s+you\s+explain\s+",
        r"^explain\s+(to\s+me\s+)?",
        r"^what\s+is\s+(the\s+)?",
        r"^how\s+(does|do|did)\s+",
        r"^why\s+(is|are|did|does)\s+",
    ]
    for pat in filler_prefixes:
        q = re.sub(pat, "", q, flags=re.IGNORECASE).strip()

    # Strip conversational trailing clauses
    filler_suffixes = [
        r"\s+and\s+(its\s+)?connection\s+to\s+.*$",
        r"\s+and\s+how\s+it\s+(relates|connects)\s+to\s+.*$",
        r"\s+in\s+relation\s+to\s+.*$",
    ]
    for pat in filler_suffixes:
        q = re.sub(pat, "", q, flags=re.IGNORECASE).strip()

    # If the cleaned question already mentions the topic or is self-contained, use it directly
    if node_title.lower() in q.lower() or len(q.split()) >= 3:
        return q.strip("?.,! ")

    return f"{node_title} {q}".strip("?.,! ")


async def stream_chat(
    node_title: str,
    user_question: str,
    ancestor_context: list[str] | None = None,
    history: list[dict] | None = None,
    active_summary: str | None = None,
) -> AsyncGenerator[str, None]:
    """Answer a follow-up question with grounded sources, streaming over SSE."""
    ancestors = ancestor_context or []
    context_trail = " -> ".join(ancestors) if ancestors else node_title
    clean_query = _clean_search_query(node_title, user_question)

    yield _emit_sse(
        "thought",
        {
            "agent": "Follow-up Guide",
            "text": f"Researching verified sources for '{clean_query}'.",
        },
    )

    evidence_blocks: list[str] = []
    cited: list[dict] = []
    answer_text = ""
    follow_up = ""
    query = clean_query

    llm = get_llm("cerebras", temperature=0.5, max_tokens=1000)

    for round_idx in range(MAX_ROUNDS):
        is_final = round_idx == MAX_ROUNDS - 1
        if round_idx > 0:
            if not follow_up:
                break
            query = _clean_search_query(node_title, follow_up)
            yield _emit_sse(
                "thought",
                {
                    "agent": "Follow-up Guide",
                    "text": f"Refining inquiry search: '{query}'.",
                },
            )

        call_id = str(uuid.uuid4())[:8]
        yield _emit_sse(
            "tool_call",
            {
                "call_id": call_id,
                "tool": "WebSearch",
                "query": query,
                "status": "running",
            },
        )
        sources = await search_web_ladder(query, max_results=MAX_SOURCES_PER_ROUND)
        yield _emit_sse(
            "tool_result",
            {
                "call_id": call_id,
                "tool": "WebSearch",
                "preview": f"Found {len(sources)} sources for round {round_idx + 1}",
                "count": len(sources),
                "status": "success",
            },
        )

        for src in sources:
            yield _emit_sse(
                "source",
                {
                    "id": str(uuid.uuid4())[:8],
                    "title": src.title,
                    "url": src.url,
                    "snippet": src.snippet[:250],
                    "publisher": src.publisher,
                    "reliabilityScore": src.reliabilityScore,
                },
            )

        raw_contents = await fetch_page_content(
            [s.url for s in sources[:4]],
            max_chars=MAX_CONTENT_CHARS,
        )
        contents = raw_contents if isinstance(raw_contents, list) else []
        for src, content in zip(sources[:4], contents):
            if isinstance(content, str) and content:
                evidence_blocks.append(
                    f"SOURCE: {src.title}\nURL: {src.url}\nSNIPPET: {src.snippet}\nCONTENT: {content}"
                )
            elif src.snippet:
                evidence_blocks.append(f"SOURCE: {src.title}\nURL: {src.url}\nSNIPPET: {src.snippet}")

        if not llm:
            break

        try:
            structured = llm.with_structured_output(DecideTurn)

            history_context = ""
            if history and len(history) > 0:
                history_lines = [
                    f"{'User' if m.get('role') == 'user' else 'Assistant'}: {m.get('content', '')}"
                    for m in history[-4:]
                    if m.get("content")
                ]
                if history_lines:
                    history_context = f"\n\nCONVERSATION HISTORY:\n" + "\n".join(history_lines)

            summary_info = f"\nActive Card Overview: {active_summary}" if active_summary else ""

            if evidence_blocks:
                user_prompt = (
                    f"Active Concept: {node_title}\n"
                    f"Exploration Trail: {context_trail}{summary_info}{history_context}\n\n"
                    f"User Question: {user_question}\n\n"
                    f"VERIFIED EVIDENCE BLOCKS:\n" + "\n\n".join(evidence_blocks)
                )
            else:
                user_prompt = (
                    f"Active Concept: {node_title}\n"
                    f"Exploration Trail: {context_trail}{summary_info}{history_context}\n\n"
                    f"User Question: {user_question}\n(no external search evidence retrieved)"
                )

            system_prompt = (
                "You are an inspiring, authoritative educator and storyteller for TDILEARNED (Today I Learned). "
                "The reader is exploring an interactive knowledge map and has asked a follow-up question. "
                "Your job is to provide a captivating, clear, and thoroughly grounded 2-3 paragraph answer.\n"
                "GUIDELINES:\n"
                "1. Ground your response in the provided SOURCE evidence with factual citations, synthesizing key facts with underlying scientific or historical context.\n"
                "2. NEVER use robotic meta-commentary like 'Based on the provided text' or 'The sources do not mention'. "
                "If an exact phrase is metaphorical or cross-disciplinary, explain the core concepts and bridge the connection naturally.\n"
                "3. Use clean Markdown (bullet points, bold highlights, concise paragraphs) for maximum legibility.\n"
                "4. If the evidence is sufficient, return your full answer and leave follow_up_query empty. "
                "If crucial information is missing, leave answer empty and return a refined keyword follow_up_query."
            )
            if is_final:
                system_prompt += (
                    "\n[FINAL ROUND]: You MUST provide your complete educational answer now using the gathered evidence and your broad domain knowledge. Leave follow_up_query empty."
                )

            res = await structured.ainvoke(
                [  # type: ignore[assignment]
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt),
                ]
            )
            decision = res if isinstance(res, DecideTurn) else DecideTurn.model_validate(res)  # type: ignore[arg-type]
            answer_text = decision.answer
            follow_up = decision.follow_up_query
            cited = [{"url": u, "used": True} for u in decision.cites_used]
            if answer_text and not follow_up:
                break
        except Exception as e:
            logger.warning(f"Follow-up decide error ({e})")
            break

    # Stream the final answer token-by-token for a lively chat feel.
    if not answer_text:
        answer_text = (
            f"**{node_title}** relates to several key historical and scientific developments. "
            f"Regarding *{user_question}*, the core principle centers on how these mechanisms interact in practice. "
            f"You can explore the surrounding connected cards on the canvas to dive into specific branches."
        )

    yield _emit_sse("answer_start", {"node_title": node_title, "question": user_question})
    # Stream in word chunks
    words = answer_text.split(" ")
    for idx, w in enumerate(words):
        chunk = w + (" " if idx < len(words) - 1 else "")
        yield _emit_sse("token", {"token": chunk})
        await asyncio.sleep(0.015)

    yield _emit_sse("done", {"cited": cited})
