# Platform Admin (System Owner) — Implementation Plan

> Adds a system-owner / super-admin capability to the existing multi-tenant SaaS, in the **same backend** and **same frontend** as the tenant app. Gated by `user.role = 'platform_admin'`, served under `/api/platform-admin/*` and `/system/*` (or existing `/platform-admin/*`).

---

## 1. Current State (what already exists)

The codebase already has a partial scaffold. The plan finishes it; it does not start from scratch.

- **Role string `platform_admin`** is a first-class `OrgRole` in:
  - [server/v2/utils/scope.ts](../server/v2/utils/scope.ts)
  - [client/src/types/auth/auth.types.ts](../client/src/types/auth/auth.types.ts)
  - [client/src/lib/permissions.ts](../client/src/lib/permissions.ts)
  - [client/src/config/nav.ts](../client/src/config/nav.ts)
- **`org-branch-scope` middleware** short-circuits for `dbUser.role === 'platform_admin'` in [server/v2/middlewares/org-branch-scope.ts](../server/v2/middlewares/org-branch-scope.ts).
- **Backend module scaffold** at [server/v2/modules/platform-admin/](../server/v2/modules/platform-admin/) (stubs returning `[]`).
- **Frontend page** at [client/src/pages/platform-admin.tsx](../client/src/pages/platform-admin.tsx) (currently localStorage-backed).
- **Route mount** in [server/v2/routes/index.ts](../server/v2/routes/index.ts) at `/api/platform-admin`.

**Decision:** keep the `platform_admin` naming everywhere in code (role string, module folder, role checks). Optionally alias the **frontend URL** to `/system/*` for product clarity — that's a router-level change only.

---

## 2. Architecture Overview

Follows the strict layered flow from [CLAUDE.md](../CLAUDE.md):

```
HTTP Request
  → Route          (platform-admin.routes.ts)
  → Middleware     (isAuthenticated → requirePlatformAdmin → zod validator)
  → Controller     (platform-admin.controller.ts)
  → Service        (platform-admin.service.ts)
  → Repository     (platform-admin.repository.ts / platform-admin-audit.repository.ts)
  → Database       (Drizzle ORM)
  → Response
```

**Key principles:**

1. **No new role column.** `user.role = 'platform_admin'` is the single source of truth.
2. **Defense in depth.** `requirePlatformAdmin` is applied at the **router level** AND **per-route** so it's grep-able.
3. **Cross-tenant queries are lexically isolated.** All `*AcrossOrgs` methods live inside the platform-admin module. Never add optional `orgId` to existing tenant-scoped repository methods.
4. **Every mutation writes an audit row** in `admin_audit_log`.
5. **Impersonation is a session shadow flag,** honored by `orgBranchScope` — never fake the user identity.

---

## 3. Folder Structure

### Backend

```
server/
└── v2/
    ├── middlewares/
    │   └── auth/
    │       ├── index.ts                          (export requirePlatformAdmin)
    │       ├── require-auth.ts                   (existing)
    │       ├── require-org-role.ts               (existing)
    │       └── require-platform-admin.ts         (NEW)
    │
    ├── modules/
    │   └── platform-admin/
    │       ├── platform-admin.routes.ts          (wire guard + validators + handlers)
    │       ├── platform-admin.controller.ts      (HTTP translation only)
    │       ├── platform-admin.service.ts         (orgs / users / impersonation logic)
    │       ├── platform-admin.repository.ts      (cross-tenant queries: *AcrossOrgs)
    │       ├── platform-admin-audit.repository.ts (NEW — admin_audit_log CRUD)
    │       ├── platform-admin-credits.service.ts (NEW — SMS credit limits + overage)
    │       ├── platform-admin-credits.repository.ts (NEW — credit limit + usage + charges)
    │       ├── platform-admin.validator.ts       (NEW — zod schemas)
    │       └── platform-admin.types.ts           (DTOs: OrgSummary, CreditSummary, AdminAuditEntry, etc.)
    │
    └── routes/
        └── index.ts                              (mount: app.use('/api/platform-admin', router))

migrations/
├── 0020_admin_audit_log.sql                      (NEW)
└── 0021_sms_credits.sql                          (NEW — credit limit, usage, charges)

scripts/
└── promote-platform-admin.ts                     (NEW — CLI to seed first super-admin)

shared/
└── schema.ts                                     (add adminAuditLog table + types)
```

### Frontend

