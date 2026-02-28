"""
VoiceFlow Marketing AI - API Server (Modular)
===============================================
Slim app factory that wires routers, middleware, and exception handlers.

All endpoint logic lives in api/routers/ (modular) and external modules.
Configuration is centralised in api/config.py via pydantic-settings.
"""

import logging
import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

    application = FastAPI(
        title=settings.APP_NAME,
        description="Voice AI + CRM + Marketing Automation for Indian SMBs",
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Attach limiter state for slowapi
    application.state.limiter = limiter
    application.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── CORS (KB-016: use settings.ALLOWED_ORIGINS) ──────────
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Security Middleware ───────────────────────────────────
    try:
        from api.middleware import (
            RateLimitMiddleware,
            RequestSizeLimitMiddleware,
            SecurityHeadersMiddleware,
        )
        application.add_middleware(RateLimitMiddleware)
        application.add_middleware(SecurityHeadersMiddleware)
        application.add_middleware(RequestSizeLimitMiddleware)
        logger.info("Security middleware loaded (rate limiting, headers, request size)")
    except Exception as exc:
        logger.warning("Security middleware not available: %s", exc)

    # ── Exception Handlers ───────────────────────────────────
    register_exception_handlers(application)

    # ── Lifecycle Events ─────────────────────────────────────
    _register_lifecycle(application)

    # ── Root Endpoint ────────────────────────────────────────
    @application.get("/")
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "running",
            "features": [
                "Multi-dialect ASR (Tamil, Hindi)",
                "Emotion Detection",
                "Gen Z Slang Understanding",
                "Marketing Intent Classification",
                "CRM Integration",
                "Marketing Automation",
            ],
        }

    # ── Include Routers ──────────────────────────────────────
    _include_routers(application)

    return application


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

        # Initialize voice engine (lazy — fails gracefully)
        try:
            from voice_engine.engine import VoiceFlowEngine
            application.state.voice_engine = VoiceFlowEngine(model_size="tiny")
            logger.info("Voice engine loaded (model=tiny)")
        except Exception as exc:
            application.state.voice_engine = None
            logger.warning("Voice engine not available: %s", exc)

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

    try:
        from api.routers.voice import router as new_voice_router
        application.include_router(new_voice_router)
    except Exception as exc:
        logger.warning("Voice modular router not available: %s", exc)

    # Campaigns, Marketing, Analytics, Billing routers
    from api.routers.campaigns import router as new_campaigns_router
    from api.routers.marketing import router as new_marketing_router
    from api.routers.analytics import router as new_analytics_router
    from api.routers.billing import router as new_billing_router
    application.include_router(new_campaigns_router)
    application.include_router(new_marketing_router)
    application.include_router(new_analytics_router)
    application.include_router(new_billing_router)

    logger.info(
        "New modular routers loaded (health, auth, campaigns, marketing, analytics, billing)"
    )

    # ── Supporting module routers (Phase 2) ───────────────────
    try:
        from api.routers.helpdesk import router as new_helpdesk_router
        application.include_router(new_helpdesk_router)
        logger.info("Helpdesk modular router loaded")
    except Exception as exc:
        logger.warning("Helpdesk modular router not available: %s", exc)

    try:
        from api.routers.surveys import router as new_surveys_router
        application.include_router(new_surveys_router)
        logger.info("Surveys modular router loaded")
    except Exception as exc:
        logger.warning("Surveys modular router not available: %s", exc)

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

    # ── External module routers (may not be installed) ───────
    _load_legacy_router(application, "billing.billing_service", "billing_router", "Billing")
    _load_legacy_router(application, "assistants.assistant_service", "assistant_router", "Assistants")
    _load_legacy_router(application, "integrations.telephony.telephony_providers", "telephony_router", "Telephony")
    _load_legacy_router(application, "dialer.auto_dialer", "dialer_router", "Auto Dialer")
    _load_legacy_router(application, "surveys.survey_service", "survey_router", "Survey Forms")

    # Help Desk (two routers)
    try:
        from helpdesk.helpdesk_service import helpdesk_router, tickets_router
        application.include_router(helpdesk_router)
        application.include_router(tickets_router)
        logger.info("Help Desk router loaded")
    except Exception as exc:
        logger.warning("Help Desk router not available: %s", exc)

    _load_legacy_router(application, "templates.industry_templates", "industry_router", "Industry Templates")
    _load_legacy_router(application, "tts.router", "tts_router", "TTS Voice Cloning")

    # Voice AI pipeline (STT -> LLM -> TTS)
    _load_voice_pipeline(application)


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


def _load_voice_pipeline(application: FastAPI) -> None:
    """Load the full voice AI pipeline endpoints (STT -> LLM -> TTS)."""
    try:
        from typing import Optional
        from fastapi import File, UploadFile
        from voice_engine.voice_ai_service import get_voice_ai_service, VoiceTurnRequest

        @application.post("/api/v1/voice/respond")
        async def voice_respond(
            file: UploadFile = File(...),
            language: Optional[str] = None,
            system_prompt: str = "You are a helpful sales assistant. Keep responses under 40 words.",
            llm_provider: str = "groq",
            tts_language: str = "en",
            voice_id: Optional[str] = None,
        ):
            """Full voice conversation turn: upload audio -> get AI voice response."""
            audio_bytes = await file.read()
            req = VoiceTurnRequest(
                audio_bytes=audio_bytes,
                language=language,
                system_prompt=system_prompt,
                llm_provider=llm_provider,
                tts_language=tts_language,
                voice_id=voice_id,
            )
            svc = get_voice_ai_service()
            turn = await svc.handle_turn(req)
            return turn.to_dict()

        @application.post("/api/v1/voice/analyze-and-speak")
        async def analyze_and_speak(
            file: UploadFile = File(...),
            response_text: str = "Thank you for your message.",
            tts_language: str = "en",
            voice_id: Optional[str] = None,
        ):
            """Analyse customer audio and synthesize a given response text."""
            audio_bytes = await file.read()
            svc = get_voice_ai_service()
            analysis = await svc.transcribe_and_analyze(audio_bytes)
            tts_result = await svc.generate_response_audio(
                text=response_text,
                language=tts_language,
                detected_customer_emotion=analysis.get("emotion"),
                voice_id=voice_id,
            )
            return {"analysis": analysis, "response_audio": tts_result}

        logger.info("Voice AI pipeline endpoints loaded")
    except Exception as exc:
        logger.warning("Voice AI pipeline not available: %s", exc)


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
