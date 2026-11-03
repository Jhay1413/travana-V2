import { describe, expect, it } from "vitest";
import { inviteExpiryText, isInviteExpired } from "./invite-expiry";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const day = 86_400_000;

describe("invite-expiry", () => {
  it("words the time left", () => {
    expect(inviteExpiryText(new Date(NOW + 3 * day).toISOString(), NOW)).toBe("expires in 3 days");
    expect(inviteExpiryText(new Date(NOW + day).toISOString(), NOW)).toBe("expires in 1 day");
    expect(inviteExpiryText(new Date(NOW + 3_600_000).toISOString(), NOW)).toBe("expires today");
  });

  it("says expired for past dates, and handles missing or bad values", () => {
    expect(inviteExpiryText(new Date(NOW - 1000).toISOString(), NOW)).toBe("expired");
    expect(inviteExpiryText(null, NOW)).toBe("no expiry");
    expect(inviteExpiryText("garbage", NOW)).toBe("no expiry");
  });

  it("detects expiry", () => {
    expect(isInviteExpired(new Date(NOW - 1).toISOString(), NOW)).toBe(true);
    expect(isInviteExpired(new Date(NOW + 1).toISOString(), NOW)).toBe(false);
    expect(isInviteExpired(null, NOW)).toBe(false);
  });
});
