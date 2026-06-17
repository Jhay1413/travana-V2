# Testing Plan

What needs to be tested in this project, in priority order. Grounded in the real
`server/v2` module inventory.

## How we test here

- **Runner:** Vitest. `npm test` (one-shot) / `npm run test:watch`.
- **Unit tests** live next to the code as `<feature>.service.test.ts`. They mock
  the layer below (repositories + sibling services) so they hit **no database**
  and assert only that layer's own logic. See `server/v2/modules/booking/booking.service.test.ts`
  as the reference pattern.
- **Integration tests** (DB-backed) run the real SQL against a throwaway Postgres
  (`docker-compose.test.yml`), because mocking Drizzle proves nothing about the query.
  Run with `npm run test:integration` (see Tier 4).
- A trusted scope `{ orgId: null }` short-circuits the in-scope assertions, so unit
  tests can exercise business logic without wiring up full scope checks.

Legend: `[ ]` todo · `[~]` partial · `[x]` done

---

## Why these tests matter

This is a multi-tenant travel CRM that moves real money (commissions, wallet credit,
referral payouts) across isolated organisations. The cost of a silent bug here is not a
crash — it's a **wrong number on an invoice**, **one org seeing another's clients**, or a
**booking that half-saved**. The suite is built to make those specific failures loud.

**What each layer protects against:**

- **Service unit tests (Tiers 1–3)** pin the *business rules* — price math (`sales − discount
  + service charge`, per-person splits, no divide-by-zero), state-machine guards (can't process
  a paid referral, can't double-book a transaction), and the money formulas (referral payout =
  25% of commission net of the 10% Hays cut). These run in milliseconds with no DB, so they can
  guard every rule cheaply on every commit.
- **Access-control tests (Tier 2)** assert the *negative* case — wrong org → 404, disallowed
  role → 403, an injected `orgId` overwritten with the caller's. In a multi-tenant app a
  scope regression is a data-leak, so these are security tests, not just correctness tests.
- **Repository integration tests (Tier 4)** verify the part unit tests *cannot*: the real SQL.
  Scope filters that actually exclude other branches' rows, soft-delete `WHERE` clauses, the
  56-day "forwards" commission window, `GROUP BY` leaderboards, and — most importantly —
  **atomic writes that roll back completely** when a child insert fails (no orphaned transaction).
- **Controller + middleware tests** lock the *HTTP contract*: correct status codes (201/200/204),
  request dispatch, and that a thrown `AppError` becomes the right response while an unexpected
  error returns a generic 500 **without leaking internals**.

**These aren't hypothetical — writing them surfaced real issues a mocked-only suite would miss:**

- `quote_status` has no `PENDING` value (the enum is `NEW_LEAD`/`QUOTE_IN_PROGRESS`/`WON`/…) —
  the DB rejected it; mocked service tests still pass with the wrong string.
- `booking` enforces `UNIQUE(transaction_id)` (one booking per transaction) — only the real
  insert revealed it.
- A timezone off-by-one in `reports` month-bucket boundaries (`fillMonthBuckets` reads local
  `getMonth()`), which could show a phantom leading month on the chart.
- The error middleware must not echo an unexpected error's message to the client (a 500 with a
  raw `ECONNREFUSED host:port` would leak infrastructure detail).

**The payoff:** confidence to refactor the `server/v2` layers without re-checking by hand, a
regression net on exactly the code where mistakes cost money or leak data, and living
documentation — each test states, in plain assertions, what a rule is *supposed* to do.

---

## Tier 1 — Money & core booking flow (highest risk)

Anything that computes prices, commission, credit, or moves a record toward "booked"
is where a silent bug costs real money. Test happy path **and** every thrown `AppError`.

