import type { APIRequestContext, Page } from "@playwright/test";
import { apiCreateClient, dataOf, quotePayload, signIn } from "../helpers/deals";
import { expect, expectLoginOk, test } from "../helpers/fixtures";
import { boardWorld, bookedDeal, card, cardIn, daysFromToday, openBoard, quoteDeal, type BoardWorld, type Deal } from "../helpers/pipeline";
import { makeSecondBranch, queryRows, seedDealsAgency, seedMember } from "../helpers/seed";

interface Org {
  agency: Awaited<ReturnType<typeof seedDealsAgency>>;
  branch2Id: string;
  manager1: { id: string; email: string };
  agentB: { id: string; email: string };
  agent2: { id: string; email: string };
  smm: { id: string; email: string };
  /** Deals by who made them. */
  dealA: Deal; // agent A, branch 1
  dealB: Deal; // agent B, branch 1
  deal2: Deal; // agent 2, branch 2
  foreign: Deal; // another agency
  foreignAdminEmail: string;
}

/** One agency with two shops (three agents, a manager, an admin, a social media manager) and a second, unrelated agency. */
async function buildOrg(page: Page): Promise<Org> {
  const w = await boardWorld(page); // signed in as agent A, with a client
  const agency = w.agency;
  const branch2 = await makeSecondBranch(agency.orgId);
  const manager1 = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "branch_manager", firstName: "Mona", lastName: "Manager" });
  const agentB = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent", firstName: "Bea", lastName: "Branchmate" });
  const agent2 = await seedMember({ orgId: agency.orgId, branchId: branch2.id, orgRole: "agent", firstName: "Sam", lastName: "Secondshop" });
  const smm = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "social_media_manager" });

  const dealA = await quoteDeal(page.request, w, { title: "Deal of A" });

  const asOther = async (email: string, title: string): Promise<Deal> => {
    const userId = await signIn(page, email);
    const client = await apiCreateClient(page.request);
    const other: BoardWorld = { ...w, userId, clientId: client.id };
    return quoteDeal(page.request, other, { title }, client.id);
  };
  const dealB = await asOther(agentB.email, "Deal of B");
  const deal2 = await asOther(agent2.email, "Deal of agent two");

  const foreignAgency = await seedDealsAgency();
  const foreignUser = await signIn(page, foreignAgency.agentEmail);
  const foreignClient = await apiCreateClient(page.request);
  const foreign = await quoteDeal(page.request, { ...w, agency: foreignAgency, userId: foreignUser, clientId: foreignClient.id }, { title: "Foreign deal" }, foreignClient.id);

  return { agency, branch2Id: branch2.id, manager1, agentB, agent2, smm, dealA, dealB, deal2, foreign, foreignAdminEmail: foreignAgency.adminEmail };
}

async function allDeals(page: Page): Promise<void> {
  await page.getByTestId("pipeline-deals-tab-all").click();
}

async function visibleDealIds(page: Page, ids: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const id of ids) if ((await card(page, id).count()) > 0) out.push(id);
  return out.sort();
}

