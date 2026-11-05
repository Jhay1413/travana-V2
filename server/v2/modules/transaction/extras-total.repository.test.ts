import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const execute = vi.hoisted(() => vi.fn());
vi.mock("../../config/database", () => ({ db: { execute } }));

import { fetchExtrasTotalMaps } from "./extras-total.repository";
import { dealValueExpr } from "./transaction-pipeline.sql";

const dialect = new PgDialect();
const render = (call: number) => dialect.sqlToQuery(execute.mock.calls[call][0] as SQL);

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue({ rows: [] });
});

describe("fetchExtrasTotalMaps", () => {
  it("makes no query without ids", async () => {
    const out = await fetchExtrasTotalMaps([], []);
    expect(execute).not.toHaveBeenCalled();
    expect(out.quoteMap.size).toBe(0);
  });

  it("maps totals per id (null and junk become 0)", async () => {
    execute
      .mockResolvedValueOnce({ rows: [{ id: "q1", total: "150.50" }, { id: "q2", total: null }] })
      .mockResolvedValueOnce({ rows: [{ id: "b1", total: "abc" }, { id: "b2", total: "75" }] });
    const { quoteMap, bookingMap } = await fetchExtrasTotalMaps(["q1", "q2"], ["b1", "b2"]);
    expect(quoteMap.get("q1")).toBe(150.5);
    expect(quoteMap.get("q2")).toBe(0);
    expect(bookingMap.get("b1")).toBe(0);
    expect(bookingMap.get("b2")).toBe(75);
  });

  it("card extras use the same predicate as the pipeline total (server totals equal card sums)", async () => {
    await fetchExtrasTotalMaps(["q1"], ["b1"]);
    const cardQuote = render(0).sql;
    const cardBooking = render(1).sql;
    const total = dialect.sqlToQuery(dealValueExpr(false)).sql;
    for (const t of ["transfers", "car_hire", "attraction_ticket", "lounge_pass", "airport_parking", "accomodation"]) {
      const q = `"quote_${t}"."is_included_in_package" = FALSE`;
      const b = `"booking_${t}"."is_included_in_package" = FALSE`;
      expect(cardQuote).toContain(q);
      expect(total).toContain(q);
      expect(cardBooking).toContain(b);
      expect(total).toContain(b);
    }
    expect(cardQuote).toContain('"quote_accomodation"."is_primary" IS NOT TRUE');
  });
});
