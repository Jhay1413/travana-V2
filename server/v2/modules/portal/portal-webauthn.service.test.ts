import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));
vi.mock("./portal.repository", () => ({
  portalRepository: {
    findClientBasicById: vi.fn(),
    findVerifiedWebauthnForClient: vi.fn(),
    replaceWebauthnCredential: vi.fn(),
    findWebauthnByCredentialId: vi.fn(),
    updateWebauthnCounter: vi.fn(),
    findWebauthnDevicesForClient: vi.fn(),
  },
}));

import jwt from "jsonwebtoken";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { portalWebauthnService, BIOMETRIC_LOGIN_FAILED } from "./portal-webauthn.service";
import { portalRepository } from "./portal.repository";
import { resetChallengeStore } from "./portal-challenge-store";
import {
  signPortalChallengeToken,
  signPortalToken,
  verifyPortalChallengeToken,
  verifyPortalToken,
} from "./portal-auth";
import { AppError } from "../../utils/error-handler";
import type { WebauthnCredentialRow } from "./portal.types";
import { assertFreshPinSession, ENROL_FRESHNESS_MS, MAX_CREDENTIALS_PER_CLIENT, REAUTH_REQUIRED_CODE } from "./portal-webauthn.service";
import type { PortalTokenPayload } from "./portal-auth";

const repo = vi.mocked(portalRepository);
const freshSession = (clientId = "c1"): PortalTokenPayload => ({ clientId, email: "", method: "pin", iat: Math.floor(Date.now() / 1000) });
const rp = { rpID: "app.example.com", origin: "https://app.example.com" };

const assertion = {
  id: "cred-1", rawId: "cred-1", type: "public-key", clientExtensionResults: {},
  response: { clientDataJSON: "cd", authenticatorData: "ad", signature: "sig" },
} as AuthenticationResponseJSON;
const attestation = {
  id: "cred-1", rawId: "cred-1", type: "public-key", clientExtensionResults: {},
  response: { clientDataJSON: "cd", attestationObject: "ao", transports: ["internal"] },
} as RegistrationResponseJSON;

const storedCred = (over: Partial<WebauthnCredentialRow> = {}): WebauthnCredentialRow => ({
  id: "row-1", clientId: "c1", credentialId: "cred-1",
  publicKey: Buffer.from([1, 2, 3]).toString("base64url"),
  counter: 5, transports: '["internal"]', verifiedAt: new Date("2026-11-01"), ...over,
});

let jtiSeq = 0;
const loginToken = (over: Partial<{ challenge: string; jti: string }> = {}) =>
  signPortalChallengeToken({ purpose: "webauthn-login", challenge: "chal", jti: `j-${++jtiSeq}`, ...over });
const registerToken = (clientId = "c1") =>
  signPortalChallengeToken({ purpose: "webauthn-register", challenge: "chal", jti: `j-${++jtiSeq}`, clientId });

async function failure(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return e as AppError;
  }
  throw new Error("expected rejection");
}

const verifiedLogin = (newCounter: number) =>
  vi.mocked(verifyAuthenticationResponse).mockResolvedValue({
    verified: true,
    authenticationInfo: { newCounter, credentialID: "cred-1", userVerified: true, credentialDeviceType: "multiDevice", credentialBackedUp: true, origin: rp.origin, rpID: rp.rpID },
  });

beforeEach(() => {
  vi.clearAllMocks();
  resetChallengeStore();
  repo.findClientBasicById.mockResolvedValue({ id: "c1", email: "sam@example.com", firstName: "Sam", mustChangePin: false });
  repo.findWebauthnByCredentialId.mockResolvedValue(storedCred());
  repo.findVerifiedWebauthnForClient.mockResolvedValue([]);
});

describe("challenge tokens", () => {
  it("a challenge token is not a session token", () => {
    expect(verifyPortalToken(loginToken())).toBeNull();
    expect(verifyPortalToken(registerToken())).toBeNull();
  });

  it("a session token is not a challenge token", () => {
    const session = signPortalToken({ clientId: "c1", email: "" });
    expect(verifyPortalChallengeToken(session, "webauthn-login")).toBeNull();
    expect(verifyPortalChallengeToken(session, "webauthn-register")).toBeNull();
  });

  it("a login challenge cannot be used for registration and vice versa", () => {
    expect(verifyPortalChallengeToken(loginToken(), "webauthn-register")).toBeNull();
    expect(verifyPortalChallengeToken(registerToken(), "webauthn-login")).toBeNull();
  });

  it("lives for two minutes", () => {
    const claims = verifyPortalChallengeToken(loginToken(), "webauthn-login")!;
    const decoded = jwt.decode(loginToken()) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBe(120);
    expect(claims.purpose).toBe("webauthn-login");
  });
});