```
client/
└── src/
    ├── api/
    │   └── endpoints/
    │       └── platform-admin.api.ts             (NEW — calls /api/platform-admin/*)
    │
    ├── hooks/
    │   ├── queries/
    │   │   ├── index.ts                          (re-export)
    │   │   └── use-platform-admin-queries.ts     (NEW — useAdminOrgs, useAdminOrg, useAdminUsers, useAdminAuditLog)
    │   └── mutations/
    │       ├── index.ts                          (re-export)
    │       └── use-platform-admin-mutations.ts   (NEW — useSuspendOrg, useActivateOrg, useChangeOrgPlan, useImpersonateOrg, useStopImpersonating)
    │
    ├── components/
    │   └── platform-admin/
    │       ├── org-table.tsx                     (NEW — reusable table cell formatters, status badges)
    │       ├── org-plan-picker.tsx               (NEW — plan + seat limit form)
    │       ├── suspend-org-dialog.tsx            (NEW — reason input + confirm)
    │       ├── impersonation-banner.tsx          (NEW — persistent banner in AppHeader when impersonating)
    │       ├── credit-summary-card.tsx           (NEW — limit / used / remaining / overage)
    │       ├── credit-limit-form.tsx             (NEW — edit monthly_sms_credit_limit + price_per_overage)
    │       ├── credit-topup-dialog.tsx           (NEW — grant N free credits this period)
    │       ├── credit-usage-chart.tsx            (NEW — per-month bar chart)
    │       └── audit-log-table.tsx               (NEW — filterable list)
    │
    ├── pages/
    │   └── system/                               (NEW — or keep /platform-admin)
    │       ├── system-home.tsx                   (redirect to /system/organizations)
    │       ├── system-orgs.tsx                   (PR 1 — list all orgs)
    │       ├── system-org-detail.tsx             (PR 2/3 — drill-down + suspend/activate/plan)
    │       ├── system-org-credits.tsx            (PR 4 — credit limit, usage history, top-ups, charges)
    │       ├── system-org-users.tsx              (PR 3 — users inside one org, role/seat edits)
    │       ├── system-org-branches.tsx           (PR 3 — branches inside one org)
    │       ├── system-users.tsx                  (PR 3 — flat user list across orgs)
    │       └── system-audit-log.tsx              (PR 2 — admin actions log)
    │
    ├── config/
    │   └── nav.ts                                (update PLATFORM_ADMIN_NAV)
    │
    └── App.tsx                                   (add <RoleRoute path="/system/..." allow={["platform_admin"]} />)
```

### Naming Conventions (per project rules)

| Layer       | Suffix              | Example                              |
|-------------|---------------------|--------------------------------------|
| Routes      | `*.routes.ts`       | `platform-admin.routes.ts`           |
| Controllers | `*.controller.ts`   | `platform-admin.controller.ts`       |
| Services    | `*.service.ts`      | `platform-admin.service.ts`          |
| Repositories| `*.repository.ts`   | `platform-admin.repository.ts`       |
| Validators  | `*.validator.ts`    | `platform-admin.validator.ts`        |
| Types       | `*.types.ts`        | `platform-admin.types.ts`            |
| API client  | `*.api.ts`          | `platform-admin.api.ts`              |
| Query hooks | `use-*-queries.ts`  | `use-platform-admin-queries.ts`      |
| Mutation hooks | `use-*-mutations.ts` | `use-platform-admin-mutations.ts` |

---

## 4. Database Migration

**File:** `migrations/0020_admin_audit_log.sql`

```sql
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
```

**Standardized action names:**

| Action                       | When                                            |
|------------------------------|-------------------------------------------------|
| `org.suspend`                | Org set inactive                                |
| `org.activate`               | Org set active                                  |
| `org.plan.change`            | Plan or seat limit changed                      |
| `org.impersonate.start`      | Super-admin begins viewing as an org            |
| `org.impersonate.stop`       | Super-admin exits impersonation                 |
| `org.credit.limit.change`    | Monthly SMS credit limit changed                |
| `org.credit.price.change`    | Overage price per credit changed                |
| `org.credit.topup`           | One-time credit grant added to current period   |
| `org.credit.charge.write_off`| Pending overage charge waived by admin          |
| `user.role.change`           | User role promoted/demoted                      |
| `user.deactivate`            | User deactivated by admin                       |
| `branch.create.on_behalf`    | Admin created a branch for an org               |

**Why a separate table from the existing `audit_log`?** That table is per-tenant and tracks quote/booking deletes by tenant users. Mixing cross-tenant admin actions would muddy tenant-scoped audit queries.

