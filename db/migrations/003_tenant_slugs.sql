-- ============================================================
-- Migration 003: Add Tenant Slugs (Human-readable IDs)
-- Adds tenant_slug column for public tenant identification
-- ============================================================

-- Add tenant_slug column to teams table
ALTER TABLE IF EXISTS teams ADD COLUMN tenant_slug TEXT UNIQUE;

-- Add tenant_slug column to tenants table  
ALTER TABLE IF EXISTS tenants ADD COLUMN tenant_slug TEXT UNIQUE;

-- Add comment for clarity
COMMENT ON COLUMN teams.tenant_slug IS 'Human-readable tenant identifier (format: tnnt_xxxxxxxx)';
COMMENT ON COLUMN tenants.tenant_slug IS 'Human-readable tenant identifier (format: tnnt_xxxxxxxx)';
