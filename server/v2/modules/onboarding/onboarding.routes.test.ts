import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("./onboarding.controller", () => ({
  onboardingController: { signup: vi.fn(), verifyEmail: vi.fn(), resendVerification: vi.fn() },
}));
vi.mock("./onboarding-setup.controller", () => ({
  onboardingSetupController: {
    getState: vi.fn(), saveBusiness: vi.fn(), addShops: vi.fn(), setHomeworkerCommission: vi.fn(), complete: vi.fn(),
  },
}));
vi.mock("../../middlewares/auth", () => ({ isAuthenticated: vi.fn() }));
vi.mock("../../middlewares/org-branch-scope", () => ({ orgBranchScope: vi.fn() }));

import router from "./onboarding.routes";
import { isAuthenticated } from "../../middlewares/auth";
import { orgBranchScope } from "../../middlewares/org-branch-scope";
import { onboardingSetupController as ctrl } from "./onboarding-setup.controller";
import { onboardingController } from "./onboarding.controller";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Handler }> };
}

function handlersFor(method: string, path: string): Handler[] {
  const layer = (router.stack as unknown as RouteLayer[]).find(
    (l) => l.route?.path === path && l.route.methods[method],
  );
  if (!layer?.route) throw new Error(`no route ${method} ${path}`);
  return layer.route.stack.map((s) => s.handle);
}

function run(handler: Handler, orgRole: string) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  handler({ orgRole } as Request, res as unknown as Response, next);
  return { res, next };
}

const SETUP_ROUTES = [
  ["get", "/state", ctrl.getState],
  ["put", "/business", ctrl.saveBusiness],
  ["post", "/shops", ctrl.addShops],
  ["put", "/homeworker-commission", ctrl.setHomeworkerCommission],
  ["post", "/complete", ctrl.complete],
] as const;

describe("onboarding setup routes", () => {
  for (const [method, path, controller] of SETUP_ROUTES) {
    describe(`${method.toUpperCase()} ${path}`, () => {
      it("runs auth, scope, the role guard, then the controller", () => {
        const handlers = handlersFor(method, path);
        expect(handlers[0]).toBe(isAuthenticated);
        expect(handlers[1]).toBe(orgBranchScope);
        expect(handlers[handlers.length - 1]).toBe(controller);
      });

      it("403s agent, branch_manager and other non-owner roles", () => {
        const guard = handlersFor(method, path)[2];
        for (const role of ["agent", "branch_manager", "homeworker", "referral_agent", "social_media_manager", "platform_admin", ""]) {
          const { res, next } = run(guard, role);
          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
        }
      });

      it("lets org_admin through", () => {
        const { next } = run(handlersFor(method, path)[2], "org_admin");
        expect(next).toHaveBeenCalledOnce();
      });
    });
  }
});

describe("public onboarding routes", () => {
  it("/signup, /verify-email and /resend-verification carry no auth middleware", () => {
    for (const [method, path, controller] of [
      ["post", "/signup", onboardingController.signup],
      ["get", "/verify-email", onboardingController.verifyEmail],
      ["post", "/resend-verification", onboardingController.resendVerification],
    ] as const) {
      const handlers = handlersFor(method, path);
      expect(handlers).not.toContain(isAuthenticated);
      expect(handlers).not.toContain(orgBranchScope);
      expect(handlers[handlers.length - 1]).toBe(controller);
    }
  });
});
