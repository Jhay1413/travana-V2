import { describe, it, expect } from "vitest";
import {
  SINGLE_HOSTS,
  customerOriginFor,
  hostGuardAction,
  parseHostsMeta,
  portalHrefFor,
  staffHrefFor,
  type HostsConfig,
} from "./hosts";

const PORTAL = "https://portal.travana.app";
const STAFF = "https://travana.app";
const staffPage: HostsConfig = { portalBaseUrl: PORTAL, staffBaseUrl: STAFF, hostKind: "staff" };
const portalPage: HostsConfig = { portalBaseUrl: PORTAL, staffBaseUrl: STAFF, hostKind: "portal" };
const meta = (o: unknown) => JSON.stringify(o);

describe("parseHostsMeta", () => {
  it("reads both kinds", () => {
    expect(parseHostsMeta(meta({ portal: PORTAL, staff: STAFF, kind: "staff" }))).toEqual(staffPage);
    expect(parseHostsMeta(meta({ portal: PORTAL, staff: STAFF, kind: "portal" }))).toEqual(portalPage);
  });

  it("is single when absent, empty or what the server sends for one host", () => {
    expect(parseHostsMeta(null)).toEqual(SINGLE_HOSTS);
    expect(parseHostsMeta(undefined)).toEqual(SINGLE_HOSTS);
    expect(parseHostsMeta("")).toEqual(SINGLE_HOSTS);
    expect(parseHostsMeta(meta({ portal: "", staff: "", kind: "single" }))).toEqual(SINGLE_HOSTS);
  });

  it.each([
    ["not JSON", "{nope"],
    ["not an object", "5"],
    ["null", "null"],
    ["unknown kind", meta({ portal: PORTAL, staff: STAFF, kind: "other" })],
    ["a missing origin", meta({ portal: PORTAL, kind: "staff" })],
    ["an empty origin", meta({ portal: "", staff: STAFF, kind: "portal" })],
    ["an origin with a path", meta({ portal: `${PORTAL}/portal`, staff: STAFF, kind: "staff" })],
    ["an origin with a trailing slash", meta({ portal: `${PORTAL}/`, staff: STAFF, kind: "staff" })],
    ["a non-http origin", meta({ portal: "javascript:alert(1)", staff: STAFF, kind: "staff" })],
    ["identical origins", meta({ portal: STAFF, staff: STAFF, kind: "staff" })],
  ])("is single for %s", (_name, content) => {
    expect(parseHostsMeta(content)).toEqual(SINGLE_HOSTS);
  });
});

describe("portalHrefFor / staffHrefFor", () => {
  it("return the plain path with one host", () => {
    expect(portalHrefFor(SINGLE_HOSTS, "/portal/login?mt=A")).toBe("/portal/login?mt=A");
    expect(staffHrefFor(SINGLE_HOSTS, "/clients")).toBe("/clients");
  });

  it("return the plain path when already on the right host", () => {
    expect(portalHrefFor(portalPage, "/portal")).toBe("/portal");
    expect(staffHrefFor(staffPage, "/clients")).toBe("/clients");
  });

  it("return an absolute URL on the other host, query and hash intact", () => {
    expect(portalHrefFor(staffPage, "/portal/login?mt=A&next=%2Fportal#x")).toBe(`${PORTAL}/portal/login?mt=A&next=%2Fportal#x`);
    expect(staffHrefFor(portalPage, "/view-quote/T?preview=1")).toBe(`${STAFF}/view-quote/T?preview=1`);
  });

  it("never builds a link to another site from a hostile path", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "evil.com", ""]) {
      expect(portalHrefFor(staffPage, bad)).toBe(`${PORTAL}/`);
      expect(staffHrefFor(portalPage, bad)).toBe(`${STAFF}/`);
    }
  });
});

describe("customerOriginFor", () => {
  it("is today's value with one host and the portal origin otherwise", () => {
    expect(customerOriginFor(SINGLE_HOSTS, "http://localhost:5000")).toBe("http://localhost:5000");
    expect(customerOriginFor(staffPage, "https://travana.app")).toBe(PORTAL);
    expect(customerOriginFor(portalPage, "https://portal.travana.app")).toBe(PORTAL);
  });
});

describe("hostGuardAction", () => {
  const none = { type: "none" };

  it("does nothing with one host, whatever the page", () => {
    for (const [p, s] of [["/", ""], ["/portal", ""], ["/view-quote/T", ""], ["/clients", "?a=1"], ["/view-quote/T", "?preview=1"]]) {
      expect(hostGuardAction("single", p, s)).toEqual(none);
    }
  });

  it("staff host: portal and public quote pages go to the portal host (path and query kept)", () => {
    expect(hostGuardAction("staff", "/portal", "")).toEqual({ type: "redirect", host: "portal", path: "/portal" });
    expect(hostGuardAction("staff", "/portal/login", "?mt=AB&next=%2Fportal")).toEqual({ type: "redirect", host: "portal", path: "/portal/login?mt=AB&next=%2Fportal" });
    expect(hostGuardAction("staff", "/view-quote/TOK", "")).toEqual({ type: "redirect", host: "portal", path: "/view-quote/TOK" });
    expect(hostGuardAction("staff", "/view-quote/TOK", "?preview=0")).toEqual({ type: "redirect", host: "portal", path: "/view-quote/TOK?preview=0" });
  });

  it("staff host: the staff preview and staff pages stay", () => {
    expect(hostGuardAction("staff", "/view-quote/TOK", "?preview=1")).toEqual(none);
    expect(hostGuardAction("staff", "/view-quote/TOK", "?x=1&preview=1")).toEqual(none);
    expect(hostGuardAction("staff", "/clients", "")).toEqual(none);
    expect(hostGuardAction("staff", "/", "")).toEqual(none);
    expect(hostGuardAction("staff", "/portalx", "")).toEqual(none);
  });

  it("portal host: / goes to /portal, portal and public quote pages stay", () => {
    expect(hostGuardAction("portal", "/", "")).toEqual({ type: "same-host-path", path: "/portal" });
    expect(hostGuardAction("portal", "/portal", "")).toEqual(none);
    expect(hostGuardAction("portal", "/portal/quote/T", "?x=1")).toEqual(none);
    expect(hostGuardAction("portal", "/view-quote/TOK", "")).toEqual(none);
  });

  it("portal host: the preview and every other page go to the staff host", () => {
    expect(hostGuardAction("portal", "/view-quote/TOK", "?preview=1")).toEqual({ type: "redirect", host: "staff", path: "/view-quote/TOK?preview=1" });
    expect(hostGuardAction("portal", "/clients", "?a=1")).toEqual({ type: "redirect", host: "staff", path: "/clients?a=1" });
    expect(hostGuardAction("portal", "/login", "")).toEqual({ type: "redirect", host: "staff", path: "/login" });
    expect(hostGuardAction("portal", "/portalx", "")).toEqual({ type: "redirect", host: "staff", path: "/portalx" });
    expect(hostGuardAction("portal", "/view-quote", "")).toEqual({ type: "redirect", host: "staff", path: "/view-quote" });
  });
});