### Migration 0021 — SMS Credits

**File:** `migrations/0021_sms_credits.sql`

```sql
-- Per-org credit configuration (default: 100 free credits/month, $0.05 overage)
ALTER TABLE "organization"
  ADD COLUMN IF NOT EXISTS "monthly_sms_credit_limit" integer       NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "sms_overage_price_cents"  integer       NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "sms_credits_enabled"      boolean       NOT NULL DEFAULT true;

-- Aggregated usage per org per calendar month. One row per (org, period).
-- Updated atomically inside sms.service.ts when a message is queued/sent.
CREATE TABLE IF NOT EXISTS "sms_credit_usage" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"         uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "period_start"   date NOT NULL,                          -- always first-of-month (UTC)
  "credits_used"   integer NOT NULL DEFAULT 0,
  "credits_granted" integer NOT NULL DEFAULT 0,            -- top-ups added this period
  "created_at"     timestamp NOT NULL DEFAULT NOW(),
  "updated_at"     timestamp NOT NULL DEFAULT NOW(),
  UNIQUE ("org_id", "period_start")
);
CREATE INDEX IF NOT EXISTS "idx_sms_credit_usage_org_period"
  ON "sms_credit_usage" ("org_id", "period_start" DESC);

-- One row per overage (credit consumed beyond the limit + grants).
-- Created at the moment of send; status moves invoiced → paid via billing.
CREATE TABLE IF NOT EXISTS "sms_credit_charge" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"          uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "sms_message_id"  uuid REFERENCES "sms_messages"("id") ON DELETE SET NULL,
  "period_start"    date NOT NULL,
  "credits"         integer NOT NULL DEFAULT 1,
  "unit_price_cents" integer NOT NULL,                     -- snapshot of overage price at send time
  "amount_cents"    integer NOT NULL,                      -- credits * unit_price_cents
  "status"          varchar(16) NOT NULL DEFAULT 'pending', -- pending | invoiced | paid | written_off
  "invoiced_at"     timestamp,
  "paid_at"         timestamp,
  "created_at"      timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_sms_credit_charge_org_status"
  ON "sms_credit_charge" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "idx_sms_credit_charge_period"
  ON "sms_credit_charge" ("org_id", "period_start" DESC);
```

**Period model:** calendar month in UTC (`date_trunc('month', NOW())::date`). No rollover; unused credits do not carry forward. A new `sms_credit_usage` row is created lazily the first time an org sends in a month.

**Decisions encoded in the schema:**
- Overage price is per-org (`sms_overage_price_cents`) so the system owner can set custom pricing.
- Credit limits can be disabled per-org (`sms_credits_enabled`) for special accounts.
- Charges snapshot `unit_price_cents` at send time — changing the org's price later doesn't retroactively rewrite history.
- Top-ups are tracked as `credits_granted` on the usage row, not as negative charges — keeps "used vs allowed" math simple: `allowed = monthly_limit + credits_granted`.

---

## 5. Backend Endpoints

All under `/api/platform-admin`, all protected by `requirePlatformAdmin`.

