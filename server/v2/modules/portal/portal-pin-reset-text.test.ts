import { describe, it, expect } from "vitest";
import { buildSignInText, buildStaffSignInText } from "./portal-pin-reset-text";

describe("sign-in link wording", () => {
  it("the customer-requested reset link still says it expires in an hour", () => {
    expect(buildSignInText({ firstName: "Sam", orgName: "Tina Travel", link: "https://x/l" })).toContain("expires in an hour");
  });
  it("the staff-sent link says how long it lasts and that it works once", () => {
    const text = buildStaffSignInText({ firstName: "Sam", orgName: "Tina Travel", link: "https://x/l", hours: 48 });
    expect(text).toBe("Hi Sam, tap this link to sign in to your Tina Travel portal: https://x/l The link works once and is valid for 48 hours.");
  });
  it("falls back to a plain greeting and portal name", () => {
    expect(buildStaffSignInText({ firstName: " ", orgName: null, link: "L", hours: 48 })).toBe("Hi, tap this link to sign in to your portal: L The link works once and is valid for 48 hours.");
  });
  it("is plain ASCII, as the SMS provider requires", () => {
    expect(buildStaffSignInText({ firstName: "Sam", orgName: "T", link: "L", hours: 48 })).toMatch(/^[\x20-\x7e]+$/);
  });
});
