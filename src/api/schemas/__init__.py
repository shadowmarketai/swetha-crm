"""
Swetha Structures CRM - Pydantic Schemas Package
==================================================
All request/response models for the API, organized by domain.
"""

from api.schemas.common import ErrorResponse, MessageResponse, PaginatedResponse
from api.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    UserUpdate,
)
from api.schemas.crm import (
    ActivityCreate,
    ActivityResponse,
    CompanyCreate,
    CompanyResponse,
    CompanyUpdate,
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    DealCreate,
    DealResponse,
    DealUpdate,
    LeadCreate,
    LeadResponse,
    LeadUpdate,
)
from api.schemas.campaign import (
    CampaignCreate,
    CampaignResponse,
    CampaignUpdate,
)
from api.schemas.helpdesk import (
    TicketCreate,
    TicketUpdate,
    TicketResponse,
    TicketReplyCreate,
    TicketReplyResponse,
    TicketDashboardResponse,
)
from api.schemas.survey import (
    SurveyCreate,
    SurveyUpdate,
    SurveyDetail,
    SurveyResponseCreate,
    SurveyResponseDetail,
    SurveyAnalyticsResponse,
)
from api.schemas.workflow import (
    WorkflowCreate,
    WorkflowUpdate,
    WorkflowDetail,
    WorkflowTriggerRequest,
    WorkflowExecutionResponse,
    WorkflowTemplateResponse,
)
from api.schemas.tenant import (
    TenantCreate,
    TenantUpdate,
    TenantResponse,
    TenantStatsResponse,
    FeatureFlagsUpdate,
)
from api.schemas.webhook import (
    APIKeyCreate,
    APIKeyResponse,
    APIKeyCreatedResponse,
    WebhookCreate,
    WebhookUpdate,
    WebhookResponse,
    WebhookDeliveryLogResponse,
    WebhookTestResponse,
)

__all__ = [
    # Common
    "ErrorResponse",
    "MessageResponse",
    "PaginatedResponse",
    # Auth
    "LoginRequest",
    "RegisterRequest",
    "TokenResponse",
    "UserResponse",
    "UserUpdate",
    # CRM
    "ActivityCreate",
    "ActivityResponse",
    "CompanyCreate",
    "CompanyResponse",
    "CompanyUpdate",
    "ContactCreate",
    "ContactResponse",
    "ContactUpdate",
    "DealCreate",
    "DealResponse",
    "DealUpdate",
    "LeadCreate",
    "LeadResponse",
    "LeadUpdate",
    # Campaign
    "CampaignCreate",
    "CampaignResponse",
    "CampaignUpdate",
    # Helpdesk
    "TicketCreate",
    "TicketUpdate",
    "TicketResponse",
    "TicketReplyCreate",
    "TicketReplyResponse",
    "TicketDashboardResponse",
    # Survey
    "SurveyCreate",
    "SurveyUpdate",
    "SurveyDetail",
    "SurveyResponseCreate",
    "SurveyResponseDetail",
    "SurveyAnalyticsResponse",
    # Workflow
    "WorkflowCreate",
    "WorkflowUpdate",
    "WorkflowDetail",
    "WorkflowTriggerRequest",
    "WorkflowExecutionResponse",
    "WorkflowTemplateResponse",
    # Tenant
    "TenantCreate",
    "TenantUpdate",
    "TenantResponse",
    "TenantStatsResponse",
    "FeatureFlagsUpdate",
    # Webhook & API Keys
    "APIKeyCreate",
    "APIKeyResponse",
    "APIKeyCreatedResponse",
    "WebhookCreate",
    "WebhookUpdate",
    "WebhookResponse",
    "WebhookDeliveryLogResponse",
    "WebhookTestResponse",
]
