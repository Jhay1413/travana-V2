# Homeworker redesign: one branch per homeworker

Status: planned, not implemented. Decided 2026-10-14.

## Product decisions

- A homeworker is an org-level unit, the same level as a shop branch, never under a shop branch.
- Only `org_admin` and `platform_admin` oversee homeworkers. Branch managers have no visibility.
- Isolation is two-way. Shop staff cannot see or open a homeworker's clients, deals, tickets, tasks, notes or chat. Homeworkers cannot see shop data.
- Each homeworker branch has exactly one user. `branches.branch_type = 'homeworker'`.
- Profit share is per homeworker and stored on the homeworker branch. `organization.homeworker_commission` is the default for new homeworkers.
- Profit base per booking = the STORED sales commission (`package_commission` + line-item commissions, i.e. `totalBookingCommissionExpr`) − `booking.discounts` − `booking.service_charge`. Upsell commission counts too (`totalUpsellCommissionExpr`). Homeworker receives `profit_share_percent`, the org keeps the rest.
- Statement period is by `booking.date_created` (matches the dashboard), not travel date. Owner has not objected; change here if needed.
- Homeworker access = everything an agent can access, EXCEPT social posts and the inbox/conversations. Those two modules deny the homeworker role outright.
- Plan limits (seats and branches) are being removed for now, so homeworker branches need no special plan-limit handling beyond keeping `countByOrg` honest.
- Homeworkers get monthly targets via `agent_target_table (branch_id, user_id)`.
- A homeworker cannot also hold `agent` or `social_media_manager`.
- Homeworker branches do not count toward plan branch limits and do not appear in shop branch pickers or shop stats.
- Offboarding archives the branch (`is_active = false`), never deletes it.

## Findings that shape the plan

- The shared "Homeworkers" branch created at signup already has `branch_type = 'homeworker'` (`server/v2/modules/onboarding/onboarding.service.ts:141-152`). Scoping cannot trust branch type alone, or every homeworker in that shared branch would see each other. The branch must record its owner and scope must require "my own homeworker branch". Homeworkers not yet migrated keep today's per-user rule.
- Org-wide reads that would leak across the partition: global search (`search.service.ts:12`), revenue (`revenue.service.ts:12`, no role guard on `revenue.routes.ts`), dashboard `/stats` and `/admin-overview-stats` (`dashboard.service.ts:10,22`), `GET /branches` open to every role (`branch.routes.ts:15`).
- Two scope resolvers (`middlewares/org-branch-scope.ts:43` and `middlewares/auth/require-auth.ts:53`) both call `findActiveByUserId`, which uses `.limit(1)` with no ORDER BY (`branch-member.repository.ts:24-30`).
- `notes` has no `branch_id` (`shared/schema.ts:1288-1298`); notes scope through their transaction or client, so the migration does not rewrite them.
- Profit columns: commission = `booking.package_commission` + line-item `commission`, already summed by `totalBookingCommissionExpr` (`server/v2/utils/commission-sql.ts:33-45`). `booking.discounts` and `booking.service_charge` exist per booking only (`shared/schema.ts:1043-1044`). Upsell commission is separate (`commission-sql.ts:61-77`).
- Service charge is currently ADDED to the customer price (`server/services/newQuote.service.ts:60-64`). Subtracting it from profit must be confirmed by the owner before Phase 6.
- Existing "profit" views count bookings by `booking.date_created` month (`dashboard.repository.ts:452-482`); the revenue module uses `travel_date` + 56 days (`revenue.repository.ts:16-24`). The statement period basis must be chosen.

## Scoping rule

| Role | Branch type | List queries | Open by ID |
|---|---|---|---|
| platform_admin, org_admin | any | whole org | whole org |
| branch_manager | shop | own branch (as today) | org, excluding homeworker branches |
| agent | shop | today's rules, excluding homeworker branches | org, excluding homeworker branches |
| social_media_manager | shop | org, excluding homeworker branches | org, excluding homeworker branches |
| homeworker | own homeworker branch | `branch_id = own branch AND (user_id / created_by = self)` | same |
| homeworker | shared or shop branch (unmigrated) | per-user rule, as today | per-user rule |

"Excluding homeworker branches" = `(col IS NULL OR col NOT IN (SELECT id FROM branches WHERE organization_id = :org AND branch_type = 'homeworker'))`. The `IS NULL` arm is required so legacy rows with null branch are not silently dropped.

