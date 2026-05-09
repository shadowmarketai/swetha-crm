"""
VoiceFlow Marketing AI - Lead Polling Scheduler
=================================================
APScheduler-based background polling for IndiaMart lead sources.
Polls all active IndiaMart configs at their configured intervals.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select, and_

from api.config import settings
from api.database import get_session_factory
from api.models.lead_source_config import LeadSourceConfig, LeadSourceProvider
from api.services.lead_ingestion_service import (
    ingest_lead,
    normalize_indiamart_lead,
)

logger = logging.getLogger(__name__)

_scheduler = None


def start_lead_polling_scheduler() -> None:
    """Start the APScheduler to poll IndiaMart leads periodically."""
    global _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler

        _scheduler = BackgroundScheduler()
        _scheduler.add_job(
            _poll_all_indiamart,
            "interval",
            minutes=5,
            id="indiamart_poll",
            replace_existing=True,
        )
        _scheduler.start()
        logger.info("Lead polling scheduler started (IndiaMart every 5 min)")
    except ImportError:
        logger.warning("apscheduler not installed — lead polling disabled")
    except Exception as exc:
        logger.warning("Failed to start lead polling scheduler: %s", exc)


def stop_lead_polling_scheduler() -> None:
    """Gracefully shut down the scheduler."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Lead polling scheduler stopped")


def _poll_all_indiamart() -> None:
    """Poll all active IndiaMart configs and ingest leads."""
    SessionLocal = get_session_factory()
    session = SessionLocal()
    try:
        configs = session.execute(
            select(LeadSourceConfig).where(
                and_(
                    LeadSourceConfig.provider == LeadSourceProvider.INDIAMART,
                    LeadSourceConfig.is_active == True,
                    LeadSourceConfig.api_key != None,
                )
            )
        ).scalars().all()

        for config in configs:
            try:
                _poll_single_indiamart(session, config)
            except Exception as exc:
                logger.error("IndiaMart poll error for user %s: %s", config.user_id, exc)
                config.total_errors = (config.total_errors or 0) + 1

        session.commit()
    except Exception as exc:
        session.rollback()
        logger.error("IndiaMart scheduler error: %s", exc)
    finally:
        session.close()


def _poll_single_indiamart(session, config: LeadSourceConfig) -> None:
    """Poll a single IndiaMart config."""
    import httpx as _httpx

    url = settings.INDIAMART_CRM_API_URL
    params = {"glusr_crm_key": config.api_key}
    if config.last_sync_cursor:
        params["start_time"] = config.last_sync_cursor

    with _httpx.Client(timeout=30) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    leads_data = data if isinstance(data, list) else data.get("JEESSION", [])
    if not isinstance(leads_data, list):
        leads_data = []

    ingested = 0
    for raw in leads_data:
        try:
            normalized = normalize_indiamart_lead(raw)
            lead, is_new = ingest_lead(session, config.user_id, normalized, config)
            if is_new:
                ingested += 1
        except Exception as exc:
            logger.warning("IndiaMart lead error: %s", exc)
            config.total_errors = (config.total_errors or 0) + 1

    config.last_sync_cursor = datetime.now(timezone.utc).strftime("%d-%b-%Y %H:%M:%S")
    logger.info("IndiaMart poll user=%s: ingested %d leads", config.user_id, ingested)
