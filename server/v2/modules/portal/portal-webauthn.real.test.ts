import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

// Deliberately does NOT mock @simplewebauthn/server: a real P-256 authenticator is
// simulated with node:crypto, and the real library verifies what it produces.
vi.mock("./portal.repository", () => ({
  portalRepository: {
    findWebauthnByCredentialId: vi.fn(),
    findClientBasicById: vi.fn(),
    updateWebauthnCounter: vi.fn(),
  },
}));

import { portalWebauthnService, BIOMETRIC_LOGIN_FAILED } from "./portal-webauthn.service";
import { portalRepository } from "./portal.repository";
import { resetChallengeStore } from "./portal-challenge-store";
import { verifyPortalToken } from "./portal-auth";
import { AppError } from "../../utils/error-handler";

const repo = vi.mocked(portalRepository);
const rp = { rpID: "app.example.com", origin: "https://app.example.com" };

const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64url");
const sha256 = (data: Buffer | string) => crypto.createHash("sha256").update(data).digest();

// ── a fake platform authenticator ───────────────────────────────────────────
const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = publicKey.export({ format: "jwk" });
const x = Buffer.from(jwk.x as string, "base64url");
const y = Buffer.from(jwk.y as string, "base64url");
// COSE_Key for ES256: {1:2 (EC2), 3:-7 (ES256), -1:1 (P-256), -2:x, -3:y}
const coseKey = Buffer.concat([
  Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]), x,
  Buffer.from([0x22, 0x58, 0x20]), y,
]);
const credentialId = b64u(crypto.randomBytes(16));

const counterBytes = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};

interface AssertionParts {
  clientDataJSON: Buffer;
  authenticatorData: Buffer;
  signature: Buffer;
}

function makeAssertion(challenge: string, counter: number, overrides: { origin?: string; rpID?: string } = {}): AssertionParts {
  const clientDataJSON = Buffer.from(
    JSON.stringify({ type: "webauthn.get", challenge, origin: overrides.origin ?? rp.origin, crossOrigin: false }),
  );
  // rpIdHash || flags (UP | UV) || signCount
  const authenticatorData = Buffer.concat([sha256(overrides.rpID ?? rp.rpID), Buffer.from([0x05]), counterBytes(counter)]);
  const signature = crypto.sign("sha256", Buffer.concat([authenticatorData, sha256(clientDataJSON)]), privateKey);
  return { clientDataJSON, authenticatorData, signature };
}

const toResponse = (p: AssertionParts) => ({
  id: credentialId,
  rawId: credentialId,
  type: "public-key" as const,
  clientExtensionResults: {},
  response: {
    clientDataJSON: b64u(p.clientDataJSON),
    authenticatorData: b64u(p.authenticatorData),
    signature: b64u(p.signature),
  },
});

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
  resetChallengeStore();
  repo.findWebauthnByCredentialId.mockResolvedValue({
    id: "row-1", clientId: "c1", credentialId, publicKey: b64u(coseKey), counter: 5, transports: null, verifiedAt: new Date("2026-11-01"),
  });
  repo.findClientBasicById.mockResolvedValue({ id: "c1", email: "sam@example.com", firstName: "Sam", mustChangePin: false });
});

