import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response, Router } from "express";

vi.mock("./whatsapp-templates.controller", () => ({
  whatsappTemplatesController: { list: vi.fn(), sync: vi.fn(), create: vi.fn(), remove: vi.fn() },
}));

import router from "./whatsapp-templates.routes";

type Handler = (req: Request, res: Response, next: NextFunction) => void;
interface Layer { route?: unknown; handle: Handler }

// The role guards are registered with router.use, so they precede every route layer.
function guardsBeforeRoutes(): Handler[] {
  const stack = (router as Router as unknown as { stack: Layer[] }).stack;
  const firstRoute = stack.findIndex((l) => l.route);
  expect(firstRoute).toBeGreaterThan(0);
  return stack.slice(0, firstRoute).map((l) => l.handle);
}

function statusFor(orgRoles: string[]): number | undefined {
  let status: number | undefined;
  const res = { status: (c: number) => { status = c; return res; }, json: () => res } as unknown as Response;
  const req = { orgRole: orgRoles[0], orgRoles } as unknown as Request;
  for (const g of guardsBeforeRoutes()) {
    let ok = false;
    g(req, res, () => { ok = true; });
    if (!ok) break;
  }
  return status;
}

describe("whatsapp-templates route authorization", () => {
  it("registers both guards before any route", () => {
    expect(guardsBeforeRoutes()).toHaveLength(2);
  });
  it("403s agents and homeworkers, including a manager who is also a homeworker", () => {
    expect(statusFor(["agent"])).toBe(403);
    expect(statusFor(["homeworker"])).toBe(403);
    expect(statusFor(["org_admin", "homeworker"])).toBe(403);
  });
  it("lets managers through", () => {
    for (const role of ["org_admin", "branch_manager", "platform_admin"]) expect(statusFor([role])).toBeUndefined();
  });
});
