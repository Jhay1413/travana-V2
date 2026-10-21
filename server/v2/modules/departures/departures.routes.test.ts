import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("./departures.controller", () => ({
  departuresController: { list: vi.fn(), summary: vi.fn(), setCheck: vi.fn() },
}));

import router from "./departures.routes";
import { departuresController as controller } from "./departures.controller";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
interface Layer {
  handle: Handler;
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Handler }> };
}

const layers = router.stack as unknown as Layer[];
const routerGuard = layers.find((l) => !l.route)?.handle as Handler;

function routeHandlers(method: "get" | "patch", path: string): Handler[] {
  const layer = layers.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`no route ${method} ${path}`);
  return layer.route.stack.map((s) => s.handle);
}

function run(handler: Handler, orgRole: string) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  handler({ orgRole } as Request, res as unknown as Response, next);
  return { res, next };
}

describe("departures routes - audience", () => {
  it("the whole router is closed to agents and everyone else below branch manager", () => {
    for (const role of ["agent", "homeworker", "social_media_manager", "referral_agent"]) {
      const { res, next } = run(routerGuard, role);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it("platform admins, org admins and branch managers pass", () => {
    for (const role of ["platform_admin", "org_admin", "branch_manager"]) {
      expect(run(routerGuard, role).next).toHaveBeenCalledOnce();
    }
  });
});

describe("departures routes - wiring", () => {
  it("GET / validates then lists", () => {
    const [validator, final] = routeHandlers("get", "/");
    expect(validator).toBeTypeOf("function");
    expect(final).toBe(controller.list);
  });

  it("GET /summary validates then summarises", () => {
    const [validator, final] = routeHandlers("get", "/summary");
    expect(validator).toBeTypeOf("function");
    expect(final).toBe(controller.summary);
  });

  it("PATCH /:bookingId/checks validates then sets the check", () => {
    const [validator, final] = routeHandlers("patch", "/:bookingId/checks");
    expect(validator).toBeTypeOf("function");
    expect(final).toBe(controller.setCheck);
  });

  it("rejects a bad body before it reaches the controller", async () => {
    const [validator] = routeHandlers("patch", "/:bookingId/checks");
    const next = vi.fn();
    await validator(
      { body: { key: "bogus", value: true }, query: {}, params: { bookingId: "0b9f1c52-6a1e-4c1c-9d55-1d6a3f0a2b10" } } as unknown as Request,
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});
