import asyncpg

from app.core.config import settings


async def check_postgres() -> bool:
    try:
        conn = await asyncpg.connect(settings.postgres_dsn, timeout=3)
        await conn.execute("SELECT 1")
        await conn.close()
        return True
    except Exception:
        return False
