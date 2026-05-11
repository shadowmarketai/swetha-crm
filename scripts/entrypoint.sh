#!/bin/sh
# Production entrypoint: run idempotent DB migrations, then exec uvicorn.
#
# Why here instead of a one-shot command:
#   - alembic upgrade head is idempotent — safe on every container start
#   - new replicas/redeploys auto-pick up schema changes
#   - removes the "I forgot to migrate" failure mode
#
# Set SKIP_MIGRATIONS=1 to bypass (useful when running multiple replicas;
# only the bootstrap container needs to migrate, or you run migrations
# from a separate task).

set -e

if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
    echo "[entrypoint] SKIP_MIGRATIONS=1 — bypassing alembic upgrade"
else
    echo "[entrypoint] Running alembic upgrade head…"
    alembic upgrade head || {
        echo "[entrypoint] alembic upgrade failed — refusing to start."
        echo "[entrypoint] (set SKIP_MIGRATIONS=1 to bypass, e.g. for a DB-less smoke test)"
        exit 1
    }
    echo "[entrypoint] migrations applied."
fi

# Exec so PID 1 is uvicorn (tini still wraps via Dockerfile ENTRYPOINT).
exec "$@"
