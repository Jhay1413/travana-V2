import { describe, it, expect, beforeEach } from "vitest";
import { clientService } from "./client.service";
import { clientRepository } from "./client.repository";
import { neonClientRepository } from "../neon-client/neon-client.repository";
import { truncateAll, makeOrg, makeBranch, makeUser, makeClient, makeTransaction } from "../../test/factories";

// Real-Postgres check of the client soft delete: hidden from lists/search/get,
// the deal survives, double delete is a 409, other orgs read 404.

function scope(over: Record<string, unknown>) {
  return { branchId: null, userId: null, orgRoles: [], ...over } as never;
}

let org: { id: string };
let branch: { id: string };
let admin: { id: string };

beforeEach(async () => {
  await truncateAll();
  org = await makeOrg();
  branch = await makeBranch(org.id);
  admin = await makeUser();
});

describe("clientService.deleteClient (soft delete)", () => {
  it("hides the client from lists and search but keeps its deal", async () => {
    const keep = await makeClient({ orgId: org.id, branchId: branch.id, firstName: "Keep" });
    const gone = await makeClient({ orgId: org.id, branchId: branch.id, firstName: "Gone" });
    const txn = await makeTransaction({ user_id: admin.id, org_id: org.id, branch_id: branch.id, client_id: gone.id });
    const s = scope({ orgId: org.id, orgRole: "org_admin", userId: admin.id });

    await clientService.deleteClient(gone.id, s);

    const all = await neonClientRepository.findAll(s);
    expect(all.map((c) => c.id)).toEqual([keep.id]);
    const page = await neonClientRepository.findPaginated(1, 10, "Gone", s);
    expect(page.clients).toHaveLength(0);
    expect(await clientRepository.findById(gone.id, s)).toBeUndefined();
    const row = await clientRepository.findByIdIncludingDeleted(gone.id, s);
    expect(row?.deletedAt).toBeTruthy();
    expect(row?.deletedBy).toBe(admin.id);
    expect(txn.client_id).toBe(gone.id);
  });

  it("409s on a second delete and 404s for another org", async () => {
    const c = await makeClient({ orgId: org.id, branchId: branch.id });
    const s = scope({ orgId: org.id, orgRole: "org_admin", userId: admin.id });
    await clientService.deleteClient(c.id, s);
    await expect(clientService.deleteClient(c.id, s)).rejects.toMatchObject({ statusCode: 409 });

    const other = await makeOrg();
    const c2 = await makeClient({ orgId: org.id, branchId: branch.id });
    await expect(
      clientService.deleteClient(c2.id, scope({ orgId: other.id, orgRole: "org_admin", userId: admin.id })),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
