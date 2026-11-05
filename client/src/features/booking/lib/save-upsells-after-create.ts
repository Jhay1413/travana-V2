import type { UpsellItemValue } from "@/features/booking/types";

export type ReconcileUpsellsFn = (
  bookingId: string,
  rows: UpsellItemValue[],
  existing: { id: string }[],
) => Promise<void>;

export type SaveUpsellsResult = { ok: true } | { ok: false; error: unknown };

/**
 * The booking create endpoint ignores upsells, so the create dialog saves them
 * through the upsell endpoints once the new booking id exists. Any `id` on the
 * rows is stripped so a create is never sent as an update. The saves run in
 * parallel, so on failure some rows may already be saved.
 */
export async function saveUpsellsAfterCreate(
  reconcile: ReconcileUpsellsFn,
  bookingId: string | undefined,
  upsells: UpsellItemValue[] | undefined,
): Promise<SaveUpsellsResult> {
  if (!bookingId || !upsells || upsells.length === 0) return { ok: true };
  const rows = upsells.map((row) => ({ ...row, id: undefined }));
  try {
    await reconcile(bookingId, rows, []);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
