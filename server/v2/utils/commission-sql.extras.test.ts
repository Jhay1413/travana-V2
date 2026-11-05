import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { quoteExtrasTotalExpr, bookingExtrasTotalExpr } from "./commission-sql";

const dialect = new PgDialect();

describe("quoteExtrasTotalExpr / bookingExtrasTotalExpr", () => {
  it("sums cost (not commission) of the six extra tables where not included in the package", () => {
    for (const [expr, p] of [[quoteExtrasTotalExpr(), "quote"], [bookingExtrasTotalExpr(), "booking"]] as const) {
      const { sql: text } = dialect.sqlToQuery(expr);
      for (const t of ["transfers", "car_hire", "attraction_ticket", "lounge_pass", "airport_parking", "accomodation"]) {
        expect(text).toContain(`"${p}_${t}"."cost"`);
        expect(text).toContain(`"${p}_${t}"."is_included_in_package" = FALSE`);
      }
      expect(text).not.toContain(".commission");
      expect(text).not.toContain(`${p}_flights`);
    }
  });

  it("correlates on the id reference passed in", () => {
    const { sql: text } = dialect.sqlToQuery(quoteExtrasTotalExpr());
    expect(text).toMatch(/"quote_transfers"\."quote_id"\s+= "quote_table"\."id"/);
  });
});
