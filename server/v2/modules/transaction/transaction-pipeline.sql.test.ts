import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  escapeLike,
  searchCond,
  priorityCond,
  tourOperatorCond,
  quickCond,
  sortExpr,
  dealValueExpr,
  dealProfitExpr,
  pipelineFilterConds,
  primaryQuoteConds,
  dealEntityIdsSql,
  lastActivityExpr,
  openTaskExists,
  titleExpr,
} from "./transaction-pipeline.sql";

const dialect = new PgDialect();
const render = (q: SQL) => dialect.sqlToQuery(q);

describe("escapeLike", () => {
  it("wraps the term and escapes LIKE wildcards and backslashes", () => {
    expect(escapeLike("ab")).toBe("%ab%");
    expect(escapeLike("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});

describe("searchCond", () => {
  it("binds the escaped pattern as a parameter, never inlining the term", () => {
    const { sql: text, params } = render(searchCond("100%x; DROP"));
    expect(text).not.toContain("DROP");
    expect(params.filter((p) => p === "%100\\%x; DROP%").length).toBeGreaterThanOrEqual(6);
  });

  it("covers titles, booking refs, client name and phone", () => {
    const { sql: text } = render(searchCond("x"));
    expect(text).toContain("e.title ILIKE");
    expect(text).toContain('"quote_table"."title" ILIKE');
    expect(text).toContain('"booking_table"."hays_ref" ILIKE');
    expect(text).toContain('"booking_table"."supplier_ref" ILIKE');
    expect(text).toContain("concat_ws(");
    expect(text).toContain('"phoneNumber" ILIKE');
  });
});

describe("priorityCond", () => {
  it("treats NULL priority as low and binds each value", () => {
    const { sql: text, params } = render(priorityCond(["low", "high"]));
    expect(text).toContain("COALESCE(");
    expect(text).toContain("'low'");
    expect(params).toEqual(["low", "high"]);
  });
});

describe("tourOperatorCond", () => {
  it("matches the primary quote or the booking operator, ids bound as params", () => {
    const { sql: text, params } = render(tourOperatorCond(["a", "b"]));
    expect(text).toMatch(/"quote_table"\."main_tour_operator_id" IN \(\$\d+::uuid/);
    expect(text).toMatch(/"booking_table"\."main_tour_operator_id" IN \(\$\d+::uuid/);
    expect(text).not.toContain('"main_tour_operator_id"::text');
    expect(params.filter((p) => p === "a")).toHaveLength(2);
    expect(params.filter((p) => p === "b")).toHaveLength(2);
  });
});

describe("quickCond", () => {
  it("due_today: incomplete task due on today's Europe/London calendar day", () => {
    const { sql: text } = render(quickCond("due_today"));
    expect(text).toContain("EXISTS");
    expect(text).toContain('"completed" IS NOT TRUE');
    expect(text).toContain("Europe/London");
    expect(text).toContain("::date");
  });

  it("no_task: NOT EXISTS an incomplete task, with no due-date restriction", () => {
    const { sql: text } = render(quickCond("no_task"));
    expect(text).toMatch(/^NOT EXISTS/);
    expect(text).not.toContain("Europe/London");
  });

  it("quiet_7: last activity at least 7 days ago", () => {
    const { sql: text } = render(quickCond("quiet_7"));
    expect(text).toContain("GREATEST(");
    expect(text).toContain("<= NOW() - INTERVAL '7 days'");
  });
});

describe("sortExpr", () => {
  it("latest_activity / quiet_first order by last activity with created_at tie-break", () => {
    const latest = render(sortExpr("latest_activity", false)).sql;
    const quiet = render(sortExpr("quiet_first", false)).sql;
    expect(latest).toMatch(/\) DESC, "transaction"\."created_at" DESC$/);
    expect(quiet).toMatch(/\) ASC, "transaction"\."created_at" ASC$/);
  });

  it("value_desc / profit_desc order the money expression DESC NULLS LAST", () => {
    expect(render(sortExpr("value_desc", false)).sql).toContain("DESC NULLS LAST");
    expect(render(sortExpr("profit_desc", false)).sql).toContain("DESC NULLS LAST");
  });

  it("name_asc orders by lower-cased title", () => {
    expect(render(sortExpr("name_asc", false)).sql).toContain("LOWER(");
  });

  it("includeLost drops the lost-quote exclusion", () => {
    const open = render(sortExpr("latest_activity", false)).sql;
    const lost = render(sortExpr("latest_activity", true)).sql;
    expect(open).toContain("!= 'lost'");
    expect(lost).not.toContain("!= 'lost'");
  });
});

describe("dealValueExpr / dealProfitExpr", () => {
  it("branch on transaction status: booking row, summed primary quotes, else 0", () => {
    for (const expr of [dealValueExpr(false), dealProfitExpr(false)]) {
      const { sql: text } = render(expr);
      expect(text).toContain("WHEN 'on_booking'");
      expect(text).toContain("WHEN 'on_quote'");
      expect(text).toContain("ELSE 0");
    }
  });

  it("value is sales_price - discounts + service_charge", () => {
    const { sql: text } = render(dealValueExpr(false));
    const sales = text.indexOf('"booking_table"."sales_price"');
    const disc = text.indexOf('"booking_table"."discounts"');
    const svc = text.indexOf('"booking_table"."service_charge"');
    expect(sales).toBeGreaterThan(-1);
    expect(sales).toBeLessThan(disc);
    expect(disc).toBeLessThan(svc);
    expect(text.slice(sales, disc)).toContain("- ");
    expect(text.slice(disc, svc)).toContain("+ ");
  });

  it("profit includes line-item commissions (package + service)", () => {
    const { sql: text } = render(dealProfitExpr(false));
    expect(text).toContain('"package_commission"');
    expect(text).toContain("quote_flights");
    expect(text).toContain("booking_flights");
  });
});

describe("pipelineFilterConds", () => {
  it("is empty without filters", () => {
    expect(pipelineFilterConds(undefined)).toEqual([]);
    expect(pipelineFilterConds({})).toEqual([]);
    expect(pipelineFilterConds({ priorities: [], tourOperatorIds: [] })).toEqual([]);
  });

  it("adds one condition per provided filter", () => {
    expect(
      pipelineFilterConds({ search: "x", priorities: ["low"], tourOperatorIds: ["t"], quick: "no_task" }),
    ).toHaveLength(4);
  });
});

describe("primaryQuoteConds", () => {
  it("correlates on the transaction and excludes free quotes, copies and deleted quotes", () => {
    const { sql: text } = render(primaryQuoteConds(false));
    expect(text).toContain('"quote_table"."transaction_id" = "transaction"."id"');
    expect((text.match(/IS NOT TRUE/g) ?? []).length).toBe(2);
    expect(text).toContain('"deleted_at" IS NULL');
  });

  it("excludes lost quotes (keeping NULL status) only when includeLost is false", () => {
    const open = render(primaryQuoteConds(false)).sql;
    const all = render(primaryQuoteConds(true)).sql;
    expect(open).toMatch(/"quote_status" IS NULL OR "quote_table"\."quote_status" != 'lost'/);
    expect(all).not.toContain("'lost'");
    expect(all).toMatch(/AND TRUE$/);
  });
});

describe("dealEntityIdsSql", () => {
  const text = render(dealEntityIdsSql(false)).sql;

  it("unions enquiry, quote and booking ids, each cast to text", () => {
    expect((text.match(/UNION ALL/g) ?? []).length).toBe(2);
    const e = text.indexOf("e.id::text");
    const q = text.indexOf('"quote_table"."id"::text');
    const b = text.indexOf('"booking_table"."id"::text');
    expect(e).toBeGreaterThan(-1);
    expect(e).toBeLessThan(q);
    expect(q).toBeLessThan(b);
  });

  it("filters enquiries on deleted_at but does not filter bookings on deleted_at", () => {
    const parts = text.split("UNION ALL");
    expect(parts[0]).toContain("e.deleted_at IS NULL");
    expect(parts[2]).not.toContain("deleted_at");
  });

  it("uses the primary-quote conditions, honouring includeLost", () => {
    expect(text).toContain("!= 'lost'");
    expect(render(dealEntityIdsSql(true)).sql).not.toContain("'lost'");
  });
});

describe("lastActivityExpr", () => {
  const text = render(lastActivityExpr(false)).sql;

  it("takes GREATEST over transaction, notes, tasks, quote and booking activity", () => {
    expect(text.startsWith("GREATEST(")).toBe(true);
    expect(text).toContain('"transaction"."created_at"');
    expect(text).toContain('MAX("notes"."created_at")');
    expect(text).toContain("MAX(GREATEST(");
    expect(text).toContain('MAX("quote_table"."date_created")');
    expect(text).toContain('MAX("booking_table"."date_created")');
  });

  it("considers tasks of enquiry/quote/booking entities belonging to the deal", () => {
    expect(text).toContain("IN ('enquiry', 'quote', 'booking')");
    expect(text).toContain("UNION ALL");
  });

  it("uses enquiry date_created only while the deal is on_enquiry", () => {
    expect(text).toMatch(/CASE WHEN "transaction"\."status" = 'on_enquiry'\s+THEN \(SELECT MAX\(e\.date_created\)/);
  });

  it("applies AT TIME ZONE 'UTC' to timestamp-without-tz columns only", () => {
    expect(text).toContain(`"transaction"."created_at" AT TIME ZONE 'UTC'`);
    expect(text).toMatch(/MAX\("notes"\."created_at"\)[^)]*\) AT TIME ZONE 'UTC'/);
    expect(text).toContain(`"tasks"."created_at" AT TIME ZONE 'UTC'`);
    expect(text).toContain(`"tasks"."completed_at" AT TIME ZONE 'UTC'`);
    expect(text).not.toMatch(/date_created"?\)\s*\)? AT TIME ZONE/);
  });

  it("includeLost drops the lost-quote exclusion", () => {
    expect(text).toContain("!= 'lost'");
    expect(render(lastActivityExpr(true)).sql).not.toContain("'lost'");
  });
});

describe("openTaskExists", () => {
  it("requires an incomplete task on the deal's entities", () => {
    const { sql: text } = render(openTaskExists({ includeLost: false, dueTodayOnly: false }));
    expect(text).toMatch(/^EXISTS \(/);
    expect(text).toContain('"completed" IS NOT TRUE');
    expect(text).toContain("IN ('enquiry', 'quote', 'booking')");
  });

  it("dueTodayOnly=false has no Europe/London day comparison", () => {
    const { sql: text } = render(openTaskExists({ includeLost: false, dueTodayOnly: false }));
    expect(text).not.toContain("Europe/London");
    expect(text).not.toContain("::date");
  });

  it("dueTodayOnly=true compares the due date to today's Europe/London calendar day", () => {
    const { sql: text } = render(openTaskExists({ includeLost: false, dueTodayOnly: true }));
    expect(text).toContain('"completed" IS NOT TRUE');
    expect(text).toContain("AT TIME ZONE 'Europe/London')::date = (NOW() AT TIME ZONE 'Europe/London')::date");
    expect(text).toContain(`"tasks"."due_date" AT TIME ZONE 'UTC'`);
  });

  it("includeLost controls the lost-quote exclusion in the entity set", () => {
    expect(render(openTaskExists({ includeLost: false, dueTodayOnly: false })).sql).toContain("'lost'");
    expect(render(openTaskExists({ includeLost: true, dueTodayOnly: false })).sql).not.toContain("'lost'");
  });
});

describe("titleExpr", () => {
  const text = render(titleExpr(false)).sql;

  it("falls back enquiry -> first primary quote -> booking via COALESCE", () => {
    expect(text.startsWith("COALESCE(")).toBe(true);
    const e = text.indexOf("e.title");
    const q = text.indexOf('SELECT "quote_table"."title"');
    const b = text.indexOf('SELECT "booking_table"."title"');
    expect(e).toBeGreaterThan(-1);
    expect(e).toBeLessThan(q);
    expect(q).toBeLessThan(b);
  });

  it("uses the enquiry title only when on_enquiry and not deleted", () => {
    expect(text).toMatch(/CASE WHEN "transaction"\."status" = 'on_enquiry'\s+THEN NULLIF\(\(SELECT e\.title/);
    expect(text).toContain("e.deleted_at IS NULL");
  });

  it("picks the earliest primary quote and treats empty titles as missing", () => {
    expect(text).toContain('ORDER BY "quote_table"."date_created" ASC LIMIT 1');
    expect((text.match(/NULLIF\(/g) ?? []).length).toBe(3);
    expect((text.match(/, ''\)/g) ?? []).length).toBe(3);
  });

  it("includeLost drops the lost-quote exclusion", () => {
    expect(text).toContain("!= 'lost'");
    expect(render(titleExpr(true)).sql).not.toContain("'lost'");
  });
});