describe("loginOptions", () => {
  it("takes no client or credential input, so the response is identical whoever asks", async () => {
    vi.mocked(generateAuthenticationOptions).mockResolvedValue({ challenge: "chal", rpId: rp.rpID } as never);
    const a = await portalWebauthnService.loginOptions(rp);
    const b = await portalWebauthnService.loginOptions(rp);
    expect(Object.keys(a).sort()).toEqual(["challengeToken", "options"]);
    expect(Object.keys(a)).toEqual(Object.keys(b));
    expect(a.options).toEqual(b.options);
    expect(generateAuthenticationOptions).toHaveBeenCalledWith({ rpID: rp.rpID, userVerification: "required" });
    expect(repo.findWebauthnByCredentialId).not.toHaveBeenCalled();
    expect(repo.findClientBasicById).not.toHaveBeenCalled();
  });

  it("issues a login-purpose token carrying the library's challenge", async () => {
    vi.mocked(generateAuthenticationOptions).mockResolvedValue({ challenge: "xyz" } as never);
    const { challengeToken } = await portalWebauthnService.loginOptions(rp);
    expect(verifyPortalChallengeToken(challengeToken, "webauthn-login")?.challenge).toBe("xyz");
  });
});

describe("login", () => {
  it("success issues the same session as PIN login and stores the new counter", async () => {
    verifiedLogin(6);
    const r = await portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp);
    expect(r).toMatchObject({ clientId: "c1", firstName: "Sam", mustChangePin: false });
    expect(verifyPortalToken(r.token)).toMatchObject({ clientId: "c1", email: "sam@example.com" });
    expect(repo.updateWebauthnCounter).toHaveBeenCalledWith("row-1", 6);
  });

  it("verifies against the stored public key, the signed challenge, the origin and the RP ID", async () => {
    verifiedLogin(6);
    await portalWebauthnService.login({ challengeToken: loginToken({ challenge: "the-challenge" }), response: assertion }, rp);
    const opts = vi.mocked(verifyAuthenticationResponse).mock.calls[0][0];
    expect(opts.expectedChallenge).toBe("the-challenge");
    expect(opts.expectedOrigin).toBe(rp.origin);
    expect(opts.expectedRPID).toBe(rp.rpID);
    expect(opts.requireUserVerification).toBe(true);
    expect(opts.credential).toMatchObject({ id: "cred-1", counter: 5, transports: ["internal"] });
    expect(Array.from(opts.credential.publicKey)).toEqual([1, 2, 3]);
  });

  it("rejects a bad signature (library throws) with the generic 401", async () => {
    vi.mocked(verifyAuthenticationResponse).mockRejectedValue(new Error("Could not verify authentication response signature"));
    const err = await failure(portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp));
    expect([err.statusCode, err.message]).toEqual([401, BIOMETRIC_LOGIN_FAILED]);
    expect(repo.updateWebauthnCounter).not.toHaveBeenCalled();
  });

  it("rejects when the library reports verified=false", async () => {
    vi.mocked(verifyAuthenticationResponse).mockResolvedValue({ verified: false } as never);
    expect((await failure(portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp))).statusCode).toBe(401);
  });

  it("rejects a wrong challenge (library throws on mismatch) and never signs a session", async () => {
    vi.mocked(verifyAuthenticationResponse).mockRejectedValue(new Error("Unexpected authentication response challenge"));
    const err = await failure(portalWebauthnService.login({ challengeToken: loginToken({ challenge: "other" }), response: assertion }, rp));
    expect(err.message).toBe(BIOMETRIC_LOGIN_FAILED);
  });

  it("rejects an expired challenge token (valid signature, older than two minutes)", async () => {
    const token = loginToken();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 121_000);
      const err = await failure(portalWebauthnService.login({ challengeToken: token, response: assertion }, rp));
      expect(err.statusCode).toBe(401);
      expect(verifyAuthenticationResponse).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects garbage in place of a challenge token", async () => {
    expect((await failure(portalWebauthnService.login({ challengeToken: "nonsense", response: assertion }, rp))).statusCode).toBe(401);
  });

  it("rejects a session token presented as the challenge token", async () => {
    const session = signPortalToken({ clientId: "c1", email: "" });
    expect((await failure(portalWebauthnService.login({ challengeToken: session, response: assertion }, rp))).statusCode).toBe(401);
    expect(verifyAuthenticationResponse).not.toHaveBeenCalled();
  });

  it("rejects a replayed challenge: the second use of the same token fails", async () => {
    verifiedLogin(6);
    const token = loginToken();
    await portalWebauthnService.login({ challengeToken: token, response: assertion }, rp);
    const err = await failure(portalWebauthnService.login({ challengeToken: token, response: assertion }, rp));
    expect(err.statusCode).toBe(401);
    expect(verifyAuthenticationResponse).toHaveBeenCalledTimes(1);
  });

  it("burns the challenge even when the first attempt failed", async () => {
    vi.mocked(verifyAuthenticationResponse).mockRejectedValueOnce(new Error("bad"));
    const token = loginToken();
    await failure(portalWebauthnService.login({ challengeToken: token, response: assertion }, rp));
    verifiedLogin(6);
    await failure(portalWebauthnService.login({ challengeToken: token, response: assertion }, rp));
    expect(verifyAuthenticationResponse).toHaveBeenCalledTimes(1);
  });

  it("rejects a credential that has no verified public key (legacy row)", async () => {
    repo.findWebauthnByCredentialId.mockResolvedValue(storedCred({ verifiedAt: null, publicKey: "platform-verified" }));
    const err = await failure(portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp));
    expect([err.statusCode, err.message]).toEqual([401, BIOMETRIC_LOGIN_FAILED]);
    expect(verifyAuthenticationResponse).not.toHaveBeenCalled();
  });

  it("an unknown credential fails with exactly the same response as a bad signature", async () => {
    repo.findWebauthnByCredentialId.mockResolvedValue(undefined);
    const unknown = await failure(portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp));

    repo.findWebauthnByCredentialId.mockResolvedValue(storedCred());
    vi.mocked(verifyAuthenticationResponse).mockRejectedValue(new Error("bad sig"));
    const badSig = await failure(portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp));

    expect([unknown.statusCode, unknown.message]).toEqual([badSig.statusCode, badSig.message]);
  });

  describe("counter", () => {
    it("rejects a counter that goes backwards", async () => {
      verifiedLogin(3);
      const err = await failure(portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp));
      expect(err.statusCode).toBe(401);
      expect(repo.updateWebauthnCounter).not.toHaveBeenCalled();
    });

    it("rejects a counter that does not move forward", async () => {
      verifiedLogin(5);
      expect((await failure(portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp))).statusCode).toBe(401);
    });

    it("allows authenticators that always report 0", async () => {
      repo.findWebauthnByCredentialId.mockResolvedValue(storedCred({ counter: 0 }));
      verifiedLogin(0);
      await expect(portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp)).resolves.toMatchObject({ clientId: "c1" });
      expect(repo.updateWebauthnCounter).toHaveBeenCalledWith("row-1", 0);
    });

    it("rejects a drop back to 0 after a non-zero counter was seen", async () => {
      verifiedLogin(0);
      expect((await failure(portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp))).statusCode).toBe(401);
    });
  });

  it("rejects a soft-deleted client with the generic 401, without updating the counter or issuing a token", async () => {
    verifiedLogin(6);
    repo.findClientBasicById.mockResolvedValue(undefined);
    const err = await failure(portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp));
    expect([err.statusCode, err.message]).toEqual([401, BIOMETRIC_LOGIN_FAILED]);
    expect(repo.updateWebauthnCounter).not.toHaveBeenCalled();
  });

  it("reports mustChangePin so the portal's PIN gate still forces a new PIN", async () => {
    verifiedLogin(6);
    repo.findClientBasicById.mockResolvedValue({ id: "c1", email: null, firstName: "Sam", mustChangePin: true });
    const r = await portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp);
    expect(r.mustChangePin).toBe(true);
    expect(verifyPortalToken(r.token)?.email).toBe("");
  });
});

