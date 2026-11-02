/**
 * The agent dashboard (/agent-overview): each card's numbers against the code's own formulas.
 *  - profit tiles: booking commission (package + line items, inactive and other people's bookings left out) by the
 *    booking's date, plus upsell commission by the date the upsell was ADDED, in UK (Europe/London) day / Monday-week /
 *    month windows, computed here from the London helpers and never from this machine's clock;
 *  - target and run-to-target;
 *  - pipeline money identical to /pipeline (value = sales - discounts + service charge, profit = package + line items,
 *    enquiries show their budget);
 *  - quote engagement shows only the viewer's own quotes, per UK-day period;
 *  - daily goals are kept per user and UK day and clear on a new day;
 *  - the Tickets tab button says New Ticket; empty states.
 */
import { randomUUID } from "node:crypto";
import { ukAddDays, ukMonthEnd, ukStartOfDay, ukStartOfMonth, ukStartOfWeek, ukYearMonth } from "../../server/v2/utils/london-dates";
import { addDaysToKey, londonDayKey } from "../../client/src/lib/london-day";
import { apiCreateClient, dataOf, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { pinLondonHelpers } from "../helpers/london";
import { boardWorld, column, enquiryDeal, openBoard, quoteDeal } from "../helpers/pipeline";
import { queryRows } from "../helpers/seed";
import { apiCreateTicket, seedBooking, seedUpsell, ticketSubject, workWorld } from "../helpers/work";

pinLondonHelpers("day", "week", "month");

const MIN = 60_000;
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
const word = (n: number, one: string, many: string) => (n === 1 ? one : many);

async function openAgentDashboard(page: import("@playwright/test").Page) {
  const stats = page.waitForResponse((r) => r.url().includes("/api/v2/dashboard/agent-stats"));
  await Promise.all([stats, page.goto("/agent-overview")]);
  expect((await stats).status()).toBe(200);
  await expect(page.getByTestId("card-agent-dashboard")).toBeVisible();
}

interface Window {
  from: Date;
  to?: Date;
}

/** Expected figures for one window from the seeded facts, using only the rules in the owner's decisions. */
function expectFor(win: Window, bookings: Array<{ at: Date; commission: number }>, upsells: Array<{ at: Date; commission: number }>) {
  const inWin = (d: Date) => d >= win.from && (!win.to || d < win.to);
  const b = bookings.filter((x) => inWin(x.at));
  const u = upsells.filter((x) => inWin(x.at));
  const upsellSum = u.reduce((s, x) => s + x.commission, 0);
  return {
    profit: b.reduce((s, x) => s + x.commission, 0) + upsellSum,
    bookings: b.length,
    upsells: u.length,
    upsellSum,
  };
}

test.describe("profit tiles", () => {
  test("Today, This week and This month show booking + line-item + upsell commission in UK windows; old, inactive, other people's and removed items stay out", async ({ page }) => {
    const w = await workWorld(page);
    const world = { agency: w.agency, userId: w.agent.id, clientId: "", clientSurname: "" };
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    world.clientId = client.id;
    world.clientSurname = client.surename;

    const now = new Date();
    const todayStart = ukStartOfDay(now);
    const weekStart = ukStartOfWeek(now);
    const monthStart = ukStartOfMonth(now);
    const monthEnd = ukMonthEnd(now);

    // Bookings by their date: today, just before this UK week began, just after this month began, just before it began.
    const A = await seedBooking(page.request, world, { title: "Today booking", packageCommission: 240, transferCommission: 4, createdAt: new Date(todayStart.getTime() + 1 * MIN) });
    const B = await seedBooking(page.request, world, { title: "Last week booking", packageCommission: 150, createdAt: new Date(weekStart.getTime() - 1 * MIN) });
    const C = await seedBooking(page.request, world, { title: "Month start booking", packageCommission: 70, createdAt: new Date(monthStart.getTime() + 1 * MIN) });
    const D = await seedBooking(page.request, world, { title: "Last month booking", packageCommission: 1000, createdAt: new Date(monthStart.getTime() - 1 * MIN) });
    // Left out: an inactive booking of mine, and a colleague's booking today.
    const E = await seedBooking(page.request, world, { title: "Inactive booking", packageCommission: 500, createdAt: new Date(todayStart.getTime() + 2 * MIN) });
    await queryRows(`update booking_table set is_active = false where id = $1`, [E.bookingId]);
    await signIn(page, w.agentB.email);
    const colleagueClient = await apiCreateClient(page.request);
    await seedBooking(page.request, { ...world, userId: w.agentB.id, clientId: colleagueClient.id }, { title: "Colleague booking", packageCommission: 777, createdAt: new Date(todayStart.getTime() + 3 * MIN), clientId: colleagueClient.id });
    await signIn(page, w.agent.email);

    // Upsells count by the day they were ADDED, whatever the booking's date: one on last month's booking added today (counts),
    // one on today's booking added last month (does not), and one added today then removed (does not).
    await seedUpsell(page.request, D.bookingId, { commission: 30, salesPrice: 60, addedAt: new Date(todayStart.getTime() + 2 * MIN) });
    await seedUpsell(page.request, A.bookingId, { commission: 99, addedAt: new Date(monthStart.getTime() - 1 * MIN) });
    const removed = await seedUpsell(page.request, A.bookingId, { commission: 11, addedAt: new Date(todayStart.getTime() + 3 * MIN) });
    expect((await page.request.delete(`/api/v2/upsells/${removed}`)).status()).toBe(200);

    const bookings = [A, B, C, D].map((x, i) => ({ commission: x.commission, at: [new Date(todayStart.getTime() + MIN), new Date(weekStart.getTime() - MIN), new Date(monthStart.getTime() + MIN), new Date(monthStart.getTime() - MIN)][i] }));
    const upsells = [{ commission: 30, at: new Date(todayStart.getTime() + 2 * MIN) }, { commission: 99, at: new Date(monthStart.getTime() - MIN) }];
    const today = expectFor({ from: todayStart }, bookings, upsells);
    const week = expectFor({ from: weekStart }, bookings, upsells);
    const month = expectFor({ from: monthStart, to: monthEnd }, bookings, upsells);
    // Sanity on the seed itself: the windows must be doing work (a test that cannot fail proves nothing).
    expect(today.profit).toBeGreaterThanOrEqual(244 + 30);
    expect(today.profit).toBeLessThan(244 + 30 + 70 + 150 + 1000);
    expect(month.profit).toBeGreaterThanOrEqual(today.profit);
    expect(month.profit).not.toBe(244 + 150 + 70 + 1000 + 30 + 99); // last month's booking and upsell are outside the month

    await openAgentDashboard(page);
    const tile = async (testId: string) => page.getByTestId(testId);
    await expect(await tile("stat-value-todays-profit")).toHaveText(gbp(today.profit));
    await expect(await tile("stat-value-weeks-profit")).toHaveText(gbp(week.profit));
    await expect(await tile("stat-value-this-month")).toHaveText(gbp(month.profit));

    const sub = (n: number, up: number, upSum: number, period: string) =>
      `${n} ${word(n, "Booking", "Bookings")}${up ? ` · ${up} ${word(up, "Upsell", "Upsells")} (incl. ${gbp(upSum)})` : ""} ${period}`;
    await expect(page.getByTestId("stat-box-todays-profit")).toContainText(sub(today.bookings, today.upsells, today.upsellSum, "today"));
    await expect(page.getByTestId("stat-box-weeks-profit")).toContainText(sub(week.bookings, week.upsells, week.upsellSum, "this week"));
    await expect(page.getByTestId("stat-box-this-month")).toContainText(sub(month.bookings, month.upsells, month.upsellSum, "this Month"));
    // The upsell amount is part of the figure, wording "incl.", never "+".
    await expect(page.getByTestId("stat-upsell-amount-todays-profit")).toHaveText(` (incl. ${gbp(30)})`);

    // The server says the same.
    const api = await dataOf<{ todayProfit: number; weekProfit: number; monthProfit: number; todayBookingsCount: number; monthBookingsCount: number }>(await page.request.get("/api/v2/dashboard/agent-stats"));
    expect(Number(api.todayProfit)).toBe(today.profit);
    expect(Number(api.weekProfit)).toBe(week.profit);
    expect(Number(api.monthProfit)).toBe(month.profit);
    expect(api.todayBookingsCount).toBe(today.bookings);
    expect(api.monthBookingsCount).toBe(month.bookings);
  });

  test("with a target set, Target, % to target and Run To Target use this month's profit and the month's profit per booking; without one the tile says so", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    const world = { agency: w.agency, userId: w.agent.id, clientId: client.id, clientSurname: client.surename };
    const now = new Date();
    const monthStart = ukStartOfMonth(now);
    const { year, month } = ukYearMonth(now);

    await openAgentDashboard(page);
    await expect(page.getByTestId("stat-value-target")).toHaveText("£0");
    await expect(page.getByTestId("stat-box-target")).toContainText("No target set");
    // Agents cannot set targets (the owner's rule), so there is no link for them.
    await expect(page.getByTestId("link-set-target")).toHaveCount(0);
    await expect(page.getByTestId("stat-value-run-to-target")).toContainText("£0");

    // Three bookings this month (profit 400 + 300 + 200 = 900), a target of 5,000.
    for (const [i, c] of [400, 300, 200].entries()) {
      await seedBooking(page.request, world, { title: `Month booking ${i}`, packageCommission: c, createdAt: new Date(monthStart.getTime() + (i + 1) * MIN) });
    }
    await queryRows(
      `insert into agent_target_table (branch_id, user_id, year, month, target_amount) values ($1, $2, $3, $4, '5000.00')`,
      [w.agency.branchId, w.agent.id, year, month],
    );
    await page.reload();
    const profit = 900;
    const target = 5000;
    const remaining = target - profit;
    const ppb = Math.round(profit / 3); // 300
    await expect(page.getByTestId("stat-value-this-month")).toHaveText(gbp(profit));
    await expect(page.getByTestId("stat-value-target")).toHaveText(gbp(target));
    await expect(page.getByTestId("stat-box-target")).toContainText(`${100 - Math.round((profit / target) * 100)}% to target`);
    await expect(page.getByTestId("stat-value-run-to-target")).toContainText(`${gbp(remaining)}/ ${gbp(target)}`);
    await expect(page.getByTestId("stat-box-run-to-target")).toContainText(`${Math.ceil(remaining / ppb)} Bookings at ${gbp(ppb)}ppb`);
  });

  test("a brand-new agent sees zero profit and the empty states, not blanks", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    await openAgentDashboard(page);
    for (const id of ["stat-value-todays-profit", "stat-value-weeks-profit", "stat-value-this-month"]) await expect(page.getByTestId(id)).toHaveText("£0");
    await expect(page.getByTestId("stat-box-todays-profit")).toContainText("0 Bookings today");
    await expect(page.getByTestId("stat-upsell-amount-todays-profit")).toHaveCount(0);
    await expect(page.getByTestId("empty-dashboard-tasks")).toHaveText("Nothing due today.");
    await page.getByTestId("button-tasks-filter-overdue").click();
    await expect(page.getByTestId("empty-dashboard-tasks")).toHaveText("Nothing overdue.");
    await page.getByTestId("button-tasks-filter-all").click();
    await expect(page.getByTestId("empty-dashboard-tasks")).toHaveText("No open tasks. Nice.");
    await expect(page.getByText("No deals yet. Add an enquiry to get started.")).toBeVisible();
    await expect(page.getByText("No quote views for this period.")).toBeVisible();
    await page.getByTestId("tab-overview-tickets").click();
    await expect(page.getByTestId("empty-dashboard-tickets")).toHaveText("No open tickets assigned to you.");
  });
});

