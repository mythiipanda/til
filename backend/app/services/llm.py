"""
Model-agnostic LLM provider factory.
Supports Cerebras, Mistral, and OpenRouter, with models discovered dynamically
from each provider's live API. Swapping hardware providers is a configuration
change, not a code change.
"""

import asyncio
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
from dotenv import load_dotenv

# Ensure environment variables from .env.local and .env are loaded
load_dotenv(
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), ".env.local"
    )
)
load_dotenv()

from langchain_core.callbacks import AsyncCallbackManagerForLLMRun
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.outputs import ChatResult
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from app.schemas.graph import ModelCatalogResponse, ModelOptionSchema

logger = logging.getLogger(__name__)

_CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1"
_MISTRAL_BASE_URL = "https://api.mistral.ai/v1"
_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

_THIRD_PARTY_HEADER = "X-Cerebras-3rd-Party-Integration"
_THIRD_PARTY_VALUE = "tdilearned-agent"

MAX_CONCURRENT_LLM_CALLS = int(os.getenv("MAX_CONCURRENT_LLM_CALLS", "6"))
LLM_REQUEST_TIMEOUT = float(os.getenv("LLM_REQUEST_TIMEOUT", "60"))
OPENAI_MAX_RETRIES = int(os.getenv("OPENAI_MAX_RETRIES", "3"))

_global_llm_semaphore = asyncio.Semaphore(MAX_CONCURRENT_LLM_CALLS)


class GuardedChatOpenAI(ChatOpenAI):
    """ChatOpenAI wrapped with a global concurrency semaphore."""

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
    default_headers: dict[str, str] = field(default_factory=dict)
    extra_body: dict[str, Any] = field(default_factory=dict)


_cerebras_cache: list[dict[str, Any]] = []
_cerebras_cache_time: float = 0.0

_mistral_cache: list[dict[str, Any]] = []
_mistral_cache_time: float = 0.0

_openrouter_free_cache: list[dict[str, Any]] = []
_openrouter_free_cache_time: float = 0.0

_CACHE_TTL_SECONDS: float = 600.0  # 10 minutes


async def fetch_cerebras_models() -> list[dict[str, Any]]:
    """Query Cerebras API dynamically for available models."""
    global _cerebras_cache, _cerebras_cache_time
    now = time.time()
    if _cerebras_cache and (now - _cerebras_cache_time < _CACHE_TTL_SECONDS):
        return _cerebras_cache

    key = os.getenv("CEREBRAS_API_KEY")
    if not key:
        return [
            {
                "id": "cerebras:gemma-4-31b",
                "name": "Gemma 4 31B",
                "provider": "cerebras",
                "provider_label": "Cerebras",
                "model_id": "gemma-4-31b",
                "is_free": True,
            },
            {
                "id": "cerebras:gpt-oss-120b",
                "name": "GPT-OSS 120B",
                "provider": "cerebras",
                "provider_label": "Cerebras",
                "model_id": "gpt-oss-120b",
                "is_free": True,
            },
        ]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"{_CEREBRAS_BASE_URL}/models",
                headers={
                    "Authorization": f"Bearer {key}",
                    _THIRD_PARTY_HEADER: _THIRD_PARTY_VALUE,
                },
            )
            if res.status_code == 200:
                raw = res.json().get("data", [])
                models: list[dict[str, Any]] = []
                for m in raw:
                    m_id = m.get("id", "")
                    clean_name = m_id.replace("-it", "").replace("-instruct", "").replace("-", " ").title()
                    models.append(
                        {
                            "id": f"cerebras:{m_id}",
                            "name": clean_name,
                            "provider": "cerebras",
                            "provider_label": "Cerebras",
                            "model_id": m_id,
                            "is_free": True,
                        }
                    )
                if models:
                    _cerebras_cache = models
                    _cerebras_cache_time = now
                    return models
    except Exception as e:
        logger.warning(f"Failed to dynamically query Cerebras models: {e}")

    return _cerebras_cache or [
        {
            "id": "cerebras:gemma-4-31b",
            "name": "Gemma 4 31B",
            "provider": "cerebras",
            "provider_label": "Cerebras",
            "model_id": "gemma-4-31b",
            "is_free": True,
        }
    ]


