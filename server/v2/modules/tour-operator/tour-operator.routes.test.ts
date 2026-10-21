import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

vi.mock("./tour-operator.controller", () => ({
  tourOperatorController: {
    listOptions: vi.fn(),
    listManage: vi.fn(),
    searchCatalogue: vi.fn(),
    exportCsv: vi.fn(),
    previewImport: vi.fn(),
    applyImport: vi.fn(),
    create: vi.fn(),
    revealPassword: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import router from "./tour-operator.routes";
import { tourOperatorController as controller } from "./tour-operator.controller";
import { noResponseLog } from "../../middlewares/no-response-log";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
interface Layer {
  handle: Handler;
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Handler }> };
}

const layers = router.stack as unknown as Layer[];
const guardLayers = layers.filter((l) => !l.route).map((l) => l.handle);

function handlers(method: string, path: string): Handler[] {
  const layer = layers.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`no route ${method} ${path}`);
  return layer.route.stack.map((s) => s.handle);
}

function run(handler: Handler, orgRole: string) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  handler({ orgRole } as Request, res as unknown as Response, next);
  return { res, next };
}

const ID = "11111111-1111-4111-8111-111111111111";
const STAFF = ["platform_admin", "org_admin", "branch_manager", "agent", "homeworker"];
const WRITERS = ["platform_admin", "org_admin", "branch_manager"];
const OUTSIDERS = ["referral_agent", ""];

/** [method, path] of every route other than GET /. */
const OTHER_ROUTES: Array<[string, string]> = [
  ["get", "/manage"],
  ["get", "/catalogue"],
  ["get", "/export"],
  ["post", "/import/preview"],
  ["post", "/import"],
  ["post", "/"],
  ["get", "/:linkId/password"],
  ["patch", "/:linkId"],
  ["delete", "/:linkId"],
];

describe("tour-operator routes: audience", () => {
  it("mounts noResponseLog first so credentials never reach the request log", () => {
    expect(guardLayers[0]).toBe(noResponseLog);
  });

  it("GET / (credential-free options) is open to every staff role AND social media managers", () => {
    const [guard] = handlers("get", "/");
    for (const role of [...STAFF, "social_media_manager"]) expect(run(guard, role).next).toHaveBeenCalledOnce();
    for (const role of OUTSIDERS) {
      const { res, next } = run(guard, role);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it("every other route is 403 for social media managers and referral agents", () => {
    for (const [method, path] of OTHER_ROUTES) {
      const [guard] = handlers(method, path);
      for (const role of ["social_media_manager", ...OUTSIDERS]) {
        const { res, next } = run(guard, role);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      }
    }
  });

  it("read routes let every staff role in", () => {
    for (const [method, path] of [["get", "/manage"], ["get", "/catalogue"], ["get", "/export"], ["get", "/:linkId/password"]]) {
      const [guard] = handlers(method, path);
      for (const role of STAFF) expect(run(guard, role).next).toHaveBeenCalledOnce();
    }
  });

  it("write routes reject agents and homeworkers and admit the writer roles", () => {
    for (const [method, path] of OTHER_ROUTES.filter(([m, p]) => m !== "get" || p === "/never")) {
      const chain = handlers(method, path);
      const writerGuard = chain[1];
      for (const role of ["agent", "homeworker"]) {
        const { res, next } = run(writerGuard, role);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      }
      for (const role of WRITERS) expect(run(writerGuard, role).next).toHaveBeenCalledOnce();
    }
  });
});

describe("tour-operator routes: wiring and order", () => {
  it("wires each endpoint to its controller handler", () => {
    expect(handlers("get", "/").at(-1)).toBe(controller.listOptions);
    expect(handlers("get", "/manage").at(-1)).toBe(controller.listManage);
    expect(handlers("get", "/catalogue").at(-1)).toBe(controller.searchCatalogue);
    expect(handlers("get", "/export").at(-1)).toBe(controller.exportCsv);
    expect(handlers("post", "/import/preview").at(-1)).toBe(controller.previewImport);
    expect(handlers("post", "/import").at(-1)).toBe(controller.applyImport);
    expect(handlers("post", "/").at(-1)).toBe(controller.create);
    expect(handlers("get", "/:linkId/password").at(-1)).toBe(controller.revealPassword);
    expect(handlers("patch", "/:linkId").at(-1)).toBe(controller.update);
    expect(handlers("delete", "/:linkId").at(-1)).toBe(controller.remove);
  });

  it("registers literal paths before the :linkId routes", () => {
    const order = layers.filter((l) => l.route).map((l) => `${Object.keys(l.route!.methods)[0]} ${l.route!.path}`);
    expect(order).toEqual([
      "get /",
      "get /manage",
      "get /catalogue",
      "get /export",
      "post /import/preview",
      "post /import",
      "post /",
      "get /:linkId/password",
      "patch /:linkId",
      "delete /:linkId",
    ]);
  });

  it("rejects a non-uuid link id before the controller", async () => {
    const validator = handlers("patch", "/:linkId")[2];
    const next = vi.fn();
    await validator({ body: { isActive: true }, query: {}, params: { linkId: "nope" } } as unknown as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    const ok = vi.fn();
    await validator({ body: { isActive: true }, query: {}, params: { linkId: ID } } as unknown as Request, {} as Response, ok);
    expect(ok).toHaveBeenCalledWith();
  });
});
