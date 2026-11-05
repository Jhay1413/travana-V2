/**
 * The ticket page (/tickets/:id): the four editable fields, resolving and reopening, team notes shown full width
 * (only real replies nest), the Message button rules, linking a holiday, deleting, and walking the queue order.
 * Nothing here sends a message: the Message button is only followed as far as the New message dialog, never sent.
 */
import type { Locator, Page } from "@playwright/test";
import { addDaysToKey, londonDayKey } from "../../client/src/lib/london-day";
import { londonDateTimeToIso } from "../../client/src/features/tickets/lib/london-datetime";
import { OUTBOUND_LOG } from "../helpers/env";
import { apiCreateClient, apiCreateEnquiry, dataOf, openHoliday, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { pinLondonHelpers } from "../helpers/london";
import { readOutboundAttempts } from "../helpers/outbound-report";
import { bookedDeal, boardWorld } from "../helpers/pipeline";
import { queryRows } from "../helpers/seed";
import { chooseOption, pickDate } from "../helpers/ui";
import { apiCreateTicket, dbReplies, dbTicket, ticketSubject, workWorld } from "../helpers/work";

pinLondonHelpers("dateTime");

async function openTicket(page: Page, id: string) {
  await page.goto(`/tickets/${id}`);
  await expect(page.getByTestId("ticket-centre-header")).toBeVisible();
}

/** Types a note into the composer and presses "Add note". Resolves once the new note is on screen. */
async function addNote(page: Page, text: string) {
  await page.getByTestId("ticket-reply-composer-input").fill(text);
  await page.getByTestId("ticket-reply-send").click();
  await expect(page.getByTestId("ticket-conversation").getByText(text, { exact: true })).toBeVisible();
  await expect(page.getByTestId("ticket-reply-composer-input")).toHaveValue("");
}

test.describe("the four fields", () => {
  test("status, priority, assignee and reply due each save on change, and the saved values are what the page then shows", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    const t = await apiCreateTicket(page.request, { subject: ticketSubject("Fields"), clientId: client.id, assignedTo: w.agent.id });
    await openTicket(page, t.id);

    // Status: In Progress keeps us on the page.
    await chooseOption(page, page.getByTestId("ticket-status-select"), "In Progress");
    await expect.poll(async () => (await dbTicket(t.id)).status).toBe("In Progress");
    await expect(page.getByTestId("ticket-status-select")).toContainText("In Progress");

    await page.getByTestId("ticket-priority-select").click();
    await page.getByRole("option", { name: "Urgent", exact: true }).click();
    await expect.poll(async () => (await dbTicket(t.id)).priority).toBe("Urgent");
    await expect(page.getByTestId("ticket-priority-select")).toContainText("Urgent");

    await page.getByTestId("ticket-reassign").click();
    await page.getByTestId(`ticket-reassign-${w.agentB.id}`).click();
    await expect.poll(async () => (await dbTicket(t.id)).assigned_to).toBe(w.agentB.id);
    await expect(page.getByTestId("ticket-reassign")).toContainText("Bea Agentb");

    const dueDay = addDaysToKey(londonDayKey(new Date()), 5);
    await pickDate(page, page.getByTestId("ticket-due-date"), dueDay);
    await expect.poll(async () => (await dbTicket(t.id)).due_date).not.toBeNull();
    const due = (await dbTicket(t.id)).due_date!;
    expect(new Date(`${due.replace(" ", "T")}Z`).toISOString()).toBe(londonDateTimeToIso(dueDay, "09:00"));
    // Changing the time keeps the day.
    await chooseOption(page, page.getByTestId("ticket-due-time"), "14:30");
    await expect.poll(async () => (await dbTicket(t.id)).due_date).not.toBe(due);
    expect(new Date(`${(await dbTicket(t.id)).due_date!.replace(" ", "T")}Z`).toISOString()).toBe(londonDateTimeToIso(dueDay, "14:30"));

    // Unassigning is allowed.
    await page.getByTestId("ticket-reassign").click();
    await page.getByTestId("ticket-unassign").click();
    await expect.poll(async () => (await dbTicket(t.id)).assigned_to).toBeNull();
    // The new assignee was told about the ticket (once, for the one real reassignment).
    expect(await queryRows(`select 1 from notifications where user_id = $1 and type = 'ticket_assigned' and link = $2`, [w.agentB.id, `/tickets/${t.id}`])).toHaveLength(1);
  });

  test("Resolved and Closed stamp the resolved date, closing a resolved ticket keeps that date, and reopening clears it", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const t = await apiCreateTicket(page.request, { subject: ticketSubject("Lifecycle"), type: "Build", assignedTo: w.agent.id });
    await openTicket(page, t.id);

    // Mark resolved: back to the queue, status Resolved, resolved date set.
    await page.getByTestId("ticket-resolve").click();
    await expect(page).toHaveURL(/\/tickets$/);
    await expect.poll(async () => (await dbTicket(t.id)).status).toBe("Resolved");
    const resolvedAt = (await dbTicket(t.id)).resolved_at;
    expect(resolvedAt).not.toBeNull();

    // A resolved ticket offers Reopen, not Mark resolved. Closing it keeps the original resolved date.
    await openTicket(page, t.id);
    await expect(page.getByTestId("ticket-reopen")).toBeVisible();
    await expect(page.getByTestId("ticket-resolve")).toHaveCount(0);
    await chooseOption(page, page.getByTestId("ticket-status-select"), "Closed");
    await expect.poll(async () => (await dbTicket(t.id)).status).toBe("Closed");
    expect((await dbTicket(t.id)).resolved_at?.getTime()).toBe(resolvedAt!.getTime());

    await page.getByTestId("ticket-reopen").click();
    await expect.poll(async () => (await dbTicket(t.id)).status).toBe("Open");
    expect((await dbTicket(t.id)).resolved_at).toBeNull();
    await expect(page.getByTestId("ticket-resolve")).toBeVisible();
  });
});