async def fetch_mistral_models() -> list[dict[str, Any]]:
    """Query Mistral API dynamically for chat and reasoning models."""
    global _mistral_cache, _mistral_cache_time
    now = time.time()
    if _mistral_cache and (now - _mistral_cache_time < _CACHE_TTL_SECONDS):
        return _mistral_cache

    key = os.getenv("MISTRAL_API_KEY")
    if not key:
        return [
            {
                "id": "mistral:ministral-8b-2512",
                "name": "Ministral 8B",
                "provider": "mistral",
                "provider_label": "Mistral AI",
                "model_id": "ministral-8b-2512",
                "is_free": True,
            },
            {
                "id": "mistral:ministral-3b-2512",
                "name": "Ministral 3B",
                "provider": "mistral",
                "provider_label": "Mistral AI",
                "model_id": "ministral-3b-2512",
                "is_free": True,
            },
            {
                "id": "mistral:mistral-small-latest",
                "name": "Mistral Small",
                "provider": "mistral",
                "provider_label": "Mistral AI",
                "model_id": "mistral-small-latest",
                "is_free": True,
            },
        ]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"{_MISTRAL_BASE_URL}/models",
                headers={"Authorization": f"Bearer {key}"},
            )
            if res.status_code == 200:
                raw = res.json().get("data", [])
                models: list[dict[str, Any]] = []
                seen = set()
                # Curate prominent chat models (ignore embed, moderation, ocr, audio)
                for m in raw:
                    m_id = m.get("id", "")
                    if any(x in m_id for x in ("embed", "moderation", "ocr", "voxtral", "tts")):
                        continue
                    if m_id not in seen:
                        seen.add(m_id)
                        clean_name = m_id.replace("-latest", "").replace("-", " ").title()
                        models.append(
                            {
                                "id": f"mistral:{m_id}",
                                "name": clean_name,
                                "provider": "mistral",
"provider_label": "Mistral AI",
                                "model_id": m_id,
                                "is_free": True,
                            }
                        )
                if models:
                    _mistral_cache = models
                    _mistral_cache_time = now
                    return models
    except Exception as e:
        logger.warning(f"Failed to dynamically query Mistral models: {e}")

    return _mistral_cache or [
        {
            "id": "mistral:ministral-8b-2512",
            "name": "Ministral 8B",
            "provider": "mistral",
            "provider_label": "Mistral AI",
            "model_id": "ministral-8b-2512",
            "is_free": True,
        }
    ]


async def fetch_openrouter_free_models() -> list[dict[str, Any]]:
    """Query OpenRouter API dynamically to find and format all free models."""
    global _openrouter_free_cache, _openrouter_free_cache_time
    now = time.time()
    if _openrouter_free_cache and (now - _openrouter_free_cache_time < _CACHE_TTL_SECONDS):
        return _openrouter_free_cache

    headers: dict[str, str] = {"HTTP-Referer": "https://tdilearned.com", "X-Title": "TDILEARNED"}
    key = os.getenv("OPENROUTER_API_KEY")
    if key:
        headers["Authorization"] = f"Bearer {key}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(f"{_OPENROUTER_BASE_URL}/models", headers=headers)
            if res.status_code == 200:
                data = res.json()
                raw_models = data.get("data", [])

                discovered: list[dict[str, Any]] = []
                seen_ids = set()

                for m in raw_models:
                    m_id = m.get("id", "")
                    m_name = m.get("name", "")
                    arch = m.get("architecture", {}) or {}
                    out_modalities = arch.get("output_modalities", ["text"])

                    # Ensure it's text generation capable (exclude image/audio-only)
                    if "text" not in out_modalities:
                        continue

                    is_free = ":free" in m_id.lower() or m_id == "openrouter/free" or "(free)" in m_name.lower()

                    # Exclude safety guardrail / rerank-only models from primary generative selector
                    if not is_free or "content-safety" in m_id.lower() or "rerank" in m_id.lower():
                        continue

                    if m_id not in seen_ids:
                        seen_ids.add(m_id)

                        # Format clean display name
                        clean_name = m_name.replace("(free)", "").replace(":free", "").strip()
                        if ":" in clean_name:
                            clean_name = clean_name.split(":", 1)[1].strip()

                        discovered.append(
                            {
                                "id": f"openrouter:{m_id}",
                                "name": clean_name,
                                "provider": "openrouter",
                                "provider_label": "OpenRouter",
                                "model_id": m_id,
                                "is_free": True,
                            }
                        )

                if discovered:
                    _openrouter_free_cache = discovered
                    _openrouter_free_cache_time = now
                    return discovered
    except Exception as e:
        logger.warning(f"Failed to dynamically fetch OpenRouter free models: {e}")

    return _openrouter_free_cache or [
        {
            "id": "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free",
            "name": "Nemotron 3 Ultra",
            "provider": "openrouter",
            "provider_label": "OpenRouter",
            "model_id": "nvidia/nemotron-3-ultra-550b-a55b:free",
            "is_free": True,
        }
    ]


