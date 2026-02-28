"""Initial schema — matches existing database tables.

Revision ID: 001
Revises: None
Create Date: 2026-02-16
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("email", sa.Text, unique=True, nullable=False),
        sa.Column("name", sa.Text),
        sa.Column("hashed_password", sa.Text, nullable=False),
        sa.Column("role", sa.Text, server_default="user"),
        sa.Column("plan", sa.Text, server_default="starter"),
        sa.Column("company", sa.Text),
        sa.Column("phone", sa.Text),
        sa.Column("created_at", sa.Text),
        sa.Column("is_active", sa.Integer, server_default="1"),
    )

    op.create_table(
        "leads",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("phone", sa.Text),
        sa.Column("email", sa.Text),
        sa.Column("company", sa.Text),
        sa.Column("source", sa.Text, server_default="Manual"),
        sa.Column("status", sa.Text, server_default="cold"),
        sa.Column("score", sa.Integer, server_default="0"),
        sa.Column("tags", sa.Text, server_default="[]"),
        sa.Column("notes", sa.Text),
        sa.Column("assigned_to", sa.Text),
        sa.Column("created_at", sa.Text),
        sa.Column("updated_at", sa.Text),
    )

    op.create_table(
        "calls",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("lead_id", sa.Text),
        sa.Column("phone", sa.Text),
        sa.Column("duration", sa.Integer, server_default="0"),
        sa.Column("status", sa.Text, server_default="completed"),
        sa.Column("direction", sa.Text, server_default="outbound"),
        sa.Column("sentiment", sa.Text, server_default="neutral"),
        sa.Column("language", sa.Text, server_default="English"),
        sa.Column("transcript", sa.Text),
        sa.Column("summary", sa.Text),
        sa.Column("recording_url", sa.Text),
        sa.Column("agent_id", sa.Text),
        sa.Column("created_at", sa.Text),
    )

    op.create_table(
        "settings",
        sa.Column("key", sa.Text, primary_key=True),
        sa.Column("value", sa.Text, nullable=False),
    )

    op.create_table(
        "campaigns",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("mode", sa.Text, server_default="power"),
        sa.Column("caller_id", sa.Text, server_default=""),
        sa.Column("status", sa.Text, server_default="draft"),
        sa.Column("start_time", sa.Text, server_default="09:00"),
        sa.Column("end_time", sa.Text, server_default="21:00"),
        sa.Column("max_attempts", sa.Integer, server_default="3"),
        sa.Column("script", sa.Text, server_default=""),
        sa.Column("total_contacts", sa.Integer, server_default="0"),
        sa.Column("dialed", sa.Integer, server_default="0"),
        sa.Column("connected", sa.Integer, server_default="0"),
        sa.Column("converted", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.Text),
        sa.Column("updated_at", sa.Text),
    )

    op.create_table(
        "assistants",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("personality", sa.Text, server_default="professional"),
        sa.Column("industry", sa.Text, server_default="general"),
        sa.Column("is_active", sa.Integer, server_default="1"),
        sa.Column("total_calls", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.Text),
        sa.Column("updated_at", sa.Text),
    )

    # Indexes
    op.create_index("idx_leads_status", "leads", ["status"])
    op.create_index("idx_leads_email", "leads", ["email"])
    op.create_index("idx_calls_lead_id", "calls", ["lead_id"])
    op.create_index("idx_calls_created_at", "calls", ["created_at"])
    op.create_index("idx_campaigns_status", "campaigns", ["status"])


def downgrade() -> None:
    op.drop_table("assistants")
    op.drop_table("campaigns")
    op.drop_table("settings")
    op.drop_table("calls")
    op.drop_table("leads")
    op.drop_table("users")