test.describe("pipeline money matches /pipeline", () => {
  test("the Pipeline card shows each deal's stage profit, Pipeline Live its value or budget, and the /pipeline cards say the same", async ({ page }) => {
    const w = await boardWorld(page);
    const q1 = await quoteDeal(page.request, w, {
      title: "Dash quote one",
      sales_price: "3000.00",
      package_commission: "240.00",
      discounts: "100.00",
      service_charge: "40.00",
      extra: { transfers: [{ pick_up_location: "A", drop_off_location: "B", cost: "40.00", commission: "4.00", is_included_in_package: false }] },
    });
    const q2 = await quoteDeal(page.request, w, { title: "Dash quote two", sales_price: "1500.00", package_commission: "90.00", inPlay: true });
    const enq = await enquiryDeal(page.request, w, "Dash enquiry", { budget: "1800" });
    // Expected from the formulas, by hand: quote one = value 3000 - 100 + 40 = 2940, profit 240 + 4 = 244; quote two = 1500 / 90; enquiry = no profit, budget 1800.
    await page.goto("/agent-overview");
    await expect(page.getByTestId("card-dashboard-pipeline")).toBeVisible();
    const row = (id: string) => page.getByTestId(`row-dashboard-pipeline-${id}`);
    await expect(row(q1.transactionId)).toContainText("Dash quote one");
    await expect(row(q1.transactionId)).toContainText("£244");
    await expect(row(q2.transactionId)).toContainText("£90");
    await expect(row(enq.transactionId)).toContainText("£0");
    await expect(row(q1.transactionId)).not.toContainText("£2,940");

    // Pipeline Live: the quote tab shows value, the enquiry tab shows "Budget".
    await expect(page.getByTestId(`text-pipeline-live-value-${q1.transactionId}`)).toHaveText("£2,940");
    await expect(page.getByTestId(`text-pipeline-live-value-${q2.transactionId}`)).toHaveText("£1,500");
    await page.getByTestId("pipeline-live-tab-enquiry").click();
    await expect(page.getByTestId(`text-pipeline-live-value-${enq.transactionId}`)).toHaveText("Budget £1,800");

    // The /pipeline cards carry the same money.
    await openBoard(page);
    await expect(column(page, "Quoted").getByTestId(`pipeline-card-${q1.transactionId}`)).toContainText("Cost £2,940");
    await expect(column(page, "Quoted").getByTestId(`pipeline-card-${q1.transactionId}`)).toContainText("Profit £244");
    await expect(column(page, "In Play").getByTestId(`pipeline-card-${q2.transactionId}`)).toContainText("Profit £90");
  });
});

