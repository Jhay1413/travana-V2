# Tina's Travel VIP Club — Referral System Implementation Plan

> AI Context Document | Developer Reference

---

## 1. Project Overview

**Product:** Tina's Travel VIP Club Referral System  
**Purpose:** A loyalty and referral program that rewards existing travel clients for referring new customers. Clients earn commission-based rewards that scale with the number of successful referrals made.

---

## 2. System Goals

- Automatically enroll clients into the VIP program after a booking is made
- Track referrals from initial mention through to confirmed payout
- Reward referring clients based on a tiered commission structure
- Provide a self-service client portal for transparency on earnings and history
- Automate key lifecycle events (enrollment, status changes, payout triggers, tier upgrades)

---

## 3. Referral Program Flow

The referral lifecycle follows 5 sequential steps:

| Step | Stage | Description |
|---|---|---|
| 1 | Client Booked Trip | Client completes a travel booking with Tina's Travel |
| 2 | Client Refers Friend | Client tells their friend to mention their name when booking |
| 3 | Friend Books Holiday | Agent asks "Who referred you?" and logs the referrer |
| 4 | Track & Wait 8 Weeks | Referral is marked as **Pending**; system waits 8 weeks before travel |
| 5 | Payout & Rewards | 25% commission reward is triggered and paid out |

> **Note:** There is a feedback loop between Step 2 and Step 4 — the same client can refer multiple friends over time.

---

## 4. Core Features

### 4.1 VIP Enrollment

- Clients are **automatically enrolled** into the VIP Club upon completing a booking
- No manual opt-in required

### 4.2 Referral Tracking

- Log referred friend's name and contact details at time of booking
- Referral status lifecycle:
  - `Pending` → `In Wallet`
- Status transitions on the 8-week pre-travel trigger

### 4.3 Payout Process

- Payout is triggered **8 weeks before the referred friend's travel date**
- Two payout options available to the referring client:
  - **Bank Transfer**
  - **Booking Credit**

### 4.4 Client Portal

The client-facing portal must display:

- Pending Referrals (friends referred but not yet paid out)
- Referral Earnings (total earned to date)
- Payout History (past transactions)

---

## 5. Tier Levels & Rewards

| Tier | Referral Count | Rewards |
|---|---|---|
| **Standard VIP** | 1–2 referrals | 25% Commission Reward |
| **Gold Member** | 3–4 referrals | Bonus £25 Credit + Priority Offers |
| **Elite Member** | 5+ referrals | £50 Extra Credit + VIP Perks |

> Tier level is based on cumulative successful referrals per client.

---

## 6. Key Automations

The following automated processes must be implemented:

1. **Auto-Enroll on Booking** — Enroll client into VIP Club immediately after a booking is confirmed
2. **8-Week Pre-Travel Alert** — Trigger a payout alert/task 8 weeks before the referred friend's travel date
3. **Status Transition** — Move referral record from `Pending` → `In Wallet` at the 8-week mark
4. **Tier Upgrade Notification** — Send a notification to the client when they reach a new tier (Gold or Elite)

---

## 7. Data Model (Suggested)

### Client Record

```
client_id         UUID
name              string
email             string
phone             string
vip_tier          enum: standard | gold | elite
total_referrals   integer
referred_by       UUID (FK → Client, nullable — null if walk-in/direct booking)
enrolled_at       datetime
```

### Referral Record

```
referral_id       UUID
referrer_id       UUID (FK → Client)
referred_name     string
referred_email    string
booking_id        UUID (FK → Booking)
status            enum: pending | in_wallet | paid
travel_date       date
payout_trigger    date  (travel_date - 56 days)
payout_type       enum: bank_transfer | booking_credit
created_at        datetime
paid_at           datetime (nullable)
```

### Payout Record

```
payout_id         UUID
referral_id       UUID (FK → Referral)
client_id         UUID (FK → Client)
amount            decimal
method            enum: bank_transfer | booking_credit
status            enum: pending | processed
processed_at      datetime
```

---

## 8. Business Rules

- A referral is only valid if the **referred friend mentions the referrer's name** at booking
- Payouts are calculated as **25% of the referring client's original commission value**
- Tier level upgrades are **cumulative** — once Gold/Elite is reached, it persists
- Payout is only released **8 weeks before travel**, not at time of referral
- A client must have an active booking themselves to be enrolled in the VIP Club
- **Any client who completes a booking is automatically stored in the database and enrolled in the VIP Club** — this includes clients who were originally referred by someone else
- A previously referred client **can refer others** once they have their own booking on record, making the referral chain potentially multi-generational
- There is no restriction on how many levels deep a referral chain can go (e.g., A refers B, B books and then refers C, C books and refers D, etc.)
- Each referral relationship is tracked independently — a client earns rewards for each person they directly refer, regardless of who originally referred them

---

## 9. Notifications Summary

| Trigger Event | Recipient | Notification Type |
|---|---|---|
| VIP enrollment | Client | Welcome email / SMS |
| New referral logged | Client | Confirmation email |
| 8 weeks pre-travel | Agent + Client | Payout trigger alert |
| Payout processed | Client | Payout confirmation |
| Tier upgrade | Client | Tier upgrade email |

---

## 10. Out of Scope (v1)

- Multi-currency support (GBP assumed)
- Referral links / unique codes (verbal mention only in v1)
- Integration with third-party payment processors (to be scoped separately)
- Public referral leaderboard
- Tracking rewards across multi-level referral chains (only direct referrals earn rewards)

---

## 11. Open Questions

- [ ] What is the exact commission base for the 25% calculation? (Trip total? Agent fee?) - total comm (- Minus) 10% then 25% of the balance of the commission - We get charged 10% by Hays so we need to minus from the commission we are paying on 

- [ ] What happens if a trip is cancelled after a referral is logged? Is the referral voided?- Cancellation means lost deal and no commsission 
- [ ] Is there a cap on the number of referrals per client per year? - No cap on referrals - More is better
- [ ] Who manages the payout approval — agent manually, or fully automated? -  Admin manages the payouts manually
- [ ] Should the system surface a referred client's referral chain history (i.e., who originally referred them)? - Yes full history
