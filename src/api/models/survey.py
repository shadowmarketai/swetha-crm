"""
VoiceFlow Marketing AI - Survey Models
========================================
Survey builder and response collection.
Supports multi-question surveys with various question types.
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


class SurveyStatus(enum.Enum):
    """Survey lifecycle status."""
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"
    ARCHIVED = "archived"


class QuestionType(enum.Enum):
    """Survey question types."""
    TEXT = "text"
    TEXTAREA = "textarea"
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    RATING = "rating"
    NPS = "nps"  # Net Promoter Score (0-10)
    SCALE = "scale"
    YES_NO = "yes_no"
    DATE = "date"
    FILE_UPLOAD = "file_upload"
    DROPDOWN = "dropdown"
    PHONE = "phone"
    EMAIL = "email"


class Survey(TimestampMixin, SoftDeleteMixin, Base):
    """
    Survey/Form builder model.
    Supports multiple question types, branching logic, and scheduling.
    """
    __tablename__ = "surveys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Survey info
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    slug: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True, index=True)

    # Status
    status: Mapped[SurveyStatus] = mapped_column(
        SQLEnum(SurveyStatus, name="survey_status", create_constraint=True),
        default=SurveyStatus.DRAFT,
        server_default="draft",
        nullable=False,
    )

    # Questions (stored as JSON array for flexibility)
    questions: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # Example: [
    #   {"id": "q1", "type": "rating", "text": "Rate your experience", "required": true, "options": {"min": 1, "max": 5}},
    #   {"id": "q2", "type": "text", "text": "Any comments?", "required": false},
    # ]

    # Branching logic
    logic: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Example: {"q1": {"if_value_gte": 4, "skip_to": "q3"}}

    # Appearance
    theme: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # {"bg_color": "#fff", "font": "Inter"}
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    thank_you_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    redirect_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Settings
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    allow_multiple_responses: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    require_auth: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    show_progress_bar: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    randomize_questions: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Schedule
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    max_responses: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Statistics (denormalized for quick access)
    total_responses: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_started: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    avg_completion_time_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    completion_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # percentage
    avg_nps_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Distribution
    distribution_channels: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # ["email", "whatsapp", "sms", "web"]

    # Tags
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Owner (tenant isolation) — users.id is TEXT in this DB, not integer.
    user_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    # Campaign link
    campaign_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="surveys")
    responses: Mapped[List["SurveyResponse"]] = relationship(
        "SurveyResponse", back_populates="survey", cascade="all, delete-orphan", lazy="dynamic",
    )

    __table_args__ = (
        Index("idx_survey_status", "status"),
        Index("idx_survey_user_status", "user_id", "status"),
        Index("idx_survey_dates", "starts_at", "ends_at"),
    )

    def __repr__(self) -> str:
        return f"<Survey(id={self.id}, title='{self.title}', status={self.status.value})>"


class SurveyResponse(Base):
    """
    Individual survey response record.
    Stores all answers for a single survey submission.
    """
    __tablename__ = "survey_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Response data
    answers: Mapped[dict] = mapped_column(JSON, nullable=False)
    # Example: {"q1": 4, "q2": "Great service!", "q3": ["option_a", "option_c"]}

    # Respondent info
    respondent_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    respondent_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    respondent_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Completion tracking
    is_complete: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completion_time_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_question_answered: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Source tracking
    source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # "email", "whatsapp", "web", "voice"
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    device_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # "mobile", "desktop", "tablet"

    # Calculated scores
    nps_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 0-10
    satisfaction_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Metadata
    response_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)

    # Foreign keys
    survey_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    lead_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_leads.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    contact_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )

    # Relationships
    survey: Mapped["Survey"] = relationship("Survey", back_populates="responses")
    user: Mapped[Optional["User"]] = relationship("User", back_populates="survey_responses")

    __table_args__ = (
        Index("idx_response_survey", "survey_id", "created_at"),
        Index("idx_response_complete", "survey_id", "is_complete"),
        Index("idx_response_user", "user_id"),
        Index("idx_response_lead", "lead_id"),
    )

    def __repr__(self) -> str:
        return f"<SurveyResponse(id={self.id}, survey_id={self.survey_id}, complete={self.is_complete})>"
