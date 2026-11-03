import { describe, expect, it } from "vitest";
import { isValidPin, randomPin, sanitisePin } from "./portal-pin";

describe("portal pin helpers", () => {
  it("keeps only the first four digits", () => {
    expect(sanitisePin("12a3-456")).toBe("1234");
    expect(sanitisePin("")).toBe("");
  });

  it("validates exactly four digits", () => {
    expect(isValidPin("0123")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
  });

  it("generates four-digit pins across the range", () => {
    expect(randomPin(() => 0)).toBe("1000");
    expect(randomPin(() => 8999)).toBe("9999");
    expect(randomPin(() => 9000)).toBe("1000");
    expect(isValidPin(randomPin())).toBe(true);
  });

  it("re-draws values in the biased tail", () => {
    const draws = [2 ** 32 - 1, 5];
    expect(randomPin(() => draws.shift() ?? 0)).toBe("1005");
  });
});
