import time
from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg import Connection

from app.config import settings


def wait_for_postgres(timeout_seconds: int = 120) -> Connection:
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None

    while time.monotonic() < deadline:
        try:
            conn = psycopg.connect(settings.postgres_dsn, autocommit=False)
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            return conn
        except Exception as exc:
            last_error = exc
            time.sleep(3)

    raise RuntimeError("PostgreSQL did not become ready") from last_error


@contextmanager
def postgres_connection() -> Iterator[Connection]:
    conn = wait_for_postgres()
    try:
        yield conn
    finally:
        conn.close()