describe("registrationOptions", () => {
  it("returns server-generated options and a register-purpose token bound to the session client", async () => {
    vi.mocked(generateRegistrationOptions).mockResolvedValue({ challenge: "rc" } as never);
    repo.findVerifiedWebauthnForClient.mockResolvedValue([{ credentialId: "old", transports: '["internal"]' }]);
    const { options, challengeToken } = await portalWebauthnService.registrationOptions(freshSession(), rp);
    expect(options).toEqual({ challenge: "rc" });
    const claims = verifyPortalChallengeToken(challengeToken, "webauthn-register");
    expect(claims).toMatchObject({ challenge: "rc", clientId: "c1" });
    const args = vi.mocked(generateRegistrationOptions).mock.calls[0][0];
    expect(args.rpID).toBe(rp.rpID);
    expect(args.excludeCredentials).toEqual([{ id: "old", transports: ["internal"] }]);
    expect(args.authenticatorSelection).toMatchObject({ residentKey: "required", userVerification: "required" });
  });

  it("rejects a client that no longer exists", async () => {
    repo.findClientBasicById.mockResolvedValue(undefined);
    expect((await failure(portalWebauthnService.registrationOptions(freshSession("gone"), rp))).statusCode).toBe(401);
  });
});

describe("register", () => {
  const goodRegistration = () =>
    vi.mocked(verifyRegistrationResponse).mockResolvedValue({
      verified: true,
      registrationInfo: {
        fmt: "none", aaguid: "a", credentialType: "public-key", attestationObject: new Uint8Array(), userVerified: true,
        credentialDeviceType: "multiDevice", credentialBackedUp: true, origin: rp.origin,
        credential: { id: "cred-1", publicKey: new Uint8Array([9, 8, 7]), counter: 0, transports: ["internal"] },
      },
    } as never);

  it("verifies the attestation and stores id, base64url public key, counter and transports", async () => {
    goodRegistration();
    await portalWebauthnService.register(freshSession(), { challengeToken: registerToken(), response: attestation, deviceName: " iPhone " }, rp);
    expect(repo.replaceWebauthnCredential).toHaveBeenCalledWith(MAX_CREDENTIALS_PER_CLIENT, {
      clientId: "c1", credentialId: "cred-1", publicKey: Buffer.from([9, 8, 7]).toString("base64url"),
      counter: 0, transports: ["internal"], deviceName: "iPhone",
    });
    const opts = vi.mocked(verifyRegistrationResponse).mock.calls[0][0];
    expect(opts).toMatchObject({ expectedChallenge: "chal", expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: true });
  });

  it("rejects a challenge issued to a different client", async () => {
    const err = await failure(portalWebauthnService.register(freshSession(), { challengeToken: registerToken("someone-else"), response: attestation }, rp));
    expect(err.statusCode).toBe(400);
    expect(verifyRegistrationResponse).not.toHaveBeenCalled();
  });

  it("rejects a login challenge used for registration", async () => {
    expect((await failure(portalWebauthnService.register(freshSession(), { challengeToken: loginToken(), response: attestation }, rp))).statusCode).toBe(400);
  });

  it("rejects a replayed registration challenge", async () => {
    goodRegistration();
    const token = registerToken();
    await portalWebauthnService.register(freshSession(), { challengeToken: token, response: attestation }, rp);
    expect((await failure(portalWebauthnService.register(freshSession(), { challengeToken: token, response: attestation }, rp))).statusCode).toBe(400);
  });

  it("rejects an attestation the library cannot verify, and stores nothing", async () => {
    vi.mocked(verifyRegistrationResponse).mockRejectedValue(new Error("bad attestation"));
    expect((await failure(portalWebauthnService.register(freshSession(), { challengeToken: registerToken(), response: attestation }, rp))).statusCode).toBe(400);
    expect(repo.replaceWebauthnCredential).not.toHaveBeenCalled();
  });

  it("rejects verified=false", async () => {
    vi.mocked(verifyRegistrationResponse).mockResolvedValue({ verified: false } as never);
    await failure(portalWebauthnService.register(freshSession(), { challengeToken: registerToken(), response: attestation }, rp));
    expect(repo.replaceWebauthnCredential).not.toHaveBeenCalled();
  });
});

