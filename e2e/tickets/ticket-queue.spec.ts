/**
 * The tickets queue (/tickets): creating a ticket for a client and an internal one, the four statuses on the board,
 * the chips, search, filters and the two sort rules. Expectations come from the code's own rules (ticket-queue.ts,
 * ticket-due.ts) and the owner's decisions (four statuses, newest first by created / resolved date, reply-due pills).
 */
import { addDaysToKey, londonDayKey } from "../../client/src/lib/london-day";
import { londonDateTimeToIso } from "../../client/src/features/tickets/lib/london-datetime";
import { apiCreateClient, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { pinLondonHelpers } from "../helpers/london";
import { queryRows } from "../helpers/seed";
import { chooseOption, pickDate } from "../helpers/ui";
import { apiCreateTicket, dbTicket, openQueue, ticketSubject, workWorld } from "../helpers/work";

pinLondonHelpers("dateTime");

const rowOf = (page: import("@playwright/test").Page, id: string) => page.getByTestId(`ticket-row-${id}`);
const cardOf = (page: import("@playwright/test").Page, id: string) => page.getByTestId(`ticket-card-${id}`);

/** The ids of the rows in one list group, top to bottom. */
async function groupOrder(page: import("@playwright/test").Page, group: string): Promise<string[]> {
  const rows = page.getByTestId(`ticket-group-${group}`).locator('[data-testid^="ticket-row-"]:not([data-testid^="ticket-row-subject-"]):not([data-testid^="ticket-row-pinned-"])');
  const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") ?? ""));
  return ids.map((t) => t.replace("ticket-row-", ""));
}

async function setCreatedAt(id: string, isoUtc: string, resolvedIso?: string) {
  await queryRows(`update tickets set created_at = $2, resolved_at = $3 where id = $1`, [id, isoUtc, resolvedIso ?? null]);
}

test.describe("creating a ticket", () => {
  test("a client ticket made through New ticket is saved with every field the dialog set, and opens on its own page", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    const subject = ticketSubject("Client ticket");
    const dueDay = addDaysToKey(londonDayKey(new Date()), 3);

    await openQueue(page);
    await page.getByTestId("ticket-compose").click();
    const dialog = page.getByTestId("create-ticket-dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByTestId("select-client").fill(client.surename);
    await dialog.getByTestId(`customer-option-${client.id}`).click();
    await expect(dialog.getByTestId("ticket-linked-client")).toContainText(client.surename);
    await dialog.getByTestId("select-type-Admin").click();
    await dialog.getByTestId("input-subject").fill(subject);
    await dialog.locator('[data-testid="input-description"] [contenteditable="true"]').fill("Customer wants the transfer time changed.");
    await dialog.getByTestId("select-priority-High").click();
    await chooseOption(page, dialog.getByTestId("select-user"), "Bea Agentb");
    await chooseOption(page, dialog.getByTestId("select-status"), "In Progress");
    await pickDate(page, dialog.getByTestId("input-due-date-date"), dueDay);
    await dialog.getByTestId("button-create-ticket").click();

    await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]{36}$/);
    const id = page.url().split("/").pop()!;
    await expect(page.getByTestId("ticket-thread-subject")).toHaveText(subject);

    const row = await dbTicket(id);
    expect(row).toMatchObject({
      subject,
      status: "In Progress",
      priority: "High",
      assigned_to: w.agentB.id,
      user_id: w.agent.id,
      client_id: client.id,
      org_id: w.agency.orgId,
      branch_id: w.agency.branchId,
      transaction_id: null,
    });
    // The due value is the instant of 09:00 London on the picked day (the dialog's default time).
    expect(new Date(`${row.due_date!.replace(" ", "T")}Z`).toISOString()).toBe(londonDateTimeToIso(dueDay, "09:00"));
    expect(row.resolved_at).toBeNull();
    expect(await queryRows(`select 1 from tickets where subject = $1`, [subject])).toHaveLength(1);
  });

  test("an internal ticket (kind Build) needs no client, and is saved with none", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const subject = ticketSubject("Internal ticket");

    await openQueue(page);
    await page.getByTestId("ticket-compose").click();
    const dialog = page.getByTestId("create-ticket-dialog");
    // A Sales ticket asks for a client; switching to Build removes the client picker entirely.
    await expect(dialog.getByTestId("select-client")).toBeVisible();
    await dialog.getByTestId("select-type-Build").click();
    await expect(dialog.getByTestId("select-client")).toHaveCount(0);
    await dialog.getByTestId("input-subject").fill(subject);
    await chooseOption(page, dialog.getByTestId("select-user"), "Ann Agent");
    await dialog.getByTestId("button-create-ticket").click();

    await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]{36}$/);
    const row = await dbTicket(page.url().split("/").pop()!);
    expect(row).toMatchObject({ subject, client_id: null, transaction_id: null, status: "Open", priority: "Medium", assigned_to: w.agent.id });
    // The ticket page has no client to show: the left panel says so instead of showing contact actions.
    await page.getByTestId("ticket-side-client").click();
    await expect(page.getByTestId("ticket-internal-panel")).toBeVisible();
    await expect(page.getByTestId("ticket-client-message")).toHaveCount(0);
  });

  test("saving without an assignee, a subject or (for a Sales ticket) a client is refused and nothing is created", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    const subject = ticketSubject("Refused ticket");
    const countFor = async () => (await queryRows(`select 1 from tickets where org_id = $1`, [w.agency.orgId])).length;
    expect(await countFor()).toBe(0);
    // The form is checked in the browser before anything is sent, so a refusal must not make a single create request.
    const createRequests: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/api\/v2\/tickets(\?|$)/.test(req.url())) createRequests.push(req.url());
    });
    const refusal = page.getByText("Please fill in all required fields");

    await openQueue(page);
    await page.getByTestId("ticket-compose").click();
    const dialog = page.getByTestId("create-ticket-dialog");
    await dialog.getByTestId("input-subject").fill(subject);
    await chooseOption(page, dialog.getByTestId("select-user"), "Ann Agent");
    // Subject and assignee are there, but a Sales ticket still has no client.
    await dialog.getByTestId("button-create-ticket").click();
    await expect(refusal.first()).toBeVisible();
    await expect(dialog).toBeVisible();
    // Let the first toast go away, so the second check below cannot be satisfied by it.
    await expect(refusal).toHaveCount(0, { timeout: 10_000 });
    expect(createRequests).toEqual([]);
    expect(await countFor()).toBe(0);

    // Give it the client but remove the subject: refused again.
    await dialog.getByTestId("select-client").fill(client.surename);
    await dialog.getByTestId(`customer-option-${client.id}`).click();
    await dialog.getByTestId("input-subject").fill("   ");
    await dialog.getByTestId("button-create-ticket").click();
    await expect(refusal.first()).toBeVisible();
    expect(createRequests).toEqual([]);
    expect(await countFor()).toBe(0);

    // Control: the same form with a subject saves.
    await dialog.getByTestId("input-subject").fill(subject);
    await dialog.getByTestId("button-create-ticket").click();
    await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]{36}$/);
    expect(createRequests).toHaveLength(1);
    expect(await countFor()).toBe(1);
  });

  test("a file picked for the new ticket shows as a chip that can be removed again", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    await openQueue(page);
    await page.getByTestId("ticket-compose").click();
    const dialog = page.getByTestId("create-ticket-dialog");
    await dialog.getByTestId("input-file-attachment").setInputFiles({ name: "itinerary.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
    await expect(dialog.getByTestId("attachment-file-0")).toContainText("itinerary.pdf");
    await dialog.getByTestId("attachment-file-remove-0").click();
    await expect(dialog.getByTestId("attachment-file-0")).toHaveCount(0);
  });
});

