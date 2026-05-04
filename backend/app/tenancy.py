"""Tenant-Auflösung und Schema-Initialisierung."""
import os
import secrets
from typing import Optional

from psycopg2 import sql

from app.context import TenantContext
from app.db import get_db

DEFAULT_REALM = os.getenv("KEYCLOAK_REALM", "golf-team-manager")
ALLOW_TEAM_ID_FALLBACK = os.getenv("ALLOW_TEAM_ID_FALLBACK", "true").lower() in {"1", "true", "yes"}


def tenant_schema_name(team_id: int) -> str:
    return f"tenant_{team_id}"


def generate_tenant_slug() -> str:
    """Generate a unique, human-readable tenant slug like 'tnnt_abc123def'."""
    random_part = secrets.token_urlsafe(6)[:8].replace("-", "").replace("_", "")[:8]
    return f"tnnt_{random_part}".lower()


def normalize_host(host: Optional[str]) -> Optional[str]:
    if not host:
        return None
    value = host.split(",", 1)[0].strip().lower()
    return value.split(":", 1)[0] if value else None


def tenant_from_row(row) -> TenantContext:
    """Parse database row into TenantContext."""
    return TenantContext(
        team_id=row[0],
        schema_name=row[1],
        tenant_slug=row[2],
        realm=row[3] or DEFAULT_REALM,
        host=row[4],
    )


def _ensure_tenant_registry(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """CREATE TABLE IF NOT EXISTS public.tenants (
                   team_id         INTEGER PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
                   team_name       TEXT NOT NULL,
                   tenant_slug     TEXT UNIQUE,
                   schema_name     TEXT NOT NULL UNIQUE,
                   host            TEXT UNIQUE,
                   realm           TEXT,
                   created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
               )"""
        )
        # Migration: tenant_slug-Spalte nachrüsten falls Tabelle aus älterer Version stammt
        cur.execute(
            """ALTER TABLE public.tenants
               ADD COLUMN IF NOT EXISTS tenant_slug TEXT UNIQUE"""
        )


def resolve_tenant_by_host(host: str) -> Optional[TenantContext]:
    host = normalize_host(host)
    if not host:
        return None

    with get_db() as conn:
        _ensure_tenant_registry(conn)
        with conn.cursor() as cur:
            cur.execute(
                """SELECT team_id, schema_name, tenant_slug, realm, host
                   FROM public.tenants
                   WHERE lower(host) = %s""",
                (host,),
            )
            row = cur.fetchone()
    return tenant_from_row(row) if row else None


def resolve_tenant_by_team_id(team_id: int) -> Optional[TenantContext]:
    with get_db() as conn:
        _ensure_tenant_registry(conn)
        with conn.cursor() as cur:
            cur.execute(
                """SELECT team_id, schema_name, tenant_slug, realm, host
                   FROM public.tenants
                   WHERE team_id = %s""",
                (team_id,),
            )
            row = cur.fetchone()
    return tenant_from_row(row) if row else None


def resolve_tenant_by_slug(tenant_slug: str) -> Optional[TenantContext]:
    with get_db() as conn:
        _ensure_tenant_registry(conn)
        with conn.cursor() as cur:
            cur.execute(
                """SELECT team_id, schema_name, tenant_slug, realm, host
                   FROM public.tenants
                   WHERE tenant_slug = %s""",
                (tenant_slug,),
            )
            row = cur.fetchone()
    return tenant_from_row(row) if row else None


