"""
VoiceFlow Marketing AI - Helpdesk / Ticketing Models
======================================================
Support ticket system with priority, status, and SLA tracking.
"""

import enum
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, JSON, Text, ForeignKey, Index,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from .user import User
    from .crm import Lead, Contact


class TicketStatus(enum.Enum):
    """Ticket lifecycle status."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING_ON_CUSTOMER = "waiting_on_customer"
    WAITING_ON_THIRD_PARTY = "waiting_on_third_party"
    RESOLVED = "resolved"
    CLOSED = "closed"
    REOPENED = "reopened"


class TicketPriority(enum.Enum):
    """Ticket priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"
    CRITICAL = "critical"


class TicketCategory(enum.Enum):
    """Ticket category classification."""
    BILLING = "billing"
    TECHNICAL = "technical"
    SALES = "sales"
    GENERAL = "general"
    FEATURE_REQUEST = "feature_request"
    BUG_REPORT = "bug_report"
    VOICE_AI = "voice_ai"
    CRM = "crm"
    INTEGRATION = "integration"
    OTHER = "other"


class Ticket(TimestampMixin, SoftDeleteMixin, Base):
    """
    Support ticket model for the helpdesk module.
    Tracks customer issues with priority, SLA, and resolution tracking.
    """
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Ticket identity
    ticket_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Classification
    status: Mapped[TicketStatus] = mapped_column(
        SQLEnum(TicketStatus, name="ticket_status", create_constraint=True),
        default=TicketStatus.OPEN,
        server_default="open",
        nullable=False,
    )
    priority: Mapped[TicketPriority] = mapped_column(
        SQLEnum(TicketPriority, name="ticket_priority", create_constraint=True),
        default=TicketPriority.MEDIUM,
        server_default="medium",
        nullable=False,
    )
    category: Mapped[Optional[TicketCategory]] = mapped_column(
        SQLEnum(TicketCategory, name="ticket_category", create_constraint=True),
        nullable=True,
    )

    # Channel
    channel: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # "voice", "email", "whatsapp", "web", "api"
    source_reference: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)  # original message ID or call ID

    # Customer info (for anonymous tickets)
    customer_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    customer_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # SLA tracking
    sla_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    first_response_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    first_response_sla_met: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    resolution_sla_met: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Resolution
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    satisfaction_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-5

    # Voice AI integration
    voice_analysis_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("voice_analyses.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    detected_sentiment: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # -1 to 1
    detected_emotion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    auto_categorized: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Tags and metadata
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    custom_fields: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    internal_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Attachments
    attachments: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # [{"name": "...", "url": "...", "type": "..."}]

    # Foreign keys
    lead_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_leads.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    contact_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    # NOTE: user_id and assigned_to are STRING (no FK) to match the legacy
    # users.id column which is TEXT. The previous Integer FK didn't match the
    # actual schema and caused FOREIGN KEY constraint failures on insert.
    assigned_to: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True,
    )

    # Relationships
    lead: Mapped[Optional["Lead"]] = relationship("Lead", back_populates="tickets")
    contact: Mapped[Optional["Contact"]] = relationship("Contact", back_populates="tickets")
    replies: Mapped[List["TicketReply"]] = relationship(
        "TicketReply", back_populates="ticket", cascade="all, delete-orphan", lazy="dynamic",
    )

    __table_args__ = (
        Index("idx_ticket_status", "status"),
        Index("idx_ticket_priority", "priority"),
        Index("idx_ticket_user_status", "user_id", "status"),
        Index("idx_ticket_assigned_status", "assigned_to", "status"),
        Index("idx_ticket_sla_due", "sla_due_at"),
        Index("idx_ticket_created", "created_at"),
        Index("idx_ticket_category", "category"),
    )

    def __repr__(self) -> str:
        return f"<Ticket(id={self.id}, number='{self.ticket_number}', status={self.status.value})>"


class TicketReply(TimestampMixin, Base):
    """
    Ticket reply/comment model.
    Supports both customer and agent replies.
    """
    __tablename__ = "ticket_replies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Content
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")  # internal note vs customer-visible

    # Sender info
    sender_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "agent", "customer", "system", "ai"
    sender_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    sender_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Attachments
    attachments: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # AI-generated flag
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    ai_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Foreign keys
    ticket_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, index=True,
    )

    # Relationships
    ticket: Mapped["Ticket"] = relationship("Ticket", back_populates="replies")

    __table_args__ = (
        Index("idx_reply_ticket", "ticket_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<TicketReply(id={self.id}, ticket_id={self.ticket_id}, sender='{self.sender_type}')>"
