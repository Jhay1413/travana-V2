import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const execute = vi.hoisted(() => vi.fn());
vi.mock("../../config/database", () => ({ db: { execute } }));

import { fetchServiceCommissionMaps } from "./service-commission.repository";

const dialect = new PgDialect();
const render = (call: number) => dialect.sqlToQuery(execute.mock.calls[call][0] as SQL);

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue({ rows: [] });
});

describe("fetchServiceCommissionMaps", () => {
  it("makes no query when there are no ids", async () => {
    const out = await fetchServiceCommissionMaps([], []);
    expect(execute).not.toHaveBeenCalled();
    expect(out.quoteMap.size).toBe(0);
    expect(out.bookingMap.size).toBe(0);
  });

  it("unions all seven quote line-item tables in one round trip", async () => {
    await fetchServiceCommissionMaps(["q1", "q2"], []);
    expect(execute).toHaveBeenCalledTimes(1);
    const { sql: text, params } = render(0);
    expect(text.match(/UNION ALL/g)).toHaveLength(6);
    for (const t of ["quote_flights", "quote_accomodation", "quote_transfers", "quote_car_hire", "quote_attraction_ticket", "quote_lounge_pass", "quote_airport_parking"]) {
      expect(text).toContain(t);
    }
    expect(text).toContain("GROUP BY id");
    expect(params).toContain("q1");
    expect(params).toContain("q2");
  });

  it("unions all seven booking line-item tables for booking ids", async () => {
    await fetchServiceCommissionMaps([], ["b1"]);
    const { sql: text, params } = render(0);
    expect(text.match(/UNION ALL/g)).toHaveLength(6);
    expect(text).toContain("booking_flights");
    expect(text).toContain("booking_airport_parking");
    expect(params).toContain("b1");
  });

  it("queries both sides and maps summed commissions (null and junk become 0)", async () => {
    execute
      .mockResolvedValueOnce({ rows: [{ id: "q1", commission: "12.50" }, { id: "q2", commission: null }] })
      .mockResolvedValueOnce({ rows: [{ id: "b1", commission: "7" }] });

    const { quoteMap, bookingMap } = await fetchServiceCommissionMaps(["q1", "q2"], ["b1"]);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(quoteMap.get("q1")).toBe(12.5);
    expect(quoteMap.get("q2")).toBe(0);
    expect(bookingMap.get("b1")).toBe(7);
  });
});