def ensure_tenant_schema(
    team_id: int,
    team_name: str = None,
    host: str = None,
    realm: str = None,
) -> Optional[str]:
    """Create tenant schema and update registry. Returns the generated tenant_slug."""
    schema_name = tenant_schema_name(team_id)
    team_name = (team_name or f"Tenant {team_id}").strip()
    host = normalize_host(host)
    realm = realm or DEFAULT_REALM

    with get_db() as conn:
        _ensure_tenant_registry(conn)
        with conn.cursor() as cur:
            # Bestehenden Slug beibehalten; bei NULL (ältere Zeile ohne Slug) neu generieren
            cur.execute("SELECT tenant_slug FROM public.tenants WHERE team_id = %s", (team_id,))
            existing = cur.fetchone()
            tenant_slug = (existing[0] if existing else None) or generate_tenant_slug()

            cur.execute(
                """INSERT INTO public.tenants (team_id, team_name, tenant_slug, schema_name, host, realm)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   ON CONFLICT (team_id) DO UPDATE
                   SET team_name = EXCLUDED.team_name,
                       tenant_slug = COALESCE(public.tenants.tenant_slug, EXCLUDED.tenant_slug),
                       schema_name = EXCLUDED.schema_name,
                       host = COALESCE(EXCLUDED.host, public.tenants.host),
                       realm = COALESCE(EXCLUDED.realm, public.tenants.realm)""",
                (team_id, team_name, tenant_slug, schema_name, host, realm),
            )

            cur.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(schema_name)))

            cur.execute(
                sql.SQL(
                    """
                    CREATE TABLE IF NOT EXISTS {}.players (
                        id                SERIAL PRIMARY KEY,
                        team_id           INTEGER NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
                        keycloak_user_id  UUID UNIQUE,
                        name              TEXT NOT NULL,
                        email             TEXT,
                        current_rating    NUMERIC(4, 1),
                        current_whs_index NUMERIC(4, 1),
                        weighted_rating   NUMERIC(6, 2),
                        momentum_score    NUMERIC(6, 2),
                        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                        UNIQUE (team_id, name)
                    )
                    """
                ).format(sql.Identifier(schema_name))
            )
            cur.execute(
                sql.SQL("CREATE INDEX IF NOT EXISTS {} ON {}.players (team_id)").format(
                    sql.Identifier(f"idx_{schema_name}_players_team"), sql.Identifier(schema_name)
                )
            )
            cur.execute(
                sql.SQL("CREATE INDEX IF NOT EXISTS {} ON {}.players (keycloak_user_id)").format(
                    sql.Identifier(f"idx_{schema_name}_players_keycloak"), sql.Identifier(schema_name)
                )
            )

            cur.execute(
                sql.SQL(
                    """
                    CREATE TABLE IF NOT EXISTS {}.rounds (
                        id              SERIAL PRIMARY KEY,
                        player_id       INTEGER NOT NULL REFERENCES {}.players(id) ON DELETE CASCADE,
                        course_id       INTEGER REFERENCES public.courses(id) ON DELETE SET NULL,
                        played_on       DATE NOT NULL,
                        course_rating   NUMERIC(4, 1) NOT NULL,
                        slope_rating    INTEGER NOT NULL CHECK (slope_rating BETWEEN 55 AND 155),
                        hole_scores     INTEGER[] NOT NULL CHECK (array_length(hole_scores, 1) = 18),
                        differential    NUMERIC(6, 1),
                        is_hcp_relevant BOOLEAN NOT NULL DEFAULT true,
                        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                    """
                ).format(sql.Identifier(schema_name), sql.Identifier(schema_name))
            )
            # Migration: is_hcp_relevant nachrüsten falls Tabelle aus älterer Version stammt
            cur.execute(
                sql.SQL(
                    "ALTER TABLE {}.rounds ADD COLUMN IF NOT EXISTS is_hcp_relevant BOOLEAN NOT NULL DEFAULT true"
                ).format(sql.Identifier(schema_name))
            )
            cur.execute(
                sql.SQL("CREATE INDEX IF NOT EXISTS {} ON {}.rounds (player_id, played_on DESC)").format(
                    sql.Identifier(f"idx_{schema_name}_rounds_player_played"), sql.Identifier(schema_name)
                )
            )
            cur.execute(
                sql.SQL("CREATE INDEX IF NOT EXISTS {} ON {}.rounds (course_id)").format(
                    sql.Identifier(f"idx_{schema_name}_rounds_course"), sql.Identifier(schema_name)
                )
            )

            cur.execute(
                sql.SQL(
                    """
                    CREATE TABLE IF NOT EXISTS {}.matchdays (
                        id          SERIAL PRIMARY KEY,
                        label       TEXT NOT NULL,
                        match_date  DATE,
                        starters    INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
                        reserves    INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
                        published   BOOLEAN NOT NULL DEFAULT false,
                        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                    """
                ).format(sql.Identifier(schema_name))
            )
            cur.execute(
                sql.SQL("CREATE INDEX IF NOT EXISTS {} ON {}.matchdays (match_date DESC)").format(
                    sql.Identifier(f"idx_{schema_name}_matchdays_date"), sql.Identifier(schema_name)
                )
            )

            # Session-Config setzen, damit RLS-Policies bei Folgeaufrufen nicht blockieren
            cur.execute("SELECT set_config('app.tenant_id', %s, true)", (str(team_id),))
            cur.execute("SELECT set_config('app.user_role', %s, true)", ("captain",))

            cur.execute(
                sql.SQL("SELECT setval(pg_get_serial_sequence(%s, 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM {}.players), 1), true)").format(
                    sql.Identifier(schema_name)
                ),
                (f"{schema_name}.players",),
            )
            cur.execute(
                sql.SQL("SELECT setval(pg_get_serial_sequence(%s, 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM {}.rounds), 1), true)").format(
                    sql.Identifier(schema_name)
                ),
                (f"{schema_name}.rounds",),
            )

            cur.execute(sql.SQL("ALTER TABLE {}.players ENABLE ROW LEVEL SECURITY").format(sql.Identifier(schema_name)))
            cur.execute(sql.SQL("ALTER TABLE {}.players FORCE ROW LEVEL SECURITY").format(sql.Identifier(schema_name)))
            cur.execute(sql.SQL("ALTER TABLE {}.rounds ENABLE ROW LEVEL SECURITY").format(sql.Identifier(schema_name)))
            cur.execute(sql.SQL("ALTER TABLE {}.rounds FORCE ROW LEVEL SECURITY").format(sql.Identifier(schema_name)))

            cur.execute(sql.SQL("DROP POLICY IF EXISTS tenant_players_select ON {}.players").format(sql.Identifier(schema_name)))
            cur.execute(sql.SQL("DROP POLICY IF EXISTS tenant_players_write ON {}.players").format(sql.Identifier(schema_name)))
            cur.execute(sql.SQL("DROP POLICY IF EXISTS tenant_rounds_select ON {}.rounds").format(sql.Identifier(schema_name)))
            cur.execute(sql.SQL("DROP POLICY IF EXISTS tenant_rounds_insert ON {}.rounds").format(sql.Identifier(schema_name)))
            cur.execute(sql.SQL("DROP POLICY IF EXISTS tenant_rounds_write ON {}.rounds").format(sql.Identifier(schema_name)))

            cur.execute(
                sql.SQL(
                    """
                    CREATE POLICY tenant_players_select ON {}.players
                    FOR SELECT
                    USING (team_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
                    """
                ).format(sql.Identifier(schema_name))
            )
            cur.execute(
                sql.SQL(
                    """
                    CREATE POLICY tenant_players_write ON {}.players
                    FOR ALL
                    USING (
                        team_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
                        AND current_setting('app.user_role', true) = 'captain'
                    )
                    WITH CHECK (
                        team_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
                        AND current_setting('app.user_role', true) = 'captain'
                    )
                    """
                ).format(sql.Identifier(schema_name))
            )
            cur.execute(
                sql.SQL(
                    """
                    CREATE POLICY tenant_rounds_select ON {}.rounds
                    FOR SELECT
                    USING (
                        EXISTS (
                            SELECT 1
                            FROM {}.players p
                            WHERE p.id = rounds.player_id
                              AND p.team_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
                        )
                    )
                    """
                ).format(sql.Identifier(schema_name), sql.Identifier(schema_name))
            )
            cur.execute(
                sql.SQL(
                    """
                    CREATE POLICY tenant_rounds_insert ON {}.rounds
                    FOR INSERT
                    WITH CHECK (
                        EXISTS (
                            SELECT 1
                            FROM {}.players p
                            WHERE p.id = rounds.player_id
                              AND p.team_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
                              AND (
                                  current_setting('app.user_role', true) = 'captain'
                                  OR p.keycloak_user_id::text = current_setting('app.current_user_id', true)
                              )
                        )
                    )
                    """
                ).format(sql.Identifier(schema_name), sql.Identifier(schema_name))
            )
            cur.execute(
                sql.SQL(
                    """
                    CREATE POLICY tenant_rounds_write ON {}.rounds
                    FOR ALL
                    USING (
                        current_setting('app.user_role', true) = 'captain'
                        AND EXISTS (
                            SELECT 1
                            FROM {}.players p
                            WHERE p.id = rounds.player_id
                              AND p.team_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
                        )
                    )
                    WITH CHECK (
                        current_setting('app.user_role', true) = 'captain'
                        AND EXISTS (
                            SELECT 1
                            FROM {}.players p
                            WHERE p.id = rounds.player_id
                              AND p.team_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
                        )
                    )
                    """
                ).format(sql.Identifier(schema_name), sql.Identifier(schema_name), sql.Identifier(schema_name))
            )

    return tenant_slug


