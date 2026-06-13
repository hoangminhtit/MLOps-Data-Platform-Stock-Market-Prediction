import logging
import time
from collections.abc import Callable

from confluent_kafka import Consumer, KafkaException, Producer
from confluent_kafka.admin import AdminClient, NewTopic

from app.core.config import settings

logger = logging.getLogger(__name__)


def wait_for_kafka(factory: Callable[[], Producer | Consumer], timeout_seconds: int = 120):
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None

    while time.monotonic() < deadline:
        client = factory()
        try:
            client.list_topics(timeout=5)
            logger.info("Kafka is ready at %s", settings.kafka_bootstrap_servers)
            return client
        except KafkaException as exc:
            last_error = exc
            client.close() if hasattr(client, "close") else client.flush(1)
            logger.info("Waiting for Kafka: %s", exc)
            time.sleep(3)

    raise RuntimeError("Kafka did not become ready") from last_error


def create_producer() -> Producer:
    return Producer(
        {
            "bootstrap.servers": settings.kafka_bootstrap_servers,
            "client.id": "stock-producer",
            "acks": "all",
        }
    )


def ensure_topic(topic: str) -> None:
    admin = AdminClient({"bootstrap.servers": settings.kafka_bootstrap_servers})
    metadata = admin.list_topics(timeout=10)
    if topic in metadata.topics:
        logger.info("Kafka topic already exists: %s", topic)
        return

    futures = admin.create_topics(
        [
            NewTopic(
                topic=topic,
                num_partitions=settings.kafka_num_partitions,
                replication_factor=1,
            )
        ]
    )
    try:
        futures[topic].result(timeout=30)
        logger.info("Created Kafka topic: %s", topic)
    except Exception as exc:
        metadata = admin.list_topics(timeout=10)
        if topic in metadata.topics:
            logger.info("Kafka topic exists after create race: %s", topic)
            return
        raise RuntimeError(f"Failed to create Kafka topic {topic}") from exc


def create_consumer() -> Consumer:
    return Consumer(
        {
            "bootstrap.servers": settings.kafka_bootstrap_servers,
            "group.id": settings.kafka_consumer_group,
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,
            "client.id": "stock-stream-processor",
        }
    )
