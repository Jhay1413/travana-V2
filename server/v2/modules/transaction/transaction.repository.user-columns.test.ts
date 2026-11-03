import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The deal details response embeds the owning agent. It must pick safe columns,
// never the full user row (password hash, reset/invite/verification tokens).
const source = readFileSync(fileURLToPath(new URL("./transaction.repository.ts", import.meta.url)), "utf8");

describe("transaction.repository agent lookup", () => {
  it("never selects the whole user row", () => {
    expect(source).not.toMatch(/db\.select\(\)\.from\(user\)/);
  });

  it("selects only id, name, email, image, phoneNumber, firstName, lastName", () => {
    const m = source.match(/const \[agent\] = [^\n]*?db\.select\(\{([^}]*)\}\)\.from\(user\)/);
    expect(m).not.toBeNull();
    const keys = (m as RegExpMatchArray)[1].split(",").map((p) => p.split(":")[0].trim()).sort();
    expect(keys).toEqual(["email", "firstName", "id", "image", "lastName", "name", "phoneNumber"]);
  });
});
