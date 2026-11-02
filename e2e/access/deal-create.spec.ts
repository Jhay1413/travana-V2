/**
 * B1: POST /api/v2/transactions decides tenancy and ownership itself. The body's org_id is ignored (the deal is
 * made in the caller's agency), branch_id is the caller's own shop (an admin may pick a branch of their own
 * agency, never a foreign one), client_id must be a client the caller can see, user_id must be on the agency's
 * roster, and an agent with no shop cannot create deals at all. Every refusal writes nothing.
 */
import type { Page } from "@playwright/test";
import { dataOf, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { shopsWorld, type ShopsWorld } from "../helpers/shops";
import { queryRows, seedBranchlessMember } from "../helpers/seed";

/** Deals that touch these clients or owners: counted this way so an unrelated deal can never mask a write. */
async function dealCount(clientIds: string[], userIds: string[] = []): Promise<number> {
  const [{ n }] = await queryRows<{ n: number }>(
    `select count(*)::int as n from transaction where client_id = any($1::uuid[]) or user_id = any($2::text[])`,
    [clientIds, userIds],
  );
  return n;
}

function enquiryBody(o: ShopsWorld, extra: Record<string, unknown>) {
  return {
    client_id: o.w.clientId,
    user_id: o.w.userId,
    ...extra,
    enquiry: { title: "Created by the create spec", holiday_type_id: o.agency.ref.packageType, status: "ACTIVE", travel_date: "2027-06-14" },
  };
}

/** The other agency's ids, read straight from its seeded deal. */
async function foreignIds(o: ShopsWorld) {
  const [row] = await queryRows<{ org_id: string; branch_id: string; client_id: string; user_id: string }>(
    `select org_id, branch_id, client_id, user_id from transaction where id = $1`,
    [o.foreign.quote.transactionId],
  );
  return row;
}

async function post(page: Page, data: Record<string, unknown>) {
  return page.request.post("/api/v2/transactions", { data });
}

test.describe("creating a deal", () => {
  test("a body org_id and branch_id from an agent are ignored: the deal lands in the agent's own agency and shop", async ({ page }) => {
    const o = await shopsWorld(page); // signed in as shop 1's agent
    const f = await foreignIds(o);
    const res = await post(page, enquiryBody(o, { org_id: f.org_id, branch_id: o.branch2Id }));
    const created = await dataOf<{ transaction: { id: string } }>(res, 201);
    const [row] = await queryRows<{ org_id: string; branch_id: string }>(`select org_id, branch_id from transaction where id = $1`, [created.transaction.id]);
    expect(row).toEqual({ org_id: o.agency.orgId, branch_id: o.agency.branchId });
  });

  test("a foreign client_id is refused with 404 on every create shape, and nothing is written", async ({ page }) => {
    const o = await shopsWorld(page);
    const f = await foreignIds(o);
    const before = await dealCount([f.client_id], [o.w.userId]);
    const base = { client_id: f.client_id, user_id: o.w.userId };
    const shapes: Record<string, unknown>[] = [
      base,
      { ...base, enquiry: { title: "x", holiday_type_id: o.agency.ref.packageType } },
      { ...base, quote: { holiday_type_id: o.agency.ref.packageType, travel_date: "2027-06-14", title: "x" } },
      { ...base, booking: { holiday_type_id: o.agency.ref.packageType, travel_date: "2027-06-14", title: "x", hays_ref: "HAY-1234567", supplier_ref: "S" } },
    ];
    for (const data of shapes) {
      const res = await post(page, data);
      expect(res.status(), await res.text()).toBe(404);
    }
    expect(await dealCount([f.client_id], [o.w.userId])).toBe(before);
    expect(await queryRows(`select 1 from transaction where client_id = $1 and org_id = $2`, [f.client_id, o.agency.orgId])).toEqual([]);
  });

  test("a foreign user_id is refused with 400, and nothing is written", async ({ page }) => {
    const o = await shopsWorld(page);
    const f = await foreignIds(o);
    const before = await dealCount([o.w.clientId], [f.user_id]);
    const res = await post(page, enquiryBody(o, { user_id: f.user_id }));
    expect(res.status(), await res.text()).toBe(400);
    expect(await dealCount([o.w.clientId], [f.user_id])).toBe(before);
  });

  test("an admin may pick a branch of their own agency, but a foreign branch_id is refused with 400 and nothing is written", async ({ page }) => {
    const o = await shopsWorld(page);
    const f = await foreignIds(o);
    await signIn(page, o.agency.adminEmail);

    const before = await dealCount([o.w.clientId], [o.agency.adminId]);
    const bad = await post(page, enquiryBody(o, { user_id: o.agency.adminId, branch_id: f.branch_id }));
    expect(bad.status(), await bad.text()).toBe(400);
    expect(await dealCount([o.w.clientId], [o.agency.adminId])).toBe(before);

    const ok = await post(page, enquiryBody(o, { user_id: o.agency.adminId, branch_id: o.branch2Id }));
    const created = await dataOf<{ transaction: { id: string } }>(ok, 201);
    const [row] = await queryRows<{ org_id: string; branch_id: string }>(`select org_id, branch_id from transaction where id = $1`, [created.transaction.id]);
    expect(row).toEqual({ org_id: o.agency.orgId, branch_id: o.branch2Id });
  });

  test("an agent or branch manager with no shop cannot create a deal (403), and nothing is written", async ({ page }) => {
    const o = await shopsWorld(page);
    for (const orgRole of ["agent", "branch_manager"] as const) {
      const nobody = await seedBranchlessMember({ orgId: o.agency.orgId, orgRole });
      await signIn(page, nobody.email);
      const before = await dealCount([o.w.clientId], [nobody.id]);
      const res = await post(page, { client_id: o.w.clientId, user_id: nobody.id, enquiry: { title: "x", holiday_type_id: o.agency.ref.packageType } });
      const text = await res.text();
      expect(res.status(), `${orgRole}: ${text}`).toBe(403);
      expect(text, orgRole).toContain("not in a shop");
      expect(await dealCount([o.w.clientId], [nobody.id]), orgRole).toBe(before);
    }
  });

  test("control: the shop's own agent creates a deal for a client of the agency", async ({ page }) => {
    const o = await shopsWorld(page);
    const res = await post(page, enquiryBody(o, {}));
    expect(res.status(), await res.text()).toBe(201);
  });
});