describe("Face ID login through the real @simplewebauthn/server", () => {
  it("a validly signed assertion signs in and stores the new counter", async () => {
    const { options, challengeToken } = await portalWebauthnService.loginOptions(rp);
    const response = toResponse(makeAssertion(options.challenge, 6));

    const result = await portalWebauthnService.login({ challengeToken, response }, rp);

    expect(result).toMatchObject({ clientId: "c1", firstName: "Sam", mustChangePin: false });
    expect(verifyPortalToken(result.token)).toMatchObject({ clientId: "c1", method: "face-id" });
    expect(repo.updateWebauthnCounter).toHaveBeenCalledWith("row-1", 6);
  });

  it("a tampered signature gets the generic 401 and changes nothing", async () => {
    const { options, challengeToken } = await portalWebauthnService.loginOptions(rp);
    const parts = makeAssertion(options.challenge, 6);
    const bad = Buffer.from(parts.signature);
    bad[bad.length - 1] ^= 0xff;

    const err = await failure(portalWebauthnService.login({ challengeToken, response: toResponse({ ...parts, signature: bad }) }, rp));

    expect([err.statusCode, err.message]).toEqual([401, BIOMETRIC_LOGIN_FAILED]);
    expect(repo.updateWebauthnCounter).not.toHaveBeenCalled();
  });

  it("authenticator data altered after signing (counter bumped) fails the signature check", async () => {
    const { options, challengeToken } = await portalWebauthnService.loginOptions(rp);
    const parts = makeAssertion(options.challenge, 6);
    const forged = Buffer.concat([parts.authenticatorData.subarray(0, 33), counterBytes(99)]);
    const err = await failure(portalWebauthnService.login({ challengeToken, response: toResponse({ ...parts, authenticatorData: forged }) }, rp));
    expect(err.statusCode).toBe(401);
  });

  it("an assertion signed over a different challenge is rejected", async () => {
    const { challengeToken } = await portalWebauthnService.loginOptions(rp);
    const other = await portalWebauthnService.loginOptions(rp);
    const err = await failure(portalWebauthnService.login({ challengeToken, response: toResponse(makeAssertion(other.options.challenge, 6)) }, rp));
    expect(err.statusCode).toBe(401);
  });

  it("an assertion from the wrong origin or for the wrong RP ID is rejected", async () => {
    const a = await portalWebauthnService.loginOptions(rp);
    expect((await failure(portalWebauthnService.login({ challengeToken: a.challengeToken, response: toResponse(makeAssertion(a.options.challenge, 6, { origin: "https://evil.example" })) }, rp))).statusCode).toBe(401);
    const b = await portalWebauthnService.loginOptions(rp);
    expect((await failure(portalWebauthnService.login({ challengeToken: b.challengeToken, response: toResponse(makeAssertion(b.options.challenge, 6, { rpID: "evil.example" })) }, rp))).statusCode).toBe(401);
  });

  it("a valid assertion with a counter that did not advance is rejected", async () => {
    const { options, challengeToken } = await portalWebauthnService.loginOptions(rp);
    const err = await failure(portalWebauthnService.login({ challengeToken, response: toResponse(makeAssertion(options.challenge, 5)) }, rp));
    expect(err.statusCode).toBe(401);
    expect(repo.updateWebauthnCounter).not.toHaveBeenCalled();
  });

  it("the same valid assertion cannot be replayed with the same challenge token", async () => {
    const { options, challengeToken } = await portalWebauthnService.loginOptions(rp);
    const response = toResponse(makeAssertion(options.challenge, 6));
    await portalWebauthnService.login({ challengeToken, response }, rp);
    const err = await failure(portalWebauthnService.login({ challengeToken, response }, rp));
    expect(err.statusCode).toBe(401);
    expect(repo.updateWebauthnCounter).toHaveBeenCalledTimes(1);
  });
});

describe("two hosts: a passkey registered on the staff host is used on the portal host (real verification)", () => {
  // RP ID is the staff hostname, the page is on its portal subdomain: what resolveWebauthnRp returns for that set-up.
  const twoHosts = {
    rpID: "app.example.com",
    origin: "https://portal.app.example.com",
    origins: ["https://portal.app.example.com", "https://app.example.com"],
  };

  it("an assertion made on the PORTAL origin against the STAFF-host RP ID signs in", async () => {
    const { options, challengeToken } = await portalWebauthnService.loginOptions(twoHosts);
    expect(options.rpId).toBe("app.example.com");
    const response = toResponse(makeAssertion(options.challenge, 6, { origin: "https://portal.app.example.com" }));
    const result = await portalWebauthnService.login({ challengeToken, response }, twoHosts);
    expect(result).toMatchObject({ clientId: "c1" });
  });

  it("an assertion made on the STAFF origin still signs in while both are in use", async () => {
    const { options, challengeToken } = await portalWebauthnService.loginOptions(twoHosts);
    const response = toResponse(makeAssertion(options.challenge, 6, { origin: "https://app.example.com" }));
    expect((await portalWebauthnService.login({ challengeToken, response }, twoHosts)).clientId).toBe("c1");
  });

  it("a third origin is rejected with the generic 401", async () => {
    const { options, challengeToken } = await portalWebauthnService.loginOptions(twoHosts);
    const response = toResponse(makeAssertion(options.challenge, 6, { origin: "https://evil.app.example.com" }));
    const err = await failure(portalWebauthnService.login({ challengeToken, response }, twoHosts));
    expect([err.statusCode, err.message]).toEqual([401, BIOMETRIC_LOGIN_FAILED]);
  });

  it("with an unrelated portal host the RP ID is the portal's, so a staff-host RP ID assertion is rejected", async () => {
    const unrelated = { rpID: "portal.other.example", origin: "https://portal.other.example", origins: ["https://portal.other.example", "https://app.example.com"] };
    const { options, challengeToken } = await portalWebauthnService.loginOptions(unrelated);
    const response = toResponse(makeAssertion(options.challenge, 6, { origin: "https://portal.other.example", rpID: "app.example.com" }));
    const err = await failure(portalWebauthnService.login({ challengeToken, response }, unrelated));
    expect(err.statusCode).toBe(401);
  });
});
