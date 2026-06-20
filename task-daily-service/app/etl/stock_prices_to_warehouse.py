import logging
import signal
import time
from datetime import UTC, date, datetime

from app.core.config import settings
from app.core.logging import configure_logging
from app.core.postgres import wait_for_postgres
from app.core.scylla import wait_for_scylla

configure_logging()
logger = logging.getLogger(__name__)
running = True


def stop(_signum, _frame) -> None:
    global running
    running = False


def date_id(value: date) -> int:
    return int(value.strftime("%Y%m%d"))


def ensure_date(cur, value: date) -> int:
    current_date_id = date_id(value)
    cur.execute(
        """
        INSERT INTO dim_date (date_id, full_date, day, month, quarter, year, day_of_week)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (date_id) DO NOTHING
        """,
        (
            current_date_id,
            value,
            value.day,
            value.month,
            ((value.month - 1) // 3) + 1,
            value.year,
            value.isoweekday(),
        ),
    )
    return current_date_id


def ensure_indexes(cur) -> None:
    cur.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_fact_stock_intraday_prices_stock_time
        ON fact_stock_intraday_prices (stock_id, event_time)
        """
    )


def get_stock_id(cur, symbol: str) -> int | None:
    cur.execute("SELECT stock_id FROM dim_stock WHERE symbol = %s", (symbol.upper(),))
    row = cur.fetchone()
    return row[0] if row else None


def load_intraday_bars(session, symbol: str, event_date: date, limit: int = 1500) -> list[dict[str, object]]:
    statement = session.prepare(
        """
        SELECT symbol, event_date, window_start, window_end, open_price, high_price, low_price, close_price, volume
        FROM stock_ohlcv_1m
        WHERE symbol = ? AND event_date = ?
        LIMIT ?
        """
    )
    rows = session.execute(statement, (symbol.upper(), event_date, limit))
    bars = [
        {
            "symbol": row.symbol,
            "event_date": row.event_date,
            "window_start": row.window_start,
            "window_end": row.window_end,
            "open_price": row.open_price,
            "high_price": row.high_price,
            "low_price": row.low_price,
            "close_price": row.close_price,
            "volume": row.volume,
        }
        for row in rows
    ]
    return sorted(bars, key=lambda item: item["window_start"])


def upsert_intraday(cur, stock_id: int, bars: list[dict[str, object]]) -> int:
    changed = 0
    for bar in bars:
        cur.execute(
            """
            INSERT INTO fact_stock_intraday_prices
            (stock_id, event_time, open_price, high_price, low_price, close_price, volume)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (stock_id, event_time) DO UPDATE SET
                open_price = EXCLUDED.open_price,
                high_price = EXCLUDED.high_price,
                low_price = EXCLUDED.low_price,
                close_price = EXCLUDED.close_price,
                volume = EXCLUDED.volume
            """,
            (
                stock_id,
                bar["window_start"],
                bar["open_price"],
                bar["high_price"],
                bar["low_price"],
                bar["close_price"],
                bar["volume"],
            ),
        )
        changed += 1
    return changed


def upsert_daily(cur, stock_id: int, current_date_id: int, bars: list[dict[str, object]]) -> bool:
    if not bars:
        return False

    open_price = bars[0]["open_price"]
    close_price = bars[-1]["close_price"]
    high_price = max(float(bar["high_price"]) for bar in bars)
    low_price = min(float(bar["low_price"]) for bar in bars)
    volume = sum(int(bar["volume"] or 0) for bar in bars)

    cur.execute(
        """
        INSERT INTO fact_stock_daily_prices
        (stock_id, date_id, open_price, high_price, low_price, close_price, volume)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (stock_id, date_id) DO UPDATE SET
            open_price = EXCLUDED.open_price,
            high_price = EXCLUDED.high_price,
            low_price = EXCLUDED.low_price,
            close_price = EXCLUDED.close_price,
            volume = EXCLUDED.volume
        """,
        (stock_id, current_date_id, open_price, high_price, low_price, close_price, volume),
    )
    return True


def run_once(scylla_session, pg_conn) -> dict[str, int]:
    target_date = datetime.now(UTC).date()
    totals = {"intraday_rows": 0, "daily_rows": 0, "symbols": 0}

    with pg_conn.cursor() as cur:
        ensure_indexes(cur)
        current_date_id = ensure_date(cur, target_date)

        for symbol in settings.symbols:
            stock_id = get_stock_id(cur, symbol)
            if stock_id is None:
                logger.info("Skipping stock ETL for unknown symbol=%s", symbol)
                continue

            bars = load_intraday_bars(scylla_session, symbol, target_date)
            if not bars:
                logger.info("No intraday bars found for symbol=%s date=%s", symbol, target_date)
                continue

            totals["symbols"] += 1
            totals["intraday_rows"] += upsert_intraday(cur, stock_id, bars)
            if upsert_daily(cur, stock_id, current_date_id, bars):
                totals["daily_rows"] += 1

        pg_conn.commit()

    logger.info(
        "Loaded stock warehouse facts symbols=%s intraday_rows=%s daily_rows=%s",
        totals["symbols"],
        totals["intraday_rows"],
        totals["daily_rows"],
    )
    return totals


def main() -> None:
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    scylla_cluster, scylla_session = wait_for_scylla()
    pg_conn = wait_for_postgres()
    logger.info("Starting stock price ETL interval=%ss", settings.stock_etl_interval_seconds)
    if settings.stock_etl_start_delay_seconds > 0:
        logger.info("Waiting %ss before first stock ETL run", settings.stock_etl_start_delay_seconds)
        time.sleep(settings.stock_etl_start_delay_seconds)

    try:
        while running:
            run_once(scylla_session, pg_conn)
            sleep_until = time.monotonic() + settings.stock_etl_interval_seconds
            while running and time.monotonic() < sleep_until:
                time.sleep(1)
    finally:
        logger.info("Stopping stock price ETL")
        pg_conn.close()
        scylla_cluster.shutdown()


if __name__ == "__main__":
    main()