| Method | Path                                | Controller       | Service                          | Repository                              |
|--------|-------------------------------------|------------------|----------------------------------|-----------------------------------------|
| GET    | `/organizations`                    | `listOrgs`       | `listOrganizations()`            | `findAllOrgsWithCounts()`               |
| GET    | `/organizations/:id`                | `getOrg`         | `getOrganization(id)`            | `findOrgByIdWithCounts(id)`             |
| PATCH  | `/organizations/:id/suspend`        | `suspend`        | `suspend(id, actorId, reason)`   | `setActive(id, false)` + audit          |
| PATCH  | `/organizations/:id/activate`       | `activate`       | `activate(id, actorId)`          | `setActive(id, true)` + audit           |
| PATCH  | `/organizations/:id/plan`           | `changePlan`     | `changePlan(id, plan, seat, actor)` | `updatePlan(id, plan, seat)` + audit  |
| GET    | `/users`                            | `listUsers`      | `listUsersAcrossOrgs(filters)`   | `findAllUsersAcrossOrgs(filters)`       |
| GET    | `/users/:id`                        | `getUser`        | `getUserAcrossOrgs(id)`          | `findUserAcrossOrgsById(id)`            |
| POST   | `/organizations/:id/impersonate`    | `impersonate`    | `startImpersonation(orgId, actor)` | `findOrgByIdWithCounts(id)` + audit   |
| DELETE | `/impersonate`                      | `stopImpersonating` | `stopImpersonation(actor)`    | audit only                              |
| GET    | `/organizations/:id/credits`        | `getCreditSummary` | `getCreditSummary(orgId)`      | `findOrgCreditConfig` + `findCurrentUsage` + `findPendingChargesTotal` |
| PATCH  | `/organizations/:id/credits/limit`  | `updateCreditLimit` | `updateCreditLimit(orgId, limit, actor)` | `setMonthlyLimit` + audit         |
| PATCH  | `/organizations/:id/credits/price`  | `updateOveragePrice` | `updateOveragePrice(orgId, cents, actor)` | `setOveragePriceCents` + audit  |
| POST   | `/organizations/:id/credits/topup`  | `topUpCredits`   | `topUpCredits(orgId, credits, actor, reason)` | `addGrantedCredits` + audit    |
| GET    | `/organizations/:id/credits/usage`  | `getUsageHistory` | `getUsageHistory(orgId, months)` | `findUsageByOrg`                       |
| GET    | `/organizations/:id/credits/charges` | `listCharges`   | `listCharges(orgId, filters)`    | `findChargesByOrg`                      |
| PATCH  | `/organizations/:id/credits/charges/:chargeId/write-off` | `writeOffCharge` | `writeOffCharge(orgId, chargeId, actor, reason)` | `markWrittenOff` + audit |
| GET    | `/organizations/:id/users`          | `listOrgUsers`   | `listUsersByOrg(orgId)`          | `findUsersByOrg(orgId)`                 |
| PATCH  | `/organizations/:id/users/:userId/role` | `changeUserRole` | `changeUserRole(orgId, userId, role, actor)` | `setUserRole` + audit         |
| PATCH  | `/organizations/:id/users/:userId/deactivate` | `deactivateUser` | `deactivateUser(orgId, userId, actor)` | `setUserActive(false)` + audit  |
| GET    | `/organizations/:id/branches`       | `listOrgBranches` | `listBranchesByOrg(orgId)`      | `findBranchesByOrg(orgId)`              |
| POST   | `/organizations/:id/branches`       | `createOrgBranch` | `createBranchOnBehalf(orgId, dto, actor)` | `createBranch` + audit          |
| GET    | `/audit-log`                        | `listAudit`      | `listAuditLog(filters)`          | `platformAdminAuditRepository.findAll`  |

### `requirePlatformAdmin` Middleware

**File:** `server/v2/middlewares/auth/require-platform-admin.ts`

- Reads `userId` from session (`getUserId(req)`).
- Looks up user from DB (does **not** trust any request/session field).
- Allows only when `user.role === 'platform_admin'`.
- Returns `401` if no user, `403` if wrong role.

**Mount strategy (defense in depth):**

```ts
// platform-admin.routes.ts
const router = Router();
router.use(isAuthenticated);
router.use(requirePlatformAdmin);              // router-level guard

router.get('/organizations',
  requirePlatformAdmin,                        // per-route (grep-able)
  controller.listOrgs
);
```

### Cross-Tenant Query Safety

**Rule:** All cross-tenant reads live in `platform-admin.repository.ts` with explicit `*AcrossOrgs` suffix.

- ✅ `findAllUsersAcrossOrgs(filters)`
- ✅ `findOrgByIdWithCounts(id)`
- ❌ Do NOT add `findAll(orgId?: string)` to existing tenant repos.

The admin module **may** import schemas (`user`, `organization`, `branches`, `branchMembers`) directly inside its own repository — this is the only place that's allowed.

For drill-down into tenant data (e.g. "show bookings for org X"), the admin service calls the existing tenant service with a synthesized `Scope` carrying `orgRole: 'platform_admin'`. The booking service already understands this.

---

## 6. Frontend Structure

### Role Detection (no new code needed)

- `useRole()` in [client/src/hooks/use-role.ts](../client/src/hooks/use-role.ts) returns `orgRole: 'platform_admin'` when applicable.
- `useCurrentUser()` hits `/api/auth/user`; the server resolves the role via `resolveOrgAndBranchForUser`.

### Route Group

In [client/src/App.tsx](../client/src/App.tsx):

```tsx
const PLATFORM_ROLES: OrgRole[] = ["platform_admin"];

<RoleRoute path="/system"                       allow={PLATFORM_ROLES} component={SystemHomePage} />
<RoleRoute path="/system/organizations"         allow={PLATFORM_ROLES} component={SystemOrgsPage} />
<RoleRoute path="/system/organizations/:orgId"  allow={PLATFORM_ROLES} component={SystemOrgDetailPage} />
<RoleRoute path="/system/users"                 allow={PLATFORM_ROLES} component={SystemUsersPage} />
<RoleRoute path="/system/audit-log"             allow={PLATFORM_ROLES} component={SystemAuditLogPage} />
```

