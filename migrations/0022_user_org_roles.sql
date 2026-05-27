-- Multi-role per user: a single user can hold several org-level roles in the
-- same organisation (e.g. org_admin + agent). user.orgRole stays as a derived
-- "primary" for backward compatibility; this table is the source of truth.
--
-- user.role is NOT migrated here — it carries the platform-level role
-- (platform_admin) and stays untouched.

CREATE TABLE IF NOT EXISTS "user_org_roles" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    text NOT NULL REFERENCES "user"("id")         ON DELETE CASCADE,
  "org_id"     uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "role"       varchar(32) NOT NULL,
  "granted_at" timestamp NOT NULL DEFAULT NOW(),
  "granted_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  UNIQUE ("user_id", "org_id", "role")
);

CREATE INDEX IF NOT EXISTS "idx_user_org_roles_user" ON "user_org_roles" ("user_id", "org_id");
CREATE INDEX IF NOT EXISTS "idx_user_org_roles_org"  ON "user_org_roles" ("org_id");

-- Backfill from existing user.orgRole. Skips users with no org (platform admins
-- and unattached accounts). Idempotent on re-run via ON CONFLICT.
INSERT INTO "user_org_roles" (user_id, org_id, role, granted_at, granted_by)
SELECT id, org_id, org_role, "createdAt", NULL
  FROM "user"
 WHERE org_id   IS NOT NULL
   AND org_role IS NOT NULL
ON CONFLICT (user_id, org_id, role) DO NOTHING;
