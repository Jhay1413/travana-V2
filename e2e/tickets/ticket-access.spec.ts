/**
 * Who can see and change which tickets. The rule (ticket.repository.ts buildTicketScopeConds, fail closed):
 *  - org admin: every ticket of the agency;
 *  - branch manager with a shop: every ticket of that shop;
 *  - everyone else (agent, homeworker, social media manager, a manager or agent with no shop): only tickets they
 *    raised or were assigned, and only the creator may delete;
 *  - the homeworker side and the shops are kept apart; another agency sees nothing;
 *  - a referral agent has no ticket access at all, and a social media manager is read-only.
 * Replies and attachments follow the ticket. Every out-of-scope read or write answers 404 (never "forbidden"). The only
 * 403s are for roles that may not write tickets at all: a social media manager (read-only) and a referral agent.
 */
import type { Page } from "@playwright/test";
import { dataOf, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { queryRows, seedBranchlessMember } from "../helpers/seed";
import { apiCreateTicket, dbTicket, listTicketIds, openQueue, ticketSubject, workWorld, type TicketRow, type WorkWorld } from "../helpers/work";

interface Tickets {
  /** raised and assigned to the shop-1 agent */
  own: TicketRow;
  /** raised by the shop-1 agent, assigned to agentB */
  handed: TicketRow;
  /** raised and assigned to agentB (same shop) */
  bea: TicketRow;
  /** raised by the org admin, assigned to the shop-1 agent */
  fromAdmin: TicketRow;
  /** raised by the org admin, assigned to nobody (shop-1 branch) */
  adminOnly: TicketRow;
  /** shop 2 */
  shop2: TicketRow;
  /** the homeworker's own */
  hw: TicketRow;
  /** another agency */
  foreign: TicketRow;
}

async function buildTickets(page: Page, w: WorkWorld): Promise<Tickets> {
  const make = async (who: string, body: Record<string, unknown>) => {
    await signIn(page, who);
    return apiCreateTicket(page.request, { type: "Build", ...body });
  };
  return {
    own: await make(w.agent.email, { subject: ticketSubject("own"), assignedTo: w.agent.id }),
    handed: await make(w.agent.email, { subject: ticketSubject("handed"), assignedTo: w.agentB.id }),
    bea: await make(w.agentB.email, { subject: ticketSubject("bea"), assignedTo: w.agentB.id }),
    fromAdmin: await make(w.admin.email, { subject: ticketSubject("fromAdmin"), assignedTo: w.agent.id }),
    adminOnly: await make(w.admin.email, { subject: ticketSubject("adminOnly") }),
    shop2: await make(w.agent2.email, { subject: ticketSubject("shop2"), assignedTo: w.agent2.id }),
    hw: await make(w.homeworker.email, { subject: ticketSubject("hw"), assignedTo: w.homeworker.id }),
    foreign: await make(w.foreign.agent.email, { subject: ticketSubject("foreign"), assignedTo: w.foreign.agent.id }),
  };
}

type Key = keyof Tickets;
const ALL_KEYS: Key[] = ["own", "handed", "bea", "fromAdmin", "adminOnly", "shop2", "hw", "foreign"];

/** For one signed-in person: the exact ticket-by-id statuses and the "all" / "mine" list contents. */
async function readMatrix(page: Page, t: Tickets) {
  const status: Partial<Record<Key, number>> = {};
  for (const k of ALL_KEYS) status[k] = (await page.request.get(`/api/v2/tickets/${t[k].id}`)).status();
  return status;
}

const idsOf = (t: Tickets, keys: Key[]) => keys.map((k) => t[k].id).sort();

function expectStatuses(actual: Partial<Record<Key, number>>, visible: Key[], who: string) {
  const expected: Partial<Record<Key, number>> = {};
  for (const k of ALL_KEYS) expected[k] = visible.includes(k) ? 200 : 404;
  expect(actual, `ticket-by-id statuses for ${who}`).toEqual(expected);
}

test.describe("who can open which ticket", () => {
  test("each role sees exactly its own slice, by id and in the lists", async ({ page }) => {
    const w = await workWorld(page);
    const t = await buildTickets(page, w);
    type Case = { who: string; email: string; visible: Key[]; mine?: Key[]; all?: Key[] | 403 };
    const cases: Case[] = [
      // Agent: raised or assigned only. "mine" = the client-side isMyTicket slice is applied on screen, the server list is creator-or-assignee.
      { who: "shop-1 agent", email: w.agent.email, visible: ["own", "handed", "fromAdmin"], mine: ["own", "handed", "fromAdmin"], all: 403 },
      { who: "shop-1 agent B", email: w.agentB.email, visible: ["handed", "bea"], mine: ["handed", "bea"], all: 403 },
      // Branch manager of shop 1: every shop-1 ticket (the admin's tickets sit in the default shop), nothing of shop 2, the homeworkers or another agency.
      { who: "shop-1 branch manager", email: w.manager1.email, visible: ["own", "handed", "bea", "fromAdmin", "adminOnly"], mine: [], all: ["own", "handed", "bea", "fromAdmin", "adminOnly"] },
      { who: "shop-2 agent", email: w.agent2.email, visible: ["shop2"], mine: ["shop2"], all: 403 },
      { who: "shop-2 branch manager", email: w.manager2.email, visible: ["shop2"], mine: [], all: ["shop2"] },
      // Org admin: the whole agency, including the homeworker's, nothing of another agency.
      { who: "org admin", email: w.admin.email, visible: ["own", "handed", "bea", "fromAdmin", "adminOnly", "shop2", "hw"], mine: ["fromAdmin", "adminOnly"], all: ["own", "handed", "bea", "fromAdmin", "adminOnly", "shop2", "hw"] },
      { who: "homeworker", email: w.homeworker.email, visible: ["hw"], mine: ["hw"], all: 403 },
      // Fail closed: no shop, social media manager and referral agent get nothing of the shops' tickets.
      { who: "agent with no shop", email: w.noShop.email, visible: [], mine: [], all: 403 },
      { who: "social media manager", email: w.smm.email, visible: [], mine: [], all: 403 },
      { who: "another agency's agent", email: w.foreign.agent.email, visible: ["foreign"], mine: ["foreign"], all: 403 },
      { who: "another agency's admin", email: w.foreign.admin.email, visible: ["foreign"], mine: [], all: ["foreign"] },
    ];

    for (const c of cases) {
      await signIn(page, c.email);
      expectStatuses(await readMatrix(page, t), c.visible, c.who);
      const mine = await listTicketIds(page.request, "mine");
      expect(mine.status, `${c.who} mine`).toBe(200);
      expect(mine.ids.sort(), `${c.who}: the server's "mine" list`).toEqual(idsOf(t, c.mine ?? []));
      const all = await listTicketIds(page.request, "all");
      if (c.all === 403) expect(all, `${c.who} all`).toEqual({ status: 403, ids: [] });
      else expect(all.ids.sort(), `${c.who}: the server's "all" list`).toEqual(idsOf(t, c.all ?? []));
    }

    const noShopManager = await seedBranchlessMember({ orgId: w.agency.orgId, orgRole: "branch_manager" });
    const own = await (async () => {
      await signIn(page, noShopManager.email);
      return apiCreateTicket(page.request, { type: "Build", subject: ticketSubject("noshop-manager"), assignedTo: noShopManager.id });
    })();

    // A manager with no shop is limited to their own tickets (fail closed, not the whole agency).
    await signIn(page, noShopManager.email);
    expect((await page.request.get(`/api/v2/tickets/${own.id}`)).status()).toBe(200);
    for (const k of ALL_KEYS) expect((await page.request.get(`/api/v2/tickets/${t[k].id}`)).status(), `no-shop manager vs ${k}`).toBe(404);
    // ...and cannot ask for the "all" list's other tickets either: the list holds only their own.
    const allForNoShop = await listTicketIds(page.request, "all");
    expect(allForNoShop.ids).toEqual([own.id]);
  });

  test("a referral agent gets 403 on every ticket call, even though they are in the same shop", async ({ page }) => {
    const w = await workWorld(page);
    const t = await buildTickets(page, w);
    await signIn(page, w.referral.email);
    for (const res of [
      await page.request.get("/api/v2/tickets"),
      await page.request.get(`/api/v2/tickets/${t.own.id}`),
      await page.request.post("/api/v2/tickets", { data: { type: "Build", subject: "x", userId: w.referral.id } }),
      await page.request.get(`/api/v2/replies/ticket/${t.own.id}`),
      await page.request.get(`/api/v2/attachments/ticket/${t.own.id}`),
    ]) {
      expect(res.status(), `${res.url()} ${await res.text()}`).toBe(403);
    }
    // Control: the shop-1 agent can read the same ticket.
    await signIn(page, w.agent.email);
    expect((await page.request.get(`/api/v2/tickets/${t.own.id}`)).status()).toBe(200);
  });
});

test.describe("who can change which ticket", () => {
  test("update follows the read scope: creator or assignee, the shop's manager, the org admin; nobody else, and no one in another agency", async ({ page }) => {
    const w = await workWorld(page);
    const t = await buildTickets(page, w);
    const patch = async (email: string, key: Key) => {
      await signIn(page, email);
      return (await page.request.patch(`/api/v2/tickets/${t[key].id}`, { data: { priority: "High" } })).status();
    };

    // Assignee who did not raise it can update it.
    expect(await patch(w.agent.email, "fromAdmin")).toBe(200);
    // Creator who handed it on can still update it.
    expect(await patch(w.agent.email, "handed")).toBe(200);
    // Same shop, neither creator nor assignee: not found.
    expect(await patch(w.agent.email, "bea")).toBe(404);
    expect(await patch(w.agent.email, "shop2")).toBe(404);
    expect(await patch(w.agent.email, "hw")).toBe(404);
    expect(await patch(w.agent.email, "foreign")).toBe(404);
    // Branch manager: own shop yes, other shop / homeworker / agency no.
    expect(await patch(w.manager1.email, "bea")).toBe(200);
    expect(await patch(w.manager1.email, "shop2")).toBe(404);
    expect(await patch(w.manager1.email, "hw")).toBe(404);
    expect(await patch(w.manager1.email, "foreign")).toBe(404);
    // Org admin: the whole agency incl. shop 2 and the homeworker, not another agency.
    expect(await patch(w.admin.email, "shop2")).toBe(200);
    expect(await patch(w.admin.email, "hw")).toBe(200);
    expect(await patch(w.admin.email, "foreign")).toBe(404);
    // Another agency's admin cannot touch ours.
    expect(await patch(w.foreign.admin.email, "own")).toBe(404);
    // Social media manager: a read-only role, refused before scope (403, not 404).
    expect(await patch(w.smm.email, "own")).toBe(403);
    expect(await patch(w.noShop.email, "own")).toBe(404);

    // Exactly the allowed ones changed.
    for (const k of ["fromAdmin", "handed", "bea", "shop2", "hw"] as Key[]) expect((await dbTicket(t[k].id)).priority, k).toBe("High");
    for (const k of ["own", "adminOnly", "foreign"] as Key[]) expect((await dbTicket(t[k].id)).priority, k).toBe("Medium");
  });

  test("delete is stricter than update: only the creator, the shop's manager or the org admin; an assignee who did not raise it cannot delete", async ({ page }) => {
    const w = await workWorld(page);
    const t = await buildTickets(page, w);
    const del = async (email: string, key: Key) => {
      await signIn(page, email);
      return (await page.request.delete(`/api/v2/tickets/${t[key].id}`)).status();
    };
    // The agent is only the assignee of the admin's ticket.
    expect(await del(w.agent.email, "fromAdmin")).toBe(404);
    expect(await dbTicket(t.fromAdmin.id)).toBeTruthy();
    // Agent B is only the assignee of the agent's "handed" ticket.
    expect(await del(w.agentB.email, "handed")).toBe(404);
    expect(await dbTicket(t.handed.id)).toBeTruthy();
    // The creator can delete theirs.
    expect(await del(w.agent.email, "own")).toBe(204);
    expect(await dbTicket(t.own.id)).toBeUndefined();
    // A social media manager is read-only.
    expect(await del(w.smm.email, "bea")).toBe(403);
    // Another shop's manager and another agency's admin cannot.
    expect(await del(w.manager2.email, "bea")).toBe(404);
    expect(await del(w.foreign.admin.email, "bea")).toBe(404);
    expect(await dbTicket(t.bea.id)).toBeTruthy();
    // The shop's own manager can delete a ticket they did not raise, the org admin can delete the homeworker's.
    expect(await del(w.manager1.email, "bea")).toBe(204);
    expect(await del(w.admin.email, "hw")).toBe(204);
    expect(await dbTicket(t.bea.id)).toBeUndefined();
    expect(await dbTicket(t.hw.id)).toBeUndefined();
  });

  test("a social media manager cannot create a ticket (403) but can still read their own slice", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.smm.email);
    const before = (await queryRows(`select 1 from tickets where org_id = $1`, [w.agency.orgId])).length;
    const res = await page.request.post("/api/v2/tickets", { data: { type: "Build", status: "Open", priority: "Medium", subject: ticketSubject("smm"), userId: w.smm.id } });
    expect(res.status(), await res.text()).toBe(403);
    expect((await queryRows(`select 1 from tickets where org_id = $1`, [w.agency.orgId])).length).toBe(before);
    expect((await page.request.get("/api/v2/tickets?scope=mine")).status()).toBe(200);
  });
});

