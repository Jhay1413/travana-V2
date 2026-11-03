import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response, Router } from "express";

vi.mock("./quote-share.controller", () => ({
  quoteShareController: {
    getWhatsappTemplateSettings: vi.fn(), saveWhatsappTemplateSettings: vi.fn(), generateToken: vi.fn(), sendWhatsapp: vi.fn(),
    getClientViews: vi.fn(), getViews: vi.fn(), getCustomerActions: vi.fn(), updateSent: vi.fn(),
  },
}));
vi.mock("../conversation-integration/conversation-integration.middleware", () => ({ sendSevenContext: vi.fn() }));

import router from "./quote-share.routes";

type Handler = (req: Request, res: Response, next: NextFunction) => void;
interface RouteLayer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handler }[] } }

function handlers(path: string, method: string): Handler[] {
  const layer = (router as Router as unknown as { stack: RouteLayer[] }).stack.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`no route ${method} ${path}`);
  return layer.route.stack.map((s) => s.handle);
}

// Runs the role middlewares (everything before the validator/controller) and returns the 403 status, if any.
function roleStatus(path: string, method: string, orgRoles: string[]): number | undefined {
  const chain = handlers(path, method);
  let status: number | undefined;
  const res = { status: (c: number) => { status = c; return res; }, json: () => res } as unknown as Response;
  const req = { orgRole: orgRoles[0], orgRoles } as unknown as Request;
  // The first two handlers are the role guards on both routes.
  for (const guard of chain.slice(0, 2)) {
    let ok = false;
    guard(req, res, () => { ok = true; });
    if (!ok) break;
  }
  return status;
}

describe("whatsapp-template-settings route authorization", () => {
  for (const method of ["get", "put"]) {
    const path = "/whatsapp-template-settings";
    it(`${method.toUpperCase()} 403s agents and homeworkers, including a manager who is also a homeworker`, () => {
      expect(roleStatus(path, method, ["agent"])).toBe(403);
      expect(roleStatus(path, method, ["homeworker"])).toBe(403);
      expect(roleStatus(path, method, ["org_admin", "homeworker"])).toBe(403);
    });
    it(`${method.toUpperCase()} lets org_admin, branch_manager and platform_admin through`, () => {
      for (const role of ["org_admin", "branch_manager", "platform_admin"]) expect(roleStatus(path, method, [role])).toBeUndefined();
    });
  }
});
