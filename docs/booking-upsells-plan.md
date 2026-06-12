# Booking Upsells — Implementation Plan

> **Status:** Phase 1 (UI) in progress · **Scope:** Bookings only (not quotes) · **Approach:** UI-first

## Progress at a glance

| Phase | What | Status |
|---|---|---|
| 1 | UI as a section inside the booking form (mock/local form state) | ✅ Built — not yet persisted |
| 2 | Shared contract + API client/hooks; wire into save payload | ✅ Built — endpoints await Phase 3 backend |
| 3 | Backend: `booking_upsell` table + CRUD | ✅ Built — migration generated, not yet applied |
| 4 | Reporting integration (Dashboard + Forwards by `added_at`) | ✅ Built — migration generated, not yet applied |

**Decision change (Phase 1):** the UI is implemented as an **Upsells section inside the existing booking form** (`BookingRHFForm`), mirroring the Extras section. The upsells array travels with the rest of the booking form state.

**Decision change (Phase 1b):** upsells are *additionally* surfaced via a **dedicated dialog** (`BookingUpsellsDialog`) opened from the **"Manage Upsells"** item in the booking detail page's actions (ellipsis) menu ([`booking-standalone.tsx`](../client/src/pages/booking-standalone.tsx)). It reuses `BookingUpsellsSection` over a `upsells`-only RHF form, hydrates from the booking's existing upsells, and saves via the booking `PATCH` (payload `{ upsells }`). The in-form section remains and is now **hydrated when editing** — `buildDefaultValues` maps `bookingData.upsells` and `buildUpdatePayload` maps the form `upsells` back out, via shared `upsellsToFormValues` / `upsellsToPayload` helpers in [`booking-upsell.types.ts`](../client/src/types/booking/booking-upsell.types.ts). (Persistence still depends on the Phase 3 backend accepting the `upsells` key.)

## 1. Goal

Let an agent add **upsells** (extra line items) to a booking *after* it has been created — e.g. the customer adds extra hotel nights a month after booking. The upsell's commission/profit must be recognised in the **month it was added** (`added_at`), **not** the booking's creation month or travel month.

Concretely:
- The original booking's profit (creation-month / travel-month) stays **unchanged**.
- The upsell commission is **excluded** from the booking's creation-date profit.
- The upsell commission is **included** in profit reports for the month the upsell was added.
- Upsells are **flexible** — one mechanism handles many types (extra nights, transfer, lounge, parking, fee, other).

## 2. Constraints & principles

- **Bookings only.** Do **not** touch quote schemas, quote components, or `quote_*` tables. This feature lives on the booking side exclusively.
- **Start with the UI** so we can visualise the flow before any DB/backend work. Phase 1 uses mock/local data — no backend dependency.
- **Follow existing patterns** — shadcn/ui + Tailwind, react-hook-form + zod, TanStack Query + Axios, the `ExtraCard` line-item layout, and the Route → Controller → Service → Repository backend rule from `CLAUDE.md`.
- **Don't modify unrelated code.** No refactors outside the upsells feature. Existing commission/report logic is only *extended*, never rewritten.

## 3. Key technical insight (why a dedicated table later)

