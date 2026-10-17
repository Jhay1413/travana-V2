import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openid-client", () => ({}));
vi.mock("openid-client/passport", () => ({ Strategy: class {} }));
vi.mock("passport", () => ({ default: {} }));
vi.mock("express-session", () => ({ default: () => ({}) }));
vi.mock("memoizee", () => ({ default: (fn: unknown) => fn }));
vi.mock("connect-pg-simple", () => ({ default: () => class {} }));
vi.mock("../../config/session-database", () => ({ sessionDb: {} }));
vi.mock("./storage", () => ({ authStorage: { upsertUser: vi.fn() } }));
vi.mock("./resolve-account-block", () => ({ resolveAccountBlock: vi.fn() }));

import { verifyOidcLogin } from "./session";
import { authStorage } from "./storage";
import { resolveAccountBlock } from "./resolve-account-block";

const tokens = {
  claims: () => ({ sub: "s1", email: "a@b.com", exp: 1 }),
  access_token: "at",
  refresh_token: "rt",
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authStorage.upsertUser).mockResolvedValue({ id: "s1" } as never);
});

describe("verifyOidcLogin", () => {
  it("refuses a deactivated or suspended account (verified(null, false))", async () => {
    vi.mocked(resolveAccountBlock).mockResolvedValue({ code: "ACCOUNT_SUSPENDED", message: "m" });
    const verified = vi.fn();
    await verifyOidcLogin(tokens, verified);
    expect(verified).toHaveBeenCalledWith(null, false);
  });

  it("signs in an account in good standing with the claims on the session user", async () => {
    vi.mocked(resolveAccountBlock).mockResolvedValue(null);
    const verified = vi.fn();
    await verifyOidcLogin(tokens, verified);
    expect(verified).toHaveBeenCalledWith(null, expect.objectContaining({ access_token: "at", claims: expect.objectContaining({ sub: "s1" }) }));
  });
});