test.describe("team notes", () => {
  test("notes are full-width messages in time order, not replies; only an answer to a note nests, narrower, under it", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const t = await apiCreateTicket(page.request, {
      subject: ticketSubject("Notes"),
      type: "Build",
      assignedTo: w.agentB.id,
      description: "<p>The original description.</p>",
    });
    await openTicket(page, t.id);

    await expect(page.getByTestId("ticket-reply-composer-input")).toHaveAttribute("placeholder", "Write a note for the team…");
    await expect(page.getByTestId("ticket-reply-send")).toHaveText("Add note");

    await addNote(page, "First note from Ann");
    await addNote(page, "Second note from Ann");
    const replies = await dbReplies(t.id);
    expect(replies.map((r) => r.content)).toEqual(["First note from Ann", "Second note from Ann"]);
    expect(replies.every((r) => r.parent_reply_id === null)).toBe(true);
    const [first, second] = replies;

    const conv = page.getByTestId("ticket-conversation");
    const desc = conv.getByTestId(`ticket-note-ticket-${t.id}`);
    const n1 = conv.getByTestId(`ticket-note-${first.id}`);
    const n2 = conv.getByTestId(`ticket-note-${second.id}`);
    // Time order, oldest at the top: the description, then the first note, then the second.
    const ys = [await desc.boundingBox(), await n1.boundingBox(), await n2.boundingBox()].map((b) => b!.y);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
    // None of them hangs off a reply rail.
    await expect(conv.locator('[data-testid^="ticket-note-replies-"]')).toHaveCount(0);
    // Full width: a top-level note is as wide as the description and fills the panel, not a narrow bubble.
    const convBox = (await conv.boundingBox())!;
    const w1 = (await n1.boundingBox())!.width;
    expect(w1).toBeGreaterThan(convBox.width * 0.8);
    expect(Math.abs(w1 - (await desc.boundingBox())!.width)).toBeLessThan(2);

    // Answer the first note: the answer nests under it on a rail, indented and narrower.
    await n1.hover();
    await page.getByTestId(`ticket-note-reply-${first.id}`).click();
    await expect(page.getByTestId("ticket-reply-replying-to")).toContainText("Ann Agent");
    await page.getByTestId("ticket-reply-composer-input").fill("An answer to the first note");
    await page.getByTestId("ticket-reply-send").click();
    const rail = conv.getByTestId(`ticket-note-replies-${first.id}`);
    await expect(rail.getByText("An answer to the first note")).toBeVisible();
    const answer = (await dbReplies(t.id)).find((r) => r.content === "An answer to the first note")!;
    expect(answer.parent_reply_id).toBe(first.id);
    const railNote = rail.getByTestId(`ticket-note-${answer.id}`);
    const nested = (await railNote.boundingBox())!;
    expect(nested.width).toBeLessThan(w1 * 0.9);
    expect(nested.x).toBeGreaterThan((await n1.boundingBox())!.x + 20);
    // The second top-level note is still full width and not inside the rail.
    await expect(rail.getByTestId(`ticket-note-${second.id}`)).toHaveCount(0);
    expect((await n2.boundingBox())!.width).toBeCloseTo(w1, 0);
  });

  test("an author can edit and delete their own note; someone else's note offers neither", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const t = await apiCreateTicket(page.request, { subject: ticketSubject("Own notes"), type: "Build", assignedTo: w.agentB.id });
    const mine = await dataOf<{ id: string }>(await page.request.post(`/api/v2/replies/ticket/${t.id}`, { data: { content: "My note" } }), 201);
    await signIn(page, w.agentB.email);
    const theirs = await dataOf<{ id: string }>(await page.request.post(`/api/v2/replies/ticket/${t.id}`, { data: { content: "Bea's note" } }), 201);

    await signIn(page, w.agent.email);
    await openTicket(page, t.id);
    const conv = page.getByTestId("ticket-conversation");
    await expect(conv.getByTestId(`ticket-note-${theirs.id}`)).toBeVisible();
    await conv.getByTestId(`ticket-note-${theirs.id}`).hover();
    await expect(page.getByTestId(`ticket-note-reply-${theirs.id}`)).toBeVisible(); // positive control: the action row is there
    await expect(page.getByTestId(`ticket-note-edit-${theirs.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`ticket-note-delete-${theirs.id}`)).toHaveCount(0);

    await conv.getByTestId(`ticket-note-${mine.id}`).hover();
    await page.getByTestId(`ticket-note-edit-${mine.id}`).click();
    const editor = page.getByTestId("ticket-note-edit");
    await editor.locator('[contenteditable="true"]').fill("My note, edited");
    await editor.getByRole("button", { name: /save/i }).click();
    await expect.poll(async () => (await dbReplies(t.id)).find((r) => r.id === mine.id)?.content).toContain("My note, edited");
    await expect(conv.getByText("My note, edited")).toBeVisible();

    await conv.getByTestId(`ticket-note-${mine.id}`).hover();
    await page.getByTestId(`ticket-note-delete-${mine.id}`).click();
    await page.getByTestId(`ticket-note-delete-confirm-${mine.id}`).click();
    await expect(conv.getByTestId(`ticket-note-${mine.id}`)).toHaveCount(0);
    expect((await dbReplies(t.id)).map((r) => r.id)).toEqual([theirs.id]);
  });
});

test.describe("the Message button", () => {
  test("a client ticket always shows Message; for a client with no chat it leads to New message for that client, and nothing is sent", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request, { firstName: "Mavis" });
    const t = await apiCreateTicket(page.request, { subject: ticketSubject("Message me"), clientId: client.id, assignedTo: w.agent.id });
    const attemptsBefore = readOutboundAttempts(OUTBOUND_LOG).length;
    const sentBefore = (await queryRows(`select 1 from sms_messages where client_id = $1`, [client.id])).length;

    await openTicket(page, t.id);
    await page.getByTestId("ticket-side-client").click();
    const message = page.getByTestId("ticket-client-message");
    await expect(message).toBeVisible();
    await expect(message).toHaveAttribute("href", `/conversations?client=${client.id}`);

    await message.click();
    await expect(page).toHaveURL(new RegExp(`/conversations\\?client=${client.id}`));
    // Not linked to any inbox contact and no chat to open: the New message dialog opens for this client.
    const dialog = page.getByRole("dialog", { name: "New message" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Mavis ${client.surename}`);
    // It is a draft only: no message exists and no connection to anywhere was even attempted.
    expect((await queryRows(`select 1 from sms_messages where client_id = $1`, [client.id])).length).toBe(sentBefore);
    expect(readOutboundAttempts(OUTBOUND_LOG).length).toBe(attemptsBefore);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("an internal ticket has no client, so it has no Message button; a client ticket in the queue-side panel does", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    const internal = await apiCreateTicket(page.request, { subject: ticketSubject("No client"), type: "Build", assignedTo: w.agent.id });
    const forClient = await apiCreateTicket(page.request, { subject: ticketSubject("With client"), clientId: client.id, assignedTo: w.agent.id });

    await openTicket(page, internal.id);
    await page.getByTestId("ticket-side-client").click();
    await expect(page.getByTestId("ticket-internal-panel")).toBeVisible();
    await expect(page.getByTestId("ticket-client-message")).toHaveCount(0);

    await openTicket(page, forClient.id);
    await page.getByTestId("ticket-side-client").click();
    await expect(page.getByTestId("ticket-client-panel")).toBeVisible();
    await expect(page.getByTestId("ticket-client-message")).toBeVisible();
    await expect(page.getByTestId("ticket-internal-panel")).toHaveCount(0);
  });
});