test.describe("the four statuses on the board", () => {
  test("each status has its own column and holds only its own tickets; moving a card changes the saved status", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const t = {
      open: await apiCreateTicket(page.request, { subject: ticketSubject("Board open"), assignedTo: w.agent.id, type: "Build" }),
      progress: await apiCreateTicket(page.request, { subject: ticketSubject("Board progress"), assignedTo: w.agent.id, type: "Build", status: "In Progress" }),
      resolved: await apiCreateTicket(page.request, { subject: ticketSubject("Board resolved"), assignedTo: w.agent.id, type: "Build", status: "Resolved" }),
      closed: await apiCreateTicket(page.request, { subject: ticketSubject("Board closed"), assignedTo: w.agent.id, type: "Build", status: "Closed" }),
    };

    await openQueue(page); // the board is the default view
    await expect(page.getByTestId("ticket-board")).toBeVisible();
    const col = (slug: string) => page.getByTestId(`ticket-column-${slug}`);
    await expect(col("open").getByTestId(`ticket-card-${t.open.id}`)).toBeVisible();
    await expect(col("in-progress").getByTestId(`ticket-card-${t.progress.id}`)).toBeVisible();
    await expect(col("resolved").getByTestId(`ticket-card-${t.resolved.id}`)).toBeVisible();
    await expect(col("closed").getByTestId(`ticket-card-${t.closed.id}`)).toBeVisible();
    for (const slug of ["open", "in-progress", "resolved", "closed"]) {
      await expect(col(slug).locator('[data-testid^="ticket-card-"]'), `${slug} has exactly one card`).toHaveCount(1);
    }

    // Dragging the open card to Resolved saves the new status and stamps the resolved date.
    await cardOf(page, t.open.id).dragTo(col("resolved"));
    await expect(col("resolved").getByTestId(`ticket-card-${t.open.id}`)).toBeVisible();
    await expect.poll(async () => (await dbTicket(t.open.id)).status).toBe("Resolved");
    expect((await dbTicket(t.open.id)).resolved_at).not.toBeNull();
    // And back to In Progress clears it again.
    await cardOf(page, t.open.id).dragTo(col("in-progress"));
    await expect.poll(async () => (await dbTicket(t.open.id)).status).toBe("In Progress");
    expect((await dbTicket(t.open.id)).resolved_at).toBeNull();
    // The other three did not move.
    expect((await dbTicket(t.progress.id)).status).toBe("In Progress");
    expect((await dbTicket(t.resolved.id)).status).toBe("Resolved");
    expect((await dbTicket(t.closed.id)).status).toBe("Closed");
  });
});

