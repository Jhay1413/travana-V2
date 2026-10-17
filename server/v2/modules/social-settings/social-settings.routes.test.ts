import { describe, it, expect, vi } from "vitest";

vi.mock("./social-settings.controller", () => ({
  socialSettingsController: { get: vi.fn(), getChannel: vi.fn(), update: vi.fn() },
}));

import router from "./social-settings.routes";

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: never[]) => void }[] } };

function putHandlers() {
  const layer = (router.stack as unknown as Layer[]).find((l) => l.route?.path === "/" && l.route.methods.put);
  return layer!.route!.stack.map((s) => s.handle);
}

function run(role: string) {
  const roleMw = putHandlers()[0] as unknown as (req: unknown, res: unknown, next: () => void) => void;
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  const next = vi.fn();
  roleMw({ orgRole: role }, res, next);
  return { res, next };
}

describe("PUT /social-settings role restriction", () => {
  it.each(["platform_admin", "org_admin", "branch_manager", "social_media_manager"])("allows %s", (role) => {
    expect(run(role).next).toHaveBeenCalled();
  });

  it.each(["agent", "homeworker"])("rejects %s with 403", (role) => {
    const { res, next } = run(role);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