test.describe("linking a holiday", () => {
  test("the client's own holidays are offered, one click links it, and another client's holiday is refused", async ({ page }) => {
    const bw = await boardWorld(page); // signed in as the shop's agent, with a client
    const other = await apiCreateClient(page.request);
    const mine = await bookedDeal(page.request, bw, { title: "Mine to link" });
    const theirs = await bookedDeal(page.request, bw, { title: "Someone else's trip" }, other.id);
    const t = await apiCreateTicket(page.request, { subject: ticketSubject("Link"), clientId: bw.clientId, assignedTo: bw.userId });

    await openTicket(page, t.id);
    await expect(page.getByTestId("ticket-no-booking-panel")).toBeVisible();
    await expect(page.getByTestId(`ticket-holiday-option-${mine.transactionId}`)).toBeVisible();
    await expect(page.getByTestId(`ticket-holiday-option-${theirs.transactionId}`)).toHaveCount(0);

    await page.getByTestId(`ticket-link-holiday-${mine.transactionId}`).click();
    await expect.poll(async () => (await dbTicket(t.id)).transaction_id).toBe(mine.transactionId);
    await expect(page.getByTestId("ticket-booking-panel")).toBeVisible();
    await expect(page.getByTestId("ticket-open-holiday")).toBeVisible();

    // The API refuses the other client's holiday and leaves the link as it was.
    const res = await page.request.patch(`/api/v2/tickets/${t.id}`, { data: { transactionId: theirs.transactionId } });
    expect(res.status(), await res.text()).toBe(400);
    expect(await res.text()).toContain("Holiday belongs to a different client");
    expect((await dbTicket(t.id)).transaction_id).toBe(mine.transactionId);

    // Unlinking from the menu clears it.
    await page.getByTestId("ticket-thread-more").click();
    await page.getByTestId("ticket-unlink-booking").click();
    await expect.poll(async () => (await dbTicket(t.id)).transaction_id).toBeNull();
    await expect(page.getByTestId("ticket-no-booking-panel")).toBeVisible();
  });
});

