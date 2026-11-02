import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Importing routes/index.ts would load every module, so assert on the source:
// each inbox/social mount must apply noHomeworker AFTER the auth stack
// (isAuthenticated + orgBranchScope), since it needs req.orgRoles populated.
const source = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

function mountLine(path: string): string {
  const line = source.split(/\r?\n/).find((l) => l.includes(`router.use('${path}'`));
  if (!line) throw new Error(`no mount for ${path}`);
  return line;
}

describe("homeworker deny on inbox and social mounts", () => {
  it("defines noHomeworker via denyOrgRole for homeworker", () => {
    expect(source).toMatch(/const noHomeworker = denyOrgRole\(\["?'?homeworker"?'?\]\)/);
  });

  for (const path of ["/conversations", "/messages", "/inboxes", "/social-posts", "/social-settings", "/comments", "/channels"]) {
    it(`${path} applies noHomeworker after the auth stack`, () => {
      const line = mountLine(path);
      const authIdx = line.indexOf("...auth");
      const denyIdx = line.indexOf("noHomeworker");
      expect(authIdx).toBeGreaterThan(-1);
      expect(denyIdx).toBeGreaterThan(authIdx);
    });
  }

  it("auth stack includes orgBranchScope", () => {
    expect(source).toMatch(/const auth = \[isAuthenticated, orgBranchScope, restrictReferralAgent\]/);
  });
});

describe("blocked users cannot reach session-only routers", () => {
  for (const path of ["/airports", "/notifications", "/favorites", "/tags", "/chat", "/emails", "/facebook", "/quote-share"]) {
    it(`${path} uses the full auth stack (isAuthenticated + orgBranchScope), not isAuthenticated alone`, () => {
      const line = mountLine(path);
      expect(line).toContain("...auth");
      expect(line).not.toMatch(/\bisAuthenticated,/);
    });
  }
});

describe("referral agents are default-denied on every authenticated mount", () => {
  it("the shared auth stack ends with the referral gate, after orgBranchScope populated the roles", () => {
    expect(source).toMatch(/const auth = \[isAuthenticated, orgBranchScope, restrictReferralAgent\]/);
  });

  for (const path of ["/transactions", "/quotes", "/bookings", "/upsells", "/enquiries", "/clients", "/neon-clients", "/notes", "/tasks", "/tickets", "/search", "/ai", "/opportunities", "/dashboard", "/favorites", "/sms", "/image-upscale", "/client-files", "/note-attachments"]) {
    it(`${path} sits behind the auth stack (and so the referral gate)`, () => {
      expect(mountLine(path)).toContain("...auth");
    });
  }
});
