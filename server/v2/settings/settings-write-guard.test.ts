import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { settingsWriteGuard } from "./settings-write-guard";

function run(method: string, path: string, orgRoles: string[]) {
  const req = { method, path, orgRoles, orgRole: orgRoles[0] } as unknown as Request;
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  const next = vi.fn();
  settingsWriteGuard(req, res as unknown as Response, next);
  return { res, next };
}

describe("settingsWriteGuard", () => {
  it.each(["agent", "branch_manager", "homeworker", "referral_agent", "social_media_manager"])(
    "lets %s read any settings route",
    (role) => {
      expect(run("GET", "/airports", [role]).next).toHaveBeenCalledOnce();
      expect(run("GET", "/destinations/abc", [role]).next).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["POST", "/airports"],
    ["PATCH", "/destinations/abc"],
    ["DELETE", "/destinations/abc"],
    ["POST", "/parks"],
    ["PATCH", "/accommodations/abc"],
    ["POST", "/cruise/lines"],
    ["DELETE", "/deletion-codes/abc"],
    ["PUT", "/resorts/abc"],
    ["POST", "/tags"],
  ])("refuses an agent on %s %s with 403", (method, path) => {
    const { res, next } = run(method, path, ["agent"]);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it.each(["org_admin", "platform_admin"])("lets %s write anywhere", (role) => {
    expect(run("POST", "/airports", [role]).next).toHaveBeenCalledOnce();
    expect(run("DELETE", "/destinations/abc", [role]).next).toHaveBeenCalledOnce();
  });

  it("checks the full role union, so an admin role held below the primary still passes", () => {
    expect(run("POST", "/airports", ["agent", "org_admin"]).next).toHaveBeenCalledOnce();
  });

  it.each([
    "/accommodations",
    "/board-basis",
    "/countries",
    "/destinations",
    "/lodges",
    "/resorts",
    "/room-types/",
  ])("keeps the %s quick-add open to agents, managers and homeworkers", (path) => {
    for (const role of ["agent", "branch_manager", "homeworker"]) {
      expect(run("POST", path, [role]).next).toHaveBeenCalledOnce();
    }
  });

  it("keeps quick-add closed to roles that never use those forms", () => {
    expect(run("POST", "/destinations", ["referral_agent"]).res.status).toHaveBeenCalledWith(403);
    expect(run("POST", "/destinations", ["social_media_manager"]).res.status).toHaveBeenCalledWith(403);
  });

  it("allows only creation on the quick-add routes, not edits or deletes", () => {
    expect(run("PATCH", "/resorts/abc", ["agent"]).res.status).toHaveBeenCalledWith(403);
    expect(run("DELETE", "/lodges/abc", ["agent"]).res.status).toHaveBeenCalledWith(403);
  });

  it.each(["agent", "branch_manager", "homeworker"])("refuses %s on tag rename and delete (admin-only)", (role) => {
    expect(run("PATCH", "/tags/abc", [role]).res.status).toHaveBeenCalledWith(403);
    expect(run("DELETE", "/tags/abc", [role]).res.status).toHaveBeenCalledWith(403);
    expect(run("POST", "/tags", [role]).res.status).toHaveBeenCalledWith(403);
  });

  it.each(["org_admin", "platform_admin"])("lets %s rename and delete a tag", (role) => {
    expect(run("PATCH", "/tags/abc", [role]).next).toHaveBeenCalledOnce();
    expect(run("DELETE", "/tags/abc", [role]).next).toHaveBeenCalledOnce();
  });

  it("fails closed when no role is set", () => {
    expect(run("POST", "/airports", []).res.status).toHaveBeenCalledWith(403);
  });
});
