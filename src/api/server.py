"""
Swetha Structures CRM - API Server (Modular)
==============================================
Slim app factory that wires routers, middleware, and exception handlers.

All endpoint logic lives in api/routers/ (modular) and external modules.
Configuration is centralised in api/config.py via pydantic-settings.
"""

import logging
import os
import sys
from pathlib import Path

from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Ensure src/ is on the import path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.config import settings
from api.exceptions import register_exception_handlers

logger = logging.getLogger(__name__)


# ── Rate Limiter (shared across routers) ─────────────────────────

limiter = Limiter(key_func=get_remote_address)


# ── App Factory ──────────────────────────────────────────────────

def create_app() -> FastAPI:
    """Build and return the configured FastAPI application."""

    # Disable API docs in production (OWASP: minimize attack surface)
    is_prod = settings.APP_ENV == "production"
    application = FastAPI(
        title=settings.APP_NAME,
        description="CRM + Automation + PEB Quotation for Swetha Structures",
        version=settings.APP_VERSION,
        docs_url=None if is_prod else "/docs",
        redoc_url=None if is_prod else "/redoc",
        openapi_url=None if is_prod else "/openapi.json",
    )

    # Attach limiter state for slowapi
    application.state.limiter = limiter
    application.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── Security Middleware (added BEFORE CORS — inner in LIFO stack) ──
    from api.middleware import (
        RateLimitMiddleware,
        SecurityHeadersMiddleware,
        RequestSizeLimitMiddleware,
    )
    application.add_middleware(RequestSizeLimitMiddleware)
    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(RateLimitMiddleware)

    # ── CORS (must be outermost — added LAST in Starlette LIFO) ──
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept"],
    )

    # ── Exception Handlers ───────────────────────────────────
    register_exception_handlers(application)

    # ── Lifecycle Events ─────────────────────────────────────
    _register_lifecycle(application)

    # ── API info endpoint ──────────────────────────────────────
    @application.get("/api/info")
    async def api_info():
        # Only return version info in non-production (reduces attack surface)
        if is_prod:
            return {"status": "running"}
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "running",
            "features": [
                "CRM Lead Management",
                "PEB Quotation System",
                "Automation & Workflows",
                "Helpdesk & Surveys",
                "VoiceFlow AI Integration (via API)",
            ],
        }

    # ── Include Routers ──────────────────────────────────────
    _include_routers(application)

    # ── /renders mount for AI photoreal images ──
    # Must be registered BEFORE the SPA catch-all so it wins precedence.
    _mount_render_storage(application)

    # ── Static Files & SPA Fallback ────────────────────────
    _mount_frontend(application)

    return application


# ── AI Render Storage ────────────────────────────────────────────

