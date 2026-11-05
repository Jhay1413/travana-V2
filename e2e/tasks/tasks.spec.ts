/**
 * Tasks: creating them from the dashboard, a client page and a deal; the task-type dropdown and priority; completing,
 * reopening, editing, deleting and reassigning; the date order and UK-day windows; and what finishes a task automatically
 * (an enquiry becoming a quote, a quote being deleted). Booking conversion is covered in e2e/deals/booking.spec.ts and
 * e2e/pipeline/moves.spec.ts.
 *
 * Owner decisions behind the expectations: the task title is a dropdown (Enquiry call, Quote call, Quote follow up,
 * Re-quote, Booking call, Custom); priority low / medium / high / urgent, default medium, medium shows no pill; a task's
 * write scope equals its read scope plus a roster check on the new assignee; booking tasks are stored as entity_type
 * "quote" with the booking id; dashboard windows are Europe/London days.
 *
 * Owner decisions recorded here: dashboard tasks are in date order, soonest due first (decided 31 Oct); a task with no
 * deal that nobody owns can only be recovered by a branch manager or an admin, not by an agent (decided 3 Nov).
 */
import type { Page } from "@playwright/test";
import { addDaysToKey, londonDayKey } from "../../client/src/lib/london-day";
import { apiCreateClient, dataOf, openActionsMenu, openHoliday, signIn } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { londonAt, pinLondonHelpers } from "../helpers/london";
import { bookedDeal, boardWorld, enquiryDeal, quoteDeal } from "../helpers/pipeline";
import { queryRows, seedQuoteTask } from "../helpers/seed";
import { shopsWorld } from "../helpers/shops";
import { chooseOption, chooseSearchable } from "../helpers/ui";
import { apiCreateTask, dbTask, expectStatus, workWorld } from "../helpers/work";

pinLondonHelpers("day", "dateTime");

const HOUR = 3600_000;
const OTHER_SHOP = "This deal belongs to another shop";
const todayKey = () => londonDayKey(new Date());
/** The instant the London clock shows hh:mm today (built from the date and the clock time, so clock-change days are right). */
const todayAt = (hhmm: string) => londonAt(todayKey(), hhmm);

async function openDashboard(page: Page) {
  const done = page.waitForResponse((r) => r.url().includes("/api/v2/tasks/user") && r.request().method() === "GET");
  await Promise.all([done, page.goto("/agent-overview")]);
  await expect(page.getByTestId("panel-dashboard-tasks")).toBeVisible();
}

async function dashboardRowId(orgId: string, title: string): Promise<string> {
  const [row] = await queryRows<{ id: string }>(`select id from tasks where org_id = $1 and title = $2 order by created_at desc limit 1`, [orgId, title]);
  return row.id;
}

