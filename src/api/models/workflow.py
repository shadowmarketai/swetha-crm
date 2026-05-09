"""
VoiceFlow Marketing AI - Workflow Models
==========================================
n8n/Flowise workflow tracking and execution records.
"""

import enum
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, JSON, Text, ForeignKey, Index,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .user import User


class WorkflowType(enum.Enum):
    """Workflow automation type."""
    VOICE_TO_LEAD = "voice_to_lead"
    EMOTION_RETARGET = "emotion_retarget"
    CHURN_PREVENTION = "churn_prevention"
    LEAD_NURTURE = "lead_nurture"
    AUTO_RESPONSE = "auto_response"
    CRM_SYNC = "crm_sync"
    CAMPAIGN_TRIGGER = "campaign_trigger"
    NOTIFICATION = "notification"
    DATA_ENRICHMENT = "data_enrichment"
    CUSTOM = "custom"


class ExecutionStatus(enum.Enum):
    """Workflow execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class Workflow(TimestampMixin, Base):
    """
    n8n/Flowise workflow configuration and tracking.
    """
    __tablename__ = "workflows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Workflow info
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    workflow_type: Mapped[Optional[WorkflowType]] = mapped_column(
        SQLEnum(WorkflowType, name="workflow_type", create_constraint=True),
        nullable=True,
    )

    # External references
    n8n_workflow_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    flowise_flow_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    webhook_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Configuration
    trigger_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # trigger conditions
    action_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # actions to take
    variables: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # workflow variables

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")

    # Rate limiting
    max_executions_per_hour: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cooldown_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Statistics
    total_executions: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    successful_executions: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    failed_executions: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_execution_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    avg_execution_time_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Tags
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Owner (tenant isolation)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="workflows")
    executions: Mapped[List["WorkflowExecution"]] = relationship(
        "WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan", lazy="dynamic",
    )

    __table_args__ = (
        Index("idx_workflow_active", "is_active"),
        Index("idx_workflow_type", "workflow_type"),
        Index("idx_workflow_user_active", "user_id", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<Workflow(id={self.id}, name='{self.name}', active={self.is_active})>"


class WorkflowExecution(Base):
    """
    Individual workflow execution records.
    Tracks trigger data, output, timing, and error info.
    """
    __tablename__ = "workflow_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # References
    workflow_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    voice_analysis_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("voice_analyses.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    lead_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_leads.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    # Trigger data
    trigger_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    trigger_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Execution status
    status: Mapped[ExecutionStatus] = mapped_column(
        SQLEnum(ExecutionStatus, name="execution_status", create_constraint=True),
        default=ExecutionStatus.PENDING,
        server_default="pending",
        nullable=False,
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    max_retries: Mapped[int] = mapped_column(Integer, default=3, server_default="3")

    # Results
    output_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    actions_taken: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # [{"action": "create_lead", "result": "success"}]

    # Timing
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )

    # Relationships
    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="executions")

    __table_args__ = (
        Index("idx_execution_status", "status"),
        Index("idx_execution_workflow_status", "workflow_id", "status"),
        Index("idx_execution_created", "created_at"),
        Index("idx_execution_started", "started_at"),
    )

    def __repr__(self) -> str:
        return f"<WorkflowExecution(id={self.id}, workflow_id={self.workflow_id}, status={self.status.value})>"