def _mount_render_storage(application: FastAPI) -> None:
    """
    Serve generated AI renders at `/renders/<filename>` with access control.

    The previous implementation was a bare `StaticFiles` mount which let any
    unauthenticated client download a proprietary building render if they
    could guess (or brute-force) the 6-char UUID in the filename.

    This handler applies a two-layer defence:

    1. Filenames now embed a 128-bit UUID (see ai_render_service._safe_filename),
       making URL guessing infeasible.
    2. For renders tied to a saved quotation (filename pattern `q{N}_*`):
       only allow the request if the requested URL appears in that
       quotation's `ai_render_urls` list, regardless of auth state. This is
       the same trust model the public quote portal already relies on:
       anyone with the (signed) portal link can see the renders.
       Preview-only renders (filename pattern `preview_*`) rely on the
       128-bit UUID alone — they're never persisted to a quote and live for
       at most ~30 days before the cleanup worker prunes them.
    """
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    from sqlalchemy import cast, String as SAString
    from sqlalchemy.orm import Session
    import re as _re

    renders_dir = Path(__file__).resolve().parent.parent.parent / "static" / "renders"
    renders_dir.mkdir(parents=True, exist_ok=True)

    # Lazy imports — these resolve once at the module level after the function
    # is called, avoiding circular imports during app construction.
    from api.database import get_db
    from api.models.quotation import Quotation

    # Match `q42_*` filenames produced by ai_render_service for saved quotes.
    _QUOTE_PREFIX_RE = _re.compile(r"^q(\d+)_")

    @application.get("/renders/{filename}", name="ai-renders")
    async def serve_ai_render(
        filename: str,
        db: Session = Depends(get_db),
    ) -> FileResponse:
        # Guard against path-traversal — strip everything except the basename
        safe = Path(filename).name
        if safe != filename or not safe.endswith(".png"):
            raise HTTPException(status_code=404)
        path = renders_dir / safe
        if not path.is_file():
            raise HTTPException(status_code=404)

        url = f"/renders/{safe}"
        m = _QUOTE_PREFIX_RE.match(safe)
        if m:
            # Quotation-bound render: require it to be referenced by some quote.
            # Use a JSON-as-text LIKE — works on both SQLite and Postgres
            # (cleaner approach with JSONB containment can come later).
            try:
                quote_id = int(m.group(1))
            except ValueError:
                raise HTTPException(status_code=404)
            quote = db.query(Quotation).filter(Quotation.id == quote_id).first()
            urls = (quote.ai_render_urls or []) if quote else []
            if url not in urls:
                # Even though the file exists on disk, return 404 — the URL
                # was never officially attached to the quote.
                raise HTTPException(status_code=404)

        # Preview renders (`preview_*`) and verified saved renders both fall
        # through here. The 128-bit UUID in the filename makes this safe.
        return FileResponse(path, media_type="image/png")

    logger.info("Serving AI renders from %s at /renders (auth-aware)", renders_dir)


# ── Frontend Static Files ────────────────────────────────────────

def _mount_frontend(application: FastAPI) -> None:
    """Serve the React SPA from /static/ with index.html fallback."""
    static_dir = Path(__file__).resolve().parent.parent.parent / "static"
    index_html = static_dir / "index.html"
    # Only register the SPA catch-all when an actual bundled index.html exists.
    # The directory alone isn't enough — the AI render storage also lives in
    # static/renders/, so the dir can exist in dev mode without a built SPA.
    if not index_html.exists():
        logger.info("No bundled SPA found at %s — running as API-only", index_html)
        @application.get("/")
        async def root_fallback():
            return {"name": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}
        return

    logger.info("Serving frontend from %s", static_dir)

    # Mount /assets/ for hashed static files (JS/CSS/images)
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        application.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # Serve specific static files at root level
    @application.get("/favicon.svg")
    @application.get("/favicon.ico")
    async def favicon(request: Request):
        for name in ("favicon.svg", "favicon.ico"):
            p = static_dir / name
            if p.exists():
                return FileResponse(str(p))
        return HTMLResponse("", status_code=404)

    @application.get("/manifest.json")
    async def manifest():
        p = static_dir / "manifest.json"
        if p.exists():
            return FileResponse(str(p))
        return HTMLResponse("", status_code=404)

    @application.get("/service-worker.js")
    async def service_worker():
        p = static_dir / "service-worker.js"
        if p.exists():
            return FileResponse(str(p), media_type="application/javascript")
        return HTMLResponse("", status_code=404)

    # SPA catch-all: any path not matched by API routes serves index.html
    index_html = static_dir / "index.html"

    @application.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Try to serve static file first
        file_path = static_dir / full_path
        if file_path.is_file() and ".." not in full_path:
            return FileResponse(str(file_path))
        # Otherwise return index.html for client-side routing
        return FileResponse(str(index_html))


# ── Lifecycle Events ─────────────────────────────────────────────

