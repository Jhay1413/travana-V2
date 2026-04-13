# Wallet Credit at Booking — Integration Plan

## Concept Overview

Each client has a **referral wallet balance** = sum of `payoutAmount` for all referrals with `referralStatus = IN_WALLET` that don't already have a pending withdrawal.

This balance becomes spendable credit at checkout. A client can use it in full, partially, or not at all when making a booking.

**Split payment example:**
- Booking price: £200
- Wallet credit: £100
- Client pays: £100 credit + £100 cash

---

## Database Changes Needed

### 1. Add to `booking_table`:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `credit_applied` | `numeric` | `0` | Amount of wallet credit used toward this booking |
| `credit_status` | enum | `none` | Whether credit has been confirmed by admin |

**`credit_status` enum values:**
- `none` — no credit used
- `pending_approval` — credit reserved, awaiting admin confirmation
- `applied` — credit confirmed and referrals marked PAID
- `rejected` — admin rejected, referrals returned to IN_WALLET

### 2. No changes needed to `referral_withdrawal`

The existing `method: booking_credit` + `booking_id` FK already supports this. These records will be auto-created when a booking is placed with credit.

---

## The Full Flow

### Step 1 — Client Reaches Checkout
- Portal fetches available wallet balance via existing API
- If balance > 0, show a **"Use my £X referral credit"** toggle
- Client can enter how much to apply — capped at `min(balance, booking_price)`
- UI shows the split: **£X credit + £Y remaining to pay**

### Step 2 — Booking Created (Backend)
- Booking saved as normal with:
  - `credit_applied = X`
  - `credit_status = pending_approval`
- For each `IN_WALLET` referral being consumed (**oldest first**, up to the credit amount):
  - Auto-create a `referral_withdrawal` record:
    - `method: booking_credit`
    - `booking_id: newBookingId`
    - `status: pending`
  - Referral stays `IN_WALLET` until admin confirms

### Step 3 — Admin Reviews (Withdrawals Tab)
- Pending booking-credit withdrawals appear in the existing Admin Withdrawals tab
- Admin clicks **"Confirm credit"** → existing `ProcessWithdrawalDialog` is used
- On confirmation:
  - Each consumed referral → `PAID`
  - Booking `credit_status` → `applied`

### Step 4 — If Admin Rejects
- Each consumed referral reverts to `IN_WALLET`
- Booking `credit_applied` resets to `0`, `credit_status` → `none`
- Client is notified the credit wasn't applied

---

## Split Payment Logic

| Scenario | Behaviour |
|---|---|
| Credit ≥ booking price | Full coverage — `credit_applied = booking_price`, no cash |
| Credit < booking price | Partial — `credit_applied = balance`, cash = `booking_price - balance` |
| Client skips credit | Normal booking flow, `credit_applied = 0` |

**Referral consumption order:** oldest `createdAt` first — predictable and auditable.

---

## What Already Exists vs What Needs Building

| Item | Status |
|---|---|
| Wallet balance calculation | ✅ Already built |
| `referral_withdrawal` with `booking_id` FK | ✅ Already built |
| Admin processes booking credit withdrawal | ✅ Already built |
| `credit_applied` + `credit_status` on booking | ❌ New DB columns |
| Credit toggle UI on checkout | ❌ New portal UI component |
| Auto-create withdrawal records on booking | ❌ New service logic |
| Revert referrals on credit rejection | ❌ New service logic |
| Client notification if credit rejected | ❌ New notification |

---

## Key Decisions Before Building

### 1. Auto-approve or admin-approve?
- **Auto-approve:** Simpler. Credit balance is already validated server-side before booking. Referrals go straight to `PAID` at booking time.
- **Admin-approve:** Keeps audit trail consistent with the rest of the withdrawal system.
- **Recommendation:** Auto-approve, since the balance is verified at the point of booking.

### 2. Partial referral consumption?
- Can a single referral (e.g. worth £150) be split across two bookings (£100 + £50)?
- Complicates the schema significantly — would need a `amount_used` column on the referral.
- **Recommendation:** Keep referrals **atomic** — consume whole referrals only, oldest first. If the credit needed is £100 and the next referral is worth £150, only consume referrals up to the exact amount needed (skip referrals that would overshoot unless it's the only one).

### 3. Where does checkout happen?
- **Client-initiated (portal):** Client creates the booking themselves — frontend sends `credit_amount` in the booking payload.
- **Admin-initiated:** Admin creates the booking on behalf of the client — admin UI needs a "apply wallet credit" option.
- This determines which side triggers the credit logic.

---

## Implementation Order (when ready to build)

1. Add `credit_applied` + `credit_status` columns to `booking_table` (migration)
2. Update booking service to accept and process `creditAmount` param
3. Auto-create `referral_withdrawal` records per consumed referral during booking creation
4. Add credit toggle UI to the portal checkout / booking flow
5. Update Admin Withdrawals tab to handle auto-approved credits if going that route
6. Add client notification on credit rejection
