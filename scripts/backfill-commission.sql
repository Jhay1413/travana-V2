-- ============================================================================
-- Backfill package_commission for existing quotes & bookings to the new rule:
--
--     commission = (sales_price - discount) * operatorPct  +  service_charge
--
--   * discount lowers commission ONLY through the % (it reduces the base),
--   * service charge is added on as a FLAT amount (the % is not applied to it).
--
-- The "overall total" shown in the app is derived at display time
--   (sales_price - discounts + service_charge)
-- so it needs NO data change — only the stored package_commission does.
--
-- HOW TO USE
--   1. Run the PREVIEW selects (Section 0) to eyeball old vs new values.
--   2. Run Section 1 (recommended) — recomputes from the tour operator's %.
--   3. (Optional) Section 2 covers rows with no operator / no % set, by
--      reverse-engineering the rate that was implied by the existing value.
--
-- Everything is wrapped in a transaction — COMMIT only when happy, else ROLLBACK.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 0 — PREVIEW (read-only). Shows what Section 1 will change.
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  'quote'                                   AS kind,
  q.id,
  q.sales_price,
  q.discounts,
  q.service_charge,
  op.commission_percentage,
  q.package_commission                      AS commission_old,
  ROUND(
    (COALESCE(q.sales_price, 0) - COALESCE(q.discounts, 0))
      * (op.commission_percentage / 100.0)
    + COALESCE(q.service_charge, 0)
  , 2)                                      AS commission_new
FROM quote_table q
JOIN tour_operator_table op ON op.id = q.main_tour_operator_id
WHERE q.sales_price IS NOT NULL
  AND op.commission_percentage IS NOT NULL
ORDER BY q.id
LIMIT 100;


-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 1 — RECOMMENDED. Recompute from the operator's commission %.
-- Matches exactly what the app now calculates when you edit a quote/booking.
-- Rows with no main_tour_operator_id or NULL commission_percentage are skipped.
-- ─────────────────────────────────────────────────────────────────────────
BEGIN;

UPDATE quote_table AS q
SET package_commission = ROUND(
      (COALESCE(q.sales_price, 0) - COALESCE(q.discounts, 0))
        * (op.commission_percentage / 100.0)
      + COALESCE(q.service_charge, 0)
    , 2)
FROM tour_operator_table AS op
WHERE q.main_tour_operator_id = op.id
  AND op.commission_percentage IS NOT NULL
  AND q.sales_price IS NOT NULL;

UPDATE booking_table AS b
SET package_commission = ROUND(
      (COALESCE(b.sales_price, 0) - COALESCE(b.discounts, 0))
        * (op.commission_percentage / 100.0)
      + COALESCE(b.service_charge, 0)
    , 2)
FROM tour_operator_table AS op
WHERE b.main_tour_operator_id = op.id
  AND op.commission_percentage IS NOT NULL
  AND b.sales_price IS NOT NULL;

COMMIT;   -- ← change to ROLLBACK; if the numbers look wrong


-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 2 — OPTIONAL. For rows Section 1 could not touch (no operator linked
-- or its % is NULL), re-derive the rate that the OLD value implied and apply
-- the new formula. Only valid for rows whose commission was produced by the
-- OLD formula:  old = sales_price*rate - discount + service_charge.
--
--   implied base   = old_commission + discount - service_charge   ( = price*rate )
--   new_commission = base * (price - discount) / price + service_charge
--
-- Worked example (P=4000, D=100, S=200, old=1300):
--   base = 1300 + 100 - 200 = 1200  →  rate 30%
--   new  = 1200 * (4000-100)/4000 + 200 = 1170 + 200 = 1370  ✓
--
-- Skips rows with sales_price = 0/NULL (no rate can be implied).
-- ─────────────────────────────────────────────────────────────────────────
-- BEGIN;
--
-- UPDATE quote_table AS q
-- SET package_commission = ROUND(
--       (COALESCE(q.package_commission, 0) + COALESCE(q.discounts, 0) - COALESCE(q.service_charge, 0))
--         * (q.sales_price - COALESCE(q.discounts, 0)) / q.sales_price
--       + COALESCE(q.service_charge, 0)
--     , 2)
-- WHERE q.sales_price IS NOT NULL
--   AND q.sales_price <> 0
--   AND (q.main_tour_operator_id IS NULL
--        OR NOT EXISTS (
--          SELECT 1 FROM tour_operator_table op
--          WHERE op.id = q.main_tour_operator_id
--            AND op.commission_percentage IS NOT NULL
--        ));
--
-- UPDATE booking_table AS b
-- SET package_commission = ROUND(
--       (COALESCE(b.package_commission, 0) + COALESCE(b.discounts, 0) - COALESCE(b.service_charge, 0))
--         * (b.sales_price - COALESCE(b.discounts, 0)) / b.sales_price
--       + COALESCE(b.service_charge, 0)
--     , 2)
-- WHERE b.sales_price IS NOT NULL
--   AND b.sales_price <> 0
--   AND (b.main_tour_operator_id IS NULL
--        OR NOT EXISTS (
--          SELECT 1 FROM tour_operator_table op
--          WHERE op.id = b.main_tour_operator_id
--            AND op.commission_percentage IS NOT NULL
--        ));
--
-- COMMIT;   -- ← or ROLLBACK;
