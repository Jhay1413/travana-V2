import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response, Router } from "express";

vi.mock("./customer-messaging.controller", () => ({
  customerMessagingController: {
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
    getReadiness: vi.fn(),
    setSwitch: vi.fn(),
    getPurposeTemplate: vi.fn(),
    savePurposeTemplate: vi.fn(() => vi.fn()),
  },
}));

import router from "./customer-messaging.routes";

type Handler = (req: Request, res: Response, next: NextFunction) => void;
interface Layer { route?: { path: string; methods: Record<string, boolean> }; handle: Handler }
const stack = () => (router as Router as unknown as { stack: Layer[] }).stack;

// The role guards are registered with router.use, so they precede every route layer.
function guardsBeforeRoutes(): Handler[] {
  const firstRoute = stack().findIndex((l) => l.route);
  expect(firstRoute).toBeGreaterThan(0);
  return stack().slice(0, firstRoute).map((l) => l.handle);
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

describe("customer-messaging route authorization (same rule as the WhatsApp template settings)", () => {
  it("registers both guards before any route", () => {
    expect(guardsBeforeRoutes()).toHaveLength(2);
  });
  it("403s agents, social media managers and homeworkers, including a manager who is also a homeworker", () => {
    for (const roles of [["agent"], ["social_media_manager"], ["homeworker"], ["referral_agent"], ["org_admin", "homeworker"]]) expect(statusFor(roles)).toBe(403);
  });
  it("lets managers through", () => {
    for (const role of ["org_admin", "branch_manager", "platform_admin"]) expect(statusFor([role])).toBeUndefined();
  });
});

describe("customer-messaging routes", () => {
  const routes = () => stack().filter((l) => l.route).map((l) => `${Object.keys(l.route!.methods)[0].toUpperCase()} ${l.route!.path}`);

  it("exposes settings, readiness and one template route per message type", () => {
    expect(routes()).toEqual([
      "GET /settings",
      "PUT /settings",
      "GET /readiness",
      "PUT /switch/:purpose",
      "GET /templates/:purpose",
      "PUT /templates/booking_confirmation",
      "PUT /templates/portal_ready",
      "PUT /templates/balance_reminder",
      "PUT /templates/departure_reminder",
    ]);
  });

  it("validates every write before its controller", () => {
    for (const l of stack().filter((x) => x.route && Object.keys(x.route.methods)[0] === "put")) {
      expect((l.route as unknown as { stack: unknown[] }).stack).toHaveLength(2);
    }
  });
});
