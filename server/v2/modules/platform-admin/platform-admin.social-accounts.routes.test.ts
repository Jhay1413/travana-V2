import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";

const { stub, guards } = vi.hoisted(() => ({
  stub: () => new Proxy({}, { get: () => () => undefined }),
  guards: { isAuthenticated: () => undefined, requirePlatformAdmin: () => undefined },
}));

vi.mock("./platform-admin.controller", () => ({ platformAdminController: stub() }));
vi.mock("../../middlewares/auth", () => guards);

import router from "./platform-admin.routes";
import { validate } from "../../middlewares/validation.middleware";
import { setSocialAccountsSchema } from "./platform-admin.validator";

interface Layer {
  handle: unknown;
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
}
const stack = (router as unknown as { stack: Layer[] }).stack;

describe("platform-admin social-accounts routes", () => {
  it("installs the platform-admin guard router-wide, before any route", () => {
    const guardAt = stack.findIndex((l) => l.handle === guards.requirePlatformAdmin);
    const firstRoute = stack.findIndex((l) => l.route);
    expect(guardAt).toBeGreaterThanOrEqual(0);
    expect(guardAt).toBeLessThan(firstRoute);
  });

  it.each(["get", "put"])("exposes %s /organizations/:id/social-accounts behind requirePlatformAdmin", (method) => {
    const layer = stack.find((l) => l.route?.path === "/organizations/:id/social-accounts" && l.route.methods[method]);
    expect(layer).toBeDefined();
    expect(layer!.route!.stack[0]!.handle).toBe(guards.requirePlatformAdmin);
  });
});

describe("setSocialAccountsSchema", () => {
  const ORG = "3f2b8c1e-6a4d-4b1e-9c7a-2d5e8f0a1b3c";
  async function run(body: unknown, id = ORG) {
    const next = vi.fn();
    await validate(setSocialAccountsSchema)({ body, params: { id }, query: {} } as unknown as Request, {} as never, next);
    return next.mock.calls[0]?.[0] as { statusCode?: number } | undefined;
  }

  it("accepts a list of positive integer ids (including empty to reset)", async () => {
    expect(await run({ accountIds: [81085, 5] })).toBeUndefined();
    expect(await run({ accountIds: [] })).toBeUndefined();
  });

  it.each([[{ accountIds: ["a"] }], [{ accountIds: [1.5] }], [{ accountIds: [-1] }], [{}], [{ accountIds: [1], extra: true }]])(
    "rejects %j with 400",
    async (body) => {
      expect((await run(body))?.statusCode).toBe(400);
    },
  );

  it("rejects a non-uuid org id", async () => {
    expect((await run({ accountIds: [1] }, "nope"))?.statusCode).toBe(400);
  });
});
