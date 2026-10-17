import { describe, it, expect } from "vitest";
import {
  updateNeonClientValidator,
  createNeonClientValidator,
  setPortalPinValidator,
} from "./neon-client.validator";

const ID = "6f1c2f0e-8c3a-4a39-9d1e-2f6c5b9f7a11";
const FORBIDDEN = ["portalPin", "mustChangePin", "status", "mergedIntoId", "splitFromClientId", "vipEnrolledAt", "vipTier"];

describe("updateNeonClientValidator", () => {
  it("accepts the editable fields the forms send", () => {
    const r = updateNeonClientValidator.safeParse({
      params: { id: ID },
      body: { firstName: "A", email: null, badge: "VIP Client", aiReplyEnabled: false, referredByClientId: ID },
    });
    expect(r.success).toBe(true);
  });

  it.each(FORBIDDEN)("rejects %s", (field) => {
    const r = updateNeonClientValidator.safeParse({ params: { id: ID }, body: { firstName: "A", [field]: null } });
    expect(r.success).toBe(false);
  });
});

describe("createNeonClientValidator", () => {
  it("does not declare the system-managed fields", () => {
    const shape = createNeonClientValidator.shape.body.shape as Record<string, unknown>;
    for (const f of FORBIDDEN) expect(shape).not.toHaveProperty(f);
  });
});

describe("setPortalPinValidator", () => {
  const parse = (pin: unknown) => setPortalPinValidator.safeParse({ params: { id: ID }, body: { pin } }).success;
  it("accepts exactly four digits", () => expect(parse("0420")).toBe(true));
  it.each(["123", "12345", "12a4", "", 1234])("rejects %s", (pin) => expect(parse(pin)).toBe(false));
});

describe("importNeonClientsValidator", () => {
  it("declares no system-managed fields on import rows", async () => {
    const { importNeonClientsValidator } = await import("./neon-client.validator");
    const row = importNeonClientsValidator.shape.body.shape.clients.element.shape as Record<string, unknown>;
    for (const f of FORBIDDEN) expect(row).not.toHaveProperty(f);
  });
});
