"""
Swetha Structures CRM - Models Package
=========================================
Re-exports all models and Base for convenience.

Usage:
    from api.models import Base, User, Lead
    from api.models import UserRole, LeadStatus
    from api.models.base import TimestampMixin, SoftDeleteMixin

Modern SQLAlchemy 2.0 patterns:
    - KB-001: DeclarativeBase (NOT declarative_base())
    - KB-002: mapped_column() with Mapped[] type hints (NOT Column())
    - KB-003: Indexes on FK columns and frequently queried columns
"""

# Base and mixins
from .base import Base, TimestampMixin, SoftDeleteMixin

# Tenant model
from .tenant import Tenant

# User models and enums
from .user import User, RefreshToken, UserRole

# CRM models and enums
from .crm import (
    Lead, Company, Contact, Deal, Activity,
    LeadStatus, LeadSource, DealStage, ActivityType,
)

# Campaign models and enums
from .campaign import Campaign, CampaignStatus, CampaignType, CampaignPlatform

# Workflow models and enums
from .workflow import Workflow, WorkflowExecution, WorkflowType, ExecutionStatus

# Analytics models
from .analytics import AnalyticsEvent

# Helpdesk models and enums
from .helpdesk import Ticket, TicketReply, TicketStatus, TicketPriority, TicketCategory

# Survey models and enums
from .survey import Survey, SurveyResponse, SurveyStatus, QuestionType

# Inbox models and enums
from .inbox import (
    ChannelConnection, Conversation, Message,
    InboxChannel, WhatsAppProviderType, EmailProviderType, ConnectionStatus,
    MessageDirection, MessageStatus,
)

# Lead Source Config
from .lead_source_config import LeadSourceConfig, LeadSourceProvider

# Webhook models
from .webhook import APIKey, WebhookConfig, WebhookDeliveryLog

# VoiceFlow integration models (conversations + recordings synced from VoiceFlow SaaS)
from .voiceflow import VoiceflowConversation, VoiceflowRecording, VoiceflowConversationStatus

# Quotation models
from .quotation import Quotation, QuotationLog, QuotationStatus
from .quotation_template import (
    QuotationTemplate,
    ClientIntake,
    QuotationOffer,
    QuotationPortalToken,
    TenantWhatsAppConfig,
    TemplateEngine,
    IntakeStatus,
    OfferStatus,
    PortalTokenKind,
    TenantMessagingProvider,
)

# Appointment models and enums
from .appointment import (
    Service as AppointmentService,
    AvailabilityRule,
    AvailabilityOverride,
    Booking as AppointmentBooking,
    BookingPage,
    BookingStatus,
    LocationType,
    BookingPageStatus,
)

__all__ = [
    # Base
    "Base",
    "TimestampMixin",
    "SoftDeleteMixin",
    # Tenant
    "Tenant",
    # User
    "User",
    "RefreshToken",
    "UserRole",
    # CRM
    "Lead",
    "Company",
    "Contact",
    "Deal",
    "Activity",
    "LeadStatus",
    "LeadSource",
    "DealStage",
    "ActivityType",
    # Campaign
    "Campaign",
    "CampaignStatus",
    "CampaignType",
    "CampaignPlatform",
    # Workflow
    "Workflow",
    "WorkflowExecution",
    "WorkflowType",
    "ExecutionStatus",
    # Analytics
    "AnalyticsEvent",
    # Helpdesk
    "Ticket",
    "TicketReply",
    "TicketStatus",
    "TicketPriority",
    "TicketCategory",
    # Survey
    "Survey",
    "SurveyResponse",
    "SurveyStatus",
    "QuestionType",
    # Inbox
    "ChannelConnection",
    "Conversation",
    "Message",
    "InboxChannel",
    "WhatsAppProviderType",
    "EmailProviderType",
    "ConnectionStatus",
    "MessageDirection",
    "MessageStatus",
    # Lead Source Config
    "LeadSourceConfig",
    "LeadSourceProvider",
    # Webhook
    "APIKey",
    "WebhookConfig",
    "WebhookDeliveryLog",
    # VoiceFlow
    "VoiceflowConversation",
    "VoiceflowRecording",
    "VoiceflowConversationStatus",
    # Quotation
    "Quotation",
    "QuotationLog",
    "QuotationStatus",
    "QuotationTemplate",
    "ClientIntake",
    "QuotationOffer",
    "QuotationPortalToken",
    "TenantWhatsAppConfig",
    "TemplateEngine",
    "IntakeStatus",
    "OfferStatus",
    "PortalTokenKind",
    "TenantMessagingProvider",
    # Appointments
    "AppointmentService",
    "AvailabilityRule",
    "AvailabilityOverride",
    "AppointmentBooking",
    "BookingPage",
    "BookingStatus",
    "LocationType",
    "BookingPageStatus",
]
