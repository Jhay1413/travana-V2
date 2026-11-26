import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AnyZodObject } from "zod";

vi.mock("./portal-auth.service", () => ({
  portalAuthService: {
    verifySession: vi.fn(),
    login: vi.fn(),
    magicLogin: vi.fn(),
    changePin: vi.fn(),
  },
}));
vi.mock("./portal-webauthn.service", () => ({
  portalWebauthnService: {
    registrationOptions: vi.fn(),
    register: vi.fn(),
    loginOptions: vi.fn(),
    login: vi.fn(),
    check: vi.fn(),
  },
}));
vi.mock("./portal-deals.service", () => ({
  portalDealsService: { getDealFilters: vi.fn(), listDeals: vi.fn(), listForYouDeals: vi.fn() },
}));
vi.mock("./portal-bookings.service", () => ({ portalBookingsService: { listBookings: vi.fn() } }));
vi.mock("./portal.service", () => ({ portalService: {} }));

import { portalController } from "./portal.controller";
import { portalAuth, portalErrorHandler } from "./portal.middleware";
import { portalAuthService } from "./portal-auth.service";
import { portalDealsService } from "./portal-deals.service";
import { portalWebauthnService } from "./portal-webauthn.service";
import { portalBookingsService } from "./portal-bookings.service";
import { validate } from "../../middlewares/validation.middleware";
import { AppError } from "../../utils/error-handler";
import {
  listPortalDealsValidator,
  portalChangePinValidator,
  portalLoginValidator,
  portalMagicLoginValidator,
  portalWebauthnLoginValidator,
  portalWebauthnOptionsValidator,
  portalWebauthnRegisterValidator,
} from "./portal.validator";

interface Captured {
  status: number;
  body: unknown;
}

/**
 * Runs a route's handler chain the way Express would (middleware -> controller),
 * routing any error through the portal error formatter, and returns the HTTP
 * status + JSON body the client would see.
 */
