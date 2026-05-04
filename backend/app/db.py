import os
from contextlib import contextmanager
from typing import Optional

from psycopg2 import pool as psycopg2_pool
from psycopg2 import sql
from dotenv import load_dotenv

from app.context import get_auth_context, get_tenant_context

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://golf:golf_dev_pw@localhost:5432/golf_team",
)

_pool: Optional[psycopg2_pool.ThreadedConnectionPool] = None


def _get_pool() -> psycopg2_pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = psycopg2_pool.ThreadedConnectionPool(1, 10, dsn=DATABASE_URL)
    return _pool


@contextmanager
def get_db():
    """Context manager: holt eine Connection aus dem Pool, committed oder rollbacked automatisch."""
    conn = _get_pool().getconn()
    try:
        tenant = get_tenant_context()
        if tenant is not None:
            with conn.cursor() as cur:
                cur.execute(
                    sql.SQL("SET LOCAL search_path TO {}, public").format(
                        sql.Identifier(tenant.schema_name)
                    )
                )
                cur.execute("SELECT set_config('app.tenant_id', %s, true)", (str(tenant.team_id),))
                cur.execute("SELECT set_config('app.tenant_schema', %s, true)", (tenant.schema_name,))

        auth = get_auth_context()
        if auth is not None:
            with conn.cursor() as cur:
                cur.execute("SELECT set_config('app.current_user_id', %s, true)", (str(auth.get("user_id") or ""),))
                cur.execute("SELECT set_config('app.user_role', %s, true)", (str(auth.get("primary_role") or ""),))
                cur.execute("SELECT set_config('app.user_roles', %s, true)", (",".join(auth.get("roles") or []),))

        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _get_pool().putconn(conn)
