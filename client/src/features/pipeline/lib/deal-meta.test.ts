import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/quote/types";
import { buildDealMeta, isDueToday, nextTaskRowProps } from "./deal-meta";
import { operatorCode } from "../shared/operator-tile";

describe("buildDealMeta", () => {
  it("falls back when nothing is known", () => {
    expect(buildDealMeta({ id: "x" } as unknown as Transaction, "Quoted")).toBe("Dates not set");
  });

  it("joins destination, date, nights and the enquiry budget", () => {
    const t = { id: "x", enquiry: { budget: "2500", travel_date: "2026-03-12T00:00:00", no_of_nights: 7, destination_name: "Tenerife" } } as unknown as Transaction;
    expect(buildDealMeta(t, "Enquiry")).toBe("Tenerife · 12 Mar 2026 · 7 nights · Budget £2,500");
    expect(buildDealMeta(t, "Quoted")).not.toContain("Budget");
  });
});

describe("isDueToday", () => {
  const now = new Date(2026, 9, 15, 10, 0);
  it("matches the same local day only", () => {
    expect(isDueToday(new Date(2026, 9, 15, 17, 0).toISOString(), now)).toBe(true);
    expect(isDueToday(new Date(2026, 9, 14, 17, 0).toISOString(), now)).toBe(false);
    expect(isDueToday(null, now)).toBe(false);
  });
});

describe("operatorCode", () => {
  it("shortens operator names", () => {
    expect(operatorCode("TUI")).toBe("TUI");
    expect(operatorCode("Jet2holidays")).toBe("JET");
    expect(operatorCode("P&O Cruises")).toBe("PC");
    expect(operatorCode(null)).toBe("");
  });
});

describe("nextTaskRowProps", () => {
  it("maps no task to the empty state", () => {
    expect(nextTaskRowProps(null)).toEqual({ title: null, dueDate: null });
    expect(nextTaskRowProps(undefined)).toEqual({ title: null, dueDate: null });
  });
  it("maps a task, keeping an untitled one as a task", () => {
    expect(nextTaskRowProps({ title: "Call", due_date: "2026-10-21T10:00:00Z" })).toEqual({ title: "Call", dueDate: "2026-10-21T10:00:00Z" });
    expect(nextTaskRowProps({ title: null, due_date: null })).toEqual({ title: "", dueDate: null });
  });
});