test.describe("quote engagement is the viewer's own, by UK day", () => {
  test("only my quotes show, split into Today / Yesterday / This week / All by the last view in UK days, for an agent and for an admin alike", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const world = { agency: w.agency, userId: w.agent.id, clientId: "", clientSurname: "" };
    const mkClient = async () => (await apiCreateClient(page.request)).id;
    const mine = async (title: string) => quoteDeal(page.request, { ...world, clientId: await mkClient() }, { title });
    const today = await mine("Viewed today");
    const yesterday = await mine("Viewed yesterday");
    const older = await mine("Viewed long ago");
    await signIn(page, w.agentB.email);
    const theirs = await quoteDeal(page.request, { ...world, userId: w.agentB.id, clientId: await mkClient() }, { title: "Colleague quote viewed today" });
    await signIn(page, w.admin.email);
    const adminOwn = await quoteDeal(page.request, { ...world, userId: w.admin.id, clientId: await mkClient() }, { title: "Admin own quote viewed today" });

    const now = new Date();
    const todayStart = ukStartOfDay(now);
    const weekStart = ukStartOfWeek(now);
    const view = async (quoteId: string, at: Date, n = 1) => {
      for (let i = 0; i < n; i++) {
        await queryRows(`insert into quote_views (id, quote_id, viewed_at, viewer_name) values ($1, $2, $3::timestamptz, 'Client')`, [randomUUID(), quoteId, new Date(at.getTime() - i * MIN).toISOString()]);
      }
    };
    await view(today.entityId, new Date(todayStart.getTime() + 5 * MIN), 2);
    await view(yesterday.entityId, new Date(todayStart.getTime() - 30 * MIN)); // 23:30 UK yesterday
    await view(older.entityId, new Date(weekStart.getTime() - 3 * 24 * 60 * MIN));
    await view(theirs.entityId, new Date(todayStart.getTime() + 5 * MIN));
    await view(adminOwn.entityId, new Date(todayStart.getTime() + 5 * MIN));

    const rows = (page: import("@playwright/test").Page) => page.locator('[data-testid^="engagement-row-"]');
    const idsOf = async (page: import("@playwright/test").Page) => (await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("engagement-row-", "")))).sort();

    await signIn(page, w.agent.email);
    await openAgentDashboard(page);
    await expect(page.getByTestId(`engagement-row-${today.entityId}`)).toBeVisible();
    await expect(page.getByTestId(`engagement-count-${today.entityId}`)).toContainText("2 views");
    expect(await idsOf(page)).toEqual([today.entityId]);

    await page.getByTestId("engagement-filter-yesterday").click();
    await expect(page.getByTestId(`engagement-row-${yesterday.entityId}`)).toBeVisible();
    expect(await idsOf(page)).toEqual([yesterday.entityId]);

    await page.getByTestId("engagement-filter-week").click();
    const inWeek = [today.entityId, ...(todayStart.getTime() - 30 * MIN >= weekStart.getTime() ? [yesterday.entityId] : [])].sort();
    await expect.poll(() => idsOf(page)).toEqual(inWeek);

    await page.getByTestId("engagement-filter-all").click();
    await expect.poll(() => idsOf(page)).toEqual([today.entityId, yesterday.entityId, older.entityId].sort());
    // Never the colleague's or the admin's quotes.
    await expect(page.getByTestId(`engagement-row-${theirs.entityId}`)).toHaveCount(0);
    await expect(page.getByTestId(`engagement-row-${adminOwn.entityId}`)).toHaveCount(0);

    // The admin's personal dashboard shows only the admin's own quote, not the whole agency's.
    await signIn(page, w.admin.email);
    await openAgentDashboard(page);
    await expect(page.getByTestId(`engagement-row-${adminOwn.entityId}`)).toBeVisible();
    expect(await idsOf(page)).toEqual([adminOwn.entityId]);
  });
});

