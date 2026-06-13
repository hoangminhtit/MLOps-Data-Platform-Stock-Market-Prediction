import asyncpg

from app.core.config import settings


async def fetch(query: str, *args) -> list[asyncpg.Record]:
    conn = await asyncpg.connect(settings.postgres_dsn, timeout=5)
    try:
        return await conn.fetch(query, *args)
    finally:
        await conn.close()


async def fetchrow(query: str, *args) -> asyncpg.Record | None:
    conn = await asyncpg.connect(settings.postgres_dsn, timeout=5)
    try:
        return await conn.fetchrow(query, *args)
    finally:
        await conn.close()


async def check_postgres() -> bool:
    try:
        conn = await asyncpg.connect(settings.postgres_dsn, timeout=3)
        await conn.execute("SELECT 1")
        await conn.close()
        return True
    except Exception:
        return False
