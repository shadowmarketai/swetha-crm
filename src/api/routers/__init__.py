"""
Swetha Structures CRM - Routers Package
==========================================
All API endpoint routers, organized by domain.
Each router is included in the main FastAPI app via server.py.
"""

from api.routers.auth import router as auth_router
from api.routers.health import router as health_router

# Safely import optional routers (may not exist in all branches)
try:
    from api.routers.crm import router as crm_router
except ImportError:
    crm_router = None

try:
    from api.routers.voice import router as voice_router
except ImportError:
    voice_router = None

from api.routers.campaigns import router as campaigns_router
from api.routers.analytics import router as analytics_router
from api.routers.billing import router as billing_router
from api.routers.helpdesk import router as helpdesk_router
from api.routers.surveys import router as surveys_router
from api.routers.workflows import router as workflows_router
from api.routers.tenants import router as tenants_router
from api.routers.webhooks import router as webhooks_router

try:
    from api.routers.quotation import router as quotation_router
except ImportError:
    quotation_router = None

__all__ = [
    "auth_router",
    "health_router",
    "crm_router",
    "voice_router",
    "campaigns_router",
    "analytics_router",
    "billing_router",
    "helpdesk_router",
    "surveys_router",
    "workflows_router",
    "tenants_router",
    "webhooks_router",
    "quotation_router",
]
