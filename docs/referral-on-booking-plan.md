# Referral Not Recorded on Booking — Fix Plan

> **Status (2026-06-22):** Backend implemented — schema + migration
> `0013_early_skrulls.sql`, dynamic per-referrer rate, `ensureReferralForBooking`
> (dedupe + rate), all three booking paths wired, dead pending-referral code
> removed, tests updated/added (93 passing). Frontend display fixed — booking-
> creating mutations (`useConvertToBooking`, `useCreateTransaction`) now invalidate
> `referralKeys.all`, so a referral created at booking refreshes in the referrer's
> VIP tab without a manual reload. `commissionRate` surfaced end-to-end —
> read-queries (`findAll`, `findByIdWithOrg`, `getVipOverview`) select it, client
> types (`AdminReferral`, `VipTransactionRow`, `PortalReferral`) include it, and it
> renders in the admin VIP pending-commissions list + the portal referral card.
> **Remaining (optional):** booking-flow UX to set referrer before booking; run the
> migration against the DB (user handling).

**Bug:** After a referred customer's booking is created, no referral information
appears — no referral row, no commission/payout for the referrer.

**Design (confirmed):** there are **no upfront/"pending" referrals**. The agent
records who referred a client **manually** on the **client detail page → referred
section** (which sets `clientTable.referredByClientId`). When that client has a
booking, the referrer earns a commission. The system should generate the referral
+ payout from that.

---

## How it actually works today

The `referral` row is **only ever created at the booking moment**, and only when
the client already has `referredByClientId` set:

- [`booking.service.ts:371`](../server/v2/modules/booking/booking.service.ts#L371) (convertQuoteToBooking)
- [`booking.service.ts:438`](../server/v2/modules/booking/booking.service.ts#L438) (createBooking)
- [`transaction.service.ts:473`](../server/v2/modules/transaction/transaction.service.ts#L473) (createTransactionWithBooking)

Each does: `client = findById(txn.client_id)` → `if (client?.referredByClientId)
createReferral({...})`. (`findById` selects all columns, so the gate reads
`referredByClientId` correctly.)

The agent sets `referredByClientId` on the client detail page
([`client/src/pages/client/index.tsx:274`](../client/src/pages/client/index.tsx#L274)),
which calls the **client update** endpoint — and **client update does not create a
referral** (only the booking paths and the standalone
[`referral.controller.ts:39`](../server/v2/modules/referral/referral.controller.ts#L39)
endpoint call `createReferral`).

---

## The rule (confirmed)

**Commission is earned only by bookings created while the referrer link already
exists.** So:

- Booking created **with** `referredByClientId` set → referrer earns commission
  (a referral is generated).
- Booking created **without** a referrer link → **stays as-is, no commission.**
  Setting "referred by" *later* does **not** retroactively create a referral for
  that earlier booking.

This means the existing **create-at-booking** gate
(`if (client?.referredByClientId) createReferral(...)`) is the **correct
mechanism** — there is **no retroactive / client-update trigger** (the approach in
the earlier draft is dropped). The agent must link the referrer **before** the
booking is created for commission to apply.

### So what is actually broken?

✅ **Confirmed:** the referrer **must be linked before the booking** for the referrer
to earn commission on it. Linking after the fact is intentionally a no-op. So the
original "no referral information" reports are explained by the referrer not being
set before the booking — **working as intended**, not a create defect.

Given the rule, the remaining concrete work is:

1. **Dynamic rate** — today the 25% is hardcoded; it must be per-referrer.
2. **Dead code** — remove the abandoned pending-referral mechanism (below).
3. **Display** — verify referrals created at booking actually surface in the UI
   (client detail "referred section" / referral dashboard).
4. **Workflow/UX (optional)** — since the link must precede the booking, consider
   surfacing the referrer on the booking flow (or warning if a referred-looking
   client has no link) so agents don't miss the window.

---

## Dead code to remove

The repo contains an abandoned "pending referral / link later" mechanism that does
**not** match this design and is never wired in. Remove it to avoid confusion:

- [`vipEnrollmentService.handleReferredClientBooked`](../server/v2/modules/referral/vip-enrollment.service.ts#L23) — no callers.
- `referralRepository.findOldestPendingUnlinkedByReferrer` and `linkReferredClient`
  — only used by the above.
- Keep `vipEnrollmentService.enrollClient` / `recalculateTier` (VIP, still used).

Also **review** whether the standalone `POST` referral endpoint
([`referral.controller.ts:39`](../server/v2/modules/referral/referral.controller.ts#L39))
and the `referredName/referredEmail/referredPhone` create inputs are still needed,
given referrals are now only system-generated from a booking + `referredByClientId`.

---

## Commission & payout rule

When a referred client books, the **referrer earns a percentage of the deal's total
commission**. The percentage is **per-referrer** (default **25%**, e.g. **30%** for
some). The **10% Hays deduction stays**, applied before the referrer's percentage.

- **Commission base** = `booking.package_commission` (passed as `commission`).
- **Referrer rate** = `clientTable.referralCommissionRate` (**new** field, numeric
  %, default `25`). No such field exists today — the 25% is hardcoded in
  [`calculatePayoutAmount`](../server/v2/modules/referral/referral.service.ts#L39).
- **Payout** (update `calculatePayoutAmount(commission, rate)`):

  ```
  afterHays    = total_commission − (total_commission × 0.10)   // 10% Hays (stays)
  payoutAmount = afterHays × (referrerRate / 100)               // e.g. 0.25 or 0.30
  ```

- **Payout timing** =
  [`calculatePayoutTriggerDate`](../server/v2/modules/referral/referral.service.ts#L47):
  `travelDate − 56 days`. At/after that date it auto-approves into the referrer's
  wallet (`autoApproveEligible`).
- **Snapshot** the effective rate onto `referral.commissionRate` (**new** column) at
  creation so historical payouts stay stable if the referrer's rate changes later.

---

## End-to-end flow (target)

```
Agent links referrer on client detail page  ──►  client.referredByClientId = A
                          │  (must happen BEFORE the booking)
                          ▼
                 booking is created
                          │
                          ▼
 ensureReferralForBooking(client, booking)
                          │
                          ▼
 referredByClientId set?  ── no ─►  no-op (booking stays as-is, no commission)
        │ yes
        ▼
 dedupe: referral already exists for this transaction?  ── yes ─► no-op
        │ no
        ▼
 createReferral {
   referrerClientId: A, referredClientId: client,
   referredName/email/phone: from client,
   transactionId, commission = booking.package_commission,
   travelDate = booking.travel_date,
   commissionRate = A.referralCommissionRate (def 25),
   payoutTriggerDate = calc(travelDate),
   payoutAmount = (commission × 0.90) × rate/100,
   status: PENDING
 }
```

Referral creation is triggered **only at booking time**. A booking created without
a referrer link earns nothing, and linking later does not change it.

---

## The fix (by layer, per architecture rules)

### 0. `shared/schema.ts`
- Add `clientTable.referralCommissionRate` (numeric %, default `25`).
- Add `referral.commissionRate` (numeric) to snapshot the rate per referral.
- Migration: backfill both to `25`.

### 1. `referral.repository.ts`
- Update `calculatePayoutAmount(commission, rate)` to take the rate (keep 10% Hays).
- Add `findByTransactionId(transactionId)` for the dedupe guard.
- **Remove** `findOldestPendingUnlinkedByReferrer` and `linkReferredClient`.

### 2. `referral.service.ts`
- New shared `ensureReferralForBooking({ client, booking })`:
  - return early if `!client.referredByClientId`;
  - dedupe: skip if a referral already exists for `booking.transaction_id`;
  - resolve the referrer's `referralCommissionRate` (default 25);
  - `createReferral` with commission/travelDate/rate snapshot + derived payout.
- `createReferral` stores `commissionRate` and uses it for `payoutAmount`.

### 3. Booking/transaction services
Replace the three inline `if (referredByClientId) createReferral(...)` blocks with
`ensureReferralForBooking(...)` (best-effort/non-fatal):
- [`booking.service.ts` convertQuoteToBooking](../server/v2/modules/booking/booking.service.ts#L362)
- [`booking.service.ts` createBooking](../server/v2/modules/booking/booking.service.ts#L429)
- [`transaction.service.ts` createTransactionWithBooking](../server/v2/modules/transaction/transaction.service.ts#L468)

### 4. Frontend
The client detail "referred section" already sets `referredByClientId`. Verify a
referral created at booking surfaces in the UI (referred section / referral
dashboard) and shows the referrer's rate / expected payout. Invalidate referral
queries after the relevant mutations.

### 5. Tests
- Update `booking.service.test.ts` referral cases to the `ensureReferralForBooking`
  path + dedupe.
- Add: "booking with referredByClientId set → referral created with correct
  rate/payout", "booking without referrer link → no referral", "rate snapshot +
  payout math", "no duplicate referral per transaction".

---

## Open questions to confirm

1. **Multiple bookings per client.** ✅ Resolved: commission is **per booking
   created while the referrer link exists**. Every such booking earns; bookings
   created before the link earn nothing and are not back-filled.
2. **Dedupe key.** One referral per `transaction_id` (recommended) — matches the
   per-booking rule. Confirm.
3. **Standalone referral endpoint / `referredName` inputs.** Keep for any manual
   case, or remove now that referrals are system-generated at booking? (Review usage.)
4. **Original report triage.** ✅ Resolved: referrer **must be linked before the
   booking** to earn commission; linking after is a no-op (working as intended).
   Remaining check is display only (#3 above).

---

## Suggested phasing

- **Phase 1** — Schema (rate fields + migration); `ensureReferralForBooking` with
  dynamic rate + dedupe; update `calculatePayoutAmount`.
- **Phase 2** — Wire the three booking paths to it; remove the dead
  pending-referral code.
- **Phase 3** — Frontend surfacing + tests.
