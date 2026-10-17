import { describe, it, expect } from "vitest";
import { getRequestActor } from "./request-actor";

describe("getRequestActor", () => {
  const base = { user: { authType: "password", userId: "a1" }, headers: { "user-agent": "ua", "x-forwarded-for": "6.6.6.6" }, session: {} };

  it("uses req.ip (trust proxy aware), never the raw x-forwarded-for header", () => {
    expect(getRequestActor({ ...base, ip: "1.2.3.4" } as never)).toEqual({
      userId: "a1", ipAddress: "1.2.3.4", userAgent: "ua", impersonating: false,
    });
  });

  it("falls back to the socket address and flags impersonation", () => {
    const actor = getRequestActor({
      ...base, socket: { remoteAddress: "10.0.0.1" }, session: { impersonateOrgId: "o1" },
    } as never);
    expect(actor.ipAddress).toBe("10.0.0.1");
    expect(actor.impersonating).toBe(true);
  });

  it("401s without a signed-in user", () => {
    expect(() => getRequestActor({ headers: {} } as never)).toThrowError(/Unauthorized/);
  });
});