test.describe("who sees which deals on the board", () => {
  test("an agent sees their branch's deals on All Deals (their own on My Deals), never another shop's or another agency's", async ({ page }) => {
    const o = await buildOrg(page);
    await signIn(page, o.agency.agentEmail);
    await openBoard(page);
    await expect(cardIn(page, "Quoted", o.dealA.transactionId)).toBeVisible();
    expect(await visibleDealIds(page, [o.dealA, o.dealB, o.deal2, o.foreign].map((d) => d.transactionId))).toEqual([o.dealA.transactionId]); // My Deals

    await allDeals(page);
    await expect(cardIn(page, "Quoted", o.dealB.transactionId)).toBeVisible(); // settled: the branch-mate's deal arrived
    expect(await visibleDealIds(page, [o.dealA, o.dealB, o.deal2, o.foreign].map((d) => d.transactionId))).toEqual([o.dealA.transactionId, o.dealB.transactionId].sort());
  });

  test("a branch manager sees their branch's deals only", async ({ page }) => {
    const o = await buildOrg(page);
    await signIn(page, o.manager1.email);
    await openBoard(page);
    await allDeals(page);
    await expect(cardIn(page, "Quoted", o.dealA.transactionId)).toBeVisible();
    await expect(cardIn(page, "Quoted", o.dealB.transactionId)).toBeVisible();
    expect(await visibleDealIds(page, [o.deal2, o.foreign].map((d) => d.transactionId))).toEqual([]);
  });

  test("an org admin sees every shop's deals in their agency, and nothing from another agency", async ({ page }) => {
    const o = await buildOrg(page);
    await signIn(page, o.agency.adminEmail);
    await openBoard(page);
    await allDeals(page);
    for (const d of [o.dealA, o.dealB, o.deal2]) await expect(cardIn(page, "Quoted", d.transactionId)).toBeVisible();
    expect(await visibleDealIds(page, [o.foreign.transactionId])).toEqual([]);
  });

  test("the API's branch filter narrows an org admin to one shop; for an agent it is ANDed with their own shop (shop 2 gives nothing, their own shop changes nothing); a foreign branch id is 404", async ({ page }) => {
    const o = await buildOrg(page);
    const ids = async (path: string) => (await dataOf<{ items: { id: string }[] }>(await page.request.get(path))).items.map((i) => i.id).sort();

    await signIn(page, o.agency.adminEmail);
    const all = await ids(`/api/v2/transactions/pipeline/quote?limit=50`);
    expect(all).toEqual([o.dealA, o.dealB, o.deal2].map((d) => d.transactionId).sort());
    expect(await ids(`/api/v2/transactions/pipeline/quote?limit=50&branchId=${o.branch2Id}`)).toEqual([o.deal2.transactionId]);
    expect(await ids(`/api/v2/transactions/pipeline/quote?limit=50&branchId=${o.agency.branchId}`)).toEqual([o.dealA, o.dealB].map((d) => d.transactionId).sort());

    // Another agency's branch id: refused with 404, not an empty list.
    const foreignAgency = await seedDealsAgency();
    const foreign = await page.request.get(`/api/v2/transactions/pipeline/quote?branchId=${foreignAgency.branchId}`);
    expect(foreign.status()).toBe(404);
    expect((await page.request.get(`/api/v2/transactions/pipeline/quote?branchId=not-a-uuid`)).status()).toBe(400);
    expect((await page.request.get(`/api/v2/transactions/pipeline/nonsense`)).status()).toBe(400);

    // An agent in shop 1: the filter is combined with the shop pin, it neither widens nor is skipped.
    await signIn(page, o.agency.agentEmail);
    const shop1 = [o.dealA, o.dealB].map((d) => d.transactionId).sort();
    expect(await ids(`/api/v2/transactions/pipeline/quote?limit=50`), "control: unfiltered, the agent gets their own shop").toEqual(shop1);
    expect(await ids(`/api/v2/transactions/pipeline/quote?limit=50&branchId=${o.agency.branchId}`), "own shop: unchanged").toEqual(shop1);
    expect(await ids(`/api/v2/transactions/pipeline/quote?limit=50&branchId=${o.branch2Id}`), "shop 2: pin AND filter leave nothing").toEqual([]);
  });

  test("a social media manager cannot open the board page; the API lets them read but never write", async ({ page }) => {
    const o = await buildOrg(page);
    await signIn(page, o.smm.email);
    await page.goto("/pipeline");
    // The route shows the 403 page in place (the URL does not change).
    await expect(page.getByRole("heading", { name: /403/ })).toBeVisible();
    await expect(page.getByTestId("pipeline-title")).toHaveCount(0);

    // Read-only role: reads are allowed by the code (org-wide, like every other client read)...
    const read = await dataOf<{ items: { id: string }[] }>(await page.request.get(`/api/v2/transactions/pipeline/quote?limit=50`));
    expect(read.items.map((i) => i.id).sort()).toEqual([o.dealA, o.dealB, o.deal2].map((d) => d.transactionId).sort());
    // ...every write is refused with 403.
    for (const [method, path, data] of [
      ["post", `/api/v2/transactions/${o.dealA.transactionId}/lost`, { lost: true }],
      ["post", `/api/v2/transactions/${o.dealA.transactionId}/future`, { future_deal_date: daysFromToday(120) }],
      ["patch", `/api/v2/transactions/${o.dealA.transactionId}/priority`, { priority: "high" }],
      ["patch", `/api/v2/quotes/${o.dealA.entityId}`, { quote_status: "in_play" }],
    ] as const) {
      const res = await page.request[method](path, { data });
      expect(res.status(), `${method} ${path}`).toBe(403);
    }
    const [q] = await queryRows<{ quote_status: string }>(`select quote_status from quote_table where id = $1`, [o.dealA.entityId]);
    expect(q.quote_status).toBe("quoted");
  });
});

