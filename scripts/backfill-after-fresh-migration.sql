-- ============================================================================
-- Post-fresh-migration data backfill
-- ============================================================================
-- A fresh `drizzle-kit generate` produces SCHEMA (DDL) only. The migration
-- history that was squashed away also carried DATA backfills. This script
-- re-applies the ones that are still relevant to a populated database.
--
-- SAFE TO RUN MULTIPLE TIMES — every statement is idempotent (guarded by
-- NOT EXISTS / IS NULL / ON CONFLICT). On an empty database every statement
-- is a harmless no-op.
--
-- Run AFTER the fresh schema is in place:
--   psql "$DATABASE_URL" -f scripts/backfill-after-fresh-migration.sql
--
-- NOT INCLUDED (obsolete — they transformed structures the current schema no
-- longer has; recover from git history if you ever need them):
--   * 0001  vip_payout            -> referral_withdrawal
--   * 0005  wallet_transaction ledger backfill from legacy referral flow
--   * 0012  tour_package_commission_table -> per-operator commission
--   * 0014  point-in-time commission snapshot (166-line CTE)
--   * 0008  shop_target wipe + agent_target.branch_id backfill (destructive)
-- ============================================================================

BEGIN;

-- ── 1. Per-org tour operator copies (was migration 0013) ────────────────────
-- Each org gets its own copy of every global (org_id IS NULL) catalog row.
-- Skips orgs that already have at least one copy.
INSERT INTO tour_operator_table (name, commission_percentage, org_id)
SELECT t.name, t.commission_percentage, o.id
FROM organization o
CROSS JOIN tour_operator_table t
WHERE t.org_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tour_operator_table existing
    WHERE existing.org_id = o.id
  );

-- ── 2. hr_records for users missing one (was migration 0015) ────────────────
-- org_id from user.org_id, else the user's active branch membership.
-- Users with neither are skipped.
INSERT INTO hr_records (org_id, user_id)
SELECT
  COALESCE(
    u.org_id,
    (SELECT bm.org_id FROM branch_members bm
      WHERE bm.user_id = u.id AND bm.is_active = true
      ORDER BY bm.joined_at DESC LIMIT 1)
  ) AS org_id,
  u.id
FROM "user" u
WHERE NOT EXISTS (SELECT 1 FROM hr_records r WHERE r.user_id = u.id)
  AND COALESCE(
        u.org_id,
        (SELECT bm.org_id FROM branch_members bm
          WHERE bm.user_id = u.id AND bm.is_active = true
          ORDER BY bm.joined_at DESC LIMIT 1)
      ) IS NOT NULL;

-- ── 3. Coerce deprecated SMS auto-triggers to 'manual' (was migration 0018) ─
UPDATE sms_templates
   SET auto_trigger   = 'manual',
       trigger_weekday = NULL,
       trigger_hour    = CASE WHEN auto_trigger = 'weekly_schedule' THEN NULL ELSE trigger_hour END
 WHERE auto_trigger IN ('on_tickets_uploaded', 'weekly_schedule');

-- ── 4. Clone any global SMS templates into every org (was migration 0019) ───
-- No-op once sms_templates.org_id is NOT NULL (no global rows can exist),
-- but kept for a DB that still has legacy org_id IS NULL rows.
INSERT INTO sms_templates (
  org_id, name, category, body, auto_trigger,
  trigger_days_before, trigger_weekday, trigger_hour,
  active, created_by, created_at, updated_at
)
SELECT o.id, t.name, t.category, t.body, t.auto_trigger,
       t.trigger_days_before, t.trigger_weekday, t.trigger_hour,
       t.active, t.created_by, NOW(), NOW()
FROM sms_templates t
CROSS JOIN organization o
WHERE t.org_id IS NULL;
-- (Intentionally NOT deleting org_id IS NULL rows here; do that manually if
--  you are mid-transition. On a fresh schema there are none.)

-- ── 5. Backfill user_org_roles from user.orgRole (was migration 0022) ───────
INSERT INTO user_org_roles (user_id, org_id, role, granted_at, granted_by)
SELECT id, org_id, org_role, "createdAt", NULL
FROM "user"
WHERE org_id IS NOT NULL
  AND org_role IS NOT NULL
ON CONFLICT (user_id, org_id, role) DO NOTHING;

COMMIT;
