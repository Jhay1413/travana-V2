import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { and, type SQL } from "drizzle-orm";
import {
  bookingNotLostCond,
  countableQuoteConds,
  dealScopeConds,
  lifetimeProfitExpr,
  quoteCreatedInWindow,
  windowSalesExpr,
} from "./agent-profile.sql";

const dialect = new PgDialect();
const render = (s: SQL) => dialect.sqlToQuery(s);
const W = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-17T12:00:00Z") };
const FROM = W.from.toISOString();
const TO = W.to.toISOString();

describe("dealScopeConds", () => {
  it("always starts with the organisation predicate on the client", () => {
    const conds = dealScopeConds({ orgId: "o1" });
    const first = render(conds[0]);
    expect(first.sql).toContain('"client_table"."org_id" = ');
    expect(first.params).toEqual(["o1"]);
  });

  it("excludes test and inactive deals", () => {
    const q = render(and(...dealScopeConds({ orgId: "o1" })) as SQL);
    expect(q.sql).toContain('"transaction"."is_test" = ');
    expect(q.sql).toContain('"transaction"."is_active" = ');
  });

  it("adds branch and user only when given", () => {
    const bare = render(and(...dealScopeConds({ orgId: "o1" })) as SQL);
    expect(bare.sql).not.toContain('"transaction"."branch_id"');
    expect(bare.sql).not.toContain('"transaction"."user_id"');

    const full = render(and(...dealScopeConds({ orgId: "o1", branchId: "b1", userId: "u1" })) as SQL);
    expect(full.sql).toContain('"transaction"."branch_id" = ');
    expect(full.sql).toContain('"transaction"."user_id" = ');
    expect(full.params).toEqual(expect.arrayContaining(["o1", "b1", "u1"]));
  });
});

describe("windowSalesExpr", () => {
  it("binds both bounds and adds the window's upsell sales", () => {
    const q = render(windowSalesExpr(W));
    expect(q.sql).not.toContain(FROM);
    expect(q.params).toEqual(expect.arrayContaining([FROM, TO]));
    expect(q.sql).toContain('"booking_table"."sales_price"');
    expect(q.sql).toContain('"booking_upsell"."sales_price"');
    expect(q.sql).toContain('"booking_upsell"."is_active" = true');
  });
});

describe("lifetimeProfitExpr", () => {
  it("sums booking commission and every active upsell commission, with no window", () => {
    const q = render(lifetimeProfitExpr());
    expect(q.sql).toContain('"booking_table"."package_commission"');
    expect(q.sql).toContain('"booking_upsell"."commission"');
    expect(q.sql).not.toContain('"added_at" >=');
  });
});

describe("quote conditions", () => {
  it("countable quotes are live, active, not free and have a client", () => {
    const q = render(and(...countableQuoteConds()) as SQL);
    expect(q.sql).toContain('"quote_table"."deleted_at" is null');
    expect(q.sql).toContain('"quote_table"."is_active"');
    expect(q.sql).toContain('"quote_table"."isFreeQuote"');
    expect(q.sql).toContain('"transaction"."client_id" is not null');
  });

  it("quote creation window is half-open with bound params", () => {
    const q = render(quoteCreatedInWindow(W));
    expect(q.sql).toContain('"quote_table"."date_created" >=');
    expect(q.sql).toContain('"quote_table"."date_created" <');
    expect(q.params).toEqual([FROM, TO]);
  });

  it("not-lost keeps bookings with no status", () => {
    const q = render(bookingNotLostCond());
    expect(q.sql).toContain('"booking_table"."booking_status" is null');
    expect(q.sql).toContain("<> 'LOST'");
  });
});