- [x] `modules/booking/booking.service.ts` (20 tests)
  - [x] `getBookingWithDetails` — total_price = sales − discount + service charge
  - [x] `getBookingWithDetails` — price_per_person split; 0 passengers → "0.00"; 404 when missing
  - [x] `createBooking` — 404 unknown txn, 400 duplicate booking, computed price_per_person
  - [x] `convertQuoteToBooking` — copies relations, marks quote WON / txn on_booking,
        blocks when txn already has a booking, VIP badge at ≥3 bookings, referral creation
  - [x] `updateBooking` — recomputes price_per_person only when price inputs change;
        wallet-credit adjust path; commission sync to referrals
  - [x] `deleteBooking` — voids referrals by transaction
- [x] `modules/quote/quote.service.ts` (15 tests) — total/per-person price math, create 404 +
      price computation/preservation, **enquiry→quote conversion** (txn status flip + close enquiry
      tasks), update recompute, **status transitions** (LOST deactivation, revive-from-LOST with/without
      LOST siblings), **duplicateQuote** (image merge, isQuoteCopy, child-age cloning, 404), delete 404
- [x] `modules/quote/quote-public.service.ts` (4 tests) — token price math, 0-pax guard, 404s
- [x] `modules/transaction/transaction.service.ts` (18 tests) — get/update/delete 404 guards,
      task reassignment on owner change, expiring-quote classification, **createTransactionWithEnquiry**
      (on_enquiry status, relations + notes), **createTransactionWithQuote** (quote+children, line-item
      replace, free social quote opt-out), **createTransactionWithBooking** (booking+children, transfers,
      wallet credit, referral, VIP badge)
- [x] `modules/wallet/wallet.service.ts` (13 tests) — applyBookingCredit / requestBankTransfer
      balance guards, processDebit / rejectDebit state machine, adjustBookingCredit
- [x] `modules/referral/referral.service.ts` (10 tests) — payout math (10% Hays + 25%),
      createReferral, PAID guards, commission sync, void-by-transaction
- [x] `modules/referral/referral-payout.service.ts` (7 tests) — requestPayouts eligibility/dedupe/total,
      approve guards, total-earnings sum
- [x] `modules/referral/referral-withdrawal.service.ts` (9 tests) — request/process guards,
      booking-credit allocation oldest-first
- [x] `modules/revenue/revenue.service.ts` (3 tests) — getMonthForwards avgDealValue/target,
      getMonthBookings booking+upsell mapping
- [x] `modules/targets/targets.service.ts` (8 tests) — branch resolution per role, month/year/amount validation

## Tier 2 — Access control & multi-tenancy

The CRM is multi-tenant; a scope bug leaks one org's data to another. These deserve
tests that assert the **negative** case (wrong org → 404/forbidden), not just success.

- [x] `utils/scope.ts` (8 tests) — `hasAnyRole`, `getScope` role defaulting + userId resolution.
      Caught the orgRole='agent' default vs orgRoles=[] asymmetry.
- [x] `booking.service` scope (3 tests, in booking suite) — org mismatch → 404, in-scope read,
      platform_admin bypass
- [x] `modules/organization/organization-member.service.ts` (7 tests) — invalid role, self-demote/
      self-suspend guards, cross-org 404, duplicate-branch 409
- [~] `modules/organization/organization.service.ts` — not yet covered (member service done)
- [x] `modules/user/user.service.ts` (6 tests) — tenant isolation on get/delete, platform_admin
      bypass, orgId pinning on update
- [x] `modules/user-org-roles/user-org-roles.service.ts` (9 tests) — `primaryRole` ranking,
      addRole validation/idempotency/incompatibility, removeRole last-role guard
- [x] `modules/invite/invite.service.ts` (11 tests) — branch-manager invite guards, token
      validity/expiry, accept-payload validation, revoke guards
- [x] `modules/platform-admin/platform-admin-credits.service.ts` (8 tests) — summary allowance/
      overage math, limit/top-up validation, write-off charge-state guards
- [x] `middlewares/auth/*` (6 tests) — requireOrgRole 403/allow, requirePlatformAdmin 401/403/allow
- [x] `middlewares/validation.middleware.ts` (2 tests) — valid → next, invalid → 400 AppError

