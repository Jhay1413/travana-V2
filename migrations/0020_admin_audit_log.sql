-- Platform-admin audit log: records every cross-tenant action taken by a
-- super-admin (suspend, activate, plan change, impersonation, credit edits, ...).
-- Kept separate from the per-tenant "audit_log" table so admin/system actions
-- never muddy a tenant's own audit queries.

CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_user_id"  text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "action"         varchar(64) NOT NULL,
  "target_org_id"  uuid       REFERENCES "organization"("id") ON DELETE SET NULL,
  "target_user_id" text       REFERENCES "user"("id") ON DELETE SET NULL,
  "metadata"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "ip_address"     varchar(64),
  "user_agent"     text,
  "created_at"     timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_admin_audit_actor"      ON "admin_audit_log" ("actor_user_id");
CREATE INDEX IF NOT EXISTS "idx_admin_audit_target_org" ON "admin_audit_log" ("target_org_id");
CREATE INDEX IF NOT EXISTS "idx_admin_audit_created"    ON "admin_audit_log" ("created_at" DESC);
