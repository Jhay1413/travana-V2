-- Move commission from per-(operator, holiday-type) to per-operator.
--
-- Why: commission only varies by tour operator in practice. The
-- tour_package_commission_table junction added unnecessary complexity
-- in both the data model and the quote/booking commission recalc logic
-- (which had to refetch on every package_type change).
--
-- Migration rule: each operator gets the MAX of its existing rates
-- across all package types. Chosen so no operator is silently
-- downgraded — see conversation 2026-05-13.
--
-- Idempotent: the column add and the junction-table drop are both guarded,
-- so this is safe to re-run even if `drizzle-kit push` already synced part
-- of the schema (e.g. dropped the junction table before the migration ran).

ALTER TABLE tour_operator_table
  ADD COLUMN IF NOT EXISTS commission_percentage numeric(5, 2);

DO $$
BEGIN
  IF to_regclass('public.tour_package_commission_table') IS NOT NULL THEN
    UPDATE tour_operator_table t
    SET commission_percentage = sub.max_pct
    FROM (
      SELECT tour_operator_id, MAX(percentage_commission) AS max_pct
      FROM tour_package_commission_table
      GROUP BY tour_operator_id
    ) sub
    WHERE t.id = sub.tour_operator_id
      AND t.commission_percentage IS NULL;

    DROP TABLE tour_package_commission_table;
  END IF;
END $$;