async function call(handlers: RequestHandler[], reqInit: Partial<Request>): Promise<Captured> {
  const base = { headers: {}, body: {}, query: {}, params: {}, socket: {}, protocol: "https", ...reqInit };
  const lowered = Object.fromEntries(Object.entries(base.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const req = { ...base, get: (name: string) => lowered[name.toLowerCase()] } as unknown as Request;
  const out: Captured = { status: 200, body: undefined };
  const res = {
    headersSent: false,
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      res.headersSent = true;
      return res;
    },
  } as unknown as Response;

  for (const handler of handlers) {
    let nextErr: unknown;
    let advanced = false;
    const next: NextFunction = (err?: unknown) => {
      advanced = true;
      nextErr = err;
    };
    await handler(req, res, next);
    if (nextErr) {
      portalErrorHandler(nextErr as Error, req, res, vi.fn());
      return out;
    }
    if (!advanced) return out;
  }
  return out;
}

const route = (schema: AnyZodObject, ...rest: RequestHandler[]) => [validate(schema), ...rest];

beforeEach(() => vi.clearAllMocks());

describe("POST /login", () => {
  const handlers = route(portalLoginValidator, portalController.login);

  it("200 with token, clientId, firstName, hasBiometric, mustChangePin", async () => {
    const result = { token: "t", clientId: "c1", firstName: "Sam", hasBiometric: true, mustChangePin: false };
    vi.mocked(portalAuthService.login).mockResolvedValue(result);
    const r = await call(handlers, { body: { email: "a@b.com", pin: "4821" } });
    expect(r).toEqual({ status: 200, body: result });
    expect(portalAuthService.login).toHaveBeenCalledWith({ email: "a@b.com", pin: "4821", orgSlug: undefined });
  });

  it("passes the agency slug through to the service", async () => {
    vi.mocked(portalAuthService.login).mockResolvedValue({ token: "t", clientId: "c1", firstName: null, hasBiometric: false, mustChangePin: false });
    await call(handlers, { body: { email: "a@b.com", pin: "4821", org: "agency-a" } });
    expect(portalAuthService.login).toHaveBeenCalledWith({ email: "a@b.com", pin: "4821", orgSlug: "agency-a" });
  });

  it("400 {error} when email or PIN is missing, without reaching the service", async () => {
    const r = await call(handlers, { body: { email: "a@b.com" } });
    expect(r).toEqual({ status: 400, body: { error: "Email and PIN are required" } });
    expect(portalAuthService.login).not.toHaveBeenCalled();
  });

  it("401 {error} for a wrong PIN", async () => {
    vi.mocked(portalAuthService.login).mockRejectedValue(new AppError("Incorrect email or PIN", 401));
    const r = await call(handlers, { body: { email: "a@b.com", pin: "0000" } });
    expect(r).toEqual({ status: 401, body: { error: "Incorrect email or PIN" } });
  });

  it("a blocked default PIN looks exactly like a wrong PIN (401 generic, no 403)", async () => {
    vi.mocked(portalAuthService.login).mockRejectedValue(new AppError("Incorrect email or PIN", 401));
    const r = await call(handlers, { body: { email: "a@b.com", pin: "1234" } });
    expect(r).toEqual({ status: 401, body: { error: "Incorrect email or PIN" } });
  });

  it("429 {error} while the account is locked out", async () => {
    vi.mocked(portalAuthService.login).mockRejectedValue(new AppError("Too many incorrect PIN attempts.", 429));
    const r = await call(handlers, { body: { email: "a@b.com", pin: "1234" } });
    expect(r).toEqual({ status: 429, body: { error: "Too many incorrect PIN attempts." } });
  });

  it("passes preferOrg through; a junk preferOrg is rejected by the validator (the client only sends valid slugs)", async () => {
    vi.mocked(portalAuthService.login).mockResolvedValue({ token: "t", clientId: "c1", firstName: null, hasBiometric: false, biometricCheckFailed: false, mustChangePin: false });
    const ok = await call(handlers, { body: { email: "a@b.com", pin: "4821", preferOrg: "agency-b" } });
    expect(ok.status).toBe(200);
    expect(portalAuthService.login).toHaveBeenCalledWith({ email: "a@b.com", pin: "4821", orgSlug: undefined, preferOrgSlug: "agency-b" });
    const bad = await call(handlers, { body: { email: "a@b.com", pin: "4821", preferOrg: "not a slug!" } });
    expect(bad.status).toBe(400);
  });

  it("400 for an over-long email or a PIN that is not four digits, before any service call", async () => {
    vi.mocked(portalAuthService.login).mockClear();
    expect((await call(handlers, { body: { email: "a".repeat(250) + "@b.com", pin: "4821" } })).status).toBe(400);
    expect((await call(handlers, { body: { email: "a@b.com", pin: "12345" } })).status).toBe(400);
    expect((await call(handlers, { body: { email: "a@b.com", pin: "abcd" } })).status).toBe(400);
    expect(portalAuthService.login).not.toHaveBeenCalled();
  });

  it("500 {error: 'Login failed'} on an unexpected failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(portalAuthService.login).mockRejectedValue(new Error("db down"));
    const r = await call(handlers, { body: { email: "a@b.com", pin: "4821" } });
    expect(r).toEqual({ status: 500, body: { error: "Login failed" } });
  });
});

describe("POST /magic-login", () => {
  const handlers = route(portalMagicLoginValidator, portalController.magicLogin);

  it("200 with the session", async () => {
    const result = { token: "t", clientId: "c1", firstName: "Sam", mustChangePin: true };
    vi.mocked(portalAuthService.magicLogin).mockResolvedValue(result);
    expect(await call(handlers, { body: { code: "abc" } })).toEqual({ status: 200, body: result });
    expect(portalAuthService.magicLogin).toHaveBeenCalledWith("abc");
  });

  it("400 {error: 'Code required'} without a code", async () => {
    expect(await call(handlers, { body: {} })).toEqual({ status: 400, body: { error: "Code required" } });
  });

  it("401 {error} for an expired or used link", async () => {
    vi.mocked(portalAuthService.magicLogin).mockRejectedValue(new AppError("This link has expired or was already used. Please ask your agent to resend.", 401));
    const r = await call(handlers, { body: { code: "abc" } });
    expect(r.status).toBe(401);
  });
});

