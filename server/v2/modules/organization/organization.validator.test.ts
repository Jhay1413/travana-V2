import { describe, it, expect } from "vitest";
import {
  assignMemberBranchSchema,
  createOrganizationSchema,
  memberUserIdParams,
  removeMemberSchema,
  setMemberSuspendedSchema,
  unassignMemberBranchSchema,
  updateMemberProfileSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from "./organization.validator";

describe("createOrganizationSchema", () => {
  it("accepts a valid organization", () => {
    const result = createOrganizationSchema.safeParse({
      body: { name: "Acme", slug: "acme-co", plan: "growth" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a slug with uppercase or spaces", () => {
    expect(createOrganizationSchema.safeParse({ body: { name: "Acme", slug: "Acme Co" } }).success).toBe(false);
  });

  it("rejects a slug shorter than 3 characters", () => {
    expect(createOrganizationSchema.safeParse({ body: { name: "Acme", slug: "ab" } }).success).toBe(false);
  });

  it("rejects an unknown plan", () => {
    expect(
      createOrganizationSchema.safeParse({ body: { name: "Acme", slug: "acme-co", plan: "ultra" } }).success,
    ).toBe(false);
  });
});

describe("updateOrganizationSchema", () => {
  it("rejects a brand color that is not a 6-digit hex", () => {
    expect(updateOrganizationSchema.safeParse({ body: { brandColor: "blue" } }).success).toBe(false);
    expect(updateOrganizationSchema.safeParse({ body: { brandColor: "#fff" } }).success).toBe(false);
  });

  it("accepts a valid 6-digit hex brand color", () => {
    expect(updateOrganizationSchema.safeParse({ body: { brandColor: "#1a2b3c" } }).success).toBe(true);
  });

  it("rejects a currency code that is not exactly 3 characters", () => {
    expect(updateOrganizationSchema.safeParse({ body: { settings: { currency: "POUND" } } }).success).toBe(false);
  });

  it("drops seatLimit and isActive: an org admin cannot set them", () => {
    const result = updateOrganizationSchema.safeParse({ body: { name: "Acme", seatLimit: 500, isActive: false } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).toEqual({ name: "Acme" });
    }
  });
});

describe("updateOrganizationSchema profile and branding settings", () => {
  const parse = (settings: Record<string, unknown>) =>
    updateOrganizationSchema.safeParse({ body: { settings } });

  it("accepts a full profile and keeps unknown keys", () => {
    const result = parse({
      profile: {
        phone: "0191 594 7999",
        email: "hi@acme.example",
        addressLine1: "1 High St",
        addressLine2: "",
        town: "Newcastle",
        county: "Tyne and Wear",
        postcode: "NE1 1AA",
      },
      custom: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body.settings).toHaveProperty("custom", 1);
  });

  it("allows an empty profile email but rejects an invalid one", () => {
    expect(parse({ profile: { email: "" } }).success).toBe(true);
    expect(parse({ profile: { email: "not-an-email" } }).success).toBe(false);
  });

  it("rejects over-long profile fields", () => {
    expect(parse({ profile: { postcode: "x".repeat(21) } }).success).toBe(false);
  });

  it("accepts a data URL or null for branding.iconUrl and rejects junk", () => {
    expect(parse({ branding: { iconUrl: "data:image/png;base64,AAAA" } }).success).toBe(true);
    expect(parse({ branding: { iconUrl: null } }).success).toBe(true);
    expect(parse({ branding: { iconUrl: "not a url" } }).success).toBe(false);
  });
});

describe("member validators", () => {
  const uid = "user_abc"; // user ids are text, not uuids
  const branchId = "3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f";

  it("accepts a text user id and rejects an empty one", () => {
    expect(memberUserIdParams.safeParse({ params: { userId: uid } }).success).toBe(true);
    expect(memberUserIdParams.safeParse({ params: { userId: "" } }).success).toBe(false);
  });

  it("updateMemberRoleSchema accepts known roles only", () => {
    expect(updateMemberRoleSchema.safeParse({ params: { userId: uid }, body: { orgRole: "branch_manager" } }).success).toBe(true);
    expect(updateMemberRoleSchema.safeParse({ params: { userId: uid }, body: { orgRole: "wizard" } }).success).toBe(false);
    expect(updateMemberRoleSchema.safeParse({ params: { userId: uid }, body: {} }).success).toBe(false);
  });

  it("setMemberSuspendedSchema requires a boolean, allows notify and is strict", () => {
    const parse = (body: unknown) => setMemberSuspendedSchema.safeParse({ params: { userId: uid }, body });
    expect(parse({ suspended: true, notify: true }).success).toBe(true);
    expect(parse({ suspended: "yes" }).success).toBe(false);
    expect(parse({}).success).toBe(false);
    expect(parse({ suspended: true, extra: 1 }).success).toBe(false);
  });

  it("assign / unassign require uuid branch ids", () => {
    expect(assignMemberBranchSchema.safeParse({ params: { userId: uid }, body: { branchId } }).success).toBe(true);
    expect(assignMemberBranchSchema.safeParse({ params: { userId: uid }, body: { branchId: "nope" } }).success).toBe(false);
    expect(unassignMemberBranchSchema.safeParse({ params: { userId: uid, branchId } }).success).toBe(true);
    expect(unassignMemberBranchSchema.safeParse({ params: { userId: uid, branchId: "x" } }).success).toBe(false);
  });

  describe("updateMemberProfileSchema", () => {
    const parse = (body: unknown) => updateMemberProfileSchema.safeParse({ params: { userId: uid }, body });
    it("needs at least one field", () => {
      expect(parse({}).success).toBe(false);
      expect(parse({ firstName: "Ada" }).success).toBe(true);
    });
    it("trims and bounds names", () => {
      expect(parse({ firstName: "   " }).success).toBe(false);
      expect(parse({ lastName: "x".repeat(61) }).success).toBe(false);
      const ok = parse({ firstName: "  Ada " });
      if (ok.success) expect(ok.data.body.firstName).toBe("Ada");
    });
    it("accepts an empty phone or a plausible one, rejects junk", () => {
      expect(parse({ phoneNumber: "" }).success).toBe(true);
      expect(parse({ phoneNumber: "+44 (0)7700 900123" }).success).toBe(true);
      expect(parse({ phoneNumber: "call me" }).success).toBe(false);
      expect(parse({ phoneNumber: "123" }).success).toBe(false);
    });
  });

  describe("removeMemberSchema", () => {
    const parse = (body: unknown) => removeMemberSchema.safeParse({ params: { userId: uid }, body });
    it("requires the literal REMOVE", () => {
      expect(parse({ confirm: "REMOVE" }).success).toBe(true);
      expect(parse({ confirm: "remove" }).success).toBe(false);
      expect(parse({}).success).toBe(false);
    });
    it("takes a non-empty text new owner id", () => {
      expect(parse({ confirm: "REMOVE", newOwnerId: "user_xyz" }).success).toBe(true);
      expect(parse({ confirm: "REMOVE", newOwnerId: "" }).success).toBe(false);
    });
  });
});