test.describe("chips, search and filters", () => {
  test("the chips split Open / In Progress from Resolved / Closed, Unassigned and Needs attention, and their counts match the rows", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const past = new Date(Date.now() - 3 * 3600_000).toISOString();
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const base = { assignedTo: w.agent.id, type: "Build" };
    const overdue = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Overdue"), dueDate: past });
    const later = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Later"), dueDate: future, status: "In Progress" });
    const nobody = await apiCreateTicket(page.request, { subject: ticketSubject("Nobody"), type: "Build", status: "Open" }); // raised by me, unassigned
    const done = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Done"), status: "Resolved" });
    const shut = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Shut"), status: "Closed" });

    await openQueue(page, { view: "list" });
    // 3 active tickets are mine (assigned to me, or raised by me and unassigned), 1 overdue, 1 unassigned, 2 closed ones.
    await expect(page.getByTestId("chip-ticket-open")).toContainText("All open 3");
    await expect(page.getByTestId("chip-ticket-attention")).toContainText("Needs attention 1");
    await expect(page.getByTestId("chip-ticket-unassigned")).toContainText("Unassigned 1");
    await expect(page.getByTestId("chip-ticket-closed")).toContainText("Closed 2");
    await expect(page.getByTestId("tickets-subline")).toContainText("3 open · 1 need attention · 1 unassigned");

    // All open: the overdue one sits in the "Needs attention" group, the rest in "Open"; closed ones are absent.
    expect(await groupOrder(page, "attention")).toEqual([overdue.id]);
    expect((await groupOrder(page, "open")).sort()).toEqual([later.id, nobody.id].sort());
    await expect(rowOf(page, done.id)).toHaveCount(0);
    await expect(rowOf(page, shut.id)).toHaveCount(0);
    await expect(rowOf(page, overdue.id).getByTestId("ticket-due-over")).toBeVisible();

    await page.getByTestId("chip-ticket-attention").click();
    await expect(rowOf(page, overdue.id)).toBeVisible();
    await expect(rowOf(page, later.id)).toHaveCount(0);

    await page.getByTestId("chip-ticket-unassigned").click();
    await expect(rowOf(page, nobody.id)).toBeVisible();
    await expect(rowOf(page, overdue.id)).toHaveCount(0);

    await page.getByTestId("chip-ticket-closed").click();
    await expect(rowOf(page, done.id)).toBeVisible();
    await expect(rowOf(page, shut.id)).toBeVisible();
    await expect(rowOf(page, overdue.id)).toHaveCount(0);
  });

  test("search finds a ticket by subject, client name, short id and assignee, and shows the empty state for a miss", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    const a = await apiCreateTicket(page.request, { subject: ticketSubject("Alpha seats"), clientId: client.id, assignedTo: w.agent.id });
    const b = await apiCreateTicket(page.request, { subject: ticketSubject("Bravo refund"), type: "Build", assignedTo: w.agentB.id, userId: w.agent.id });

    await openQueue(page, { view: "list" });
    // b was handed to Bea with no replies yet, so it is not in "My tickets"; "Raised by me" holds both.
    await page.getByTestId("ticket-scope-raised").click();
    await expect(rowOf(page, a.id)).toBeVisible();
    await expect(rowOf(page, b.id)).toBeVisible();
    const search = page.getByTestId("ticket-search");

    await search.fill("Alpha seats");
    await expect(rowOf(page, a.id)).toBeVisible();
    await expect(rowOf(page, b.id)).toHaveCount(0);

    await search.fill(client.surename); // client name: only the ticket linked to that client
    await expect(rowOf(page, a.id)).toBeVisible();
    await expect(rowOf(page, b.id)).toHaveCount(0);

    await search.fill(`#${b.id.split("-")[0]}`); // short id with the leading #
    await expect(rowOf(page, b.id)).toBeVisible();
    await expect(rowOf(page, a.id)).toHaveCount(0);

    await search.fill("Bea Agentb"); // assignee name
    await expect(rowOf(page, b.id)).toBeVisible();
    await expect(rowOf(page, a.id)).toHaveCount(0);

    await search.fill("zzz-no-such-ticket");
    await expect(page.getByTestId("ticket-empty")).toBeVisible();
    await expect(rowOf(page, a.id)).toHaveCount(0);
    await expect(rowOf(page, b.id)).toHaveCount(0);

    await search.fill(""); // control: clearing brings both back
    await expect(rowOf(page, a.id)).toBeVisible();
    await expect(rowOf(page, b.id)).toBeVisible();
  });

  test("the priority and kind filters narrow the list, stack, and clear", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const base = { assignedTo: w.agent.id };
    const urgentBuild = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Urgent build"), type: "Build", priority: "Urgent" });
    const lowBuild = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Low build"), type: "Build", priority: "Low" });
    const urgentAdmin = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Urgent admin"), type: "Admin", priority: "Urgent" });

    await openQueue(page, { view: "list" });
    for (const t of [urgentBuild, lowBuild, urgentAdmin]) await expect(rowOf(page, t.id)).toBeVisible();

    await page.getByTestId("button-ticket-filters").click();
    await page.getByTestId("chip-priority-Urgent").click();
    await expect(rowOf(page, lowBuild.id)).toHaveCount(0);
    await expect(rowOf(page, urgentBuild.id)).toBeVisible();
    await expect(rowOf(page, urgentAdmin.id)).toBeVisible();
    await expect(page.getByTestId("button-ticket-filters")).toContainText("Filters 1");

    await page.getByTestId("chip-kind-Build").click(); // Urgent AND Build
    await expect(rowOf(page, urgentAdmin.id)).toHaveCount(0);
    await expect(rowOf(page, urgentBuild.id)).toBeVisible();
    await expect(page.getByTestId("button-ticket-filters")).toContainText("Filters 2");

    await page.getByTestId("button-clear-ticket-filters").click();
    for (const t of [urgentBuild, lowBuild, urgentAdmin]) await expect(rowOf(page, t.id)).toBeVisible();
  });
});