describe("POST /change-pin", () => {
  const live = () =>
    vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: "c1", email: "a@b.com" });
  const handlers = [portalAuth, ...route(portalChangePinValidator, portalController.changePin)];
  const authed = { headers: { authorization: "Bearer t" } };

  it("401 {error} without a valid session", async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError("Unauthorized", 401));
    expect(await call(handlers, { body: { newPin: "9876" } })).toEqual({ status: 401, body: { error: "Unauthorized" } });
    expect(portalAuthService.changePin).not.toHaveBeenCalled();
  });

  it("200 {success:true} and changes the signed-in client's PIN", async () => {
    live();
    vi.mocked(portalAuthService.changePin).mockResolvedValue({});
    expect(await call(handlers, { ...authed, body: { newPin: "9876" } })).toEqual({ status: 200, body: { success: true } });
    expect(portalAuthService.changePin).toHaveBeenCalledWith({ clientId: "c1", email: "a@b.com" }, "9876");
  });

  it("200 {success:true, token} when the service reissues a session (magic-link -> PIN)", async () => {
    live();
    vi.mocked(portalAuthService.changePin).mockResolvedValue({ token: "fresh" });
    expect(await call(handlers, { ...authed, body: { newPin: "9876" } })).toEqual({ status: 200, body: { success: true, token: "fresh" } });
  });

  it("400 {error} for a malformed PIN", async () => {
    live();
    expect(await call(handlers, { ...authed, body: { newPin: "12" } })).toEqual({
      status: 400,
      body: { error: "Valid 4-digit PIN required" },
    });
  });

  it("400 {error} when the service rejects the default PIN", async () => {
    live();
    vi.mocked(portalAuthService.changePin).mockRejectedValue(new AppError("Please choose a PIN other than the default.", 400));
    expect(await call(handlers, { ...authed, body: { newPin: "1234" } })).toEqual({
      status: 400,
      body: { error: "Please choose a PIN other than the default." },
    });
  });
});

describe("GET /deals", () => {
  const handlers = route(listPortalDealsValidator, portalController.listDeals);

  it("200 with the deal list, passing filters, flags, auth header and org slug", async () => {
    vi.mocked(portalDealsService.listDeals).mockResolvedValue([]);
    const r = await call(handlers, {
      headers: { authorization: "Bearer t" },
      query: { country: " Italy ", recent: "1", interests: "1", org: "agency-a" },
    });
    expect(r).toEqual({ status: 200, body: [] });
    expect(portalDealsService.listDeals).toHaveBeenCalledWith({
      country: "Italy", tag: undefined, recent: true, interests: true, authorizationHeader: "Bearer t", orgSlug: "agency-a",
    });
  });

  it("200 [] with no session and no org (the service fails closed)", async () => {
    vi.mocked(portalDealsService.listDeals).mockResolvedValue([]);
    const r = await call(handlers, { query: {} });
    expect(r).toEqual({ status: 200, body: [] });
    expect(portalDealsService.listDeals).toHaveBeenCalledWith(
      expect.objectContaining({ authorizationHeader: undefined, orgSlug: undefined, recent: false, interests: false }),
    );
  });

  it("400 {error} for a malformed query", async () => {
    const r = await call(handlers, { query: { recent: "maybe" } });
    expect(r.status).toBe(400);
    expect(portalDealsService.listDeals).not.toHaveBeenCalled();
  });

  it("500 {error: 'Failed to load deals'} on an unexpected failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(portalDealsService.listDeals).mockRejectedValue(new Error("boom"));
    expect(await call(handlers, { query: {} })).toEqual({ status: 500, body: { error: "Failed to load deals" } });
  });
});

