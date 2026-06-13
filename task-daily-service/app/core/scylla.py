import logging
import time

from cassandra.cluster import Cluster, Session
from cassandra.policies import DCAwareRoundRobinPolicy

from app.core.config import settings

logger = logging.getLogger(__name__)


def create_cluster() -> Cluster:
    return Cluster(
        settings.scylla_contact_points,
        connect_timeout=5,
        protocol_version=4,
        load_balancing_policy=DCAwareRoundRobinPolicy(local_dc=settings.scylla_local_dc),
    )


def wait_for_scylla(timeout_seconds: int = 120) -> tuple[Cluster, Session]:
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None

    while time.monotonic() < deadline:
        cluster = create_cluster()
        try:
            session = cluster.connect(settings.scylla_keyspace)
            session.execute("SELECT now() FROM system.local")
            logger.info("ScyllaDB is ready at %s", settings.scylla_contact_points)
            return cluster, session
        except Exception as exc:
            last_error = exc
            cluster.shutdown()
            logger.info("Waiting for ScyllaDB: %s", exc)
            time.sleep(3)

    raise RuntimeError("ScyllaDB did not become ready") from last_error
