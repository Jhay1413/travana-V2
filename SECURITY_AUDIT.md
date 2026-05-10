# Tenant Isolation Security Audit

Multi-phase rollout to fix cross-tenant data leaks across the API. Discovered when the
header search bug exposed clients from other organisations.

## Status legend
- ✅ **DONE** — implemented, type-checks, ready for QA
- ⏳ **PENDING** — not started
- ⏸️ **PAUSED — REVERTED** — code was written but has been rolled back; must be re-implemented
- 🛑 **BLOCKED** — needs a design decision before code can land

## ⏸️ Resume point (Phase A + C + B done 2026-05-10; resume on Phase D)

**Phases A, B, and C are all in place and verified** — full verification script run
returns **34 passed, 0 failed, 4 skipped** (the skips are payout + withdrawal tables
empty, plus quote/booking delete-guards have no foreign-org fixtures).

Targets module is intentionally **excluded** — `shop_target` has no `org_id` column, so
it's a Phase D blocker (needs schema migration + design decision per the table at the
bottom of this doc).

**What still exists (new files, untracked):**
- `scripts/verify-phase-a-isolation.ts` — verification script
- `scripts/seed-foreign-org-fixtures.ts` — cross-tenant fixture seeder for `Jhon's Travel`
- `SECURITY_AUDIT.md` — this file
- New API endpoints / hooks added during the agency-settings work:
  `client/src/api/endpoints/{branch,invite,organization}.api.ts`,
  `client/src/hooks/{queries,mutations}/use-{branch,invite,organization}-*.ts`,
  `client/src/pages/agency/`, `client/src/pages/accept-invite.tsx`
- `server/v2/middlewares/auth/require-org-role.ts`
- `server/v2/modules/organization/organization-member.{controller,service}.ts`
- `migrations/0007_branch_settings_and_email_verification.sql`

**What is NOT in place (rollback restored these to their pre-audit state):**
- Search repo / controller — **the original cross-org leak is back** (any logged-in user
  can search clients from any org).
- Notification, Email, Wallet, Referral, Ticket-reply, Ticket-attachment, SMS, Facebook —
  all UUID-guess exploits are open again.
- Audit + Admin-import — destructive endpoints unguarded again.
- Note, Enquiry, Booking, Quote, User, Opportunities — unscoped CRUD restored.

**Where to resume:**
- The audit findings below (file:line refs and exploit descriptions) are still accurate.
- The diff strategies that worked once (and pass type-check + the verification script)
  are documented module-by-module. Re-applying them is mechanical, not exploratory.
- Suggested order: **search → Phase A → Phase C → Phase B (note → enquiry → booking →
  quote → user → opportunities) → revenue/dashboard → targets/Phase D**.
- After each module, run `tsx scripts/verify-phase-a-isolation.ts` to confirm.

## Test environment
For every phase, set up at least two accounts in different organisations so cross-tenant
attempts can actually be exercised:
- **Org A** — `admin-a@test.local` (org_admin) + `manager-a@test.local` (branch_manager)
- **Org B** — `admin-b@test.local` (org_admin)
- Optionally a **platform_admin** account to verify the cross-org bypass still works.

A typical test reads as: "log in as Org B admin → try to act on a record that belongs to
Org A → expect 404 (not 403; a 403 leaks the existence of the record)."

The currently-seeded test fixture is in **`Jhon's Travel`** (orgId
`838be74e-d4ad-4acf-8bd7-2a284ede742d`). Re-seed any time with
`tsx scripts/seed-foreign-org-fixtures.ts` (idempotent).

---

## Phase A — Trivial UUID-guess exploits ✅ DONE

> Re-applied 2026-05-10. Verification script: **22 passed, 0 failed, 4 skipped** against
> the `Jhon's Travel` fixtures (1 audit failure in the run is from Phase C, which is
> tracked separately below).

**Goal:** close the leaks that any logged-in user could exploit just by guessing a UUID.

**What changed**

