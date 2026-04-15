"""
Background worker that processes client intakes and fires off the
3D / drawings / AI render generation jobs for each quotation.

For v1 the actual headless-browser rendering is stubbed — we record
placeholder URLs pointing to a public static path. Task #22 can later
swap these placeholders for real Playwright-rendered PNGs.

Usage:
    from api.services.quotation_render_worker import start_worker
    start_worker()   # kick off once at FastAPI startup
"""

import asyncio
import logging
import threading
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from api.database import get_session_factory
from api.models.quotation import Quotation
from api.models.quotation_template import (
    ClientIntake,
    IntakeStatus,
    QuotationTemplate,
)

logger = logging.getLogger(__name__)

_worker_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()
POLL_INTERVAL_SEC = 10


def _generate_3d_stub(quote: Quotation) -> Optional[str]:
    """
    STUB: returns a placeholder URL. Real impl would:
      1. Launch headless Chromium via Playwright
      2. Navigate to `/view/{internal-token}/3d?headless=1`
      3. Wait for canvas ready
      4. Screenshot to {media_root}/renders/q{id}_3d.png
      5. Return the public URL
    """
    return f"/static/renders/q{quote.id}_3d.placeholder.png"


def _generate_drawings_stub(quote: Quotation) -> Optional[str]:
    """STUB: real impl would server-render SVG → PDF."""
    return f"/static/renders/q{quote.id}_drawings.placeholder.svg"


def _generate_render_stub(quote: Quotation) -> Optional[list]:
    """STUB: real impl would call Stable Diffusion / local diffusion pipeline."""
    return [f"/static/renders/q{quote.id}_render.placeholder.png"]


def _process_one_intake(db: Session, intake: ClientIntake) -> None:
    """Generate missing artifacts for a single intake's quotation."""
    if not intake.quotation_id:
        return

    quote = db.query(Quotation).filter(Quotation.id == intake.quotation_id).first()
    if not quote:
        logger.warning(f"Intake {intake.id} has no quotation")
        return

    template = (
        db.query(QuotationTemplate)
        .filter(QuotationTemplate.id == intake.template_id)
        .first()
    )
    if not template:
        return

    updated = False

    # 3D auto-generation
    if template.auto_generate_3d and not quote.render_3d_url:
        url = _generate_3d_stub(quote)
        if url:
            quote.render_3d_url = url
            intake.render_3d_url = url
            updated = True
            logger.info(f"Generated 3D for quote {quote.id}: {url}")

    # Drawings auto-generation
    if template.auto_generate_drawings and not quote.drawings_url:
        url = _generate_drawings_stub(quote)
        if url:
            quote.drawings_url = url
            intake.drawings_url = url
            updated = True
            logger.info(f"Generated drawings for quote {quote.id}: {url}")

    # AI render auto-generation
    if template.auto_generate_render and not quote.ai_render_urls:
        urls = _generate_render_stub(quote)
        if urls:
            quote.ai_render_urls = urls
            intake.ai_render_url = urls[0]
            updated = True
            logger.info(f"Generated AI render for quote {quote.id}: {urls}")

    if updated:
        db.commit()


def _tick() -> int:
    """One iteration — process any intakes in NEW or PROCESSING status. Returns count."""
    SessionFactory = get_session_factory()
    with SessionFactory() as db:
        # Pick intakes whose quotations still need artifacts generated
        pending = (
            db.query(ClientIntake)
            .filter(
                ClientIntake.status.in_([
                    IntakeStatus.NEW.value,
                    IntakeStatus.PROCESSING.value,
                    IntakeStatus.READY.value,
                ])
            )
            .limit(20)
            .all()
        )

        processed = 0
        for intake in pending:
            if not intake.quotation_id:
                continue
            quote = db.query(Quotation).filter(Quotation.id == intake.quotation_id).first()
            if not quote:
                continue
            template = (
                db.query(QuotationTemplate)
                .filter(QuotationTemplate.id == intake.template_id)
                .first()
            )
            if not template:
                continue
            needs_3d = template.auto_generate_3d and not quote.render_3d_url
            needs_drawings = template.auto_generate_drawings and not quote.drawings_url
            needs_render = template.auto_generate_render and not quote.ai_render_urls
            if not (needs_3d or needs_drawings or needs_render):
                continue
            _process_one_intake(db, intake)
            processed += 1
        return processed


def _worker_loop() -> None:
    logger.info("Quotation render worker loop started")
    while not _stop_event.is_set():
        try:
            n = _tick()
            if n > 0:
                logger.debug(f"Render worker processed {n} intakes")
        except Exception as e:
            logger.exception(f"Render worker tick failed: {e}")
        _stop_event.wait(POLL_INTERVAL_SEC)
    logger.info("Quotation render worker loop stopped")


def start_worker() -> None:
    """Start the worker in a background daemon thread. Idempotent."""
    global _worker_thread
    if _worker_thread and _worker_thread.is_alive():
        return
    _stop_event.clear()
    _worker_thread = threading.Thread(
        target=_worker_loop,
        daemon=True,
        name="quotation-render-worker",
    )
    _worker_thread.start()
    logger.info("Quotation render worker started")


def stop_worker() -> None:
    _stop_event.set()
