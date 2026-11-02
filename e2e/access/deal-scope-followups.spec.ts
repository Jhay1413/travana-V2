/**
 * Follow-ups to the shop pin, from the independent access review:
 *  B2  quote sharing (generate-token, send-whatsapp, sent = write scope; views, customer-actions = read scope;
 *      the client page's views list is pinned like its deals), and the public quote link keeps working
 *  B4  an enquiry edit only writes the enquiry's own columns
 *  B3/S4 opportunities and search results are pinned to the caller's shop (nothing with no shop)
 *  S5  editing, completing, reassigning and deleting a task on another shop's deal
 *  S6  applying wallet credit to a booking of another client or another shop
 *  S9  a legacy deal with no shop recorded belongs to the agent who owns it (and to admins)
 */
import { request as playwrightRequest } from "@playwright/test";
import { dataOf, quotePayload, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { shopsWorld } from "../helpers/shops";
import { queryRows, seedBranchlessMember } from "../helpers/seed";

const OTHER_SHOP = "This deal belongs to another shop";

async function expectStatus(res: import("@playwright/test").APIResponse, status: number, label: string) {
  const text = await res.text();
  expect(res.status(), `${label}: ${text}`).toBe(status);
  return text;
}

/** Opens shop 2's quote through its public link, as an anonymous customer, so it has one recorded view. */
async function viewPublicly(baseURL: string, token: string, ip: string) {
  const anon = await playwrightRequest.newContext({ baseURL, extraHTTPHeaders: { "X-Forwarded-For": ip } });
  const page = await anon.get(`/api/public/quote/${token}`);
  expect(page.status(), await page.text()).toBe(200);
  const view = await anon.post(`/api/public/quote/${token}/view`);
  expect(view.status(), await view.text()).toBe(200);
  await anon.dispose();
}

test.describe("quote sharing follows the deal scope (B2)", () => {
  test("another shop's agent gets 403 on generate-token, send-whatsapp and sent; an unrelated agency and a no-shop agent get 404; nothing changes", async ({ page }) => {
    const o = await shopsWorld(page);
    const q = o.deal2.entityId;
    const nobody = await seedBranchlessMember({ orgId: o.agency.orgId, orgRole: "agent" });

    await signIn(page, o.agency.agentEmail); // shop 1
    const attempts = [
      page.request.post(`/api/v2/quote-share/${q}/generate-token`),
      page.request.post(`/api/v2/quote-share/${q}/send-whatsapp`, { data: { clientId: o.deal2.clientId } }),
      page.request.patch(`/api/v2/quote-share/${q}/sent`, { data: { sentVia: "email" } }),
    ];
    for (const res of await Promise.all(attempts)) expect(await expectStatus(res, 403, "shop 1 -> shop 2")).toContain(OTHER_SHOP);

    for (const email of [o.foreign.agentEmail, nobody.email]) {
      await signIn(page, email);
      for (const res of await Promise.all([
        page.request.post(`/api/v2/quote-share/${q}/generate-token`),
        page.request.post(`/api/v2/quote-share/${q}/send-whatsapp`, { data: { clientId: o.deal2.clientId } }),
        page.request.patch(`/api/v2/quote-share/${q}/sent`, { data: { sentVia: "email" } }),
        page.request.get(`/api/v2/quote-share/${q}/views`),
        page.request.get(`/api/v2/quote-share/${q}/customer-actions`),
      ])) {
        await expectStatus(res, 404, email);
      }
    }
    const [row] = await queryRows<{ quote_token: string | null; quote_sent_via: string | null }>(`select quote_token, quote_sent_via from quote_table where id = $1`, [q]);
    expect(row.quote_token).toBeNull();
    expect(row.quote_sent_via).toBeNull();
  });

  test("the shop's own agent and the admin can share it, and the public link keeps working for the customer", async ({ page, baseURL }) => {
    const o = await shopsWorld(page);
    const q = o.deal2.entityId;

    await signIn(page, o.agent2.email);
    const { token } = await dataOf<{ token: string }>(await page.request.post(`/api/v2/quote-share/${q}/generate-token`));
    expect(token).toBeTruthy();
    await expectStatus(await page.request.patch(`/api/v2/quote-share/${q}/sent`, { data: { sentVia: "email" } }), 200, "own shop marks sent");
    await viewPublicly(baseURL!, token, "10.9.9.1");

    // The link is not tied to a login: an admin asking for it again gets the same token, and it still opens.
    await signIn(page, o.agency.adminEmail);
    const again = await dataOf<{ token: string }>(await page.request.post(`/api/v2/quote-share/${q}/generate-token`));
    expect(again.token).toBe(token);
    await viewPublicly(baseURL!, token, "10.9.9.2");
  });

  test("reads: a shop-1 agent can read the stats of a shop-2 quote (the org-wide read scope), a no-shop agent cannot", async ({ page }) => {
    const o = await shopsWorld(page);
    const q = o.deal2.entityId;
    const nobody = await seedBranchlessMember({ orgId: o.agency.orgId, orgRole: "agent" });
    await signIn(page, o.agency.agentEmail);
    await expectStatus(await page.request.get(`/api/v2/quote-share/${q}/views`), 200, "shop 1 views");
    await expectStatus(await page.request.get(`/api/v2/quote-share/${q}/customer-actions`), 200, "shop 1 actions");
    await signIn(page, nobody.email);
    await expectStatus(await page.request.get(`/api/v2/quote-share/${q}/views`), 404, "no shop views");
    await expectStatus(await page.request.get(`/api/v2/quote-share/${q}/customer-actions`), 404, "no shop actions");
  });

  test("the client page's Views list is pinned like its deals: shop 2 and the admin see the viewed quote; shop 1 and a no-shop agent do not", async ({ page, baseURL }) => {
    const o = await shopsWorld(page);
    await signIn(page, o.agent2.email);
    const { token } = await dataOf<{ token: string }>(await page.request.post(`/api/v2/quote-share/${o.deal2.entityId}/generate-token`));
    await viewPublicly(baseURL!, token, "10.9.9.3");

    const viewed = async () => (await dataOf<{ quoteId: string }[]>(await page.request.get(`/api/v2/quote-share/client/${o.deal2.clientId}/views`))).map((v) => v.quoteId);
    expect(await viewed()).toEqual([o.deal2.entityId]);
    await signIn(page, o.agency.adminEmail);
    expect(await viewed()).toEqual([o.deal2.entityId]);

    await signIn(page, o.agency.agentEmail);
    expect(await viewed()).toEqual([]);
    const nobody = await seedBranchlessMember({ orgId: o.agency.orgId, orgRole: "branch_manager" });
    await signIn(page, nobody.email);
    expect(await viewed()).toEqual([]);
  });
});

test.describe("editing an enquiry writes only the enquiry's own columns (B4)", () => {
  test("transaction_id, org / branch, deleted_at and id are refused (400) and nothing changes; a normal edit still works", async ({ page }) => {
    const o = await shopsWorld(page);
    await signIn(page, o.agent2.email);
    const e = o.enquiry2.entityId;
    const forbidden: Record<string, unknown>[] = [
      { transaction_id: o.deal2.transactionId },
      { org_id: o.agency.orgId },
      { branch_id: o.branch2Id },
      { deleted_at: new Date().toISOString() },
      { deleted_by: o.agent2.id },
      { id: o.deal2.entityId },
      { is_active: false },
    ];
    for (const extra of forbidden) {
      const res = await page.request.patch(`/api/v2/enquiries/${e}`, { data: { title: "Sneaky", ...extra } });
      await expectStatus(res, 400, JSON.stringify(Object.keys(extra)));
    }
    const [row] = await queryRows<{ id: string; title: string; transaction_id: string; deleted_at: string | null; is_active: boolean | null }>(
      `select id, title, transaction_id, deleted_at, is_active from enquiry_table where id = $1`,
      [e],
    );
    expect(row).toMatchObject({ id: e, title: "Shop 2 enquiry", transaction_id: o.enquiry2.transactionId, deleted_at: null });
    expect(row.is_active).not.toBe(false);

    const ok = await page.request.patch(`/api/v2/enquiries/${e}`, { data: { title: "Renamed by its shop", budget: "1500", notes: "ignored non-column key" } });
    await expectStatus(ok, 200, "normal edit");
    const [after] = await queryRows<{ title: string; budget: string }>(`select title, budget from enquiry_table where id = $1`, [e]);
    expect(after).toEqual({ title: "Renamed by its shop", budget: "1500" });
  });
});

test.describe("opportunities and search are pinned to the caller's shop (B3, S4)", () => {
  test("opportunities: shop 1 and a no-shop agent do not see shop 2's deals; shop 2 and the admin do", async ({ page }) => {
    const o = await shopsWorld(page);
    const ids = async (kind: "quotes" | "bookings" | "enquiries") =>
      (await dataOf<{ items: { transactionId: string }[] }>(await page.request.get(`/api/v2/opportunities/${kind}?limit=100`))).items.map((i) => i.transactionId);
    const nobody = await seedBranchlessMember({ orgId: o.agency.orgId, orgRole: "branch_manager" });

    for (const email of [o.agent2.email, o.agency.adminEmail]) {
      await signIn(page, email);
      expect(await ids("quotes"), email).toContain(o.deal2.transactionId);
      expect(await ids("bookings"), email).toContain(o.booked2.transactionId);
      expect(await ids("enquiries"), email).toContain(o.enquiry2.transactionId);
    }
    for (const email of [o.agency.agentEmail, o.manager1.email, nobody.email]) {
      await signIn(page, email);
      expect(await ids("quotes"), email).not.toContain(o.deal2.transactionId);
      expect(await ids("bookings"), email).not.toContain(o.booked2.transactionId);
      expect(await ids("enquiries"), email).not.toContain(o.enquiry2.transactionId);
    }
    await signIn(page, nobody.email);
    expect(await ids("quotes")).toEqual([]);
    expect(await ids("bookings")).toEqual([]);
    expect(await ids("enquiries")).toEqual([]);
  });

  test("search: booking results are pinned to the shop, client results stay agency-wide", async ({ page }) => {
    const o = await shopsWorld(page);
    const [{ surename }] = await queryRows<{ surename: string }>(`select "surename" from client_table where id = $1`, [o.booked2.clientId]);
    const search = async (term: string) => dataOf<{ clients: { id: string }[]; bookings: { id: string }[] }>(await page.request.get(`/api/v2/search?q=${encodeURIComponent(term)}`));
    const nobody = await seedBranchlessMember({ orgId: o.agency.orgId, orgRole: "agent" });

    for (const email of [o.agent2.email, o.agency.adminEmail]) {
      await signIn(page, email);
      expect((await search("HAY-1234567")).bookings.map((b) => b.id), email).toContain(o.booked2.bookingId);
    }
    for (const email of [o.agency.agentEmail, o.manager1.email, nobody.email]) {
      await signIn(page, email);
      expect((await search("HAY-1234567")).bookings.map((b) => b.id), `${email} booking results`).not.toContain(o.booked2.bookingId);
      expect((await search(surename)).clients.map((c) => c.id), `${email} client results`).toContain(o.booked2.clientId);
    }
  });
});

test.describe("tasks on another shop's deal (S5)", () => {
  test("a shop-1 agent cannot edit, complete, reassign or delete shop 2's task; shop 2 and the admin can", async ({ page }) => {
    const o = await shopsWorld(page);
    await signIn(page, o.agent2.email);
    const task = await dataOf<{ id: string }>(
      await page.request.post("/api/v2/tasks", { data: { title: "Shop two task", entityType: "quote", entityId: o.deal2.entityId, userId: o.agent2.id } }),
      201,
    );

    await signIn(page, o.agency.agentEmail); // shop 1
    const attempts: [string, Promise<import("@playwright/test").APIResponse>][] = [
      ["edit", page.request.put(`/api/v2/tasks/${task.id}`, { data: { title: "Hacked" } })],
      ["complete", page.request.put(`/api/v2/tasks/${task.id}/toggle`)],
      ["reassign", page.request.put(`/api/v2/tasks/${task.id}`, { data: { userId: o.w.userId } })],
      ["delete", page.request.delete(`/api/v2/tasks/${task.id}`)],
    ];
    for (const [label, pending] of attempts) {
      const res = await pending;
      const text = await res.text();
      expect(res.status(), `${label}: ${text}`).toBe(403);
      expect(text, label).toContain(OTHER_SHOP);
    }
    const [row] = await queryRows<{ title: string; completed: boolean | null; user_id: string }>(`select title, completed, user_id from tasks where id = $1`, [task.id]);
    expect({ title: row.title, user_id: row.user_id }).toEqual({ title: "Shop two task", user_id: o.agent2.id });
    expect(row.completed, "not completed").toBeFalsy();

    await signIn(page, o.agent2.email);
    await expectStatus(await page.request.put(`/api/v2/tasks/${task.id}/toggle`), 200, "own shop completes");
    await signIn(page, o.agency.adminEmail);
    await expectStatus(await page.request.put(`/api/v2/tasks/${task.id}`, { data: { title: "Admin edit" } }), 200, "admin edits");
    await expectStatus(await page.request.delete(`/api/v2/tasks/${task.id}`), 200, "admin deletes");
  });
});

test.describe("wallet credit on a booking (S6)", () => {
  test("the booking must be on the same client and in the caller's write scope; nothing is written otherwise", async ({ page }) => {
    const o = await shopsWorld(page);
    await queryRows(`insert into wallet_transaction (client_id, type, amount, source, status) values ($1, 'credit', '100.00', 'referral_commission', 'processed')`, [o.booked2.clientId]);
    const debits = async () => (await queryRows(`select 1 from wallet_transaction where client_id = $1 and type = 'debit'`, [o.booked2.clientId])).length;
    const apply = (clientId: string, bookingId: string) =>
      page.request.post(`/api/v2/wallet/client/${clientId}/apply-booking-credit`, { data: { booking_id: bookingId, amount: "10" } });

    // A shop-1 branch manager: the booking is in shop 2 (outside their write scope).
    await signIn(page, o.manager1.email);
    await expectStatus(await apply(o.booked2.clientId, o.booked2.bookingId), 404, "other shop's booking");
    // The admin: a booking that belongs to a different client, and one that belongs to another agency.
    await signIn(page, o.agency.adminEmail);
    await expectStatus(await apply(o.deal2.clientId, o.booked2.bookingId), 404, "another client's booking");
    await expectStatus(await apply(o.booked2.clientId, o.foreign.bookingId), 404, "another agency's booking");
    expect(await debits()).toBe(0);

    await expectStatus(await apply(o.booked2.clientId, o.booked2.bookingId), 201, "the client's own booking");
    expect(await debits()).toBe(1);
  });
});

test.describe("legacy deals with no shop recorded (S9)", () => {
  test("the owning agent and admins can read and edit; another agent and a branch manager cannot", async ({ page }) => {
    const o = await shopsWorld(page);
    const q = o.w.userId; // shop 1's agent owns the deal below
    await signIn(page, o.agency.agentEmail);
    const own = await dataOf<{ transaction: { id: string }; quote: { id: string } }>(
      await page.request.post("/api/v2/transactions", {
        data: { client_id: o.w.clientId, user_id: q, quote: quotePayload(o.agency, { title: "Legacy deal" }) },
      }),
      201,
    );
    await queryRows(`update transaction set branch_id = null where id = $1`, [own.transaction.id]);
    const quoteId = own.quote.id;

    // The owner: reads and edits it.
    await expectStatus(await page.request.get(`/api/v2/quotes/${quoteId}`), 200, "owner reads");
    await expectStatus(await page.request.patch(`/api/v2/quotes/${quoteId}`, { data: { title: "Edited by owner" } }), 200, "owner edits");

    // Other agents (same agency) and a branch manager: not theirs, so not even visible.
    for (const email of [o.agent2.email, o.manager1.email]) {
      await signIn(page, email);
      await expectStatus(await page.request.get(`/api/v2/quotes/${quoteId}`), 404, `${email} reads`);
      await expectStatus(await page.request.patch(`/api/v2/quotes/${quoteId}`, { data: { title: "Hacked" } }), 404, `${email} edits`);
    }
    // The other agency: 404 as always.
    await signIn(page, o.foreign.agentEmail);
    await expectStatus(await page.request.get(`/api/v2/quotes/${quoteId}`), 404, "foreign reads");

    // Org admins: org-wide.
    await signIn(page, o.agency.adminEmail);
    await expectStatus(await page.request.get(`/api/v2/quotes/${quoteId}`), 200, "admin reads");
    await expectStatus(await page.request.patch(`/api/v2/quotes/${quoteId}`, { data: { title: "Edited by admin" } }), 200, "admin edits");
    const [row] = await queryRows<{ title: string }>(`select title from quote_table where id = $1`, [quoteId]);
    expect(row.title).toBe("Edited by admin");
  });
});