test.describe("deleting and walking the queue", () => {
  test("the creator can delete a ticket from the menu after confirming; cancelling keeps it", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const t = await apiCreateTicket(page.request, { subject: ticketSubject("Delete me"), type: "Build", assignedTo: w.agent.id });
    await openTicket(page, t.id);

    await page.getByTestId("ticket-thread-more").click();
    await page.getByTestId("ticket-delete").click();
    await page.getByTestId("ticket-delete-cancel").click();
    await expect(page.getByTestId("ticket-delete-confirm")).toBeHidden();
    expect(await dbTicket(t.id)).toBeTruthy();

    await page.getByTestId("ticket-thread-more").click();
    await page.getByTestId("ticket-delete").click();
    await page.getByTestId("ticket-delete-confirm").click();
    await expect(page).toHaveURL(/\/tickets$/);
    await expect.poll(async () => await dbTicket(t.id)).toBeUndefined();
  });

  test("a ticket the viewer cannot see shows 'Ticket not found' instead of its contents", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agentB.email);
    const t = await apiCreateTicket(page.request, { subject: ticketSubject("Private to Bea"), type: "Build", assignedTo: w.agentB.id });
    await signIn(page, w.agent.email); // same shop, not creator, not assignee
    await page.goto(`/tickets/${t.id}`);
    await expect(page.getByTestId("ticket-not-found")).toBeVisible();
    await expect(page.getByText(t.subject)).toHaveCount(0);
    // Control: the creator opens it.
    await signIn(page, w.agentB.email);
    await openTicket(page, t.id);
    await expect(page.getByTestId("ticket-thread-subject")).toHaveText(t.subject);
  });

  test("the page walks the same order as the queue (newest first), with 'n of m' and previous / next", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const a = await apiCreateTicket(page.request, { subject: ticketSubject("Walk A"), type: "Build", assignedTo: w.agent.id });
    const b = await apiCreateTicket(page.request, { subject: ticketSubject("Walk B"), type: "Build", assignedTo: w.agent.id });
    const c = await apiCreateTicket(page.request, { subject: ticketSubject("Walk C"), type: "Build", assignedTo: w.agent.id });
    const day = 86_400_000;
    await queryRows(`update tickets set created_at = $2 where id = $1`, [a.id, new Date(Date.now() - 3 * day).toISOString()]);
    await queryRows(`update tickets set created_at = $2 where id = $1`, [b.id, new Date(Date.now() - 2 * day).toISOString()]);
    await queryRows(`update tickets set created_at = $2 where id = $1`, [c.id, new Date(Date.now() - 1 * day).toISOString()]);

    await openTicket(page, b.id);
    // Newest first is C, B, A: B is second.
    await expect(page.getByTestId("ticket-position")).toHaveText("2 of 3");
    await page.getByTestId("ticket-next").click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${a.id}$`));
    await expect(page.getByTestId("ticket-position")).toHaveText("3 of 3");
    await expect(page.getByTestId("ticket-next")).toBeDisabled();
    await page.getByTestId("ticket-prev").click();
    await page.getByTestId("ticket-prev").click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${c.id}$`));
    await expect(page.getByTestId("ticket-position")).toHaveText("1 of 3");
    await expect(page.getByTestId("ticket-prev")).toBeDisabled();
  });

  test("pinning a ticket floats it to the top of its group in the queue", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const older = await apiCreateTicket(page.request, { subject: ticketSubject("Pin older"), type: "Build", assignedTo: w.agent.id });
    const newer = await apiCreateTicket(page.request, { subject: ticketSubject("Pin newer"), type: "Build", assignedTo: w.agent.id });
    await queryRows(`update tickets set created_at = $2 where id = $1`, [older.id, new Date(Date.now() - 86_400_000).toISOString()]);

    await openTicket(page, older.id);
    await page.getByTestId("ticket-pin").click();
    await expect(page.getByTestId("ticket-pin")).toContainText("Pinned");

    await page.goto("/tickets");
    await page.getByTestId("ticket-view-list").click();
    const rows = page.getByTestId("ticket-group-open").locator('[data-testid^="ticket-row-"]:not([data-testid^="ticket-row-subject-"]):not([data-testid^="ticket-row-pinned-"])');
    await expect(rows).toHaveCount(2);
    await expect(page.getByTestId(`ticket-row-pinned-${older.id}`)).toBeVisible();
    await expect(rows.first()).toHaveAttribute("data-testid", `ticket-row-${older.id}`);
    await expect(page.getByTestId(`ticket-row-pinned-${newer.id}`)).toHaveCount(0);
  });
});

