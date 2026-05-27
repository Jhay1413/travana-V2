# Multi-Role Per User — Implementation Plan

> Lets a single user hold multiple `orgRole`s in the same organization (e.g. `org_admin` **and** `agent`). Permissions and nav are the **union** of all roles. The role model on the backend keeps backward compatibility so existing `req.orgRole === 'x'` checks keep working unchanged.

---

## 1. Current state (relevant facts only)

This codebase has **two distinct role columns** that serve different purposes:

- **`user.role`** (text) — **platform-level role.** The only meaningful value is `platform_admin` (or whatever default like `"Agent"` from signup for non-platform-admins). This column is *not* the source of truth for org roles. It is read by `requirePlatformAdmin` middleware and by the legacy frontend permissions matrix only as a fallback.
- **`user.orgRole`** (varchar) — **per-org role.** Values like `"org_admin"`, `"agent"`, `"branch_manager"`, `"homeworker"`, `"referral_agent"`. The frontend's [useRole()](../client/src/hooks/use-role.ts) hook prefers this column and falls back to `user.role` only when `orgRole` is missing.
- **`branch_members.orgRole`** (varchar) — role within a branch the user belongs to. `orgBranchScope` reads from `branch_members` first, falling back to `user.orgRole`.

Other relevant facts:

- The frontend permissions matrix at [client/src/lib/permissions.ts:35-37](../client/src/lib/permissions.ts#L35-L37) already gives `Admin` (= org_admin) **full `"admin"` access to clients/quotes/bookings/enquiries**. They can already sell at the permission layer; the gap is purely UX.
- Selling-related tables (`transaction`, `quote`, `booking`, `enquiry`) already have **nullable `branch_id`** ([shared/schema.ts:572](../shared/schema.ts#L572) etc.) — schema doesn't constrain admin-created deals.
- The selling pages are simply not in `ORG_ADMIN_NAV` ([client/src/config/nav.ts:79](../client/src/config/nav.ts#L79)) — the only gap is UX.

**So the actual feature is: let a user opt into additional org-level roles, and surface the corresponding UI.**

---

## 2. Recommended model

**Junction table + additive permissions.** A user has a *set* of org roles. Effective permissions = union of all roles. UI nav = merged config of all roles.

- New table `user_org_roles(user_id, org_id, role)` — one row per (user, role).
- `user.orgRole` becomes a **derived "primary role"** = the highest-power role in the set. Recomputed whenever the role set changes. Used by legacy code paths that still read a single role string and as the default landing experience.
- **`user.role` is NOT touched.** It continues to carry only the platform-level role (`platform_admin` or non-platform-admin). It is *not* a source of truth for the org role and the multi-role feature never writes to it.
- `branch_members` stays as-is. It governs *which branch* a user operates in when a branch context is needed. Its `orgRole` column continues to act as the user's role *within that branch* and joins the union.
- Effective roles for a request = `user_org_roles.role[]` ∪ (`branch_members.org_role` of the active membership, if any).
- **platform_admin is NOT migrated.** It lives on `user.role`, not in this table, because it's cross-tenant.
- **referral_agent is mutually exclusive** with all internal roles. Validation enforces "you cannot have `referral_agent` AND any of {`org_admin`, `branch_manager`, `agent`, `homeworker`}".

### Why this shape

- New code reads `req.orgRoles: string[]` (the union). Existing code reads `req.orgRole: string` (the primary) and **doesn't need to change yet**. We migrate call sites opportunistically.
- The frontend's existing `useRole()` continues to work on `orgRole` (primary). New `useRoles()` exposes the set. Pages that want union-aware behavior opt in.
- Reports keyed on `branch_members.user_id` (agent leaderboards, agent targets) are unaffected — an org_admin who picks up an agent role doesn't have to become a branch member.
- `user.role` keeps its single, clear purpose: platform-level role only. No dual-write footgun.

---

## 3. Schema

### Migration `0022_user_org_roles.sql`

```sql
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

-- Backfill from existing user.orgRole. Skips users with no org and the
-- platform_admin role (which lives on user.role, not in this table).
-- Idempotent on re-run via ON CONFLICT.
INSERT INTO "user_org_roles" (user_id, org_id, role, granted_at, granted_by)
SELECT id, org_id, org_role, "createdAt", NULL
  FROM "user"
 WHERE org_id   IS NOT NULL
   AND org_role IS NOT NULL
ON CONFLICT (user_id, org_id, role) DO NOTHING;
```

### `shared/schema.ts` addition

```ts
export const userOrgRoles = pgTable("user_org_roles", {
  id:        uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  userId:    text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  orgId:     uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  role:      varchar("role", { length: 32 }).notNull(),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
  grantedBy: text("granted_by").references(() => user.id, { onDelete: "set null" }),
}, (table) => ({
  unique_user_org_role: unique("user_org_roles_user_org_role_unique").on(table.userId, table.orgId, table.role),
  idx_user:             index("idx_user_org_roles_user").on(table.userId, table.orgId),
  idx_org:              index("idx_user_org_roles_org").on(table.orgId),
}));
```

---

## 4. Role ranking (for "primary" derivation)

```ts
const ROLE_RANK: Record<string, number> = {
  org_admin:      100,
  branch_manager:  80,
  agent:           60,
  homeworker:      40,
  referral_agent:  20,
};

function primaryRole(roles: string[]): string | null {
  return roles.slice().sort((a, b) => (ROLE_RANK[b] ?? 0) - (ROLE_RANK[a] ?? 0))[0] ?? null;
}
```

**On every role-set change, write the new primary to `user.orgRole`.** Do NOT touch `user.role` — that stays as the platform-level role carrier (only meaningful when set to `platform_admin`).

The frontend's `useRole()` hook already prefers `user.orgRole` and maps it to the legacy `Role` enum via `roleFromOrgRole()`, so the existing permissions matrix in [client/src/lib/permissions.ts](../client/src/lib/permissions.ts) keeps working unchanged after we recompute the primary.

---

## 5. Backend changes

### Express request augmentation

```ts
// server/v2/types/express.d.ts
interface Request {
  orgId:    string;
  branchId: string | null;
  orgRole:  string;           // primary role — UNCHANGED, callers keep working
  orgRoles: string[];         // NEW — full union
}
```

### `orgBranchScope` (rewrite)

```ts
const userRoles  = await userOrgRolesRepository.findByUserAndOrg(userId, orgId);
const membership = await branchMemberRepository.findActiveByUserId(userId);

const roles = new Set<string>(userRoles.map(r => r.role));
if (membership?.orgRole) roles.add(membership.orgRole);

req.orgId    = orgId;
req.branchId = membership?.branchId ?? null;
req.orgRoles = Array.from(roles);
req.orgRole  = primaryRole(req.orgRoles) ?? '';
```

### `requireOrgRole` (rewrite — backward-compatible)

```ts
export function requireOrgRole(allowed: OrgRole[]) {
  return (req, res, next) => {
    const has = req.orgRoles?.some(r => allowed.includes(r as OrgRole))
             || allowed.includes(req.orgRole as OrgRole);  // fallback for any path that bypasses orgBranchScope
    if (!has) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}
```

### `/api/auth/user` payload

Add `orgRoles: string[]` next to the existing `orgRole`. `resolveOrgAndBranchForUser` reads the junction table for the user and builds the union. `user.role` is returned unchanged (still carries `platform_admin` when applicable).

### New module `user-org-roles/`

Standard layered structure (routes/controller/service/repository) with admin-only mutations:

- `GET    /api/v2/users/:userId/roles`             — list a user's roles in their org
- `POST   /api/v2/users/:userId/roles`             — add a role  (admin/manager)
- `DELETE /api/v2/users/:userId/roles/:role`       — remove a role
- `POST   /api/v2/auth/self/roles/sell`            — self-service: any org_admin can grant themselves the `agent` role
- `DELETE /api/v2/auth/self/roles/agent`           — self-service: any org_admin can remove `agent` from themselves

Every mutation:
1. Validates role compatibility (referral_agent exclusion, no removing the last role).
2. Writes `user.role.add` / `user.role.remove` audit rows via the existing `admin_audit_log`.
3. Recomputes `user.orgRole` to the new primary (NOT `user.role`).

---

## 6. Frontend changes

### Hook layer

```ts
// client/src/hooks/use-role.ts
export function useRole() {
  // existing: returns primary role + can(), canAccess()  — UNCHANGED
}

export function useRoles() {
  // NEW: returns { roles: OrgRole[], hasRole(r), hasAnyRole(rs), primary }
}
```

Pages that need union-aware behavior import `useRoles`. Existing pages keep using `useRole` — nothing breaks.

### Permissions matrix

Two-line helper at the bottom of [client/src/lib/permissions.ts](../client/src/lib/permissions.ts):

```ts
export function canAny(roles: Role[], action: Action, mod: Module, scope: 'own' | 'any' = 'any'): boolean {
  return roles.some(r => can(r, action, mod, scope));
}
```

### Nav merging

New helper `getNavForRoles(roles: OrgRole[])` in [client/src/config/nav.ts](../client/src/config/nav.ts) returns a *deduplicated, section-merged* nav. Sections from each role's config are appended in role-priority order (admin sections first, then sales sections, etc.). Identical paths dedupe.

`AppSidenav` switches from `getNavForRole(orgRole)` to `getNavForRoles(orgRoles)`. That's a one-line swap.

### Personal overview for opted-in org admins

When an org_admin holds the `agent` role too, the merged nav includes `/agent-overview` automatically (already permitted via `STAFF_ROLES` in [App.tsx:64](../client/src/App.tsx#L64), already queries by `current_user.id` so it scopes correctly). Default landing on login stays `/agency/overview` because primary role is still `org_admin`. Personal "My Sales" overview becomes a nav link they can pop over to.

### Self-service toggle (org_admin)

On `/agency/profile`, an org_admin sees a toggle:

```
[✓] Also work as a sales agent
    Adds Pipeline, Enquiries, Quotes, Bookings, Clients, and My Sales overview to your menu.
```

Toggling calls `POST /api/v2/auth/self/roles/sell` (add `agent`) or `DELETE /api/v2/auth/self/roles/agent` (remove `agent`). Re-fetches `/api/auth/user` so the nav rebuilds.

### Platform admin → org user role editor

[client/src/pages/platform-admin-org.tsx](../client/src/pages/platform-admin-org.tsx) Users tab — replace the single-role `Select` with a multi-select chip group bound to the new endpoints.

---

## 7. Rollout (4 small PRs)

### PR A — Backend foundations (DB change, no behavior change)
- Migration `0022_user_org_roles.sql` (+ backfill).
- Drizzle `userOrgRoles` table.
- New `user-org-roles` repository + service.
- Update `orgBranchScope` to populate **both** `req.orgRoles` (new) and `req.orgRole` (primary, backward-compat).
- Update `/api/auth/user` to include `orgRoles[]`.
- Update invite acceptance and onboarding flow to also `INSERT` into `user_org_roles` when they currently set `user.orgRole`.

**Outcome:** zero behavior change. Existing call sites keep working. New union field is available.

### PR B — Frontend foundations
- `useRoles()` hook.
- `canAny()` helper.
- `getNavForRoles()` nav merging.
- `AppSidenav` switches to `getNavForRoles`.

**Outcome:** still zero behavior change — every user still has exactly one role (from backfill), so the union has one element.

### PR C — Platform-admin role editor + self-service toggle
- Multi-select chip editor on org detail Users tab.
- Self-service "Also work as sales agent" toggle on /agency/profile.
- Audit log entries: `user.role.add`, `user.role.remove`.
- Tests: add a role → verify nav now shows extra sections, primary role didn't change, `user.orgRole` was recalculated to highest-rank.

**Outcome:** the feature is usable. An org_admin can flip the toggle and start selling immediately.

### PR D — Migrate hot-path call sites (optional, opportunistic)
- Find every `req.orgRole === 'x'` in the server and migrate to `req.orgRoles.includes('x')` where the union meaning matters (e.g. permission checks).
- Leave behaviors that genuinely want the primary alone (e.g. "land on org_admin overview page on login").

**Outcome:** purer model. Skippable for v1.

---

## 8. Decision points for you to confirm

1. **Role ranking** — is the ordering above right? `org_admin > branch_manager > agent > homeworker > referral_agent`?
2. **Referral exclusion** — confirm `referral_agent` cannot be combined with internal roles?
3. **Self-service path** — can any org_admin grant themselves `agent`, or must the platform admin do it? (My recommendation: any org_admin can grant themselves `agent` only — not other roles.)
4. **branch_members** — when an org_admin opts into `agent`, do we **also** add them to a branch (e.g. the default branch) via `branch_members`, or do they stay branch-less? (My recommendation: stay branch-less. Their deals carry `branch_id` from a picker; they're not a branch member, so they don't pollute branch leaderboards.)
5. **Manager → sell?** — should the same self-service toggle let a `branch_manager` add `agent`? They technically already write_all in permissions, but the *targets/leaderboard* picture differs. (My recommendation: yes, same toggle, scoped to anyone with at least branch_manager rank.)

---

## 9. Risks / gotchas

1. **The booking service short-circuit** at [server/v2/modules/booking/booking.service.ts:27-31](../server/v2/modules/booking/booking.service.ts#L27-L31) reads `scope.orgRole === 'platform_admin'`. Since platform_admin is *not* in the junction table and `orgRole` keeps being populated as the primary, this still works correctly. Audit during PR A nonetheless.
2. **Impersonation** sets `orgRole = 'org_admin'` synthetically. After PR A, it should ALSO set `orgRoles = ['org_admin']` to avoid `undefined.includes(...)` errors downstream.
3. **Existing invite flow** writes a single `orgRole` to `user`. After PR A, invite acceptance also inserts into `user_org_roles`. Add a small step inside `inviteService.acceptInvite`.
4. **Onboarding** creates the agency owner with `orgRole='org_admin'`. Same — add a `user_org_roles` insert.
5. **/api/auth/user payload shape** — frontend TypeScript types need `orgRoles?: string[]` added (optional during PR A, required after PR B).
6. **branch_members union edge case** — a user who is `org_admin` (via user_org_roles) AND a `branch_manager` (via active branch_members) gets BOTH roles in the union, which is correct. But a user with no branch membership and only `agent` in user_org_roles will be `agent` org-wide — make sure the agent UI still works without `req.branchId`.
7. **Cascade deletes** — if an org is deleted, `user_org_roles ON DELETE CASCADE` cleans up. If a user is deleted, same. No orphan rows.
8. **No empty role set** — removing the last role would leave the user roleless. Service validates: removing a role is only allowed when at least one other role remains.
9. **Performance** — `findByUserAndOrg` is a single indexed lookup per request. Negligible.

---

## 10. Out of scope (explicitly)

- Multi-org membership (one user in multiple orgs). Today the model is one org per user via `user.org_id`. Multi-org is a much larger refactor.
- Per-branch role differences (e.g. agent in branch A, manager in branch B). Currently `branch_members` only allows one active membership per user. Out of scope.
- Permission scoping by role *and* branch on the same row. Not changing.
- Deprecating `user.role` as a column. Keep it; it carries the platform-level role and the frontend permissions matrix still uses it via `useRole()` normalization. A future cleanup may unify, but that's separate from this work.

---

## TL;DR

- One new table, one migration. Backward-compatible everywhere via primary-role derivation on `user.orgRole`.
- **`user.role` stays untouched** — it carries platform-level role only.
- Frontend gets a new `useRoles()` hook and a `getNavForRoles()` nav merger.
- Org_admins get a one-click toggle to also sell, which adds `agent` to their role set. Reports keyed on `branch_members` correctly exclude their deals; reports keyed on `transaction.branch_id` correctly include them.
- 4 small PRs, each independently shippable.
