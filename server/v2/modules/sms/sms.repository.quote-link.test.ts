import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { smsRepository } from "./sms.repository";
import { renderWhere, resetCapture, setRows } from "../../test/capture-db";

beforeEach(() => resetCapture());

describe("the quote link an automatic message may carry", () => {
  it("uses the portal's own rule, which keeps out inactive, test, lost, archived and booked quotes", async () => {
    const { PgDialect } = await import("drizzle-orm/pg-core");
    const { customerVisibleQuoteWhere } = await import("../portal/portal-quotes.repository");
    const { liveBookingWhere } = await import("../portal/portal.repository");
    const dialect = new PgDialect();
    const visible = dialect.sqlToQuery(customerVisibleQuoteWhere()!).sql;
    for (const part of ["is_active", "is_test", "quote_status"]) expect(visible).toContain(part);
    expect(dialect.sqlToQuery(liveBookingWhere()!).sql).toContain("booking_status");
    // And the lookup composes them (see the source check below) and still runs.
    setRows([{ token: "t", id: "q" }]);
    expect(await smsRepository.findLatestTokenedQuoteForClient("c1")).toEqual({ token: "t", id: "q" });
  });

  it("imports the portal rules instead of writing them again", () => {
    const src = readFileSync(new URL("./sms.repository.ts", import.meta.url), "utf8");
    expect(src).toContain("customerVisibleQuoteWhere");
    expect(src).toContain("liveBookingWhere");
    expect(src.replace(/\s+/g, " ")).toContain("customerVisibleQuoteWhere(), not(exists(");
    expect(src).toContain("../portal/portal-quotes.repository");
    expect(src).toContain("../portal/portal.repository");
  });
});

describe("a live sign-in code is never stored for staff to read", () => {
  it("the staff text send masks the body it logs and still sends the real one", () => {
    const src = readFileSync(new URL("./sms.controller.ts", import.meta.url), "utf8");
    expect(src).toContain("body: maskLoginCodes(body)");
    expect(src).toMatch(/sendSms\(\{ to: phone, body \}\)/);
  });
});

describe("customer messages never read the operator's balance-due weeks", () => {
  it("the SMS repository has no lookup of org_tour_operator", () => {
    const src = readFileSync(new URL("./sms.repository.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/balance_due_weeks|org_tour_operator|findBalanceDueWeeks/);
  });
});