test.describe("My tickets and Raised by me", () => {
  test("My tickets holds what is assigned to me, what I raised and left unassigned, and what I handed on once it has a reply; Raised by me holds everything I raised", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agentB.email);
    const assignedToMe = await apiCreateTicket(page.request, { subject: ticketSubject("Assigned to Ann"), type: "Build", assignedTo: w.agent.id });
    await signIn(page, w.agent.email);
    const unassigned = await apiCreateTicket(page.request, { subject: ticketSubject("Mine unassigned"), type: "Build" });
    const handedQuiet = await apiCreateTicket(page.request, { subject: ticketSubject("Handed on quiet"), type: "Build", assignedTo: w.agentB.id });
    const handedLive = await apiCreateTicket(page.request, { subject: ticketSubject("Handed on with reply"), type: "Build", assignedTo: w.agentB.id });
    expect((await page.request.post(`/api/v2/replies/ticket/${handedLive.id}`, { data: { content: "Over to you" } })).status()).toBe(201);
    const ownAssigned = await apiCreateTicket(page.request, { subject: ticketSubject("Raised and mine"), type: "Build", assignedTo: w.agent.id });

    await openQueue(page, { view: "list" });
    for (const t of [assignedToMe, unassigned, handedLive, ownAssigned]) await expect(rowOf(page, t.id), t.subject).toBeVisible();
    await expect(rowOf(page, handedQuiet.id)).toHaveCount(0);
    await expect(page.getByTestId("chip-ticket-open")).toContainText("All open 4");

    await page.getByTestId("ticket-scope-raised").click();
    // Raised by me: the four I created, and not the one Bea created for me.
    for (const t of [unassigned, handedQuiet, handedLive, ownAssigned]) await expect(rowOf(page, t.id), t.subject).toBeVisible();
    await expect(rowOf(page, assignedToMe.id)).toHaveCount(0);
    await expect(page.getByTestId("chip-ticket-open")).toContainText("All open 4");
  });
});