def _parse_engine_and_model(engine: str, model: str | None = None) -> tuple[str, str | None]:
    """Parse unified model strings like 'openrouter:deepseek/deepseek-chat:free' or 'cerebras'."""
    eng = engine.strip().lower()
    if ":" in engine:
        prov, explicit_mod = engine.split(":", 1)
        return prov.strip().lower(), explicit_mod.strip()
    return eng, model


def _resolve(engine: str, model: str | None = None) -> ProviderConfig:
    """Resolve a provider's config from environment variables or explicit model parameters."""
    eng, resolved_model = _parse_engine_and_model(engine, model)
    if eng == "cerebras":
        return ProviderConfig(
            engine="cerebras",
            api_key=os.getenv("CEREBRAS_API_KEY"),
            model=resolved_model or os.getenv("CEREBRAS_MODEL", "gemma-4-31b"),
            base_url=_CEREBRAS_BASE_URL,
            default_headers={_THIRD_PARTY_HEADER: _THIRD_PARTY_VALUE},
        )
    if eng == "mistral":
        return ProviderConfig(
            engine="mistral",
            api_key=os.getenv("MISTRAL_API_KEY"),
            model=resolved_model or os.getenv("MISTRAL_MODEL", "ministral-8b-2512"),
            base_url=_MISTRAL_BASE_URL,
        )
    if eng == "openrouter":
        return ProviderConfig(
            engine="openrouter",
            api_key=os.getenv("OPENROUTER_API_KEY"),
            model=resolved_model or os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free"),
            base_url=_OPENROUTER_BASE_URL,
            default_headers={"HTTP-Referer": "https://tdilearned.com", "X-Title": "TDILEARNED"},
            extra_body={"reasoning": {"effort": "low", "exclude": True}},
        )
    raise ValueError(f"Unknown LLM engine '{eng}'. Use 'cerebras', 'mistral', or 'openrouter'.")


async def get_available_models_async() -> ModelCatalogResponse:
    """Return all models dynamically queried across Cerebras, Mistral, and OpenRouter APIs."""
    cerebras_key = bool(os.getenv("CEREBRAS_API_KEY"))
    mistral_key = bool(os.getenv("MISTRAL_API_KEY"))
    openrouter_key = bool(os.getenv("OPENROUTER_API_KEY"))

    cerebras_models, mistral_models, openrouter_models = await asyncio.gather(
        fetch_cerebras_models(),
        fetch_mistral_models(),
        fetch_openrouter_free_models(),
    )

    catalog_entries = cerebras_models + mistral_models + openrouter_models

    models: list[ModelOptionSchema] = []
    for item in catalog_entries:
        prov = item["provider"]
        is_avail = (
            (prov == "cerebras" and cerebras_key)
            or (prov == "mistral" and mistral_key)
            or (prov == "openrouter" and (openrouter_key or True))
        )
        models.append(
            ModelOptionSchema(
                id=item["id"],
                name=item["name"],
                provider=item["provider"],
                provider_label=item["provider_label"],
                model_id=item["model_id"],
                is_free=item.get("is_free", True),
                is_available=is_avail,
            )
        )

    default_model = (
        "cerebras:gemma-4-31b"
        if cerebras_key
        else (
            "mistral:ministral-8b-2512"
            if mistral_key
            else (
                openrouter_models[0]["id"] if openrouter_models else "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free"
            )
        )
    )
    return ModelCatalogResponse(default_model=default_model, models=models)