Enforced by one new helper in `server/v2/utils/scope-conditions.ts`: `buildPartitionCond(scope, branchCol, ownerCol?)`. `buildTransactionScopeConds` and `buildTransactionRecordScopeConds` call it (covers booking, enquiry, quote, transaction, note, internal-chat-analytics). Called directly in: `client.repository.ts:28`, `neon-client.repository.ts:23`, `internal-chat-clients.repository.ts`, `ticket.repository.ts:35`, `task.repository.ts` (incl. entity-scoped path), `opportunities.repository.ts:19` and `findAgents` at `:98`, `search.repository.ts`, `dashboard.repository.ts`, `revenue.repository.ts`, `user.repository.ts:128-160`. Existing role narrowing stays; the helper only adds the isolation layer.

## Phases

### Phase 0: decisions (human)

See open risks at the end. Profit formula and migration conflict policy block Phases 6 and 8.

### Phase 1: leak fixes that apply under any design (coder, then tester, then code-reviewer)

- `targets.routes.ts`: POST requires `org_admin | branch_manager | platform_admin`. On GET, homeworkers and agents read only their own row (`targets.service.ts:85-120`).
- `revenue.routes.ts`: guard with org_admin/platform_admin. Same for dashboard `/stats` and `/admin-overview-stats` (confirm which client pages call them first).
- Agent picker `opportunities.repository.ts:112`: homeworkers get only themselves.
- `assertCompatibleRoleSet` (`user-org-roles.service.ts:62-76`): homeworker exclusive with agent, social_media_manager, branch_manager, org_admin. `setOrgRoleAtomic` (`branch-member.repository.ts:115`): `rolesToKeep = [orgRole]` for homeworker.
- Social posts and inbox/conversations routes: deny the `homeworker` role (everything else a homeworker can reach is what an agent can reach).
- Tests: extend `user-org-roles.service.test.ts`; add a targets guard test and a social/inbox deny test.

### Phase 2: schema (coder, then code-reviewer), migration `0057_homeworker_branches.sql`

- `branches`: `owner_user_id text NULL REFERENCES user(id) ON DELETE SET NULL` UNIQUE; `profit_share_percent numeric(5,2) NULL`; `CHECK (branch_type IN ('shop','homeworker'))`; `CHECK (profit_share_percent IS NULL OR profit_share_percent BETWEEN 0 AND 100)`; `CHECK (branch_type = 'homeworker' OR (owner_user_id IS NULL AND profit_share_percent IS NULL))`; index `(organization_id, branch_type)`.
- Owner and share nullable so the legacy shared branch stays valid; the service requires both for new homeworker branches.
- One-member rule enforced in the service (homeworker module, and `assignToBranch` rejects homeworker branches).
- New table `homeworker_payout_statement`: id, org_id, branch_id, user_id, period_start, period_end, gross_profit, share_percent, homeworker_share, org_share (numeric 12,2), status (`draft`/`final`), finalised_by, finalised_at. Unique `(branch_id, period_start)`. Freezes the percentage used per period.
- `organization.homeworker_commission` unchanged; becomes the default.
- Implemented 2026-10-14 as `migrations/0057_homeworker_branches.sql` (generated with drizzle-kit, not applied). `homeworker_payout_statement.org_id` is `uuid`, matching `organization.id`. Before applying, a human should run `SELECT DISTINCT branch_type FROM branches` because the new CHECK rejects any value other than `shop` or `homeworker`.
- Legacy data note for Phase 8: users who hold `homeworker` plus leftover `agent` or `social_media_manager` rows in `user_org_roles` must have the extra rows deleted by the migration script; until then the role-union checks added in Phase 1 treat them as homeworkers.

### Phase 3: auth and scope context (coder, then tester)

- `branch-member.repository.ts`: add `findActiveContextByUserId` joining `branches`, returning `branchType` and `ownerUserId`, ordered by `joined_at ASC, id ASC`.
- Both resolvers (`org-branch-scope.ts:43-63`, `require-auth.ts:53-65`) use it.
- `Scope` (`scope.ts:32-48`) and the Express augmentation gain `branchType` and `ownsHomeworkerBranch`.
- Apply the helper to every repository above; replace inline checks at `scope-conditions.ts:36,62`.
- Ticket service: reject assignment across the shop/homeworker boundary.
- Tests: integration test per row of the scoping table, modelled on `booking.repository.integration.test.ts` (clients, transactions list and by ID, tickets, tasks, notes, search, opportunities).

### Phase 4: creating and archiving homeworkers (coder, then code-reviewer)

- New module `server/v2/modules/homeworker/` (routes, controller, service, repository, validator, types):
  - `POST /homeworkers` (org_admin) invite
  - `GET /homeworkers` (org_admin)
  - `PATCH /homeworkers/:branchId` profit share and name
  - `POST /homeworkers/:branchId/archive`
  - `GET /homeworkers/me`
