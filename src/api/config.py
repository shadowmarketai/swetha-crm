"""
Swetha Structures CRM - Application Configuration
===================================================
Centralized settings using pydantic-settings.
All values can be overridden via environment variables or .env file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    # ── Application ──────────────────────────────────────────────
    APP_NAME: str = "Swetha Structures CRM + Quotation"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # ── Database ─────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/swetha_crm"

    # ── Redis ────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Authentication ───────────────────────────────────────────
    # SECURITY: Override via SECRET_KEY env var. Default is for dev only.
    SECRET_KEY: str = "dev-only-change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS (KB-016) ───────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:5173",
        "http://localhost:8000",
    ]

    # ── VoiceFlow AI Integration ────────────────────────────────
    # Connect to standalone VoiceFlow AI SaaS for voice features
    VOICEFLOW_API_URL: str = "http://localhost:8001"
    VOICEFLOW_API_KEY: str = ""

    # ── AI Providers (for AI Quotation Engine) ────────────────────
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    # Google Gemini 2.5 Flash Image (Nano Banana) — used for photoreal PEB renders.
    # Get a key at https://aistudio.google.com/apikey
    GEMINI_API_KEY: str = ""

    # ── CRM Integrations ────────────────────────────────────────
    ZOHO_CLIENT_ID: str = ""
    ZOHO_CLIENT_SECRET: str = ""
    HUBSPOT_API_KEY: str = ""

    # ── Lead Source Integrations ──────────────────────────────
    INDIAMART_CRM_API_URL: str = "https://mapi.indiamart.com/wservce/crm/crmListing/v2/"
    JUSTDIAL_WEBHOOK_SECRET: str = ""

    # ── Messaging ────────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    WHATSAPP_API_KEY: str = ""

    # ── Telephony ────────────────────────────────────────────────
    TELECMI_API_KEY: str = ""
    EXOTEL_API_KEY: str = ""

    # ── Payments ─────────────────────────────────────────────────
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # ── Monitoring ───────────────────────────────────────────────
    SENTRY_DSN: str = ""

    # ── Workflow ─────────────────────────────────────────────────
    N8N_WEBHOOK_URL: str = "http://localhost:5678"

    # Voice agent features (recordings, cloning, knowledge) are in voice-flow service.

    # ── PEB Quotation ────────────────────────────────────────────
    PEB_COMPANY_NAME: str = "Swetha Structures Pvt Ltd"
    PEB_GST_RATE: float = 18.0
    PEB_DEFAULT_STEEL_RATE: float = 110.0
    PEB_QUOTATIONS_DIR: str = "data/quotations"

    # ── Rate Limiting ────────────────────────────────────────────
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_REGISTER: str = "3/minute"
    RATE_LIMIT_DEFAULT: str = "60/minute"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )


# Singleton instance
settings = Settings()

# SECURITY: Warn if default secret key is used in non-dev environments
import logging as _logging
_logger = _logging.getLogger(__name__)
if settings.APP_ENV != "development" and "dev-only" in settings.SECRET_KEY:
    _logger.critical(
        "SECURITY: SECRET_KEY is still the default value! "
        "Set SECRET_KEY environment variable before deploying to production. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(64))\""
    )
