import { describe, it, expect } from "vitest";
import { SINGLE_HOSTS, hostGuardAction, parseHostsMeta, portalHrefFor, safeHostChangeTarget, withActualKind } from "./hosts";

const PORTAL = "https://portal.travana.app";
const STAFF = "https://travana.app";
const tag = (kind: string) => JSON.stringify({ portal: PORTAL, staff: STAFF, kind });

describe("withActualKind: the browser's own origin decides, never the tag's kind", () => {
  it("agrees with the tag when the tag is right", () => {
    expect(withActualKind(parseHostsMeta(tag("staff")), STAFF).hostKind).toBe("staff");
    expect(withActualKind(parseHostsMeta(tag("portal")), PORTAL).hostKind).toBe("portal");
  });

  it("a tag that says portal on the staff origin (wrong proxy, poisoned cache) is read as staff", () => {
    const config = withActualKind(parseHostsMeta(tag("portal")), STAFF);
    expect(config.hostKind).toBe("staff");
    // So the staff origin sends /portal to the portal origin, instead of a loop on itself.
    expect(hostGuardAction(config.hostKind, "/portal", "")).toEqual({ type: "redirect", host: "portal", path: "/portal" });
    expect(portalHrefFor(config, "/portal")).toBe(`${PORTAL}/portal`);
  });

  it("a tag that says staff on the portal origin is read as portal", () => {
    expect(withActualKind(parseHostsMeta(tag("staff")), PORTAL).hostKind).toBe("portal");
  });

  it("an origin that is neither of the two means one host", () => {
    expect(withActualKind(parseHostsMeta(tag("portal")), "http://localhost:5000")).toEqual(SINGLE_HOSTS);
  });

  it("no tag stays one host", () => {
    expect(withActualKind(SINGLE_HOSTS, STAFF)).toEqual(SINGLE_HOSTS);
  });
});

describe("safeHostChangeTarget", () => {
  it("allows an address on another origin", () => {
    expect(safeHostChangeTarget(`${PORTAL}/portal/login?mt=A`, STAFF)).toBe(`${PORTAL}/portal/login?mt=A`);
  });

  it("never returns an address on the current origin (that would loop)", () => {
    expect(safeHostChangeTarget(`${STAFF}/portal`, STAFF)).toBeNull();
    expect(safeHostChangeTarget("/portal", STAFF)).toBeNull();
  });

  it("refuses anything that is not http(s)", () => {
    expect(safeHostChangeTarget("javascript:alert(1)", STAFF)).toBeNull();
    expect(safeHostChangeTarget("data:text/html,x", STAFF)).toBeNull();
  });
});
