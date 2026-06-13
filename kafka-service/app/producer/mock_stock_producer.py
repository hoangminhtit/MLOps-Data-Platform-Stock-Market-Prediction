import json
import logging
import random
import signal
import time
from datetime import UTC, datetime

from confluent_kafka import Producer

from app.core.config import settings
from app.core.kafka import create_producer, ensure_topic, wait_for_kafka
from app.core.logging import configure_logging

configure_logging()
logger = logging.getLogger(__name__)
running = True


def stop(_signum, _frame) -> None:
    global running
    running = False


def delivery_report(error, message) -> None:
    if error is not None:
        logger.error("Failed to deliver stock event: %s", error)
        return
    logger.debug(
        "Delivered stock event to %s[%s]@%s",
        message.topic(),
        message.partition(),
        message.offset(),
    )


def next_price(previous: float) -> float:
    drift = random.uniform(-0.35, 0.35)
    return round(max(previous + drift, 1), 2)


def build_event(symbol: str, price: float) -> dict[str, object]:
    return {
        "symbol": symbol,
        "event_time": datetime.now(UTC).isoformat(),
        "price": price,
        "volume": random.randint(100, 8000),
        "source": "mock-producer",
    }


def main() -> None:
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    producer: Producer = wait_for_kafka(create_producer)
    ensure_topic(settings.kafka_raw_stock_topic)
    prices = {
        "AAPL": 195.12,
        "MSFT": 421.45,
        "NVDA": 138.76,
    }
    for symbol in settings.symbols:
        prices.setdefault(symbol, round(random.uniform(80, 500), 2))

    logger.info(
        "Starting mock stock producer topic=%s symbols=%s interval=%ss",
        settings.kafka_raw_stock_topic,
        settings.symbols,
        settings.producer_interval_seconds,
    )

    while running:
        for symbol in settings.symbols:
            prices[symbol] = next_price(prices[symbol])
            event = build_event(symbol, prices[symbol])
            producer.produce(
                settings.kafka_raw_stock_topic,
                key=symbol.encode("utf-8"),
                value=json.dumps(event).encode("utf-8"),
                callback=delivery_report,
            )
        producer.poll(0)
        time.sleep(settings.producer_interval_seconds)

    logger.info("Stopping mock stock producer")
    producer.flush(10)


if __name__ == "__main__":
    main()
