import { describe, expect, it } from "vitest";
import { summarizeBulk } from "./bulk-summary";

const ok = { status: "fulfilled" as const };
const bad = { status: "rejected" as const };

describe("summarizeBulk", () => {
  it("reports full success", () => {
    expect(summarizeBulk([ok, ok], "assigned")).toEqual({ ok: 2, failed: 0, title: "2 tickets assigned", destructive: false });
    expect(summarizeBulk([ok], "updated").title).toBe("1 ticket updated");
  });
  it("reports a mixed result", () => {
    expect(summarizeBulk([ok, bad, ok], "updated")).toEqual({ ok: 2, failed: 1, title: "2 tickets updated, 1 failed", destructive: true });
  });
  it("reports total failure", () => {
    expect(summarizeBulk([bad, bad], "updated")).toEqual({ ok: 0, failed: 2, title: "Couldn't update 2 tickets", destructive: true });
  });
});
