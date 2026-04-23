import os
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

from app.database import Base
import app.models  # noqa: ensure models are registered

config = context.config
config.set_main_option("sqlalchemy.url", os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://ticketing:ticketing_pass@localhost:5432/ticketing_db"
))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online():
    engine = create_async_engine(config.get_main_option("sqlalchemy.url"), poolclass=pool.NullPool)
    async with engine.connect() as conn:
        await conn.run_sync(lambda sync_conn: context.configure(
            connection=sync_conn, target_metadata=target_metadata
        ))
        async with conn.begin():
            await conn.run_sync(lambda _: context.run_migrations())
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