## Tier 3 — Input validation (cheap, high value)

Zod validators are pure functions — fast to test and they catch a lot of bad input.
For each: assert one valid payload passes and the key invalid cases are rejected.

Covered the validators with hand-written rules (refinements, regexes, enums); the rest
just wrap `insert*Schema` from `shared/schema` (testing those tests drizzle-zod, not our code).

- [x] `onboarding.validator.ts` (8 tests) — hasHomeworkers refine, branch openingHours length(7),
      slug regex, password length, email
- [x] `organization.validator.ts` (8 tests) — slug regex, 6-digit hex brand color, currency length(3),
      plan enum, positive seat limit
- [x] `invite.validator.ts` (7 tests) — email, UUID branchId, role enum, password length
- [x] `referral.validator.ts` (6 tests) — UUID, email, required name, status enum
- [x] `booking.validator.ts` (3 tests) — image URL array (min 1, must be URLs)
- [ ] Thin schema-wrappers (lower priority — exercise `shared/schema` via Tier 4 instead):
      `booking-upsell`, `quote`, `quote-public`, `client`, `neon-client`, `referral-payout`,
      `referral-withdrawal`, `user`, `user-org-roles`, `branch`, `note`, `email`, `hr`,
      `notification`, `platform-admin`, `ticket`

## Tier 4 — Repository / integration (DB-backed)

Unit tests mock these away, so the SQL itself is unverified. Stand up a test Postgres
(testcontainers or a disposable schema) and cover the queries that are easy to get wrong.

- [x] Test harness — `docker-compose.test.yml` (postgres:16 on :55432), `vitest.integration.config.ts`
      (globalSetup pushes `shared/schema.ts` via drizzle-kit, single-fork, DATABASE_URL injected),
      `server/v2/test/factories.ts` seed helpers, npm `test:integration` / `db:test:up` / `db:test:down`.
      Integration tests excluded from the fast `npm test`. **Requires Docker Desktop running.**
- [~] `booking.repository` (11 integration tests, all passing vs real Postgres):
      `transactionInScope` role-aware scope SQL (org_admin/agent/homeworker/platform_admin/trusted),
      `bookingInScope` (booking joined through its transaction), `findByTransactionId`,
      `findWithDetails` (holiday_type_name + board_basis joins, child accommodation aggregation, empty
      collections as arrays), `replaceTransfers` (full replace), `replaceExtraAccommodations`
      (preserves the primary, swaps non-primary), `upsertPrimaryAccommodation` (insert→update in place),
      `upsertFlightByType` (update same type, insert different). TODO: findAllWithImages
- [x] `quote.repository` (10 integration tests): `findById` soft-delete filter, `quoteInScope`,
      `findByTransactionId` (scope-filtered + excludes soft-deleted), `findByStatus`,
      `replaceChildPassengers` (replaces children, preserves adults, clears on empty), `findWithDetails`.
      Integration caught a real enum mismatch (`quote_status` has no 'PENDING').
- [x] `revenue.repository` (6 integration tests): `getForwardsForMonth` 56-day forward window
      (counts in the right month, excludes adjacent months, ignores null-commission bookings),
      org scoping via client.org_id, upsell-in-calendar-month commission addition,
      `getAgentPerformance` GROUP BY agent + ORDER BY total DESC.
- [x] `dashboard.repository` (2 integration tests): `getStats` — status-FILTER funnel counts
      (enquiry/quoted/booked), is_test exclusion, quote/revenue SUM+AVG, quoteStatsConds
      (client_id required), unscoped vs org-scoped.
- [x] `reports.repository` (4 integration tests): `getSales` — totals (SUM commission, COUNT,
      COUNT DISTINCT clients), empty prior-period, contiguous month buckets (zero-filling empty
      months), GROUP BY lead_source ordered by commission. Branch-scoped via buildScopeConditions.
