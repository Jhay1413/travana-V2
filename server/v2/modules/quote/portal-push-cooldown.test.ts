import { describe, expect, it } from "vitest";
import { createPortalPushCooldown, describeWait, PORTAL_PUSH_COOLDOWN_MS } from "./portal-push-cooldown";

describe("createPortalPushCooldown", () => {
  it("is 6 hours by default", () => {
    expect(PORTAL_PUSH_COOLDOWN_MS).toBe(6 * 60 * 60 * 1000);
  });

  it("allows a deal that was never sent, blocks it for the window after a send, then allows it again", () => {
    let clock = 1_000_000;
    const cooldown = createPortalPushCooldown(PORTAL_PUSH_COOLDOWN_MS, () => clock);
    expect(cooldown.remainingMs("q1")).toBe(0);
    cooldown.record("q1");
    expect(cooldown.remainingMs("q1")).toBe(PORTAL_PUSH_COOLDOWN_MS);
    clock += PORTAL_PUSH_COOLDOWN_MS - 60_000;
    expect(cooldown.remainingMs("q1")).toBe(60_000);
    clock += 60_000;
    expect(cooldown.remainingMs("q1")).toBe(0);
  });

  it("is per quote, and release gives the wait back", () => {
    const cooldown = createPortalPushCooldown(1000, () => 0);
    cooldown.record("q1");
    expect(cooldown.remainingMs("q2")).toBe(0);
    cooldown.release("q1");
    expect(cooldown.remainingMs("q1")).toBe(0);
  });
});

describe("describeWait", () => {
  it("says hours and minutes in plain words, rounded up", () => {
    expect(describeWait(6 * 60 * 60 * 1000)).toBe("6 hours");
    expect(describeWait(5 * 60 * 60 * 1000 + 12 * 60 * 1000)).toBe("5 hours 12 minutes");
    expect(describeWait(61 * 60 * 1000)).toBe("1 hour 1 minute");
    expect(describeWait(45 * 60 * 1000 - 1)).toBe("45 minutes");
    expect(describeWait(1)).toBe("1 minute");
  });
});
