# Session Context — Multi-Tenancy Implementation

## What We Built

### 1. Signup Wizard (`client/src/pages/signup-agency.tsx`)
Replaced the existing 5-step stepper with a new 6-step wizard:
- **Step 1** — Company Details (name, address, phone, email; slug auto-derived silently from company name)
- **Step 2** — Owner/Admin (name, email, phone, password ≥8 chars)
- **Step 3** — Shop Opening Setup (opening pattern, bank holidays)
- **Step 4** — Opening Hours (per-day schedule with open/close times, apply-to-all helper)
- **Step 5** — Agents (add/edit/remove agents with roles: Agent, Senior Agent, Manager, Admin)
- **Step 6** — Review & Confirm

Key behaviour:
- Slug is auto-generated from company name (`tinas travel deals` → `tinas-travel-deals`) and stored internally — never shown in the UI
- `canProceed()` validates step 1 (all fields + valid email) and step 2 (all fields + password ≥8); steps 3–6 always allow proceeding

---

### 2. Multi-Tenancy Plan (`SAAS_MULTITENANCY_PLAN.md`)
Full plan audited and updated with:

#### New tables added to plan
- `organization` — root tenant entity (name, slug, plan, seat_limit, brand_color, etc.)
- `branches` — subdivisions within an org (office/team/virtual group); includes `is_active` for soft-delete
- `branch_members` — pivot table replacing `branch_id FK` on `user`; links users to branches with denormalized `org_id` for fast permission checks

#### Key design decisions documented
- `org_id` is the **tenant isolation boundary** — every query filters by it first, always
- `branch_id` is a **grouping/reporting dimension** — labels which branch owns a record, never the sole filter
- `org_admin` users have no `branch_members` row — their role lives on `user.org_role`; they are branch-agnostic
- **Homeworker isolation rule**: homeworkers see only their own records (`WHERE org_id = :orgId AND created_by = :userId`)
- `clientTable.created_by` — tracks which agent/homeworker created a client (ownership scoping)
- `transaction.user_id` — tracks which agent owns a deal

#### Sections updated
- Section 1: Added `branch_members` table + `is_active` on branches
- Section 2: ER diagram updated — removed `branches ||--o{ user`, added pivot relationships
- Section 4: Updated `user` entity (removed `branch_id`), added `branch_members` entity, added `created_by` on `clientTable`
- Section 5: Full Tenancy Map updated — `USR` node updated, `BMB` node added, edges updated
- Section 6: Scoping rules updated — `created_by` vs `user_id` distinction, homeworker isolation rule block
- Section 10: Code examples updated — `clientService.create` writes `created_by`, `clientRepository.findAll` filters by role
- Section 11: Migration priority updated to mention `created_by`
- Section 12: Schema summary table updated — `branch_members` as new table, `user` row corrected
- Section 13: Migration SQL updated — `branch_members` table created in Step 2b, `user.branch_id` NOT added (pivot replaces it), `branch_members` backfill INSERT added in Step 6, indexes updated

---

### 3. Drizzle Schema (`shared/schema.ts`)
Added the following to the schema (all new columns are nullable — no NOT NULL enforced yet):

#### New tables
```typescript
organization   // pgTable("organization")
branches       // pgTable("branches") — references organization
branchMembers  // pgTable("branch_members") — pivot: org + branch + user + org_role
```

#### Columns added to existing tables
| Table | New columns |
|---|---|
| `user` | `org_id` (FK → organization), `org_role`, `inviteToken`, `inviteTokenExpiry`, `invitedBy`, `invitedAt`, `inviteAgencyName` |
| `clientTable` | `org_id`, `branch_id`, `created_by` |
| `clients` (v2 table) | `org_id`, `branch_id`, `created_by` — **pending** |
| `transaction` | `org_id`, `branch_id` |
| `task` | `org_id`, `branch_id` |
| `tasks` | `org_id`, `branch_id` |
| `tickets` | `org_id`, `branch_id` |
| `forwardsReport` | `org_id`, `branch_id` |
| `tour_operator` | `org_id` |
| `tourOperators` | `org_id` |
| `referral` | `payoutType` (pre-existing drift fix) |
| `tour_package_commission` | `package_type_id` and `tour_operator_id` marked `.notNull()` (pre-existing drift fix — PK columns must be NOT NULL) |

---

### 4. Seeder (`scripts/seed-org.ts`)

Run with: `npx tsx scripts/seed-org.ts`

