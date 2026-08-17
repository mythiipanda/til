"""
Model-agnostic LLM provider factory.
Every agent node obtains its LLM through get_llm(), so swapping hardware
providers (Cerebras for live inference, Mistral for batch precompute) is a
configuration change, not a code change. Both expose OpenAI-compatible APIs.

All returned clients are wrapped in a concurrency guard: a global semaphore
caps simultaneous in-flight LLM calls (Cerebras queues concurrent requests
and returns 429 queue_exceeded under load), and OpenAI's built-in retry logic
handles 429/5xx with exponential backoff.
"""

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any

from dotenv import load_dotenv

# Ensure environment variables from .env.local and .env are loaded
load_dotenv(
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), ".env.local"
    )
)
load_dotenv()

from langchain_core.callbacks import AsyncCallbackManagerForLLMRun
from langchain_core.messages import BaseMessage
from langchain_core.outputs import ChatResult
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

logger = logging.getLogger(__name__)

_CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1"
_MISTRAL_BASE_URL = "https://api.mistral.ai/v1"

_THIRD_PARTY_HEADER = "X-Cerebras-3rd-Party-Integration"
_THIRD_PARTY_VALUE = "tdilearned-agent"

# Max concurrent in-flight LLM requests across the whole backend. Cerebras
# throttles above this (429 queue_exceeded), and parallel researchers in the
# map-reduce graph would otherwise trip it.
MAX_CONCURRENT_LLM_CALLS = int(os.getenv("MAX_CONCURRENT_LLM_CALLS", "2"))

# OpenAI SDK retry policy: retry up to N times with exponential backoff on
# rate limits (429) and transient 5xx errors.
OPENAI_MAX_RETRIES = int(os.getenv("OPENAI_MAX_RETRIES", "3"))

_global_llm_semaphore = asyncio.Semaphore(MAX_CONCURRENT_LLM_CALLS)


class GuardedChatOpenAI(ChatOpenAI):
    """ChatOpenAI wrapped with a global concurrency semaphore.

    Every generation path (ainvoke, with_structured_output, streaming) funnels
    through _agenerate/_generate, so guarding those two methods serializes the
    actual HTTP calls without touching any call site.
    """

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        async with _global_llm_semaphore:
            return await super()._agenerate(messages, stop=stop, run_manager=run_manager, **kwargs)


@dataclass(frozen=True)
class ProviderConfig:
    engine: str
    api_key: str | None
    model: str | None
    base_url: str | None


def _resolve(engine: str) -> ProviderConfig:
    """Resolve a provider's config from environment variables."""
    engine = engine.lower()
    if engine == "cerebras":
        return ProviderConfig(
            engine=engine,
            api_key=os.getenv("CEREBRAS_API_KEY"),
            model=os.getenv("CEREBRAS_MODEL", "gemma-4-31b"),
            base_url=_CEREBRAS_BASE_URL,
        )
    if engine == "mistral":
        return ProviderConfig(
            engine=engine,
            api_key=os.getenv("MISTRAL_API_KEY"),
            model=os.getenv("MISTRAL_MODEL", "ministral-8b-2512"),
            base_url=_MISTRAL_BASE_URL,
        )
    raise ValueError(f"Unknown LLM engine '{engine}'. Use 'cerebras' or 'mistral'.")


def get_llm(
    engine: str = "cerebras",
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> ChatOpenAI | None:
    """Return a configured ChatOpenAI client for the given provider engine.

    Returns None when the provider has no API key configured, so callers can
    degrade to local fallbacks instead of crashing.
    """
    config = _resolve(engine)
    if not config.api_key or not config.model:
        logger.warning(f"No API key configured for engine '{engine}'; returning None")
        return None
    return GuardedChatOpenAI(
        model=config.model,
        api_key=SecretStr(config.api_key),
        base_url=config.base_url,
        temperature=temperature,
        max_completion_tokens=max_tokens,
        max_retries=OPENAI_MAX_RETRIES,
        default_headers={_THIRD_PARTY_HEADER: _THIRD_PARTY_VALUE},
    )
