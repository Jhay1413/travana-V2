-- ============================================================
-- Data cleanup: stale management-role rows in user_org_roles
--
-- Bug: changing a member's role via PATCH /me/members/:userId/role
-- (orgMemberService.updateRole -> branchMemberRepository.setOrgRoleAtomic)
-- updated "user".org_role and branch_members.org_role but never removed the
-- user's OLD management role from the user_org_roles junction table (backfilled
-- by scripts/seed-user-org-roles.ts). Since effective roles are the union of
-- user_org_roles rows and branch_members.org_role (see
-- server/v2/middlewares/auth/require-auth.ts and
-- server/v2/middlewares/org-branch-scope.ts), affected users ended up holding
-- BOTH their old and new management role (e.g. branch_manager + org_admin).
--
-- This is now fixed going forward (setOrgRoleAtomic clears the stale junction
-- row in the same transaction). This migration cleans up users already left in
-- the bad state: delete any user_org_roles row whose role is a management role
-- (org_admin or branch_manager) that no longer matches the user's current,
-- synced primary role on "user".org_role. The `agent` "also sells" flag is left
-- untouched.
-- ============================================================

-- Scoped to the user's own org: user_org_roles is per-org but user.org_role is
-- a single global column, so it only describes the org the row was seeded for
-- (org_id = user.orgId — see scripts/seed-user-org-roles.ts). Without the
-- org_id match, a user with a legitimate management role in a SECOND org could
-- have that row deleted just because it doesn't match their primary org's role.
--
-- Also requires org_role IS NOT NULL: 'org_admin' IS DISTINCT FROM NULL is
-- TRUE, so without this guard, users with a NULL org_role would have every
-- management junction row deleted.
DELETE FROM user_org_roles r
USING "user" u
WHERE r.user_id = u.id
  AND r.org_id = u.org_id
  AND r.role IN ('org_admin', 'branch_manager')
  AND u.org_role IS NOT NULL
  AND r.role IS DISTINCT FROM u.org_role;