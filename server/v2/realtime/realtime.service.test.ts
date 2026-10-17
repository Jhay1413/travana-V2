import { describe, it, expect, vi } from "vitest";
import { realtimeService, MAX_CONNECTIONS_PER_USER } from "./realtime.service";

describe("realtimeService.closeUserConnections", () => {
  it("closes every stream of that user with the revoked reason and nobody else's", () => {
    const mine = [vi.fn(), vi.fn()];
    const other = vi.fn();
    for (const close of mine) realtimeService.registerConnection("revoke-me", close);
    realtimeService.registerConnection("bystander", other);

    expect(realtimeService.closeUserConnections("revoke-me")).toBe(2);

    for (const close of mine) expect(close).toHaveBeenCalledWith("revoked");
    expect(other).not.toHaveBeenCalled();
    expect(realtimeService.closeUserConnections("revoke-me")).toBe(0);
    realtimeService.closeUserConnections("bystander");
  });

  it("still evicts the oldest stream with the replaced reason when over the cap", () => {
    const closers = Array.from({ length: MAX_CONNECTIONS_PER_USER + 1 }, () => vi.fn());
    for (const close of closers) realtimeService.registerConnection("capped", close);
    expect(closers[0]).toHaveBeenCalledWith("replaced");
    realtimeService.closeUserConnections("capped");
  });
});
