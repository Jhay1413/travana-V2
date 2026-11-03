import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("./neon-client.controller", () => ({
  neonClientController: new Proxy({}, { get: () => vi.fn() }),
}));
vi.mock("../client/client-file.controller", () => ({
  clientFileController: new Proxy({}, { get: () => vi.fn() }),
}));
vi.mock("../../middlewares/auth", () => ({ isAuthenticated: vi.fn() }));

import neonRouter from "./neon-client.routes";
import clientFileRouter from "../client/client-file.routes";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
interface Layer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handler }[] };
}

function handlersFor(router: unknown, method: string, path: string): Handler[] {
  const stack = (router as { stack: Layer[] }).stack;
  const layer = stack.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`route ${method} ${path} not found`);
  return layer.route.stack.map((s) => s.handle);
}

// On every write route the read-only guard is the first handler in the chain.
function runGuard(handlers: Handler[], orgRole: string) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  handlers[0]({ orgRole } as Request, res as unknown as Response, next);
  return { res, next };
}

const NEON_WRITES: Array<[string, string]> = [
  ["patch", "/:id"],
  ["delete", "/:id"],
  ["post", "/"],
  ["post", "/import"],
  ["post", "/:id/merge"],
  ["put", "/:id/portal-pin"],
  ["delete", "/:id/portal-pin"],
];
const FILE_WRITES: Array<[string, string]> = [
  ["post", "/client/:clientId"],
  ["delete", "/:id"],
];

describe("social_media_manager is read-only on clients", () => {
  it.each(NEON_WRITES)("neon-clients %s %s is refused", (method, path) => {
    const { res, next } = runGuard(handlersFor(neonRouter, method, path), "social_media_manager");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it.each(FILE_WRITES)("client-files %s %s is refused", (method, path) => {
    const { res, next } = runGuard(handlersFor(clientFileRouter, method, path), "social_media_manager");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it.each(["agent", "branch_manager", "org_admin", "homeworker", "platform_admin"])("lets %s through", (role) => {
    for (const [method, path] of NEON_WRITES) {
      expect(runGuard(handlersFor(neonRouter, method, path), role).next).toHaveBeenCalledOnce();
    }
    for (const [method, path] of FILE_WRITES) {
      expect(runGuard(handlersFor(clientFileRouter, method, path), role).next).toHaveBeenCalledOnce();
    }
  });
});
