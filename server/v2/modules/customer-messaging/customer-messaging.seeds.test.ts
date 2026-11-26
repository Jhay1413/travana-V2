import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isSeededPortalLoginBody, SEEDED_PORTAL_LOGIN_BODY, SEEDED_SIGNATURE } from "./customer-messaging.seeds";

describe("the seeded Portal Login wording", () => {
  it("is exactly what the SMS templates page seeds (read from sms.controller.ts, so the two cannot drift apart)", () => {
    const controller = readFileSync(join(__dirname, "../sms/sms.controller.ts"), "utf8");
    const row = controller.split("\n").find((line) => line.includes("category: 'portal_login'"));
    expect(row).toBeTruthy();
    // The controller escapes the apostrophe inside a single-quoted string.
    const quoted = /body: '((?:[^'\\]|\\.)*)'/.exec(row as string)?.[1] ?? "";
    expect(quoted.replace(/\\'/g, "'")).toBe(SEEDED_PORTAL_LOGIN_BODY);
  });

  it("is recognised whatever the spacing and case", () => {
    expect(isSeededPortalLoginBody(SEEDED_PORTAL_LOGIN_BODY)).toBe(true);
    expect(isSeededPortalLoginBody(`  ${SEEDED_PORTAL_LOGIN_BODY.toUpperCase()}\n`)).toBe(true);
    expect(isSeededPortalLoginBody(SEEDED_PORTAL_LOGIN_BODY.replace(/ /g, "   "))).toBe(true);
  });

  it("an edited wording is not the seed", () => {
    expect(isSeededPortalLoginBody("Log in here: {{portal_link}}")).toBe(false);
    expect(isSeededPortalLoginBody(SEEDED_PORTAL_LOGIN_BODY.replace("Tina's Travel", "Sunny Holidays"))).toBe(false);
  });

  it("the signature check finds the fixed name with or without the apostrophe", () => {
    expect(SEEDED_SIGNATURE.test("see you soon - Tina's Travel")).toBe(true);
    expect(SEEDED_SIGNATURE.test("Tinas Travel")).toBe(true);
    expect(SEEDED_SIGNATURE.test("Sunny Holidays")).toBe(false);
  });
});
