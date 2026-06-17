# Testing Plan

What needs to be tested in this project, in priority order. Grounded in the real
`server/v2` module inventory.

## How we test here

- **Runner:** Vitest. `npm test` (one-shot) / `npm run test:watch`.
- **Unit tests** live next to the code as `<feature>.service.test.ts`. They mock
  the layer below (repositories + sibling services) so they hit **no database**
  and assert only that layer's own logic. See `server/v2/modules/booking/booking.service.test.ts`
  as the reference pattern.
- **Integration tests** (DB-backed) are needed for repositories — mocking Drizzle
  proves nothing. These run against a throwaway Postgres. Not set up yet (see Tier 4).
- A trusted scope `{ orgId: null }` short-circuits the in-scope assertions, so unit
  tests can exercise business logic without wiring up full scope checks.
 methods are mocked here — to ac
Legend: `[ ]` todo · `[~]` partial · `[x]` done

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
- [x] `modules/quote/quote.service.ts` (9 tests) — total/per-person price math, create 404 +
      price computation/preservation, update recompute, LOST deactivation, delete 404
- [x] `modules/quote/quote-public.service.ts` (4 tests) — token price math, 0-pax guard, 404s
- [x] `modules/transaction/transaction.service.ts` (9 tests) — get/update/delete 404 guards,
      task reassignment on owner change, expiring-quote classification
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
- [ ] Remaining aggregation repos: `search`, `branch-overview`, `organization-overview`

## Tier 5 — Supporting business logic

Lower blast radius, but still logic worth pinning once Tiers 1–3 are solid.

- [ ] `modules/client/client.service.ts` + `client-file.service.ts`
- [ ] `modules/enquiry/enquiry.service.ts` + `expiry.service.ts`
- [ ] `modules/task/task.service.ts` — completeByEntity used by booking conversion
- [ ] `modules/tag/tag.service.ts`, `modules/note/note.service.ts`, `modules/audit/audit.service.ts`
- [ ] `modules/ticket/*` — reply / attachment / notification flows
- [ ] `modules/notification/*`, `modules/sms/sms.service.ts` — auto-trigger dedupe window
- [ ] `settings/*` — mostly thin CRUD; smoke-test the ones with non-trivial rules
      (`cruise`, `cruise-voyage`, `accommodation`, `deletion-code`)

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
