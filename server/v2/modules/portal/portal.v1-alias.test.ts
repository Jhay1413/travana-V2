import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The legacy /api/portal router must run the v2 handlers for auth, deals, bookings and
// the customer's profile and quotes, and keep none of its own for those. Source-level check: importing the v1 router
// would drag in the whole legacy service layer.
const v1 = readFileSync(fileURLToPath(new URL("../../../routes/portal.routes.ts", import.meta.url)), "utf8").replace(/\r\n/g, "\n");

const QUOTE = "[\"'`]";

describe("v1 portal router (server/routes/portal.routes.ts)", () => {
  it("mounts the v2 core router", () => {
    expect(v1).toContain('import { portalCoreRouter } from "../v2/modules/portal/portal-core.routes";');
    expect(v1).toContain("portalRouter.use(portalCoreRouter);");
  });

  it("mounts the v2 quotes router (profile, quotes, quote detail/action, ownership, view)", () => {
    expect(v1).toContain('import { portalQuotesRouter } from "../v2/modules/portal/portal-quotes.routes";');
    expect(v1).toContain("portalRouter.use(portalQuotesRouter);");
  });

  it.each(["/login", "/magic-login", "/change-pin", "/webauthn/register", "/webauthn/login", "/webauthn/check", "/deals", "/deals/filters", "/deals/for-you", "/bookings", "/user", "/quotes", "/quotes/:token", "/quotes/:token/action", "/quote/:token/owns", "/quote/:token/view"])(
    "has no handler of its own for %s",
    (path) => {
      const own = new RegExp("portalRouter\\.(get|post|put|delete|patch)\\(\\s*" + QUOTE + path + QUOTE);
      expect(v1).not.toMatch(own);
    },
  );

  it("mounts the shared v2 writes router (messages and every write) and keeps no write handler of its own", () => {
    expect(v1).toContain('import { portalWritesRouter } from "../v2/modules/portal/portal-writes.routes";');
    expect(v1).toContain("portalRouter.use(portalWritesRouter);");
    expect(v1).not.toMatch(/portalRouter\.(post|put|delete|patch)\(/);
    for (const [method, path] of [["get", "/messages"], ["post", "/message"], ["post", "/quote-request"], ["post", "/interest"], ["post", "/my-tags"], ["post", "/push/subscribe"], ["post", "/push/unsubscribe"], ["post", "/wallet/request-payout"], ["post", "/wallet/withdraw"]]) {
      const own = new RegExp("portalRouter\\." + method + "\\(\\s*" + QUOTE + path + QUOTE);
      expect(v1, `${method} ${path}`).not.toMatch(own);
    }
  });

  it("uses the shared v2 JWT helper instead of deriving its own secret", () => {
    expect(v1).toContain('from "../v2/modules/portal/portal-auth"');
    expect(v1).not.toMatch(/createHash|jwt\.sign|jwt\.verify/);
  });
});