test.describe("client page ticket due time", () => {
  test("Create Ticket from the client page takes a due date and a 15-minute London time, and saves that exact instant", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    await page.goto(`/clients/${client.id}`);
    await page.getByTestId("client-index-create").click();
    await page.getByTestId("client-index-create-ticket").click();
    const drawer = page.getByTestId("create-ticket-drawer");
    await expect(drawer).toBeVisible();
    await drawer.locator("#ticket-subject").fill(ticketSubject("Client due"));
    await chooseOption(page, drawer.locator("#ticket-user"), "Bea Agentb");
    const dueDay = addDaysToKey(londonDayKey(new Date()), 6);
    // Same default as the Tickets centre dialog: no due date, so the time box is disabled until a day is chosen.
    await expect(drawer.getByTestId("ticket-due-time")).toBeDisabled();
    await pickDate(page, drawer.getByTestId("ticket-due-date"), dueDay);
    await chooseOption(page, drawer.getByTestId("ticket-due-time"), "14:45");
    await drawer.getByTestId("drawer-footer").getByRole("button", { name: "Create Ticket" }).click();
    await expect(drawer).toBeHidden();

    await expect.poll(async () => (await queryRows(`select 1 from tickets where client_id = $1`, [client.id])).length).toBe(1);
    const [row] = await queryRows<{ id: string }>(`select id from tickets where client_id = $1`, [client.id]);
    const due = (await dbTicket(row.id)).due_date!;
    expect(new Date(`${due.replace(" ", "T")}Z`).toISOString()).toBe(londonDateTimeToIso(dueDay, "14:45"));
  });
});

