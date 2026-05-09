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
    # SECURITY: default to False so a misconfigured prod deploy does not leak
    # full Python tracebacks. Override to True only in local .env files.
    DEBUG: bool = False

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

    # ── Meta / Facebook Lead Ads OAuth ─────────────────────────
    # Create the app at developers.facebook.com → Lead Ads product.
    # Add the OAuth callback URL (META_OAUTH_REDIRECT_URI) to "Valid OAuth
    # Redirect URIs" inside Facebook Login → Settings.
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_OAUTH_REDIRECT_URI: str = "http://localhost:8000/api/v1/lead-sources/facebook/oauth/callback"
    META_GRAPH_API_VERSION: str = "v18.0"
    # Webhook hub.verify_token used by /facebook/webhook GET handshake.
    META_WEBHOOK_VERIFY_TOKEN: str = ""

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

# ── Production guardrails ───────────────────────────────────────
# These checks intentionally HARD-FAIL when running outside development with
# unsafe defaults. A misconfigured deployment is better caught at boot than
# silently shipping a forgeable JWT signing key or a wildcard CORS policy.
import logging as _logging
_logger = _logging.getLogger(__name__)

if settings.APP_ENV not in ("development", "testing"):
    # JWT signing key must be overridden — otherwise every token is forgeable
    # by anyone with read access to the source tree.
    if "dev-only" in settings.SECRET_KEY or len(settings.SECRET_KEY) < 32:
        raise RuntimeError(
            "SECURITY: SECRET_KEY is the development default or too short. "
            "Set SECRET_KEY env var to a 64+ char random string before starting. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(64))\""
        )
    # Wildcard origins with credentials = every authenticated endpoint is
    # readable from any web origin. This is almost always a misconfiguration.
    if "*" in settings.ALLOWED_ORIGINS:
        raise RuntimeError(
            "SECURITY: ALLOWED_ORIGINS contains '*' in a non-development environment. "
            "Set ALLOWED_ORIGINS to an explicit comma-separated list of trusted origins."
        )
    # DEBUG=True in prod leaks tracebacks. Refuse to start.
    if settings.DEBUG:
        raise RuntimeError(
            "SECURITY: DEBUG=True is not allowed outside APP_ENV=development. "
            "Set DEBUG=False in production."
        )
