import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./portal-branding.repository", () => ({
  portalBrandingRepository: {
    findActiveBySlug: vi.fn(),
    findForClient: vi.fn(),
    findActiveAgentForClient: vi.fn(),
  },
}));

import { neutralBranding, portalBrandingService, toPortalBranding } from "./portal-branding.service";
import { portalBrandingRepository } from "./portal-branding.repository";

const repo = vi.mocked(portalBrandingRepository);

const ALLOWED_KEYS = ["abta", "address", "agentName", "atol", "brandColor", "email", "iconUrl", "logoUrl", "name", "phone"];

const fullOrg = {
  name: "Sunny Travel",
  logoUrl: "https://cdn.example.com/logo.png",
  brandColor: "#1A5FB4",
  settings: {
    // Everything below the profile/branding keys is private to the agency and must never be exposed.
    plan: "enterprise",
    billing: { vatNumber: "GB123", contactEmail: "billing@example.com" },
    onboarding: { step: 4 },
    branding: { iconUrl: "https://cdn.example.com/icon.png", secretNote: "nope" },
    profile: {
      phone: "01234 567890",
      email: "hello@sunny.example",
      addressLine1: "1 High Street",
      addressLine2: "",
      town: "Leeds",
      county: "West Yorkshire",
      postcode: "LS1 1AA",
      atol: "ATOL 1234",
      abta: "Y1234",
      website: "https://sunny.example",
    },
  },
};

beforeEach(() => vi.clearAllMocks());

describe("toPortalBranding", () => {
  it("returns only the allowlisted keys", () => {
    const out = toPortalBranding(fullOrg, { firstName: "Jo", lastName: "Bloggs" });
    expect(Object.keys(out).sort()).toEqual(ALLOWED_KEYS);
  });

  it("maps the agency's data", () => {
    expect(toPortalBranding(fullOrg)).toEqual({
      name: "Sunny Travel",
      logoUrl: "https://cdn.example.com/logo.png",
      iconUrl: "https://cdn.example.com/icon.png",
      brandColor: "#1a5fb4",
      phone: "01234 567890",
      email: "hello@sunny.example",
      address: "1 High Street, Leeds, West Yorkshire, LS1 1AA",
      atol: "ATOL 1234",
      abta: "Y1234",
    });
  });

  it("omits atol and abta unless the agency entered them", () => {
    const out = toPortalBranding({ ...fullOrg, settings: { profile: { phone: "1", atol: "  ", abta: "" } } });
    expect("atol" in out).toBe(false);
    expect("abta" in out).toBe(false);
  });

  it("returns only the agent's first name, and only when there is an agent", () => {
    expect(toPortalBranding(fullOrg, { firstName: "Jo", lastName: "Bloggs" }).agentName).toBe("Jo");
    expect("agentName" in toPortalBranding(fullOrg)).toBe(false);
    expect("agentName" in toPortalBranding(fullOrg, { firstName: " ", lastName: "X" })).toBe(false);
  });

  it("drops an invalid colour and unsafe URLs", () => {
    const out = toPortalBranding({
      ...fullOrg,
      brandColor: "red",
      logoUrl: "javascript:alert(1)",
      settings: { branding: { iconUrl: "data:image/png;base64,AAA" } },
    });
    expect(out.brandColor).toBeNull();
    expect(out.logoUrl).toBeNull();
    expect(out.iconUrl).toBeNull();
  });

  it("tolerates a missing or odd settings value", () => {
    expect(toPortalBranding({ name: "A", logoUrl: null, brandColor: null, settings: null }).address).toBeNull();
    expect(toPortalBranding({ name: "A", logoUrl: null, brandColor: null, settings: [1, 2] }).phone).toBeNull();
    expect(toPortalBranding({ name: "A", logoUrl: null, brandColor: null, settings: "x" }).email).toBeNull();
  });
});

describe("getForSlug", () => {
  it("returns the agency's branding for an active slug", async () => {
    repo.findActiveBySlug.mockResolvedValue(fullOrg);
    const out = await portalBrandingService.getForSlug("Sunny-Travel");
    expect(repo.findActiveBySlug).toHaveBeenCalledWith("sunny-travel");
    expect(out.name).toBe("Sunny Travel");
    expect("agentName" in out).toBe(false);
  });

  it("returns the neutral default for an unknown or inactive slug, without throwing", async () => {
    repo.findActiveBySlug.mockResolvedValue(undefined);
    await expect(portalBrandingService.getForSlug("nobody")).resolves.toEqual(neutralBranding());
  });

  it("returns the neutral default for a malformed slug without touching the database", async () => {
    await expect(portalBrandingService.getForSlug("../etc/passwd")).resolves.toEqual(neutralBranding());
    expect(repo.findActiveBySlug).not.toHaveBeenCalled();
  });

  it("the neutral default has the same shape as a real response minus optional keys", () => {
    expect(Object.keys(neutralBranding()).sort()).toEqual(["abta", "address", "agentName", "atol", "brandColor", "email", "iconUrl", "logoUrl", "name", "phone"].filter((k) => !["abta", "atol", "agentName"].includes(k)));
  });
});

describe("getForClient", () => {
  it("returns the customer's own agency with their active agent's first name", async () => {
    repo.findForClient.mockResolvedValue({ orgId: "o1", slug: "sunny", org: fullOrg });
    repo.findActiveAgentForClient.mockResolvedValue({ firstName: "Jo", lastName: "Bloggs" });
    const out = await portalBrandingService.getForClient("c1");
    expect(repo.findActiveAgentForClient).toHaveBeenCalledWith("c1", "o1");
    expect(out.agentName).toBe("Jo");
    expect(out.name).toBe("Sunny Travel");
    expect(out.slug).toBe("sunny");
  });

  it("omits agentName when the customer has no active agent", async () => {
    repo.findForClient.mockResolvedValue({ orgId: "o1", slug: "sunny", org: fullOrg });
    repo.findActiveAgentForClient.mockResolvedValue(undefined);
    expect("agentName" in (await portalBrandingService.getForClient("c1"))).toBe(false);
  });

  it("returns the neutral default when the customer has no agency", async () => {
    repo.findForClient.mockResolvedValue(undefined);
    await expect(portalBrandingService.getForClient("c1")).resolves.toEqual(neutralBranding());
    expect(repo.findActiveAgentForClient).not.toHaveBeenCalled();
  });
});
