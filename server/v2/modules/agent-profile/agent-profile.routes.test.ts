import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("./agent-profile.controller", () => ({
  agentProfileController: {
    getHeader: vi.fn(),
    getPerformance: vi.fn(),
    getWeek: vi.fn(),
    getMonthly: vi.fn(),
    getBiggestDeals: vi.fn(),
    getTraining: vi.fn(),
    getPayouts: vi.fn(),
  },
}));

import router from "./agent-profile.routes";
import { agentProfileController as controller } from "./agent-profile.controller";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
interface Layer {
  handle: Handler;
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Handler }> };
}

const layers = router.stack as unknown as Layer[];
const routerGuard = layers.find((l) => !l.route)?.handle as Handler;

function routeHandlers(path: string): Handler[] {
  const layer = layers.find((l) => l.route?.path === path && l.route.methods.get);
  if (!layer?.route) throw new Error(`no route GET ${path}`);
  return layer.route.stack.map((s) => s.handle);
}

function run(handler: Handler, orgRole: string) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  handler({ orgRole } as Request, res as unknown as Response, next);
  return { res, next };
}

const ALLOWED = ["platform_admin", "org_admin", "branch_manager"];
const DENIED = ["agent", "homeworker", "social_media_manager", "referral_agent"];

describe("agent-profile routes - audience", () => {
  it("the whole router is closed to agents and homeworkers", () => {
    for (const role of DENIED) {
      const { res, next } = run(routerGuard, role);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it("platform admins, org admins and branch managers pass the router guard", () => {
    for (const role of ALLOWED) {
      expect(run(routerGuard, role).next).toHaveBeenCalledOnce();
    }
  });
});

describe("agent-profile routes - wiring", () => {
  for (const [path, ctrl] of [
    ["/:userId", controller.getHeader],
    ["/:userId/performance", controller.getPerformance],
    ["/:userId/week", controller.getWeek],
    ["/:userId/monthly", controller.getMonthly],
    ["/:userId/biggest-deals", controller.getBiggestDeals],
    ["/:userId/training", controller.getTraining],
  ] as const) {
    it(`GET ${path} validates before the controller`, () => {
      const [validator, final] = routeHandlers(path);
      expect(validator).toBeTypeOf("function");
      expect(final).toBe(ctrl);
    });
  }

  it("rejects a bad request before it reaches the controller", async () => {
    const [validator] = routeHandlers("/:userId/week");
    const next = vi.fn();
    await validator({ body: {}, query: { start: "2026-10-20" }, params: { userId: "u1" } } as unknown as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});

describe("agent-profile routes - payouts gate", () => {
  it("GET /:userId/payouts is admin-only at the route (branch managers get 403)", () => {
    const [guard, validator, final] = routeHandlers("/:userId/payouts");
    expect(validator).toBeTypeOf("function");
    expect(final).toBe(controller.getPayouts);

    const manager = run(guard, "branch_manager");
    expect(manager.res.status).toHaveBeenCalledWith(403);
    expect(manager.next).not.toHaveBeenCalled();

    for (const role of ["org_admin", "platform_admin"]) {
      expect(run(guard, role).next).toHaveBeenCalledOnce();
    }
  });
});
