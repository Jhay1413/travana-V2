import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  bookingTouchedSinceCond,
  leadSourceKeyExpr,
  windowBookingsExpr,
  windowProfitExpr,
  windowQuotedDealsExpr,
} from "./organization-overview.sql";

const dialect = new PgDialect();
const render = (s: SQL) => dialect.sqlToQuery(s);
const W = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-17T12:00:00Z") };
const FROM = W.from.toISOString();
const TO = W.to.toISOString();

describe("window expressions", () => {
  it("profit binds both bounds as params and adds window-bounded upsells", () => {
    const q = render(windowProfitExpr(W));
    expect(q.sql).not.toContain(FROM);
    expect(q.params).toEqual(expect.arrayContaining([FROM, TO]));
    expect(q.sql).toContain('"booking_upsell"."added_at" >=');
    expect(q.sql).toContain('"booking_upsell"."added_at" <');
    expect(q.sql).toContain('"booking_upsell"."is_active" = true');
  });

  it("bookings counts with a FILTER on the half-open window", () => {
    const q = render(windowBookingsExpr(W));
    expect(q.sql).toContain("COUNT(*) FILTER (WHERE");
    expect(q.params).toEqual([FROM, TO]);
  });

  it("quoted deals counts distinct deals created in the window", () => {
    const q = render(windowQuotedDealsExpr(W));
    expect(q.sql).toContain('COUNT(DISTINCT "transaction"."id") FILTER');
    expect(q.params).toEqual([FROM, TO]);
  });
});

describe("bookingTouchedSinceCond", () => {
  it("accepts new bookings or ones with an active upsell added since", () => {
    const q = render(bookingTouchedSinceCond(W.from));
    expect(q.sql).toContain('"booking_table"."date_created" >=');
    expect(q.sql).toContain("EXISTS (SELECT 1 FROM");
    expect(q.sql).toContain('"booking_upsell"."is_active" = true');
    expect(q.params).toEqual([FROM, FROM]);
  });
});

describe("leadSourceKeyExpr", () => {
  it("coalesces the deal lead source to none", () => {
    expect(render(leadSourceKeyExpr()).sql).toBe(`COALESCE("transaction"."lead_source"::text, 'none')`);
  });
});
