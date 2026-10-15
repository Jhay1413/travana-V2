import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("./targets.controller", () => ({
  getTargetsOverview: vi.fn(),
  getShopTargets: vi.fn(),
  upsertShopTargets: vi.fn(),
  getAgentTargets: vi.fn(),
  getAgentTargetsByUserId: vi.fn(),
  upsertAgentTargets: vi.fn(),
  getAgents: vi.fn(),
}));

import router from "./targets.routes";
import * as controller from "./targets.controller";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Handler }> };
}

function handlersFor(method: string, path: string): Handler[] {
  const layer = (router.stack as unknown as RouteLayer[]).find(
    (l) => l.route?.path === path && l.route.methods[method],
  );
  if (!layer?.route) throw new Error(`no route ${method} ${path}`);
  return layer.route.stack.map((s) => s.handle);
}

function run(handler: Handler, orgRole: string) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  handler({ orgRole } as Request, res as unknown as Response, next);
  return { res, next };
}

describe("targets routes - write guard", () => {
  for (const [method, path, ctrl] of [
    ["post", "/shop", controller.upsertShopTargets],
    ["post", "/agent", controller.upsertAgentTargets],
  ] as const) {
    it(`${method.toUpperCase()} ${path} rejects agent and homeworker`, () => {
      const [guard, validator, final] = handlersFor(method, path);
      expect(validator).toBeTypeOf("function");
      expect(final).toBe(ctrl);
      for (const role of ["agent", "homeworker", "social_media_manager"]) {
        const { res, next } = run(guard, role);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      }
    });

    it(`${method.toUpperCase()} ${path} allows org_admin, branch_manager, platform_admin`, () => {
      const [guard] = handlersFor(method, path);
      for (const role of ["org_admin", "branch_manager", "platform_admin"]) {
        const { next } = run(guard, role);
        expect(next).toHaveBeenCalledOnce();
      }
    });
  }

  it("GET routes stay unguarded", () => {
    // validate(branchQueryValidator) + controller, no role guard.
    expect(handlersFor("get", "/shop")).toHaveLength(2);
    expect(handlersFor("get", "/agent")).toHaveLength(2);
    expect(handlersFor("get", "/overview")).toHaveLength(2);
  });
});
