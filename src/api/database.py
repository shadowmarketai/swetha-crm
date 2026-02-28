"""
VoiceFlow Marketing AI - Database Layer
========================================
Modern SQLAlchemy 2.0 database configuration.

Supports:
- PostgreSQL (production) via psycopg2 / asyncpg
- SQLite (development) via sqlite3 / aiosqlite
- Connection pooling with configurable pool size
- Both sync and async session factories
- Legacy raw-SQL db() context manager for backward compatibility

Set DATABASE_URL env var for PostgreSQL:
  DATABASE_URL=postgresql://user:pass@host:5432/voiceflow

Defaults to SQLite (voiceflow.db) when DATABASE_URL is not set.
"""

import os
import logging
import threading
from contextlib import contextmanager
from typing import Generator, AsyncGenerator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool, StaticPool

logger = logging.getLogger(__name__)

# ============================================
# Configuration
# ============================================

DATABASE_URL = os.environ.get("DATABASE_URL", "")
USE_POSTGRES = DATABASE_URL.startswith("postgresql")

# Pool settings (configurable via env vars)
POOL_SIZE = int(os.environ.get("DB_POOL_SIZE", "10"))
MAX_OVERFLOW = int(os.environ.get("DB_MAX_OVERFLOW", "20"))
POOL_TIMEOUT = int(os.environ.get("DB_POOL_TIMEOUT", "30"))
POOL_RECYCLE = int(os.environ.get("DB_POOL_RECYCLE", "1800"))  # 30 minutes
ECHO_SQL = os.environ.get("DB_ECHO", "false").lower() == "true"


# ============================================
# SQLAlchemy Engine & Session Factory
# ============================================

def _get_database_url() -> str:
    """Get the database URL, defaulting to SQLite for development."""
    if DATABASE_URL:
        return DATABASE_URL
    db_path = os.path.join(os.path.dirname(__file__), "..", "..", "voiceflow.db")
    db_path = os.path.abspath(db_path)
    return f"sqlite:///{db_path}"


def _create_engine():
    """Create the SQLAlchemy engine with appropriate settings."""
    url = _get_database_url()

    if url.startswith("sqlite"):
        # SQLite: use StaticPool for thread safety with check_same_thread=False
        engine = create_engine(
            url,
            echo=ECHO_SQL,
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
        )
        # Enable WAL mode and foreign keys for SQLite
        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine
    else:
        # PostgreSQL: use QueuePool with connection pooling
        return create_engine(
            url,
            echo=ECHO_SQL,
            poolclass=QueuePool,
            pool_size=POOL_SIZE,
            max_overflow=MAX_OVERFLOW,
            pool_timeout=POOL_TIMEOUT,
            pool_recycle=POOL_RECYCLE,
            pool_pre_ping=True,  # verify connections before use
        )


# Lazy-initialized engine and session factory
_engine = None
_SessionLocal = None


def get_engine():
    """Get or create the SQLAlchemy engine (singleton)."""
    global _engine
    if _engine is None:
        _engine = _create_engine()
    return _engine


def get_session_factory() -> sessionmaker:
    """Get or create the session factory (singleton)."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(),
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
    return _SessionLocal


# ============================================
# Dependency: get_db (for FastAPI Depends)
# ============================================

def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a database session.
    Auto-closes session when request completes.

    Usage:
        @router.get("/items")
        async def list_items(db: Session = Depends(get_db)):
            items = db.query(Item).all()
            return items
    """
    SessionLocal = get_session_factory()
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ============================================
# Async support (PostgreSQL + asyncpg)
# ============================================

_async_engine = None
_AsyncSessionLocal = None


def get_async_engine():
    """Get or create the async SQLAlchemy engine (PostgreSQL only)."""
    global _async_engine
    if _async_engine is None:
        try:
            from sqlalchemy.ext.asyncio import create_async_engine
        except ImportError:
            logger.warning("sqlalchemy.ext.asyncio not available; async engine disabled.")
            return None

        url = _get_database_url()
        if url.startswith("postgresql"):
            async_url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            async_url = async_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
        elif url.startswith("sqlite"):
            async_url = url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
        else:
            logger.warning("Async engine not supported for URL: %s", url[:20])
            return None

        _async_engine = create_async_engine(
            async_url,
            echo=ECHO_SQL,
            pool_pre_ping=True,
        )
    return _async_engine