`RoleRoute` already renders `ForbiddenPage` on a role miss.

### Nav Config

Update `PLATFORM_ADMIN_NAV` in [client/src/config/nav.ts](../client/src/config/nav.ts):

```ts
const PLATFORM_ADMIN_NAV: NavConfig = [
  {
    id: "main",
    items: [
      { path: "/system/organizations", label: "Organizations", icon: Building2 },
      { path: "/system/users",         label: "All Users",     icon: Users },
      { path: "/system/audit-log",     label: "Audit Log",     icon: Activity },
    ],
  },
];
```

### Impersonation UX

- On `useImpersonateOrg.mutate(orgId)` success → invalidate `authKeys.currentUser` → navigate `/`.
- `ImpersonationBanner` mounted in `AppHeader`: visible whenever the real user is `platform_admin` AND `orgId` is set. Shows org name + a **Stop** button calling `DELETE /api/platform-admin/impersonate`.

---

## 7. Rollout Plan (4 small PRs)

### PR 1 — Lock the door, light the room (no DB changes)
- Add `require-platform-admin.ts` middleware + export.
- Wire it into `platform-admin.routes.ts` (replace TODO).
- Implement `findAllOrgsWithCounts()` and `findOrgByIdWithCounts()`.
- Wire `listOrgs` and `getOrg` end-to-end.
- Add `scripts/promote-platform-admin.ts <email>` for seeding the first admin.
- Frontend: new `platform-admin.api.ts` + `useAdminOrgs()` hook. Rebuild [client/src/pages/platform-admin.tsx](../client/src/pages/platform-admin.tsx) to use the API instead of the `useAgency` localStorage shim.

**Outcome:** working read-only super-admin dashboard. Zero risk to tenants.

### PR 2 — Mutations + audit log (migration 0020)
- Migration `0020_admin_audit_log.sql`. Add `adminAuditLog` to `shared/schema.ts`.
- New `platform-admin-audit.repository.ts`.
- Implement `setActive`, `updatePlan` repository methods.
- Service methods write audit rows alongside mutations.
- `platform-admin.validator.ts` for suspend/activate/changePlan.
- Frontend: mutation hooks + suspend/activate/plan-change buttons + audit-log page.

**Outcome:** super-admin can take action; every action is recorded.

### PR 3 — Drill-down + impersonation + `/system` route group + org-level data management
- New endpoints: `listUsers`, `getUser`, `impersonate` (start), `DELETE /impersonate` (stop).
- New org-scoped admin endpoints: `listOrgUsers`, `changeUserRole`, `deactivateUser`, `listOrgBranches`, `createOrgBranch`.
- Modify `orgBranchScope` to honor `req.session.impersonateOrgId` when actor is `platform_admin`.
- Frontend: `/system` route group, new pages (`system-users`, `system-org-users`, `system-org-branches`), nav update, impersonation banner.
- Delete or redirect old [client/src/pages/platform-admin.tsx](../client/src/pages/platform-admin.tsx).

**Outcome:** super-admin can manage everything inside any org without leaving the admin UI.

### PR 4 — SMS credit limits + overage billing (migration 0021)
- Migration `0021_sms_credits.sql`. Add `monthlySmsLimit`, `smsOveragePriceCents`, `smsCreditsEnabled` to `organization`; add `smsCreditUsage`, `smsCreditCharge` to `shared/schema.ts`.
- New `platform-admin-credits.repository.ts` and `platform-admin-credits.service.ts`.
- Modify [server/v2/modules/sms/sms.service.ts](../server/v2/modules/sms/sms.service.ts) — before queuing an SMS:
  1. Skip the check entirely when `smsCreditsEnabled === false`.
  2. Upsert the current-period `sms_credit_usage` row.
  3. Increment `creditsUsed`.
  4. If `creditsUsed > monthlyLimit + creditsGranted` → insert a `sms_credit_charge` row at the org's snapshot price.
  5. All four steps run in one transaction so the SMS, usage row, and charge row stay consistent.
- New admin endpoints: credit summary, edit limit, edit price, top-up, usage history, list charges, write-off.
- Frontend: `system-org-credits.tsx` page, credit-summary card on the org detail page, mutation hooks.

