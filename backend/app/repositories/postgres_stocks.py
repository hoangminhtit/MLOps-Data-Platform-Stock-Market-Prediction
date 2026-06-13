import logging

from app.db.postgres import fetch, fetchrow

logger = logging.getLogger(__name__)


async def list_stocks() -> list[dict[str, object]]:
    query = """
        SELECT
            s.symbol,
            c.company_name AS name,
            c.exchange,
            sec.sector_name AS sector,
            c.industry
        FROM dim_stock s
        LEFT JOIN dim_company c ON c.company_id = s.company_id
        LEFT JOIN dim_sector sec ON sec.sector_id = c.sector_id
        ORDER BY s.symbol
    """
    try:
        rows = await fetch(query)
        return [dict(row) for row in rows]
    except Exception:
        logger.exception("Failed to list stocks from PostgreSQL")
        return []


async def get_stock(symbol: str) -> dict[str, object] | None:
    query = """
        SELECT
            s.symbol,
            c.company_name AS name,
            c.exchange,
            sec.sector_name AS sector,
            c.industry
        FROM dim_stock s
        LEFT JOIN dim_company c ON c.company_id = s.company_id
        LEFT JOIN dim_sector sec ON sec.sector_id = c.sector_id
        WHERE s.symbol = $1
    """
    try:
        row = await fetchrow(query, symbol.upper())
        return dict(row) if row else None
    except Exception:
        logger.exception("Failed to get stock %s from PostgreSQL", symbol)
        return None