def drop_tenant_schema(team_id: int) -> None:
    """Löscht das komplette Tenant-Schema inkl. aller Tabellen (CASCADE)."""
    schema_name = tenant_schema_name(team_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(sql.Identifier(schema_name))
            )


def get_team_membership(keycloak_user_id: str, team_id: int):
    """Liest Mitgliedschaft eines Users in einem Team. Gibt {'role': ...} oder None zurück."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT role FROM public.team_memberships WHERE keycloak_user_id = %s AND team_id = %s",
                (keycloak_user_id, team_id),
            )
            row = cur.fetchone()
    return {"role": row[0]} if row else None


def bootstrap_tenant_schemas() -> None:
    """Initialize schemas for all existing teams on startup."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name FROM public.teams ORDER BY id")
            teams = cur.fetchall()
    for team_id, team_name in teams:
        ensure_tenant_schema(team_id, team_name=team_name)
        # Bestehende Spieler in team_memberships migrieren falls noch nicht vorhanden
        schema_name = f"tenant_{team_id}"
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    sql.SQL(
                        """INSERT INTO public.team_memberships (keycloak_user_id, team_id, role)
                           SELECT p.keycloak_user_id, p.team_id, 'player'
                           FROM {}.players p
                           WHERE p.keycloak_user_id IS NOT NULL
                           ON CONFLICT DO NOTHING"""
                    ).format(sql.Identifier(schema_name))
                )