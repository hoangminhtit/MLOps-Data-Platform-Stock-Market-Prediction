import logging
import time

import psycopg
from psycopg import Connection

from app.core.config import settings

logger = logging.getLogger(__name__)


def wait_for_postgres(timeout_seconds: int = 120) -> Connection:
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None

    while time.monotonic() < deadline:
        try:
            conn = psycopg.connect(settings.postgres_dsn, autocommit=False)
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            logger.info("PostgreSQL is ready at %s:%s", settings.postgres_host, settings.postgres_port)
            return conn
        except Exception as exc:
            last_error = exc
            logger.info("Waiting for PostgreSQL: %s", exc)
            time.sleep(3)

    raise RuntimeError("PostgreSQL did not become ready") from last_error
