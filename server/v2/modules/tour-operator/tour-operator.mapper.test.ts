import { describe, expect, it } from "vitest";
import { safeDecrypt, toOption, toOrgOperatorRow } from "./tour-operator.mapper";
import type { RawOrgOperator } from "./tour-operator.types";

const raw: RawOrgOperator = {
  linkId: "l1",
  operatorId: "op1",
  name: "TUI",
  code: "TU",
  website: "https://tui.co.uk",
  phone: "0203 451 2720",
  logo_url: null,
  username: "ann",
  encrypted_password: "CIPHER",
  commission_percentage: "10.00",
  balance_due_weeks: 14,
  is_active: true,
  updated_at: new Date("2026-10-12T09:00:00Z"),
};
const decrypt = (c: string) => (c === "CIPHER" ? "secret" : "");

describe("tour-operator.mapper", () => {
  it("toOption carries the catalogue id, link id and no credentials", () => {
    const o = toOption(raw);
    expect(o).toEqual({
      id: "op1",
      linkId: "l1",
      name: "TUI",
      logo_url: null,
      code: "TU",
      commission_percentage: "10.00",
      balance_due_weeks: 14,
      is_active: true,
    });
    expect(JSON.stringify(o)).not.toContain("CIPHER");
    expect(o).not.toHaveProperty("username");
  });

  it("includes the plaintext password only when revealing", () => {
    expect(toOrgOperatorRow(raw, { revealPasswords: true, decrypt }).password).toBe("secret");
    const hidden = toOrgOperatorRow(raw, { revealPasswords: false, decrypt });
    expect(hidden).not.toHaveProperty("password");
    expect(hidden.hasPassword).toBe(true);
    expect(JSON.stringify(hidden)).not.toContain("secret");
    expect(JSON.stringify(hidden)).not.toContain("CIPHER");
  });

  it("hasPassword is false without a stored password", () => {
    const row = toOrgOperatorRow({ ...raw, encrypted_password: null }, { revealPasswords: true, decrypt });
    expect(row.hasPassword).toBe(false);
    expect(row.password).toBeNull();
  });

  it("safeDecrypt returns null on failure and never the ciphertext", () => {
    const boom = () => {
      throw new Error("bad");
    };
    expect(safeDecrypt("CIPHER", boom)).toBeNull();
    expect(safeDecrypt(null, decrypt)).toBeNull();
  });

  it("serialises updated_at as ISO", () => {
    expect(toOrgOperatorRow(raw, { revealPasswords: false, decrypt }).updated_at).toBe("2026-10-12T09:00:00.000Z");
  });
});
