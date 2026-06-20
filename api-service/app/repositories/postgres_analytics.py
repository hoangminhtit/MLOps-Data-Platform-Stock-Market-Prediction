import logging

from app.db.postgres import fetch

logger = logging.getLogger(__name__)


async def list_daily_prices(symbol: str, limit: int = 30) -> list[dict[str, object]]:
    query = """
        SELECT
            s.symbol,
            d.full_date AS price_date,
            p.open_price,
            p.high_price,
            p.low_price,
            p.close_price,
            p.volume
        FROM fact_stock_daily_prices p
        JOIN dim_stock s ON s.stock_id = p.stock_id
        JOIN dim_date d ON d.date_id = p.date_id
        WHERE s.symbol = $1
        ORDER BY d.full_date DESC
        LIMIT $2
    """
    try:
        rows = await fetch(query, symbol.upper(), limit)
        return [dict(row) for row in rows]
    except Exception:
        logger.exception("Failed to list daily prices for symbol=%s", symbol)
        return []


async def list_top_movers(direction: str = "gainers", limit: int = 5) -> list[dict[str, object]]:
    order = "DESC" if direction == "gainers" else "ASC"
    query = f"""
        WITH latest_date AS (
            SELECT MAX(date_id) AS date_id FROM fact_stock_daily_prices
        )
        SELECT
            s.symbol,
            c.company_name AS name,
            p.open_price,
            p.close_price,
            p.volume,
            CASE
                WHEN p.open_price IS NULL OR p.open_price = 0 THEN NULL
                ELSE ROUND(((p.close_price - p.open_price) / p.open_price) * 100, 4)
            END AS change_percent
        FROM fact_stock_daily_prices p
        JOIN latest_date ld ON ld.date_id = p.date_id
        JOIN dim_stock s ON s.stock_id = p.stock_id
        LEFT JOIN dim_company c ON c.company_id = s.company_id
        ORDER BY change_percent {order} NULLS LAST
        LIMIT $1
    """
    try:
        rows = await fetch(query, limit)
        return [dict(row) for row in rows]
    except Exception:
        logger.exception("Failed to list top %s", direction)
        return []


async def list_high_volume(limit: int = 5) -> list[dict[str, object]]:
    query = """
        WITH latest_date AS (
            SELECT MAX(date_id) AS date_id FROM fact_stock_daily_prices
        )
        SELECT
            s.symbol,
            c.company_name AS name,
            p.close_price,
            p.volume
        FROM fact_stock_daily_prices p
        JOIN latest_date ld ON ld.date_id = p.date_id
        JOIN dim_stock s ON s.stock_id = p.stock_id
        LEFT JOIN dim_company c ON c.company_id = s.company_id
        ORDER BY p.volume DESC NULLS LAST
        LIMIT $1
    """
    try:
        rows = await fetch(query, limit)
        return [dict(row) for row in rows]
    except Exception:
        logger.exception("Failed to list high volume stocks")
        return []
