import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("./airport.controller", () => ({
  airportController: { listAirports: vi.fn(), createAirport: vi.fn(), deleteAirport: vi.fn() },
}));

import router from "./airport.routes";
import { airportController } from "./airport.controller";
import { createAirportSchema, deleteAirportSchema } from "./airport.validator";

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

function run(handler: Handler, orgRoles: string[]) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  handler({ orgRoles, orgRole: orgRoles[0] } as unknown as Request, res as unknown as Response, next);
  return { res, next };
}

describe("airport routes - write guard", () => {
  it("POST / is open to everyday staff, closed to roles that never use the forms", () => {
    const [guard, validator, final] = handlersFor("post", "/");
    expect(validator).toBeTypeOf("function");
    expect(final).toBe(airportController.createAirport);
    for (const role of ["org_admin", "platform_admin", "branch_manager", "agent", "homeworker"]) {
      expect(run(guard, [role]).next).toHaveBeenCalledOnce();
    }
    for (const role of ["referral_agent", "social_media_manager"]) {
      const { res, next } = run(guard, [role]);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it("DELETE /:id is admin only", () => {
    const [guard, validator, final] = handlersFor("delete", "/:id");
    expect(validator).toBeTypeOf("function");
    expect(final).toBe(airportController.deleteAirport);
    for (const role of ["agent", "branch_manager", "homeworker", "referral_agent", "social_media_manager"]) {
      const { res, next } = run(guard, [role]);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
    for (const role of ["org_admin", "platform_admin"]) {
      expect(run(guard, [role]).next).toHaveBeenCalledOnce();
    }
  });

  it("checks the full role union and fails closed with no role", () => {
    const [guard] = handlersFor("delete", "/:id");
    expect(run(guard, ["agent", "org_admin"]).next).toHaveBeenCalledOnce();
    expect(run(guard, []).res.status).toHaveBeenCalledWith(403);
  });

  it("GET / stays open (no guard before the controller)", () => {
    expect(handlersFor("get", "/")).toHaveLength(1);
  });
});

describe("airport validators", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("accepts a name and code, with or without a country", () => {
    expect(createAirportSchema.safeParse({ body: { airport_name: "Gatwick", airport_code: "LGW" } }).success).toBe(true);
    expect(createAirportSchema.safeParse({ body: { airport_name: "Gatwick", airport_code: "LGW", country_id: id } }).success).toBe(true);
  });

  it("rejects missing fields, a bad country id and unknown keys such as id", () => {
    expect(createAirportSchema.safeParse({ body: { airport_name: "Gatwick" } }).success).toBe(false);
    expect(createAirportSchema.safeParse({ body: { airport_name: "", airport_code: "LGW" } }).success).toBe(false);
    expect(createAirportSchema.safeParse({ body: { airport_name: "G", airport_code: "L", country_id: "x" } }).success).toBe(false);
    expect(createAirportSchema.safeParse({ body: { airport_name: "G", airport_code: "L", id } }).success).toBe(false);
  });

  it("requires a uuid to delete", () => {
    expect(deleteAirportSchema.safeParse({ params: { id } }).success).toBe(true);
    expect(deleteAirportSchema.safeParse({ params: { id: "nope" } }).success).toBe(false);
  });
});