| Module | File(s) |
|---|---|
| Notification | [notification.controller.ts](server/v2/modules/notification/notification.controller.ts), [notification.routes.ts](server/v2/modules/notification/notification.routes.ts), [client/notification.api.ts](client/src/api/endpoints/notification.api.ts) |
| Email accounts | [email.controller.ts](server/v2/modules/email/email.controller.ts), [email.service.ts](server/v2/modules/email/email.service.ts) |
| Wallet | [wallet.routes.ts](server/v2/modules/wallet/wallet.routes.ts), [wallet.controller.ts](server/v2/modules/wallet/wallet.controller.ts), [wallet.service.ts](server/v2/modules/wallet/wallet.service.ts), [wallet-transaction.repository.ts](server/v2/modules/wallet/wallet-transaction.repository.ts) |
| Referral / Payout / Withdrawal | [referral.repository.ts](server/v2/modules/referral/referral.repository.ts), [referral.service.ts](server/v2/modules/referral/referral.service.ts), [referral-payout.*](server/v2/modules/referral/referral-payout.controller.ts), [referral-withdrawal.*](server/v2/modules/referral/referral-withdrawal.controller.ts) |
| Ticket reply / attachment | [ticket-reply.*](server/v2/modules/ticket/ticket-reply.controller.ts), [ticket-attachment.*](server/v2/modules/ticket/ticket-attachment.controller.ts) |
| SMS | [sms.controller.ts](server/v2/modules/sms/sms.controller.ts), [sms.repository.ts](server/v2/modules/sms/sms.repository.ts), [sms.routes.ts](server/v2/modules/sms/sms.routes.ts) |
| Facebook integration | [facebook.controller.ts](server/v2/modules/facebook/facebook.controller.ts) |
| Header search (already fixed earlier) | [search.repository.ts](server/v2/modules/search/search.repository.ts) |

### Test checklist

A repository-level verification script lives at [`scripts/verify-phase-a-isolation.ts`](scripts/verify-phase-a-isolation.ts).
It runs each scoped repo helper against real DB data and confirms cross-tenant rows are rejected.
A companion seeder at [`scripts/seed-foreign-org-fixtures.ts`](scripts/seed-foreign-org-fixtures.ts) inserts a tagged
fixture set into a second org (`Jhon's Travel`) so the cross-tenant assertions have foreign rows to attempt to leak.

To re-run:
```
tsx scripts/seed-foreign-org-fixtures.ts    # idempotent; safe to run again
tsx scripts/verify-phase-a-isolation.ts
```

**Last verified run (2026-05-10)** — `casey@tinastraveldeals.co.uk` (branch_manager, org `c790aeb2…`)
attempting to read fixtures owned by `Jhon's Travel` (org `838be74e…`):

> **22 passed, 0 failed, 4 skipped (payout + withdrawal tables empty; quote/booking tests skipped because no foreign-org quotes/bookings exist yet — Phase B will add coverage)**

