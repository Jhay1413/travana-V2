import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("./portal.repository", () => ({
  portalRepository: {
    isClientActive: vi.fn(),
    findLoginCandidates: vi.fn(),
    findActiveOrgIdBySlug: vi.fn(),
    findWebauthnCredentialIdsForClient: vi.fn(),
    findClientProfile: vi.fn(),
  },
}));
vi.mock("./portal-login-token.repository", () => ({ portalLoginTokenRepository: { redeem: vi.fn() } }));
vi.mock("../neon-client/neon-client.repository", () => ({ neonClientRepository: { setPortalPin: vi.fn() } }));

import { portalAuthService, portalPinLockout, INVALID_CREDENTIALS_MESSAGE, PIN_LOCKED_MESSAGE, PIN_DAILY_BUDGET_MESSAGE, LOGIN_COMPARE_COUNT } from "./portal-auth.service";
import { PIN_DAILY_MAX_FAILURES, PIN_DAILY_WINDOW_MS } from "./portal-pin-lockout";
import type { PortalAuthMethod } from "./portal-auth";
import { portalRepository } from "./portal.repository";
import { portalLoginTokenRepository } from "./portal-login-token.repository";
import { neonClientRepository } from "../neon-client/neon-client.repository";
import { signPortalToken, verifyPortalToken } from "./portal-auth";
import { AppError } from "../../utils/error-handler";
import type { LoginCandidate } from "./portal.types";

const repo = vi.mocked(portalRepository);
const session = (method?: PortalAuthMethod) => ({ clientId: "c1", email: "sam@example.com", method });
const hash = (pin: string) => bcrypt.hashSync(pin, 4);

function candidate(over: Partial<LoginCandidate> & { id: string }): LoginCandidate {
  return { email: "sam@example.com", firstName: "Sam", portalPin: hash("4821"), mustChangePin: false, orgId: null, ...over };
}

async function failure(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return e as AppError;
  }
  throw new Error("expected rejection");
}

beforeEach(() => {
  vi.clearAllMocks();
  portalPinLockout.clearAll();
  repo.findWebauthnCredentialIdsForClient.mockResolvedValue([]);
});

