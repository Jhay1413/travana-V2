import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { bookingUpsellRepository, upsellWithOperatorColumns } from "./booking-upsell.repository";
import { renderWhere, resetCapture, setRows } from "../../test/capture-db";

beforeEach(() => resetCapture());

describe("upsell rows carry the operator's display fields", () => {
  it("keeps every upsell column and adds tour_operator_name / tour_operator_logo_url", () => {
    const keys = Object.keys(upsellWithOperatorColumns);
    for (const existing of ["id", "booking_id", "upsell_type", "cost", "commission", "tour_operator_id", "added_at"]) {
      expect(keys).toContain(existing);
    }
    expect(keys).toContain("tour_operator_name");
    expect(keys).toContain("tour_operator_logo_url");
  });

  it("findByBooking returns the joined rows for active upsells of that booking", async () => {
    setRows([{ id: "u1", tour_operator_id: "op1", tour_operator_name: "TUI", tour_operator_logo_url: null }]);
    const rows = await bookingUpsellRepository.findByBooking("b1");
    expect(rows[0]).toMatchObject({ tour_operator_name: "TUI" });
    const { text, params } = renderWhere(0);
    expect(text).toContain('"booking_upsell"."booking_id" = ');
    expect(text).toContain('"booking_upsell"."is_active" = ');
    expect(params).toContain("b1");
  });
});
