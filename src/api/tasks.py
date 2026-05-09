"""
Celery scaffold — minimal viable for the docker-compose `workers` profile.

This file exists so the celery-worker / celery-beat services in
`docker-compose.yml` can be brought up without `ImportError: No module named
'src.api.tasks'`. It's deliberately small: registering one ping task and a
nightly render-cleanup task migrated from the in-process render worker.

Why bother with Celery at all when most async work today is in-process?

The render worker thread (api/services/quotation_render_worker.py) runs in
the FastAPI process and would duplicate under multi-worker uvicorn — the
RUN_BG_WORKER env flag mitigates that for now, but the long-term home for
those tasks is here. As the application scales, move tasks one-by-one from
the in-process worker into Celery tasks below; the API code only needs to
swap `start_worker()` for `task.delay()`.

Bring up workers with:

    docker compose --profile workers up celery-worker celery-beat

Discovery: Celery uses the module path `src.api.tasks` (matches the compose
`celery -A src.api.tasks` command). The `app` symbol is the entry point.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from celery import Celery
from celery.schedules import crontab

logger = logging.getLogger(__name__)


# ── Broker / backend ─────────────────────────────────────────────
# Both default to the project's Redis instance (REDIS_URL is set in .env
# and exported by docker-compose). Override per env if you need separate
# broker/result stores.

_broker = os.environ.get("CELERY_BROKER_URL") or os.environ.get("REDIS_URL", "redis://localhost:6379/0")
_backend = os.environ.get("CELERY_RESULT_BACKEND") or os.environ.get("REDIS_URL", "redis://localhost:6379/0")

app = Celery("swetha", broker=_broker, backend=_backend)

# Base config — keep small; per-task settings live on the task definition.
app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,           # hard kill after 5 min
    task_soft_time_limit=240,      # raise SoftTimeLimitExceeded at 4 min
    worker_prefetch_multiplier=1,  # fair scheduling across slow Gemini calls
    broker_connection_retry_on_startup=True,
)


# ── Beat schedule — periodic tasks ───────────────────────────────
# These fire from the celery-beat container; the worker container picks up
# the dispatched task. Beat alone does not execute tasks.

app.conf.beat_schedule = {
    "prune-stale-renders-daily": {
        "task": "swetha.cleanup.prune_stale_renders",
        # 04:30 UTC daily — quiet window for South India (10:00 IST).
        "schedule": crontab(hour=4, minute=30),
    },
}


# ── Tasks ────────────────────────────────────────────────────────


@app.task(name="swetha.health.ping")
def ping() -> dict[str, Any]:
    """Trivial liveness probe used by celery-worker healthcheck."""
    return {"status": "ok", "worker": os.environ.get("HOSTNAME", "unknown")}


@app.task(name="swetha.cleanup.prune_stale_renders")
def prune_stale_renders(max_age_days: int = 30) -> dict[str, Any]:
    """
    Wraps quotation_render_worker._cleanup_stale_renders so the same logic
    can run from a dedicated worker process instead of as a side effect of
    the in-process polling thread.
    """
    try:
        from api.services.quotation_render_worker import _cleanup_stale_renders
    except Exception as exc:
        logger.exception("Could not import cleanup function: %s", exc)
        return {"error": str(exc)}
    return _cleanup_stale_renders(max_age_days=max_age_days)
