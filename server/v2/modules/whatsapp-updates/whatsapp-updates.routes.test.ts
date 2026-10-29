import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response, Router } from "express";

vi.mock("./whatsapp-updates.controller", () => ({
  whatsappUpdatesController: {
    getSettings: vi.fn(), saveSettings: vi.fn(), getTemplate: vi.fn(), getWindow: vi.fn(), sendToConversation: vi.fn(), sendToClient: vi.fn(),
  },
}));

import router from "./whatsapp-updates.routes";

type Handler = (req: Request, res: Response, next: NextFunction) => void;
interface RouteLayer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handler }[] } }

function handlers(path: string, method: string): Handler[] {
  const layer = (router as Router as unknown as { stack: RouteLayer[] }).stack.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`no route ${method} ${path}`);
  return layer.route.stack.map((s) => s.handle);
}

// Runs the two role guards that precede the validator/controller on the settings routes.
function roleStatus(path: string, method: string, orgRoles: string[]): number | undefined {
  let status: number | undefined;
  const res = { status: (c: number) => { status = c; return res; }, json: () => res } as unknown as Response;
  const req = { orgRole: orgRoles[0], orgRoles } as unknown as Request;
  for (const guard of handlers(path, method).slice(0, 2)) {
    let ok = false;
    guard(req, res, () => { ok = true; });
    if (!ok) break;
  }
  return status;
}

describe("settings route authorization", () => {
  for (const method of ["get", "put"]) {
    it(`${method.toUpperCase()} /settings 403s agents and homeworkers, including a manager who is also a homeworker`, () => {
      expect(roleStatus("/settings", method, ["agent"])).toBe(403);
      expect(roleStatus("/settings", method, ["homeworker"])).toBe(403);
      expect(roleStatus("/settings", method, ["org_admin", "homeworker"])).toBe(403);
    });
    it(`${method.toUpperCase()} /settings lets org_admin, branch_manager and platform_admin through`, () => {
      for (const role of ["org_admin", "branch_manager", "platform_admin"]) expect(roleStatus("/settings", method, [role])).toBeUndefined();
    });
  }
});

describe("agent-facing routes", () => {
  // handler count = optional validator + controller; no role guard in front, so an agent passes.
  const cases: [string, string, number][] = [
    ["/template", "get", 1],
    ["/conversations/:conversationId/window", "get", 2],
    ["/conversations/:conversationId/send", "post", 2],
    ["/clients/:clientId/send", "post", 2],
  ];
  for (const [path, method, length] of cases) {
    it(`${method.toUpperCase()} ${path} has no role guard`, () => {
      expect(handlers(path, method)).toHaveLength(length);
    });
  }
});