test.describe("holiday Tickets tab list", () => {
  test("starts with every ticket collapsed, lists five, and Show more / Show less reveals and hides the rest", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    const enquiry = await apiCreateEnquiry(page.request, w.agency, client.id, w.agent.id);
    const tickets = [];
    for (let i = 1; i <= 7; i++) {
      tickets.push(await apiCreateTicket(page.request, { subject: ticketSubject(`List ${i}`), clientId: client.id, assignedTo: w.agent.id }));
    }
    await openHoliday(page, client.id, "enquiry", enquiry.enquiryId);
    await page.getByTestId("holiday-activity-tab-tickets").click();
    const list = page.getByTestId("holiday-detail-tickets");
    const cards = list.locator('[data-testid^="holiday-ticket-"]:not([data-testid^="holiday-ticket-pin-"]):not([data-testid^="holiday-ticket-toggle-"])');
    await expect(cards).toHaveCount(5);
    await expect(list.getByTestId("holiday-tickets-show-more")).toHaveText("Show more (2)");
    // Nothing is open by default: no ticket thread (and so no reply composer) is rendered.
    await expect(list.locator('[data-testid^="ticket-reply-composer-"]')).toHaveCount(0);

    await list.getByTestId("holiday-tickets-show-more").click();
    await expect(cards).toHaveCount(7);
    await expect(list.getByTestId("holiday-tickets-show-more")).toHaveText("Show less");
    await list.getByTestId("holiday-tickets-show-more").click();
    await expect(cards).toHaveCount(5);

    // A pinned ticket from beyond the first five jumps to the top of the list.
    const oldest = tickets[0];
    await list.getByTestId("holiday-tickets-show-more").click();
    await clickPin(page, page.getByTestId(`holiday-ticket-pin-${oldest.id}`));
    await expect(page.getByTestId(`holiday-ticket-${oldest.id}`)).toHaveAttribute("data-pinned", "true");
    await expect(cards.first()).toHaveAttribute("data-testid", `holiday-ticket-${oldest.id}`);

    // Opening a card shows its thread.
    await page.getByTestId(`holiday-ticket-toggle-${oldest.id}`).click();
    await expect(list.locator('[data-testid^="ticket-reply-composer-"]')).toHaveCount(1);
  });
});

/** Clicks a pin button and waits for its favourites toggle request to finish (the UI flips optimistically before it lands). */
async function clickPin(page: Page, button: Locator) {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/favorites/toggle") && r.ok()),
    button.click(),
  ]);
}

test.describe("pin and unpin", () => {
  test("the ticket page button and the enquiry Tickets tab card both pin, then unpin, and show amber while pinned", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    const t = await apiCreateTicket(page.request, { subject: ticketSubject("Pin toggle"), clientId: client.id, assignedTo: w.agent.id });
    const enquiry = await apiCreateEnquiry(page.request, w.agency, client.id, w.agent.id);

    // Ticket page: Pin -> Pinned -> Pin again (the bug left it on "Pinned" after the unpin).
    await openTicket(page, t.id);
    const pageButton = page.getByTestId("ticket-pin");
    await expect(pageButton).toHaveText("Pin");
    await clickPin(page, pageButton);
    await expect(pageButton).toHaveText("Pinned");
    await clickPin(page, pageButton);
    await expect(pageButton).toHaveText("Pin");
    await expect.poll(async () => (await queryRows(`select 1 from favorites where user_id = $1 and item_type = 'ticket' and item_id = $2`, [w.agent.id, t.id])).length).toBe(0);

    // Enquiry Tickets tab: same toggle, with the card highlighted while pinned.
    await openHoliday(page, client.id, "enquiry", enquiry.enquiryId);
    await page.getByTestId("holiday-activity-tab-tickets").click();
    const card = page.getByTestId(`holiday-ticket-${t.id}`);
    const cardButton = page.getByTestId(`holiday-ticket-pin-${t.id}`);
    await expect(card).toHaveAttribute("data-pinned", "false");
    await expect(cardButton).toHaveText("Pin");
    await clickPin(page, cardButton);
    await expect(cardButton).toHaveText("Pinned");
    await expect(card).toHaveAttribute("data-pinned", "true");
    await expect(card).toHaveClass(/border-social-orange/);
    await clickPin(page, cardButton);
    await expect(cardButton).toHaveText("Pin");
    await expect(card).toHaveAttribute("data-pinned", "false");
    await expect.poll(async () => (await queryRows(`select 1 from favorites where user_id = $1 and item_type = 'ticket' and item_id = $2`, [w.agent.id, t.id])).length).toBe(0);

    // Pinned from the tab, the ticket page agrees.
    await clickPin(page, cardButton);
    await expect(cardButton).toHaveText("Pinned");
    await openTicket(page, t.id);
    await expect(page.getByTestId("ticket-pin")).toHaveText("Pinned");
  });
});