- [x] `search.repository` (7 integration tests): `globalSearch` — single-word name match, multi-word
      AND full-name match, email/city match, org scoping, relevance ordering (exact > prefix),
      limit+1 pagination with nextOffset.
- [x] `branch-overview.repository` (5 integration tests): `getTeamLeaderboard` (ranks sales
      agents only — managers excluded despite bookings, booking+quote merge, commission-desc order,
      month-window filter), `branchBelongsToOrg`, `getBranchProfile` active member count + null guard.
- [x] `organization-overview.repository` (2 integration tests): `getBranchLeaderboard` — ranks an
      org's branches by commission (other org excluded, idle branches appear as zero rows),
      per-branch bookings/quotes/active-members/shop-target with percentToTarget.

- [x] `transaction.repository` (4 integration tests): `createWithQuoteAndChildren` /
      `createWithBookingAndChildren` atomic multi-table writes — transaction(on_quote/on_booking)
      + quote/booking(BOOKED) + flights + images in one db.transaction, **plus rollback-on-failure
      (a failed child insert commits nothing).**

**Tier 4 complete: 55 integration tests across 9 repositories, all green.**

## Tier 5 — Supporting business logic

Lower blast radius, but still logic worth pinning once Tiers 1–3 are solid.

- [ ] `modules/client/client.service.ts` + `client-file.service.ts`
- [x] `modules/enquiry/enquiry.service.ts` (8 tests) — create (transaction scope check), update
      **status change (LOST → deactivates transaction)**, relations replace (clear + re-add),
      404 guards, delete. [ ] `expiry.service.ts` still TODO
- [ ] `modules/task/task.service.ts` — completeByEntity used by booking conversion
- [ ] `modules/tag/tag.service.ts`, `modules/note/note.service.ts`, `modules/audit/audit.service.ts`
- [ ] `modules/ticket/*` — reply / attachment / notification flows
- [ ] `modules/notification/*`, `modules/sms/sms.service.ts` — auto-trigger dedupe window
- [ ] `settings/*` — mostly thin CRUD; smoke-test the ones with non-trivial rules
      (`cruise`, `cruise-voyage`, `accommodation`, `deletion-code`)

## Coverage gap analysis — against the architecture (Route → Controller → Service → Repository → DB)

Where each layer stands after Tiers 1–5. Services + repositories are well covered; the
gaps below are what the *design* says still matters, prioritized.

### A. Architectural linchpins — cross-cutting (DONE)
- [x] `middlewares/error.middleware.ts` (3 tests) — AppError → statusCode + `{success:false,message}`,
      MulterError → mapped 400, unknown → 500 (no message leak).
- [x] `utils/async-handler.ts` (2 tests) — resolves → next not called; rejects → `next(err)`.
- [x] `utils/response.ts` (3 tests) — success envelope + default/explicit status, error envelope.
- [x] **Controller layer pattern** on the money modules — `booking.controller` (5 tests: 200/201/204,
      arg+scope passing, error→next), `quote.controller` (5 tests incl. the controller-level 400 guard
      when transaction_id missing), `transaction.controller` (7 tests: enquiry/quote/booking type
      dispatch with 400 guards, plain create, 204 delete, error→next). Pattern established for the
      remaining ~75 controllers (thin — replicate as needed).

### B. Untested core business services (by design priority)
- [x] `modules/onboarding/onboarding.service.ts` (13 tests) — signup conflict guards (owner email,
      slug, agent emails → 409), agency assembly (starter plan, org_admin owner), agent role mapping
      (Manager→branch_manager), Homeworkers branch append, resendVerification (no-leak no-op, 429
      cooldown, fresh token), verifyEmail (invalid/expired 400, marks verified + clears token).
- [x] `modules/organization/organization.service.ts` (5 tests) — getById 404, update slug-conflict
      guard (409 vs own-slug allowed), settings deep-merge, update 404.
