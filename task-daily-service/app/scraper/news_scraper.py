import logging
import signal
import time
from datetime import UTC, datetime

from app.core.config import settings
from app.core.logging import configure_logging
from app.core.scylla import wait_for_scylla

configure_logging()
logger = logging.getLogger(__name__)
running = True


def stop(_signum, _frame) -> None:
    global running
    running = False


def build_mock_news(now: datetime) -> list[dict[str, object]]:
    templates = [
        ("AAPL", "Apple shares edge higher as services revenue remains resilient"),
        ("MSFT", "Microsoft cloud demand supports upbeat market outlook"),
        ("NVDA", "NVIDIA gains as chip demand stays strong across AI workloads"),
    ]
    news_items: list[dict[str, object]] = []
    for symbol, title in templates:
        slug_time = now.strftime("%Y%m%d%H%M")
        news_items.append(
            {
                "source": "mock_market_news",
                "crawl_date": now.date(),
                "published_at": now,
                "url": f"mock://market-news/{symbol.lower()}/{slug_time}",
                "title": title,
                "content": (
                    f"{symbol} market update generated for local pipeline testing. "
                    "The article is synthetic and used to validate ScyllaDB to warehouse ETL."
                ),
                "symbols": [symbol],
            }
        )
    return news_items


def write_news(session, news_items: list[dict[str, object]]) -> int:
    statement = session.prepare(
        """
        INSERT INTO raw_news
        (source, crawl_date, published_at, url, title, content, symbols)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """
    )
    for item in news_items:
        session.execute(
            statement,
            (
                item["source"],
                item["crawl_date"],
                item["published_at"],
                item["url"],
                item["title"],
                item["content"],
                item["symbols"],
            ),
        )
    return len(news_items)


def run_once(session) -> int:
    now = datetime.now(UTC).replace(second=0, microsecond=0)
    news_items = build_mock_news(now)
    written = write_news(session, news_items)
    logger.info("Wrote %s raw news items to ScyllaDB", written)
    return written


def main() -> None:
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    cluster, session = wait_for_scylla()
    logger.info("Starting news scraper interval=%ss", settings.news_scrape_interval_seconds)

    try:
        while running:
            run_once(session)
            sleep_until = time.monotonic() + settings.news_scrape_interval_seconds
            while running and time.monotonic() < sleep_until:
                time.sleep(1)
    finally:
        logger.info("Stopping news scraper")
        cluster.shutdown()


if __name__ == "__main__":
    main()
