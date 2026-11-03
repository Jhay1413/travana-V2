import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { departureWhere, destinationExpr } from "./departures.sql";

const dialect = new PgDialect();
const render = (s: SQL) => dialect.sqlToQuery(s);
const OPEN = { orgId: "o1", branchId: null, fromYmd: null, toExclYmd: null };

describe("departureWhere", () => {
  it("leads with the organisation predicate and excludes test, inactive and LOST", () => {
    const q = render(departureWhere(OPEN));
    expect(q.sql.startsWith('("client_table"."org_id" = ')).toBe(true);
    expect(q.params[0]).toBe("o1");
    expect(q.sql).toContain('"transaction"."is_test" = ');
    expect(q.sql).toContain('"transaction"."is_active" = ');
    expect(q.sql).toContain('"booking_table"."is_active"');
    expect(q.sql).toContain("<> 'LOST'");
  });

  it("adds the branch only when given", () => {
    expect(render(departureWhere(OPEN)).sql).not.toContain('"transaction"."branch_id"');
    const withBranch = render(departureWhere({ ...OPEN, branchId: "b1" }));
    expect(withBranch.sql).toContain('"transaction"."branch_id" = ');
    expect(withBranch.params).toContain("b1");
  });

  it("bounds the travel date half-open and only when asked", () => {
    expect(render(departureWhere(OPEN)).sql).not.toContain('"booking_table"."travel_date"');
    const bounded = render(departureWhere({ ...OPEN, fromYmd: "2026-10-20", toExclYmd: "2026-10-27" }));
    expect(bounded.sql).toContain('"booking_table"."travel_date" >= ');
    expect(bounded.sql).toContain('"booking_table"."travel_date" < ');
    expect(bounded.params).toEqual(expect.arrayContaining(["2026-10-20", "2026-10-27"]));
  });

  it("narrows to one booking when asked", () => {
    const q = render(departureWhere({ ...OPEN, bookingId: "bk1" }));
    expect(q.sql).toContain('"booking_table"."id" = ');
    expect(q.params).toContain("bk1");
  });
});

describe("destinationExpr", () => {
  it("takes the primary accommodation destination, as the pipeline does", () => {
    const q = render(destinationExpr());
    expect(q.sql).toContain("FROM booking_accomodation ba");
    expect(q.sql).toContain("JOIN destination_table d ON r.destination_id = d.id");
    expect(q.sql).toContain('ba.booking_id = "booking_table"."id"');
    expect(q.sql).toContain("ORDER BY ba.is_primary DESC NULLS LAST");
  });
});

describe("destination order stays identical to the pipeline", () => {
  it("is deterministic: primary first, then accommodation id", () => {
    const line = "ORDER BY ba.is_primary DESC NULLS LAST, ba.id";
    expect(render(destinationExpr()).sql).toContain(line);
    const pipeline = readFileSync(resolve(__dirname, "../transaction/transaction.repository.ts"), "utf8");
    expect(pipeline).toContain(line);
  });
});
