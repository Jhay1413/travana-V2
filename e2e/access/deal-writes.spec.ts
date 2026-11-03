/**
 * S1 / S2 / S7: every write that targets a deal uses the shop-pinned write scope, answers 403 "This deal belongs to
 * another shop" for a readable deal in another shop (404 for another agency), and the client page's notes and tasks
 * follow the same shop pin as its deals list. The quote page hides the write actions for such a deal.
 */
import { dataOf, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { shopsWorld, type ShopsWorld } from "../helpers/shops";
import { queryRows } from "../helpers/seed";

const OTHER_SHOP = "This deal belongs to another shop";

async function expectOtherShop(res: import("@playwright/test").APIResponse, label: string) {
  const text = await res.text();
  expect(res.status(), `${label}: ${text}`).toBe(403);
  expect(text, label).toContain(OTHER_SHOP);
}

async function seedNoteAndTask(page: import("@playwright/test").Page, o: ShopsWorld) {
  await signIn(page, o.agent2.email);
  const note = await dataOf<{ id: string }>(await page.request.post("/api/v2/notes", { data: { transaction_id: o.deal2.transactionId, content: "<p>shop two note</p>", agent_id: o.agent2.id } }), 201);
  const task = await dataOf<{ id: string }>(
    await page.request.post("/api/v2/tasks", { data: { title: "Shop two task", entityType: "quote", entityId: o.deal2.entityId, userId: o.agent2.id } }),
    201,
  );
  return { noteId: note.id, taskId: task.id };
}

test.describe("write scope on the remaining deal writes", () => {
  test("a shop-1 agent gets 403 on quote portal / featured, booking tags and upsells, enquiry writes, and deal notes and tasks of shop 2", async ({ page }) => {
    const o = await shopsWorld(page);
    const seeded = await seedNoteAndTask(page, o);
    // A booking upsell by shop 2's own agent, to try to edit and delete.
    const upsell = await dataOf<{ id: string }>(
      await page.request.post(`/api/v2/bookings/${o.booked2.bookingId}/upsells`, { data: { upsell_type: "FEE", description: "Seat", sales_price: 20, cost: 10 } }),
      201,
    );

    await signIn(page, o.agency.agentEmail); // shop 1
    const q = o.deal2.entityId;
    const b = o.booked2.bookingId;
    const writes: Array<[string, () => Promise<import("@playwright/test").APIResponse>]> = [
      ["PATCH quote portal-visibility", () => page.request.patch(`/api/v2/quotes/${q}/portal-visibility`, { data: { show_on_portal: true } })],
      ["PATCH quote featured", () => page.request.patch(`/api/v2/quotes/${q}/featured`, { data: { is_featured: true } })],
      ["PUT booking tags", () => page.request.put(`/api/v2/bookings/${b}/tags`, { data: { tags: ["sneaky"] } })],
      ["POST booking upsell", () => page.request.post(`/api/v2/bookings/${b}/upsells`, { data: { upsell_type: "FEE", description: "Mine" } })],
      ["PATCH upsell", () => page.request.patch(`/api/v2/upsells/${upsell.id}`, { data: { description: "Hacked" } })],
      ["DELETE upsell", () => page.request.delete(`/api/v2/upsells/${upsell.id}`)],
      ["PATCH enquiry", () => page.request.patch(`/api/v2/enquiries/${o.enquiry2.entityId}`, { data: { title: "Hacked" } })],
      ["POST note on the deal", () => page.request.post("/api/v2/notes", { data: { transaction_id: o.deal2.transactionId, content: "<p>mine</p>", agent_id: o.w.userId } })],
      ["PATCH deal note", () => page.request.patch(`/api/v2/notes/${seeded.noteId}`, { data: { content: "<p>hacked</p>" } })],
      ["DELETE deal note", () => page.request.delete(`/api/v2/notes/${seeded.noteId}`)],
      ["POST task on the deal", () => page.request.post("/api/v2/tasks", { data: { title: "Mine", entityType: "quote", entityId: q, userId: o.w.userId } })],
    ];
    for (const [name, call] of writes) await expectOtherShop(await call(), name);
    // Deleting an enquiry is admin-only whatever the shop: refused for an agent for that reason.
    expect((await page.request.delete(`/api/v2/enquiries/${o.enquiry2.entityId}`)).status()).toBe(403);

    const [qrow] = await queryRows<{ show_on_portal: boolean | null; is_featured: boolean | null }>(`select show_on_portal, is_featured from quote_table where id = $1`, [q]);
    expect(qrow.show_on_portal).toBeFalsy();
    expect(qrow.is_featured).toBeFalsy();
    const [u] = await queryRows<{ description: string; is_active: boolean | null }>(`select description, is_active from booking_upsell where id = $1`, [upsell.id]);
    expect(u).toMatchObject({ description: "Seat" });
    expect(u.is_active).not.toBe(false);
    const [e] = await queryRows<{ title: string; deleted_at: string | null }>(`select title, deleted_at from enquiry_table where id = $1`, [o.enquiry2.entityId]);
    expect(e).toEqual({ title: "Shop 2 enquiry", deleted_at: null });
    expect((await queryRows(`select 1 from notes where id = $1 and content like '%shop two note%'`, [seeded.noteId])).length).toBe(1);
    expect((await queryRows(`select 1 from notes where transaction_id = $1`, [o.deal2.transactionId])).length, "no sneaked-in note").toBe(1);
    expect((await queryRows(`select 1 from tasks where entity_id = $1`, [q])).length, "no sneaked-in task").toBe(1);
  });

  test("another agency gets 404 on the same writes", async ({ page }) => {
    const o = await shopsWorld(page);
    await signIn(page, o.foreign.agentEmail);
    const calls = [
      page.request.patch(`/api/v2/quotes/${o.deal2.entityId}/portal-visibility`, { data: { show_on_portal: true } }),
      page.request.put(`/api/v2/bookings/${o.booked2.bookingId}/tags`, { data: { tags: ["x"] } }),
      page.request.post(`/api/v2/bookings/${o.booked2.bookingId}/upsells`, { data: { upsell_type: "FEE" } }),
      page.request.patch(`/api/v2/enquiries/${o.enquiry2.entityId}`, { data: { title: "x" } }),
      page.request.post("/api/v2/notes", { data: { transaction_id: o.deal2.transactionId, content: "<p>x</p>", agent_id: o.w.userId } }),
    ];
    for (const res of await Promise.all(calls)) expect(res.status(), await res.text()).toBe(404);
  });

  test("controls: the shop's own agent and the org admin can make the same writes", async ({ page }) => {
    const o = await shopsWorld(page);
    await signIn(page, o.agent2.email);
    expect((await page.request.patch(`/api/v2/enquiries/${o.enquiry2.entityId}`, { data: { title: "Edited by its shop" } })).status()).toBe(200);
    expect((await page.request.post(`/api/v2/bookings/${o.booked2.bookingId}/upsells`, { data: { upsell_type: "FEE", description: "Seat" } })).status()).toBe(201);
    await signIn(page, o.agency.adminEmail);
    expect((await page.request.patch(`/api/v2/quotes/${o.deal2.entityId}/featured`, { data: { is_featured: true } })).status()).toBe(200);
    expect((await page.request.put(`/api/v2/bookings/${o.booked2.bookingId}/tags`, { data: { tags: ["vip"] } })).status()).toBe(200);
    expect((await page.request.post("/api/v2/notes", { data: { transaction_id: o.deal2.transactionId, content: "<p>admin</p>", agent_id: o.w.userId } })).status()).toBe(201);
  });
});

test.describe("the client page's notes and tasks follow the shop pin", () => {
  test("a shop-1 agent opening a shop-2 client sees the client-level note but neither the deal notes nor the deal tasks; the shop and the admin see all", async ({ page }) => {
    const o = await shopsWorld(page);
    await seedNoteAndTask(page, o);
    // A client-level note and task (not tied to a deal), by shop 2's agent.
    await dataOf(await page.request.post("/api/v2/notes", { data: { client_id: o.deal2.clientId, content: "<p>client level note</p>", agent_id: o.agent2.id } }), 201);
    await dataOf(await page.request.post("/api/v2/tasks", { data: { title: "Client level task", entityType: "client", entityId: o.deal2.clientId, userId: o.agent2.id } }), 201);

    const read = async () => {
      const notes = await dataOf<{ content: string }[]>(await page.request.get(`/api/v2/notes/client/${o.deal2.clientId}?includeDeals=true`));
      const tasks = await dataOf<{ title: string }[]>(await page.request.get(`/api/v2/tasks/for-client/${o.deal2.clientId}`));
      return { notes: notes.map((n) => n.content).join("|"), tasks: tasks.map((t) => t.title).sort() };
    };

    await signIn(page, o.agency.agentEmail); // shop 1
    const shop1 = await read();
    expect(shop1.notes).toContain("client level note");
    expect(shop1.notes).not.toContain("shop two note");
    expect(shop1.tasks).toEqual(["Client level task"]);

    for (const email of [o.agent2.email, o.agency.adminEmail]) {
      await signIn(page, email);
      const all = await read();
      expect(all.notes, email).toContain("shop two note");
      expect(all.notes, email).toContain("client level note");
      expect(all.tasks, email).toEqual(["Client level task", "Shop two task"]);
    }
  });
});

test.describe("opening another shop's deal (reads stay agency-wide)", () => {
  test("the quote page hides edit, convert and delete for a shop-1 agent, and shows them to the shop and the admin", async ({ page }) => {
    const o = await shopsWorld(page);
    for (const [email, visible] of [[o.agency.agentEmail, false], [o.manager1.email, false], [o.agent2.email, true], [o.agency.adminEmail, true]] as const) {
      await signIn(page, email);
      await page.goto(`/quotes/${o.deal2.entityId}`);
      await expect(page.getByText("Shop 2 deal").first(), `${email}: the quote opens (read)`).toBeVisible();
      if (visible) await expect(page.getByTestId("row-quote-actions"), email).toBeVisible();
      else await expect(page.getByTestId("row-quote-actions"), email).toHaveCount(0);
    }
  });

  test("the quote detail says whether the caller may edit it", async ({ page }) => {
    const o = await shopsWorld(page);
    const canEdit = async () => (await dataOf<{ can_edit?: boolean }>(await page.request.get(`/api/v2/quotes/${o.deal2.entityId}`))).can_edit;
    const bookingCanEdit = async () => (await dataOf<{ can_edit?: boolean }>(await page.request.get(`/api/v2/bookings/${o.booked2.bookingId}`))).can_edit;
    await signIn(page, o.agency.agentEmail);
    expect([await canEdit(), await bookingCanEdit()]).toEqual([false, false]);
    await signIn(page, o.agent2.email);
    expect([await canEdit(), await bookingCanEdit()]).toEqual([true, true]);
    await signIn(page, o.agency.adminEmail);
    expect([await canEdit(), await bookingCanEdit()]).toEqual([true, true]);
  });

  test("converting another shop's quote answers 403 with the reason, from the API", async ({ page }) => {
    const o = await shopsWorld(page);
    await signIn(page, o.agency.agentEmail);
    await expectOtherShop(await page.request.post(`/api/v2/bookings/convert/${o.deal2.entityId}`, { data: { haysRef: "HAY-7654321", supplierRef: "X" } }), "convert");
    await expectOtherShop(await page.request.patch(`/api/v2/quotes/${o.deal2.entityId}`, { data: { title: "x" } }), "edit");
    await expectOtherShop(await page.request.delete(`/api/v2/bookings/${o.booked2.bookingId}`), "delete booking");
  });
});