test.describe("moving deals by direct API call", () => {
  async function asForeignAdmin(o: Org, playwright: { request: import("@playwright/test").APIRequest }, baseURL: string): Promise<APIRequestContext> {
    const ctx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "X-Forwarded-For": "10.6.6.6" } });
    await expectLoginOk(ctx, o.foreignAdminEmail);
    return ctx;
  }

  test("another agency's admin gets exactly 404 on every move and read of our deal, and nothing changes", async ({ page, playwright, baseURL }) => {
    const o = await buildOrg(page);
    const outsider = await asForeignAdmin(o, playwright, baseURL!);
    const t = o.dealA.transactionId;
    const q = o.dealA.entityId;
    const attempts: Array<[string, string, unknown]> = [
      ["post", `/api/v2/transactions/${t}/lost`, { lost: true }],
      ["post", `/api/v2/transactions/${t}/future`, { future_deal_date: daysFromToday(120) }],
      ["patch", `/api/v2/transactions/${t}/priority`, { priority: "high" }],
      ["patch", `/api/v2/transactions/${t}`, { status: "on_booking" }],
      ["patch", `/api/v2/quotes/${q}`, { quote_status: "in_play" }],
      ["patch", `/api/v2/quotes/${q}/primary`, {}],
      ["post", `/api/v2/bookings/convert/${q}`, { haysRef: "HAY-1234567", supplierRef: "X" }],
      ["get", `/api/v2/transactions/${t}`, undefined],
      ["delete", `/api/v2/transactions/${t}`, undefined],
    ];
    for (const [method, path, data] of attempts) {
      const res = await (outsider as unknown as Record<string, (u: string, o?: unknown) => Promise<import("@playwright/test").APIResponse>>)[method](path, data === undefined ? undefined : { data });
      expect(res.status(), `${method} ${path}`).toBe(404);
    }
    // Their own board has none of our deals either (positive control: it does list their own).
    const list = await dataOf<{ items: { id: string }[] }>(await outsider.get(`/api/v2/transactions/pipeline/quote?limit=50`));
    expect(list.items.map((i) => i.id)).toEqual([o.foreign.transactionId]);
    await outsider.dispose();

    const [row] = await queryRows<{ status: string; quote_status: string; priority: string }>(
      `select t.status, q.quote_status, t.priority from transaction t join quote_table q on q.transaction_id = t.id where t.id = $1`,
      [t],
    );
    expect(row).toEqual({ status: "on_quote", quote_status: "quoted", priority: "low" });
  });

  test("an agent in shop 1 gets exactly 403 (another shop) marking lost, parking or re-prioritising a shop-2 deal (the transaction endpoints), but can move a branch-mate's quote (the rule is branch scope, not ownership; the quote endpoints are tested below)", async ({ page }) => {
    const o = await buildOrg(page);
    await signIn(page, o.agency.agentEmail);
    const t2 = o.deal2.transactionId;
    for (const res of [
      await page.request.post(`/api/v2/transactions/${t2}/lost`, { data: { lost: true } }),
      await page.request.post(`/api/v2/transactions/${t2}/future`, { data: { future_deal_date: daysFromToday(120) } }),
      await page.request.patch(`/api/v2/transactions/${t2}/priority`, { data: { priority: "high" } }),
      await page.request.patch(`/api/v2/transactions/${t2}`, { data: { priority: "high" } }),
      await page.request.delete(`/api/v2/transactions/${t2}`),
    ]) {
      const text = await res.text();
      expect(res.status(), text).toBe(403);
      expect(text).toContain("This deal belongs to another shop");
    }
    const [still] = await queryRows<{ priority: string; status: string }>(`select priority, status from transaction where id = $1`, [t2]);
    expect(still).toEqual({ priority: "low", status: "on_quote" });

    // The branch-mate's deal: allowed (status 200), and it really changes. (Quoted -> In-Play is PATCH /quotes/:id, a different path from the three above.)
    const mate = await page.request.patch(`/api/v2/quotes/${o.dealB.entityId}`, { data: { quote_status: "in_play" } });
    expect(mate.status(), await mate.text()).toBe(200);
    const [moved] = await queryRows<{ quote_status: string }>(`select quote_status from quote_table where id = $1`, [o.dealB.entityId]);
    expect(moved.quote_status).toBe("in_play");
  });
});