test.describe("replies, attachments and per-person lists follow the ticket", () => {
  test("replies and attachment lists on a ticket outside the caller's slice are 404; the creator, assignee and shop manager can use them", async ({ page }) => {
    const w = await workWorld(page);
    const t = await buildTickets(page, w);
    // A legacy-style attachment row (no file is fetched; only the list is read).
    await queryRows(`insert into ticket_attachments (ticket_id, filename, original_name, mime_type, size) values ($1, 'legacy.pdf', 'legacy.pdf', 'application/pdf', 10)`, [t.bea.id]);
    await signIn(page, w.agentB.email);
    const reply = await dataOf<{ id: string }>(await page.request.post(`/api/v2/replies/ticket/${t.bea.id}`, { data: { content: "bea's note" } }), 201);

    const read = async (email: string) => {
      await signIn(page, email);
      return {
        replies: (await page.request.get(`/api/v2/replies/ticket/${t.bea.id}`)).status(),
        attachments: (await page.request.get(`/api/v2/attachments/ticket/${t.bea.id}`)).status(),
        write: (await page.request.post(`/api/v2/replies/ticket/${t.bea.id}`, { data: { content: "hello" } })).status(),
        like: (await page.request.post(`/api/v2/replies/${reply.id}/like`)).status(),
      };
    };
    expect(await read(w.agentB.email)).toEqual({ replies: 200, attachments: 200, write: 201, like: 200 });
    expect(await read(w.manager1.email)).toEqual({ replies: 200, attachments: 200, write: 201, like: 200 });
    expect(await read(w.admin.email)).toEqual({ replies: 200, attachments: 200, write: 201, like: 200 });
    for (const [who, email] of [
      ["same-shop agent who is not on it", w.agent.email],
      ["other shop's agent", w.agent2.email],
      ["other shop's manager", w.manager2.email],
      ["homeworker", w.homeworker.email],
      ["another agency's admin", w.foreign.admin.email],
    ] as const) {
      expect(await read(email), who).toEqual({ replies: 404, attachments: 404, write: 404, like: 404 });
    }
    // Social media manager: read side is the same fail-closed 404; the write is refused as read-only.
    const smm = await read(w.smm.email);
    expect(smm).toEqual({ replies: 404, attachments: 404, write: 403, like: 403 });
    // Four replies exist: Bea's first note, plus one write each from Bea, the manager and the admin. Nobody else added one.
    expect((await queryRows(`select 1 from ticket_replies where ticket_id = $1`, [t.bea.id])).length).toBe(4);
  });

  test("another person's ticket list never leaks: asking for Bea's tickets returns only those the asker could open anyway", async ({ page }) => {
    const w = await workWorld(page);
    const t = await buildTickets(page, w);
    await signIn(page, w.agent.email);
    const res = await page.request.get(`/api/v2/tickets/user/${w.agentB.id}`);
    const ids = (await dataOf<TicketRow[]>(res)).map((x) => x.id).sort();
    // The shop-1 agent can open "handed" (raised by them, assigned to Bea) but not Bea's own ticket.
    expect(ids).toEqual([t.handed.id]);
    // Control: Bea sees both.
    await signIn(page, w.agentB.email);
    const mine = (await dataOf<TicketRow[]>(await page.request.get(`/api/v2/tickets/user/${w.agentB.id}`))).map((x) => x.id).sort();
    expect(mine).toEqual([t.handed.id, t.bea.id].sort());
    // Another agency's agent asking for our agent's list gets an empty list, not our rows.
    await signIn(page, w.foreign.agent.email);
    expect((await dataOf<TicketRow[]>(await page.request.get(`/api/v2/tickets/user/${w.agentB.id}`))).length).toBe(0);
  });
});

