-- Make shop_target and agent_target per-branch instead of global.
--
-- shop_target: existing rows are wiped (per the design call — they were unscoped
-- and untrustworthy). New unique constraint is (branch_id, year, month).
--
-- agent_target: branch_id is backfilled from each user's active branch_members
-- row. Orphans (users with no active branch membership) are deleted. New unique
-- constraint becomes (branch_id, user_id, year, month).

-- ── shop_target_table ────────────────────────────────────────────────────
DELETE FROM shop_target_table;

ALTER TABLE shop_target_table
  DROP CONSTRAINT IF EXISTS shop_target_year_month_unique;

ALTER TABLE shop_target_table
  ADD COLUMN branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX shop_target_branch_year_month_unique
  ON shop_target_table (branch_id, year, month);

-- ── agent_target_table ───────────────────────────────────────────────────
ALTER TABLE agent_target_table
  ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE CASCADE;

UPDATE agent_target_table at
SET branch_id = (
  SELECT bm.branch_id
  FROM branch_members bm
  WHERE bm.user_id = at.user_id AND bm.is_active = true
  ORDER BY bm.joined_at DESC
  LIMIT 1
);

DELETE FROM agent_target_table WHERE branch_id IS NULL;

ALTER TABLE agent_target_table
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE agent_target_table
  DROP CONSTRAINT IF EXISTS agent_target_user_year_month_unique;

CREATE UNIQUE INDEX agent_target_branch_user_year_month_unique
  ON agent_target_table (branch_id, user_id, year, month);