def _register_lifecycle(application: FastAPI) -> None:
    """Register startup and shutdown events."""

    @application.on_event("startup")
    async def startup_event():
        # Startup checks
        try:
            from api.startup import run_startup_checks
            run_startup_checks()
        except Exception as exc:
            logger.warning("Startup checks warning: %s", exc)

        logger.info("Initializing %s...", settings.APP_NAME)

        # Initialize database
        try:
            from api.database import init_db
            init_db()
            logger.info("Database initialized.")
        except Exception as exc:
            logger.warning("Database init warning: %s", exc)

        # NOTE: default quotation template seeding is DISABLED by design.
        # Tenants create their own templates from /quotation/templates.
        # (The PEB_* presets in quotation_template_seed.py are still available
        # as a one-click import option inside the Template Studio later.)

        # Start the quotation render background worker (auto-generates
        # 3D / drawings / AI renders for new client intakes).
        try:
            from api.services.quotation_render_worker import start_worker
            start_worker()
        except Exception as exc:
            logger.warning("Quotation render worker not started: %s", exc)

        # Voice AI is now a separate service (voice-flow).
        # CRM integrates via API at VOICEFLOW_API_URL.
        application.state.voice_engine = None

        logger.info("%s ready!", settings.APP_NAME)

    @application.on_event("shutdown")
    async def shutdown_event():
        logger.info("Shutting down %s...", settings.APP_NAME)


# ── Router Registration ─────────────────────────────────────────

