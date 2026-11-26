import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isSeededAgencyName, isSeededPortalLoginBody, SEEDED_PORTAL_LOGIN_BODY, SEEDED_SIGNATURE, withAgencySignature } from "./customer-messaging.seeds";

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
    expect(isSeededPortalLoginBody(SEEDED_PORTAL_LOGIN_BODY.replace("{{company_name}}", "Sunny Holidays"))).toBe(false);
    // Rows seeded before the signature became {{company_name}} are still the seed.
    expect(isSeededPortalLoginBody(SEEDED_PORTAL_LOGIN_BODY.replace("{{company_name}}", "Tina's Travel"))).toBe(true);
  });

  it("the signature check finds the fixed name with or without the apostrophe", () => {
    expect(SEEDED_SIGNATURE.test("see you soon - Tina's Travel")).toBe(true);
    expect(SEEDED_SIGNATURE.test("Tinas Travel")).toBe(true);
    expect(SEEDED_SIGNATURE.test("Sunny Holidays")).toBe(false);
  });

  it("no seeded SMS template names a fixed agency: every default is signed with {{company_name}} or not at all", () => {
    const controller = readFileSync(join(__dirname, "../sms/sms.controller.ts"), "utf8");
    const block = controller.slice(controller.indexOf("const DEFAULT_TEMPLATES"), controller.indexOf("];", controller.indexOf("const DEFAULT_TEMPLATES")));
    expect(block).toContain("category: 'portal_login'");
    expect(block).not.toMatch(/\btina/i);
    for (const line of block.split("\n").filter((l) => l.includes("category:"))) expect(line).toContain("- {{company_name}}");
  });

  it("the sms controller and service hold no fixed agency name either", () => {
    for (const file of ["../sms/sms.controller.ts", "../sms/sms.service.ts"]) {
      expect(readFileSync(join(__dirname, file), "utf8")).not.toMatch(/QUOTE_SHARE_COMPANY_NAME/);
    }
  });
});

describe("withAgencySignature (rows seeded with the old fixed signature)", () => {
  const OLD = "Hi {{first_name}}, your quote is ready. - Tina's Travel";

  it("swaps the old signature for the sending agency's name, to be merged from {{company_name}}", () => {
    expect(withAgencySignature(OLD, "Sunny Holidays")).toBe("Hi {{first_name}}, your quote is ready. - {{company_name}}");
    expect(withAgencySignature("Hello - tinas   travel \n", "Sunny Holidays")).toBe("Hello - {{company_name}}");
  });

  it("drops the signature when the agency's name is unknown", () => {
    expect(withAgencySignature(OLD, "")).toBe("Hi {{first_name}}, your quote is ready.");
    expect(withAgencySignature(OLD, null)).toBe("Hi {{first_name}}, your quote is ready.");
    expect(withAgencySignature(OLD, undefined)).toBe("Hi {{first_name}}, your quote is ready.");
  });

  it("an agency actually named Tina's Travel is unaffected", () => {
    expect(withAgencySignature(OLD, "Tina's Travel")).toBe(OLD);
    expect(withAgencySignature(OLD, "  TINAS TRAVEL ")).toBe(OLD);
  });

  it("is linear on adversarial bodies (long whitespace runs, many dashes)", () => {
    const start = performance.now();
    withAgencySignature(" ".repeat(200_000) + "x", "Sunny");
    withAgencySignature("- ".repeat(100_000), "Sunny");
    withAgencySignature("a" + " ".repeat(200_000) + "-" + " ".repeat(200_000), "Sunny");
    expect(performance.now() - start).toBeLessThan(100);
  });

  it("isSeededAgencyName matches only the real fixed name", () => {
    expect(isSeededAgencyName("Tina's Travel")).toBe(true);
    expect(isSeededAgencyName("  TINAS   TRAVEL ")).toBe(true);
    expect(isSeededAgencyName("Sunny Holidays")).toBe(false);
    expect(isSeededAgencyName(null)).toBe(false);
  });

  it("only the exact ending is touched: the name elsewhere, other endings and new {{company_name}} rows are left alone", () => {
    expect(withAgencySignature("Tina's Travel says hi - {{company_name}}", "Sunny")).toBe("Tina's Travel says hi - {{company_name}}");
    expect(withAgencySignature("Thanks from Tina's Travel team", "Sunny")).toBe("Thanks from Tina's Travel team");
    expect(withAgencySignature("Hi {{first_name}} - {{company_name}}", "Sunny")).toBe("Hi {{first_name}} - {{company_name}}");
  });
});
