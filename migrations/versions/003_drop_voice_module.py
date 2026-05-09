"""Drop the in-CRM voice module — VoiceFlow is now an external SaaS.

Removes:
  - voice_analyses (and its FK referenced from crm_activities.voice_analysis_id)
  - call_recordings, cloned_voices, knowledge_documents (voice agent tables from 002)
  - dialer_campaigns, dialer_contacts, dialer_calls, dnc_entries (dialer tables, if present)

The CRM leads' `primary_emotion`, `primary_intent`, `detected_dialect`,
`avg_sentiment`, `total_calls`, `last_call_at` columns are KEPT — they are
populated by the VoiceFlow webhook from conversation analysis.

Revision ID: 003
Revises: 002
Create Date: 2026-05-09
"""
from typing import Sequence, Union

from alembic import op


revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Drop FK column on crm_activities ──────────────────────────
    # Use raw SQL with IF EXISTS so the migration is idempotent across
    # databases that may or may not have this column (legacy DBs that never
    # had the SQLAlchemy schema created via Alembic will skip this safely).
    op.execute("ALTER TABLE crm_activities DROP COLUMN IF EXISTS voice_analysis_id")

    # ── Drop voice analyses ──────────────────────────────────────
    op.execute("DROP TABLE IF EXISTS voice_analyses CASCADE")

    # ── Drop voice agent tables (from migration 002) ─────────────
    op.execute("DROP TABLE IF EXISTS knowledge_documents CASCADE")
    op.execute("DROP TABLE IF EXISTS cloned_voices CASCADE")
    op.execute("DROP TABLE IF EXISTS call_recordings CASCADE")

    # ── Drop dialer tables (if present) ───────────────────────────
    op.execute("DROP TABLE IF EXISTS dialer_calls CASCADE")
    op.execute("DROP TABLE IF EXISTS dialer_contacts CASCADE")
    op.execute("DROP TABLE IF EXISTS dialer_campaigns CASCADE")
    op.execute("DROP TABLE IF EXISTS dnc_entries CASCADE")

    # ── Drop the legacy 'calls' table from 001 (transcripts now in
    # voiceflow_conversations from 004). Keep `leads` (legacy) intact for now
    # — it is separate from `crm_leads`.
    op.execute("DROP TABLE IF EXISTS calls CASCADE")
    op.execute("DROP TABLE IF EXISTS assistants CASCADE")


def downgrade() -> None:
    # No-op: we don't recreate the deleted voice schema. If you need to roll
    # back, restore from a database backup taken before 003 was applied.
    pass
