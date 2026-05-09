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
    last_cleanup = 0.0
    cleanup_interval = 86400.0   # once per 24h
    while not _stop_event.is_set():
        try:
            n = _tick()
            if n > 0:
                logger.debug(f"Render worker processed {n} intakes")
        except Exception as e:
            logger.exception(f"Render worker tick failed: {e}")

        # Daily cleanup of stale AI renders
        import time as _time
        now = _time.time()
        if now - last_cleanup > cleanup_interval:
            try:
                _cleanup_stale_renders()
            except Exception as e:
                logger.exception(f"Render cleanup failed: {e}")
            last_cleanup = now

        _stop_event.wait(POLL_INTERVAL_SEC)
    logger.info("Quotation render worker loop stopped")


def _cleanup_stale_renders(max_age_days: int = 30) -> dict:
    """
    Delete AI render PNGs older than `max_age_days` that aren't referenced
    by any quotation's ai_render_urls. Also prunes the render cache index.

    Safe to call repeatedly. Returns a summary dict for logging/tests.
    """
    import time as _time
    from pathlib import Path
    from api.services.ai_render_service import RENDERS_DIR

    cutoff = _time.time() - (max_age_days * 86400)
    removed = 0
    kept_ref = 0
    kept_recent = 0

    # Collect every URL referenced by any quotation
    SessionFactory = get_session_factory()
    referenced: set[str] = set()
    try:
        with SessionFactory() as db:
            quotes = db.query(Quotation).all()
            for q in quotes:
                for u in (q.ai_render_urls or []):
                    if isinstance(u, str):
                        referenced.add(u.rsplit("/", 1)[-1])
    except Exception as e:
        logger.warning("Could not load referenced renders: %s", e)
        return {"removed": 0, "kept_ref": 0, "kept_recent": 0, "error": str(e)}

    for path in Path(RENDERS_DIR).glob("*.png"):
        name = path.name
        if name in referenced:
            kept_ref += 1
            continue
        try:
            mtime = path.stat().st_mtime
        except OSError:
            continue
        if mtime > cutoff:
            kept_recent += 1
            continue
        try:
            path.unlink()
            removed += 1
        except OSError as e:
            logger.warning("Could not delete %s: %s", path, e)

    # Prune cache entries whose files no longer exist
    try:
        from api.services.ai_render_service import _CACHE_FILE, _cache_lock
        import json
        with _cache_lock:
            if _CACHE_FILE.exists():
                idx = json.loads(_CACHE_FILE.read_text() or "{}")
                pruned = {
                    key: items
                    for key, items in idx.items()
                    if all((Path(RENDERS_DIR) / Path(it["url"]).name).exists()
                           for it in items)
                }
                if len(pruned) != len(idx):
                    _CACHE_FILE.write_text(json.dumps(pruned, indent=2))
                    logger.info("Cache pruned: %d → %d entries", len(idx), len(pruned))
    except Exception as e:
        logger.warning("Cache prune failed: %s", e)

    summary = {"removed": removed, "kept_ref": kept_ref, "kept_recent": kept_recent}
    if removed:
        logger.info("Render cleanup: removed=%d, kept-referenced=%d, kept-recent=%d",
                    removed, kept_ref, kept_recent)
    return summary


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
