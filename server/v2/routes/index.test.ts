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

  for (const path of ["/conversations", "/messages", "/inboxes", "/social-posts", "/comments", "/channels"]) {
    it(`${path} applies noHomeworker after the auth stack`, () => {
      const line = mountLine(path);
      const authIdx = line.indexOf("...auth");
      const denyIdx = line.indexOf("noHomeworker");
      expect(authIdx).toBeGreaterThan(-1);
      expect(denyIdx).toBeGreaterThan(authIdx);
    });
  }

  it("auth stack includes orgBranchScope", () => {
    expect(source).toMatch(/const auth = \[isAuthenticated, orgBranchScope\]/);
  });
});
