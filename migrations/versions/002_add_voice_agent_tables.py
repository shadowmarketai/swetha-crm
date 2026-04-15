"""Add voice agent tables (call_recordings, cloned_voices, knowledge_documents).

Revision ID: 002
Revises: 001
Create Date: 2026-03-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension (safe to call multiple times)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── CallRecording ──
    op.create_table(
        "call_recordings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("call_id", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("caller_number", sa.String(50), nullable=False, index=True),
        sa.Column("agent_voice_id", sa.String(255), nullable=True),
        sa.Column("sip_provider", sa.String(50), server_default="telecmi"),
        sa.Column("recording_path", sa.String(500), nullable=True),
        sa.Column("recording_blob", sa.LargeBinary, nullable=True),
        sa.Column("recording_size_bytes", sa.Integer, server_default="0"),
        sa.Column("audio_format", sa.String(10), server_default="wav"),
        sa.Column("duration_seconds", sa.Float, server_default="0.0"),
        sa.Column("sample_rate", sa.Integer, server_default="16000"),
        sa.Column("full_transcript", sa.Text, nullable=True),
        sa.Column("transcript_json", sa.JSON, nullable=True),
        sa.Column("caller_emotion", sa.String(50), nullable=True),
        sa.Column("caller_intent", sa.String(100), nullable=True),
        sa.Column("caller_sentiment", sa.Float, nullable=True),
        sa.Column("lead_score", sa.Float, nullable=True),
        sa.Column("tenant_id", sa.String(255), nullable=True, index=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    )
    op.create_index("ix_call_recordings_tenant_created", "call_recordings", ["tenant_id", "created_at"])

    # ── ClonedVoice ──
    op.create_table(
        "cloned_voices",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.String(255), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("person_name", sa.String(255), nullable=True),
        sa.Column("reference_audio_path", sa.String(500), nullable=False),
        sa.Column("reference_duration_seconds", sa.Float, server_default="0.0"),
        sa.Column("tts_engine", sa.String(50), server_default="indicf5"),
        sa.Column("internal_voice_id", sa.String(255), nullable=True),
        sa.Column("language", sa.String(10), server_default="en"),
        sa.Column("status", sa.String(20), server_default="processing"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    )

    # ── KnowledgeDocument ──
    op.create_table(
        "knowledge_documents",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.String(255), nullable=False, index=True),
        sa.Column("agent_id", sa.String(255), nullable=True, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("doc_type", sa.String(50), server_default="document"),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("question", sa.Text, nullable=True),
        sa.Column("answer", sa.Text, nullable=True),
        # pgvector column: 1536-dimension vector for OpenAI embeddings
        sa.Column("embedding_vector", sa.Text, nullable=True),  # Replaced by ALTER below
        sa.Column("chunk_index", sa.Integer, server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    )
    op.create_index("ix_knowledge_tenant_agent", "knowledge_documents", ["tenant_id", "agent_id"])

    # Replace Text column with proper vector type
    op.execute("ALTER TABLE knowledge_documents DROP COLUMN embedding_vector")
    op.execute("ALTER TABLE knowledge_documents ADD COLUMN embedding_vector vector(1536)")


def downgrade() -> None:
    op.drop_table("knowledge_documents")
    op.drop_table("cloned_voices")
    op.drop_table("call_recordings")