describe("enrolment needs a fresh PIN sign-in", () => {
  const refused = async (session: PortalTokenPayload) => {
    const e = await failure(portalWebauthnService.registrationOptions(session, rp));
    expect([e.statusCode, e.code]).toEqual([403, REAUTH_REQUIRED_CODE]);
  };

  it("refuses a token without the method claim (issued before this change)", async () => {
    await refused({ clientId: "c1", email: "", iat: Math.floor(Date.now() / 1000) });
  });

  it("refuses magic-link and Face ID sessions", async () => {
    await refused({ ...freshSession(), method: "magic-link" });
    await refused({ ...freshSession(), method: "face-id" });
  });

  it("refuses a PIN session older than 10 minutes, accepts one just inside the window", async () => {
    const now = Math.floor(Date.now() / 1000);
    await refused({ ...freshSession(), iat: now - ENROL_FRESHNESS_MS / 1000 - 5 });
    expect(() => assertFreshPinSession({ ...freshSession(), iat: now - ENROL_FRESHNESS_MS / 1000 + 30 })).not.toThrow();
  });

  it("applies to the register step too, before the challenge is even looked at", async () => {
    const e = await failure(portalWebauthnService.register({ ...freshSession(), method: "face-id" }, { challengeToken: registerToken(), response: attestation }, rp));
    expect([e.statusCode, e.code]).toEqual([403, REAUTH_REQUIRED_CODE]);
    expect(verifyRegistrationResponse).not.toHaveBeenCalled();
  });

  it("a magic-link session becomes eligible only through change-pin's reissued PIN session", () => {
    expect(() => assertFreshPinSession({ ...freshSession(), method: "pin" })).not.toThrow();
  });
});

