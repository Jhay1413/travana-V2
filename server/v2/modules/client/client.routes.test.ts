import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("./client.controller", () => ({
  clientController: new Proxy({}, { get: () => vi.fn() }),
}));

import router from "./client.routes";
import { createClientValidator, updateClientValidator } from "./client.validator";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
interface Layer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handler }[] };
}

function chain(method: string, path: string): Handler[] {
  const layer = (router.stack as unknown as Layer[]).find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`${method} ${path} missing`);
  return layer.route.stack.map((s) => s.handle);
}

describe("/api/v2/clients write routes", () => {
  it.each([["post", "/"], ["post", "/:id/merge"], ["patch", "/:id"]])(
    "%s %s refuses social_media_manager",
    (method, path) => {
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
      const next = vi.fn();
      chain(method, path)[0]({ orgRole: "social_media_manager" } as Request, res as unknown as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    },
  );

  it("lets an agent through", () => {
    const next = vi.fn();
    chain("patch", "/:id")[0]({ orgRole: "agent" } as Request, {} as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("DELETE /api/v2/clients/:id is admin only", () => {
  function run(role: string) {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    chain("delete", "/:id")[0]({ orgRole: role } as Request, res as unknown as Response, next);
    return { res, next };
  }
  it.each(["agent", "branch_manager", "homeworker", "referral_agent", "social_media_manager"])("%s gets 403", (role) => {
    const { res, next } = run(role);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it.each(["org_admin", "platform_admin"])("%s passes", (role) => {
    expect(run(role).next).toHaveBeenCalledOnce();
  });
});

describe("/api/v2/clients validators omit system-managed fields", () => {
  it("create and update schemas do not declare them", () => {
    const create = createClientValidator.shape.body.shape as Record<string, unknown>;
    const update = updateClientValidator.shape.body.shape as Record<string, unknown>;
    for (const f of ["portalPin", "mustChangePin", "status", "mergedIntoId", "mergedAt", "mergedBy", "deletedAt", "deletedBy", "splitFromClientId", "vipEnrolledAt", "vipTier"]) {
      expect(create).not.toHaveProperty(f);
      expect(update).not.toHaveProperty(f);
    }
  });
});