describe("login", () => {
  it("signs in with the right PIN and returns the contract fields", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1" })]);
    repo.findWebauthnCredentialIdsForClient.mockResolvedValue([{ id: "w1" }]);
    const r = await portalAuthService.login({ email: "Sam@Example.com", pin: "4821" });
    expect(r).toMatchObject({ clientId: "c1", firstName: "Sam", hasBiometric: true, mustChangePin: false });
    expect(verifyPortalToken(r.token)).toMatchObject({ clientId: "c1", email: "sam@example.com" });
  });

  it("rejects a wrong PIN with 401", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1" })]);
    const err = await failure(portalAuthService.login({ email: "sam@example.com", pin: "0000" }));
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it("refuses the default PIN while mustChangePin is set with the SAME generic 401 (no account confirmation)", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1", portalPin: hash("1234"), mustChangePin: true })]);
    const blocked = await failure(portalAuthService.login({ email: "sam@example.com", pin: "1234" }));
    repo.findLoginCandidates.mockResolvedValue([]);
    const unknown = await failure(portalAuthService.login({ email: "ghost@example.com", pin: "1234" }));
    expect([blocked.statusCode, blocked.message]).toEqual([401, INVALID_CREDENTIALS_MESSAGE]);
    expect([blocked.statusCode, blocked.message]).toEqual([unknown.statusCode, unknown.message]);
    expect(repo.findWebauthnCredentialIdsForClient).not.toHaveBeenCalled();
  });

  it("allows the default PIN once the client no longer has to change it", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1", portalPin: hash("1234"), mustChangePin: false })]);
    const r = await portalAuthService.login({ email: "sam@example.com", pin: "1234" });
    expect(r.clientId).toBe("c1");
  });

  it("allows a non-default PIN while mustChangePin is set and reports the flag", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1", mustChangePin: true })]);
    const r = await portalAuthService.login({ email: "sam@example.com", pin: "4821" });
    expect(r.mustChangePin).toBe(true);
  });

  it("prefers the row that has a PIN over a PIN-less duplicate (v1 behaviour)", async () => {
    repo.findLoginCandidates.mockResolvedValue([
      candidate({ id: "noPin", portalPin: null }),
      candidate({ id: "withPin" }),
    ]);
    const r = await portalAuthService.login({ email: "sam@example.com", pin: "4821" });
    expect(r.clientId).toBe("withPin");
  });

  it("rejects when the only matching row has no PIN, with the same generic error", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "noPin", portalPin: null })]);
    const err = await failure(portalAuthService.login({ email: "sam@example.com", pin: "4821" }));
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it("rejects an unknown or soft-deleted email (repository returns no rows) with the same generic error", async () => {
    repo.findLoginCandidates.mockResolvedValue([]);
    const err = await failure(portalAuthService.login({ email: "ghost@example.com", pin: "4821" }));
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it("gives identical errors for unknown email, no PIN set and wrong PIN (never reveals the email exists)", async () => {
    repo.findLoginCandidates.mockResolvedValueOnce([]);
    const unknown = await failure(portalAuthService.login({ email: "a@b.com", pin: "4821" }));
    repo.findLoginCandidates.mockResolvedValueOnce([candidate({ id: "x", portalPin: null })]);
    const noPin = await failure(portalAuthService.login({ email: "a@b.com", pin: "4821" }));
    repo.findLoginCandidates.mockResolvedValueOnce([candidate({ id: "x" })]);
    const wrong = await failure(portalAuthService.login({ email: "a@b.com", pin: "9999" }));
    for (const e of [unknown, noPin, wrong]) {
      expect([e.statusCode, e.message]).toEqual([401, INVALID_CREDENTIALS_MESSAGE]);
    }
  });

  describe("same email in two agencies", () => {
    const agencyA = candidate({ id: "a1", portalPin: hash("1111") });
    const agencyB = candidate({ id: "b1", portalPin: hash("2222") });

    it("without a slug, the candidate whose PIN matches signs in", async () => {
      repo.findLoginCandidates.mockResolvedValue([agencyA, agencyB]);
      const r = await portalAuthService.login({ email: "sam@example.com", pin: "2222" });
      expect(r.clientId).toBe("b1");
      expect(repo.findLoginCandidates).toHaveBeenCalledWith("sam@example.com", undefined, LOGIN_COMPARE_COUNT);
    });

    it("without a slug and the same PIN on both, the first candidate (repository order) wins deterministically", async () => {
      const same = hash("5555");
      repo.findLoginCandidates.mockResolvedValue([
        candidate({ id: "older", portalPin: same }),
        candidate({ id: "newer", portalPin: same }),
      ]);
      const r = await portalAuthService.login({ email: "sam@example.com", pin: "5555" });
      expect(r.clientId).toBe("older");
    });

    it("with a slug, only that agency's clients are asked for", async () => {
      repo.findActiveOrgIdBySlug.mockResolvedValue("org-a");
      repo.findLoginCandidates.mockResolvedValue([agencyA]);
      const r = await portalAuthService.login({ email: "sam@example.com", pin: "1111", orgSlug: " Agency-A " });
      expect(r.clientId).toBe("a1");
      expect(repo.findActiveOrgIdBySlug).toHaveBeenCalledWith("agency-a");
      expect(repo.findLoginCandidates).toHaveBeenCalledWith("sam@example.com", "org-a", LOGIN_COMPARE_COUNT);
    });

    it("with a slug, the other agency's PIN does not sign in", async () => {
      repo.findActiveOrgIdBySlug.mockResolvedValue("org-a");
      repo.findLoginCandidates.mockResolvedValue([agencyA]);
      const err = await failure(portalAuthService.login({ email: "sam@example.com", pin: "2222", orgSlug: "agency-a" }));
      expect(err.statusCode).toBe(401);
    });

    it("an unknown or inactive slug fails with the generic error and never queries clients", async () => {
      repo.findActiveOrgIdBySlug.mockResolvedValue(null);
      const err = await failure(portalAuthService.login({ email: "sam@example.com", pin: "1111", orgSlug: "nope" }));
      expect([err.statusCode, err.message]).toEqual([401, INVALID_CREDENTIALS_MESSAGE]);
      expect(repo.findLoginCandidates).not.toHaveBeenCalled();
    });
  });
});

describe("PIN login never fails because of Face ID storage", () => {
  it("reports hasBiometric false and still signs in when the credentials lookup throws (columns not pushed yet)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1" })]);
    repo.findWebauthnCredentialIdsForClient.mockRejectedValue(new Error('column "verified_at" does not exist'));
    const r = await portalAuthService.login({ email: "sam@example.com", pin: "4821" });
    expect(r).toMatchObject({ clientId: "c1", hasBiometric: false });
    expect(verifyPortalToken(r.token)?.clientId).toBe("c1");
    await portalAuthService.login({ email: "sam@example.com", pin: "4821" });
    expect(log.mock.calls.filter((c) => String(c[0]).includes("Face ID lookup failed")).length).toBeLessThanOrEqual(1);
  });
});

