import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { restrictReferralAgent } from "./referral-gate";
import { REFERRAL_AGENT_ALLOWED_MOUNTS } from "./referral-allowed-mounts";

function run(baseUrl: string, orgRoles: string[], path = "/") {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  restrictReferralAgent({ baseUrl, path, orgRoles, orgRole: orgRoles[0] } as unknown as Request, res as unknown as Response, next);
  return { res, next };
}

describe("restrictReferralAgent", () => {
  it("lets every other role through on every mount", () => {
    for (const role of ["agent", "branch_manager", "org_admin", "homeworker", "social_media_manager", "platform_admin"]) {
      expect(run("/api/v2/transactions", [role]).next).toHaveBeenCalledOnce();
    }
  });

  it("refuses a referral agent on deal, client, note, task, ticket, search, AI and report mounts (403)", () => {
    for (const mount of ["transactions", "quotes", "bookings", "upsells", "enquiries", "clients", "neon-clients", "notes", "note-attachments", "client-files", "tasks", "tickets", "attachments", "replies", "search", "ai", "ai-enquiry", "opportunities", "dashboard", "favorites", "sms", "image-upscale", "conversations", "messages", "reports", "revenue", "wallet", "departures", "referrals", "referral-payouts", "a-mount-added-later"]) {
      const { res, next } = run(`/api/v2/${mount}`, ["referral_agent"]);
      expect(res.status, mount).toHaveBeenCalledWith(403);
      expect(next, mount).not.toHaveBeenCalled();
    }
  });

  it("lets a referral agent reach only the allow-listed mounts", () => {
    for (const mount of REFERRAL_AGENT_ALLOWED_MOUNTS) {
      expect(run(`/api/v2/${mount}`, ["referral_agent"]).next, mount).toHaveBeenCalledOnce();
    }
  });

  it("a referral agent can read their own profile but not the team directory under /users", () => {
    expect(run("/api/v2/users", ["referral_agent"], "/profiles/me").next).toHaveBeenCalledOnce();
    expect(run("/api/v2/users", ["referral_agent"], "/").res.status).toHaveBeenCalledWith(403);
    expect(run("/api/v2/users", ["referral_agent"], "/profiles/someone-else").res.status).toHaveBeenCalledWith(403);
    expect(run("/api/v2/users", ["referral_agent"], "/some-user-id").res.status).toHaveBeenCalledWith(403);
  });

  it("matches the mount exactly, not by prefix", () => {
    expect(run("/api/v2/users-and-deals", ["referral_agent"]).res.status).toHaveBeenCalledWith(403);
  });

  it("an unknown base url is refused for a referral agent", () => {
    expect(run("", ["referral_agent"]).res.status).toHaveBeenCalledWith(403);
  });
});
