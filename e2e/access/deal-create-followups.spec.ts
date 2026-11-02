/**
 * Follow-ups on creating a deal:
 *  - a deal lands in its OWNER's shop (an admin creating for a shop-B agent, no branch_id sent), and an agent may
 *    only create for an owner in their own shop;
 *  - which clients a branch manager / homeworker may create a deal for (their own shop's or homeworker's, plus
 *    clients with no shop recorded; never another shop's);
 *  - a bad image on a new quote is dropped and reported, never stored;
 *  - malformed quote / booking bodies are a 400, not a 500; a blank user_id means "me".
 */
import type { Page } from "@playwright/test";
import { dataOf, quotePayload, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { shopsWorld, type ShopsWorld } from "../helpers/shops";
import { queryRows, seedHomeworker, seedPlatformAdmin } from "../helpers/seed";

function enquiryBody(o: ShopsWorld, clientId: string, userId: string, extra: Record<string, unknown> = {}) {
  return {
    client_id: clientId,
    user_id: userId,
    ...extra,
    enquiry: { title: "Follow-up spec", holiday_type_id: o.agency.ref.packageType, status: "ACTIVE", travel_date: "2027-06-14" },
  };
}

const post = (page: Page, data: Record<string, unknown>) => page.request.post("/api/v2/transactions", { data });

async function dealsFor(clientId: string): Promise<number> {
  const [{ n }] = await queryRows<{ n: number }>(`select count(*)::int as n from transaction where client_id = $1`, [clientId]);
  return n;
}

test.describe("a deal belongs to its owner's shop", () => {
  test("an admin creating for a shop-B agent without a branch_id lands in shop B, and that agent can see and edit it", async ({ page }) => {
    const o = await shopsWorld(page);
    await signIn(page, o.agency.adminEmail);
    const res = await post(page, enquiryBody(o, o.deal2.clientId, o.agent2.id));
    const created = await dataOf<{ transaction: { id: string }; enquiry: { id: string } }>(res, 201);
    const [row] = await queryRows<{ branch_id: string; user_id: string }>(`select branch_id, user_id from transaction where id = $1`, [created.transaction.id]);
    expect(row).toEqual({ branch_id: o.branch2Id, user_id: o.agent2.id });

    await signIn(page, o.agent2.email);
    const board = await dataOf<{ items: { id: string }[] }>(await page.request.get("/api/v2/transactions/pipeline/enquiry?limit=50"));
    expect(board.items.map((i) => i.id)).toContain(created.transaction.id);
    expect((await page.request.patch(`/api/v2/transactions/${created.transaction.id}/priority`, { data: { priority: "high" } })).status()).toBe(200);
    expect((await page.request.patch(`/api/v2/enquiries/${created.enquiry.id}`, { data: { title: "Edited by shop B" } })).status()).toBe(200);
  });

  test("an agent creating a deal for an owner in another shop is refused with 400, and nothing is written", async ({ page }) => {
    const o = await shopsWorld(page); // shop 1's agent
    const before = await dealsFor(o.w.clientId);
    const res = await post(page, enquiryBody(o, o.w.clientId, o.agent2.id));
    expect(res.status(), await res.text()).toBe(400);
    expect(await dealsFor(o.w.clientId)).toBe(before);
  });
});

test.describe("which clients a deal can be created for", () => {
  test("a branch manager can create for a client with no shop, but not for another shop's client (nothing written)", async ({ page }) => {
    const o = await shopsWorld(page);
    await queryRows(`update client_table set branch_id = null where id = $1`, [o.w.clientId]);
    const [{ branchId }] = await queryRows<{ branchId: string }>(`select branch_id as "branchId" from client_table where id = $1`, [o.deal2.clientId]);
    expect(branchId, "the shop-2 client really is in shop 2").toBe(o.branch2Id);

    await signIn(page, o.manager1.email);
    const ok = await post(page, enquiryBody(o, o.w.clientId, o.manager1.id));
    expect(ok.status(), await ok.text()).toBe(201);

    const before = await dealsFor(o.deal2.clientId);
    const refused = await post(page, enquiryBody(o, o.deal2.clientId, o.manager1.id));
    expect(refused.status(), await refused.text()).toBe(404);
    expect(await dealsFor(o.deal2.clientId)).toBe(before);
  });

  test("a homeworker can create for a client with no shop", async ({ page }) => {
    const o = await shopsWorld(page);
    const hw = await seedHomeworker(o.agency.orgId);
    await queryRows(`update client_table set branch_id = null where id = $1`, [o.w.clientId]);
    await signIn(page, hw.email);
    const res = await post(page, enquiryBody(o, o.w.clientId, hw.id));
    expect(res.status(), await res.text()).toBe(201);
    const [{ branch_id }] = await queryRows<{ branch_id: string }>(`select branch_id from transaction where client_id = $1 and user_id = $2`, [o.w.clientId, hw.id]);
    expect(branch_id).toBe(hw.branchId);
  });
});

test.describe("a bad image on a new quote", () => {
  test("is dropped and reported: the quote is still added, without that image", async ({ page }) => {
    const o = await shopsWorld(page);
    await signIn(page, o.agent2.email);
    const count = async () => (await queryRows<{ n: number }>(`select count(*)::int as n from quote_table where transaction_id = $1`, [o.deal2.transactionId]))[0].n;
    const before = await count();
    const privateKey = "/api/v2/files/img?key=client-files%2F1.pdf";
    const res = await page.request.post("/api/v2/quotes", {
      data: { transaction_id: o.deal2.transactionId, isQuoteCopy: true, ...quotePayload(o.agency, { title: "Bad image" }), images: [privateKey, "https://images.e2e.test/ok.jpg"] },
    });
    const created = await dataOf<{ id: string; skippedImageUrls: string[] }>(res, 201);
    expect(created.skippedImageUrls).toEqual([privateKey]);
    expect(await count()).toBe(before + 1);
    const urls = await queryRows<{ url: string }>(`select url from quote_images where quote_id = $1`, [created.id]);
    expect(urls.map((r) => r.url)).toEqual(["https://images.e2e.test/ok.jpg"]);
  });
});

test.describe("malformed deal bodies are a 400, never a 500", () => {
  test("quote and booking bodies with bad ids, dates, enums, numbers and lists", async ({ page }) => {
    const o = await shopsWorld(page);
    const before = await dealsFor(o.w.clientId);
    const good = quotePayload(o.agency, { title: "Validated" });
    const bad: [string, string, Record<string, unknown>][] = [
      ["non-uuid client_id", "client_id: must be a valid id", { client_id: "nope", user_id: o.w.userId, quote: good }],
      ["non-uuid holiday_type_id", "quote.holiday_type_id: must be a valid id", { client_id: o.w.clientId, user_id: o.w.userId, quote: { ...good, holiday_type_id: "nope" } }],
      ["impossible quote date", "quote.travel_date: travel_date is not a valid date", { client_id: o.w.clientId, user_id: o.w.userId, quote: { ...good, travel_date: "2026-02-30" } }],
      ["impossible booking date", "booking.travel_date: travel_date is not a valid date", { client_id: o.w.clientId, user_id: o.w.userId, booking: { holiday_type_id: o.agency.ref.packageType, travel_date: "2026-02-30", hays_ref: "HAY-1234567", supplier_ref: "S" } }],
      ["bad quote_status", "quote.quote_status: Invalid quote_status", { client_id: o.w.clientId, user_id: o.w.userId, quote: { ...good, quote_status: "bogus" } }],
      ["bad transfer_type", "quote.transfer_type: Invalid transfer_type", { client_id: o.w.clientId, user_id: o.w.userId, quote: { ...good, transfer_type: "Teleport" } }],
      ["bad lead_source", "lead_source must be one of: SHOP", { client_id: o.w.clientId, user_id: o.w.userId, lead_source: "TELEPATHY", quote: good }],
      ["bad priority", "priority: Invalid enum value", { client_id: o.w.clientId, user_id: o.w.userId, priority: "urgent", quote: good }],
      ["non-numeric money", "quote.sales_price: must be a number", { client_id: o.w.clientId, user_id: o.w.userId, quote: { ...good, sales_price: "lots" } }],
      ["a supplied quote id", "quote id cannot be set", { client_id: o.w.clientId, user_id: o.w.userId, quote: { ...good, id: o.deal2.entityId } }],
      ["childAges not an array", "quote.childAges: Expected array, received string", { client_id: o.w.clientId, user_id: o.w.userId, quote: { ...good, childAges: "4,6" } }],
      ["transfers not an array", "quote.transfers: Expected array, received string", { client_id: o.w.clientId, user_id: o.w.userId, quote: { ...good, transfers: "none" } }],
      ["carHires not an array", "quote.carHires: Expected array, received object", { client_id: o.w.clientId, user_id: o.w.userId, quote: { ...good, carHires: { a: 1 } } }],
    ];
    for (const [label, message, data] of bad) {
      const res = await post(page, data);
      const text = await res.text();
      expect(res.status(), `${label}: ${text}`).toBe(400);
      expect((JSON.parse(text) as { message: string }).message, label).toContain(message);
    }
    expect(await dealsFor(o.w.clientId)).toBe(before);
  });

  test("a blank user_id means the caller, and a platform admin with no organisation gets a 400", async ({ page }) => {
    const o = await shopsWorld(page);
    const res = await post(page, enquiryBody(o, o.w.clientId, ""));
    const created = await dataOf<{ transaction: { id: string } }>(res, 201);
    const [row] = await queryRows<{ user_id: string }>(`select user_id from transaction where id = $1`, [created.transaction.id]);
    expect(row.user_id).toBe(o.w.userId);

    const platform = await seedPlatformAdmin();
    await signIn(page, platform.email);
    const refused = await post(page, enquiryBody(o, o.w.clientId, platform.id));
    expect(refused.status(), await refused.text()).toBe(400);
  });
});

test.describe("a platform admin impersonating an organisation", () => {
  test("can create a deal: \"me\" is replaced by the org's default owner, who is on the roster", async ({ page }) => {
    const o = await shopsWorld(page);
    const platform = await seedPlatformAdmin();
    await signIn(page, platform.email);
    const start = await page.request.post(`/api/v2/platform-admin/organizations/${o.agency.orgId}/impersonate`);
    expect(start.status(), await start.text()).toBe(200);

    // Both the dialogs (user_id = the signed-in user) and a blank user_id mean "me".
    for (const userId of [platform.id, ""]) {
      const res = await post(page, enquiryBody(o, o.w.clientId, userId));
      const created = await dataOf<{ transaction: { id: string } }>(res, 201);
      const [row] = await queryRows<{ user_id: string; branch_id: string | null; org_id: string; on_roster: boolean }>(
        `select t.user_id, t.branch_id, t.org_id,
                exists(select 1 from branch_members m where m.user_id = t.user_id and m.org_id = t.org_id and m.is_active) as on_roster
           from transaction t where t.id = $1`,
        [created.transaction.id],
      );
      expect(row.user_id).not.toBe(platform.id);
      expect(row.on_roster).toBe(true);
      expect(row.branch_id).not.toBeNull();
      expect(row.org_id).toBe(o.agency.orgId);
    }
  });
});
