import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  bookingNetExpr,
  bookingsSumSubquery,
  derivedGross,
  grossDerivedTable,
  homeworkerShareFromGross,
  orgShareFromGross,
  periodGrossExpr,
  statementBookingConds,
  statementUpsellConds,
  upsellsSumSubquery,
  toWindow,
} from "./homeworker-statement.sql";

const dialect = new PgDialect();
const render = (q: SQL) => {
  const r = dialect.sqlToQuery(q);
  return { text: r.sql.replace(/\s+/g, " "), params: r.params };
};

const W = toWindow("2026-03-01", "2026-04-01");

describe("toWindow", () => {
  it("builds UTC-midnight half-open bounds", () => {
    expect(W.start.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(W.end.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("bookingNetExpr (a: booking half)", () => {
  const { text } = render(bookingNetExpr());

  it("includes stored booking commission (package + line items)", () => {
    expect(text).toContain('"booking_table"."package_commission"');
    expect(text).toContain('"booking_flights"."commission"');
  });

  it("does NOT include any upsell term (upsells are recognised by their own added_at)", () => {
    expect(text).not.toContain("booking_upsell");
  });

  it("subtracts discounts and service charge, defaulting NULL to 0", () => {
    expect(text).toMatch(/- COALESCE\(CAST\("booking_table"."discounts" AS NUMERIC\), 0\)/);
    expect(text).toMatch(/- COALESCE\(CAST\("booking_table"."service_charge" AS NUMERIC\), 0\)/);
  });
});

describe("statementBookingConds (a)", () => {
  const { text, params } = render(statementBookingConds("org-1", "hb-1", W));

  it("scopes to the org and branch and excludes test/inactive transactions (NULL is_test counts as false)", () => {
    expect(text).toContain('"transaction"."org_id" =');
    expect(text).toContain('"transaction"."branch_id" =');
    expect(text).toContain('COALESCE("transaction"."is_test", false) = false');
    expect(text).toContain('"transaction"."is_active" =');
    expect(params).toContain("org-1");
    expect(params).toContain("hb-1");
  });

  it("treats a NULL booking.is_active as active, but excludes inactive bookings", () => {
    expect(text).toContain('"booking_table"."is_active" is null');
    expect(text).toContain('"booking_table"."is_active" =');
  });

  it("bounds booking.date_created to [from, to)", () => {
    expect(text).toContain('"booking_table"."date_created" >=');
    expect(text).toContain('"booking_table"."date_created" <');
    expect(params).toContain(W.start.toISOString());
    expect(params).toContain(W.end.toISOString());
  });

  it("does not filter on the upsell added_at", () => {
    expect(text).not.toContain("added_at");
  });
});

describe("statementUpsellConds (b: upsell half)", () => {
  const { text, params } = render(statementUpsellConds("org-1", "hb-1", W));

  it("bounds the upsell by its OWN added_at, with no booking date_created filter", () => {
    expect(text).toContain('"booking_upsell"."added_at" >=');
    expect(text).toContain('"booking_upsell"."added_at" <');
    expect(text).not.toContain("date_created");
    expect(params).toContain(W.start.toISOString());
    expect(params).toContain(W.end.toISOString());
  });

  it("binds is_active = true for the transaction, the booking and the upsell", () => {
    expect(params.filter((p) => p === true).length).toBeGreaterThanOrEqual(3);
  });

  it("only counts active upsells on active bookings of the same org/branch, excluding test transactions", () => {
    expect(text).toContain('"booking_upsell"."is_active" =');
    expect(text).toContain('"booking_table"."is_active" is null');
    expect(text).toContain('"transaction"."org_id" =');
    expect(text).toContain('"transaction"."branch_id" =');
    expect(text).toContain('COALESCE("transaction"."is_test", false) = false');
    expect(params).toEqual(expect.arrayContaining(["org-1", "hb-1"]));
  });
});

describe("subqueries", () => {
  it("sums booking nets from booking_table joined to transaction", () => {
    const { text } = render(bookingsSumSubquery("o", "b", W));
    expect(text).toContain('SELECT COALESCE(SUM(');
    expect(text).toContain('FROM "booking_table" INNER JOIN "transaction"');
  });

  it("sums upsell commission from booking_upsell joined through its booking to the transaction", () => {
    const { text } = render(upsellsSumSubquery("o", "b", W));
    expect(text).toContain('FROM "booking_upsell" INNER JOIN "booking_table" ON "booking_upsell"."booking_id" = "booking_table"."id"');
    expect(text).toContain('INNER JOIN "transaction"');
    expect(text).toContain('COALESCE(CAST("booking_upsell"."commission" AS NUMERIC), 0)');
  });
});

describe("period aggregation", () => {
  it("sums both halves, clamps at zero and rounds to 2dp", () => {
    const { text } = render(periodGrossExpr("o", "b", W));
    expect(text).toMatch(/^ROUND\(GREATEST\(\(SELECT COALESCE\(SUM\(/);
    expect(text).toContain('FROM "booking_upsell"');
    expect(text).toContain("+ (SELECT COALESCE(SUM(");
    expect(text).toContain(", 0), 2)");
  });

  it("computes the gross ONCE in a derived single-row table", () => {
    const { text } = render(grossDerivedTable("o", "b", W));
    expect(text.startsWith("(SELECT ROUND(GREATEST(")).toBe(true);
    expect(text.endsWith(") AS g) AS s")).toBe(true);
    expect(text.match(/GREATEST\(/g)).toHaveLength(1);
    expect(render(derivedGross).text).toBe("s.g");
  });

  it("computes the homeworker share from s.g in SQL numeric with the percent as a bound param", () => {
    const { text, params } = render(homeworkerShareFromGross("70.00"));
    expect(text).toBe("ROUND(s.g * CAST($1 AS NUMERIC) / 100, 2)");
    expect(params).toEqual(["70.00"]);
  });

  it("derives the org share as gross minus the homeworker share (shares always add up)", () => {
    const { text } = render(orgShareFromGross("70.00"));
    expect(text).toBe("(s.g - ROUND(s.g * CAST($1 AS NUMERIC) / 100, 2))");
  });
});
