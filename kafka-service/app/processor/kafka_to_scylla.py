import json
import logging
import signal
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from cassandra.query import PreparedStatement
from confluent_kafka import Consumer, KafkaError, KafkaException

from app.core.config import settings
from app.core.kafka import create_consumer, ensure_topic, wait_for_kafka
from app.core.logging import configure_logging
from app.core.scylla import wait_for_scylla

configure_logging()
logger = logging.getLogger(__name__)
running = True


@dataclass
class Statements:
    insert_raw: PreparedStatement
    update_latest: PreparedStatement
    upsert_ohlcv_1m: PreparedStatement


@dataclass
class OhlcvWindow:
    symbol: str
    event_date: object
    window_start: datetime
    window_end: datetime
    open_price: float
    high_price: float
    low_price: float
    close_price: float
    volume: int


windows: dict[tuple[str, datetime], OhlcvWindow] = {}


def stop(_signum, _frame) -> None:
    global running
    running = False


def parse_event(payload: bytes) -> dict[str, object]:
    event = json.loads(payload.decode("utf-8"))
    symbol = str(event["symbol"]).upper()
    event_time = datetime.fromisoformat(str(event["event_time"]).replace("Z", "+00:00"))
    if event_time.tzinfo is None:
        event_time = event_time.replace(tzinfo=UTC)
    return {
        "symbol": symbol,
        "event_time": event_time,
        "event_date": event_time.date(),
        "price": float(event["price"]),
        "volume": int(event.get("volume", 0)),
        "source": str(event.get("source", "unknown")),
    }


def floor_to_minute(value: datetime) -> datetime:
    return value.replace(second=0, microsecond=0)


def update_window(event: dict[str, object]) -> OhlcvWindow:
    symbol = str(event["symbol"])
    event_time = event["event_time"]
    assert isinstance(event_time, datetime)
    window_start = floor_to_minute(event_time)
    key = (symbol, window_start)
    price = float(event["price"])
    volume = int(event["volume"])

    if key not in windows:
        windows[key] = OhlcvWindow(
            symbol=symbol,
            event_date=event_time.date(),
            window_start=window_start,
            window_end=window_start + timedelta(minutes=1),
            open_price=price,
            high_price=price,
            low_price=price,
            close_price=price,
            volume=volume,
        )
        return windows[key]

    window = windows[key]
    window.high_price = max(window.high_price, price)
    window.low_price = min(window.low_price, price)
    window.close_price = price
    window.volume += volume
    return window


def prepare_statements(session) -> Statements:
    return Statements(
        insert_raw=session.prepare(
            """
            INSERT INTO stock_prices_raw
            (symbol, event_date, event_time, price, volume, source)
            VALUES (?, ?, ?, ?, ?, ?)
            """
        ),
        update_latest=session.prepare(
            """
            INSERT INTO stock_latest_prices
            (symbol, price, volume, event_time, source)
            VALUES (?, ?, ?, ?, ?)
            """
        ),
        upsert_ohlcv_1m=session.prepare(
            """
            INSERT INTO stock_ohlcv_1m
            (symbol, event_date, window_start, window_end, open_price, high_price, low_price, close_price, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
        ),
    )


def persist_event(session, statements: Statements, event: dict[str, object]) -> None:
    window = update_window(event)
    session.execute(
        statements.insert_raw,
        (
            event["symbol"],
            event["event_date"],
            event["event_time"],
            event["price"],
            event["volume"],
            event["source"],
        ),
    )
    session.execute(
        statements.update_latest,
        (
            event["symbol"],
            event["price"],
            event["volume"],
            event["event_time"],
            event["source"],
        ),
    )
    session.execute(
        statements.upsert_ohlcv_1m,
        (
            window.symbol,
            window.event_date,
            window.window_start,
            window.window_end,
            window.open_price,
            window.high_price,
            window.low_price,
            window.close_price,
            window.volume,
        ),
    )


def main() -> None:
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    consumer: Consumer = wait_for_kafka(create_consumer)
    ensure_topic(settings.kafka_raw_stock_topic)
    cluster, session = wait_for_scylla()
    statements = prepare_statements(session)
    consumer.subscribe([settings.kafka_raw_stock_topic])

    logger.info(
        "Starting stream processor topic=%s group=%s",
        settings.kafka_raw_stock_topic,
        settings.kafka_consumer_group,
    )

    try:
        while running:
            message = consumer.poll(1.0)
            if message is None:
                continue
            if message.error():
                if message.error().code() in {
                    KafkaError.UNKNOWN_TOPIC_OR_PART,
                    KafkaError._PARTITION_EOF,
                }:
                    logger.info("Kafka topic/partition not ready yet: %s", message.error())
                    continue
                raise KafkaException(message.error())

            event = parse_event(message.value())
            persist_event(session, statements, event)
            consumer.commit(message=message, asynchronous=False)
            logger.info(
                "Processed stock event symbol=%s price=%s event_time=%s",
                event["symbol"],
                event["price"],
                event["event_time"],
            )
    finally:
        logger.info("Stopping stream processor")
        consumer.close()
        cluster.shutdown()


if __name__ == "__main__":
    main()