test.describe("quote writes and shop boundaries", () => {
  test("control: the deal-level endpoints refuse another shop's deal (403 'another shop') for an agent", async ({ page }) => {
    const o = await buildOrg(page);
    await signIn(page, o.agency.agentEmail);
    const t2 = o.deal2.transactionId;
    expect((await page.request.post(`/api/v2/transactions/${t2}/lost`, { data: { lost: true } })).status()).toBe(403);
    expect((await page.request.patch(`/api/v2/transactions/${t2}/priority`, { data: { priority: "high" } })).status()).toBe(403);
  });

  // OWNER DECISION: agents and branch managers cannot edit or delete another shop's quotes or bookings. Quote and
  // booking writes use the same shop pin as the board and the transaction endpoints (findByIdScopedForWrite), so an
  // agent in shop 1 is refused (403, "This deal belongs to another shop") for a shop-2 quote. Org admins keep org-wide access.
  // Reads stay org-wide on purpose (scope-conditions.ts, buildTransactionRecordScopeConds).
  test("an agent cannot change a quote that belongs to another shop's deal (403 'This deal belongs to another shop')", async ({ page }) => {
    const o = await buildOrg(page);
    await signIn(page, o.agency.agentEmail);
    const res = await page.request.patch(`/api/v2/quotes/${o.deal2.entityId}`, { data: { quote_status: "in_play" } });
    expect(res.status()).toBe(403);
    const [q] = await queryRows<{ quote_status: string }>(`select quote_status from quote_table where id = $1`, [o.deal2.entityId]);
    expect(q.quote_status).toBe("quoted");
  });

  /** Every quote and booking write the decision covers, aimed at the shop-2 deal `d` (booked deals carry a booking). */
  function quoteWrites(agency: Org["agency"], d: Deal, kids: { flightId: string; transferId: string }): Array<[string, (r: APIRequestContext) => Promise<import("@playwright/test").APIResponse>]> {
    return [
      ["PATCH /quotes/:id", (r) => r.patch(`/api/v2/quotes/${d.entityId}`, { data: { title: "Edited by shop 1" } })],
      ["DELETE /quotes/:id", (r) => r.delete(`/api/v2/quotes/${d.entityId}`)],
      ["PATCH /quotes/:id/primary", (r) => r.patch(`/api/v2/quotes/${d.entityId}/primary`, { data: {} })],
      ["PATCH /quotes/:id/accepted", (r) => r.patch(`/api/v2/quotes/${d.entityId}/accepted`, { data: { accepted: true } })],
      ["POST /quotes/:id/duplicate", (r) => r.post(`/api/v2/quotes/${d.entityId}/duplicate`, { data: {} })],
      ["POST /quotes (a quote on the deal)", (r) => r.post(`/api/v2/quotes`, { data: { transaction_id: d.transactionId, isQuoteCopy: true, ...quotePayload(agency, { title: "Sneaked in" }) } })],
      ["PATCH /quotes/:id/flights/:flightId", (r) => r.patch(`/api/v2/quotes/${d.entityId}/flights/${kids.flightId}`, { data: { flight_number: "HACKED" } })],
      ["DELETE /quotes/:id/transfers/:transferId", (r) => r.delete(`/api/v2/quotes/${d.entityId}/transfers/${kids.transferId}`)],
      ["POST /bookings/convert/:quoteId", (r) => r.post(`/api/v2/bookings/convert/${d.entityId}`, { data: { haysRef: "HAY-7654321", supplierRef: "X" } })],
    ];
  }

  async function shop2Deal(page: Page, o: Org) {
    // Shop 2's agent makes a deal with a flight and a transfer on its main quote.
    await signIn(page, o.agent2.email);
    const w: BoardWorld = { agency: o.agency, userId: o.agent2.id, clientId: "", clientSurname: "" };
    const client = await apiCreateClient(page.request);
    const deal = await quoteDeal(
      page.request,
      { ...w, clientId: client.id },
      {
        title: "Shop 2 detailed deal",
        extra: {
          outboundFlight: { departing_airport_id: o.agency.ref.airport, arrival_airport_id: o.agency.ref.airport2, departure_date_time: "2027-06-14T07:30:00", arrival_date_time: "2027-06-14T11:45:00", flight_number: "ORIG1" },
          transfers: [{ pick_up_location: "A", drop_off_location: "B", cost: "40.00", commission: "4.00", is_included_in_package: false }],
        },
      },
      client.id,
    );
    const one = async (table: string) => (await queryRows<{ id: string }>(`select id from ${table} where quote_id = $1`, [deal.entityId]))[0].id;
    return { deal, kids: { flightId: await one("quote_flights"), transferId: await one("quote_transfers") } };
  }

  for (const who of ["agent", "manager1"] as const) {
    test(`a shop-1 ${who === "agent" ? "agent" : "branch manager"} gets 403 on every quote write aimed at a shop-2 deal, and nothing changes`, async ({ page }) => {
      const o = await buildOrg(page);
      const { deal, kids } = await shop2Deal(page, o);
      await signIn(page, who === "agent" ? o.agency.agentEmail : o.manager1.email);
      for (const [name, call] of quoteWrites(o.agency, deal, kids)) {
        const res = await call(page.request);
        expect(res.status(), name).toBe(403);
      }
      const [q] = await queryRows<{ title: string; deleted_at: string | null; accepted_at: string | null }>(`select title, deleted_at, accepted_at from quote_table where id = $1`, [deal.entityId]);
      expect(q).toEqual({ title: "Shop 2 detailed deal", deleted_at: null, accepted_at: null });
      expect((await queryRows(`select 1 from quote_table where transaction_id = $1`, [deal.transactionId])).length, "no quote was added or duplicated").toBe(1);
      expect((await queryRows(`select 1 from booking_table where transaction_id = $1`, [deal.transactionId])).length, "no booking was made").toBe(0);
      expect((await queryRows<{ n: string }>(`select flight_number n from quote_flights where id = $1`, [kids.flightId]))[0].n).toBe("ORIG1");
      expect((await queryRows(`select 1 from quote_transfers where id = $1`, [kids.transferId])).length).toBe(1);
    });
  }

  test("control: an org admin keeps org-wide access: the same shop-2 writes succeed", async ({ page }) => {
    const o = await buildOrg(page);
    const { deal, kids } = await shop2Deal(page, o);
    await signIn(page, o.agency.adminEmail);
    const patch = await page.request.patch(`/api/v2/quotes/${deal.entityId}`, { data: { title: "Edited by the owner" } });
    expect(patch.status(), await patch.text()).toBe(200);
    const flight = await page.request.patch(`/api/v2/quotes/${deal.entityId}/flights/${kids.flightId}`, { data: { flight_number: "ADMIN1" } });
    expect(flight.status(), await flight.text()).toBe(200);
    const accepted = await page.request.patch(`/api/v2/quotes/${deal.entityId}/accepted`, { data: { accepted: true } });
    expect(accepted.status(), await accepted.text()).toBe(200);
    const convert = await page.request.post(`/api/v2/bookings/convert/${deal.entityId}`, { data: { haysRef: "HAY-7654321", supplierRef: "X" } });
    expect(convert.status(), await convert.text()).toBe(201);
  });

  test("control: reads stay org-wide, so a shop-1 agent can still open a shop-2 quote (200) but not change it", async ({ page }) => {
    const o = await buildOrg(page);
    await signIn(page, o.agency.agentEmail);
    expect((await page.request.get(`/api/v2/quotes/${o.deal2.entityId}`)).status()).toBe(200);
    expect((await page.request.patch(`/api/v2/quotes/${o.deal2.entityId}`, { data: { title: "x" } })).status()).toBe(403);
  });

  test("bookings: a shop-1 agent and branch manager get 403 editing or deleting a shop-2 booking; the shop-2 agent and the admin can", async ({ page }) => {
    const o = await buildOrg(page);
    await signIn(page, o.agent2.email);
    const client = await apiCreateClient(page.request);
    const booked = await bookedDeal(page.request, { agency: o.agency, userId: o.agent2.id, clientId: client.id, clientSurname: "" }, { title: "Shop 2 booking" }, client.id);
    const [{ id: bookingId }] = await queryRows<{ id: string }>(`select id from booking_table where transaction_id = $1`, [booked.transactionId]);

    for (const email of [o.agency.agentEmail, o.manager1.email]) {
      await signIn(page, email);
      const edit = await page.request.patch(`/api/v2/bookings/${bookingId}`, { data: { supplier_ref: "CHANGED" } });
      expect(edit.status(), `${email} edit`).toBe(403);
      const del = await page.request.delete(`/api/v2/bookings/${bookingId}`);
      expect(del.status(), `${email} delete`).toBe(403);
    }
    const [still] = await queryRows<{ supplier_ref: string }>(`select supplier_ref from booking_table where id = $1`, [bookingId]);
    expect(still.supplier_ref).toBe("TUI 1");

    // Controls: the shop's own agent and the org admin may edit it.
    await signIn(page, o.agent2.email);
    expect((await page.request.patch(`/api/v2/bookings/${bookingId}`, { data: { supplier_ref: "TUI 2" } })).status()).toBe(200);
    await signIn(page, o.agency.adminEmail);
    expect((await page.request.patch(`/api/v2/bookings/${bookingId}`, { data: { supplier_ref: "TUI 3" } })).status()).toBe(200);
  });

  // The screen route: the client LIST still shows every client org-wide (the client itself is visible), but the
  // client page's deals list and deal history are shop-pinned like the board, so an agent or branch manager no longer
  // finds another shop's deal there and has no Edit button for it.
  test("from the screen: an agent opens a shop-2 client's page (client visible) but the other shop's deal is not listed", async ({ page }) => {
    const o = await buildOrg(page);
    const [{ client_id: shop2ClientId, surename }] = await queryRows<{ client_id: string; surename: string }>(
      `select t.client_id, c.surename from transaction t join client_table c on c.id = t.client_id where t.id = $1`,
      [o.deal2.transactionId],
    );

    // Control: the shop-2 agent's own client page lists the deal.
    await signIn(page, o.agent2.email);
    await page.goto(`/clients/${shop2ClientId}`);
    await expect(page.getByText("Deal of agent two").first()).toBeVisible();

    // Control: an org admin sees it too (org-wide).
    await signIn(page, o.agency.adminEmail);
    await page.goto(`/clients/${shop2ClientId}`);
    await expect(page.getByText("Deal of agent two").first()).toBeVisible();

    await signIn(page, o.agency.agentEmail);
    const list = page.waitForResponse((r) => r.url().includes(`/api/v2/transactions?`) && r.url().includes(shop2ClientId));
    await page.goto(`/clients/${shop2ClientId}`);
    const body = (await (await list).json()) as { data: { id: string }[] };
    expect(body.data, "the deals list is empty for another shop's client").toEqual([]);
    await expect(page.getByText(surename).first(), "the client page itself still opens").toBeVisible();
    await expect(page.getByText("Deal of agent two")).toHaveCount(0);

    // A branch manager gets the same filtering from the deals endpoint behind the page.
    await signIn(page, o.manager1.email);
    const bm = await dataOf<unknown[]>(await page.request.get(`/api/v2/transactions?clientId=${shop2ClientId}`));
    expect(bm).toEqual([]);
    await signIn(page, o.agency.adminEmail);
    expect((await dataOf<{ id: string }[]>(await page.request.get(`/api/v2/transactions?clientId=${shop2ClientId}`))).map((t) => t.id)).toEqual([o.deal2.transactionId]);

    // The board of the same agent never had it either.
    await signIn(page, o.agency.agentEmail);
    await openBoard(page);
    await allDeals(page);
    await expect(cardIn(page, "Quoted", o.dealB.transactionId)).toBeVisible();
    await expect(card(page, o.deal2.transactionId)).toHaveCount(0);
  });

  test("the client LIST is still org-wide: an agent sees a shop-2 client", async ({ page }) => {
    const o = await buildOrg(page);
    const [{ client_id: shop2ClientId }] = await queryRows<{ client_id: string }>(`select client_id from transaction where id = $1`, [o.deal2.transactionId]);
    await signIn(page, o.agency.agentEmail);
    const res = await page.request.get(`/api/v2/neon-clients/${shop2ClientId}`);
    expect(res.status(), await res.text()).toBe(200);
  });
});
