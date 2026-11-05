import { describe, expect, it, vi } from "vitest";
import type { UpsellItemValue } from "@/features/booking/types";
import { saveUpsellsAfterCreate } from "./save-upsells-after-create";

const ROW = { upsell_type: "FEE", description: "Seat" } as unknown as UpsellItemValue;

describe("saveUpsellsAfterCreate", () => {
  it("saves the form rows against the new booking with nothing pre-existing", async () => {
    const reconcile = vi.fn().mockResolvedValue(undefined);
    expect(await saveUpsellsAfterCreate(reconcile, "b1", [ROW])).toEqual({ ok: true });
    expect(reconcile).toHaveBeenCalledWith("b1", [expect.objectContaining({ description: "Seat" })], []);
  });

  it("strips any id so a create is never sent as an update", async () => {
    const reconcile = vi.fn().mockResolvedValue(undefined);
    await saveUpsellsAfterCreate(reconcile, "b1", [{ ...ROW, id: "stale-id" } as UpsellItemValue]);
    const rows = reconcile.mock.calls[0][1] as UpsellItemValue[];
    expect(rows[0].id).toBeUndefined();
  });

  it("does nothing when there are no upsells or no booking id", async () => {
    const reconcile = vi.fn();
    expect(await saveUpsellsAfterCreate(reconcile, "b1", [])).toEqual({ ok: true });
    expect(await saveUpsellsAfterCreate(reconcile, "b1", undefined)).toEqual({ ok: true });
    expect(await saveUpsellsAfterCreate(reconcile, undefined, [ROW])).toEqual({ ok: true });
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("returns the error (not throw) when the save fails, including a partial failure", async () => {
    const boom = new Error("boom");
    const reconcile = vi.fn().mockRejectedValue(boom);
    expect(await saveUpsellsAfterCreate(reconcile, "b1", [ROW, ROW])).toEqual({ ok: false, error: boom });
  });
});
