import logging

from app.db.postgres import fetch

logger = logging.getLogger(__name__)


async def list_stock_news(symbol: str, limit: int = 50) -> list[dict[str, object]]:
    query = """
        SELECT
            s.symbol,
            ns.source_name AS source,
            n.published_at,
            n.title,
            n.content,
            n.url,
            n.sentiment_score
        FROM fact_stock_news n
        JOIN dim_stock s ON s.stock_id = n.stock_id
        LEFT JOIN dim_news_source ns ON ns.source_id = n.source_id
        WHERE s.symbol = $1
        ORDER BY n.published_at DESC NULLS LAST, n.created_at DESC
        LIMIT $2
    """
    try:
        rows = await fetch(query, symbol.upper(), limit)
        return [
            {
                "symbol": row["symbol"],
                "source": row["source"],
                "published_at": row["published_at"].isoformat() if row["published_at"] else None,
                "title": row["title"],
                "content": row["content"],
                "url": row["url"],
                "sentiment_score": float(row["sentiment_score"]) if row["sentiment_score"] is not None else None,
            }
            for row in rows
        ]
    except Exception:
        logger.exception("Failed to list news for %s from PostgreSQL", symbol)
        return []