describe("per-account lockout", () => {
  const wrong = () => portalAuthService.login({ email: "Sam@Example.com", pin: "0000" });

  it("locks PIN sign-in after 5 wrong tries, even for the correct PIN, with a 429 pointing to the text link", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1" })]);
    for (let i = 0; i < 5; i++) expect((await failure(wrong())).statusCode).toBe(401);
    repo.findLoginCandidates.mockClear();
    const locked = await failure(portalAuthService.login({ email: "sam@example.com", pin: "4821" }));
    expect([locked.statusCode, locked.message]).toEqual([429, PIN_LOCKED_MESSAGE]);
    expect(PIN_LOCKED_MESSAGE).toContain("sign-in link we sent you");
    expect(repo.findLoginCandidates).not.toHaveBeenCalled();
  });

  it("answers the same for a made-up email: the lock is keyed on what was typed, not on whether an account exists", async () => {
    repo.findLoginCandidates.mockResolvedValue([]);
    for (let i = 0; i < 5; i++) await failure(portalAuthService.login({ email: "ghost@example.com", pin: "0000" }));
    const locked = await failure(portalAuthService.login({ email: "ghost@example.com", pin: "0000" }));
    expect([locked.statusCode, locked.message]).toEqual([429, PIN_LOCKED_MESSAGE]);
  });

  it("is case-insensitive on the email and separate per agency slug", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1" })]);
    for (let i = 0; i < 5; i++) await failure(wrong());
    expect((await failure(portalAuthService.login({ email: "SAM@example.COM", pin: "0000" }))).statusCode).toBe(429);
    repo.findActiveOrgIdBySlug.mockResolvedValue("org-a");
    const other = await portalAuthService.login({ email: "sam@example.com", pin: "4821", orgSlug: "agency-a" });
    expect(other.clientId).toBe("c1");
  });

  it("counts failures only: a successful sign-in resets the count", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1" })]);
    for (let i = 0; i < 4; i++) await failure(wrong());
    await portalAuthService.login({ email: "sam@example.com", pin: "4821" });
    for (let i = 0; i < 4; i++) await failure(wrong());
    await expect(portalAuthService.login({ email: "sam@example.com", pin: "4821" })).resolves.toMatchObject({ clientId: "c1" });
  });

  it("4 wrong tries do not lock", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1" })]);
    for (let i = 0; i < 4; i++) await failure(wrong());
    await expect(portalAuthService.login({ email: "sam@example.com", pin: "4821" })).resolves.toBeDefined();
  });

  it("does not touch the magic link", async () => {
    repo.findLoginCandidates.mockResolvedValue([]);
    for (let i = 0; i < 5; i++) await failure(portalAuthService.login({ email: "sam@example.com", pin: "0000" }));
    vi.mocked(portalLoginTokenRepository.redeem).mockResolvedValue({ clientId: "c1" });
    repo.findClientProfile.mockResolvedValue({ firstName: "Sam", lastName: "S", email: "sam@example.com", phone: null, avatarUrl: null, mustChangePin: false });
    await expect(portalAuthService.magicLogin("abc")).resolves.toMatchObject({ clientId: "c1" });
  });
});

