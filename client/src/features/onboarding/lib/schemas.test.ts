import { describe, expect, it } from "vitest";
import { HOMEWORKER_SHOP } from "./roles";
import {
  agentSchema,
  businessSchema,
  commissionChange,
  commissionSchema,
  commissionValue,
  makeTeamMemberSchema,
  shopSchema,
  signupSchema,
} from "./schemas";

const business = {
  businessType: "single" as const,
  businessName: "Sunrise Travel",
  phone: "0191 000 0000",
  address: "1 High Street",
  website: "",
  email: "a@b.co",
  hasBranchManager: true,
  agentCount: "5",
};

describe("businessSchema", () => {
  it("accepts a valid single shop", () => {
    expect(businessSchema.safeParse(business).success).toBe(true);
  });
  it("checks the contract minimums", () => {
    expect(businessSchema.safeParse({ ...business, businessName: "A" }).success).toBe(false);
    expect(businessSchema.safeParse({ ...business, address: "1 Hi" }).success).toBe(false);
    expect(businessSchema.safeParse({ ...business, website: "ftp://x.co" }).success).toBe(false);
    expect(businessSchema.safeParse({ ...business, website: "https://x.co" }).success).toBe(true);
  });
  it("limits agents to 1-50 for single shops only", () => {
    expect(businessSchema.safeParse({ ...business, agentCount: "51" }).success).toBe(false);
    expect(businessSchema.safeParse({ ...business, agentCount: "0" }).success).toBe(false);
    expect(businessSchema.safeParse({ ...business, businessType: "multi", agentCount: "" }).success).toBe(true);
  });
});

describe("shopSchema", () => {
  const shop = { name: "Hetton", phone: "0191 000 0001", address: "12 Front St", email: "s@b.co", managerEmail: "m@b.co" };
  it("accepts a valid shop and reserves Homeworker", () => {
    expect(shopSchema.safeParse(shop).success).toBe(true);
    expect(shopSchema.safeParse({ ...shop, name: "homeworker" }).success).toBe(false);
    expect(shopSchema.safeParse({ ...shop, managerEmail: "nope" }).success).toBe(false);
  });
  it("makes the manager email optional", () => {
    expect(shopSchema.safeParse({ ...shop, managerEmail: "" }).success).toBe(true);
    expect(shopSchema.safeParse({ ...shop, managerEmail: "  " }).success).toBe(true);
  });
});

describe("people schemas", () => {
  const person = { firstName: "A", lastName: "B", email: "a@b.co", role: "Branch Manager" };
  it("transforms the role", () => {
    const r = agentSchema.parse(person);
    expect(r.role).toBe("branch_manager");
    expect(agentSchema.safeParse({ ...person, role: "Boss" }).success).toBe(false);
  });
  it("rejects homeworker as a role or shop in a single-shop table, with a hint", () => {
    const role = agentSchema.safeParse({ ...person, role: "Homeworker" });
    expect(role.success).toBe(false);
    expect(JSON.stringify(role)).toContain("multi-shop");
    expect(agentSchema.safeParse({ ...person, role: "Agent", shop: HOMEWORKER_SHOP }).success).toBe(false);
    expect(agentSchema.safeParse({ ...person, role: "Agent", shop: "" }).success).toBe(true);
  });
  it("requires a known shop or the homeworker sentinel", () => {
    const schema = makeTeamMemberSchema([{ id: "b1", name: "Hetton" }]);
    expect(schema.safeParse({ ...person, shop: "b1" }).success).toBe(true);
    expect(schema.safeParse({ ...person, shop: HOMEWORKER_SHOP }).success).toBe(true);
    expect(schema.safeParse({ ...person, shop: "Elsewhere" }).success).toBe(false);
    expect(schema.safeParse({ ...person, shop: "" }).success).toBe(false);
  });
});

describe("commission", () => {
  it("allows blank or whole 0-100", () => {
    for (const v of ["", "0", "60", "100"]) expect(commissionSchema.safeParse(v).success).toBe(true);
    for (const v of ["101", "-1", "5.5", "abc"]) expect(commissionSchema.safeParse(v).success).toBe(false);
  });
  it("saves on any difference, including clearing", () => {
    expect(commissionChange("60", null)).toEqual({ save: true, value: 60 });
    expect(commissionChange("", 40)).toEqual({ save: true, value: null });
    expect(commissionChange("40", 40).save).toBe(false);
    expect(commissionChange("", null).save).toBe(false);
  });
  it("converts to a number or null", () => {
    expect(commissionValue(" ")).toBeNull();
    expect(commissionValue("60")).toBe(60);
  });
});

describe("signupSchema", () => {
  it("needs an 8 character password", () => {
    const ok = { businessName: "Sun", firstName: "A", lastName: "B", email: "a@b.co", password: "12345678" };
    expect(signupSchema.safeParse(ok).success).toBe(true);
    expect(signupSchema.safeParse({ ...ok, password: "1234567" }).success).toBe(false);
  });
});
