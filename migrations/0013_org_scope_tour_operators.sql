-- Make tour operators org-scoped. The global catalog (org_id IS NULL) becomes
-- a platform_admin-only seed source; on org signup we copy it into the new org
-- (see onboarding.repository.ts). Org users see only their own copies — see
-- repository scope filters.
--
-- This migration backfills existing organizations: each org gets a copy of
-- every global tour_operator row. Conversation 2026-05-13.
--
-- Idempotent against re-runs: we skip orgs that already have at least one
-- copy, so partial runs can be retried without producing duplicates.

INSERT INTO tour_operator_table (name, commission_percentage, org_id)
SELECT t.name, t.commission_percentage, o.id
FROM organization o
CROSS JOIN tour_operator_table t
WHERE t.org_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tour_operator_table existing
    WHERE existing.org_id = o.id
  );
