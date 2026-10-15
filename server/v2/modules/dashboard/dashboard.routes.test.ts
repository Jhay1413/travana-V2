import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("./dashboard.controller", () => ({
  dashboardController: {
    getStats: vi.fn(),
    getMyProfit: vi.fn(),
    getAgentStats: vi.fn(),
    getAdminOverviewStats: vi.fn(),
  },
}));

import router from "./dashboard.routes";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
interface RouteLayer {
  route?: { path: string; stack: Array<{ handle: Handler }> };
}

function handlersFor(path: string): Handler[] {
  const layer = (router.stack as unknown as RouteLayer[]).find((l) => l.route?.path === path);
  if (!layer?.route) throw new Error(`no route ${path}`);
  return layer.route.stack.map((s) => s.handle);
}

function run(handler: Handler, orgRole: string) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  handler({ orgRole } as Request, res as unknown as Response, next);
  return { res, next };
}

describe("dashboard routes - org-wide stats are admin-only", () => {
  for (const path of ["/stats", "/admin-overview-stats"]) {
    it(`${path} rejects non-admin roles and allows admins`, () => {
      const [guard] = handlersFor(path);
      for (const role of ["agent", "homeworker", "branch_manager"]) {
        const { res, next } = run(guard, role);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      }
      for (const role of ["org_admin", "platform_admin"]) {
        expect(run(guard, role).next).toHaveBeenCalledOnce();
      }
    });
  }

  it("agent-scoped routes stay unguarded", () => {
    expect(handlersFor("/my-profit")).toHaveLength(1);
    expect(handlersFor("/agent-stats")).toHaveLength(1);
  });
});
