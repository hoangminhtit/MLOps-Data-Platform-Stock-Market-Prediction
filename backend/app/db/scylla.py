from cassandra.cluster import Cluster

from app.core.config import settings


def check_scylla() -> bool:
    cluster = None
    try:
        cluster = Cluster(settings.scylla_contact_points, connect_timeout=3)
        session = cluster.connect()
        session.execute("SELECT now() FROM system.local")
        return True
    except Exception:
        return False
    finally:
        if cluster is not None:
            cluster.shutdown()