Creates:
1. **Organization** "Tinas Travel Deals" (slug: `tinas-travel-deals`) — auto-generated UUID, skips if slug already exists
2. **Branch** "Tinas Travel Deals" (code: TTD, `is_default: true`) — auto-generated UUID, skips if org already has a branch
3. **Backfills all users**: sets `org_id` + `org_role` on every user row
4. **Enrolls all non-admin users** into `branch_members` — maps existing `role` values:
   - `admin` → `org_admin` (no branch_members row)
   - `Manager` → `branch_manager`
   - `Homeworker` → `homeworker`
   - `Referer` → `referral_agent`
   - everything else → `agent`
5. **Backfills all operational tables** with `org_id` + `branch_id` where `IS NULL` (idempotent):
   - `transaction`, `task`, `tasks`, `tickets`, `forwardsReport`
   - `tour_operator`, `tourOperators` (org_id only — no branch)

Fully idempotent — safe to re-run.

---

### 5. v2 API Audit (`CLIENT_API_MAPPING.md`)

Issues found in the existing v2 client module:
- `client.repository.findAll()` — no `WHERE org_id` filter → **cross-org data leak**
- `client.repository.findById()` — no org ownership check → **IDOR**
- `client.repository.create()` — doesn't write `orgId`/`branchId`/`createdBy`
- `client.repository.update()` — no org ownership verification
- `DELETE /api/clients/:id` — exists in both v1 and v2 routes but missing from the API mapping doc
- Several modules (`referrals`, `wallet`, `notifications`) only use `isAuthenticated` without `orgBranchScope` — potential org-scope gap

---

## What Is Pending

### Immediate next task
**Implement org_id scoping in the v2 API** — wire `orgId`/`branchId`/`orgRole`/`userId` through controller → service → repository for all tenant-scoped modules.

Modules to update:
- `client` — full role-based filtering (org_admin: org only, branch_manager: org+branch, agent/homeworker: org+created_by)
- `transaction` — role-based filtering (same pattern, uses `user_id` not `created_by`)
- `ticket` — org+branch filtering
- `task` / `tasks` — org+branch filtering
- `tour-operator` — org-only filtering

**Note:** There are two client tables:
- `clientTable` (pgTable `client_table`) — legacy/main table used by v1 and neon-client module; has org columns added
- `clients` (pgTable `clients`) — newer v2 table used by `client.repository.ts`; also needs org columns added to schema

### Also pending
- `db:push` — the schema changes for all the new org/branch columns on operational tables have been written but not yet pushed to the database (push was aborted due to pre-existing drift issues; those have been fixed)
- Enforce `NOT NULL` on `org_id` columns after all data is backfilled
- Add `org_id` scoping to `neon-client` module (uses `clientTable`)
- `clients` table — add `org_id`, `branch_id`, `created_by` columns to schema (same as done for `clientTable`)

---

## Architecture Reference

### Middleware chain
```
Request → isAuthenticated → orgBranchScope → Controller → Service → Repository
```

`orgBranchScope` sets on `req`:
- `req.orgId` — UUID of the user's organization
- `req.branchId` — UUID of the user's branch (null for org_admin)
- `req.orgRole` — `org_admin | branch_manager | agent | homeworker | referral_agent`

### Scoping rules by role
```
platform_admin  → no filter
org_admin       → WHERE org_id = :orgId
branch_manager  → WHERE org_id = :orgId AND branch_id = :branchId
agent           → WHERE org_id = :orgId AND created_by = :userId  (clients)
                  WHERE org_id = :orgId AND user_id   = :userId   (transactions)
homeworker      → same as agent
referral_agent  → WHERE org_id = :orgId AND user_id = :userId (referrals only)
```

### Layer responsibilities (CLAUDE.md)
```
Route      → define HTTP endpoints, apply middleware
Controller → read req, call service, return response
Service    → business logic, orchestrate, throw AppError
Repository → Drizzle ORM queries only, return raw data
```

### Key file locations
| File | Purpose |
|---|---|
| `shared/schema.ts` | Single Drizzle schema file for all tables |
| `server/v2/middlewares/org-branch-scope.ts` | Sets req.orgId/branchId/orgRole |
| `server/v2/types/express.d.ts` | Express Request type augmentation |
| `server/v2/routes/index.ts` | v2 route registration |
| `scripts/seed-org.ts` | Org/branch seeder |
| `SAAS_MULTITENANCY_PLAN.md` | Full multi-tenancy design document |
| `CLIENT_API_MAPPING.md` | v1→v2 API migration audit |
