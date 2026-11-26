import { describe, it, expect, vi } from "vitest";
import type { RequestHandler } from "express";

vi.mock("./portal-auth.service", () => ({ portalAuthService: {} }));
vi.mock("./portal.controller", () => {
  const spies: Record<string, ReturnType<typeof vi.fn>> = {};
  return { portalController: new Proxy(spies, { get: (target, key: string) => (target[key] ??= vi.fn()) }) };
});
vi.mock("./portal-quotes.controller", () => {
  const spies: Record<string, ReturnType<typeof vi.fn>> = {};
  return { portalQuotesController: new Proxy(spies, { get: (target, key: string) => (target[key] ??= vi.fn()) }) };
});

import { portalQuotesRouter } from "./portal-quotes.routes";
import { portalAuth } from "./portal.middleware";
import { portalController } from "./portal.controller";
import { portalQuotesController } from "./portal-quotes.controller";

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: RequestHandler }> };
}

const routes = (portalQuotesRouter.stack as RouteLayer[])
  .filter((l): l is Required<RouteLayer> => !!l.route)
  .map((l) => ({ path: l.route.path, method: Object.keys(l.route.methods)[0], handlers: l.route.stack.map((s) => s.handle) }));
const find = (method: string, path: string) => routes.find((r) => r.method === method && r.path === path);

describe("portal quotes router", () => {
  it("exposes the profile, list, detail, action, ownership and view routes", () => {
    expect(routes.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
      "get /quote/:token/owns",
      "get /quotes",
      "get /quotes/:token",
      "get /user",
      "post /quote/:token/view",
      "post /quotes/:token/action",
    ]);
  });

  it("every route needs a portal session first", () => {
    for (const r of routes) expect(r.handlers[0] === portalAuth || r.handlers[1] === portalAuth, `${r.method} ${r.path}`).toBe(true);
  });

  it("the action route is authenticated, then rate-limited (per customer), then validated, then handled", () => {
    const action = find("post", "/quotes/:token/action");
    expect(action?.handlers).toHaveLength(4);
    expect(action?.handlers[0]).toBe(portalAuth);
    expect(action?.handlers[3]).toBe(portalQuotesController.action);
  });

  it("the detail, list and ownership routes go auth, (validation), controller", () => {
    expect(find("get", "/quotes")?.handlers).toEqual([portalAuth, portalQuotesController.list]);
    expect(find("get", "/quotes/:token")?.handlers).toHaveLength(3);
    expect(find("get", "/quote/:token/owns")?.handlers.at(-1)).toBe(portalQuotesController.owns);
  });

  it("the profile and view-logging routes keep their original handlers", () => {
    expect(find("get", "/user")?.handlers).toEqual([portalAuth, portalController.profile]);
    expect(find("post", "/quote/:token/view")?.handlers.at(-1)).toBe(portalController.quoteView);
  });
});
