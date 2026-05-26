-- Scope SMS templates to organisations. Until now, sms_templates was a
-- global table — every org saw (and could edit) every other org's
-- templates. This migration:
--   1. adds org_id (nullable)
--   2. clones each existing template into every organisation
--   3. drops the original orphan rows
--   4. enforces NOT NULL + FK on org_id
--
-- Idempotent enough for re-run on a clean DB (template_id rewiring on
-- sms_messages is done by FK ON DELETE SET NULL, so historical rows
-- survive the swap).

ALTER TABLE "sms_templates"
  ADD COLUMN IF NOT EXISTS "org_id" uuid;

-- 2. Clone existing global templates into every existing org.
--    A template with org_id IS NULL is treated as a "to-clone" source.
INSERT INTO "sms_templates" (
  org_id, name, category, body, auto_trigger,
  trigger_days_before, trigger_weekday, trigger_hour,
  active, created_by, created_at, updated_at
)
SELECT
  o.id,
  t.name,
  t.category,
  t.body,
  t.auto_trigger,
  t.trigger_days_before,
  t.trigger_weekday,
  t.trigger_hour,
  t.active,
  t.created_by,
  NOW(),
  NOW()
FROM "sms_templates" t
CROSS JOIN "organization" o
WHERE t.org_id IS NULL;

-- 3. Remove the now-orphaned global rows (they've been cloned per-org).
--    sms_messages.template_id is ON DELETE SET NULL, so message history
--    survives but loses its template pointer for these legacy rows.
DELETE FROM "sms_templates" WHERE org_id IS NULL;

-- 4. Lock the column down.
ALTER TABLE "sms_templates"
  ALTER COLUMN "org_id" SET NOT NULL;

ALTER TABLE "sms_templates"
  ADD CONSTRAINT "sms_templates_org_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_sms_templates_org_id" ON "sms_templates" ("org_id");
