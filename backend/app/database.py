from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator
import os
import asyncio
import logging

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://ticketing:ticketing_pass@postgres:5432/ticketing_db"
)

# Async engine with connection pooling
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,       
    pool_recycle=3600,        
    echo=False,               
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,   
    autoflush=False,
    autocommit=False,
)

class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: provides a database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def create_tables():
    """Create all tables with retry logic so Docker doesn't crash."""
    for attempt in range(8):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables verified/created successfully.")
            return
        except Exception as e:
            logger.warning(f"Database not ready, retrying in 5s... ({e})")
            await asyncio.sleep(5)
    logger.error("Failed to connect to database after multiple attempts.")

async def drop_tables():
    """Drop all tables. Useful for test teardown."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)