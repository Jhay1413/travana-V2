import { describe, expect, it } from "vitest";
import { isDirtySnapshot, type EditorSnapshot } from "./dirty-check";

const base: EditorSnapshot = { subtitle: "s", post: "p", schedule: "2026-10-21T09:00", images: "e1|e2" };

describe("isDirtySnapshot", () => {
  it("is clean without a baseline (post not loaded)", () => {
    expect(isDirtySnapshot(null, base)).toBe(false);
  });
  it("is clean when nothing changed", () => {
    expect(isDirtySnapshot(base, { ...base })).toBe(false);
  });
  it("detects subtitle, post and schedule changes", () => {
    expect(isDirtySnapshot(base, { ...base, subtitle: "x" })).toBe(true);
    expect(isDirtySnapshot(base, { ...base, post: "x" })).toBe(true);
    expect(isDirtySnapshot(base, { ...base, schedule: "" })).toBe(true);
  });
  it("detects image changes and reorder", () => {
    expect(isDirtySnapshot(base, { ...base, images: "e2|e1" })).toBe(true);
  });
  it("ignores images until their baseline is taken", () => {
    expect(isDirtySnapshot({ ...base, images: null }, { ...base, images: "e1" })).toBe(false);
  });
});