test.describe("creating a task from the dashboard", () => {
  test("the type dropdown offers exactly the six choices and priority the four levels; Save needs a choice, and Custom needs words", async ({ page }) => {
    const w = await boardWorld(page);
    await openDashboard(page);
    await page.getByTestId("button-dashboard-add").click();
    const modal = page.getByTestId("dashboard-new-task-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId("dashboard-new-task-submit")).toBeDisabled();

    await modal.getByTestId("dashboard-new-task-type").click();
    await expect(page.getByRole("option")).toHaveText(["Enquiry call", "Quote call", "Quote follow up", "Re-quote", "Booking call", "Custom"]);
    await page.getByRole("option", { name: "Custom", exact: true }).click();
    // Custom shows a free-text field and stays disabled until it has text.
    await expect(modal.getByTestId("dashboard-new-task-custom-title")).toBeVisible();
    await expect(modal.getByTestId("dashboard-new-task-submit")).toBeDisabled();
    await modal.getByTestId("dashboard-new-task-custom-title").fill("   ");
    await expect(modal.getByTestId("dashboard-new-task-submit")).toBeDisabled();
    // A fixed type needs no free text: switching to it hides the field and enables Save.
    await chooseOption(page, modal.getByTestId("dashboard-new-task-type"), "Quote call");
    await expect(modal.getByTestId("dashboard-new-task-custom-title")).toHaveCount(0);
    await expect(modal.getByTestId("dashboard-new-task-submit")).toBeEnabled();

    // Priority: default Medium, the four levels offered.
    await expect(modal.getByTestId("dashboard-new-task-priority")).toContainText("Medium");
    await modal.getByTestId("dashboard-new-task-priority").click();
    await expect(page.getByRole("option")).toHaveText(["Low", "Medium", "High", "Urgent"]);
    await page.keyboard.press("Escape");
    expect(await queryRows(`select 1 from tasks where org_id = $1`, [w.agency.orgId])).toHaveLength(0);
  });

  test("a fixed type becomes the task title; a Custom task uses the typed words; priority and due time are saved; medium shows no pill", async ({ page }) => {
    const w = await boardWorld(page);
    await openDashboard(page);

    // 1) Fixed type, High priority, due today 17:00 London.
    await page.getByTestId("button-dashboard-add").click();
    const modal = page.getByTestId("dashboard-new-task-modal");
    await chooseOption(page, modal.getByTestId("dashboard-new-task-type"), "Quote follow up");
    await chooseOption(page, modal.getByTestId("dashboard-new-task-priority"), "High");
    await modal.getByTestId("dashboard-new-task-date").fill(todayKey());
    await modal.getByTestId("dashboard-new-task-time").fill("17:00");
    await modal.getByTestId("dashboard-new-task-submit").click();
    await expect(modal).toBeHidden();
    const highId = await (async () => {
      await expect.poll(async () => (await queryRows(`select 1 from tasks where title = 'Quote follow up' and org_id = $1`, [w.agency.orgId])).length).toBe(1);
      return dashboardRowId(w.agency.orgId, "Quote follow up");
    })();
    const row = await dbTask(highId);
    expect(row).toMatchObject({ title: "Quote follow up", priority: "high", completed: false, user_id: w.userId, entity_type: null, entity_id: null, branch_id: w.agency.branchId });
    expect(row.due_date?.toISOString()).toBe(todayAt("17:00").toISOString());
    const high = page.getByTestId(`row-dashboard-task-${highId}`);
    await expect(high).toBeVisible();
    await expect(page.getByTestId(`text-dashboard-task-title-${highId}`)).toHaveText("Quote follow up");
    await expect(page.getByTestId(`pill-dashboard-task-priority-${highId}`)).toContainText("High");

    // 2) Custom title, default (medium) priority, no pill.
    await page.getByTestId("button-dashboard-add").click();
    await chooseOption(page, modal.getByTestId("dashboard-new-task-type"), "Custom");
    await modal.getByTestId("dashboard-new-task-custom-title").fill("Ring the hotel about the cot");
    await modal.getByTestId("dashboard-new-task-date").fill(todayKey());
    await modal.getByTestId("dashboard-new-task-time").fill("18:00");
    await modal.getByTestId("dashboard-new-task-submit").click();
    await expect(modal).toBeHidden();
    await expect.poll(async () => (await queryRows(`select 1 from tasks where org_id = $1 and title = 'Ring the hotel about the cot'`, [w.agency.orgId])).length).toBe(1);
    const customId = await dashboardRowId(w.agency.orgId, "Ring the hotel about the cot");
    expect((await dbTask(customId)).priority).toBe("medium");
    await expect(page.getByTestId(`row-dashboard-task-${customId}`)).toBeVisible();
    await expect(page.getByTestId(`pill-dashboard-task-priority-${customId}`)).toHaveCount(0);
    // Each of the two tasks exists once.
    await expect(page.locator('[data-testid^="row-dashboard-task-"]')).toHaveCount(2);
  });

  test("a task can be linked to a client and one of their live deals; a booking task is stored as a quote-type task with the booking id", async ({ page }) => {
    const w = await boardWorld(page);
    const booked = await bookedDeal(page.request, w, { title: "Booked for task" });
    const [{ id: bookingId }] = await queryRows<{ id: string }>(`select id from booking_table where transaction_id = $1`, [booked.transactionId]);
    const quote = await quoteDeal(page.request, w, { title: "Quoted for task" });
    const loner = await apiCreateClient(page.request);
    // Another client of the same shop with a live deal of their own: it must not be offered for the first client's task.
    const stranger = await apiCreateClient(page.request);
    const strangerDeal = await quoteDeal(page.request, { ...w, clientId: stranger.id, clientSurname: stranger.surename }, { title: "Stranger's deal" });
    await openDashboard(page);

    const open = async () => {
      await page.getByTestId("button-dashboard-add").click();
      const modal = page.getByTestId("dashboard-new-task-modal");
      await chooseOption(page, modal.getByTestId("dashboard-new-task-type"), "Booking call");
      await modal.getByTestId("dashboard-new-task-date").fill(todayKey());
      return modal;
    };
    const pickClient = async (modal: ReturnType<Page["getByTestId"]>, surname: string, id: string) => {
      await modal.getByTestId("dashboard-new-task-client-search").fill(surname);
      await modal.getByTestId(`dashboard-new-task-client-option-${id}`).click();
      await expect(modal.getByTestId("dashboard-new-task-client-picked")).toContainText(surname);
    };

    // Client + booking deal.
    let modal = await open();
    await pickClient(modal, w.clientSurname, w.clientId);
    await modal.getByTestId("dashboard-new-task-deal").click();
    await page.getByTestId(`dashboard-new-task-deal-option-${bookingId}`).click();
    await modal.getByTestId("dashboard-new-task-submit").click();
    await expect(modal).toBeHidden();
    await expect.poll(async () => (await queryRows(`select 1 from tasks where org_id = $1`, [w.agency.orgId])).length).toBe(1);
    let [t1] = await queryRows<{ entity_type: string; entity_id: string; branch_id: string }>(`select entity_type, entity_id, branch_id from tasks where org_id = $1`, [w.agency.orgId]);
    expect(t1).toMatchObject({ entity_type: "quote", entity_id: bookingId, branch_id: w.agency.branchId });

    // Client + quote deal: a quote task.
    modal = await open();
    await pickClient(modal, w.clientSurname, w.clientId);
    await modal.getByTestId("dashboard-new-task-deal").click();
    await page.getByTestId(`dashboard-new-task-deal-option-${quote.entityId}`).click();
    await modal.getByTestId("dashboard-new-task-submit").click();
    await expect(modal).toBeHidden();
    await expect.poll(async () => (await queryRows(`select 1 from tasks where entity_id = $1`, [quote.entityId])).length).toBe(1);

    // Client only: attached to the client, and a client with no live deals says so.
    modal = await open();
    await pickClient(modal, loner.surename, loner.id);
    await expect(modal.getByTestId("dashboard-new-task-no-deals")).toBeVisible();
    await modal.getByTestId("dashboard-new-task-submit").click();
    await expect(modal).toBeHidden();
    await expect.poll(async () => (await queryRows(`select 1 from tasks where entity_id = $1 and entity_type = 'client'`, [loner.id])).length).toBe(1);

    // The deal list offers only the picked client's deals. The options sit in a popup outside the modal, so open the
    // list and look at the whole page: the client's own two deals are there, the other client's deal is not.
    modal = await open();
    await pickClient(modal, w.clientSurname, w.clientId);
    await modal.getByTestId("dashboard-new-task-deal").click();
    await expect(page.getByTestId(`dashboard-new-task-deal-option-${bookingId}`)).toBeVisible();
    await expect(page.getByTestId(`dashboard-new-task-deal-option-${quote.entityId}`)).toBeVisible();
    await expect(page.getByTestId(`dashboard-new-task-deal-option-${strangerDeal.entityId}`)).toHaveCount(0);
    await page.keyboard.press("Escape"); // closes the list (and may close the dialog with it); nothing was saved either way
    await expect(page.getByTestId(`dashboard-new-task-deal-option-${bookingId}`)).toHaveCount(0);
    expect((await queryRows(`select 1 from tasks where org_id = $1`, [w.agency.orgId])).length).toBe(3);
  });
});

test.describe("creating a task from a client page and from a deal", () => {
  test("Add Task on the client page attaches it to the client, and it shows in the client's task list with its due chip", async ({ page }) => {
    const w = await boardWorld(page);
    await page.goto(`/clients/${w.clientId}`);
    await page.getByTestId("client-index-add-task").click();
    const modal = page.getByTestId("add-task-modal");
    await expect(modal).toBeVisible();
    // Opened from a client: no client/deal pickers, the client is the entity.
    await expect(modal.getByTestId("add-task-client-search")).toHaveCount(0);
    await chooseOption(page, modal.getByTestId("add-task-type"), "Enquiry call");
    await chooseOption(page, modal.getByTestId("add-task-priority"), "Urgent");
    const tomorrow = addDaysToKey(todayKey(), 1);
    await modal.getByTestId("add-task-date").fill(tomorrow);
    await modal.getByTestId("add-task-time").fill("10:00");
    await modal.getByTestId("add-task-submit").click();
    await expect(modal).toBeHidden();

    await expect.poll(async () => (await queryRows(`select 1 from tasks where entity_id = $1`, [w.clientId])).length).toBe(1);
    const [t] = await queryRows<{ id: string; title: string; priority: string; entity_type: string; user_id: string }>(`select id, title, priority, entity_type, user_id from tasks where entity_id = $1`, [w.clientId]);
    expect(t).toMatchObject({ title: "Enquiry call", priority: "urgent", entity_type: "client", user_id: w.userId });
    const row = page.getByTestId(`client-index-task-${t.id}`);
    await expect(row).toContainText("Enquiry call");
    await expect(page.getByTestId(`client-index-task-due-${t.id}`)).toHaveText("Tomorrow");
  });

  test("Add Task on the client page has a Description box; what is typed is trimmed and saved, and a blank one saves as no description", async ({ page }) => {
    const w = await boardWorld(page);
    await page.goto(`/clients/${w.clientId}`);
    const tomorrow = addDaysToKey(todayKey(), 1);
    for (const description of ["  Ask about the transfer time  ", "   "]) {
      await page.getByTestId("client-index-add-task").click();
      const modal = page.getByTestId("add-task-modal");
      await expect(modal).toBeVisible();
      await chooseOption(page, modal.getByTestId("add-task-type"), "Enquiry call");
      await modal.getByTestId("add-task-date").fill(tomorrow);
      await modal.getByTestId("add-task-description").fill(description);
      await modal.getByTestId("add-task-submit").click();
      await expect(modal).toBeHidden();
    }
    await expect.poll(async () => (await queryRows(`select 1 from tasks where entity_id = $1`, [w.clientId])).length).toBe(2);
    const rows = await queryRows<{ description: string | null }>(`select description from tasks where entity_id = $1 order by created_at`, [w.clientId]);
    expect(rows.map((r) => r.description)).toEqual(["Ask about the transfer time", null]);
  });

  test("New task on a quote's page attaches to that quote, and the quote page lists it with its priority", async ({ page }) => {
    const w = await boardWorld(page);
    const quote = await quoteDeal(page.request, w, { title: "Task from quote page" });
    await openHoliday(page, w.clientId, "quote", quote.entityId);
    await page.getByTestId("holiday-activity-tab-tasks").click();
    await page.getByTestId("button-activity-new-task").click();
    const modal = page.getByTestId("holiday-add-task-modal");
    await chooseOption(page, modal.getByTestId("holiday-add-task-type"), "Re-quote");
    await chooseOption(page, modal.getByTestId("holiday-add-task-priority"), "Low");
    await modal.getByTestId("holiday-add-task-submit").click();
    await expect(modal).toBeHidden();

    await expect.poll(async () => (await queryRows(`select 1 from tasks where entity_id = $1`, [quote.entityId])).length).toBe(1);
    const [t] = await queryRows<{ id: string; entity_type: string; priority: string; title: string }>(`select id, entity_type, priority, title from tasks where entity_id = $1`, [quote.entityId]);
    expect(t).toMatchObject({ entity_type: "quote", priority: "low", title: "Re-quote" });
    await expect(page.getByTestId(`holiday-task-${t.id}`)).toContainText("Re-quote");
    await expect(page.getByTestId(`holiday-task-priority-${t.id}`)).toContainText("Low");
  });

  test("New task on a booking's page is stored as a quote-type task with the booking id, and the booking page lists it", async ({ page }) => {
    const w = await boardWorld(page);
    const booked = await bookedDeal(page.request, w, { title: "Task from booking page" });
    const [{ id: bookingId }] = await queryRows<{ id: string }>(`select id from booking_table where transaction_id = $1`, [booked.transactionId]);
    await openHoliday(page, w.clientId, "booking", bookingId);
    await page.getByTestId("holiday-activity-tab-tasks").click();
    await page.getByTestId("button-activity-new-task").click();
    const modal = page.getByTestId("holiday-add-task-modal");
    await chooseOption(page, modal.getByTestId("holiday-add-task-type"), "Booking call");
    await modal.getByTestId("holiday-add-task-submit").click();
    await expect(modal).toBeHidden();

    await expect.poll(async () => (await queryRows(`select 1 from tasks where entity_id = $1`, [bookingId])).length).toBe(1);
    const [t] = await queryRows<{ id: string; entity_type: string }>(`select id, entity_type from tasks where entity_id = $1`, [bookingId]);
    expect(t.entity_type).toBe("quote");
    await expect(page.getByTestId(`holiday-task-${t.id}`)).toContainText("Booking call");
  });
});

test.describe("completing, reopening, editing and deleting", () => {
  test("ticking a task on the dashboard completes it and takes it off the open list", async ({ page }) => {
    const w = await boardWorld(page);
    const open = await apiCreateTask(page.request, { title: "Quote call", userId: w.userId, entityType: "client", entityId: w.clientId, dueDate: todayAt("17:00").toISOString() });
    const other = await apiCreateTask(page.request, { title: "Booking call", userId: w.userId, entityType: "client", entityId: w.clientId, dueDate: todayAt("18:00").toISOString() });
    await openDashboard(page);
    await expect(page.getByTestId(`row-dashboard-task-${open.id}`)).toBeVisible();
    await expect(page.getByTestId(`row-dashboard-task-${other.id}`)).toBeVisible();

    await page.getByTestId(`button-complete-dashboard-task-${open.id}`).click();
    await expect.poll(async () => (await dbTask(open.id)).completed).toBe(true);
    expect((await dbTask(open.id)).completed_at).not.toBeNull();
    // It leaves the open list on screen straight away, before any reload; the other task stays.
    await expect(page.getByTestId(`row-dashboard-task-${open.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`row-dashboard-task-${other.id}`)).toBeVisible();
    await page.reload(); // and it is still gone after a reload
    await expect(page.getByTestId(`row-dashboard-task-${other.id}`)).toBeVisible();
    await expect(page.getByTestId(`row-dashboard-task-${open.id}`)).toHaveCount(0);
    expect((await dbTask(other.id)).completed).toBe(false);
  });

  test("on the client page a tick saves, and after a reload the task shows as done and can be ticked open again", async ({ page }) => {
    const w = await boardWorld(page);
    const t = await apiCreateTask(page.request, { title: "Quote call", userId: w.userId, entityType: "client", entityId: w.clientId, dueDate: todayAt("17:00").toISOString() });
    await page.goto(`/clients/${w.clientId}`);
    await expect(page.getByTestId(`client-index-task-toggle-${t.id}`)).toHaveAttribute("title", "Mark as done");
    await page.getByTestId(`client-index-task-toggle-${t.id}`).click();
    await expect.poll(async () => (await dbTask(t.id)).completed).toBe(true);
    expect((await dbTask(t.id)).completed_at).not.toBeNull();

    await page.reload();
    await expect(page.getByTestId(`client-index-task-toggle-${t.id}`)).toHaveAttribute("title", "Mark as pending");
    await page.getByTestId(`client-index-task-toggle-${t.id}`).click();
    await expect.poll(async () => (await dbTask(t.id)).completed).toBe(false);
    expect((await dbTask(t.id)).completed_at).toBeNull();
    await page.reload();
    await expect(page.getByTestId(`client-index-task-toggle-${t.id}`)).toHaveAttribute("title", "Mark as done");
  });

  // Regression test: the task mutations used to refresh only the byEntity("client", id) list while the client page reads
  // taskKeys.forClient(id), so the row did not change until a reload. They now refresh every task list.
  test("on the client page the row updates straight after a tick, without a reload", async ({ page }) => {
    const w = await boardWorld(page);
    const t = await apiCreateTask(page.request, { title: "Quote call", userId: w.userId, entityType: "client", entityId: w.clientId, dueDate: todayAt("17:00").toISOString() });
    await page.goto(`/clients/${w.clientId}`);
    const toggle = page.getByTestId(`client-index-task-toggle-${t.id}`);
    await expect(toggle).toHaveAttribute("title", "Mark as done");
    await toggle.click();
    await expect.poll(async () => (await dbTask(t.id)).completed).toBe(true);
    await expect(toggle).toHaveAttribute("title", "Mark as pending");
  });

  test("the edit dialog changes type, priority, date, description and status, and a Done status completes the task", async ({ page }) => {
    const w = await boardWorld(page);
    const t = await apiCreateTask(page.request, { title: "Quote call", userId: w.userId, entityType: "client", entityId: w.clientId, dueDate: todayAt("17:00").toISOString(), priority: "medium" });
    await openDashboard(page);
    await page.getByTestId(`button-edit-dashboard-task-${t.id}`).click();
    const dialog = page.getByTestId("dialog-edit-task");
    await expect(dialog).toBeVisible();
    // Hydrated from the task: the type matches the title, priority medium, date and time as stored.
    await expect(dialog.getByTestId("edit-task-type")).toContainText("Quote call");
    await expect(dialog.getByTestId("edit-task-priority")).toContainText("Medium");
    await expect(dialog.getByTestId("input-edit-task-due-date")).toHaveValue(todayKey());
    await expect(dialog.getByTestId("input-edit-task-due-time")).toHaveValue("17:00");

    await chooseOption(page, dialog.getByTestId("edit-task-type"), "Custom");
    await dialog.getByTestId("input-edit-task-title").fill("Chase the deposit");
    await chooseOption(page, dialog.getByTestId("edit-task-priority"), "Urgent");
    const day = addDaysToKey(todayKey(), 2);
    await dialog.getByTestId("input-edit-task-due-date").fill(day);
    await dialog.getByTestId("input-edit-task-due-time").fill("11:15");
    await dialog.getByTestId("input-edit-task-description").fill("Customer said Friday.");
    await dialog.getByTestId("button-edit-task-status-done").click();
    await dialog.getByTestId("button-confirm-edit-task").click();
    await expectToast(page, "Task updated");

    const row = await dbTask(t.id);
    expect(row).toMatchObject({ title: "Chase the deposit", priority: "urgent", completed: true, description: "Customer said Friday." });
    expect(row.completed_at).not.toBeNull();
    expect(row.due_date?.toISOString()).toBe(londonAt(day, "11:15").toISOString());
  });

  test("deleting from the client page's task menu removes the task for good (after a reload it is gone); the neighbour stays", async ({ page }) => {
    const w = await boardWorld(page);
    const keep = await apiCreateTask(page.request, { title: "Keep me", userId: w.userId, entityType: "client", entityId: w.clientId, dueDate: todayAt("17:00").toISOString() });
    const gone = await apiCreateTask(page.request, { title: "Delete on client", userId: w.userId, entityType: "client", entityId: w.clientId, dueDate: todayAt("18:00").toISOString() });
    await page.goto(`/clients/${w.clientId}`);
    await expect(page.getByTestId(`client-index-task-${keep.id}`)).toBeVisible();
    await page.getByTestId(`client-index-task-menu-${gone.id}`).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect.poll(async () => await dbTask(gone.id)).toBeUndefined();
    await page.reload();
    await expect(page.getByTestId(`client-index-task-${keep.id}`)).toBeVisible();
    await expect(page.getByTestId(`client-index-task-${gone.id}`)).toHaveCount(0);
    expect(await dbTask(keep.id)).toBeTruthy();
  });

  // Regression test: same stale list as the tick used to have; a deleted row now leaves the screen at once.
  test("on the client page a deleted task disappears straight away, without a reload", async ({ page }) => {
    const w = await boardWorld(page);
    const gone = await apiCreateTask(page.request, { title: "Delete on client", userId: w.userId, entityType: "client", entityId: w.clientId, dueDate: todayAt("18:00").toISOString() });
    await page.goto(`/clients/${w.clientId}`);
    await expect(page.getByTestId(`client-index-task-${gone.id}`)).toBeVisible();
    await page.getByTestId(`client-index-task-menu-${gone.id}`).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect.poll(async () => await dbTask(gone.id)).toBeUndefined();
    await expect(page.getByTestId(`client-index-task-${gone.id}`)).toHaveCount(0);
  });

  test("deleting from a quote's task list removes the task and its row at once; the other task stays", async ({ page }) => {
    const w = await boardWorld(page);
    const quote = await quoteDeal(page.request, w, { title: "Delete tasks" });
    const keep = await apiCreateTask(page.request, { title: "Keep me", userId: w.userId, entityType: "quote", entityId: quote.entityId, dueDate: todayAt("17:00").toISOString() });
    const goQuote = await apiCreateTask(page.request, { title: "Delete on quote", userId: w.userId, entityType: "quote", entityId: quote.entityId, dueDate: todayAt("18:00").toISOString() });
    await openHoliday(page, w.clientId, "quote", quote.entityId);
    await page.getByTestId("holiday-activity-tab-tasks").click();
    await expect(page.getByTestId(`holiday-task-${goQuote.id}`)).toBeVisible();
    await page.getByTestId(`holiday-task-menu-${goQuote.id}`).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByTestId(`holiday-task-${goQuote.id}`)).toHaveCount(0);
    await expect.poll(async () => await dbTask(goQuote.id)).toBeUndefined();
    await expect(page.getByTestId(`holiday-task-${keep.id}`)).toBeVisible();
    expect(await dbTask(keep.id)).toBeTruthy();
  });
});

test.describe("reassigning", () => {
  test("a task can be handed to a colleague from the edit dialog; they are told once, and a person outside the team is refused", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const t = await apiCreateTask(page.request, { title: "Quote call", userId: w.agent.id, dueDate: todayAt("17:00").toISOString() });
    await openDashboard(page);
    await page.getByTestId(`button-edit-dashboard-task-${t.id}`).click();
    const dialog = page.getByTestId("dialog-edit-task");
    await dialog.getByTestId("select-edit-task-assign-to").click();
    await page.getByRole("option", { name: /Bea Agentb/ }).click();
    await dialog.getByTestId("button-confirm-edit-task").click();
    await expectToast(page, "Task updated");
    expect((await dbTask(t.id)).user_id).toBe(w.agentB.id);
    expect(await queryRows(`select 1 from notifications where user_id = $1 and type = 'task_assigned'`, [w.agentB.id])).toHaveLength(1);
    // It left the first agent's list and is now on Bea's.
    await page.reload();
    await expect(page.getByTestId(`row-dashboard-task-${t.id}`)).toHaveCount(0);
    await signIn(page, w.agentB.email);
    await openDashboard(page);
    await expect(page.getByTestId(`row-dashboard-task-${t.id}`)).toBeVisible();

    // Roster check: someone outside the agency is refused, and the task does not move.
    const back = await page.request.put(`/api/v2/tasks/${t.id}`, { data: { userId: w.foreign.agent.id } });
    expect(await expectStatus(back, 400, "reassign outside the team")).toContain("That person is not on your team");
    expect((await dbTask(t.id)).user_id).toBe(w.agentB.id);
    // Unassigning is always allowed. A task with no deal that nobody owns is then outside an agent's scope (own-task rule),
    // so the agent cannot pick it back up, but the org admin still can.
    expect((await page.request.put(`/api/v2/tasks/${t.id}`, { data: { userId: null } })).status()).toBe(200);
    expect((await dbTask(t.id)).user_id).toBeNull();
    expect((await page.request.put(`/api/v2/tasks/${t.id}`, { data: { userId: w.agentB.id } })).status()).toBe(404);
    await signIn(page, w.admin.email);
    expect((await page.request.put(`/api/v2/tasks/${t.id}`, { data: { userId: w.agentB.id } })).status()).toBe(200);
    expect((await dbTask(t.id)).user_id).toBe(w.agentB.id);
    // Self-assigning needs no roster check: the admin takes it.
    expect((await page.request.put(`/api/v2/tasks/${t.id}`, { data: { userId: w.admin.id } })).status()).toBe(200);
    expect((await dbTask(t.id)).user_id).toBe(w.admin.id);
  });
});

test.describe("who can change which task (write scope = read scope + roster check)", () => {
  // Owner decision (3 Nov): a task with no deal that nobody owns can only be recovered by a branch manager or an admin; an
  // agent cannot pick it back up (see "reassigning"). The no-deal rule below is the same one.
  test("a task with no deal is its owner's, plus the shop's manager and the org admin; nobody else", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const t = await apiCreateTask(page.request, { title: "Quote call", userId: w.agent.id, dueDate: todayAt("17:00").toISOString() });
    const attempt = async (email: string) => {
      await signIn(page, email);
      return (await page.request.put(`/api/v2/tasks/${t.id}`, { data: { description: `by ${email}` } })).status();
    };
    expect(await attempt(w.agentB.email)).toBe(404);
    expect(await attempt(w.agent2.email)).toBe(404);
    expect(await attempt(w.homeworker.email)).toBe(404);
    expect(await attempt(w.foreign.agent.email)).toBe(404);
    expect(await attempt(w.foreign.admin.email)).toBe(404);
    expect(await attempt(w.smm.email)).toBe(403);
    expect(await attempt(w.manager2.email)).toBe(404);
    expect((await dbTask(t.id)).description).toBeNull();
    expect(await attempt(w.agent.email)).toBe(200);
    expect(await attempt(w.manager1.email)).toBe(200);
    expect(await attempt(w.admin.email)).toBe(200);
    expect((await dbTask(t.id)).description).toBe(`by ${w.admin.email}`);
    // Same rule for complete and delete.
    await signIn(page, w.agentB.email);
    expect((await page.request.put(`/api/v2/tasks/${t.id}/toggle`)).status()).toBe(404);
    expect((await page.request.delete(`/api/v2/tasks/${t.id}`)).status()).toBe(404);
    expect(await dbTask(t.id)).toBeTruthy();
    await signIn(page, w.manager1.email);
    expect((await page.request.put(`/api/v2/tasks/${t.id}/toggle`)).status()).toBe(200);
    expect((await dbTask(t.id)).completed).toBe(true);
    expect((await page.request.delete(`/api/v2/tasks/${t.id}`)).status()).toBe(200);
    expect(await dbTask(t.id)).toBeUndefined();
  });

  test("a task on a deal follows the deal's shop: the shop's colleagues can change it, another shop's staff are told 'belongs to another shop', another agency gets 404", async ({ page }) => {
    const o = await shopsWorld(page); // shop 1 agent signed in; deal2 / booked2 belong to shop 2
    // A task on the SHOP-1 deal, made by shop 1's agent. (shopsWorld's deal2 is shop 2's; build a shop-1 deal here.)
    const mine = await quoteDeal(page.request, o.w, { title: "Shop one deal" });
    const task = await apiCreateTask(page.request, { title: "Quote call", userId: o.w.userId, entityType: "quote", entityId: mine.entityId, dueDate: todayAt("17:00").toISOString() });
    const put = async (email: string, id = task.id) => {
      await signIn(page, email);
      return page.request.put(`/api/v2/tasks/${id}`, { data: { description: `by ${email}` } });
    };

    // Shop 1's manager and admin: yes. Another shop's agent: refused with the reason (another shop's manager is checked in
    // the test above). Another agency: not found.
    expect((await put(o.manager1.email)).status()).toBe(200);
    expect((await put(o.agency.adminEmail)).status()).toBe(200);
    for (const email of [o.agent2.email]) {
      const res = await put(email);
      expect(await expectStatus(res, 403, email)).toContain(OTHER_SHOP);
    }
    expect((await page.request.put(`/api/v2/tasks/${task.id}/toggle`)).status()).toBe(403);
    expect((await page.request.delete(`/api/v2/tasks/${task.id}`)).status()).toBe(403);
    expect((await put(o.foreign.agentEmail)).status()).toBe(404);
    expect((await dbTask(task.id)).completed).toBe(false);
    expect((await dbTask(task.id)).description).toBe(`by ${o.agency.adminEmail}`);
  });

  test("a colleague in the same shop can complete and reassign a task on a shop deal that is assigned to someone else", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    const world = { agency: w.agency, userId: w.agent.id, clientId: client.id, clientSurname: client.surename };
    const deal = await quoteDeal(page.request, world, { title: "Shared shop deal" });
    // The task is Ann's, on a deal in the shop; Bea (same shop) and not the assignee changes it.
    const task = await apiCreateTask(page.request, { title: "Quote call", userId: w.agent.id, entityType: "quote", entityId: deal.entityId, dueDate: todayAt("17:00").toISOString() });
    await signIn(page, w.agentB.email);
    expect((await page.request.put(`/api/v2/tasks/${task.id}/toggle`)).status()).toBe(200);
    expect((await dbTask(task.id)).completed).toBe(true);
    // Bea hands it to Ann's colleague Mona (a branch manager is not on the sales-agent roster) -> refused; to herself -> fine.
    const toManager = await page.request.put(`/api/v2/tasks/${task.id}`, { data: { userId: w.manager1.id } });
    expect(await expectStatus(toManager, 400, "reassign to a non-sales person")).toContain("That person is not on your team");
    expect((await page.request.put(`/api/v2/tasks/${task.id}`, { data: { userId: w.agentB.id } })).status()).toBe(200);
    expect((await dbTask(task.id)).user_id).toBe(w.agentB.id);
    // The same task as read by the shop's deal list shows for everyone who can open the deal.
    const listed = await dataOf<{ id: string }[]>(await page.request.get(`/api/v2/tasks?entityType=quote&entityId=${deal.entityId}`));
    expect(listed.map((x) => x.id)).toEqual([task.id]);
  });
});

test.describe("date order and UK days", () => {
  test("the dashboard list is in date order, soonest first; the Today window ends at UK midnight, so 23:30 is today and 00:30 is tomorrow", async ({ page }) => {
    const w = await boardWorld(page);
    // Every due time is built from a London date plus a London clock time, so a clock-change day cannot move it.
    const tomorrowKey = addDaysToKey(todayKey(), 1);
    const lateToday = await apiCreateTask(page.request, { title: "Late today", userId: w.userId, dueDate: todayAt("23:30").toISOString() });
    const earlyToday = await apiCreateTask(page.request, { title: "Early today", userId: w.userId, dueDate: todayAt("00:10").toISOString() });
    const earlyTomorrow = await apiCreateTask(page.request, { title: "Early tomorrow", userId: w.userId, dueDate: londonAt(tomorrowKey, "00:30").toISOString() });
    const nextWeek = await apiCreateTask(page.request, { title: "Next week", userId: w.userId, dueDate: londonAt(addDaysToKey(tomorrowKey, 8), "12:00").toISOString() });

    await openDashboard(page);
    const rows = page.locator('[data-testid^="row-dashboard-task-"]');
    const idsNow = async () => (await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("row-dashboard-task-", ""))));
    // Today: both of today's tasks (midnight+10min and 23:30), earliest first, and nothing from tomorrow.
    await expect.poll(idsNow).toEqual([earlyToday.id, lateToday.id]);

    await page.getByTestId("button-tasks-filter-tomorrow").click();
    await expect.poll(idsNow).toEqual([earlyTomorrow.id]);

    await page.getByTestId("button-tasks-filter-all").click();
    await expect.poll(idsNow).toEqual([earlyToday.id, lateToday.id, earlyTomorrow.id, nextWeek.id]);
  });

  test("Overdue counts and lists the unfinished tasks whose time has passed, soonest first, and ignores done and future ones", async ({ page }) => {
    const w = await boardWorld(page);
    const old = await apiCreateTask(page.request, { title: "Long overdue", userId: w.userId, dueDate: new Date(Date.now() - 5 * 24 * HOUR).toISOString() });
    const recent = await apiCreateTask(page.request, { title: "Just overdue", userId: w.userId, dueDate: new Date(Date.now() - 2 * HOUR).toISOString() });
    const done = await apiCreateTask(page.request, { title: "Overdue but done", userId: w.userId, dueDate: new Date(Date.now() - 3 * HOUR).toISOString(), completed: true });
    const future = await apiCreateTask(page.request, { title: "Not yet", userId: w.userId, dueDate: new Date(Date.now() + 3 * 24 * HOUR).toISOString() });

    await openDashboard(page);
    await expect(page.getByTestId("badge-tasks-overdue-count")).toHaveText("2");
    await page.getByTestId("button-tasks-filter-overdue").click();
    const rows = page.locator('[data-testid^="row-dashboard-task-"]');
    await expect(rows).toHaveCount(2);
    const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("row-dashboard-task-", "")));
    expect(ids).toEqual([old.id, recent.id]);
    for (const t of [done, future]) await expect(page.getByTestId(`row-dashboard-task-${t.id}`)).toHaveCount(0);
  });

  test("on a client page, open tasks come first in date order (soonest first, undated last) and finished ones sink to the bottom", async ({ page }) => {
    const w = await boardWorld(page);
    const mk = (title: string, hours: number | null, extra: Record<string, unknown> = {}) =>
      apiCreateTask(page.request, { title, userId: w.userId, entityType: "client", entityId: w.clientId, ...(hours === null ? {} : { dueDate: new Date(Date.now() + hours * HOUR).toISOString() }), ...extra });
    const later = await mk("Later", 48);
    const undated = await mk("Undated", null);
    const sooner = await mk("Sooner", 5);
    const done = await mk("Done early", 1, { completed: true });
    await page.goto(`/clients/${w.clientId}`);
    const list = page.getByTestId("client-index-tasks");
    await expect(list).toBeVisible();
    const rows = list.locator('[data-testid^="client-index-task-"]:not([data-testid*="toggle"]):not([data-testid*="menu"]):not([data-testid*="due"])');
    await expect(rows).toHaveCount(4);
    const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("client-index-task-", "")));
    expect(ids).toEqual([sooner.id, later.id, undated.id, done.id]);
  });
});

test.describe("tasks that finish on their own", () => {
  test("converting an enquiry to a quote finishes the enquiry's open tasks, and only those", async ({ page }) => {
    const w = await boardWorld(page);
    const enq = await enquiryDeal(page.request, w, "Task enquiry");
    const otherEnq = await enquiryDeal(page.request, w, "Untouched enquiry");
    const onEnquiry = await apiCreateTask(page.request, { title: "Enquiry call", userId: w.userId, entityType: "enquiry", entityId: enq.entityId });
    const onOther = await apiCreateTask(page.request, { title: "Enquiry call", userId: w.userId, entityType: "enquiry", entityId: otherEnq.entityId });
    const onClient = await apiCreateTask(page.request, { title: "Custom client task", userId: w.userId, entityType: "client", entityId: w.clientId });

    await openHoliday(page, w.clientId, "enquiry", enq.entityId);
    await openActionsMenu(page);
    await page.getByRole("menuitem", { name: "Convert to Quote" }).click();
    const drawer = page.getByTestId("convert-enquiry-drawer");
    await expect(drawer).toBeVisible();
    await chooseSearchable(page, drawer.getByRole("combobox").filter({ hasText: /Select operator|E2E /i }), "E2E Sun Holidays");
    await drawer.getByTestId("drawer-costing-price").fill("2000");
    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Enquiry converted to quote!");

    await expect.poll(async () => (await dbTask(onEnquiry.id)).completed).toBe(true);
    expect((await dbTask(onEnquiry.id)).completed_at).not.toBeNull();
    expect((await dbTask(onOther.id)).completed).toBe(false);
    expect((await dbTask(onClient.id)).completed).toBe(false);
  });

  test("deleting a quote through the API finishes that quote's open tasks; other quotes' tasks stay open", async ({ page }) => {
    const w = await boardWorld(page);
    await signIn(page, w.agency.adminEmail);
    const doomed = await quoteDeal(page.request, w, { title: "Doomed quote" });
    const safe = await quoteDeal(page.request, w, { title: "Safe quote" });
    const onDoomed = await seedQuoteTask({ userId: w.agency.adminId, orgId: w.agency.orgId, branchId: w.agency.branchId, quoteId: doomed.entityId });
    const onSafe = await seedQuoteTask({ userId: w.agency.adminId, orgId: w.agency.orgId, branchId: w.agency.branchId, quoteId: safe.entityId });
    const res = await page.request.delete(`/api/v2/quotes/${doomed.entityId}`);
    expect(res.status(), await res.text()).toBe(204);
    await expect.poll(async () => (await dbTask(onDoomed)).completed).toBe(true);
    expect((await dbTask(onSafe)).completed).toBe(false);
  });

  // Regression test: the admin dialog posts to /audit/delete-quote/:id; auditService.deleteQuote used to soft-delete the
  // quote without closing its tasks (newQuoteService.deleteQuote does), so they lingered on the agent's list.
  test("deleting a quote from the admin Delete Quote dialog finishes its open tasks too", async ({ page }) => {
    const w = await boardWorld(page);
    await signIn(page, w.agency.adminEmail);
    const doomed = await quoteDeal(page.request, w, { title: "Doomed quote" });
    const onDoomed = await seedQuoteTask({ userId: w.agency.adminId, orgId: w.agency.orgId, branchId: w.agency.branchId, quoteId: doomed.entityId });

    await openHoliday(page, w.clientId, "quote", doomed.entityId);
    await openActionsMenu(page);
    await page.getByRole("menuitem", { name: "Delete Quote" }).click();
    const dialog = page.getByTestId("dialog-admin-delete-quote");
    await dialog.getByTestId("textarea-delete-reason").fill("Duplicate of another quote");
    await dialog.getByTestId("button-confirm-delete").click();
    await expectToast(page, "Quote deleted successfully");
    await expect
      .poll(async () => (await queryRows<{ deleted_at: Date | null }>(`select deleted_at from quote_table where id = $1`, [doomed.entityId]))[0].deleted_at)
      .not.toBeNull();
    await expect.poll(async () => (await dbTask(onDoomed)).completed).toBe(true);
    expect((await dbTask(onDoomed)).completed_at).not.toBeNull();
  });
});