The Forwards report sums the **entire** booking commission via `totalBookingCommissionExpr()` ([`server/v2/utils/commission-sql.ts:31-44`](../server/v2/utils/commission-sql.ts#L31-L44)) and attributes it to the **travel month** (`travel_date + 56 days`, [`server/v2/modules/revenue/revenue.repository.ts:20-33`](../server/v2/modules/revenue/revenue.repository.ts#L20-L33)). The Dashboard attributes `package_commission` to **`date_created`** ([`server/repositories/dashboard.repository.ts:190-215`](../server/repositories/dashboard.repository.ts#L190-L215)).

If an upsell's commission lived inside the existing `booking_*` line-item tables, it would be pulled into `totalBookingCommissionExpr()` automatically and land in the **wrong month**. Therefore (in the backend phase) upsells get a **separate `booking_upsell` table** that the existing commission expression does **not** touch, attributed independently by `added_at`.

> The UI phases below are built so this backend decision is invisible to them — the UI only knows about an "upsells" list with `{ type, description, quantity, cost, commission, addedAt }`.

---

## 4. Phased delivery

### Phase 1 — UI as a booking-form section ✅ (built, not yet persisted)

Goal: see and click the full upsell experience, with no backend.

**As-built** — upsells are an **Upsells section inside the booking form** (`BookingRHFForm`), mirroring the existing **Extras** section. It is **not** a card/dialog on the booking page. (An earlier card+dialog draft — `BookingUpsellsCard` / `BookingUpsellDialog` — was removed in favour of this.) The booking form is the one rendered by the Edit Booking dialog ([`booking-edit-dialog.tsx`](../client/src/components/booking/booking-edit-dialog.tsx)).

**Where it lives** — [`client/src/components/booking/booking-rhf-form.tsx`](../client/src/components/booking/booking-rhf-form.tsx): `<BookingUpsellsSection>` is rendered directly **after** the Extras section and before Pricing, using the same `control as unknown as Control<UpsellsFormValues>` cast pattern as Extras.

**Component** (mirrors [`client/src/components/quote/quote-extras-section.tsx`](../client/src/components/quote/quote-extras-section.tsx)):

| Component | File | Purpose |
|---|---|---|
| `BookingUpsellsSection` | `client/src/components/booking/BookingUpsellsSection.tsx` | `useFieldArray`-driven form section: section header + count chip, "Add Upsell" button, empty state, and removable rows. Each row: type select, description, quantity, cost, commission, "Date added". |

**Form state (not mock card state):** the upsells live in the booking form via a new `upsells` array on `bookingFormSchema` + `defaultBookingFormValues` ([`booking-form.types.ts`](../client/src/types/booking/booking-form.types.ts)). Add/remove/edit all work through react-hook-form. No API calls yet.

**Upsell row fields** (flexible across types):
- `upsellType` — select: `EXTRA_NIGHTS` · `TRANSFER` · `LOUNGE` · `PARKING` · `FEE` · `OTHER`
- `description` — text
- `quantity` — number (e.g. number of nights), default 1
- `cost` — number (£)
- `commission` — number (£) — **manual entry** (matches existing line items)
- `addedAt` — date, defaults to today; editable so an admin can correct the recognition month

**Shared constants:** `client/src/types/booking/booking-upsell.types.ts` holds the type options/icons (`UPSELL_TYPE_OPTIONS`, `upsellTypeMeta`, `emptyUpsellItem`); the form *shape* lives in `booking-form.types.ts` so it travels with the rest of the form.

**Not done in Phase 1 (intentional):**
- Not wired into the save payload — `buildUpdatePayload` in [`booking-edit-dialog.tsx`](../client/src/components/booking/booking-edit-dialog.tsx) does **not** yet map `upsells`, so edits render/are editable but don't persist. Persistence lands in Phase 2/3.
- No per-month subtotal display yet (the earlier card showed one); revisit once persisted, likely surfaced in `BookingCostingsCard` without disturbing its existing totals.
- Section currently renders whenever the form is used (incl. create); gating to "after booking exists" is a Phase 3 backend concern.

### Phase 2 — Shared contract & API client wiring ✅ (built; endpoints await Phase 3 backend)

**As-built:** the contract lives in [`booking-upsell.types.ts`](../client/src/types/booking/booking-upsell.types.ts) as the single source of truth — `upsellPayloadSchema` (zod, snake_case wire shape, numerics as strings to match Drizzle `numeric`), `UpsellPayload`, and `UpsellRecord`. `upsellsToPayload` is now typed to return `UpsellPayload[]`. The Phase 3 backend validator mirrors `upsellPayloadSchema`. API methods + hooks are wired but call endpoints that don't exist until Phase 3, so they are not yet consumed by any component. The form's `upsells` array still persists via the booking `PATCH` (Phase 1b) until Phase 3 swaps it to the dedicated endpoints.

- Define the request/response shape once and reuse on both sides (the repo already shares via `@shared/schema`).
- Add API methods in [`client/src/api/endpoints/booking.api.ts`](../client/src/api/endpoints/booking.api.ts) following the existing `getById` / `update` pattern:
  - `listUpsells(bookingId)` → `GET /api/v2/bookings/:bookingId/upsells`
  - `createUpsell(bookingId, body)` → `POST /api/v2/bookings/:bookingId/upsells`
  - `updateUpsell(upsellId, body)` → `PATCH /api/v2/upsells/:id`
  - `removeUpsell(upsellId)` → `DELETE /api/v2/upsells/:id` (soft delete)
- Add hooks `client/src/hooks/queries/use-booking-upsell-queries.ts` and `client/src/hooks/mutations/use-booking-upsell-mutations.ts`, mirroring [`use-booking-queries.ts`](../client/src/hooks/queries/use-booking-queries.ts) / [`use-booking-mutations.ts`](../client/src/hooks/mutations/use-booking-mutations.ts). Invalidate the booking detail + upsell list query keys on success.
- Wire the form `upsells` array into save: map it in `buildUpdatePayload` ([`booking-edit-dialog.tsx`](../client/src/components/booking/booking-edit-dialog.tsx)) and hydrate existing upsells in `buildDefaultValues`. Decide whether upsells persist via the existing booking PATCH or their own endpoints (the latter keeps `added_at` immutable per-row and avoids re-stamping on every booking edit — preferred).

### Phase 3 — Backend: `booking_upsell` table + CRUD ✅ (built; migration generated, not yet applied)

**As-built:** the full Route → Controller → Service → Repository stack plus the `booking_upsell` table, the `totalUpsellCommissionExpr()` helper, and hydration of `upsells` into the booking detail read. Endpoints are live:
- `GET /api/v2/bookings/:bookingId/upsells` · `POST /api/v2/bookings/:bookingId/upsells` (booking-scoped, in `booking.routes.ts`)
- `PATCH /api/v2/upsells/:id` · `DELETE /api/v2/upsells/:id` (soft delete; top-level `booking-upsell.routes.ts`, mounted at `/upsells`)

Scope/ownership is enforced via `bookingRepository.bookingInScope`; `added_by` comes from `scope.userId`; `added_at` defaults to `now()` and is only changed when explicitly sent (kept immutable on edits otherwise). The booking `PATCH` still **ignores** the `upsells` key (it uses a `directFields` allowlist), so the Phase 1b in-form section currently round-trips on read (hydrated from the new `upsells` field) but does **not** persist writes — that's the remaining frontend swap (see below).

> **Not yet applied:** the migration `migrations/0006_salty_zaran.sql` is generated but not run. Apply with `npm run db:migrate` (or `db:push`) against the target DB before the endpoints will work.
>
> **Remaining bridge (frontend):** swap `BookingUpsellsDialog` / the in-form section to call the Phase 2 dedicated mutations (`useCreateUpsell` / `useUpdateUpsell` / `useRemoveUpsell`) instead of relying on the booking `PATCH`. Until then the UI shows saved upsells but can't create/edit/delete them.

Follows the `CLAUDE.md` layer order strictly.

- **Schema** — [`shared/schema.ts`](../shared/schema.ts): add `booking_upsell` table (after the `booking_*` line-item tables) + insert/select types:
  ```
  booking_upsell
    id           uuid pk
    booking_id   uuid → booking.id (onDelete cascade)
    upsell_type  varchar            -- EXTRA_NIGHTS | TRANSFER | LOUNGE | PARKING | FEE | OTHER
    description  varchar
    quantity     integer default 1
    cost         numeric(10,2)
    commission   numeric(10,2)      -- manual; the profit recognised
    sales_price  numeric(10,2)      -- optional, customer-facing
    added_at     timestamptz default now()   -- recognition date (the month it lands in)
    added_by     text → user.id
    is_active    boolean default true        -- soft delete
    created_at   timestamptz default now()
    updated_at   timestamptz default now()
  ```
- **Migration** — Drizzle migration to create the table (`added_at` defaults to `now()`).
- **Repository** — `server/v2/modules/booking/booking-upsell.repository.ts`: `create`, `update`, `softDelete` (`is_active = false`), `findByBooking`, plus month-range aggregation on `added_at`. Drizzle only; no business logic.
- **Service** — `server/v2/modules/booking/booking-upsell.service.ts`: validate parent booking is active, validate `upsell_type`, set `added_at` / `added_by`, throw `AppError`. Commission taken from the request (manual).
- **Controller** — `booking-upsell.controller.ts`: read params/body, call service, format response + status.
- **Routes** — `booking-upsell.routes.ts`: `POST /bookings/:bookingId/upsells`, `GET /bookings/:bookingId/upsells`, `PATCH /upsells/:id`, `DELETE /upsells/:id`. Zod validation middleware before the controller.
- **Commission SQL** — [`server/v2/utils/commission-sql.ts`](../server/v2/utils/commission-sql.ts): **leave `totalBookingCommissionExpr()` untouched**; add `totalUpsellCommissionExpr(bookingIdRef, range?)` that sums `booking_upsell.commission` where `is_active`, optionally filtered by `added_at` month range.

### Phase 4 — Reporting integration (added-month recognition) ✅ (built; migration generated, not yet applied)

**As-built:**
- **Dashboard** ([dashboard.repository.ts](../server/repositories/dashboard.repository.ts)) — `getMyProfit` now adds `SUM(booking_upsell.commission)` for active upsells with `added_at` in the current month, agent-scoped via `transaction.user_id`, independent of the parent booking's creation date. Recomputes live → auto-corrects on edit/soft-delete.
- **Forwards** ([revenue.repository.ts](../server/v2/modules/revenue/revenue.repository.ts)) — new `getUpsellsForCalendarMonth(year, month, orgId)` sums upsell commission + ids for the **plain calendar month** (no 56-day offset). Wired into `getForwardsForMonth` (live total), `getForwardsWithIdsForMonth` (total + `upsellIds`), and persisted via `upsertForwardsReportMonth` into the new `forwards_report.upsell_ids` column. `dealCount` stays bookings-only.
- **Regeneration** — followed the **existing pattern**: the live Revenue dashboard views (`getMonthForwards`) include upsells automatically; the precomputed `forwards_report` rows absorb them on the **existing manual** `POST /api/v2/revenue/forwards/regenerate` action (`regenerateForwardsReport`), exactly as booking edits already do. No auto-regeneration hook was added to the upsell mutation flow (would be inconsistent with booking-edit behaviour and couple revenue to the booking module).

> **Resolved open items (§6):** (1) mixed date semantics — implemented as specified (upsells by plain `added_at`, bookings keep `travel_date + 56d`). (2) regeneration trigger — **manual** (existing admin action), per the established codebase pattern. (3) closed-month edits — **no month-lock/close concept exists** in the codebase, so past-month upsell edits are allowed, same as booking edits.
>
> **Not yet applied:** migration `migrations/0007_loving_black_bolt.sql` (adds `forwards_report.upsell_ids`) is generated but not run — apply alongside `0006`.
>
> **Drill-down reconciliation (done):** the Forwards month drill-down (`getMonthBookings`) now lists upsells as their own rows alongside bookings, tagged with an **"Upsell · {type}"** label in [admin-financials.tsx](../client/src/components/admin/admin-financials.tsx), so the rows reconcile with the header total. Upsell rows are sourced via `getUpsellDetailsForCalendarMonth` (by `added_at`), carry `isUpsell`/`upsellLabel`, and use a unique row `id` (upsellId) since a booking and its upsell can share a `bookingId` in the same month. `deals` count stays bookings-only.

#### Original Phase 4 spec

- **Dashboard** ([`dashboard.repository.ts:190-215`](../server/repositories/dashboard.repository.ts#L190-L215)): `profitThisMonth` = existing booking figure **+** `SUM(booking_upsell.commission)` for upsells with `added_at` in the current month (joined to the agent via `transaction.user_id`), regardless of the parent booking's creation date.
- **Forwards report** ([`revenue.repository.ts`](../server/v2/modules/revenue/revenue.repository.ts)): for report month `M`, add `SUM(booking_upsell.commission)` where `added_at` falls in **calendar month `M`** (no 56-day offset — upsells recognise on the actual added month). Add an `upsell_ids text[]` column to [`forwards_report`](../shared/schema.ts#L395-L416) mirroring `deal_ids` for auditability/idempotency.
- **Regeneration:** editing/soft-deleting an upsell changes a past month's total. The Dashboard recomputes live (auto-correct); the precomputed Forwards row needs regeneration of the affected month — wire this into the upsell create/edit/delete flow (or rely on the existing manual admin "regenerate" action — to be confirmed).

---

## 5. Decisions confirmed

- Reports affected: **Dashboard "my profit"** *and* **Forwards report**.
- Commission: **manual amount** per upsell.
- Mutability: **soft-delete (`is_active`) + editable**.

## 6. Open items to confirm before Phase 4

1. **Forwards date semantics:** upsells attribute by plain `added_at` calendar month while original bookings keep the `travel_date + 56d` window — confirm this mixed semantics is intended (assumed yes).
2. **Forwards regeneration trigger:** auto-regenerate the affected month on upsell create/edit/delete, or rely on the existing manual admin regenerate action?
3. **Closed-month edits:** if a month-close/lock concept exists, should edits to an upsell's `added_at` in a closed month be blocked?

## 7. File map (new vs. touched)

**Done — Phase 1 (frontend):**
- ✅ `client/src/components/booking/BookingUpsellsSection.tsx` — the `useFieldArray` form section
- ✅ `client/src/types/booking/booking-upsell.types.ts` — type options/icons + helpers (`UPSELL_TYPE_OPTIONS`, `upsellTypeMeta`, `emptyUpsellItem`)
- ✅ `client/src/types/booking/booking-form.types.ts` — added `upsells` to `bookingFormSchema` + `defaultBookingFormValues`; `UpsellsFormValues` / `UpsellItemValue` types
- ✅ `client/src/types/booking/index.ts` — re-export upsell types
- ✅ `client/src/components/booking/booking-rhf-form.tsx` — render `<BookingUpsellsSection>` after Extras
- ✅ `client/src/components/booking/BookingUpsellsDialog.tsx` — dedicated dialog (opened from the booking detail actions menu) wrapping `BookingUpsellsSection`
- ✅ `client/src/types/booking/booking-upsell.types.ts` — added shared `upsellsToFormValues` / `upsellToFormValue` / `upsellsToPayload` mapping helpers
- ✅ `client/src/components/booking/booking-edit-dialog.tsx` — hydrate `upsells` in `buildDefaultValues`; map `upsells` in `buildUpdatePayload`
- ✅ `client/src/pages/booking-standalone.tsx` — "Manage Upsells" actions-menu item + `<BookingUpsellsDialog>`

**Done — Phase 2 (frontend):**
- ✅ `client/src/types/booking/booking-upsell.types.ts` — added `upsellPayloadSchema` + `UpsellPayload` / `UpsellRecord` contract; typed `upsellsToPayload` → `UpsellPayload[]`
- ✅ `client/src/api/endpoints/booking.api.ts` — added `listUpsells` / `createUpsell` / `updateUpsell` / `removeUpsell`
- ✅ `client/src/hooks/queries/use-booking-upsell-queries.ts` — `useBookingUpsells` + `bookingUpsellKeys`
- ✅ `client/src/hooks/mutations/use-booking-upsell-mutations.ts` — `useCreateUpsell` / `useUpdateUpsell` / `useRemoveUpsell` (invalidate upsell list + booking detail + dashboard)
- ✅ `client/src/hooks/queries/index.ts` · `client/src/hooks/mutations/index.ts` — barrel exports

**Done — Phase 3 (backend):**
- ✅ `shared/schema.ts` — `booking_upsell` table + `BookingUpsell` / `InsertBookingUpsell` types
- ✅ `migrations/0006_salty_zaran.sql` — Drizzle migration (generated, not yet applied)
- ✅ `server/v2/modules/booking/booking-upsell.repository.ts` — `findByBooking` / `findById` / `create` / `update` / `softDelete` / `sumCommissionByAddedRange`
- ✅ `server/v2/modules/booking/booking-upsell.service.ts` — scope + active-booking validation, type guard, `added_at`/`added_by` stamping
- ✅ `server/v2/modules/booking/booking-upsell.controller.ts` — `list` / `create` / `update` / `remove`
- ✅ `server/v2/modules/booking/booking-upsell.validator.ts` — zod validators mirroring the client contract
- ✅ `server/v2/modules/booking/booking-upsell.routes.ts` — top-level `/upsells/:id` PATCH+DELETE
- ✅ `server/v2/modules/booking/booking.routes.ts` — booking-scoped `GET`/`POST /:bookingId/upsells`
- ✅ `server/v2/routes/index.ts` — mount `/upsells`
- ✅ `server/v2/utils/commission-sql.ts` — `totalUpsellCommissionExpr()` (booking expr untouched)
- ✅ `server/v2/modules/booking/booking.repository.ts` — hydrate `upsells` into `findWithDetails`

**Done — Phase 4 (backend reporting):**
- ✅ `shared/schema.ts` — added `forwards_report.upsell_ids text[]`
- ✅ `migrations/0007_loving_black_bolt.sql` — migration (generated, not yet applied)
- ✅ `server/repositories/dashboard.repository.ts` — upsell term in `getMyProfit` (agent-scoped, by `added_at`)
- ✅ `server/v2/modules/revenue/revenue.repository.ts` — `getUpsellsForCalendarMonth` + wired into forwards total/ids + `upsert` persists `upsell_ids`
- ✅ `server/v2/modules/revenue/revenue.service.ts` — pass `upsellIds` through `regenerateForwardsReport`
