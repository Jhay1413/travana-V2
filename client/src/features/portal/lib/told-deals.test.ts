import { beforeEach, describe, it, expect } from "vitest";
import { clearToldThisSession, isTold, rememberTold, toldClientKey, toldThisSession } from "./told-deals";

beforeEach(() => clearToldThisSession());

describe("told deals this session", () => {
  it("remembers a deal for that customer only", () => {
    rememberTold("c1", "d1");
    expect(toldThisSession("c1").has("d1")).toBe(true);
    expect(toldThisSession("c2").has("d1")).toBe(false);
  });

  it("is forgotten on sign-out", () => {
    rememberTold("c1", "d1");
    clearToldThisSession();
    expect(toldThisSession("c1").size).toBe(0);
  });

  it("shows a deal as told from the server's list or from this session (so it flips when the summary never loaded)", () => {
    expect(isTold("d1", [], new Set())).toBe(false);
    expect(isTold("d1", ["d1"], new Set())).toBe(true);
    expect(isTold("d1", [], new Set(["d1"]))).toBe(true);
    expect(isTold("d2", ["d1"], new Set(["d1"]))).toBe(false);
  });

  it("uses an empty key when the customer id is not known", () => {
    expect(toldClientKey(null)).toBe("");
    expect(toldClientKey("c1")).toBe("c1");
  });

  it("returns a copy, so callers cannot change the store", () => {
    rememberTold("c1", "d1");
    (toldThisSession("c1") as Set<string>).add("x");
    expect(toldThisSession("c1").has("x")).toBe(false);
  });
});
