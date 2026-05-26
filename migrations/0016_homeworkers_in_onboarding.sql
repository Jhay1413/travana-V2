-- Homeworkers support in agency onboarding.
--
-- 1. branches.branch_type marks a branch as either a physical shop ('shop')
--    or the agency's homeworker group ('homeworker'). The repository scope
--    helpers already filter "deals" by user_id when org_role = 'homeworker'
--    on the branch_members row — this column lets us identify the homeworker
--    group when assigning agents post-signup.
--
-- 2. organization.homeworker_commission stores the agency-wide default
--    commission % for homeworkers, set during onboarding. Per-user override
--    remains available via user.percentage_commission.

ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS "branch_type" varchar(16) NOT NULL DEFAULT 'shop';

ALTER TABLE "organization"
  ADD COLUMN IF NOT EXISTS "homeworker_commission" integer;
