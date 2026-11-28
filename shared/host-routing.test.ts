import { describe, it, expect } from "vitest";
import { classifyPage, decidePageHost, hasPreviewFlag } from "./host-routing";

describe("classifyPage", () => {
  it("sorts the paths", () => {
    expect(classifyPage("/", "")).toBe("root");
    expect(classifyPage("/portal", "")).toBe("portal");
    expect(classifyPage("/portal/login", "?mt=A")).toBe("portal");
    expect(classifyPage("/view-quote/T", "")).toBe("public-quote");
    expect(classifyPage("/view-quote/T", "?preview=1")).toBe("public-quote-preview");
    expect(classifyPage("/portals", "")).toBe("other");
    expect(classifyPage("/Portal", "")).toBe("other");
    expect(classifyPage("/view-quote", "")).toBe("other");
  });
});

describe("hasPreviewFlag", () => {
  it("is only ?preview=1", () => {
    expect(hasPreviewFlag("?preview=1")).toBe(true);
    expect(hasPreviewFlag("preview=1&a=2")).toBe(true);
    expect(hasPreviewFlag("?preview=true")).toBe(false);
    expect(hasPreviewFlag("")).toBe(false);
  });
});

describe("decidePageHost", () => {
  it("single: always stay", () => {
    expect(decidePageHost("single", "/portal", "")).toEqual({ type: "stay" });
  });
  it("staff and portal hosts", () => {
    expect(decidePageHost("staff", "/portal/x", "")).toEqual({ type: "redirect", to: "portal" });
    expect(decidePageHost("staff", "/view-quote/T", "?preview=1")).toEqual({ type: "stay" });
    expect(decidePageHost("portal", "/", "")).toEqual({ type: "same-host-path", path: "/portal" });
    expect(decidePageHost("portal", "/view-quote/T", "?preview=1")).toEqual({ type: "redirect", to: "staff" });
    expect(decidePageHost("portal", "/clients", "")).toEqual({ type: "redirect", to: "staff" });
    expect(decidePageHost("portal", "/portal", "")).toEqual({ type: "stay" });
  });
});