describe("GET /deals/filters and /deals/for-you", () => {
  it("filters returns the service result with the org slug", async () => {
    vi.mocked(portalDealsService.getDealFilters).mockResolvedValue({ countries: ["Italy"], popularTags: [] });
    const r = await call([portalController.dealFilters], { query: { org: "agency-a" } });
    expect(r).toEqual({ status: 200, body: { countries: ["Italy"], popularTags: [] } });
    expect(portalDealsService.getDealFilters).toHaveBeenCalledWith({ authorizationHeader: undefined, orgSlug: "agency-a" });
  });

  it("for-you is session-only and scoped by the signed-in client id", async () => {
    vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: "c1", email: "" });
    vi.mocked(portalDealsService.listForYouDeals).mockResolvedValue([]);
    const r = await call([portalAuth, portalController.forYouDeals], { headers: { authorization: "Bearer t" }, query: { recent: "1" } });
    expect(r).toEqual({ status: 200, body: [] });
    expect(portalDealsService.listForYouDeals).toHaveBeenCalledWith("c1", true);
  });

  it("for-you answers 401 without a session", async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError("Unauthorized", 401));
    const r = await call([portalAuth, portalController.forYouDeals], {});
    expect(r).toEqual({ status: 401, body: { error: "Unauthorized" } });
    expect(portalDealsService.listForYouDeals).not.toHaveBeenCalled();
  });
});

describe("GET /bookings", () => {
  it("401 {error} without a session", async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError("Invalid token", 401));
    expect(await call([portalAuth, portalController.bookings], {})).toEqual({ status: 401, body: { error: "Invalid token" } });
  });

  it("200 with the signed-in client's bookings", async () => {
    vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: "c1", email: "" });
    vi.mocked(portalBookingsService.listBookings).mockResolvedValue([]);
    const r = await call([portalAuth, portalController.bookings], { headers: { authorization: "Bearer t" } });
    expect(r).toEqual({ status: 200, body: [] });
    expect(portalBookingsService.listBookings).toHaveBeenCalledWith("c1");
  });

  it("500 {error: 'Failed to load bookings'} on an unexpected failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: "c1", email: "" });
    vi.mocked(portalBookingsService.listBookings).mockRejectedValue(new Error("boom"));
    expect(await call([portalAuth, portalController.bookings], {})).toEqual({
      status: 500,
      body: { error: "Failed to load bookings" },
    });
  });
});