def get_async_session_factory():
    """Get or create the async session factory."""
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        try:
            from sqlalchemy.ext.asyncio import AsyncSession
            from sqlalchemy.orm import sessionmaker as async_sessionmaker
        except ImportError:
            logger.warning("Async session not available.")
            return None

        engine = get_async_engine()
        if engine is None:
            return None

        _AsyncSessionLocal = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
    return _AsyncSessionLocal


async def get_async_db() -> AsyncGenerator:
    """
    FastAPI dependency that yields an async database session.

    Usage:
        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_async_db)):
            result = await db.execute(select(Item))
            return result.scalars().all()
    """
    factory = get_async_session_factory()
    if factory is None:
        raise RuntimeError("Async database session not available. Check your database configuration.")

    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ============================================
# Database initialization (SQLAlchemy models)
# ============================================

def init_models():
    """
    Create all tables defined by SQLAlchemy models.
    Imports Base from the models package and creates tables.
    """
    from api.models import Base
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    logger.info("SQLAlchemy model tables created successfully.")


# ============================================
# Legacy raw-SQL support (backward compatibility)
# ============================================
# The following functions maintain backward compatibility with the raw-SQL
# approach used by auth.py, leads.py, calls.py, campaigns.py, etc.
# These modules use `from api.database import db, init_db` and execute
# raw SQL via connection objects.
# This will be gradually migrated to SQLAlchemy ORM sessions.

_lock = threading.Lock()


if not USE_POSTGRES:
    import sqlite3

    _DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "voiceflow.db")
    _DB_PATH = os.path.abspath(_DB_PATH)

    def get_connection():
        """Get a raw SQLite connection (legacy)."""
        conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    @contextmanager
    def db():
        """Legacy raw-SQL context manager for SQLite."""
        with _lock:
            conn = get_connection()
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

    def init_db():
        """Initialize database: create legacy raw-SQL tables + SQLAlchemy model tables."""
        with db() as conn:
            conn.executescript(_SQLITE_SCHEMA)
        # Also create SQLAlchemy model tables
        try:
            init_models()
        except Exception as e:
            logger.warning("Could not create SQLAlchemy model tables: %s", e)
        _seed_defaults()

    _SQLITE_SCHEMA = """
    CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        email       TEXT UNIQUE NOT NULL,
        name        TEXT,
        hashed_password TEXT NOT NULL,
        role        TEXT DEFAULT 'user',
        plan        TEXT DEFAULT 'starter',
        company     TEXT,
        phone       TEXT,
        created_at  TEXT DEFAULT (datetime('now')),
        is_active   INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS leads (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        phone       TEXT,
        email       TEXT,
        company     TEXT,
        source      TEXT DEFAULT 'Manual',
        status      TEXT DEFAULT 'cold',
        score       INTEGER DEFAULT 0,
        tags        TEXT DEFAULT '[]',
        notes       TEXT,
        assigned_to TEXT,
        created_at  TEXT DEFAULT (datetime('now')),
        updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS calls (
        id          TEXT PRIMARY KEY,
        lead_id     TEXT,
        phone       TEXT,
        duration    INTEGER DEFAULT 0,
        status      TEXT DEFAULT 'completed',
        direction   TEXT DEFAULT 'outbound',
        sentiment   TEXT DEFAULT 'neutral',
        language    TEXT DEFAULT 'English',
        transcript  TEXT,
        summary     TEXT,
        recording_url TEXT,
        agent_id    TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        description     TEXT DEFAULT '',
        mode            TEXT DEFAULT 'power',
        caller_id       TEXT DEFAULT '',
        status          TEXT DEFAULT 'draft',
        start_time      TEXT DEFAULT '09:00',
        end_time        TEXT DEFAULT '21:00',
        max_attempts    INTEGER DEFAULT 3,
        script          TEXT DEFAULT '',
        total_contacts  INTEGER DEFAULT 0,
        dialed          INTEGER DEFAULT 0,
        connected       INTEGER DEFAULT 0,
        converted       INTEGER DEFAULT 0,
        created_at      TEXT DEFAULT (datetime('now')),
        updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assistants (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT DEFAULT '',
        personality TEXT DEFAULT 'professional',
        industry    TEXT DEFAULT 'general',
        is_active   INTEGER DEFAULT 1,
        total_calls INTEGER DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now')),
        updated_at  TEXT DEFAULT (datetime('now'))
    );
    """

