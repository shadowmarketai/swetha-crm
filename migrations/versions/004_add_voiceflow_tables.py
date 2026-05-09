"""Add VoiceFlow integration tables.

Stores conversations + recordings synced from the external VoiceFlow SaaS.
Recording URLs reference VoiceFlow's storage; we don't host the media.

Revision ID: 004
Revises: 003
Create Date: 2026-05-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── voiceflow_conversations ──────────────────────────────────
    op.create_table(
        "voiceflow_conversations",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "lead_id", sa.Integer,
            sa.ForeignKey("crm_leads.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("voiceflow_session_id", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("voiceflow_agent_id", sa.String(255), nullable=True),
        sa.Column(
            "status", sa.String(30),
            nullable=False, server_default="queued",
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_sec", sa.Float, nullable=False, server_default="0"),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("transcript", sa.JSON, nullable=True),
        sa.Column("full_transcript_text", sa.Text, nullable=True),
        sa.Column("sentiment", sa.Float, nullable=False, server_default="0"),
        sa.Column("primary_emotion", sa.String(50), nullable=True),
        sa.Column("primary_intent", sa.String(50), nullable=True),
        sa.Column("detected_dialect", sa.String(50), nullable=True),
        sa.Column("lead_score", sa.Float, nullable=True),
        sa.Column("raw_payload", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    )
    op.create_index("idx_vfc_lead_started", "voiceflow_conversations", ["lead_id", "started_at"])
    op.create_index("idx_vfc_status", "voiceflow_conversations", ["status"])

    # ── voiceflow_recordings ─────────────────────────────────────
    op.create_table(
        "voiceflow_recordings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "conversation_id", sa.Integer,
            sa.ForeignKey("voiceflow_conversations.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("recording_url", sa.String(1000), nullable=False),
        sa.Column("duration_sec", sa.Float, nullable=False, server_default="0"),
        sa.Column("audio_format", sa.String(20), nullable=False, server_default="mp3"),
        sa.Column("file_size_bytes", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("voiceflow_recordings")
    op.drop_index("idx_vfc_status", table_name="voiceflow_conversations")
    op.drop_index("idx_vfc_lead_started", table_name="voiceflow_conversations")
    op.drop_table("voiceflow_conversations")
