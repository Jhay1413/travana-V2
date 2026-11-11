import { describe, expect, it } from "vitest";
import { isNoneValue } from "./none-value";

describe("isNoneValue", () => {
  it("matches none in any case, with padding", () => {
    expect(isNoneValue("none")).toBe(true);
    expect(isNoneValue("None")).toBe(true);
    expect(isNoneValue(" NONE ")).toBe(true);
  });
  it("rejects real values and empties", () => {
    expect(isNoneValue("Private")).toBe(false);
    expect(isNoneValue("")).toBe(false);
    expect(isNoneValue(null)).toBe(false);
    expect(isNoneValue(undefined)).toBe(false);
  });
});

