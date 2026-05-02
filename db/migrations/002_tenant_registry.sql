-- Tenant registry for schema-per-tenant isolation

CREATE TABLE IF NOT EXISTS tenants (
    team_id         INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
    team_name       TEXT NOT NULL,
    schema_name     TEXT NOT NULL UNIQUE,
    host            TEXT UNIQUE,
    realm           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tenants (team_id, team_name, schema_name, host, realm)
SELECT id, name, 'tenant_' || id, NULL, NULL
FROM teams
ON CONFLICT (team_id) DO NOTHING;