describe("webauthn contract", () => {
  const rpReq = { headers: { origin: "https://app.example.com" } };
  const expectedRp = { rpID: "app.example.com", origin: "https://app.example.com" };
  const attestation = {
    id: "cred", rawId: "cred", type: "public-key", clientExtensionResults: {},
    response: { clientDataJSON: "cd", attestationObject: "ao" },
  };
  const assertion = {
    id: "cred", rawId: "cred", type: "public-key", clientExtensionResults: {},
    response: { clientDataJSON: "cd", authenticatorData: "ad", signature: "sig" },
  };
  const session = () => vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: "c1", email: "" });

  it("POST register/options: 401 without a session", async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError("Unauthorized", 401));
    const r = await call([portalAuth, ...route(portalWebauthnOptionsValidator, portalController.webauthnRegisterOptions)], {});
    expect(r).toEqual({ status: 401, body: { error: "Unauthorized" } });
    expect(portalWebauthnService.registrationOptions).not.toHaveBeenCalled();
  });

  it("POST register/options: 200 with options + challengeToken for the signed-in client", async () => {
    session();
    const result = { options: { challenge: "c" }, challengeToken: "tok" };
    vi.mocked(portalWebauthnService.registrationOptions).mockResolvedValue(result as never);
    const r = await call([portalAuth, ...route(portalWebauthnOptionsValidator, portalController.webauthnRegisterOptions)], {
      headers: { authorization: "Bearer t" }, body: {},
    });
    expect(r).toEqual({ status: 200, body: result });
    expect(portalWebauthnService.registrationOptions).toHaveBeenCalledWith(expect.objectContaining({ clientId: "c1" }), expect.any(Object));
  });

  it("POST register: 200 {success:true}; the service gets the session client, token, response and RP", async () => {
    session();
    vi.mocked(portalWebauthnService.register).mockResolvedValue();
    const r = await call([portalAuth, ...route(portalWebauthnRegisterValidator, portalController.webauthnRegister)], {
      headers: { authorization: "Bearer t", origin: "https://app.example.com" },
      body: { challengeToken: "tok", response: attestation, deviceName: "iPhone" },
    });
    expect(r).toEqual({ status: 200, body: { success: true } });
    expect(portalWebauthnService.register).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "c1" }), { challengeToken: "tok", response: attestation, deviceName: "iPhone" }, expectedRp,
    );
  });

  it("POST register: 400 {error} when the service rejects the attestation", async () => {
    session();
    vi.mocked(portalWebauthnService.register).mockRejectedValue(new AppError("Face ID set-up failed. Please try again.", 400));
    const r = await call([portalAuth, ...route(portalWebauthnRegisterValidator, portalController.webauthnRegister)], {
      headers: { authorization: "Bearer t" }, body: { challengeToken: "tok", response: attestation },
    });
    expect(r).toEqual({ status: 400, body: { error: "Face ID set-up failed. Please try again." } });
  });

  it("POST login/options: 200, no input needed, no session needed", async () => {
    const result = { options: { challenge: "c" }, challengeToken: "tok" };
    vi.mocked(portalWebauthnService.loginOptions).mockResolvedValue(result as never);
    const r = await call(route(portalWebauthnOptionsValidator, portalController.webauthnLoginOptions), { ...rpReq, body: {} });
    expect(r).toEqual({ status: 200, body: result });
    expect(portalWebauthnService.loginOptions).toHaveBeenCalledWith(expectedRp);
  });

  it("POST login: 200 with the session", async () => {
    const result = { token: "t", clientId: "c1", firstName: "Sam", mustChangePin: false };
    vi.mocked(portalWebauthnService.login).mockResolvedValue(result);
    const r = await call(route(portalWebauthnLoginValidator, portalController.webauthnLogin), {
      ...rpReq, body: { challengeToken: "tok", response: assertion },
    });
    expect(r).toEqual({ status: 200, body: result });
    expect(portalWebauthnService.login).toHaveBeenCalledWith({ challengeToken: "tok", response: assertion }, expectedRp);
  });

  it("POST login: 401 {error} for a failed assertion", async () => {
    vi.mocked(portalWebauthnService.login).mockRejectedValue(new AppError("Biometric login failed", 401));
    const r = await call(route(portalWebauthnLoginValidator, portalController.webauthnLogin), {
      ...rpReq, body: { challengeToken: "tok", response: assertion },
    });
    expect(r).toEqual({ status: 401, body: { error: "Biometric login failed" } });
  });

  it("POST login: the OLD { credentialId, clientId } shape is rejected with 400 and never reaches the service", async () => {
    const r = await call(route(portalWebauthnLoginValidator, portalController.webauthnLogin), {
      ...rpReq, body: { credentialId: "x", clientId: "c1" },
    });
    expect(r).toEqual({ status: 400, body: { error: "Missing credential data" } });
    expect(portalWebauthnService.login).not.toHaveBeenCalled();
  });

  it("POST check: needs a session and answers only for the signed-in client", async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError("Unauthorized", 401));
    expect((await call([portalAuth, portalController.webauthnCheck], { body: { clientId: "someone-else" } })).status).toBe(401);

    session();
    vi.mocked(portalWebauthnService.check).mockResolvedValue({ hasBiometric: true, devices: [] });
    const r = await call([portalAuth, portalController.webauthnCheck], { headers: { authorization: "Bearer t" }, body: { clientId: "someone-else" } });
    expect(r).toEqual({ status: 200, body: { hasBiometric: true, devices: [] } });
    expect(portalWebauthnService.check).toHaveBeenCalledWith("c1");
  });
});

describe("portalErrorHandler", () => {
  it("formats AppError as { error } with its status", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    portalErrorHandler(new AppError("nope", 418), {} as Request, { headersSent: false, status } as unknown as Response, vi.fn());
    expect(status).toHaveBeenCalledWith(418);
    expect(json).toHaveBeenCalledWith({ error: "nope" });
  });

  it("hides unexpected error details behind a generic 500", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    portalErrorHandler(new Error("secret internals"), {} as Request, { headersSent: false, status } as unknown as Response, vi.fn());
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: "Something went wrong" });
  });
});
