import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("./revenue.controller", () => ({
  revenueController: {
    getDashboard: vi.fn(),
    getMonthBookings: vi.fn(),
    getMonthForwards: vi.fn(),
    regenerateForwards: vi.fn(),
  },
}));

import router from "./revenue.routes";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
interface Layer {
  route?: unknown;
  handle: Handler;
}

function run(handler: Handler, orgRole: string) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  handler({ orgRole } as Request, res as unknown as Response, next);
  return { res, next };
}

describe("revenue routes - admin-only guard", () => {
  const stack = router.stack as unknown as Layer[];
  const guard = stack[0];

  it("installs a router-level guard before every route", () => {
    expect(guard.route).toBeUndefined();
    expect(stack.slice(1).every((l) => l.route !== undefined)).toBe(true);
  });

  it("rejects agent, homeworker, branch_manager", () => {
    for (const role of ["agent", "homeworker", "branch_manager", "social_media_manager"]) {
      const { res, next } = run(guard.handle, role);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it("allows org_admin and platform_admin", () => {
    for (const role of ["org_admin", "platform_admin"]) {
      expect(run(guard.handle, role).next).toHaveBeenCalledOnce();
    }
  });
});
