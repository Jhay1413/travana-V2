import { describe, expect, it } from "vitest";
import { MAX_TARGET, gbp, moneyText, parseMoney, shortGbp } from "./money";

describe("parseMoney", () => {
  it.each([
    ["90000", 90000],
    ["90,000", 90000],
    ["£90,000", 90000],
    ["90 000", 90000],
    ["0", 0],
  ])("reads %s as %d", (raw, value) => {
    expect(parseMoney(raw)).toEqual({ ok: true, value });
  });

  it("rejects blanks, decimals, negatives and words", () => {
    expect(parseMoney("")).toMatchObject({ ok: false, error: "Enter an amount" });
    expect(parseMoney("   ")).toMatchObject({ ok: false });
    for (const bad of ["12.5", "-5", "abc", "1e5"]) {
      expect(parseMoney(bad)).toMatchObject({ ok: false, error: "Enter a whole number of pounds" });
    }
  });

  it("allows up to £50,000,000 and no more", () => {
    expect(parseMoney("50,000,000")).toEqual({ ok: true, value: MAX_TARGET });
    expect(parseMoney("50,000,001")).toMatchObject({ ok: false });
  });
});

describe("formatting", () => {
  it("formats whole pounds", () => {
    expect(moneyText(90000)).toBe("90,000");
    expect(gbp(90000)).toBe("£90,000");
    expect(gbp(-1500)).toBe("-£1,500");
    expect(gbp(0)).toBe("£0");
  });

  it("shortens chart labels", () => {
    expect(shortGbp(8000)).toBe("£8k");
    expect(shortGbp(1500)).toBe("£1.5k");
    expect(shortGbp(500)).toBe("£500");
  });
});
