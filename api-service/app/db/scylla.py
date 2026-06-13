from cassandra.cluster import Cluster
from cassandra.policies import DCAwareRoundRobinPolicy

from app.core.config import settings


def create_cluster() -> Cluster:
    return Cluster(
        settings.scylla_contact_points,
        connect_timeout=3,
        protocol_version=4,
        load_balancing_policy=DCAwareRoundRobinPolicy(local_dc=settings.scylla_local_dc),
    )


def execute(query: str, parameters: tuple[object, ...] | None = None):
    cluster = create_cluster()
    try:
        session = cluster.connect(settings.scylla_keyspace)
        return session.execute(query, parameters or ())
    finally:
        cluster.shutdown()


def check_scylla() -> bool:
    cluster = None
    try:
        cluster = create_cluster()
        session = cluster.connect()
        session.execute("SELECT now() FROM system.local")
        return True
    except Exception:
        return False
    finally:
        if cluster is not None:
            cluster.shutdown()
