import logging
import signal
import time
from datetime import UTC, date, datetime
from decimal import Decimal

from app.core.config import settings
from app.core.logging import configure_logging
from app.core.postgres import wait_for_postgres
from app.core.scylla import wait_for_scylla

configure_logging()
logger = logging.getLogger(__name__)
running = True

POSITIVE_TERMS = {"gain", "gains", "higher", "upbeat", "strong", "resilient", "supports"}
NEGATIVE_TERMS = {"falls", "lower", "weak", "risk", "decline", "miss"}


def stop(_signum, _frame) -> None:
    global running
    running = False


def sentiment_score(title: str, content: str | None) -> Decimal:
    text = f"{title} {content or ''}".lower()
    positive = sum(1 for term in POSITIVE_TERMS if term in text)
    negative = sum(1 for term in NEGATIVE_TERMS if term in text)
    score = max(-1.0, min(1.0, (positive - negative) / 5))
    return Decimal(str(round(score, 3)))


def date_id(value: date) -> int:
    return int(value.strftime("%Y%m%d"))


def load_raw_news(session, source: str, crawl_date: date, limit: int = 500) -> list[dict[str, object]]:
    statement = session.prepare(
        """
        SELECT source, crawl_date, published_at, url, title, content, symbols
        FROM raw_news
        WHERE source = ? AND crawl_date = ?
        LIMIT ?
        """
    )
    rows = session.execute(statement, (source, crawl_date, limit))
    return [
        {
            "source": row.source,
            "crawl_date": row.crawl_date,
            "published_at": row.published_at,
            "url": row.url,
            "title": row.title,
            "content": row.content,
            "symbols": list(row.symbols or []),
        }
        for row in rows
    ]


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


def ensure_source(cur, source_name: str) -> int:
    cur.execute(
        """
        INSERT INTO dim_news_source (source_name)
        VALUES (%s)
        ON CONFLICT (source_name) DO NOTHING
        """,
        (source_name,),
    )
    cur.execute("SELECT source_id FROM dim_news_source WHERE source_name = %s", (source_name,))
    return cur.fetchone()[0]


def get_stock_id(cur, symbol: str) -> int | None:
    cur.execute("SELECT stock_id FROM dim_stock WHERE symbol = %s", (symbol.upper(),))
    row = cur.fetchone()
    return row[0] if row else None


def insert_news_fact(cur, item: dict[str, object], stock_id: int, source_id: int, full_date: date) -> bool:
    current_date_id = ensure_date(cur, full_date)
    score = sentiment_score(str(item["title"]), item.get("content"))
    cur.execute(
        """
        INSERT INTO fact_stock_news
        (stock_id, source_id, date_id, published_at, title, content, url, sentiment_score)
        SELECT %s, %s, %s, %s, %s, %s, %s, %s
        WHERE NOT EXISTS (
            SELECT 1 FROM fact_stock_news
            WHERE stock_id = %s AND url = %s
        )
        """,
        (
            stock_id,
            source_id,
            current_date_id,
            item["published_at"],
            item["title"],
            item.get("content"),
            item["url"],
            score,
            stock_id,
            item["url"],
        ),
    )
    return cur.rowcount > 0


def run_once(scylla_session, pg_conn) -> int:
    today = datetime.now(UTC).date()
    inserted = 0

    with pg_conn.cursor() as cur:
        for source in settings.sources:
            source_id = ensure_source(cur, source)
            for item in load_raw_news(scylla_session, source, today):
                published_at = item["published_at"]
                full_date = published_at.date() if isinstance(published_at, datetime) else today
                for symbol in item["symbols"]:
                    stock_id = get_stock_id(cur, symbol)
                    if stock_id is None:
                        logger.info("Skipping news for unknown symbol=%s", symbol)
                        continue
                    if insert_news_fact(cur, item, stock_id, source_id, full_date):
                        inserted += 1
        pg_conn.commit()

    logger.info("Loaded %s news facts into PostgreSQL DW", inserted)
    return inserted


def main() -> None:
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    scylla_cluster, scylla_session = wait_for_scylla()
    pg_conn = wait_for_postgres()
    logger.info("Starting news ETL interval=%ss", settings.news_etl_interval_seconds)
    if settings.news_etl_start_delay_seconds > 0:
        logger.info("Waiting %ss before first ETL run", settings.news_etl_start_delay_seconds)
        time.sleep(settings.news_etl_start_delay_seconds)

    try:
        while running:
            run_once(scylla_session, pg_conn)
            sleep_until = time.monotonic() + settings.news_etl_interval_seconds
            while running and time.monotonic() < sleep_until:
                time.sleep(1)
    finally:
        logger.info("Stopping news ETL")
        pg_conn.close()
        scylla_cluster.shutdown()


if __name__ == "__main__":
    main()
