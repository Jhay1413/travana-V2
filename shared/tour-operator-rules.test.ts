import { describe, expect, it } from "vitest";
import {
  DEFAULT_BALANCE_WEEKS,
  OPERATOR_MESSAGES,
  PHONE_RE,
  normaliseWeb,
  operatorFieldsSchema,
  parseBalanceWeeks,
  parseCommission,
} from "./tour-operator-rules";

const valid = {
  name: "TUI",
  phone: "0203 451 2720",
  web: "trade.tui.co.uk",
  username: "u",
  password: "p",
  commission: "10%",
  balanceWeeks: "14 weeks",
};

describe("tour-operator-rules", () => {
  it("defaults to 14 weeks", () => {
    expect(DEFAULT_BALANCE_WEEKS).toBe(14);
  });

  it("normaliseWeb adds https and keeps existing scheme", () => {
    expect(normaliseWeb("  trade.jet2holidays.com ")).toBe("https://trade.jet2holidays.com");
    expect(normaliseWeb("http://a.com")).toBe("http://a.com");
    expect(normaliseWeb("  ")).toBe("");
  });

  it("PHONE_RE accepts uk numbers and rejects words", () => {
    expect(PHONE_RE.test("+44 (0)203 451 2720")).toBe(true);
    expect(PHONE_RE.test("call me")).toBe(false);
    expect(PHONE_RE.test("123")).toBe(false);
  });

  it("parseCommission", () => {
    expect(parseCommission("10%")).toEqual({ value: 10 });
    expect(parseCommission(12.5)).toEqual({ value: 12.5 });
    expect(parseCommission("")).toEqual({});
    expect(parseCommission(null)).toEqual({});
    expect(parseCommission("abc").error).toBe(OPERATOR_MESSAGES.commissionNumber);
    expect(parseCommission("-1").error).toBe(OPERATOR_MESSAGES.commissionMin);
    expect(parseCommission("100.5").error).toBe(OPERATOR_MESSAGES.commissionMax);
    expect(parseCommission("8.555")).toEqual({ value: 8.56 });
  });

  it("parseBalanceWeeks", () => {
    expect(parseBalanceWeeks("14 weeks")).toEqual({ value: 14 });
    expect(parseBalanceWeeks("1 week")).toEqual({ value: 1 });
    expect(parseBalanceWeeks(" ")).toEqual({});
    expect(parseBalanceWeeks("x").error).toBe(OPERATOR_MESSAGES.weeksNumber);
    expect(parseBalanceWeeks("1.5").error).toBe(OPERATOR_MESSAGES.weeksWhole);
    expect(parseBalanceWeeks("-1").error).toBe(OPERATOR_MESSAGES.weeksMin);
    expect(parseBalanceWeeks("53").error).toBe(OPERATOR_MESSAGES.weeksMax);
  });

  it("operatorFieldsSchema parses a valid row and coerces numbers", () => {
    const r = operatorFieldsSchema.parse(valid);
    expect(r.commission).toBe(10);
    expect(r.balanceWeeks).toBe(14);
    expect(r.web).toBe("https://trade.tui.co.uk");
  });

  it("operatorFieldsSchema reports verbatim messages", () => {
    const r = operatorFieldsSchema.safeParse({ ...valid, name: "T", phone: "x", web: "not a url", commission: "", balanceWeeks: "99" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs).toContain(OPERATOR_MESSAGES.nameMin);
      expect(msgs).toContain(OPERATOR_MESSAGES.phone);
      expect(msgs).toContain(OPERATOR_MESSAGES.web);
      expect(msgs).toContain(OPERATOR_MESSAGES.commissionRequired);
      expect(msgs).toContain(OPERATOR_MESSAGES.weeksMax);
    }
  });

  it("allows blank phone and web", () => {
    expect(operatorFieldsSchema.safeParse({ ...valid, phone: "", web: "" }).success).toBe(true);
  });

  it("duplicate message helper", () => {
    expect(OPERATOR_MESSAGES.nameDuplicate("TUI")).toBe("TUI is already in the list.");
  });
});
