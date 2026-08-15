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

    answer: str = Field(description="Final grounded answer if ready; else an empty string")
    follow_up_query: str = Field(description="A refined search query if more evidence is needed; else empty")
    cites_used: list[str] = Field(description="The source URLs actually used for the answer")


def _emit_sse(event_type: str, data: Any) -> str:
    payload = json.dumps({"event": event_type, "data": data})
    return f"data: {payload}\n\n"


async def stream_chat(
    node_title: str,
    user_question: str,
    ancestor_context: list[str] | None = None,
) -> AsyncGenerator[str, None]:
    """Answer a follow-up question with grounded sources, streaming over SSE."""
    start = time.time()
    ancestors = ancestor_context or []
    context_trail = " -> ".join(ancestors) if ancestors else node_title

    yield _emit_sse(
        "thought",
        {
            "agent": "Follow-up Guide",
            "text": f"Searching for fresh, verifiable sources about '{user_question[:60]}'.",
        },
    )

    evidence_blocks: list[str] = []
    cited: list[dict] = []
    answer_text = ""
    follow_up = ""
    query = f"{node_title} {user_question}"

    llm = get_llm("cerebras", temperature=0.5, max_tokens=1000)

    for round_idx in range(MAX_ROUNDS):
        is_final = round_idx == MAX_ROUNDS - 1
        if round_idx > 0:
            if not follow_up:
                break
            query = follow_up
            yield _emit_sse(
                "thought",
                {
                    "agent": "Follow-up Guide",
                    "text": f"Refining the search: '{follow_up[:60]}'.",
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
            if evidence_blocks:
                user_prompt = (
                    f"Topic: {node_title}\nContext trail: {context_trail}\n"
                    f"Question: {user_question}\n\n" + "\n\n".join(evidence_blocks)
                )
            else:
                user_prompt = f"Topic: {node_title}\nQuestion: {user_question}\n(no evidence yet)"
            system_prompt = (
                "You are a helpful guide answering a reader's question about a topic they just explored. "
                "CRITICAL RULES: answer ONLY from the provided SOURCE blocks; never invent facts or URLs. "
                "Use a friendly, concise 2-3 paragraph style. If the evidence is enough, return the answer "
                "and leave follow_up_query empty. If the evidence is thin or misses the question, leave "
                "answer empty and return ONE refined follow_up_query."
            )
            if is_final:
                system_prompt += (
                    "\nThis is your FINAL round: you MUST now answer using the evidence you have, even if "
                    "partial. If the evidence does not fully answer the question, say so honestly and give "
                    "the best-grounded answer you can. Leave follow_up_query empty."
                )
            res = await structured.ainvoke(
                [  # type: ignore[assignment]
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt),
                ]
            )
            decision = res if isinstance(res, DecideTurn) else DecideTurn.model_validate(res)  # type: ignore[arg-type]
            logger.info(
                f"Follow-up decide round {round_idx + 1}: answer={bool(decision.answer)} follow_up={decision.follow_up_query[:60]!r} cites={decision.cites_used}"
            )
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
            f"I gathered a few sources about **{node_title}** but couldn't find a "
            f"clear, verified answer to that specific question. Try asking about a "
            f"specific event, person, or mechanism, and I'll dig deeper."
        )

    yield _emit_sse("answer_start", {"cites": cited, "sources_count": len(evidence_blocks)})
    for word in answer_text.split(" "):
        yield _emit_sse("token", {"token": word + " "})
        await asyncio.sleep(0.004)

    elapsed_ms = (time.time() - start) * 1000
    yield _emit_sse("done", {"execution_time_ms": elapsed_ms})