test.describe("clients and holidays a ticket may point at", () => {
  test("a ticket cannot be filed against another agency's client, and an assignee must be in the same agency", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.foreign.agent.email);
    const { apiCreateClient } = await import("../helpers/deals");
    const foreignClient = await apiCreateClient(page.request);
    await signIn(page, w.agent.email);
    const post = (data: Record<string, unknown>) =>
      page.request.post("/api/v2/tickets", { data: { type: "Sales", status: "Open", priority: "Medium", subject: ticketSubject("ref"), userId: w.agent.id, ...data } });
    const before = (await queryRows(`select 1 from tickets where org_id = $1`, [w.agency.orgId])).length;

    const wrongClient = await post({ clientId: foreignClient.id, assignedTo: w.agent.id });
    expect(wrongClient.status(), await wrongClient.text()).toBe(400);
    expect(await wrongClient.text()).toContain("Client not found");
    const wrongAssignee = await post({ type: "Build", assignedTo: w.foreign.agent.id });
    expect(wrongAssignee.status(), await wrongAssignee.text()).toBe(400);
    expect(await wrongAssignee.text()).toContain("Assignee is not an active member of this organisation");
    expect((await queryRows(`select 1 from tickets where org_id = $1`, [w.agency.orgId])).length).toBe(before);

    // Staff in a shop cannot hand a ticket to the homeworker side; the org admin can, and the ticket moves to the homeworker's branch.
    const cross = await post({ type: "Build", assignedTo: w.homeworker.id });
    expect(cross.status(), await cross.text()).toBe(400);
    expect(await cross.text()).toContain("Tickets cannot be assigned across shop and homeworker branches");
    await signIn(page, w.admin.email);
    const adminMade = await apiCreateTicket(page.request, { type: "Build", subject: ticketSubject("to-hw"), assignedTo: w.homeworker.id });
    expect((await dbTicket(adminMade.id)).branch_id).toBe(w.homeworker.branchId);
    await signIn(page, w.homeworker.email);
    expect((await page.request.get(`/api/v2/tickets/${adminMade.id}`)).status()).toBe(200);
  });
});

