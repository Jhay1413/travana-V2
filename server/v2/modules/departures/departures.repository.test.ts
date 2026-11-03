import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { departuresRepository } from "./departures.repository";
import { renderOrderBy, renderWhere, resetCapture, setRows } from "../../test/capture-db";

beforeEach(() => resetCapture());

const OPEN = { orgId: "o1", branchId: null, fromYmd: null, toExclYmd: null };

describe("departuresRepository.listRows", () => {
  it("is org first, branch narrowed, not LOST and bounded by travel date", async () => {
    await departuresRepository.listRows({ orgId: "o1", branchId: "b1", fromYmd: "2026-10-20", toExclYmd: "2026-10-27" });
    const { text, params } = renderWhere(0);
    expect(text.startsWith('("client_table"."org_id" = ')).toBe(true);
    expect(params[0]).toBe("o1");
    expect(text).toContain('"transaction"."branch_id" = ');
    expect(text).toContain("<> 'LOST'");
    expect(text).toContain('"booking_table"."travel_date" >= ');
    expect(text).toContain('"booking_table"."travel_date" < ');
    expect(params).toEqual(expect.arrayContaining(["b1", "2026-10-20", "2026-10-27"]));
  });

  it("sorts by travel date, then client name", async () => {
    await departuresRepository.listRows(OPEN);
    const order = renderOrderBy(0);
    const dateAt = order.indexOf('"booking_table"."travel_date"');
    expect(dateAt).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("lower(")).toBeGreaterThan(dateAt);
  });

  it("returns the rows the database gave", async () => {
    setRows([{ bookingId: "bk1" }]);
    expect(await departuresRepository.listRows(OPEN)).toEqual([{ bookingId: "bk1" }]);
  });
});

describe("departuresRepository.findRow", () => {
  it("filters on the booking id with no date bound, and returns null when nothing matches", async () => {
    setRows([]);
    expect(await departuresRepository.findRow({ ...OPEN, bookingId: "bk1" })).toBeNull();
    const { text, params } = renderWhere(0);
    expect(text).toContain('"booking_table"."id" = ');
    expect(text).not.toContain('"booking_table"."travel_date"');
    expect(params).toContain("bk1");
  });

  it("returns the first row", async () => {
    setRows([{ bookingId: "bk1" }]);
    expect(await departuresRepository.findRow({ ...OPEN, bookingId: "bk1" })).toEqual({ bookingId: "bk1" });
  });
});

describe("departuresRepository.findUserName / upsertCheck", () => {
  it("looks the user up by id", async () => {
    setRows([{ name: "Ann Lee" }]);
    expect(await departuresRepository.findUserName("u1")).toBe("Ann Lee");
    expect(renderWhere(0).params).toContain("u1");
    setRows([]);
    expect(await departuresRepository.findUserName("u2")).toBeNull();
  });

  it("returns the stored row from the upsert", async () => {
    const stored = { checkIn: true };
    setRows([stored]);
    const out = await departuresRepository.upsertCheck(
      "o1",
      "bk1",
      { checkIn: true },
      { by: "u1", byName: "Ann", at: new Date("2026-10-20T10:00:00Z"), what: "Check in" },
    );
    expect(out).toBe(stored);
  });
});
