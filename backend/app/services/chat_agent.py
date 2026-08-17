"""
Lightweight follow-up Q&A agent (ReAct-style tool loop).

A single Cerebras agent answers user questions about an active node. Unlike the
full map-reduce research graph, this stays simple: it gathers fresh grounded
sources via the retrieval ladder, then streams a concise cited answer. A bounded
loop lets the agent issue a follow-up search when the first round is thin.
"""

import json
import logging
import os
import re
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.services.cache import cache_service
from app.services.llm import get_llm_with_fallback
from app.services.tools import fetch_page_content, search_web_ladder

logger = logging.getLogger(__name__)

MAX_ROUNDS = 2
MAX_SOURCES_PER_ROUND = 5
MAX_CONTENT_CHARS = 3500

# Live chat fail-over: if the primary Cerebras call exhausts its retries, fall
# back to this small fast Mistral model so Q&A keeps streaming under load.
LIVE_FALLBACK_MODEL = os.getenv("LIVE_FALLBACK_MODEL", "ministral-3b-2512")


class DecideTurn(BaseModel):
    """The agent's decision after reviewing gathered evidence."""

    answer: str = Field(description="Final grounded educational answer if ready; else an empty string")
    follow_up_query: str = Field(description="A refined keyword search query if more evidence is needed; else empty")
    cites_used: list[str] = Field(default_factory=list, description="The source URLs actually used for the answer")


class SuggestedFollowUps(BaseModel):
    """3 provocative curiosity follow-up questions for the user to explore next."""

    questions: list[str] = Field(
        description="Exactly 3 concise, high-curiosity questions under 10 words that lead deeper into the subject"
    )


def _emit_sse(event_type: str, data: Any) -> str:
    payload = json.dumps({"event": event_type, "data": data})
    return f"data: {payload}\n\n"