- Creation in one DB transaction: branch (`homeworker`, owner, share defaulting to org default, `isDefault = false`), pending user, `branch_members` row (inactive until accepted), `user_org_roles` row, `hr_records` row. Mirrors `invite.repository.ts:103-125`. Rename branch to the user's full name in `finaliseAcceptedInvite`.
- Inviting by email is the ONLY way a homeworker branch is created; there is no manual "create homeworker branch" action. The invite form hides the branch picker for the homeworker role and shows the profit share field instead. The branch gets a placeholder name from the email until acceptance.
- The branch exists before the invite is accepted. Homeworker lists show it with a "pending" status (membership inactive) rather than hiding it.
- Revoking an unaccepted homeworker invite deletes the empty branch along with the pending user, so no orphan branch is left. Revoking after acceptance is the archive path.
- The HR "add employee" dialog and the platform-admin create path reuse the same homeworker service, so there is one code path that builds a homeworker branch.
- `invite.validator.ts:6-7` and `hr.validator.ts:9-10` become a discriminated union: homeworker has no `branchId`, optional `profitSharePercent` (0-100) and `displayName`. `invite.service.ts` routes homeworker invites through the homeworker service, org_admin only; remove homeworker from `BRANCH_MANAGER_INVITABLE` (`:15`).
- Onboarding: stop creating the shared branch (`onboarding.service.ts:141-152`); keep `hasHomeworkers` + commission as org default; update `onboarding.service.test.ts:223-228`.
- Role changes into or out of homeworker return 400 in `organization-member.service.ts:28,50`, platform-admin `changeUserOrgRole` (`platform-admin.service.ts:107`), and `user-org-roles` `addRole`.
- Branch module: `countByOrg` excludes homeworker branches (`branch.repository.ts:44-50`); `GET /branches` defaults to shop, `?type=homeworker` org_admin only; `DELETE` on a homeworker branch returns 400 ("archive instead").
- Archive: `isActive = false` on branch and membership; clients and deals keep `branch_id`.

### Phase 5: targets and org overview (coder)

- Homeworker targets use `agentTargetTable (branchId, userId)`. Shop-target totals (`organization-overview.repository.ts:915,936`) exclude homeworker branches.
- Org overview branch rows (`organization-overview.repository.ts:569-676`) return `branchType`; shop totals exclude homeworker branches; homeworkers returned as a separate list with share and target.

### Phase 6: profit statement (coder, then tester)

Repository query in `homeworker.repository.ts`:

```sql
SELECT SUM(totalBookingCommissionExpr(bk.id) - COALESCE(bk.discounts,0) - COALESCE(bk.service_charge,0)) AS gross
FROM booking_table bk JOIN transaction t ON bk.transaction_id = t.id
WHERE t.org_id = :org AND t.branch_id = :hwBranch AND t.is_test = false AND t.is_active = true
  AND (bk.is_active IS NULL OR bk.is_active) AND bk.date_created >= :start AND bk.date_created < :end
```

- Add `totalUpsellCommissionExpr(bk.id, {start,end})` if upsells count.
- Compute shares in SQL numeric with `ROUND(..., 2)`, never JS floats. Detail query returns one line per booking.
- Endpoints: `GET /homeworkers/:branchId/statement?from&to` (org_admin), `GET /homeworkers/me/statement`, `POST .../statement/finalise` writes `homeworker_payout_statement` plus an audit row.
- Tests: formula unit test; integration test with discounts, service charge, line items, and a test or inactive booking.

### Phase 7: client (coder)

- New `client/src/features/homeworkers/`: list, create dialog (share pre-filled from org default), edit, archive, statement page. Wire into `App.tsx` and `config/nav.ts` for Admin.
- Statement card on the homeworker dashboard.
- `multi-branch-stats-card.tsx:11,58-72`: filter on `branchType`; add `branchType` to `organization-overview.api.ts:63`; filter in `branches-performance-table.tsx`.
- Branch pickers request shop branches only: `branch.api.ts`, `use-branch-queries.ts`, `pages/agency/branches.tsx`, `pages/agency/targets.tsx`, `reports/components/filter-strip.tsx`, `InvitePanel.tsx`, both `invite-employee-dialog.tsx` files.
- Picking homeworker role in invite dialogs and `InvitePanel.tsx:11` swaps the branch field for profit share.
- `team.tsx:67-68`: branch managers invite `["agent"]` only.
- Signup copy at `signup-agency/index.tsx:576`.

### Phase 8: data migration (coder writes, code-reviewer reviews, a human runs)

`scripts/migrate-homeworker-branches.ts`, `--dry-run` default, one transaction per org.

