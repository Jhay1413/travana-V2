import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { airportRepository } from "./airport.repository";
import { renderWhere, resetCapture, setRows } from "../../test/capture-db";

beforeEach(() => resetCapture());

describe("airportRepository departure usage", () => {
  it("enquiry departures are filtered to the org via transaction.org_id", async () => {
    setRows([{ airportId: "a", code: "BRS", uses: 2 }]);
    expect(await airportRepository.countEnquiryDepartures("org-1")).toEqual([{ airportId: "a", code: "BRS", uses: 2 }]);
    const { text, params } = renderWhere(0);
    expect(text).toContain('"transaction"."org_id" = ');
    expect(params).toEqual(["org-1"]);
  });

  it("quote departures are filtered to the org via transaction.org_id", async () => {
    await airportRepository.countQuoteDepartures("org-2");
    const { text, params } = renderWhere(0);
    expect(text).toContain('"transaction"."org_id" = ');
    expect(params).toEqual(["org-2"]);
  });
});
