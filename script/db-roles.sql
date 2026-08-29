-- ====================================================================
-- FARMFRESHFARMER — PostgreSQL Least-Privilege Database Role Architecture
-- ====================================================================
-- Run this script as PostgreSQL superuser (postgres) on production database.
-- It splits monolithic database access into 4 distinct isolated roles.
-- ====================================================================

-- 1. Create Dedicated Application Runtime Role (CRUD only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'farmfresh_app') THEN
    CREATE ROLE farmfresh_app WITH LOGIN PASSWORD 'SET_STRONG_APP_PASSWORD_HERE';
  END IF;
END $$;

-- 2. Create Insert-Only Security Audit Writer Role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'farmfresh_audit') THEN
    CREATE ROLE farmfresh_audit WITH LOGIN PASSWORD 'SET_STRONG_AUDIT_PASSWORD_HERE';
  END IF;
END $$;

-- 3. Create Read-Only Analytics & Reporting Role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'farmfresh_ro') THEN
    CREATE ROLE farmfresh_ro WITH LOGIN PASSWORD 'SET_STRONG_READONLY_PASSWORD_HERE';
  END IF;
END $$;

-- 4. Create Migration & DDL-Only Role (Used solely during deployments)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'farmfresh_migration') THEN
    CREATE ROLE farmfresh_migration WITH LOGIN PASSWORD 'SET_STRONG_MIGRATION_PASSWORD_HERE';
  END IF;
END $$;

-- ====================================================================
-- GRANT & REVOKE PERMISSIONS
-- ====================================================================

-- Connect to production database
\c farmfreshfarmer;

-- Revoke all default public permissions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- ── Role 1: farmfresh_app (Standard Application Runtime) ────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO farmfresh_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO farmfresh_app;

-- IMMUTABLE AUDIT TABLE PROTECTION: Revoke destructive permissions from app
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE security_audit_logs FROM farmfresh_app;

-- ── Role 2: farmfresh_audit (Insert-Only Audit Writer) ──────────────
GRANT INSERT, SELECT ON TABLE security_audit_logs TO farmfresh_audit;
GRANT USAGE ON SEQUENCE security_audit_logs_id_seq TO farmfresh_audit;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE security_audit_logs FROM farmfresh_audit;

-- ── Role 3: farmfresh_ro (Read-Only Reporting & Metrics) ────────────
GRANT SELECT ON ALL TABLES IN SCHEMA public TO farmfresh_ro;

-- ── Role 4: farmfresh_migration (DDL & Schema Management) ───────────
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO farmfresh_migration;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO farmfresh_migration;
GRANT ALL PRIVILEGES ON SCHEMA public TO farmfresh_migration;

-- ====================================================================
-- VERIFICATION QUERY:
-- SELECT grantee, table_name, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_name = 'security_audit_logs';
-- ====================================================================
