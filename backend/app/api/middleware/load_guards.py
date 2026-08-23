"""
Process-wide load guards against cost explosions and abuse floods.

Two layers sit on top of the per-IP rate limiters:

1. DailyBudget - hard ceiling on expensive LLM-backed streams per UTC day.
   When the ceiling trips, endpoints return 429 and the frontend falls back
   to precomputed hub maps instead of showing an error. This guarantees the
   inference bill cannot exceed the free-tier allowance no matter how many
   IPs an attacker rotates.

2. StreamGate - global concurrency ceiling on live SSE streams. Protects the
   single B1 instance and keeps LLM quality-of-service sane under bursts;
   excess visitors get the precomputed-map fallback path.

Both are in-memory by design: the backend runs as one B1 instance, so
process memory is the correct scope. Tunables come from environment
variables so limits can be adjusted in Azure without a redeploy.
"""

import asyncio
import logging
import os
import time
from datetime import UTC, datetime

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        logger.warning(f"Invalid integer for {name}; using default {default}")
        return default


class DailyBudget:
    """UTC-day-scoped request counter with a hard ceiling."""

    def __init__(self, name: str, max_per_day: int) -> None:
        self.name = name
        self.max_per_day = max_per_day
        self._day = self._current_day()
        self._count = 0

    @staticmethod
    def _current_day() -> str:
        return datetime.now(UTC).strftime("%Y-%m-%d")

    def _rollover(self) -> None:
        today = self._current_day()
        if today != self._day:
            logger.info(f"[{self.name}] daily budget reset ({today}): {self._count} used yesterday")
            self._day = today
            self._count = 0

    def check_and_consume(self) -> bool:
        """Consume one unit of budget. Returns False when the day is exhausted."""
        self._rollover()
        if self._count >= self.max_per_day:
            return False
        self._count += 1
        return True

    @property
    def used(self) -> int:
        self._rollover()
        return self._count


class StreamGate:
    """Global asyncio semaphore with immediate rejection instead of queueing."""

    def __init__(self, name: str, max_concurrent: int) -> None:
        self.name = name
        self.max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def acquire(self) -> None:
        if self._semaphore.locked():
            # Fast-fail: the frontend serves a finished map on this signal.
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "Busy",
                    "message": "Too many live research sessions right now.",
                },
                headers={"Retry-After": "5"},
            )
        await self._semaphore.acquire()

    def release(self) -> None:
        self._semaphore.release()


def _reject(kind: str, retry_after: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "error": "Daily limit reached",
            "message": f"TDILEARNED hit its {kind} capacity for today. Finished maps remain open all day.",
            "retry_after": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )


class LoadGuard:
    """Combined daily budget + concurrency gate for one endpoint family."""

    def __init__(
        self,
        name: str,
        daily_budget_env: str,
        daily_budget_default: int,
        concurrency_env: str,
        concurrency_default: int,
    ) -> None:
        self.name = name
        self.budget = DailyBudget(name, _env_int(daily_budget_env, daily_budget_default))
        self.gate = StreamGate(name, _env_int(concurrency_env, concurrency_default))

    async def enter(self) -> None:
        """Consume budget, then take a concurrency slot. Raises 429 on either wall."""
        seconds_until_reset = max(60, 86400 - (time.time() % 86400))
        if not self.budget.check_and_consume():
            logger.warning(f"[{self.name}] daily budget exhausted ({self.budget.used}/{self.budget.max_per_day})")
            raise _reject(self.name, int(seconds_until_reset / 60) * 60)
        try:
            await self.gate.acquire()
        except HTTPException:
            # Slot taken: refund the budget unit so bursts don't double-count.
            self.budget._count = max(0, self.budget._count - 1)
            raise

    def exit(self) -> None:
        self.gate.release()

    @property
    def usage(self) -> str:
        return f"{self.budget.used}/{self.budget.max_per_day}"


research_load_guard = LoadGuard(
    name="research",
    daily_budget_env="RESEARCH_DAILY_BUDGET",
    daily_budget_default=120,
    concurrency_env="RESEARCH_MAX_CONCURRENT",
    concurrency_default=6,
)
chat_load_guard = LoadGuard(
    name="chat",
    daily_budget_env="CHAT_DAILY_BUDGET",
    daily_budget_default=600,
    concurrency_env="CHAT_MAX_CONCURRENT",
    concurrency_default=8,
)
