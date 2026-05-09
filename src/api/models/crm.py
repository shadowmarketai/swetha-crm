"""
Swetha Structures CRM - CRM Models
=====================================
Lead, Company, Contact, Deal, and Activity models for the CRM module.
All entities have user_id FK for tenant isolation.
Lead status follows pipeline: new -> contacted -> qualified -> proposal -> negotiation -> won/lost.
"""

import enum
from datetime import datetime, date
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, Date, JSON, Text, ForeignKey, Index,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from .user import User
    from .campaign import Campaign
    from .helpdesk import Ticket
    from .voiceflow import VoiceflowConversation


class LeadStatus(enum.Enum):
    """Lead pipeline status - must follow order."""
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"
    CHURNED = "churned"


class LeadSource(enum.Enum):
    """Lead acquisition source."""
    MANUAL = "manual"
    META_ADS = "meta_ads"
    GOOGLE_ADS = "google_ads"
    WHATSAPP = "whatsapp"
    LINKEDIN = "linkedin"
    REFERRAL = "referral"
    WEBSITE = "website"
    VOICE_AI = "voice_ai"
    IVR = "ivr"
    IMPORT = "import"
    API = "api"
    INDIAMART = "indiamart"
    JUSTDIAL = "justdial"
    FACEBOOK_LEADS = "facebook_leads"
    OTHER = "other"


class DealStage(enum.Enum):
    """Deal pipeline stage."""
    DISCOVERY = "discovery"
    QUALIFICATION = "qualification"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"
    ON_HOLD = "on_hold"


class ActivityType(enum.Enum):
    """Activity type for CRM activity logs."""
    CALL = "call"
    EMAIL = "email"
    MEETING = "meeting"
    NOTE = "note"
    TASK = "task"
    SMS = "sms"
    WHATSAPP = "whatsapp"
    FOLLOW_UP = "follow_up"
    DEMO = "demo"
    VOICEFLOW_CALL = "voiceflow_call"
    STATUS_CHANGE = "status_change"
    DEAL_UPDATE = "deal_update"


class Company(TimestampMixin, SoftDeleteMixin, Base):
    """
    Company/Organization model for B2B CRM.
    Linked to leads and contacts.
    """
    __tablename__ = "crm_companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Basic info
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    company_size: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # "1-10", "11-50", "51-200", etc.

    # Contact details
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Address
    address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    country: Mapped[str] = mapped_column(String(100), default="India", server_default="India")

    # Business details
    gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)  # Indian GST number
    annual_revenue: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # in INR
    employee_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # CRM sync
    crm_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # "zoho", "hubspot", "salesforce"
    crm_record_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Notes
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Owner (tenant isolation) — uses String to match legacy TEXT user IDs
    user_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True,
    )

    # Relationships (no FK — legacy users table has TEXT PK)
    leads: Mapped[List["Lead"]] = relationship("Lead", back_populates="company_rel", lazy="dynamic")
    contacts: Mapped[List["Contact"]] = relationship("Contact", back_populates="company", lazy="dynamic")
    deals: Mapped[List["Deal"]] = relationship("Deal", back_populates="company", lazy="dynamic")

    __table_args__ = (
        Index("idx_company_name_user", "user_id", "name"),
        Index("idx_company_crm_sync", "crm_type", "crm_record_id"),
    )

    def __repr__(self) -> str:
        return f"<Company(id={self.id}, name='{self.name}')>"


class Lead(TimestampMixin, SoftDeleteMixin, Base):
    """
    Lead management table (ORM).
    Synced with CRM systems (Zoho, HubSpot, Salesforce).
    Lead score is auto-calculated from voice analysis.
    Uses 'crm_leads' to avoid conflict with legacy raw-SQL 'leads' table.
    """
    __tablename__ = "crm_leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Contact info
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Job title
    company_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Lead status
    status: Mapped[LeadStatus] = mapped_column(
        SQLEnum(LeadStatus, name="lead_status", create_constraint=True),
        default=LeadStatus.NEW,
        server_default="new",
        nullable=False,
    )
    lead_score: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")

    # Voice-derived insights — populated by VoiceFlow webhook from conversation analysis
    primary_emotion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    primary_intent: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    detected_dialect: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    avg_sentiment: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    total_calls: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_call_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Source tracking
    source: Mapped[Optional[LeadSource]] = mapped_column(
        SQLEnum(LeadSource, name="lead_source", create_constraint=True),
        nullable=True,
    )
    external_source_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    external_source_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    raw_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ingested_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    utm_source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_medium: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_campaign: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_term: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_content: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Address
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    country: Mapped[str] = mapped_column(String(100), default="India", server_default="India")

    # CRM sync
    crm_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # "zoho", "hubspot", "salesforce"
    crm_record_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Tags and notes
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    custom_fields: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Conversion
    converted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    lost_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Foreign keys
    campaign_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    company_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_companies.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    # Uses String to match legacy TEXT user IDs (no FK — legacy users table has TEXT PK)
    user_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True,
    )
    assigned_to: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True,
    )

    # Relationships (no user FK — legacy users table has TEXT PK)
    voiceflow_conversations: Mapped[List["VoiceflowConversation"]] = relationship(
        "VoiceflowConversation", back_populates="lead", lazy="dynamic",
        cascade="all, delete-orphan",
    )
    campaign: Mapped[Optional["Campaign"]] = relationship("Campaign", back_populates="leads")
    company_rel: Mapped[Optional["Company"]] = relationship("Company", back_populates="leads")
    contacts: Mapped[List["Contact"]] = relationship("Contact", back_populates="lead", lazy="dynamic")
    deals: Mapped[List["Deal"]] = relationship("Deal", back_populates="lead", lazy="dynamic")
    activities: Mapped[List["Activity"]] = relationship("Activity", back_populates="lead", lazy="dynamic")
    tickets: Mapped[List["Ticket"]] = relationship("Ticket", back_populates="lead", lazy="dynamic")

    __table_args__ = (
        Index("idx_lead_status", "status"),
        Index("idx_lead_score", "lead_score"),
        Index("idx_lead_created", "created_at"),
        Index("idx_lead_user_status", "user_id", "status"),
        Index("idx_lead_assigned_status", "assigned_to", "status"),
        Index("idx_lead_crm_sync", "crm_type", "crm_record_id"),
        Index("idx_lead_source", "source"),
        Index("idx_lead_external_source", "external_source_id", "external_source_type", unique=True),
    )

    def __repr__(self) -> str:
        return f"<Lead(id={self.id}, email='{self.email}', status={self.status.value})>"