describe("preferOrg (remembered agency)", () => {
  const inA = candidate({ id: "a1", orgId: "org-a", portalPin: hash("7777") });
  const inB = candidate({ id: "b1", orgId: "org-b", portalPin: hash("7777") });

  it("breaks a tie between PIN-matching accounts in favour of the preferred agency", async () => {
    repo.findLoginCandidates.mockResolvedValue([inA, inB]);
    repo.findActiveOrgIdBySlug.mockResolvedValue("org-b");
    const r = await portalAuthService.login({ email: "sam@example.com", pin: "7777", preferOrgSlug: "agency-b" });
    expect(r.clientId).toBe("b1");
    expect(repo.findLoginCandidates).toHaveBeenCalledWith("sam@example.com", undefined, LOGIN_COMPARE_COUNT);
  });

  it("never filters: a non-matching preferred agency does not block the other account", async () => {
    repo.findLoginCandidates.mockResolvedValue([inA, candidate({ id: "b1", orgId: "org-b", portalPin: hash("9999") })]);
    repo.findActiveOrgIdBySlug.mockResolvedValue("org-b");
    const r = await portalAuthService.login({ email: "sam@example.com", pin: "7777", preferOrgSlug: "agency-b" });
    expect(r.clientId).toBe("a1");
  });

  it("an unknown or stale preferOrg changes nothing", async () => {
    repo.findLoginCandidates.mockResolvedValue([inA, inB]);
    repo.findActiveOrgIdBySlug.mockResolvedValue(null);
    expect((await portalAuthService.login({ email: "sam@example.com", pin: "7777", preferOrgSlug: "gone" })).clientId).toBe("a1");
  });

  it("a junk preferOrg is ignored without even a lookup", async () => {
    repo.findLoginCandidates.mockResolvedValue([inA, inB]);
    const r = await portalAuthService.login({ email: "sam@example.com", pin: "7777", preferOrgSlug: "../x y" });
    expect(r.clientId).toBe("a1");
    expect(repo.findActiveOrgIdBySlug).not.toHaveBeenCalled();
  });

  it("is ignored when an explicit org filter is present", async () => {
    repo.findActiveOrgIdBySlug.mockResolvedValue("org-a");
    repo.findLoginCandidates.mockResolvedValue([inA]);
    const r = await portalAuthService.login({ email: "sam@example.com", pin: "7777", orgSlug: "agency-a", preferOrgSlug: "agency-b" });
    expect(r.clientId).toBe("a1");
    expect(repo.findActiveOrgIdBySlug).toHaveBeenCalledTimes(1);
  });
});

describe("verifySession", () => {
  it("rejects a missing bearer header with 401", async () => {
    expect((await failure(portalAuthService.verifySession(undefined))).statusCode).toBe(401);
  });

  it("rejects a bad token with 401", async () => {
    const err = await failure(portalAuthService.verifySession("Bearer nonsense"));
    expect([err.statusCode, err.message]).toEqual([401, "Invalid token"]);
  });

  it("rejects a soft-deleted client's existing session immediately", async () => {
    repo.isClientActive.mockResolvedValue(false);
    const token = signPortalToken({ clientId: "gone", email: "" });
    const err = await failure(portalAuthService.verifySession(`Bearer ${token}`));
    expect([err.statusCode, err.message]).toEqual([401, "Account not available"]);
  });

  it("returns the payload for a live client", async () => {
    repo.isClientActive.mockResolvedValue(true);
    const token = signPortalToken({ clientId: "c1", email: "a@b.com" });
    await expect(portalAuthService.verifySession(`Bearer ${token}`)).resolves.toMatchObject({ clientId: "c1" });
  });

  it("answers 500 when the liveness check itself fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    repo.isClientActive.mockRejectedValue(new Error("db down"));
    const token = signPortalToken({ clientId: "c1", email: "" });
    expect((await failure(portalAuthService.verifySession(`Bearer ${token}`))).statusCode).toBe(500);
  });
});

describe("magicLogin", () => {
  it("rejects an expired or used code with 401", async () => {
    vi.mocked(portalLoginTokenRepository.redeem).mockResolvedValue(null);
    const err = await failure(portalAuthService.magicLogin("abc"));
    expect(err.statusCode).toBe(401);
    expect(err.message).toContain("expired or was already used");
  });

  it("rejects a code for a deleted client with 401", async () => {
    vi.mocked(portalLoginTokenRepository.redeem).mockResolvedValue({ clientId: "c1" });
    repo.findClientProfile.mockResolvedValue(undefined);
    expect((await failure(portalAuthService.magicLogin("abc"))).message).toBe("Account not found");
  });

  it("returns a session and the mustChangePin flag", async () => {
    vi.mocked(portalLoginTokenRepository.redeem).mockResolvedValue({ clientId: "c1" });
    repo.findClientProfile.mockResolvedValue({
      firstName: "Sam", lastName: "S", email: "sam@example.com", phone: null, avatarUrl: null, mustChangePin: true,
    });
    const r = await portalAuthService.magicLogin("abc");
    expect(r).toMatchObject({ clientId: "c1", firstName: "Sam", mustChangePin: true });
    expect(verifyPortalToken(r.token)?.clientId).toBe("c1");
  });
});

