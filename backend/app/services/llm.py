"""
Model-agnostic LLM provider factory.
Every agent node obtains its LLM through get_llm(), so swapping hardware
providers (Cerebras for live inference, Mistral for batch precompute) is a
configuration change, not a code change. Both expose OpenAI-compatible APIs.
"""

import logging
import os
from dataclasses import dataclass

from langchain_openai import ChatOpenAI
from pydantic import SecretStr

logger = logging.getLogger(__name__)

_CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1"
_MISTRAL_BASE_URL = "https://api.mistral.ai/v1"

_THIRD_PARTY_HEADER = "X-Cerebras-3rd-Party-Integration"
_THIRD_PARTY_VALUE = "infinite-curiosity-engine"


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
    return ChatOpenAI(
        model=config.model,
        api_key=SecretStr(config.api_key),
        base_url=config.base_url,
        temperature=temperature,
        max_completion_tokens=max_tokens,
        default_headers={_THIRD_PARTY_HEADER: _THIRD_PARTY_VALUE},
    )
