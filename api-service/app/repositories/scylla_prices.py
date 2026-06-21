import logging
from datetime import date

from app.db.scylla import execute

logger = logging.getLogger(__name__)


def get_latest_price(symbol: str) -> dict[str, object] | None:
    query = """
        SELECT symbol, price, volume, event_time, source
        FROM stock_latest_prices
        WHERE symbol = %s
    """
    try:
        rows = execute(query, (symbol.upper(),))
        row = rows.one()
        if row is None:
            return None
        return {
            "symbol": row.symbol,
            "price": row.price,
            "volume": row.volume,
            "event_time": row.event_time.isoformat() if row.event_time else None,
            "source": row.source,
        }
    except Exception:
        logger.exception("Failed to get latest price for %s from ScyllaDB", symbol)
        return None


def list_latest_prices(limit: int = 200) -> list[dict[str, object]]:
    query = """
        SELECT symbol, price, volume, event_time, source
        FROM stock_latest_prices
        LIMIT %s
    """
    try:
        rows = execute(query, (limit,))
        return [
            {
                "symbol": row.symbol,
                "price": row.price,
                "volume": row.volume,
                "event_time": row.event_time.isoformat() if row.event_time else None,
                "source": row.source,
            }
            for row in rows
        ]
    except Exception:
        logger.exception("Failed to list latest prices from ScyllaDB")
        return []


def get_intraday_bars(symbol: str, event_date: date, limit: int = 120) -> list[dict[str, object]]:
    query = """
        SELECT symbol, event_date, window_start, window_end,
               open_price, high_price, low_price, close_price, volume
        FROM stock_ohlcv_1m
        WHERE symbol = %s AND event_date = %s
        LIMIT %s
    """
    try:
        rows = execute(query, (symbol.upper(), event_date, limit))
        return [
            {
                "symbol": row.symbol,
                "event_date": str(row.event_date),
                "window_start": row.window_start.isoformat(),
                "window_end": row.window_end.isoformat(),
                "open_price": row.open_price,
                "high_price": row.high_price,
                "low_price": row.low_price,
                "close_price": row.close_price,
                "volume": row.volume,
            }
            for row in rows
        ]
    except Exception:
        logger.exception("Failed to get intraday bars for %s from ScyllaDB", symbol)
        return []