else:
    import psycopg2
    import psycopg2.pool
    import psycopg2.extras

    _pool = None

    def _get_pool():
        global _pool
        if _pool is None:
            _pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=2,
                maxconn=20,
                dsn=DATABASE_URL,
            )
        return _pool

    def get_connection():
        """Get a raw PostgreSQL connection (legacy)."""
        pool = _get_pool()
        conn = pool.getconn()
        conn.autocommit = False
        return conn

    @contextmanager
    def db():
        """Legacy raw-SQL context manager for PostgreSQL."""
        pool = _get_pool()
        conn = pool.getconn()
        try:
            conn.cursor_factory = psycopg2.extras.RealDictCursor
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            pool.putconn(conn)

    def init_db():
        """Initialize database: create legacy raw-SQL tables + SQLAlchemy model tables."""
        with db() as conn:
            cur = conn.cursor()
            cur.execute(_PG_SCHEMA)
            conn.commit()
        # Also create SQLAlchemy model tables
        try:
            init_models()
        except Exception as e:
            logger.warning("Could not create SQLAlchemy model tables: %s", e)
        _seed_defaults()

    _PG_SCHEMA = """
    CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        email       TEXT UNIQUE NOT NULL,
        name        TEXT,
        hashed_password TEXT NOT NULL,
        role        TEXT DEFAULT 'user',
        plan        TEXT DEFAULT 'starter',
        company     TEXT,
        phone       TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        is_active   BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS leads (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        phone       TEXT,
        email       TEXT,
        company     TEXT,
        source      TEXT DEFAULT 'Manual',
        status      TEXT DEFAULT 'cold',
        score       INTEGER DEFAULT 0,
        tags        JSONB DEFAULT '[]',
        notes       TEXT,
        assigned_to TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS calls (
        id          TEXT PRIMARY KEY,
        lead_id     TEXT REFERENCES leads(id) ON DELETE SET NULL,
        phone       TEXT,
        duration    INTEGER DEFAULT 0,
        status      TEXT DEFAULT 'completed',
        direction   TEXT DEFAULT 'outbound',
        sentiment   TEXT DEFAULT 'neutral',
        language    TEXT DEFAULT 'English',
        transcript  JSONB,
        summary     TEXT,
        recording_url TEXT,
        agent_id    TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        description     TEXT DEFAULT '',
        mode            TEXT DEFAULT 'power',
        caller_id       TEXT DEFAULT '',
        status          TEXT DEFAULT 'draft',
        start_time      TEXT DEFAULT '09:00',
        end_time        TEXT DEFAULT '21:00',
        max_attempts    INTEGER DEFAULT 3,
        script          TEXT DEFAULT '',
        total_contacts  INTEGER DEFAULT 0,
        dialed          INTEGER DEFAULT 0,
        connected       INTEGER DEFAULT 0,
        converted       INTEGER DEFAULT 0,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS assistants (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT DEFAULT '',
        personality TEXT DEFAULT 'professional',
        industry    TEXT DEFAULT 'general',
        is_active   BOOLEAN DEFAULT TRUE,
        total_calls INTEGER DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
    CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON calls(lead_id);
    CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
    """


# ============================================
# Shared: Seed defaults (legacy)
# ============================================

