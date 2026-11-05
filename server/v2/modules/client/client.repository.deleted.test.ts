import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { clientRepository } from "./client.repository";
import { neonClientRepository } from "../neon-client/neon-client.repository";
import { renderWhere, resetCapture, setRows } from "../../test/capture-db";

beforeEach(() => resetCapture());

const SCOPE = { orgId: "o1", branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: "u1", branchType: null, ownsHomeworkerRole: false } as never;
const DELETED = '"client_table"."deleted_at" is null';

describe("soft-deleted clients are hidden from reads", () => {
  it("clientRepository.findAll", async () => {
    setRows([]);
    await clientRepository.findAll(SCOPE);
    expect(renderWhere(0).text).toContain(DELETED);
  });
  it("clientRepository.findById", async () => {
    setRows([]);
    await clientRepository.findById("c1", SCOPE);
    expect(renderWhere(0).text).toContain(DELETED);
  });
  it("clientRepository.findByIdIncludingDeleted does not filter", async () => {
    setRows([]);
    await clientRepository.findByIdIncludingDeleted("c1", SCOPE);
    expect(renderWhere(0).text).not.toContain("deleted_at");
  });
  it("neonClientRepository list, search and matches", async () => {
    setRows([]);
    await neonClientRepository.findAll(SCOPE);
    await neonClientRepository.findPaginated(1, 10, "john", SCOPE);
    await neonClientRepository.findMatches({ email: "a@b.com" }, SCOPE);
    await neonClientRepository.findById("c1", SCOPE);
    for (let i = 0; i < 5; i++) expect(renderWhere(i).text).toContain(DELETED);
  });
  it("softDelete only touches not-yet-deleted rows", async () => {
    setRows([{ id: "c1" }]);
    await expect(clientRepository.softDelete("c1", SCOPE, "u1")).resolves.toBe(true);
    expect(renderWhere(0).text).toContain(DELETED);
  });
});