describe("credential ownership and limits on register", () => {
  const goodRegistration = () =>
    vi.mocked(verifyRegistrationResponse).mockResolvedValue({
      verified: true,
      registrationInfo: {
        fmt: "none", aaguid: "a", credentialType: "public-key", attestationObject: new Uint8Array(), userVerified: true,
        credentialDeviceType: "multiDevice", credentialBackedUp: true, origin: rp.origin,
        credential: { id: "cred-1", publicKey: new Uint8Array([9]), counter: 0, transports: ["internal"] },
      },
    } as never);

  it("refuses a credential id that already belongs to a different customer", async () => {
    goodRegistration();
    repo.findWebauthnByCredentialId.mockResolvedValue(storedCred({ clientId: "someone-else" }));
    const err = await failure(portalWebauthnService.register(freshSession(), { challengeToken: registerToken(), response: attestation }, rp));
    expect(err.statusCode).toBe(400);
    expect(repo.replaceWebauthnCredential).not.toHaveBeenCalled();
  });

  it("lets the same customer re-enrol their own credential id", async () => {
    goodRegistration();
    repo.findWebauthnByCredentialId.mockResolvedValue(storedCred({ clientId: "c1" }));
    await portalWebauthnService.register(freshSession(), { challengeToken: registerToken(), response: attestation }, rp);
    expect(repo.replaceWebauthnCredential).toHaveBeenCalledTimes(1);
  });

  it("passes the per-customer cap (5, oldest replaced) to the repository", async () => {
    goodRegistration();
    repo.findWebauthnByCredentialId.mockResolvedValue(undefined);
    await portalWebauthnService.register(freshSession(), { challengeToken: registerToken(), response: attestation }, rp);
    expect(vi.mocked(repo.replaceWebauthnCredential).mock.calls[0][0]).toBe(5);
  });
});

describe("login when the verified_at/transports columns are not in the database yet", () => {
  it("answers the generic 401 (not a 500) and logs once", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    repo.findWebauthnByCredentialId.mockRejectedValue(new Error('column "verified_at" does not exist'));
    const a = await failure(portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp));
    const b = await failure(portalWebauthnService.login({ challengeToken: loginToken(), response: assertion }, rp));
    expect([a.statusCode, a.message]).toEqual([401, BIOMETRIC_LOGIN_FAILED]);
    expect([b.statusCode, b.message]).toEqual([401, BIOMETRIC_LOGIN_FAILED]);
    expect(log.mock.calls.filter((c) => String(c[0]).includes("credential lookup failed")).length).toBeLessThanOrEqual(1);
  });
});

describe("check", () => {
  it("counts only verified devices and answers hasBiometric false on error", async () => {
    repo.findWebauthnDevicesForClient.mockResolvedValue([{ id: "d", deviceName: "iPhone" }]);
    expect(await portalWebauthnService.check("c1")).toEqual({ hasBiometric: true, devices: [{ id: "d", deviceName: "iPhone" }] });
    repo.findWebauthnDevicesForClient.mockRejectedValue(new Error("boom"));
    expect(await portalWebauthnService.check("c1")).toEqual({ hasBiometric: false });
  });
});