describe("session method claim", () => {
  it("PIN login signs a pin-method session", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1" })]);
    const r = await portalAuthService.login({ email: "sam@example.com", pin: "4821" });
    const payload = verifyPortalToken(r.token);
    expect(payload?.method).toBe("pin");
    expect(typeof payload?.iat).toBe("number");
  });

  it("magic link signs a magic-link-method session", async () => {
    vi.mocked(portalLoginTokenRepository.redeem).mockResolvedValue({ clientId: "c1" });
    repo.findClientProfile.mockResolvedValue({ firstName: "Sam", lastName: "S", email: "sam@example.com", phone: null, avatarUrl: null, mustChangePin: true });
    expect(verifyPortalToken((await portalAuthService.magicLogin("abc")).token)?.method).toBe("magic-link");
  });

  it("change-pin after a magic link reissues a fresh pin-method session", async () => {
    const r = await portalAuthService.changePin(session("magic-link"), "9876");
    expect(verifyPortalToken(r.token!)).toMatchObject({ clientId: "c1", method: "pin" });
  });

  it("change-pin from any other session does not mint a new token (a stolen token cannot upgrade itself)", async () => {
    expect((await portalAuthService.changePin(session("face-id"), "9876")).token).toBeUndefined();
    expect((await portalAuthService.changePin(session(undefined), "9876")).token).toBeUndefined();
    expect((await portalAuthService.changePin(session("pin"), "9876")).token).toBeUndefined();
  });
});

describe("explicit Face ID check flag", () => {
  it("biometricCheckFailed is false normally and true when the lookup throws; hasBiometric is never overloaded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1" })]);
    repo.findWebauthnCredentialIdsForClient.mockResolvedValueOnce([]);
    expect(await portalAuthService.login({ email: "sam@example.com", pin: "4821" })).toMatchObject({ hasBiometric: false, biometricCheckFailed: false });
    repo.findWebauthnCredentialIdsForClient.mockRejectedValueOnce(new Error("no column"));
    expect(await portalAuthService.login({ email: "sam@example.com", pin: "4821" })).toMatchObject({ hasBiometric: false, biometricCheckFailed: true });
  });
});

describe("constant bcrypt work per attempt", { timeout: 30_000 }, () => {
  async function countCompares(candidates: LoginCandidate[]): Promise<number> {
    const spy = vi.spyOn(bcrypt, "compare");
    spy.mockClear();
    repo.findLoginCandidates.mockResolvedValue(candidates);
    await portalAuthService.login({ email: "x@example.com", pin: "0000" }).catch(() => undefined);
    const n = spy.mock.calls.length;
    spy.mockRestore();
    return n;
  }

  it("costs the same number of compares for 0, 1, 2 and 3 PIN-holding records, and for PIN-less ones", async () => {
    const pin = (id: string) => candidate({ id, portalPin: hash("4821") });
    const counts = [
      await countCompares([]),
      await countCompares([pin("a")]),
      await countCompares([pin("a"), pin("b")]),
      await countCompares([pin("a"), pin("b"), pin("c")]),
      await countCompares([candidate({ id: "n", portalPin: null })]),
    ];
    expect(new Set(counts)).toEqual(new Set([LOGIN_COMPARE_COUNT]));
  });

  it("an unknown agency slug costs the same as everything else", async () => {
    repo.findActiveOrgIdBySlug.mockResolvedValue(null);
    const spy = vi.spyOn(bcrypt, "compare");
    spy.mockClear();
    await portalAuthService.login({ email: "x@example.com", pin: "0000", orgSlug: "nope" }).catch(() => undefined);
    expect(spy.mock.calls.length).toBe(LOGIN_COMPARE_COUNT);
    spy.mockRestore();
  });

  it("asks the repository for at most LOGIN_COMPARE_COUNT candidates", async () => {
    repo.findLoginCandidates.mockResolvedValue([]);
    await portalAuthService.login({ email: "x@example.com", pin: "0000" }).catch(() => undefined);
    expect(repo.findLoginCandidates).toHaveBeenCalledWith("x@example.com", undefined, LOGIN_COMPARE_COUNT);
  });
});