test.describe("what the queue screen offers each role", () => {
  test("the 'All tickets' view exists only for managers and admins, and shows exactly their slice", async ({ page }) => {
    const w = await workWorld(page);
    const t = await buildTickets(page, w);

    // Agent: no "All tickets" tab, and no one else's ticket on screen.
    await signIn(page, w.agent.email);
    await openQueue(page, { view: "list" });
    await expect(page.getByTestId("ticket-scope-mine")).toBeVisible();
    await expect(page.getByTestId("ticket-scope-all")).toHaveCount(0);
    await expect(page.getByTestId(`ticket-row-${t.own.id}`)).toBeVisible();
    await expect(page.getByTestId(`ticket-row-${t.bea.id}`)).toHaveCount(0);

    // Shop-1 manager: All tickets = the shop's tickets only.
    await signIn(page, w.manager1.email);
    await openQueue(page, { view: "list" });
    await page.getByTestId("ticket-scope-all").click();
    for (const k of ["own", "handed", "bea", "fromAdmin", "adminOnly"] as Key[]) await expect(page.getByTestId(`ticket-row-${t[k].id}`), k).toBeVisible();
    for (const k of ["shop2", "hw", "foreign"] as Key[]) await expect(page.getByTestId(`ticket-row-${t[k].id}`), k).toHaveCount(0);

    // Org admin: the whole agency, including the homeworker's, not the other agency's.
    await signIn(page, w.admin.email);
    await openQueue(page, { view: "list" });
    await page.getByTestId("ticket-scope-all").click();
    for (const k of ["own", "handed", "bea", "fromAdmin", "adminOnly", "shop2", "hw"] as Key[]) await expect(page.getByTestId(`ticket-row-${t[k].id}`), k).toBeVisible();
    await expect(page.getByTestId(`ticket-row-${t.foreign.id}`)).toHaveCount(0);
  });
});