- [x] `modules/client/client.service.ts` (6 tests) — scoped CRUD with 404 guards on get/update/delete,
      data+scope forwarded to the repository.
- [ ] `modules/neon-client/neon-client.service.ts` — the other client-entity service (still TODO)
- [ ] `modules/opportunities/opportunities.service.ts` — sales pipeline
- [ ] `modules/plan/plan.service.ts` — billing plans / seat-limit enforcement
- [ ] `modules/referral/vip-enrollment.service.ts` — VIP tier recalculation (referenced everywhere)
- [ ] `modules/platform-admin/platform-admin.service.ts` — the main platform-admin service (only credits done)

### C. Supporting services (lower blast radius — see Tier 5 list above)
  task, tag, note, audit, ticket/*, sms (dedupe window), notification, email, hr, portal.

### D. Repository integration — pattern proven (9 done); fill the risky remaining queries
- [ ] `opportunities`, `client`/`neon-client`, the `getAttention` queries in branch/org-overview,
      and `getAgentsPerformance` — multi-join/aggregation shapes not yet exercised against real SQL.

### E. Settings — thin CRUD; smoke-test only the ones with real rules
  `cruise`, `cruise-voyage`, `accommodation`, `deletion-code`.

### Recommended next order
1. `error.middleware` + `async-handler` + `successResponse` — tiny, and they underpin every
   controller/service interaction.
2. Controller-layer pattern on booking/quote/transaction — closes the one fully-untested layer.
3. `onboarding.service`, then `organization.service` / `client.service` — highest-value untested services.

## Tech debt — `is_expired` removal (staged)

`is_expired` (boolean, on `quote` + `enquiry_table`) is redundant: v2 derives expiry from
`date_expiry` (fallback `date_created + 7d`). The flag is written by a cron keyed on
`date_created + 7d`, so it goes stale when `date_expiry` is extended.

**Done (v2-safe, this round):**
- [x] Single source of truth: `server/v2/utils/expiry.ts` (`effectiveExpiry` / `isExpired`) +
      unit tests; `transaction.service.getExpiringQuotes` now uses it.
- [x] **Bug fix:** removed `eq(quote.is_expired, false)` from `findExpiringQuotes` — the stale flag
      was hiding legitimately-expiring quotes. Locked by a new integration test.

**Deferred — DO NOT drop the column yet: the v1 legacy layer still reads/writes it**
(`server/services/newQuote.service.ts:464-466`, `server/services/expiry.service.ts`,
`server/repositories/transaction.repository.ts:655`). Dropping it from `shared/schema.ts` breaks
v1's build. When v1 is retired, do in one PR:
- [ ] Delete v2 dead writer: `markStaleAsExpired` in `quote.repository.ts` + `enquiry.repository.ts`,
      and its call in `enquiry/expiry.service.ts` (keep `activateDueFutureDeals` + the cron).
- [ ] Remove `is_expired` from `shared/schema.ts` (quote + enquiry_table) and `quote.types.ts`;
      drop the two writes in `quote.service.ts` (`:377`, `:413`); generate a Drizzle drop-column migration.
- [ ] Remove the v1 references above.

## Explicitly out of scope (for now)

- Third-party integrations driven by network calls (`facebook`, `email` IMAP/SMTP,
  `ai-ask`, `destination-guru`, `openai`) — wrap in adapters and test the adapter
  boundary rather than the live service.
- PDF generation (`wallet/invoice-pdf.service.ts`) — snapshot-test inputs, not the binary.
- Client-side React — separate effort; add jsdom + Testing Library when prioritized.

---

### Suggested order

1. Finish Tier 1 `booking.service` (convert/update/delete) — most money-sensitive code.
2. Add Tier 2 scope tests — highest security risk.
3. Sweep Tier 3 validators — fast wins, big coverage jump.
4. Stand up the Tier 4 DB harness, then backfill the riskiest repositories.