describe("daily per-email PIN budget", { timeout: 60_000 }, () => {
  const attempt = (email: string, orgSlug?: string, pin = "0000") => portalAuthService.login({ email, pin, orgSlug });

  it("counts failures across different org values and then refuses PIN sign-in with the daily message", async () => {
    repo.findLoginCandidates.mockResolvedValue([]);
    repo.findActiveOrgIdBySlug.mockResolvedValue("org-x");
    // Spread across org values so no single 5-in-15 lock ever trips first.
    for (let i = 0; i < PIN_DAILY_MAX_FAILURES; i++) {
      const e = await failure(attempt("budget@example.com", i % 2 === 0 ? undefined : "org-" + (i % 7)));
      expect(e.statusCode).toBe(401);
      portalPinLockout.reset("budget@example.com|" + (i % 2 === 0 ? "" : "org-" + (i % 7)));
    }
    repo.findLoginCandidates.mockClear();
    const refused = await failure(attempt("Budget@Example.com", "yet-another-org"));
    expect([refused.statusCode, refused.message]).toEqual([429, PIN_DAILY_BUDGET_MESSAGE]);
    expect(PIN_DAILY_BUDGET_MESSAGE).toContain("until tomorrow");
    expect(PIN_DAILY_BUDGET_MESSAGE).toContain("sign-in link we sent you");
    expect(repo.findLoginCandidates).not.toHaveBeenCalled();
    expect(repo.findActiveOrgIdBySlug).toHaveBeenCalledTimes(PIN_DAILY_MAX_FAILURES / 2);
  });

  it("refuses an unknown email exactly like a real one (same status and message, no lookups)", async () => {
    repo.findLoginCandidates.mockResolvedValue([]);
    for (let i = 0; i < PIN_DAILY_MAX_FAILURES; i++) {
      await attempt("ghost@example.com", undefined).catch(() => undefined);
      portalPinLockout.reset("ghost@example.com|");
    }
    const refused = await failure(attempt("ghost@example.com"));
    expect([refused.statusCode, refused.message]).toEqual([429, PIN_DAILY_BUDGET_MESSAGE]);
  });

  it("a successful PIN sign-in does NOT reset the daily count", async () => {
    repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1" })]);
    for (let i = 0; i < PIN_DAILY_MAX_FAILURES - 1; i++) {
      await attempt("sam@example.com").catch(() => undefined);
      portalPinLockout.reset("sam@example.com|");
    }
    // One success (owner signs in), then a single further failure uses the last of the budget.
    await expect(attempt("sam@example.com", undefined, "4821")).resolves.toMatchObject({ clientId: "c1" });
    await failure(attempt("sam@example.com"));
    expect((await failure(attempt("sam@example.com", undefined, "4821"))).message).toBe(PIN_DAILY_BUDGET_MESSAGE);
  });

  it("ages out after 24 hours (fake timers)", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-24T09:00:00Z"));
      repo.findLoginCandidates.mockResolvedValue([candidate({ id: "c1" })]);
      for (let i = 0; i < PIN_DAILY_MAX_FAILURES; i++) {
        await attempt("sam@example.com").catch(() => undefined);
        portalPinLockout.reset("sam@example.com|");
      }
      expect((await failure(attempt("sam@example.com", undefined, "4821"))).statusCode).toBe(429);

      vi.setSystemTime(new Date(Date.now() + PIN_DAILY_WINDOW_MS - 60_000));
      expect((await failure(attempt("sam@example.com", undefined, "4821"))).statusCode).toBe(429);

      vi.setSystemTime(new Date(Date.now() + 2 * 60_000));
      await expect(attempt("sam@example.com", undefined, "4821")).resolves.toMatchObject({ clientId: "c1" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not affect the magic link", async () => {
    repo.findLoginCandidates.mockResolvedValue([]);
    for (let i = 0; i < PIN_DAILY_MAX_FAILURES; i++) {
      await attempt("sam@example.com").catch(() => undefined);
      portalPinLockout.reset("sam@example.com|");
    }
    vi.mocked(portalLoginTokenRepository.redeem).mockResolvedValue({ clientId: "c1" });
    repo.findClientProfile.mockResolvedValue({ firstName: "Sam", lastName: "S", email: "sam@example.com", phone: null, avatarUrl: null, mustChangePin: false });
    await expect(portalAuthService.magicLogin("abc")).resolves.toMatchObject({ clientId: "c1" });
  });
});

describe("changePin", () => {
  it("rejects the default PIN with 400", async () => {
    const err = await failure(portalAuthService.changePin(session("pin"), "1234"));
    expect(err.statusCode).toBe(400);
    expect(neonClientRepository.setPortalPin).not.toHaveBeenCalled();
  });

  it("rejects a malformed PIN with 400", async () => {
    expect((await failure(portalAuthService.changePin(session("pin"), "12a4"))).statusCode).toBe(400);
  });

  it("stores a bcrypt hash and clears the must-change flag", async () => {
    await portalAuthService.changePin(session("pin"), "9876");
    const [id, stored, opts] = vi.mocked(neonClientRepository.setPortalPin).mock.calls[0];
    expect(id).toBe("c1");
    expect(await bcrypt.compare("9876", stored as string)).toBe(true);
    expect(opts).toEqual({ mustChange: false });
  });
});
