import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";

vi.mock("./portal-auth.service", () => ({ portalAuthService: {} }));
vi.mock("./portal-webauthn.service", () => ({ portalWebauthnService: {} }));
vi.mock("./portal-deals.service", () => ({ portalDealsService: {} }));
vi.mock("./portal-bookings.service", () => ({ portalBookingsService: {} }));
vi.mock("./portal.service", () => ({ portalService: {} }));
vi.mock("./portal-booking-detail.controller", () => ({ portalBookingDetailController: { detail: vi.fn() } }));
// Every controller method is a spy, so ordering can be proven: a request the
// limiter blocks must never reach the controller.
vi.mock("./portal.controller", () => {
  const spies: Record<string, ReturnType<typeof vi.fn>> = {};
  return {
    portalController: new Proxy(spies, {
      get: (target, key: string) => (target[key] ??= vi.fn()),
    }),
  };
});

import { portalCoreRouter } from "./portal-core.routes";
import portalRouter from "./portal.routes";
import { portalController } from "./portal.controller";

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: RequestHandler }> };
}

function routes(router: { stack: unknown[] }) {
  return (router.stack as RouteLayer[])
    .filter((l): l is Required<RouteLayer> => !!l.route)
    .map((l) => ({ path: l.route.path, method: Object.keys(l.route.methods)[0], handlers: l.route.stack.map((s) => s.handle) }));
}

const core = routes(portalCoreRouter);
const find = (method: string, path: string) => core.find((r) => r.method === method && r.path === path);

function harness(ip: string) {
  const out = { status: 0, body: undefined as unknown, headers: {} as Record<string, string> };
  const req = { ip, body: { email: "a@b.com", pin: "1234" }, query: {}, params: {}, headers: {} } as unknown as Request;
  const res = {
    setHeader: (k: string, v: string) => { out.headers[k] = v; },
    status: (c: number) => { out.status = c; return res; },
    json: (b: unknown) => { out.body = b; return res; },
  } as unknown as Response;
  return { out, req, res };
}

/** Runs a route's real handler chain in order, stopping as Express would when a handler doesn't call next(). */
async function runChain(handlers: RequestHandler[], req: Request, res: Response) {
  for (const handler of handlers) {
    let advanced = false;
    const next: NextFunction = (err?: unknown) => { if (!err) advanced = true; };
    await handler(req, res, next);
    if (!advanced) return;
  }
}

describe("portal core router (auth, deals, bookings)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes every endpoint that moved off v1", () => {
    for (const [method, path] of [
      ["post", "/login"], ["post", "/magic-login"], ["post", "/change-pin"],
      ["post", "/webauthn/register/options"], ["post", "/webauthn/register"], ["post", "/webauthn/login/options"],
      ["post", "/webauthn/login"], ["post", "/webauthn/check"],
      ["get", "/deals/filters"], ["get", "/deals/for-you"], ["get", "/deals"], ["get", "/bookings"], ["get", "/bookings/:id"],
    ]) {
      expect(find(method, path), `${method} ${path}`).toBeDefined();
    }
  });

  it("is mounted inside the full v2 portal router", () => {
    const nested = (portalRouter.stack as Array<{ handle: unknown }>).some((l) => l.handle === portalCoreRouter);
    expect(nested).toBe(true);
  });

  it("a booking's detail goes session, then id validation, then the controller", () => {
    expect(find("get", "/bookings/:id")?.handlers.length).toBe(3);
  });

  it("webauthn check requires a session (portalAuth first)", () => {
    expect(find("post", "/webauthn/check")?.handlers.length).toBe(3); // portalAuth, validate, controller
  });

  it("both Face ID set-up endpoints are rate limited, and the limiter runs before auth", async () => {
    for (const path of ["/webauthn/register", "/webauthn/register/options"]) {
      const handlers = find("post", path)!.handlers;
      expect(handlers.length, path).toBe(4); // limiter, portalAuth, validate, controller
      const ip = "198.18.0." + path.length;
      let last = harness(ip);
      for (let i = 0; i < 21; i++) {
        last = harness(ip);
        await runChain([handlers[0]], last.req, last.res);
      }
      expect(last.out.status, path).toBe(429);
      expect((last.out.body as { error: string }).error).toMatch(/^Too many attempts\. Please wait \d+ minutes? and try again\.$/);
    }
  });

  it.each([
    ["/login", "login"],
    ["/magic-login", "magicLogin"],
    ["/webauthn/login", "webauthnLogin"],
    ["/webauthn/login/options", "webauthnLoginOptions"],
  ])("%s: the limiter runs BEFORE the controller and blocks it once the budget is spent", async (path, controllerMethod) => {
    const route = find("post", path)!;
    const handlers = route.handlers;
    // Valid-looking bodies so validation would let the request through if the limiter did not stop it.
    const body = path === "/magic-login" ? { code: "abc" } : path.includes("webauthn")
      ? { challengeToken: "t", response: { id: "i", rawId: "i", type: "public-key", clientExtensionResults: {}, response: { clientDataJSON: "c", authenticatorData: "a", signature: "s" } } }
      : { email: "a@b.com", pin: "1234" };
    const ip = `198.51.100.${path.length}`;
    const spy = vi.mocked((portalController as unknown as Record<string, ReturnType<typeof vi.fn>>)[controllerMethod]);

    // The controller is a bare spy, so the chain stalls at it; each request below is "allowed" iff the spy is reached.
    for (let i = 0; i < 20; i++) {
      const h = harness(ip);
      h.req.body = body;
      await runChain(handlers, h.req, h.res);
    }
    expect(spy).toHaveBeenCalledTimes(20);

    const blocked = harness(ip);
    blocked.req.body = body;
    await runChain(handlers, blocked.req, blocked.res);
    expect(spy).toHaveBeenCalledTimes(20); // 21st never reached the controller
    expect(blocked.out.status).toBe(429);
    expect(blocked.out.headers["Retry-After"]).toBeDefined();
  });

  it("the 429 reply is the portal's { error } shape with a plain wait-N-minutes message", async () => {
    const handlers = find("post", "/login")!.handlers;
    const ip = "203.0.113.77";
    for (let i = 0; i < 20; i++) {
      const h = harness(ip);
      await runChain(handlers, h.req, h.res);
    }
    const h = harness(ip);
    await runChain(handlers, h.req, h.res);
    expect(h.out.status).toBe(429);
    const body = h.out.body as { error: string; success?: boolean; message?: string };
    expect(body.error).toMatch(/Please wait \d+ minutes? and try again, or use the sign-in link we sent you\./);
    expect(body.success).toBeUndefined();
    expect(body.message).toBeUndefined();
  });

  it("limits are per IP: another address is unaffected", async () => {
    const handlers = find("post", "/login")!.handlers;
    for (let i = 0; i < 21; i++) {
      const h = harness("192.0.2.1");
      await runChain(handlers, h.req, h.res);
    }
    const other = harness("192.0.2.2");
    await runChain(handlers, other.req, other.res);
    expect(other.out.status).toBe(0); // untouched by the limiter, reached the (spy) controller
  });

  it("each sign-in route has its own limiter (one route's attempts don't spend another's budget)", () => {
    const all = ["/login", "/magic-login", "/webauthn/login", "/webauthn/login/options"].map((p) => find("post", p)!.handlers[0]);
    expect(new Set(all).size).toBe(4);
  });
});