`[x]` = covered by the verification script.
`[ ]` = needs a live HTTP test with a session cookie (script can't forge auth).

**Header search**
- [x] As Org B admin, type the first three letters of a known Org A client's surname into the header search. Expect zero results from Org A. — *script: scoped 18 vs platform 19, foreign client filtered.*
- [x] As `platform_admin`, the same search returns clients across both orgs.

**Notification**
- [ ] As Org B admin, hit `GET /api/v2/notifications?userId=<an Org A user's id>`. Expect your own feed (the query param is ignored), not Org A's.
- [x] As Org B admin, hit `PUT /api/v2/notifications/<an-Org-A-notification-id>/read`. Expect 404. — *script: foreign notification's user_id correctly identified, `assertOwnership` would 404.*
- [x] As Org B admin, hit `DELETE /api/v2/notifications/<an-Org-A-notification-id>`. Expect 404.
- [ ] Marking your own notification as read still works.

**Email accounts**
- [ ] As Org B admin, hit `GET /api/v2/emails/accounts/shared`. Expect to see your own first account or null — never Org A's.
- [ ] As Org B admin, hit `GET /api/v2/emails/accounts/user/<an-Org-A-userId>`. Expect 403.
- [x] As Org B admin, hit `GET /api/v2/emails/accounts/<an-Org-A-account-id>`. Expect 404. — *script: foreign account's user_id verified mismatched, `loadOwnedAccount` would 404.*
- [ ] `POST /api/v2/emails/accounts` with `userId` set to another user's id in the body. The created account belongs to **you**, not the other user.
- [x] As Org B admin, `POST /api/v2/emails/accounts/<Org-A-account-id>/send`. Expect 404 (no SMTP open as the other user). — *covered by the same `loadOwnedAccount` check above.*

**Wallet**
- [x] As Org B admin, hit `GET /api/v2/wallet`. Expect zero rows from Org A — only Org B clients. — *script: 5 scoped vs 6 system-wide (1 seeded foreign tx is excluded).*
- [x] As Org B admin, hit `GET /api/v2/wallet/client/<Org-A-client-id>/balance`. Expect 404. — *script: `clientBelongsToOrg` returns false for foreign client.*
- [x] As Org B admin, hit `POST /api/v2/wallet/client/<Org-A-client-id>/apply-booking-credit`. Expect 404.
- [x] As Org B admin, hit `PATCH /api/v2/wallet/transactions/<Org-A-tx-id>/process`. Expect 404. — *script: foreign tx → clientOrg mismatch.*
- [ ] Acting on your own org's data still works end-to-end (apply credit → process → invoice URL).
- [ ] As an `agent` or `homeworker`, the entire `/api/v2/wallet/*` returns 403.

**Referral / Payout / Withdrawal**
- [x] As Org B admin, `GET /api/v2/referrals`. Expect zero Org A referrals. — *script: 5 scoped vs 6 system-wide.*
- [x] As Org B admin, `GET /api/v2/referrals/<Org-A-referral-id>`. Expect 404. — *script: `findByIdWithOrg` returns foreign org_id mismatch.*
- [x] As Org B admin, `PATCH /api/v2/referrals/<Org-A-referral-id>/status`. Expect 404.
- [x] As Org B admin, `DELETE /api/v2/referrals/<Org-A-referral-id>`. Expect 404.
- [ ] As Org B admin, `GET /api/v2/referral-payouts` and `/api/v2/referral-withdrawals`. Expect Org B-only. — *Skipped: payout/withdrawal tables are empty in DB. Same scoping pattern as referral; will pass when seeded.*
- [ ] As Org B admin, approve/reject/process an Org A payout/withdrawal by id. Expect 404.

**Ticket replies + attachments**
- [x] As Org B admin, `GET /api/v2/replies/ticket/<Org-A-ticket-id>`. Expect 404. — *script: `ticketBelongsToOrg` returns false for foreign ticket.*
- [x] As Org B admin, `POST /api/v2/replies/ticket/<Org-A-ticket-id>`. Expect 404.
- [x] As Org B admin, `PUT /api/v2/replies/<Org-A-reply-id>` and `DELETE /api/v2/replies/<Org-A-reply-id>`. Expect 404. — *script: `findByIdWithOrg` returns foreign org_id.*
- [x] As Org B admin, `GET /api/v2/attachments/<Org-A-attachment-id>/download`. Expect 404 (no file served). — *script: same pattern via attachment's parent ticket.*
- [x] As Org B admin, `DELETE /api/v2/attachments/<Org-A-attachment-id>`. Expect 404.
- [ ] Replying to / attaching files on your own org's tickets still works.

**SMS**
- [x] As Org B admin, `GET /api/v2/sms/messages`. Expect Org B-only message history. — *script: 0 scoped vs 1 system-wide (the seeded foreign message is excluded).*
- [x] As Org B admin, `POST /api/v2/sms/preview-recipients` with `mode: "all_optin"`. Expect Org B-only opted-in clients. — *script: 3413 scoped vs 3414 system-wide (foreign client excluded).*
- [x] As Org B admin, `POST /api/v2/sms/preview-recipients` with `mode: "client", clientId: <Org-A-client-id>`. Expect zero recipients. — *script: returns 0 for foreign client.*
- [x] As Org B admin, `POST /api/v2/sms/send` targeting an Org A client id. Expect zero sent. — *covered by `resolveRecipients` filter above.*
- [x] As Org B admin, `PUT /api/v2/sms/clients/<Org-A-client-id>/opt-in`. Expect 404 (no flag flipped). — *script: `findClientByIdInOrg` returns undefined.*
- [ ] As `agent`/`homeworker`, the entire `/api/v2/sms/*` returns 403 (existing role gate still holds).

**Facebook**
- [ ] As User B, `GET /api/v2/facebook/pages?userId=<User-A-id>`. Expect User B's pages (the query param is ignored). — *Code review only: the controller now resolves `userId` from `getUserId(req)`, ignoring the query param.*
- [ ] As User B, `DELETE /api/v2/facebook/pages/<User-A-page-id>?userId=<User-A-id>`. Expect 404 (the page lookup uses session userId, not the query param).
- [ ] As User B, `POST /api/v2/facebook/pages/<User-A-page-id>/messages?userId=<User-A-id>`. Expect 404.
- [ ] Acting on your own connected pages still works.

### Known limitations of Phase A
- **Internal callers** in `booking.service.ts` / `transaction.service.ts` pass `{ orgId: null }` (trusted scope) to wallet/referral services. They were already in scoped contexts when called, so this preserves behaviour, but it's a soft contract — any new caller from an unscoped path bypasses the check.
- **Legacy v1 routes** at `/api/referrals`, `/api/referral-payouts`, `/api/referral-withdrawals` still mount the same v2 services with default no-scope and remain leaky. The client only uses v2 paths, so normal traffic is safe — but the v1 endpoints are still mounted and exploitable. **Recommend deleting them** in a follow-up: [server/routes/index.ts:88-90](server/routes/index.ts#L88-L90).

---

## Phase C — Destructive admin endpoints ✅ DONE

> Re-applied 2026-05-10. Verification script run: audit `findAll` returns **21 scoped vs 23
> system-wide** with **zero foreign-org rows leaking**. Same shape as the original
> verified run.

**Goal:** stop a user with an "admin" role in any org from destroying data in any other org.

**What changed**

| Module | File(s) |
|---|---|
| Audit | [audit.routes.ts](server/v2/modules/audit/audit.routes.ts), [audit.controller.ts](server/v2/modules/audit/audit.controller.ts), [audit.service.ts](server/v2/modules/audit/audit.service.ts), [audit.repository.ts](server/v2/modules/audit/audit.repository.ts) |
| Admin import | [admin-import.routes.ts](server/v2/modules/admin-import/admin-import.routes.ts), [admin-import.controller.ts](server/v2/modules/admin-import/admin-import.controller.ts) |

**Fix summary**
- **Audit** — entire route file now wrapped with `isAuthenticated + orgBranchScope + requireOrgRole(['org_admin', 'platform_admin'])`. `getAll` derives org from session and joins through `audit_log.client_id → client_table.org_id` to return only entries whose linked client is in the caller's org. `deleteQuote` and `deleteBooking` resolve the entity's transaction → client → org and 404 if it doesn't match the caller's org. The inline `requireAdmin` based on the legacy global `user.role` field is gone.
- **Admin import** — entire route file gated to `requireOrgRole(['platform_admin'])`. Previously these endpoints had no role check at all, so any logged-in user could `DELETE /api/v2/admin/clear/<table>` to wipe platform-wide lookup tables (countries, accommodation_list, lodges, tags…).

### Test checklist
The verification script [`scripts/verify-phase-a-isolation.ts`](scripts/verify-phase-a-isolation.ts) now also exercises Phase C.

**Last verified run (2026-05-10)** — `casey@tinastraveldeals.co.uk` (branch_manager,
org `c790aeb2…`) reading audit entries; foreign org is `Jhon's Travel` (`838be74e…`):

> **23 passed, 0 failed, 4 skipped** (Phase A + C combined run)

**Audit**
- [x] As Org B admin, `GET /api/v2/audit`. Expect Org B-only audit entries. — *script: 21 scoped vs 23 system-wide; the seeded foreign-org audit row is excluded.*
- [x] No foreign-org audit entry leaks into the scoped result. — *script: every scoped entry's client belongs to our org.*
- [ ] As Org B admin, `POST /api/v2/audit/delete-quote/<Org-A-quote-id>` with a reason. Expect 404. — *Code review only: the controller now resolves quote → transaction → client.orgId and 404s on mismatch. No foreign-org quotes exist in DB to exercise via the script.*
- [ ] As Org B admin, `POST /api/v2/audit/delete-booking/<Org-A-booking-id>` with a reason. Expect 404. — *Same: code review only, no foreign-org bookings exist.*
- [ ] Soft-deleting your own org's quote / hard-deleting your own org's booking still works.
- [ ] As an `agent` / `branch_manager` / `homeworker`, the entire `/api/v2/audit/*` returns 403 (route-level role guard).

**Admin import**
- [ ] As Org A admin (non-platform), hit any `POST/PATCH/DELETE /api/v2/admin/*`. Expect 403.
- [ ] As `platform_admin`, lookup CRUD still works.
- [ ] As any non-authenticated request, `DELETE /api/v2/admin/clear/<table>` returns 401.

### Known limitations of Phase C
- **`audit_log` has no `org_id` column.** Scope is resolved by joining through the audited entity's `client_id`. Two consequences:
  - Audit entries with `client_id IS NULL` (e.g. an entity that had no linked client) are invisible to org users — only `platform_admin` (orgId = null) sees them.
  - The join uses an explicit `varchar → uuid` cast (`audit_log.client_id` is varchar; `client_table.id` is uuid). If a malformed value ever lands in `audit_log.client_id` it'll throw.
  - Follow-up: add an `org_id` column on `audit_log` and write it at insert time so we can filter directly without a join.
- **No "soft 404" on `/audit` for users without any clients.** They'll get an empty array, not a 403. Acceptable for now — the route guard already filters out non-admins.

---

## Phase B — Pipeline modules (CRUD scope-plumbing) ✅ DONE

> Re-applied 2026-05-10. Verification script (extended with `testPhaseB`) reports
> **34 passed, 0 failed, 4 skipped** — every Phase B repo helper rejects the
> foreign-org transaction `e24cc15e…`, and `dashboard.getStats` returns 3413 clients
> scoped vs 3414 system-wide (the foreign client is filtered out).
>
> Targets is intentionally not in scope here — see Phase D below.

**Modules fixed**

| Module | Notes |
|---|---|
| Quote | [quote.repository.ts](server/v2/modules/quote/quote.repository.ts) — added `findByIdWithOrg`, `transactionBelongsToOrg`, `flightBelongsToOrg`, `accommodationBelongsToOrg`, `transferBelongsToOrg`, `passengerBelongsToOrg`. `findAll`, `findByStatus`, `findFreeQuotesPaginated` take `orgId`. Inline endpoints in [quote.routes.ts](server/v2/modules/quote/quote.routes.ts) (`/portal-visibility`, `/featured`, `/portal-push`) now do scope checks; `/portal-push` is gated to `org_admin + platform_admin`. |
| Booking | [booking.repository.ts](server/v2/modules/booking/booking.repository.ts) — added `findByIdWithOrg`, `transactionBelongsToOrg`, `flightBelongsToOrg`, `accommodationBelongsToOrg`. `findAll`/`findAllWithImages` take `orgId`. Service routes every public method through `assertBookingInScope`/`assertTransactionInScope`/`assertFlightInScope`/`assertAccommodationInScope`. |
| Enquiry | [enquiry.repository.ts](server/v2/modules/enquiry/enquiry.repository.ts) — added `findByIdWithOrg`, `transactionBelongsToOrg`. `findAll` takes `orgId` and joins through transaction → client. |
| Note | [note.repository.ts](server/v2/modules/note/note.repository.ts) — added `findByIdWithOrg` (resolves orgId via either `note.client_id` directly OR `note.transaction_id → transaction.client_id`) and `transactionBelongsToOrg`. |
| Opportunities (pipeline) | [opportunities.repository.ts](server/v2/modules/opportunities/opportunities.repository.ts) — every `findX` method takes `orgId` and joins client. `findAgents(orgId)` filters `user.orgId` so the dropdown stops leaking other orgs' agents. |
| Revenue | [revenue.repository.ts](server/v2/modules/revenue/revenue.repository.ts) — every aggregate (`getForwardsForMonth`, `getBookingsForMonth`, `getAgentPerformance`, `getTotalStats`) takes `orgId` and joins through transaction → client. |
| Dashboard | [dashboard.repository.ts](server/v2/modules/dashboard/dashboard.repository.ts) — `getStats(orgId)` and `getAdminOverviewStats(orgId)` scope every count/sum, and the agent map is built from `user.orgId` so cross-org agents don't appear. |
| User | [user.service.ts](server/v2/modules/user/user.service.ts) + [user.controller.ts](server/v2/modules/user/user.controller.ts) — `getUserById`/`updateUser`/`deleteUser` go through `loadScopedUser` which 404s on org mismatch. `createUser`/`updateUser` force `orgId` to caller's org so a non-platform admin can't insert/move users into another org. The inline `/profiles/:userId` route in [user.routes.ts](server/v2/modules/user/user.routes.ts) also checks the target user's `orgId`. |
| Social-post | [social-post.repository.ts](server/v2/modules/social-post/social-post.repository.ts) + [social-post.service.ts](server/v2/modules/social-post/social-post.service.ts) — added `findByIdWithOrg`, `quoteBelongsToOrg`. Every public service method (`generatePost`, `getTravelDealByQuoteId`, `updateTravelDeal`, `schedulePost`, `reschedulePost`, `deleteScheduledPost`, `getPostMedia`, `getQuoteImages`) takes scope and asserts. Route now mounted with `...auth`. |
| Targets | **NOT FIXED — Phase D blocker.** `shop_target` has no `org_id` column. Two orgs in the same month overwrite each other. Needs schema migration before code can scope. |

### Verification approach
The Phase B helpers are now exercised by `testPhaseB` in
[`scripts/verify-phase-a-isolation.ts`](scripts/verify-phase-a-isolation.ts). The seeder
creates a foreign-org transaction (`phase-a-test` marker), and the test asserts every
repo's `transactionBelongsToOrg` returns false for that transaction.

`[x]` = covered by the verification script.
`[ ]` = needs a live HTTP test with a session cookie (script can't forge auth).

- [x] `noteRepository.transactionBelongsToOrg(foreignTxId, ourOrg)` → false.
- [x] `enquiryTableRepository.transactionBelongsToOrg(foreignTxId, ourOrg)` → false.
- [x] `bookingRepository.transactionBelongsToOrg(foreignTxId, ourOrg)` → false. `findAll(orgId)` ≤ `findAll(null)`.
- [x] `newQuoteRepository.transactionBelongsToOrg(foreignTxId, ourOrg)` → false. `findAll(orgId)` < `findAll(null)`.
- [x] `opportunitiesRepository.findAgents(orgId)` < `findAgents(null)` (agent dropdown filtered).
- [x] `revenueRepository.getTotalStats(orgId).totalDeals` ≤ system-wide.
- [x] `dashboardRepository.getStats(orgId).totalClients` < system-wide (foreign client excluded).
- [x] `socialPostRepository.quoteBelongsToOrg` rejects unknown / cross-org quotes.
- [x] User cross-org guard (foreign user's `orgId` differs from caller's; `loadScopedUser` would 404).
- [ ] As Org B admin, `GET /api/v2/<module>/<Org-A-id>` returns 404 (live HTTP).
- [ ] As Org B admin, `PATCH /api/v2/<module>/<Org-A-id>` returns 404 (live HTTP).
- [ ] As Org B admin, `DELETE /api/v2/<module>/<Org-A-id>` returns 404 (live HTTP).
- [ ] As Org B admin, all create paths still work for Org B records (live HTTP).
- [ ] As `platform_admin`, all reads work cross-org (live HTTP).
- [ ] Quote inline endpoints (`/portal-visibility`, `/featured`, `/portal-push`): cross-tenant id returns 404 (code review confirms `quoteIsInScope` check; needs HTTP exercise).

### Known limitations of Phase B
- **Internal `walletService.adjustBookingCredit`** is called from `bookingService.updateBooking` without scope (passes `{ orgId: null }` to `applyBookingCredit` for the recursive call). The booking's scope was already verified at entry, so this is a soft contract — any new caller from an unscoped path bypasses the check.
- **`v2 transaction.service.createTransactionWithQuote`** calls `newQuoteService.createQuote(..., { orgId: null })` for the free-quote duplicate. Same justification — caller is already scoped — but it's a soft contract.
- **`booking.service.convertQuoteToBooking`** / **`bookingService.createBooking`** still rely on `transactionRepository.findById` after the scope check. If the underlying transaction has no client (legacy data), the scope assertion is permissive (`orgId === null` matches everything). Acceptable for now since `transactionBelongsToOrg` requires a non-null `client.org_id`.
- **`findFreeQuotesPaginated`** scoping is added inside the `baseWhereConditions` array; the second-pass `select(...).from(quote).where(inArray(quote.id, ids))` doesn't re-filter — it doesn't need to, because the IDs were resolved with the scope filter, but a future refactor that splits these queries differently must re-check.

---

## Phase D — Truly global tables (design call) 🛑 BLOCKED on decisions

**Goal:** decide whether tables that have no `org_id` column should be per-org or stay
truly global, and migrate accordingly.

**Tables / modules in question**

| Table / Module | Current state | Why it matters |
|---|---|---|
| `shop_target` | No `org_id` column; one row per (year, month) globally. Any user in any org can read/overwrite. | Two agencies in the same month corrupt each other's targets. **Probably should be per-org.** |
| `hr_employees` / `hr_reminders` | No `org_id`. Single global HR roster. | If two agencies share this deployment, an admin in agency A reads + approves agency B's HR records. **Probably should be per-org.** |
| `hub_posts`, `announcements`, `destination_guru` | No `org_id`. Likely intentional ("the Hub" = shared content library). | If posts should ever be per-org, all repo queries need scoping. **Confirm intent first.** |
| `feedback` | No `org_id`. Global feedback list. | Admins/managers in any org see + change status / delete the entire feedback list. **Probably should be per-org.** |

### What's needed before code can land
- For each table above, decide: **per-org** (add `org_id` column + backfill + scope queries) or **truly global** (document explicitly + lock writes to `platform_admin` only).
- Schema migration plan for the per-org tables — including how to backfill existing rows
  (assign all to a "default" org? skip rows? require manual mapping?).

### Test checklist (once decisions made + implemented)
For each table chosen as **per-org**:
- [ ] As Org B admin, `GET /api/v2/<endpoint>` returns Org B-only.
- [ ] As Org B admin, mutations on Org A records return 404.
- [ ] Existing Org A rows (post-backfill) still appear for Org A users.
- [ ] Schema migration ran without losing rows.

For each table chosen as **truly global**:
- [ ] As `platform_admin` only — writes succeed.
- [ ] As any other role — writes return 403.
- [ ] Reads remain accessible to authenticated users (or whatever rule was chosen).
- [ ] Note added to repo / service file calling out the global-by-design decision.

---

## Cross-cutting follow-ups (lower priority)

- [ ] Delete the legacy v1 referral / referral-payout / referral-withdrawal route mounts in [server/routes/index.ts:88-90](server/routes/index.ts#L88-L90) once confirmed unused on the client.
- [ ] Make `Scope` parameters strictly required (not defaulted to `{ orgId: null }`) — forces every call site to opt in instead of accidentally getting bypass behaviour. Touches every internal caller.
- [ ] Add a CI check / lint rule that flags any new `db.select().from(<tenant-table>).where(...)` query that doesn't reference `orgId`.
- [ ] Audit the legacy `server/services/*.ts` and `server/controllers/*.ts` (v1) and either fix or remove.
