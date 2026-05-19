-- Backfill hr_records for every existing user that doesn't already have one.
-- Going forward, hr_records is auto-created alongside the user (see
-- invite.repository.ts, onboarding.repository.ts, user.service.ts). This
-- migration closes the gap for users that were created before that wiring
-- landed.
--
-- org_id is resolved from user.org_id when set; otherwise from the user's
-- active branch_members row (taking the most-recently-joined active one if
-- a user has multiple — shouldn't happen given the unique constraint, but
-- LIMIT 1 keeps it deterministic).
--
-- Users with no org_id and no active branch membership are skipped; they
-- can't have hr_records without an owning org. They'll be picked up the
-- next time something assigns them to an org.
--
-- The status / employment_type / holidays / documents / notes columns all
-- use the schema defaults ('Active', 'Full-time', [], [], []).

INSERT INTO hr_records (org_id, user_id)
SELECT
  COALESCE(
    u.org_id,
    (
      SELECT bm.org_id
      FROM branch_members bm
      WHERE bm.user_id = u.id AND bm.is_active = true
      ORDER BY bm.joined_at DESC
      LIMIT 1
    )
  ) AS org_id,
  u.id AS user_id
FROM "user" u
WHERE NOT EXISTS (
    SELECT 1 FROM hr_records r WHERE r.user_id = u.id
  )
  AND COALESCE(
    u.org_id,
    (
      SELECT bm.org_id
      FROM branch_members bm
      WHERE bm.user_id = u.id AND bm.is_active = true
      ORDER BY bm.joined_at DESC
      LIMIT 1
    )
  ) IS NOT NULL;