def get_available_models() -> ModelCatalogResponse:
    """Synchronous fallback returning current cached catalog."""
    cerebras_key = bool(os.getenv("CEREBRAS_API_KEY"))
    mistral_key = bool(os.getenv("MISTRAL_API_KEY"))
    openrouter_key = bool(os.getenv("OPENROUTER_API_KEY"))

    catalog_entries = (
        (
            _cerebras_cache
            or [
                {
                    "id": "cerebras:gemma-4-31b",
                    "name": "Gemma 4 31B",
                    "provider": "cerebras",
                    "provider_label": "Cerebras",
                    "model_id": "gemma-4-31b",
                    "is_free": True,
                }
            ]
        )
        + (
            _mistral_cache
            or [
                {
                    "id": "mistral:ministral-8b-2512",
                    "name": "Ministral 8B",
                    "provider": "mistral",
                    "provider_label": "Mistral AI",
                    "model_id": "ministral-8b-2512",
                    "is_free": True,
                }
            ]
        )
        + (
            _openrouter_free_cache
            or [
                {
                    "id": "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free",
                    "name": "Nemotron 3 Ultra",
                    "provider": "openrouter",
                    "provider_label": "OpenRouter",
                    "model_id": "nvidia/nemotron-3-ultra-550b-a55b:free",
                    "is_free": True,
                }
            ]
        )
    )

    models: list[ModelOptionSchema] = []
    for item in catalog_entries:
        prov = item["provider"]
        is_avail = (
            (prov == "cerebras" and cerebras_key)
            or (prov == "mistral" and mistral_key)
            or (prov == "openrouter" and (openrouter_key or True))
        )
        models.append(
            ModelOptionSchema(
                id=item["id"],
                name=item["name"],
                provider=item["provider"],
                provider_label=item["provider_label"],
                model_id=item["model_id"],
                is_free=item.get("is_free", True),
                is_available=is_avail,
            )
        )

    default_model = (
        "cerebras:gemma-4-31b"
        if cerebras_key
        else ("mistral:ministral-8b-2512" if mistral_key else "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free")
    )
    return ModelCatalogResponse(default_model=default_model, models=models)


