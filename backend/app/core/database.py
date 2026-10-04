from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.app.core.config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Check available PostgreSQL DBAPI driver
connect_args = {}
try:
    import psycopg2  # noqa: F401
    # Standard postgresql:// or postgresql+psycopg2://
    if "postgresql+pg8000://" in db_url:
        db_url = db_url.replace("postgresql+pg8000://", "postgresql://", 1)
    connect_args = {"connect_timeout": 15}
except ImportError:
    try:
        import pg8000  # noqa: F401
        if not db_url.startswith("postgresql+pg8000://"):
            db_url = db_url.replace("postgresql://", "postgresql+pg8000://", 1)
        connect_args = {"timeout": 15}
    except ImportError:
        connect_args = {"connect_timeout": 15}

# Configure connection pooling and timeout suitable for hosted PostgreSQL (Neon, Render, Supabase)
engine = create_engine(
    db_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args=connect_args if "postgresql" in db_url else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()