def _include_routers(application: FastAPI) -> None:
    """Include all routers — modular routers first, then external modules."""

    # ── New modular routers ──────────────────────────────────
    from api.routers.auth import router as new_auth_router
    from api.routers.health import router as new_health_router
    application.include_router(new_health_router)
    application.include_router(new_auth_router)

    # User management (admin)
    try:
        from api.routers.users import router as new_users_router
        application.include_router(new_users_router)
        logger.info("User Management router loaded")
    except Exception as exc:
        logger.warning("User Management router not available: %s", exc)

    # CRM and Voice routers (may not exist in all branches)
    try:
        from api.routers.crm import router as new_crm_router
        application.include_router(new_crm_router)
    except Exception as exc:
        logger.warning("CRM modular router not available: %s", exc)

    # Voice analysis is now in the voice-flow service.
    # CRM accesses voice data via VoiceFlow API integration.

    # Campaigns, Analytics, Billing routers
    from api.routers.campaigns import router as new_campaigns_router
    from api.routers.analytics import router as new_analytics_router
    from api.routers.billing import router as new_billing_router
    application.include_router(new_campaigns_router)
    application.include_router(new_analytics_router)
    application.include_router(new_billing_router)

    logger.info(
        "New modular routers loaded (health, auth, campaigns, analytics, billing)"
    )

    # ── SaaS Control Layer routers ─────────────────────────────
    try:
        from api.routers.super_admin import router as super_admin_router
        application.include_router(super_admin_router)
        logger.info("Super Admin router loaded")
    except Exception as exc:
        logger.warning("Super Admin router not available: %s", exc)

    try:
        from api.routers.platform_support import router as platform_support_router
        application.include_router(platform_support_router)
        logger.info("Platform Support (tenant-side) router loaded")
    except Exception as exc:
        logger.warning("Platform Support router not available: %s", exc)

    try:
        from api.realtime import router as realtime_router
        application.include_router(realtime_router)
        logger.info("Realtime WebSocket router loaded")
    except Exception as exc:
        logger.warning("Realtime WebSocket router not available: %s", exc)

    try:
        from api.routers.feature_engine import router as feature_engine_router
        application.include_router(feature_engine_router)
        logger.info("Feature Engine router loaded")
    except Exception as exc:
        logger.warning("Feature Engine router not available: %s", exc)

    # Quotation router (PEB)
    try:
        from api.routers.quotation import router as quotation_router
        application.include_router(quotation_router)
        logger.info("Quotation (PEB) router loaded")
    except Exception as exc:
        logger.warning("Quotation router not available: %s", exc)

    # AI-Powered Quotation (voice-to-quote, photo-to-quote, rate prediction, market intel)
    try:
        from api.routers.ai_quotation import router as ai_quote_router
        application.include_router(ai_quote_router)
        logger.info("AI Quotation router loaded")
    except Exception as exc:
        logger.warning("AI Quotation router not available: %s", exc)

    # ── Tendent Quotation Engine: templates, intake, portal, offers ──
    try:
        from api.routers.quotation_template import (
            router as quotation_template_router,
            offers_router as quotation_offers_router,
            public_router as quotation_public_router,
        )
        application.include_router(quotation_template_router)
        application.include_router(quotation_offers_router)
        application.include_router(quotation_public_router)
        logger.info("Quotation template engine routers loaded")
    except Exception as exc:
        logger.warning("Quotation template router not available: %s", exc)

    # ── Supporting module routers (Phase 2) ───────────────────
    try:
        from api.routers.helpdesk import router as new_helpdesk_router
        application.include_router(new_helpdesk_router)
        logger.info("Helpdesk modular router loaded")
    except Exception as exc:
        logger.warning("Helpdesk modular router not available: %s", exc)

    try:
        from api.routers.appointments import router as appointments_router
        application.include_router(appointments_router)
        logger.info("Appointments router loaded")
    except Exception as exc:
        logger.warning("Appointments router not available: %s", exc)

    try:
        from api.routers.surveys import router as new_surveys_router, public_router as public_surveys_router
        application.include_router(new_surveys_router)
        application.include_router(public_surveys_router)
        logger.info("Surveys modular router loaded (auth + public)")
    except Exception as exc:
        logger.warning("Surveys modular router not available: %s", exc)

    try:
        from api.routers.inbox import router as inbox_router, public_router as public_inbox_router
        application.include_router(inbox_router)
        application.include_router(public_inbox_router)
        logger.info("Inbox router loaded (auth + public webhooks)")
    except Exception as exc:
        logger.warning("Inbox router not available: %s", exc)

    try:
        from api.routers.workflows import router as new_workflows_router
        application.include_router(new_workflows_router)
        logger.info("Workflows modular router loaded")
    except Exception as exc:
        logger.warning("Workflows modular router not available: %s", exc)

    try:
        from api.routers.tenants import router as new_tenants_router
        application.include_router(new_tenants_router)
        logger.info("Tenants modular router loaded")
    except Exception as exc:
        logger.warning("Tenants modular router not available: %s", exc)

    try:
        from api.routers.webhooks import router as new_webhooks_router
        application.include_router(new_webhooks_router)
        logger.info("Webhooks & API Keys modular router loaded")
    except Exception as exc:
        logger.warning("Webhooks & API Keys modular router not available: %s", exc)

    # Lead Sources (IndiaMart, JustDial, Facebook Lead Ads)
    try:
        from api.routers.lead_sources import router as lead_sources_router
        application.include_router(lead_sources_router)
        logger.info("Lead Sources router loaded (IndiaMart, JustDial, Facebook)")
    except Exception as exc:
        logger.warning("Lead Sources router not available: %s", exc)

    # Dialer (campaigns, contacts, calls, DNC)
    try:
        from api.routers.dialer import router as dialer_router
        application.include_router(dialer_router)
        logger.info("Dialer router loaded")
    except Exception as exc:
        logger.warning("Dialer router not available: %s", exc)

    # Voice Agent (cloning, knowledge, recordings) is now in the voice-flow service.

    # Legacy external module routers removed — all functionality is now in src/api/routers/


def _load_legacy_router(
    application: FastAPI,
    module_path: str,
    attr_name: str,
    label: str,
) -> None:
    """Safely import and register an external module router."""
    try:
        import importlib
        module = importlib.import_module(module_path)
        router = getattr(module, attr_name)
        application.include_router(router)
        logger.info("%s router loaded", label)
    except Exception as exc:
        logger.warning("%s router not available: %s", label, exc)


# ── Create the app instance ──────────────────────────────────────

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