def get_llm(
    engine: str = "cerebras",
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4000,
) -> ChatOpenAI | None:
    """Return a configured ChatOpenAI client for the given provider engine and model."""
    config = _resolve(engine, model)
    if not config.api_key or not config.model:
        logger.warning(f"No API key configured for engine '{config.engine}'; returning None")
        return None
    eff_tokens = max(max_tokens, 8192) if config.engine == "openrouter" else max_tokens
    return GuardedChatOpenAI(
        model=config.model,
        api_key=SecretStr(config.api_key),
        base_url=config.base_url,
        temperature=temperature,
        max_completion_tokens=eff_tokens,
        max_retries=OPENAI_MAX_RETRIES,
        timeout=LLM_REQUEST_TIMEOUT,
        default_headers=config.default_headers,
        extra_body=config.extra_body if config.extra_body else None,
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
        # 1. Try primary provider with structured output
        if self._primary is not None:
            try:
                return await self._primary.with_structured_output(self._schema).ainvoke(messages, **kwargs)
            except Exception as e:
                err_str = str(e)
                json_match = re.search(r"(\{[\s\S]*\})", err_str)
                if json_match:
                    try:
                        return self._schema.model_validate_json(json_match.group(1))
                    except Exception:
                        pass
                logger.warning(f"Structured call failed on primary provider ({e}); falling back")

        # 2. Try fallback provider with structured output
        if self._fallback is not None:
            try:
                return await self._fallback.with_structured_output(self._schema).ainvoke(messages, **kwargs)
            except Exception as e:
                err_str = str(e)
                json_match = re.search(r"(\{[\s\S]*\})", err_str)
                if json_match:
                    try:
                        return self._schema.model_validate_json(json_match.group(1))
                    except Exception:
                        pass
                logger.warning(f"Structured call failed on fallback provider ({e}); attempting JSON repair")

        # 3. Direct JSON schema repair fallback
        active_llm = self._fallback or self._primary
        if active_llm is not None:
            import json

            schema_json = json.dumps(self._schema.model_json_schema(), indent=2)
            repair_messages = list(messages) + [
                SystemMessage(
                    content=(
                        "CRITICAL: Output MUST be a valid, well-formed JSON object matching this schema:\n"
                        f"```json\n{schema_json}\n```\n"
                        "Output ONLY raw valid JSON. Do not include markdown tags or explanation."
                    )
                )
            ]
            raw_res = await active_llm.ainvoke(repair_messages, **kwargs)
            content = raw_res.content if hasattr(raw_res, "content") else str(raw_res)
            if not isinstance(content, str):
                content = str(content)
            try:
                json_match = re.search(r"(\{[\s\S]*\})", content)
                json_str = json_match.group(1) if json_match else content
                return self._schema.model_validate_json(json_str)
            except Exception as parse_err:
                logger.error(f"JSON schema repair parse failed ({parse_err})")

        raise RuntimeError("No LLM provider available for structured output")


class FallbackLLM:
    """Provider that tries a primary engine and fails over to a fallback engine."""

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
    model: str | None = None,
    fallback_engine: str = "mistral",
    fallback_model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4000,
) -> FallbackLLM:
    """Return a primary LLM with fail-over to the fallback provider."""
    primary_config = _resolve(engine, model)
    primary = None
    if primary_config.api_key and primary_config.model:
        pri_tokens = max(max_tokens, 8192) if primary_config.engine == "openrouter" else max_tokens
        primary = GuardedChatOpenAI(
            model=primary_config.model,
            api_key=SecretStr(primary_config.api_key),
            base_url=primary_config.base_url,
            temperature=temperature,
            max_completion_tokens=pri_tokens,
            max_retries=0,
            timeout=LLM_REQUEST_TIMEOUT,
            default_headers=primary_config.default_headers,
            extra_body=primary_config.extra_body if primary_config.extra_body else None,
        )
    else:
        logger.warning(f"No API key configured for primary engine '{primary_config.engine}'; using fallback")

    # If primary is already mistral or openrouter, fallback is cerebras or mistral
    fb_engine = (
        fallback_engine
        if primary_config.engine != fallback_engine
        else ("cerebras" if fallback_engine != "cerebras" else "mistral")
    )
    fallback_config = _resolve(fb_engine, fallback_model)
    fallback = None
    if fallback_config.api_key and fallback_config.model:
        fb_tokens = max(max_tokens, 8192) if fallback_config.engine == "openrouter" else max_tokens
        fallback = GuardedChatOpenAI(
            model=fallback_config.model,
            api_key=SecretStr(fallback_config.api_key),
            base_url=fallback_config.base_url,
            temperature=temperature,
            max_completion_tokens=fb_tokens,
            max_retries=OPENAI_MAX_RETRIES,
            timeout=LLM_REQUEST_TIMEOUT,
            default_headers=fallback_config.default_headers,
            extra_body=fallback_config.extra_body if fallback_config.extra_body else None,
        )
    else:
        logger.warning(f"No API key configured for fallback engine '{fallback_config.engine}'")
    return FallbackLLM(primary, fallback)
