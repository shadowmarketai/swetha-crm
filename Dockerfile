# ============================================
# VoiceFlow Marketing AI - Dockerfile
# Multi-stage build for production
# ============================================

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ ./
RUN npm run build

# Stage 2: Python dependency builder
FROM python:3.11-slim AS py-builder

WORKDIR /build

# Install build dependencies for psycopg2, torch, librosa, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    curl \
    ffmpeg \
    libsndfile1-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 3: Production runtime
FROM python:3.11-slim

# Labels
LABEL maintainer="VoiceFlow AI <devops@voiceflow.ai>"
LABEL description="VoiceFlow Marketing AI - Voice AI + CRM + Marketing Automation"

WORKDIR /app

# Install only runtime dependencies (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    libpq5 \
    curl \
    tini \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge -y --auto-remove

# Copy Python packages from builder stage
COPY --from=py-builder /install /usr/local

# Create non-root user for security
RUN groupadd --gid 1000 appuser \
    && useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

# Create data directories with correct ownership
RUN mkdir -p /app/data/raw /app/data/processed /app/models /app/logs \
    && chown -R appuser:appuser /app

# Copy application code
COPY --chown=appuser:appuser src/ ./src/
COPY --chown=appuser:appuser migrations/ ./migrations/
COPY --chown=appuser:appuser requirements.txt ./
COPY --chown=appuser:appuser alembic.ini ./

# Copy built frontend
COPY --from=frontend-builder --chown=appuser:appuser /frontend/dist ./static/

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV APP_ENV=production
# Multi-worker safety: only ONE container in the deployment should run the
# quotation render polling loop. API containers serve traffic; a separate
# single-worker container should set RUN_BG_WORKER=1 and run the same image.
ENV RUN_BG_WORKER=0

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["tini", "--"]

# Run with uvicorn for production
# --forwarded-allow-ips intentionally NOT set to "*" — the app's
# ProxyHeadersMiddleware already validates X-Forwarded-* against
# FORWARDED_ALLOW_IPS env (defaults 127.0.0.1,::1). Pass the proxy's
# real IP/CIDR via FORWARDED_ALLOW_IPS at deploy time.
CMD ["python", "-m", "uvicorn", "src.api.server:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--proxy-headers", \
     "--access-log", \
     "--log-level", "info"]