test.describe("daily goals clear each UK day", () => {
  test("goals added today stay for today; an earlier day's goals are not shown and are cleaned up; goals are per person", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    // The goals are stored under the UK day the page loads on, so read that day before loading, not after.
    const today = londonDayKey(new Date());
    const yesterday = addDaysToKey(today, -1);
    await openAgentDashboard(page);
    await page.getByTestId("tab-overview-notes").click();
    await expect(page.getByTestId("empty-daily-goals")).toBeVisible();
    await expect(page.getByTestId("text-daily-goals-progress")).toHaveText("None yet");

    await page.getByTestId("input-add-daily-goal").fill("Chase three quotes");
    await page.getByTestId("button-add-daily-goal").click();
    await expect(page.getByTestId("text-daily-goals-progress")).toHaveText("0 of 1 done");
    const goalText = page.locator('[data-testid^="text-daily-goal-"]');
    await expect(goalText).toHaveText(["Chase three quotes"]);
    await goalText.first().locator("xpath=..").getByRole("button", { name: "Mark goal done" }).click();
    await expect(page.getByTestId("text-daily-goals-progress")).toHaveText("1 of 1 done");

    // Plant a goal from an earlier UK day and someone else's goal for today, then reload.
    const stale = JSON.stringify([{ id: "old-1", text: "Yesterday's goal", completed: false, createdAt: new Date().toISOString() }]);
    const others = JSON.stringify([{ id: "other-1", text: "Bea's goal", completed: false, createdAt: new Date().toISOString() }]);
    await page.evaluate(
      ([uid, staleKey, staleVal, otherKey, otherVal]) => {
        localStorage.setItem(staleKey, staleVal);
        localStorage.setItem(otherKey, otherVal);
        void uid;
      },
      [w.agent.id, `daily-goals-${w.agent.id}-${yesterday}`, stale, `daily-goals-${w.agentB.id}-${today}`, others] as const,
    );
    await page.reload();
    await page.getByTestId("tab-overview-notes").click();
    await expect(goalText).toHaveText(["Chase three quotes"]); // today's goal is still here and done
    await expect(page.getByTestId("text-daily-goals-progress")).toHaveText("1 of 1 done");
    await expect(page.getByText("Yesterday's goal")).toHaveCount(0);
    await expect(page.getByText("Bea's goal")).toHaveCount(0);
    // The earlier day's key was removed; the other person's key is left alone.
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("daily-goals-")));
    expect(keys).toContain(`daily-goals-${w.agent.id}-${today}`);
    expect(keys).toContain(`daily-goals-${w.agentB.id}-${today}`);
    expect(keys).not.toContain(`daily-goals-${w.agent.id}-${yesterday}`);
  });

  test("when UK midnight passes with the page open, the goals list resets to the new day", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    // Start the page's clock five minutes before the next UK midnight.
    const nextMidnight = ukAddDays(ukStartOfDay(new Date()), 1);
    await page.clock.install({ time: new Date(nextMidnight.getTime() - 5 * MIN) });
    await openAgentDashboardNoWait(page);
    await page.getByTestId("tab-overview-notes").click();
    await page.getByTestId("input-add-daily-goal").fill("Before midnight");
    await page.getByTestId("button-add-daily-goal").click();
    await expect(page.getByTestId("text-daily-goals-progress")).toHaveText("0 of 1 done");

    await page.clock.runFor(6 * MIN); // past UK midnight; the page polls the London day every 30 seconds
    await expect(page.getByTestId("empty-daily-goals")).toBeVisible();
    await expect(page.getByTestId("text-daily-goals-progress")).toHaveText("None yet");
    await expect(page.getByText("Before midnight")).toHaveCount(0);
  });
});

