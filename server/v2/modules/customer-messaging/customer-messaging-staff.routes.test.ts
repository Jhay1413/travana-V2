import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response, Router } from "express";

const pass = vi.hoisted(() => (_req: unknown, _res: unknown, next: () => void) => next());
vi.mock("../../middlewares/auth", () => ({ isAuthenticated: pass }));
vi.mock("../../middlewares/auth/referral-gate", () => ({ restrictReferralAgent: pass }));
vi.mock("../../middlewares/org-branch-scope", () => ({ orgBranchScope: pass }));
vi.mock("../conversation-integration/conversation-integration.middleware", () => ({ sendSevenContext: pass }));
vi.mock("./customer-messaging-staff.controller", () => ({
  customerMessagingStaffController: { getAvailability: vi.fn(), send: vi.fn(), getLog: vi.fn() },
}));

import router from "./customer-messaging-staff.routes";
import { customerMessagingStaffController as c } from "./customer-messaging-staff.controller";

type Handler = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handler }[] } }
const layers = () => (router as Router as unknown as { stack: Layer[] }).stack.filter((l) => l.route);
const find = (path: string, method: string) => layers().find((l) => l.route?.path === path && l.route.methods[method]);

/** Runs every handler of a route except its last (the controller) and reports the status a guard answered, if any. */
async function guardStatus(path: string, method: string, orgRoles: string[], body: unknown = {}, query: unknown = {}): Promise<number | undefined> {
  const stack = find(path, method)?.route?.stack ?? [];
  let status: number | undefined;
  const res = { status: (code: number) => { status = code; return res; }, json: () => res } as unknown as Response;
  const req = { orgRole: orgRoles[0], orgRoles, body, query, params: {} } as unknown as Request;
  for (const layer of stack.slice(0, -1)) {
    let advanced = false;
    await layer.handle(req, res, ((err?: unknown) => { if (!err) advanced = true; else status = (err as { statusCode?: number }).statusCode; }) as NextFunction);
    if (!advanced) break;
  }
  return status;
}

const ID = "11111111-1111-4111-8111-111111111111";

describe("staff customer-messaging routes", () => {
  it("registers exactly availability (GET), send (POST) and log (GET), each ending in its controller", () => {
    expect(layers().map((l) => `${Object.keys(l.route?.methods ?? {})[0]} ${l.route?.path}`)).toEqual(["get /availability", "post /send", "get /log"]);
    expect(find("/availability", "get")?.route?.stack.at(-1)?.handle).toBe(c.getAvailability);
    expect(find("/send", "post")?.route?.stack.at(-1)?.handle).toBe(c.send);
    expect(find("/log", "get")?.route?.stack.at(-1)?.handle).toBe(c.getLog);
  });

  it("is open to every staff role, homeworkers included (the service refuses WhatsApp for them)", async () => {
    for (const roles of [["agent"], ["homeworker"], ["branch_manager"], ["org_admin"]]) {
      expect(await guardStatus("/availability", "get", roles, {}, { clientId: ID, purpose: "quote_link" })).toBeUndefined();
      expect(await guardStatus("/send", "post", roles, { clientId: ID, purpose: "portal_sign_in", channel: "sms" })).toBeUndefined();
      expect(await guardStatus("/log", "get", roles, {}, { clientId: ID })).toBeUndefined();
    }
  });

  it("a read-only role (social media manager) may read but not send", async () => {
    expect(await guardStatus("/send", "post", ["social_media_manager"], { clientId: ID, purpose: "portal_sign_in", channel: "sms" })).toBe(403);
    expect(await guardStatus("/log", "get", ["social_media_manager"], {}, { clientId: ID })).toBeUndefined();
    expect(await guardStatus("/availability", "get", ["social_media_manager"], {}, { clientId: ID, purpose: "quote_link" })).toBeUndefined();
  });

  it("validates before the controller: a bad body or query is a 400", async () => {
    expect(await guardStatus("/send", "post", ["agent"], { clientId: "x", purpose: "portal_sign_in", channel: "sms" })).toBe(400);
    expect(await guardStatus("/send", "post", ["agent"], { clientId: ID, purpose: "quote_link", channel: "sms" })).toBe(400);
    expect(await guardStatus("/availability", "get", ["agent"], {}, { clientId: ID, purpose: "nope" })).toBe(400);
    expect(await guardStatus("/log", "get", ["agent"], {}, { clientId: ID, limit: "999" })).toBe(400);
  });
});