class Contact(TimestampMixin, SoftDeleteMixin, Base):
    """
    Contact model for CRM.
    Represents individual people associated with leads or companies.
    """
    __tablename__ = "crm_contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Personal info
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    mobile: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Job title
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Address
    address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    country: Mapped[str] = mapped_column(String(100), default="India", server_default="India")

    # Social
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    twitter_handle: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Communication preferences
    preferred_language: Mapped[str] = mapped_column(String(10), default="en", server_default="en")
    preferred_channel: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # "phone", "email", "whatsapp"
    do_not_call: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    do_not_email: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Additional
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    custom_fields: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # CRM sync
    crm_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    crm_record_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Foreign keys
    company_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_companies.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    lead_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_leads.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True,
    )

    # Relationships
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="contacts")
    lead: Mapped[Optional["Lead"]] = relationship("Lead", back_populates="contacts")
    deals: Mapped[List["Deal"]] = relationship("Deal", back_populates="contact", lazy="dynamic")
    activities: Mapped[List["Activity"]] = relationship("Activity", back_populates="contact", lazy="dynamic")
    tickets: Mapped[List["Ticket"]] = relationship("Ticket", back_populates="contact", lazy="dynamic")

    __table_args__ = (
        Index("idx_contact_name", "first_name", "last_name"),
        Index("idx_contact_user", "user_id"),
        Index("idx_contact_company", "company_id"),
        Index("idx_contact_crm_sync", "crm_type", "crm_record_id"),
    )

    def __repr__(self) -> str:
        return f"<Contact(id={self.id}, name='{self.first_name} {self.last_name}')>"


class Deal(TimestampMixin, SoftDeleteMixin, Base):
    """
    Deal/Opportunity model for CRM sales pipeline.
    Tracks deal value, stage, and probability.
    """
    __tablename__ = "crm_deals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Deal info
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Pipeline
    stage: Mapped[DealStage] = mapped_column(
        SQLEnum(DealStage, name="deal_stage", create_constraint=True),
        default=DealStage.DISCOVERY,
        server_default="discovery",
        nullable=False,
    )
    probability: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")  # 0-100%

    # Financials (amounts in paisa per Razorpay standard)
    deal_value: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")  # in INR (display value)
    currency: Mapped[str] = mapped_column(String(3), default="INR", server_default="INR")
    recurring_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recurring_period: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # "monthly", "yearly"

    # Timeline
    expected_close_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    actual_close_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    won_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    lost_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    lost_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Product/Service
    product_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    product_category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Notes and tags
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    custom_fields: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # CRM sync
    crm_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    crm_record_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Foreign keys
    lead_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_leads.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    contact_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    company_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_companies.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True,
    )
    assigned_to: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True,
    )

    # Relationships
    lead: Mapped[Optional["Lead"]] = relationship("Lead", back_populates="deals")
    contact: Mapped[Optional["Contact"]] = relationship("Contact", back_populates="deals")
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="deals")
    activities: Mapped[List["Activity"]] = relationship("Activity", back_populates="deal", lazy="dynamic")

    __table_args__ = (
        Index("idx_deal_stage", "stage"),
        Index("idx_deal_user_stage", "user_id", "stage"),
        Index("idx_deal_close_date", "expected_close_date"),
        Index("idx_deal_value", "deal_value"),
        Index("idx_deal_crm_sync", "crm_type", "crm_record_id"),
    )

    def __repr__(self) -> str:
        return f"<Deal(id={self.id}, title='{self.title}', stage={self.stage.value})>"


class Activity(TimestampMixin, Base):
    """
    Activity log for CRM interactions.
    Records calls, emails, meetings, notes, tasks, and status changes.
    """
    __tablename__ = "crm_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Activity info
    activity_type: Mapped[ActivityType] = mapped_column(
        SQLEnum(ActivityType, name="activity_type", create_constraint=True),
        nullable=False,
    )
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Scheduling
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Call-specific
    call_direction: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # "inbound", "outbound"
    call_outcome: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # "connected", "no_answer", "busy"
    call_recording_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Email-specific
    email_subject: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    email_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Metadata
    activity_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Foreign keys
    lead_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_leads.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    contact_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    deal_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_deals.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True,
    )

    # Relationships
    lead: Mapped[Optional["Lead"]] = relationship("Lead", back_populates="activities")
    contact: Mapped[Optional["Contact"]] = relationship("Contact", back_populates="activities")
    deal: Mapped[Optional["Deal"]] = relationship("Deal", back_populates="activities")

    __table_args__ = (
        Index("idx_activity_type", "activity_type"),
        Index("idx_activity_user_type", "user_id", "activity_type"),
        Index("idx_activity_created", "created_at"),
        Index("idx_activity_scheduled", "scheduled_at"),
        Index("idx_activity_lead", "lead_id", "activity_type"),
    )

    def __repr__(self) -> str:
        return f"<Activity(id={self.id}, type={self.activity_type.value}, subject='{self.subject}')>"
