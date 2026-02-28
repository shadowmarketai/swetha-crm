#!/bin/bash
# ============================================
# VoiceFlow AI — Database Backup Script
# ============================================
#
# Usage:
#   ./scripts/backup.sh              # Auto-detect DB type
#   ./scripts/backup.sh sqlite       # Force SQLite backup
#   ./scripts/backup.sh postgres     # Force PostgreSQL backup
#
# Crontab (daily at 2 AM):
#   0 2 * * * /path/to/voiceflow/scripts/backup.sh >> /var/log/voiceflow-backup.log 2>&1
#
# Environment:
#   DATABASE_URL        PostgreSQL connection string
#   S3_BACKUP_BUCKET    S3 bucket for remote backups (optional)
#   AWS_PROFILE         AWS profile for S3 (optional)
#   BACKUP_RETENTION    Days to keep local backups (default: 30)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS="${BACKUP_RETENTION:-30}"

mkdir -p "$BACKUP_DIR"

echo "=== VoiceFlow Backup — $(date) ==="

# ---- Detect database type ----
DB_TYPE="${1:-auto}"
if [ "$DB_TYPE" = "auto" ]; then
    if [ -n "${DATABASE_URL:-}" ] && echo "$DATABASE_URL" | grep -q "postgresql"; then
        DB_TYPE="postgres"
    else
        DB_TYPE="sqlite"
    fi
fi

echo "Database type: $DB_TYPE"

# ---- SQLite backup ----
if [ "$DB_TYPE" = "sqlite" ]; then
    SQLITE_FILE="${PROJECT_DIR}/voiceflow.db"
    if [ ! -f "$SQLITE_FILE" ]; then
        echo "ERROR: SQLite file not found at $SQLITE_FILE"
        exit 1
    fi

    BACKUP_FILE="${BACKUP_DIR}/voiceflow_sqlite_${TIMESTAMP}.db"
    # Use SQLite online backup (safe even if DB is in use)
    sqlite3 "$SQLITE_FILE" ".backup '${BACKUP_FILE}'"
    gzip "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"

    echo "SQLite backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
fi

# ---- PostgreSQL backup ----
if [ "$DB_TYPE" = "postgres" ]; then
    if [ -z "${DATABASE_URL:-}" ]; then
        echo "ERROR: DATABASE_URL not set"
        exit 1
    fi

    BACKUP_FILE="${BACKUP_DIR}/voiceflow_pg_${TIMESTAMP}.sql.gz"
    pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > "$BACKUP_FILE"

    echo "PostgreSQL backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
fi

# ---- Upload to S3 (optional) ----
if [ -n "${S3_BACKUP_BUCKET:-}" ]; then
    S3_PATH="s3://${S3_BACKUP_BUCKET}/voiceflow/$(date +%Y/%m)/"
    aws s3 cp "$BACKUP_FILE" "$S3_PATH" ${AWS_PROFILE:+--profile "$AWS_PROFILE"}
    echo "Uploaded to $S3_PATH"
fi

# ---- Clean old backups ----
echo "Cleaning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "voiceflow_*" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# ---- Summary ----
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "voiceflow_*" | wc -l)
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
echo "Total backups: $BACKUP_COUNT ($BACKUP_SIZE)"
echo "=== Backup complete ==="