test.describe("sort order", () => {
  test("Newest first: open tickets by when they were raised, Resolved and Closed by when they were resolved", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const day = 86_400_000;
    const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * day).toISOString();
    const base = { assignedTo: w.agent.id, type: "Build" };
    const oldest = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Raised oldest") });
    const middle = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Raised middle") });
    const newest = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Raised newest") });
    await setCreatedAt(oldest.id, iso(9));
    await setCreatedAt(middle.id, iso(6));
    await setCreatedAt(newest.id, iso(3));
    // Two resolved tickets whose raise order is the opposite of their resolve order.
    const raisedLateResolvedEarly = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Raised late resolved early"), status: "Resolved" });
    const raisedEarlyResolvedLate = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Raised early resolved late"), status: "Closed" });
    await setCreatedAt(raisedLateResolvedEarly.id, iso(2), iso(8));
    await setCreatedAt(raisedEarlyResolvedLate.id, iso(20), iso(1));

    await openQueue(page, { view: "list" });
    await expect(page.getByTestId("select-ticket-sort")).toContainText("Newest first");
    await expect.poll(() => groupOrder(page, "open")).toEqual([newest.id, middle.id, oldest.id]);

    await page.getByTestId("chip-ticket-closed").click();
    await expect.poll(() => groupOrder(page, "closed")).toEqual([raisedEarlyResolvedLate.id, raisedLateResolvedEarly.id]);
  });

  test("Priority, highest first and Due soonest reorder the same rows", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const hour = 3600_000;
    const base = { assignedTo: w.agent.id, type: "Build" };
    const low = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("P low"), priority: "Low", dueDate: new Date(Date.now() + 30 * hour).toISOString() });
    const urgent = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("P urgent"), priority: "Urgent", dueDate: new Date(Date.now() + 90 * hour).toISOString() });
    const high = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("P high"), priority: "High", dueDate: new Date(Date.now() + 60 * hour).toISOString() });
    const noDue = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("P none"), priority: "Medium" });

    await openQueue(page, { view: "list" });
    await chooseOption(page, page.getByTestId("select-ticket-sort"), "Priority, highest first");
    await expect.poll(() => groupOrder(page, "open")).toEqual([urgent.id, high.id, noDue.id, low.id]);

    await chooseOption(page, page.getByTestId("select-ticket-sort"), "Due soonest");
    await expect.poll(() => groupOrder(page, "open")).toEqual([low.id, high.id, urgent.id, noDue.id]);
  });
});

test.describe("reply due", () => {
  test("a ticket due within two hours reads 'Due in', one in the past reads 'Overdue', and one days away is calm", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const base = { assignedTo: w.agent.id, type: "Build" };
    const soon = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Due soon"), dueDate: new Date(Date.now() + 45 * 60_000).toISOString() });
    const over = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Overdue"), dueDate: new Date(Date.now() - 5 * 3600_000).toISOString() });
    const calm = await apiCreateTicket(page.request, { ...base, subject: ticketSubject("Calm"), dueDate: new Date(Date.now() + 4 * 86_400_000).toISOString() });

    await openQueue(page, { view: "list" });
    await expect(rowOf(page, soon.id).getByTestId("ticket-due-soon")).toContainText(/Due in \d+m/);
    await expect(rowOf(page, over.id).getByTestId("ticket-due-over")).toContainText(/Overdue \d+h/);
    await expect(rowOf(page, calm.id)).toBeVisible();
    await expect(rowOf(page, calm.id).getByTestId("ticket-due-over")).toHaveCount(0);
    await expect(rowOf(page, calm.id).getByTestId("ticket-due-soon")).toHaveCount(0);
    // Both urgent ones are counted as needing attention, the calm one is not.
    await expect(page.getByTestId("chip-ticket-attention")).toContainText("Needs attention 2");
  });
});

