import os
from contextlib import contextmanager
from typing import Optional

import psycopg2
from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://golf:golf_dev_pw@localhost:5432/golf_team",
)

_pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(1, 10, dsn=DATABASE_URL)
    return _pool


@contextmanager
def get_db():
    """Context manager: holt eine Connection aus dem Pool, committed oder rollbacked automatisch."""
    conn = _get_pool().getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _get_pool().putconn(conn)
