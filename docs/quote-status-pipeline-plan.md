# Quote Status & Pipeline Stage — Refactor Plan

This plan rationalises how "status" is modelled. Today it is spread across three
entities and the pipeline column is reconstructed inline from a tangle of
sub-queries, which is why the "Progress" dropdown feels disconnected from the
board and why values drift.

## Goal

One clear model:

- **Deal stage** lives on the **transaction** (the pipeline's source of truth).
- **Quote progression** lives on each **quote**.
- A deal **follows its primary quote**, so a transaction with many quotes still
  has one unambiguous board position.

---

## Current state (the problem)

Status lives on three entities, and the board is derived from all of them at once:

| Entity | Field | Enum values today |
|---|---|---|
| `transaction` | `status` | `on_enquiry, on_quote, in_play, on_booking` |
| `enquiry_table` | `status` | `NEW_LEAD, ACTIVE, LOST, INACTIVE, EXPIRED` |
| `quote` | `quote_status` | `NEW_LEAD, QUOTE_IN_PROGRESS, QUOTE_CALL, QUOTE_READY, AWAITING_DECISION, REQUOTE, WON, ARCHIVED, LOST, INACTIVE, EXPIRED` |

- The pipeline query reconstructs each column from `transaction.status` **plus**
  "is there a non-LOST active quote" **plus** "is there a booking this month"
  **plus** the enquiry's `is_active` — see
  [`findPipelineByStatus`](../server/v2/modules/transaction/transaction.repository.ts#L416) (lines 416–457).
- The "Progress" dropdown ([`StatusPill.tsx`](../client/src/features/quote/components/StatusPill.tsx#L9))
  writes `quote_status`, but offers `HOT_QUOTE`, which is **not** a valid
  `quote_status_enum` value — a live bug.
- There is **no "primary quote" concept**: `duplicateQuote`
  ([`quote.service.ts:309`](../server/v2/modules/quote/quote.service.ts#L309))
  copies a quote into the same transaction with `isQuoteCopy: true`, but nothing
  marks which quote is primary, and there is no `parent_quote_id` link.

---

## Target model

### Enums

- **`transaction_status_enum`** → `on_enquiry, on_quote, on_booking`
  - **Remove `in_play`.** "In Play" is no longer a deal stage; it becomes a quote
    state (see below). `on_booking` is the won/booked stage.
- **`quote_status_enum`** → `quoted, in_play, lost`
  - Replaces the 11 legacy values. A quote progresses `quoted → in_play`, with
    `lost` as the terminal per-quote outcome.
  - **No `won` on the quote.** "Won" is the deal being booked
    (`transaction.status = on_booking`). The specific quote that converted is
    recorded on the booking (see `booking.quote_id` below) — **not** derived from
    the primary, because a copy/duplicate quote can be the one that converts, not
    just the primary.
- **`enquiry_status_enum`** → unchanged; keeps `LOST` for losing a deal at the
  enquiry stage.

### Primary quote — no new relationship needed

The "primary" quote is **already expressible** via the existing
`quote.isQuoteCopy` flag ([`shared/schema.ts:762`](../shared/schema.ts#L762),
default `false`):

- **Primary** = the quote in the transaction with `isQuoteCopy = false`.
- **Copies/duplicates** = `isQuoteCopy = true` (set by
  [`duplicateQuote`](../server/v2/modules/quote/quote.service.ts#L309)).

So **no `transaction.primary_quote_id` FK** — the primary is derived from
`isQuoteCopy = false`. Invariant: exactly one `isQuoteCopy = false` quote per
transaction; the service must preserve this when reassigning primary.

### New column

- **`booking.quote_id`** — FK → `quote.id`. Records **which quote converted** to
  the booking. May be the primary **or any copy/duplicate**. "Won quote" is read
  from here, independent of which quote is primary.

Open question: do we also need `quote.parent_quote_id` (which primary a duplicate
came from), or is "same transaction" enough to treat all other quotes as the
duplicate pool? Leaning **not needed** — see Open Questions.

---

## Pipeline column derivation (the payoff)

With the primary flag (`isQuoteCopy = false`), each board column is a simple read
— no reconstruction:

| Board column | Rule |
|---|---|
| **Enquiry** | `transaction.status = 'on_enquiry'` and enquiry not `LOST` |
| **Quoted** | `transaction.status = 'on_quote'` AND primary quote `quote_status = 'quoted'` |
| **In Play** | `transaction.status = 'on_quote'` AND primary quote `quote_status = 'in_play'` |
| **Booked** | `transaction.status = 'on_booking'` |

**Lost is derived, not a column:**
- Enquiry-stage lost → `enquiry_table.status = 'LOST'`.
- Quote lost → `quote_status = 'lost'` on that quote.
- A deal is treated as lost when its enquiry is `LOST`, or its primary quote is
  `lost` with no active replacement. Lost deals drop off the active board (and
  can feed a separate "Lost" view/report later).

This lets us delete the tangled `ACTIVE_STATUSES` / `NOT IN (… LOST …)` /
`booking this month` sub-queries from
[`findPipelineByStatus`](../server/v2/modules/transaction/transaction.repository.ts#L416).

---

## Lifecycle & sync rules

The transaction stage and the primary quote status are kept consistent by the
service layer (never written ad-hoc from controllers/UI):

1. **Create enquiry** → `transaction.status = 'on_enquiry'`, `enquiry.status = 'ACTIVE'`.
2. **Create first quote** → it is primary by default (`isQuoteCopy = false`),
   `quote_status = 'quoted'`, `transaction.status = 'on_quote'`.
3. **Advance primary quote** `quoted → in_play` → board moves Quoted → In Play;
   `transaction.status` stays `on_quote`.
4. **Duplicate quote** → new quote in the same transaction, `quote_status = 'quoted'`,
   **not** primary.
5. **Book / convert** → `transaction.status = 'on_booking'`, and the converted
   quote is stamped on `booking.quote_id`. The converted quote may be **any**
   quote in the transaction (primary or a copy), so the won quote is read from
   `booking.quote_id`, not inferred from which quote is primary.

---

## The Lost flow + primary reassignment

Setting a quote to `lost`:

- **Non-primary quote** → set `quote_status = 'lost'`. No deal impact; it simply
  drops out of the duplicate pool.
- **Primary quote (`isQuoteCopy = false`), other (non-lost) quotes exist** →
  **block with HTTP 409.** The service refuses the update because duplicates were
  derived from this primary. The UI catches the 409 and **prompts the user to
  choose a new primary first**, then they retry the lost action on the old quote.
- **Primary quote is the only quote (no replacement)** → allowed; the quote goes
  `lost` and the deal is derived-lost (drops off the active board).

Reassigning primary = flipping the `isQuoteCopy` flags: set the chosen copy to
`isQuoteCopy = false` and the old primary to `isQuoteCopy = true`, in one
transaction, preserving the "exactly one `false` per transaction" invariant.

Enforcement is server-side (single source of truth); the prompt is the only UI
behaviour on 409 — no auto-reassignment.

---

## Backend changes (by layer, per architecture rules)

1. **`shared/schema.ts`**
   - Edit `transaction_status_enum` (remove `in_play`).
   - Replace `quote_status_enum` with `quoted, in_play, lost`.
   - Add `booking.quote_id` (FK → `quote.id`). No `primary_quote_id` — primary is
     the `isQuoteCopy = false` quote (existing column).
2. **Migration** (Drizzle) — see Data Migration below.
3. **`quote.repository.ts`** — simplify
   [`findPipelineByStatus`](../server/v2/modules/transaction/transaction.repository.ts#L416)
   to the derivation table above; add reads for the primary quote's status.
4. **`quote.service.ts`** / **`transaction.service.ts`**
   - Centralise the lifecycle/sync rules (stage ↔ primary quote status).
   - On `createQuote`: set primary + advance transaction stage when it is the
     first quote.
   - On `duplicateQuote`: never primary.
   - New `setPrimaryQuote(transactionId, quoteId)` operation — flips `isQuoteCopy`
     flags (chosen → `false`, previous primary → `true`) atomically.
   - On `updateQuote` setting `lost`: enforce the primary guard → throw
     `AppError(409, …)` when blocked.
5. **`quote.validator.ts`** — restrict `quote_status` to the new enum.
6. **Controllers** — surface the 409; add a route for `setPrimaryQuote`.

## Frontend changes

1. **`StatusPill.tsx`** — options become `quoted, in_play, lost` (remove the
   legacy values and the invalid `HOT_QUOTE`).
2. **Primary-quote UI** — a way to mark/see the primary quote, and a "set primary"
   action.
3. **Lost prompt** — catch the 409 from the lost action and show the
   "choose a new primary first" prompt.
4. **Pipeline board** — labels/filters already use Enquiry / Quoted / In Play /
   Booked ([`pipeline-board.tsx`](../client/src/features/social/components/boards/pipeline-board.tsx#L65));
   verify the In Play column now keys off the derived rule.
5. **Invalidate `transactionKeys.all`** on any status/primary change so the board
   refreshes (consistent with the create-transaction fix).

---

## Data migration

- **`transaction.status`**: rows currently `in_play` → map to `on_quote` (the
  In Play distinction now comes from the primary quote's status).
- **`quote.quote_status`** old → new:
  - `QUOTE_IN_PROGRESS, QUOTE_CALL, QUOTE_READY, NEW_LEAD, REQUOTE` → `quoted`
  - `AWAITING_DECISION` → `in_play`
  - `LOST` → `lost`
  - `WON` → drop the status; ensure those transactions are `on_booking` **and**
    backfill `booking.quote_id` with that won quote (it may be a copy, not the
    transaction's chosen primary)
  - `ARCHIVED, INACTIVE, EXPIRED` → **decision needed** (treat as `lost`?)
- **Primary (`isQuoteCopy`) integrity check**: ensure each transaction has exactly
  one `isQuoteCopy = false` quote. Fix any transaction with zero (promote the most
  recent non-lost quote to `false`) or more than one (keep the most recent, set the
  rest `true`).
- Enum changes in Postgres require care (can't drop an enum value in use): plan
  to create the new enum type and swap, or add/rename then migrate data.

---

## Open questions to confirm before build

1. **`quote.parent_quote_id`** — track duplicate lineage explicitly, or treat all
   other quotes in the transaction as the duplicate pool? (Leaning: not needed.)
2. **`ARCHIVED / INACTIVE / EXPIRED` quotes** — map to `lost` on migration, or do
   they need to survive somewhere?
3. **Sole-primary lost** — confirm: when the primary is the only quote, allow
   `lost` directly (deal becomes derived-lost) rather than 409.
4. **Expiry** — `quote.date_expiry` currently influences the board. Does an
   expired quote stay In Play, or auto-move? (Today expiry is part of the active
   filter; the new model needs an explicit rule.)
5. **Other quotes when one converts** — when a copy is booked
   (`booking.quote_id`), what happens to the remaining quotes in that transaction
   (incl. the old primary)? Auto-mark them `lost`, leave them, or no-op? The deal
   is `on_booking` regardless, so this only affects historical quote records.

---

## Suggested phasing

- **Phase 1** — Schema + migration (enums, `booking.quote_id`, `isQuoteCopy`
  integrity backfill).
- **Phase 2** — Service lifecycle/sync rules + primary-quote operations + 409 guard.
- **Phase 3** — Simplify the pipeline query to the derivation table.
- **Phase 4** — Frontend: StatusPill options, primary UI, 409 prompt, board verify.
- **Phase 5** — Remove dead legacy-status code paths.
