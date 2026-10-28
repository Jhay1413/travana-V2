import { describe, expect, it } from "vitest";
import { establishesFixedContainingBlock } from "./fixed-containing-block";

describe("establishesFixedContainingBlock", () => {
  it("is false for an empty / all-none style", () => {
    expect(establishesFixedContainingBlock({})).toBe(false);
    expect(
      establishesFixedContainingBlock({
        transform: "none", translate: "none", scale: "none", rotate: "none",
        perspective: "none", filter: "none", backdropFilter: "none", contain: "none", willChange: "auto",
      })
    ).toBe(false);
  });

  it("detects the individual translate/scale/rotate properties (Tailwind v4 dialog)", () => {
    expect(establishesFixedContainingBlock({ translate: "-50% -50%" })).toBe(true);
    expect(establishesFixedContainingBlock({ scale: "0.95" })).toBe(true);
    expect(establishesFixedContainingBlock({ rotate: "10deg" })).toBe(true);
  });

  it("still detects the classic triggers", () => {
    expect(establishesFixedContainingBlock({ transform: "matrix(1,0,0,1,0,0)" })).toBe(true);
    expect(establishesFixedContainingBlock({ backdropFilter: "blur(16px)" })).toBe(true);
    expect(establishesFixedContainingBlock({ webkitBackdropFilter: "blur(4px)" })).toBe(true);
    expect(establishesFixedContainingBlock({ filter: "blur(1px)" })).toBe(true);
    expect(establishesFixedContainingBlock({ contain: "layout" })).toBe(true);
    expect(establishesFixedContainingBlock({ willChange: "transform" })).toBe(true);
    expect(establishesFixedContainingBlock({ willChange: "translate" })).toBe(true);
  });
});