def _clean_search_query(node_title: str, user_question: str) -> str:
    """Extract clean keywords from the user question while preserving the topic entity."""
    q = user_question.strip()
    # Strip conversational filler prefixes
    filler_prefixes = [
        r"^tell\s+me\s+(more\s+)?about\s+",
        r"^can\s+you\s+(please\s+)?explain\s+",
        r"^explain\s+(to\s+me\s+)?",
        r"^what\s+(is|was|were|are)\s+(the\s+)?",
        r"^how\s+(does|do|did)\s+",
        r"^why\s+(is|are|did|does|was)\s+",
        r"^could\s+(you\s+)?",
        r"^what\s+role\s+did\s+",
        r"^is\s+there\s+any\s+",
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

    clean_q = q.strip("?.,! ")

    # Check if the user question already mentions key tokens from the entity title
    title_tokens = {t.lower() for t in re.findall(r"\w{3,}", node_title) if t.lower() not in {"the", "and", "for"}}
    q_tokens = {t.lower() for t in re.findall(r"\w{3,}", clean_q)}

    overlap = title_tokens.intersection(q_tokens)
    if len(overlap) == 0:
        return f"{node_title} {clean_q}".strip()
    return clean_q or node_title


async def stream_chat(
    node_title: str,
    user_question: str,
    node_id: str | None = None,
    ancestor_context: list[str] | None = None,
    history: list[dict] | None = None,
    active_summary: str | None = None,
) -> AsyncGenerator[str, None]:
    """Answer a follow-up question with grounded sources and cached monograph context, streaming over SSE."""
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

    # Pull cached canonical monograph if node_id is available
    monograph_canon = ""
    if node_id:
        dossier = cache_service.get(f"dossier:{node_id}")
        if isinstance(dossier, dict):
            thesis = dossier.get("coreThesis") or ""
            abstract = dossier.get("abstract") or ""
            wow = dossier.get("wowFact") or ""
            mechs = dossier.get("mechanisms", [])
            timeline = dossier.get("timeline", [])
            sources_dossier = dossier.get("sources", [])

            parts = [f"CANONICAL TOPIC: {dossier.get('title', node_title)}"]
            if thesis:
                parts.append(f"CORE THESIS: {thesis}")
            if abstract:
                parts.append(f"CANONICAL SUMMARY: {abstract}")
            if wow:
                parts.append(f"PROVEN KEY FACT: {wow}")
            if mechs:
                mech_str = "\n".join(f"- {m.get('title')}: {m.get('explanation')}" for m in mechs[:3] if isinstance(m, dict))
                if mech_str:
                    parts.append(f"VERIFIED MECHANISMS:\n{mech_str}")
            if timeline:
                time_str = "\n".join(
                    f"- [{t.get('date')}]: {t.get('headline')} — {t.get('description')}"
                    for t in timeline[:4]
                    if isinstance(t, dict)
                )
                if time_str:
                    parts.append(f"VERIFIED TIMELINE:\n{time_str}")
            if sources_dossier:
                src_str = "\n".join(
                    f"- [{s.get('title')}]({s.get('url')}): {s.get('snippet', '')[:100]}"
                    for s in sources_dossier[:3]
                    if isinstance(s, dict)
                )
                if src_str:
                    parts.append(f"ANCHOR SOURCES:\n{src_str}")

            monograph_canon = "\n\n" + "\n\n".join(parts)

    evidence_blocks: list[str] = []
    cited: list[dict] = []
    answer_text = ""
    follow_up = ""
    query = clean_query
    _streamed_live = False

    llm = get_llm_with_fallback(
        engine="cerebras",
        fallback_engine="mistral",
        fallback_model=LIVE_FALLBACK_MODEL,
        temperature=0.5,
        max_tokens=1000,
    )

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

        if not llm or not llm.is_available:
            break

        history_context = ""
        if history and len(history) > 0:
            history_lines = [
                f"{'User' if m.get('role') == 'user' else 'Assistant'}: {m.get('content', '')}"
                for m in history[-4:]
                if m.get("content")
            ]
            if history_lines:
                history_context = "\n\nCONVERSATION HISTORY:\n" + "\n".join(history_lines)

        summary_info = f"\nActive Card Overview: {active_summary}" if active_summary else ""

        if evidence_blocks:
            user_prompt = (
                f"Active Concept: {node_title}\n"
                f"Exploration Trail: {context_trail}{summary_info}{monograph_canon}{history_context}\n\n"
                f"User Question: {user_question}\n\n"
                f"VERIFIED EVIDENCE BLOCKS:\n" + "\n\n".join(evidence_blocks)
            )
        else:
            user_prompt = (
                f"Active Concept: {node_title}\n"
                f"Exploration Trail: {context_trail}{summary_info}{monograph_canon}{history_context}\n\n"
                f"User Question: {user_question}\n(no external search evidence retrieved)"
            )

        system_prompt = (
            "You are an inspiring, authoritative educator and storyteller for TDILEARNED (Today I Learned). "
            "The reader is exploring an interactive knowledge map and has asked a follow-up question. "
            "Your job is to provide a captivating, clear, and thoroughly grounded 2-3 paragraph answer.\n"
            "GUIDELINES:\n"
            "1. Ground your response in the provided CANON and SOURCE evidence with factual citations, synthesizing key facts with underlying scientific or historical context.\n"
            "2. NEVER use robotic meta-commentary like 'Based on the provided text' or 'The sources do not mention'. "
            "If an exact phrase is metaphorical or cross-disciplinary, explain the core concepts and bridge the connection naturally.\n"
            "3. Use clean Markdown (bullet points, bold highlights, concise paragraphs) for maximum legibility.\n"
            "4. If the evidence is sufficient, return your full answer and leave follow_up_query empty. "
            "If crucial information is missing, leave answer empty and return a refined keyword follow_up_query."
        )

        if is_final:
            # Final round: stream the answer token-by-token straight from the
            # model for a true live-chat feel (no post-hoc word chunking).
            system_prompt += (
                "\n[FINAL ROUND]: You MUST provide your complete educational answer now using the gathered evidence "
                "and your broad domain knowledge. Write the answer directly — no JSON envelope, no meta-commentary."
            )
            yield _emit_sse("answer_start", {"node_title": node_title, "question": user_question})
            streamed_chunks: list[str] = []
            _streamed_live = True
            try:
                async for chunk_msg in llm.astream(
                    [  # type: ignore[arg-type]
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=user_prompt),
                    ]
                ):
                    token = getattr(chunk_msg, "content", "") or ""
                    if token:
                        streamed_chunks.append(token)
                        yield _emit_sse("token", {"token": token})
            except Exception as e:
                logger.warning(f"Final answer stream error ({e})")
            answer_text = "".join(streamed_chunks)
            cited = [{"url": s.url, "used": True} for s in sources[:5]]
            follow_up = ""
            break

        try:
            structured = llm.with_structured_output(DecideTurn)
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

    # Fallback answer only when no live stream produced one
    if not answer_text:
        answer_text = (
            f"**{node_title}** relates to several key historical and scientific developments. "
            f"Regarding *{user_question}*, the core principle centers on how these mechanisms interact in practice. "
            f"You can explore the surrounding connected cards on the canvas to dive into specific branches."
        )

    if not _streamed_live:
        yield _emit_sse("answer_start", {"node_title": node_title, "question": user_question})
        for idx, w in enumerate(answer_text.split(" ")):
            chunk = w + (" " if idx < len(answer_text.split(" ")) - 1 else "")
            yield _emit_sse("token", {"token": chunk})

    # Proactively synthesize 3 dynamic follow-up questions to keep user exploring
    follow_ups: list[str] = []
    if llm and llm.is_available:
        try:
            structured_fu = llm.with_structured_output(SuggestedFollowUps)
            fu_res = await structured_fu.ainvoke(
                [  # type: ignore[assignment]
                    SystemMessage(
                        content=(
                            "You are a curiosity editor. Based on the topic and the answer just provided, "
                            "write exactly 3 short, intriguing, natural follow-up questions that a curious user would want to click next. "
                            "Questions must be under 10 words, provocative, and lead to deeper insights or connected phenomena."
                        )
                    ),
                    HumanMessage(
                        content=f"Topic: {node_title}\nUser Question: {user_question}\nAnswer: {answer_text[:1200]}"
                    ),
                ]
            )
            follow_ups = (
                fu_res.questions  # type: ignore[union-attr]
                if isinstance(fu_res, SuggestedFollowUps)
                else SuggestedFollowUps(**fu_res.model_dump()).questions  # type: ignore[union-attr]
            )
        except Exception as e:
            logger.warning(f"Failed to generate dynamic follow-up questions: {e}")

    if not follow_ups:
        follow_ups = [
            f"How does {node_title} work in practice?",
            f"What are the biggest misconceptions about {node_title}?",
            f"What historical events trace back to {node_title}?",
        ]

    yield _emit_sse("suggested_questions", follow_ups[:3])
    yield _emit_sse("done", {"cited": cited})