async function openAgentDashboardNoWait(page: import("@playwright/test").Page) {
  await page.goto("/agent-overview");
  await expect(page.getByTestId("card-agent-dashboard")).toBeVisible();
}

test.describe("the Tickets tab", () => {
  test("the add button reads New Ticket on the Tickets tab and New Task elsewhere, and the tab lists the newest open tickets assigned to me", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agentB.email);
    const mk = (subject: string, extra: Record<string, unknown> = {}) => apiCreateTicket(page.request, { subject, type: "Build", assignedTo: w.agent.id, ...extra });
    const older = await mk(ticketSubject("Older open"));
    const newer = await mk(ticketSubject("Newer progress"), { status: "In Progress" });
    const closed = await mk(ticketSubject("Already resolved"), { status: "Resolved" });
    const notMine = await apiCreateTicket(page.request, { subject: ticketSubject("For someone else"), type: "Build", assignedTo: w.agentB.id });
    await queryRows(`update tickets set created_at = $2 where id = $1`, [older.id, new Date(Date.now() - 86_400_000).toISOString()]);

    await signIn(page, w.agent.email);
    await openAgentDashboard(page);
    const add = page.getByTestId("button-dashboard-add");
    await expect(add).toHaveText("+ New Task");
    await page.getByTestId("tab-overview-tickets").click();
    await expect(add).toHaveText("+ New Ticket");
    await expect(add).toHaveAttribute("aria-label", "New ticket");

    // Newest first; only open and in-progress tickets assigned to me.
    const rows = page.locator('[data-testid^="row-dashboard-ticket-"]');
    await expect(rows).toHaveCount(2);
    const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("row-dashboard-ticket-", "")));
    expect(ids).toEqual([newer.id, older.id]);
    await expect(page.getByTestId(`row-dashboard-ticket-${closed.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`row-dashboard-ticket-${notMine.id}`)).toHaveCount(0);

    // The button opens the New ticket dialog (not the task modal).
    await add.click();
    await expect(page.getByTestId("create-ticket-dialog")).toBeVisible();
    await expect(page.getByTestId("dashboard-new-task-modal")).toHaveCount(0);
    await page.getByTestId("button-cancel-ticket").click();

    // Back on another tab it is New Task again and opens the task modal.
    await page.getByTestId("tab-overview-tasks").click();
    await expect(add).toHaveText("+ New Task");
    await add.click();
    await expect(page.getByTestId("dashboard-new-task-modal")).toBeVisible();
    await expect(page.getByTestId("create-ticket-dialog")).toHaveCount(0);
  });
});