**Outcome:** every org has a metered SMS quota; system owner can configure limits, pricing, and forgive charges; overage is recorded line-by-line for billing.

---

## 8. Risks & Gotchas

1. **[server/v2/modules/booking/booking.service.ts:27-31](../server/v2/modules/booking/booking.service.ts#L27-L31) trusts `orgRole === 'platform_admin'`** to skip org filtering. Safe today because `orgBranchScope` sets the role from a DB lookup. Any new middleware touching `req.orgRole` must do the same — never trust client-supplied role fields. Audit every `orgRole === 'platform_admin'` hit during PR review.

2. **[server/v2/modules/organization/organization.repository.ts](../server/v2/modules/organization/organization.repository.ts) `findAll()`** is unconditionally cross-tenant. Add a doc comment: *"Cross-tenant — do not call from tenant endpoints."*

3. **`/api/platform-admin` is mounted without `orgBranchScope`** in [server/v2/routes/index.ts](../server/v2/routes/index.ts). This is intentional and correct. Do NOT add `orgBranchScope` to this mount.

4. **`useAgency` localStorage shim** ([client/src/hooks/use-agency.ts](../client/src/hooks/use-agency.ts)) is a frontend-only fake impersonation. Reconcile with real server-side impersonation in PR 3 — likely delete it.

5. **Two role casings exist.** Backend always uses snake_case `'platform_admin'`. The frontend normalizer in [client/src/hooks/use-role.ts](../client/src/hooks/use-role.ts) converts variants. New code must use snake_case for `OrgRole` comparisons.

6. **`session.sess` is jsonb** in [shared/schema.ts](../shared/schema.ts) — adding `impersonateOrgId` and `impersonateActorId` requires no schema change.

7. **[server/v2/middlewares/require-auth.ts:31](../server/v2/middlewares/require-auth.ts#L31) short-circuits for `platform_admin`** and skips branch lookup. Impersonation must teach this path to honor `impersonateOrgId` in PR 3, so the impersonated context flows into `/api/auth/user`.

8. **`user.role` is unconstrained `text`.** A typo silently grants no privileges. Document this; do not add a CHECK constraint (legacy values like `'Agent'` would be rejected).

9. **No bulk-promote tooling exists.** Ship `scripts/promote-platform-admin.ts <email>` in PR 1.

10. **Existing controller stub** at [server/v2/modules/platform-admin/platform-admin.controller.ts](../server/v2/modules/platform-admin/platform-admin.controller.ts) returns `[]`. No client currently relies on its shape — safe to change in PR 1.

11. **SMS service is the only writer to `sms_credit_usage` / `sms_credit_charge`.** The admin module only reads/configures — it never increments usage or creates charges. This keeps the metering logic in one place: [server/v2/modules/sms/sms.service.ts](../server/v2/modules/sms/sms.service.ts).

12. **Existing SMS module does not currently check credits.** PR 4 adds the gate. Be careful with the SMS cron at [server/v2/modules/sms/sms.cron.ts](../server/v2/modules/sms/sms.cron.ts) — any auto-triggered messages also go through the gate, so a misconfigured limit could silently block automation. Mitigation: log explicitly when an SMS is blocked by credits, and surface "blocked" as a new `sms_messages.status` value if needed.

13. **Charge race condition.** Without a transaction wrapping {increment usage → maybe create charge}, two concurrent SMSes at the limit boundary could both be billed as overage (or both as free). PR 4 must run those steps inside a single Drizzle transaction with `SELECT ... FOR UPDATE` on the usage row.

14. **Monthly reset is implicit, not scheduled.** No cron is required — the upsert keys on `(orgId, periodStart)` where `periodStart = date_trunc('month', NOW())`, so the first send of a new month creates a fresh row at zero. This avoids a "reset bug" surface area.

---

## 9. SMS Credit System

### Behavior summary

- **Free tier:** every org gets a monthly allowance (default 100 SMS credits). 1 SMS = 1 credit.
- **Overage:** credits beyond the allowance are billable at the org's `smsOveragePriceCents` per credit (default $0.05).
- **Top-ups:** the system owner can grant N extra free credits for the current period; these add to the allowance (do **not** retroactively refund prior overage charges).
- **Period:** UTC calendar month. No rollover.
- **Disable:** the system owner can disable credit enforcement per org via `smsCreditsEnabled = false`.
- **Pricing change:** updating `smsOveragePriceCents` affects only **future** charges; existing rows snapshot the price at send time.
- **Write-off:** the system owner can waive any pending charge (`status → 'written_off'`) without deleting the row — audit trail is preserved.

### How the gate works (PR 4)

Inside `sms.service.ts`, before persisting / sending an SMS:

```ts
await db.transaction(async (tx) => {
  // 1. Skip if disabled for this org
  const org = await tx.query.organization.findFirst({ where: eq(organization.id, orgId) });
  if (!org?.smsCreditsEnabled) return await sendNormally(tx);

  // 2. Get or create the current-month usage row (SELECT FOR UPDATE)
  const periodStart = startOfMonthUtc(new Date());
  const usage = await upsertUsageForUpdate(tx, orgId, periodStart);

  // 3. Compute new state
  const newUsed   = usage.creditsUsed + 1;
  const allowance = org.monthlySmsCreditLimit + usage.creditsGranted;
  const isOverage = newUsed > allowance;

  // 4. Insert the SMS message
  const msg = await insertSmsMessage(tx, ...);

  // 5. Bump usage
  await tx.update(smsCreditUsage)
    .set({ creditsUsed: newUsed, updatedAt: new Date() })
    .where(eq(smsCreditUsage.id, usage.id));

  // 6. If overage, create a charge at snapshot price
  if (isOverage) {
    await tx.insert(smsCreditCharge).values({
      orgId, smsMessageId: msg.id, periodStart,
      credits: 1,
      unitPriceCents: org.smsOveragePriceCents,
      amountCents:    org.smsOveragePriceCents,
      status: 'pending',
    });
  }
});
```

### Read path: credit summary endpoint

`GET /api/platform-admin/organizations/:id/credits` returns:

```ts
type CreditSummary = {
  enabled: boolean;
  monthlyLimit: number;
  overagePriceCents: number;
  currentPeriod: {
    periodStart: string;        // ISO date
    creditsUsed: number;
    creditsGranted: number;     // top-ups
    allowance: number;          // monthlyLimit + creditsGranted
    remaining: number;          // max(0, allowance - creditsUsed)
    overageCredits: number;     // max(0, creditsUsed - allowance)
  };
  pendingChargesCents: number;  // sum of status='pending' charges
};
```

### What the admin can do

| Capability                          | Endpoint                                                   |
|-------------------------------------|------------------------------------------------------------|
| See current usage + remaining       | `GET /organizations/:id/credits`                           |
| Change monthly limit (e.g. 100→500) | `PATCH /organizations/:id/credits/limit`                   |
| Change overage price per credit     | `PATCH /organizations/:id/credits/price`                   |
| Grant one-time top-up               | `POST /organizations/:id/credits/topup`                    |
| See past months' usage              | `GET /organizations/:id/credits/usage?months=12`           |
| List pending/invoiced charges       | `GET /organizations/:id/credits/charges?status=pending`    |
| Waive a charge                      | `PATCH /organizations/:id/credits/charges/:id/write-off`   |
| Disable enforcement                 | `PATCH /organizations/:id/credits/limit` with `enabled:false` |

Every mutation writes an `admin_audit_log` row with the appropriate `org.credit.*` action.

### What the tenant sees

Out of scope for this plan, but for completeness — PR 4 should expose a tenant-side read endpoint (`GET /api/sms/credits/summary`) returning the same shape minus admin-only fields, so tenant users see "75 / 100 used" in the SMS UI. This prevents tenants from being surprised by overage charges.

---

## 10. Organization-Level Data Management

The system owner needs the ability to manage **any data inside any org**. The scope of "manage" is intentionally narrow at first — read everything, but write only the things that are clearly the system owner's responsibility (provisioning, plan/credit configuration, recovery actions). Tenant-domain mutations (creating bookings, sending quotes) flow through impersonation, not direct admin endpoints.

### What the admin can read (directly)

- All organizations (list + detail).
- All users across orgs, filterable by org / email.
- All branches within an org.
- All `sms_credit_usage` and `sms_credit_charge` rows.
- All `admin_audit_log` rows.

For drill-down into tenant-domain data (bookings, quotes, transactions, enquiries), the admin **does not** get dedicated cross-tenant endpoints. Instead they use **impersonation** to view the data through the tenant's normal UI. This:

- Reuses fully-tested permission and filtering logic.
- Avoids parallel "admin views" of every domain object.
- Leaves an audit trail of "who looked at what" via `org.impersonate.start`.

### What the admin can write (directly)

| Action                              | Endpoint                                                | Why direct (not via impersonation)            |
|-------------------------------------|---------------------------------------------------------|-----------------------------------------------|
| Suspend / activate org              | `PATCH /organizations/:id/suspend` and `/activate`      | Org may be locked out — impersonation impossible |
| Change plan / seat limit            | `PATCH /organizations/:id/plan`                         | Billing concern, not tenant concern           |
| Change SMS credit limit / price     | `PATCH /organizations/:id/credits/*`                    | System-owner-only knob                        |
| Grant credit top-up                 | `POST /organizations/:id/credits/topup`                 | Billing concern                               |
| Write off a charge                  | `PATCH /organizations/:id/credits/charges/:id/write-off`| Billing concern                               |
| Change a user's role                | `PATCH /organizations/:id/users/:userId/role`           | Recovery action when org owner is locked out  |
| Deactivate a user                   | `PATCH /organizations/:id/users/:userId/deactivate`     | Recovery / support action                     |
| Provision a branch on behalf of org | `POST /organizations/:id/branches`                      | Onboarding assistance                         |

Anything not in this list (e.g. editing a booking, sending an SMS, creating a quote) goes through `POST /organizations/:id/impersonate` → use the tenant UI → `DELETE /impersonate`.

### Org Detail page — IA

The single most important admin screen. Tabs inside `system-org-detail.tsx`:

```
┌─────────────────────────────────────────────────────────────────┐
│ Acme Travel Co.    [Active] Plan: Pro    [Suspend] [View as ▾] │
├─────────────────────────────────────────────────────────────────┤
│ Overview │ Users │ Branches │ Credits │ Audit │
├─────────────────────────────────────────────────────────────────┤
│ <tab content>                                                    │
└─────────────────────────────────────────────────────────────────┘
```

- **Overview:** name, slug, plan, seat limit, created date, key counters (users, branches, this-month SMS, pending charges).
- **Users:** list of all users in this org. Inline role editor, deactivate button. (Recovery actions.)
- **Branches:** list of branches; create new branch on behalf of the org.
- **Credits:** the full credit panel — limit, price, top-up, usage history chart, pending charges, write-off.
- **Audit:** filtered admin_audit_log scoped to `target_org_id = :id`.

### Hard rules

1. Admin write endpoints for tenant-domain data (bookings, quotes, enquiries, etc.) are **deliberately not added**. If the system owner needs to edit a booking, they impersonate.
2. Every admin write is gated by `requirePlatformAdmin` AND writes an audit row.
3. Reads of tenant-domain data via impersonation flow through the existing tenant services unchanged — no parallel "admin read" code path to keep in sync.

---

## 11. Best-Practices Checklist

- [ ] Every admin route uses `requirePlatformAdmin` (router-level **and** per-route).
- [ ] Every mutation writes an `admin_audit_log` row in the same service call.
- [ ] All zod validators live in `platform-admin.validator.ts` and run as middleware before controllers.
- [ ] Services throw `AppError`; controllers never call repositories directly.
- [ ] Cross-tenant queries are named `*AcrossOrgs` and only live in `platform-admin.repository.ts`.
- [ ] No `any` types; DTOs declared in `platform-admin.types.ts`.
- [ ] `requirePlatformAdmin` does its own DB lookup — never trusts session/request role fields.
- [ ] Impersonation is implemented as a session shadow flag, not by faking user identity.
- [ ] Frontend uses `RoleRoute` with `allow={["platform_admin"]}` — never inline role checks.
- [ ] Impersonation banner is visible at all times during impersonation.
- [ ] Action names in `admin_audit_log` follow the `noun.verb` convention from the standardized list.
- [ ] SMS credit usage + charge writes happen **only** inside `sms.service.ts`, wrapped in a single transaction with `SELECT ... FOR UPDATE` on the usage row.
- [ ] `sms_credit_charge.unit_price_cents` is snapshotted at send time — pricing changes never rewrite history.
- [ ] Period boundary is `date_trunc('month', NOW())` in UTC — no separate reset cron.
- [ ] When `smsCreditsEnabled === false`, the gate is fully bypassed (no usage row written either) so disabled orgs don't accumulate empty rows.
- [ ] No direct admin write endpoints exist for tenant-domain data (bookings, quotes, enquiries). Drill-down writes go through impersonation.
- [ ] Every recovery action endpoint (`changeUserRole`, `deactivateUser`, `createBranchOnBehalf`) writes an audit row with the actor's user id.
- [ ] Tenant-side credit summary endpoint (`GET /api/sms/credits/summary`) is exposed so tenants see usage in their own UI — no surprise overage bills.
