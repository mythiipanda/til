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
MAX_CONCURRENT_LLM_CALLS = int(os.getenv("MAX_CONCURRENT_LLM_CALLS", "4"))

# Per-request timeout in seconds. Cerebras structured JSON can take a while on
# long generations; give the model room while still bounding worst-case latency.
LLM_REQUEST_TIMEOUT = float(os.getenv("LLM_REQUEST_TIMEOUT", "60"))

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
        timeout=LLM_REQUEST_TIMEOUT,
        default_headers={_THIRD_PARTY_HEADER: _THIRD_PARTY_VALUE},
    )


class _StructuredWithFallback:
    """Structured-output call that fails over from primary to fallback provider."""

    def __init__(
        self,
        primary: ChatOpenAI | None,
        fallback: ChatOpenAI | None,
        schema: type[Any],
    ) -> None:
        self._primary = primary
        self._fallback = fallback
        self._schema = schema

    async def ainvoke(self, messages: list[Any], **kwargs: Any) -> Any:
        if self._primary is not None:
            try:
                return await self._primary.with_structured_output(self._schema).ainvoke(messages, **kwargs)
            except Exception as e:
                logger.warning(f"Structured call failed on primary provider ({e}); falling back")
        if self._fallback is not None:
            return await self._fallback.with_structured_output(self._schema).ainvoke(messages, **kwargs)
        raise RuntimeError("No LLM provider available for structured output")


class FallbackLLM:
    """Provider that tries a primary engine and fails over to a fallback engine.

    The primary is created with ``max_retries=0`` so the first error hands off
    to the fallback provider immediately — no time wasted on backoff. Precompute
    callers keep using ``get_llm`` directly so their original model is never
    swapped.
    """

    def __init__(
        self,
        primary: ChatOpenAI | None,
        fallback: ChatOpenAI | None,
    ) -> None:
        self._primary = primary
        self._fallback = fallback

    @property
    def is_available(self) -> bool:
        return self._primary is not None or self._fallback is not None

    def with_structured_output(self, schema: type[Any]) -> _StructuredWithFallback:
        return _StructuredWithFallback(self._primary, self._fallback, schema)

    async def ainvoke(self, messages: list[Any], **kwargs: Any) -> Any:
        if self._primary is not None:
            try:
                return await self._primary.ainvoke(messages, **kwargs)
            except Exception as e:
                logger.warning(f"ainvoke failed on primary provider ({e}); falling back")
        if self._fallback is not None:
            return await self._fallback.ainvoke(messages, **kwargs)
        raise RuntimeError("No LLM provider available for ainvoke")

    async def astream(self, messages: list[Any], **kwargs: Any):
        if self._primary is not None:
            try:
                async for chunk in self._primary.astream(messages, **kwargs):
                    yield chunk
                return
            except Exception as e:
                logger.warning(f"Stream failed on primary provider ({e}); falling back")
        if self._fallback is not None:
            async for chunk in self._fallback.astream(messages, **kwargs):
                yield chunk
            return
        raise RuntimeError("No LLM provider available for streaming")


def get_llm_with_fallback(
    engine: str = "cerebras",
    fallback_engine: str = "mistral",
    fallback_model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> FallbackLLM:
    """Return a primary LLM with fail-over to the fallback provider.

    The primary is configured with ``max_retries=0`` so the *first* error
    (429/5xx/network) immediately hands off to the fallback provider rather
    than burning time on backoff. ``fallback_model`` overrides the fallback
    engine's default model (used for live chat where a fast small model is
    preferable under load).
    """
    primary_config = _resolve(engine)
    primary = None
    if primary_config.api_key and primary_config.model:
        primary = GuardedChatOpenAI(
            model=primary_config.model,
            api_key=SecretStr(primary_config.api_key),
            base_url=primary_config.base_url,
            temperature=temperature,
            max_completion_tokens=max_tokens,
            max_retries=0,
            timeout=LLM_REQUEST_TIMEOUT,
            default_headers={_THIRD_PARTY_HEADER: _THIRD_PARTY_VALUE},
        )
    else:
        logger.warning(f"No API key configured for engine '{engine}'; no primary available")

    fallback_config = _resolve(fallback_engine)
    fallback = None
    if fallback_config.api_key and fallback_config.model:
        model = fallback_model or fallback_config.model
        fallback = GuardedChatOpenAI(
            model=model,
            api_key=SecretStr(fallback_config.api_key),
            base_url=fallback_config.base_url,
            temperature=temperature,
            max_completion_tokens=max_tokens,
            max_retries=OPENAI_MAX_RETRIES,
            timeout=LLM_REQUEST_TIMEOUT,
            default_headers={_THIRD_PARTY_HEADER: _THIRD_PARTY_VALUE},
        )
    else:
        logger.warning(f"No API key configured for fallback engine '{fallback_engine}'; no fail-over available")
    return FallbackLLM(primary, fallback)