def _seed_defaults():
    """Insert default admin user and demo leads/calls if tables are empty."""
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

    with db() as conn:
        if USE_POSTGRES:
            cur = conn.cursor()
            cur.execute("SELECT id FROM users WHERE email=%s", ("admin@shadowmarket.ai",))
            existing = cur.fetchone()
        else:
            existing = conn.execute("SELECT id FROM users WHERE email=?", ("admin@shadowmarket.ai",)).fetchone()

        if not existing:
            _ph = "%" + "s" if USE_POSTGRES else "?"
            _insert_user = f"""
                INSERT INTO users (id,email,name,hashed_password,role,plan,company,phone)
                VALUES ({_ph},{_ph},{_ph},{_ph},{_ph},{_ph},{_ph},{_ph})
            """
            params = (
                "user-001",
                "admin@shadowmarket.ai",
                "Shadow Market",
                pwd_context.hash("admin123"),
                "admin", "pro",
                "Shadow Market",
                "+91 98765 43210",
            )
            if USE_POSTGRES:
                cur = conn.cursor()
                cur.execute(_insert_user, params)
            else:
                conn.execute(_insert_user, params)

        # Demo leads
        if USE_POSTGRES:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) AS cnt FROM leads")
            lead_count = cur.fetchone()["cnt"]
        else:
            lead_count = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]

        if lead_count == 0:
            demo_leads = [
                ("lead-001","Priya Sharma","9876543210","priya@techcorp.in","TechCorp Solutions","Meta Ads","hot",85),
                ("lead-002","Rajesh Kumar","9845123456","rajesh@retailpro.com","Retail Pro","Google Ads","warm",72),
                ("lead-003","Anita Patel","9001234567","anita@financeplus.in","Finance Plus","LinkedIn","cold",45),
                ("lead-004","Mohammed Ali","9123456789","ali@realty.in","Ali Realty","WhatsApp","hot",91),
                ("lead-005","Sunita Rao","9234567890","sunita@edtech.in","EduTech Pvt Ltd","Referral","warm",63),
            ]
            if USE_POSTGRES:
                cur = conn.cursor()
                for l in demo_leads:
                    cur.execute("""
                        INSERT INTO leads (id,name,phone,email,company,source,status,score)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    """, l)
            else:
                for l in demo_leads:
                    conn.execute("""
                        INSERT INTO leads (id,name,phone,email,company,source,status,score)
                        VALUES (?,?,?,?,?,?,?,?)
                    """, l)

        # Demo calls
        if USE_POSTGRES:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) AS cnt FROM calls")
            call_count = cur.fetchone()["cnt"]
        else:
            call_count = conn.execute("SELECT COUNT(*) FROM calls").fetchone()[0]

        if call_count == 0:
            import random, datetime
            now = datetime.datetime.utcnow()
            statuses = ["completed","completed","completed","no_answer","busy","failed"]
            sentiments = ["positive","neutral","negative","positive","positive","neutral"]
            languages = ["Hindi","English","Tamil","Telugu","Marathi","Bengali"]
            phones = [f"+91 9{random.randint(100000000,999999999)}" for _ in range(30)]
            for i in range(30):
                ts = (now - datetime.timedelta(hours=i*3)).isoformat()
                if USE_POSTGRES:
                    cur = conn.cursor()
                    cur.execute("""
                        INSERT INTO calls (id,phone,duration,status,direction,sentiment,language,created_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (
                        f"call-{i+1:03d}",
                        phones[i],
                        random.randint(30, 480),
                        statuses[i % len(statuses)],
                        "outbound" if i % 3 != 0 else "inbound",
                        sentiments[i % len(sentiments)],
                        languages[i % len(languages)],
                        ts,
                    ))
                else:
                    conn.execute("""
                        INSERT INTO calls (id,phone,duration,status,direction,sentiment,language,created_at)
                        VALUES (?,?,?,?,?,?,?,?)
                    """, (
                        f"call-{i+1:03d}",
                        phones[i],
                        random.randint(30, 480),
                        statuses[i % len(statuses)],
                        "outbound" if i % 3 != 0 else "inbound",
                        sentiments[i % len(sentiments)],
                        languages[i % len(languages)],
                        ts,
                    ))
