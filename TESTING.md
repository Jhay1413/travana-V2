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

- [ ] `utils/scope.ts` — `getScope`, `hasAnyRole`, primary-vs-union role rules
- [ ] `booking.service` `effectiveOrgId` / `assert*InScope` — platform_admin bypass, org mismatch → 404
- [ ] `modules/organization/organization.service.ts` + `organization-member.service.ts`
- [ ] `modules/user/user.service.ts` + `user-org-roles/user-org-roles.service.ts`
- [ ] `modules/invite/invite.service.ts` — token validity, expiry, role assignment
- [ ] `modules/platform-admin/*` — platform-admin-only guards, credits service
- [ ] `middlewares/auth/*` and `middlewares/validation.middleware.ts`

## Tier 3 — Input validation (cheap, high value)

Zod validators are pure functions — fast to test and they catch a lot of bad input.
For each: assert one valid payload passes and the key invalid cases are rejected.

- [ ] `booking.validator.ts`, `booking-upsell.validator.ts`
- [ ] `quote.validator.ts`, `quote-public.validator.ts`
- [ ] `client.validator.ts`, `neon-client.validator.ts`
- [ ] `referral.validator.ts`, `referral-payout.validator.ts`, `referral-withdrawal.validator.ts`
- [ ] `organization.validator.ts`, `user.validator.ts`, `user-org-roles.validator.ts`, `invite.validator.ts`
- [ ] `branch.validator.ts`, `note.validator.ts`, `email.validator.ts`, `hr.validator.ts`,
      `notification.validator.ts`, `onboarding.validator.ts`, `platform-admin.validator.ts`, `ticket.validator.ts`

## Tier 4 — Repository / integration (DB-backed)

Unit tests mock these away, so the SQL itself is unverified. Stand up a test Postgres
(testcontainers or a disposable schema) and cover the queries that are easy to get wrong.

- [ ] Test harness: spin up throwaway Postgres + run Drizzle migrations
- [ ] `booking.repository` — findWithDetails join shape, scope filters, replace* helpers
- [ ] `quote.repository` — findWithDetails, child-passenger replace
- [ ] Any repository using raw `sql` fragments, aggregation, or multi-table joins
      (`revenue`, `reports`, `dashboard`, `search`, `branch-overview`, `organization-overview`)

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