1. Find homeworkers: union of `user_org_roles.role = 'homeworker'` and `branch_members.org_role = 'homeworker'`. Report anyone also holding agent or social_media_manager for manual resolution.
2. Create one branch per homeworker: owner set, share = org default, name = user's name.
3. Rewrite `branch_id`: `client_table` where `created_by` = homeworker; `transaction` where `user_id` = homeworker (quote, enquiry, booking follow via transaction); `tasks` where `user_id` = homeworker or entity is one of their transactions; `tickets` follow linked transaction or client, else creator; `agent_target_table` rows for that user; review every other `branch_id` column (`schema.ts:522,1338,1855`, …).
4. Memberships: delete old, insert one active membership in the new branch.
5. Archive the shared Homeworkers branch (`isActive = false`, `isDefault = false`).
6. Shared clients: for every client with deals on both sides (or across two homeworkers), insert a copy of the client row into the homeworker's branch (same personal fields, `created_by` = homeworker, a `split_from_client_id` reference for audit), then re-point that homeworker's transactions, tasks, tickets and notes from the original to the copy. Policy: the ORIGINAL client always stays with its creator's side and the other side (shop staff or a different homeworker) gets the copy, with portal PIN, referral counters/VIP and merge fields reset on the copy. Exception: when nobody but the homeworker has deals on a client created by a non-homeworker, the client is MOVED to the homeworker branch (`created_by` kept) instead of copied. Merged clients are never copied. Only rows whose client column equals the original are re-pointed. Record each split and move in the dry-run report with original id, copy id and counts of re-pointed rows.
7. Dry-run conflict report: every split from step 6; homeworkers sitting in shop branches; homeworkers also holding agent or social_media_manager.
8. Post-migration helper: an org_admin action "split client to homeworker" that performs step 6 for a single client, for cases that arise after rollout. Reversal is the existing client-merge feature.

### Phase 9: cleanup (enhancer, then code-reviewer)

After production is verified, remove the per-user fallback for unmigrated homeworkers. Update `SAAS_MULTITENANCY_PLAN.md`, `docs/multi-role-plan.md`, `.claude/agents/context/architecture.md`.

## Decisions already made (2026-10-14)

- Profit formula: base is the stored sales commission, minus discounts and service charge, upsells included. Note that service charge is currently added to the customer price (`newQuote.service.ts:60-64`), so subtracting it reduces the homeworker's base; the owner confirmed the formula as stated.
- Period basis: `booking.date_created`. Negative profit: clamp the statement to zero per period (default; nothing carries forward).
- Seats and plan limits: being removed for now. No homeworker-specific limit handling.
- Module access for homeworkers: same as agent, except social posts and inbox/conversations, which are denied. Phase 3 applies the partition helper to SMS, notifications, comments, files, referrals and portal reads, and Phase 1 adds a role deny on social and inbox routes.
- Shared clients (a client with deals on both the shop side and a homeworker side): DUPLICATE. The migration creates a copy of the client in the homeworker's branch, re-points the homeworker's deals, tasks, tickets and notes to the copy, and leaves the original with the shop side. The dry-run report lists every split so the org admin can review and later merge using the existing client-merge feature. Phase 8 also adds a "split client" helper for cases that arise after migration.

## Open risks to confirm before coding

1. Mixed rollout: Phase 3 ships before Phase 8 runs. The ownership-aware fallback covers that window; keep it until the migration is verified.
2. Tester should run a cross-partition sweep over every module after Phase 3.

## Top 5 most-changed files

1. `server/v2/utils/scope-conditions.ts`
2. `server/v2/modules/homeworker/homeworker.repository.ts` (new)
3. `server/v2/modules/invite/invite.service.ts` (plus validator and repository)
4. `server/v2/middlewares/org-branch-scope.ts` (plus `require-auth.ts` and `branch-member.repository.ts`)
5. `server/v2/modules/organization-overview/organization-overview.repository.ts`

## Implementation status (2026-10-14)

Phases 1 to 8 are implemented in the working tree, each reviewed by a code-review pass with the findings fixed. Phase 9 (cleanup of the per-user fallback and old docs) is deferred until the migration has run in production. Unit suite: 179 files, 2485 tests, all passing. Integration tests for the partition and the statement are written but not run (they need the throwaway test database). Migration 0057 is generated, not applied. The migration script has never been executed.

Decisions still open for the owner:
- Edits after a statement is finalised (booking money fields, upsell added_at) are not blocked; the statement shows a drift warning instead.
- Org overview KPI totals include homeworker deals at full commission; only the statement shows the split.
- The /facebook routes are not denied to homeworkers because that mount has no org scope middleware.
- social_media_manager and referral_agent can still read every agent target in their branch (pre-existing).
- Statement period bounds are UTC midnight, not UK local time.
