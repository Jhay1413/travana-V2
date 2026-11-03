import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { boardWorld, bookedDeal, card, cardIn, column, enquiryDeal, markLost, openBoard, parkFuture, quoteDeal, type BoardWorld } from "../helpers/pipeline";
import { apiCreateClient, signIn } from "../helpers/deals";
import { linkTourOperator, queryRows, seedMember, seedQuoteTask } from "../helpers/seed";

/** Types in the search box and waits for the board to have re-asked the server with that term. */
async function search(page: Page, term: string): Promise<void> {
  const asked = page.waitForResponse((r) => r.url().includes("/transactions/pipeline/quote?") && r.url().includes(`search=${encodeURIComponent(term)}`));
  await page.getByTestId("input-pipeline-search").fill(term);
  expect((await asked).status()).toBe(200);
  await expect(page.locator('[data-testid^="pipeline-column-"] .animate-spin')).toHaveCount(0);
}

/** Empties the box. The unfiltered columns are already cached, so no request is made: callers check for a card to know it settled. */
async function clearSearch(page: Page): Promise<void> {
  await page.getByTestId("input-pipeline-search").fill("");
  await expect(page.getByTestId("input-pipeline-search")).toHaveValue("");
}

async function setPriority(page: Page, transactionId: string, priority: "low" | "medium" | "high") {
  const res = await page.request.patch(`/api/v2/transactions/${transactionId}/priority`, { data: { priority } });
  expect(res.status(), await res.text()).toBe(200);
}

test.describe("search", () => {
  test("finds a deal by title, client name, client phone and booking ref; each search has a control showing the other deals", async ({ page }) => {
    const w = await boardWorld(page);
    const other = await apiCreateClient(page.request, { firstName: "Zed", surename: "Zebrowski", phoneNumber: "07700900999" });
    const a = await quoteDeal(page.request, w, { title: "Alpha Algarve" });
    const b = await quoteDeal(page.request, w, { title: "Bravo Benidorm" }, other.id);
    const booked = await bookedDeal(page.request, w, { title: "Charlie Crete" });
    const enq = await enquiryDeal(page.request, w, "Delta Dubai");
    await openBoard(page);
    for (const d of [a, b]) await expect(cardIn(page, "Quoted", d.transactionId)).toBeVisible(); // control: everything shows with no search
    await expect(cardIn(page, "Booked", booked.transactionId)).toBeVisible();

    await search(page, "algarve"); // title, any case
    await expect(cardIn(page, "Quoted", a.transactionId)).toBeVisible();
    for (const d of [b, booked, enq]) await expect(card(page, d.transactionId)).toHaveCount(0);

    await clearSearch(page);
    await expect(cardIn(page, "Quoted", b.transactionId)).toBeVisible(); // settled: the unfiltered list is back
    await expect(cardIn(page, "Quoted", a.transactionId)).toBeVisible();
    await search(page, "Zebrowski"); // client surname
    await expect(cardIn(page, "Quoted", b.transactionId)).toBeVisible();
    for (const d of [a, booked, enq]) await expect(card(page, d.transactionId)).toHaveCount(0);

    await clearSearch(page);
    await expect(cardIn(page, "Quoted", a.transactionId)).toBeVisible();
    await search(page, "07700900999"); // client phone
    await expect(cardIn(page, "Quoted", b.transactionId)).toBeVisible();
    await expect(card(page, a.transactionId)).toHaveCount(0);

    await clearSearch(page);
    await expect(cardIn(page, "Quoted", a.transactionId)).toBeVisible();
    await search(page, "HAY-1234567"); // booking ref
    await expect(cardIn(page, "Booked", booked.transactionId)).toBeVisible();
    await expect(card(page, a.transactionId)).toHaveCount(0);

    await clearSearch(page);
    await expect(cardIn(page, "Quoted", a.transactionId)).toBeVisible();
    await search(page, "Delta"); // an enquiry's title
    await expect(cardIn(page, "Enquiry", enq.transactionId)).toBeVisible();
    await expect(card(page, a.transactionId)).toHaveCount(0);
  });

  test("a search with no match empties all six columns and the chip count; % is matched literally, not as a wildcard", async ({ page }) => {
    const w = await boardWorld(page);
    const plain = await quoteDeal(page.request, w, { title: "Plain title" });
    const pct = await quoteDeal(page.request, w, { title: "50% off" });
    const enq = await enquiryDeal(page.request, w, "Plain enquiry");
    const inPlay = await quoteDeal(page.request, w, { title: "Plain in play", inPlay: true });
    const booked = await bookedDeal(page.request, w, { title: "Plain booked" });
    const future = await enquiryDeal(page.request, w, "Plain future");
    await parkFuture(page.request, future.transactionId);
    const lost = await quoteDeal(page.request, w, { title: "Plain lost" });
    await markLost(page.request, lost.transactionId);
    await openBoard(page);
    await page.getByTestId("button-expand-future").click();
    await page.getByTestId("button-expand-lost").click();
    const all = [plain, pct, enq, inPlay, booked, future, lost];
    for (const d of all) await expect(card(page, d.transactionId)).toHaveCount(1); // control: every column has its deal
    await expect(page.getByTestId("chip-quick-all")).toHaveText("All deals 4"); // enquiry, 2 quoted, in-play

    await search(page, "nothing-like-this");
    for (const stage of ["Enquiry", "Quoted", "In Play", "Booked", "Future", "Lost"] as const) {
      await expect(column(page, stage).locator('[data-testid^="pipeline-card-"]'), `${stage} is empty`).toHaveCount(0);
    }
    await expect(card(page, plain.transactionId)).toHaveCount(0);
    await expect(column(page, "Quoted")).toContainText("No deals here");
    await expect(page.getByTestId("chip-quick-all")).toHaveText("All deals 0");

    await clearSearch(page);
    await expect(cardIn(page, "Quoted", plain.transactionId)).toBeVisible(); // control
    await search(page, "%"); // would match everything if it were a wildcard
    await expect(cardIn(page, "Quoted", pct.transactionId)).toBeVisible(); // the one title that contains a percent sign
    for (const d of all.filter((d) => d !== pct)) await expect(card(page, d.transactionId)).toHaveCount(0);
    await expect(page.getByTestId("chip-quick-all")).toHaveText("All deals 1");
  });

  test("search and priority filters are page state: a reload clears them, a collapsed column stays collapsed", async ({ page }) => {
    const w = await boardWorld(page);
    const a = await quoteDeal(page.request, w, { title: "Findable" });
    await quoteDeal(page.request, w, { title: "Other" });
    await openBoard(page);
    await search(page, "Findable");
    await page.getByTestId("button-pipeline-filters").click();
    await page.getByTestId("chip-priority-high").click();
    await expect(page.getByTestId("button-pipeline-filters")).toContainText("Filters 1");
    await page.keyboard.press("Escape");
    await page.getByTestId("button-collapse-enquiry").click(); // layout is remembered, unlike the filters
    await expect(page.getByTestId("pipeline-column-enquiry-collapsed")).toBeVisible();

    await openBoard(page);
    await expect(page.getByTestId("pipeline-column-enquiry-collapsed")).toBeVisible();
    await expect(column(page, "Enquiry")).toHaveCount(0);
    await expect(page.getByTestId("input-pipeline-search")).toHaveValue("");
    await expect(page.getByTestId("button-pipeline-filters")).toHaveText("Filters");
    await expect(cardIn(page, "Quoted", a.transactionId)).toBeVisible();
    await expect(column(page, "Quoted").locator('[data-testid^="pipeline-card-"]')).toHaveCount(2);
  });
});

test.describe("priority and operator filters", () => {
  async function priorityWorld(page: Page) {
    const w = await boardWorld(page);
    const high = await quoteDeal(page.request, w, { title: "High one" });
    const med = await enquiryDeal(page.request, w, "Medium one");
    const low = await quoteDeal(page.request, w, { title: "Low one" });
    await setPriority(page, high.transactionId, "high");
    await setPriority(page, med.transactionId, "medium");
    return { w, high, med, low };
  }

  test("each priority chip shows only deals of that priority; chips combine; Clear filters resets", async ({ page }) => {
    const { high, med, low } = await priorityWorld(page);
    await openBoard(page);
    await expect(card(page, high.transactionId)).toHaveCount(1); // control
    await expect(card(page, low.transactionId)).toHaveCount(1);

    await page.getByTestId("button-pipeline-filters").click();
    await page.getByTestId("chip-priority-high").click();
    await expect(card(page, low.transactionId)).toHaveCount(0);
    await expect(card(page, med.transactionId)).toHaveCount(0);
    await expect(cardIn(page, "Quoted", high.transactionId)).toBeVisible();
    await expect(page.getByTestId("button-pipeline-filters")).toContainText("Filters 1");

    await page.getByTestId("chip-priority-medium").click(); // high OR medium
    await expect(cardIn(page, "Enquiry", med.transactionId)).toBeVisible();
    await expect(card(page, low.transactionId)).toHaveCount(0);

    await page.getByTestId("button-clear-filters").click();
    await expect(card(page, low.transactionId)).toHaveCount(1);
    await expect(page.getByTestId("button-pipeline-filters")).toHaveText("Filters");
  });

  test("a deal with no priority set counts as low", async ({ page }) => {
    const { low, high } = await priorityWorld(page);
    await queryRows(`update transaction set priority = null where id = $1`, [low.transactionId]);
    await openBoard(page);
    await page.getByTestId("button-pipeline-filters").click();
    await page.getByTestId("chip-priority-low").click();
    await expect(cardIn(page, "Quoted", low.transactionId)).toBeVisible();
    await expect(card(page, high.transactionId)).toHaveCount(0);
  });

  test("changing a card's priority while a priority filter is on takes it out of the filtered list", async ({ page }) => {
    const { high, low } = await priorityWorld(page);
    await openBoard(page);
    await page.getByTestId("button-pipeline-filters").click();
    await page.getByTestId("chip-priority-high").click();
    await page.keyboard.press("Escape");
    await expect(cardIn(page, "Quoted", high.transactionId)).toBeVisible();
    await expect(card(page, low.transactionId)).toHaveCount(0);

    await card(page, high.transactionId).getByTestId("button-deal-priority").click();
    await page.getByTestId("menu-priority-low").click();
    await expect(card(page, high.transactionId)).toHaveCount(0);
    await expect.poll(async () => (await queryRows<{ priority: string }>(`select priority from transaction where id = $1`, [high.transactionId]))[0].priority).toBe("low");
  });

  test("the tour-operator filter shows only deals whose main quote or booking uses that operator", async ({ page }) => {
    const w = await boardWorld(page);
    await linkTourOperator(w.agency.orgId, w.agency.ref.unlinkedOperator);
    const sun = await quoteDeal(page.request, w, { title: "With Sun" });
    const other = await quoteDeal(page.request, w, { title: "With Unlinked", main_tour_operator_id: w.agency.ref.unlinkedOperator });
    const bookedOther = await bookedDeal(page.request, w, { title: "Booked Unlinked", main_tour_operator_id: w.agency.ref.unlinkedOperator });
    await openBoard(page);
    await expect(card(page, sun.transactionId)).toHaveCount(1); // control

    await page.getByTestId("button-pipeline-filters").click();
    await page.getByTestId(`chip-operator-${w.agency.ref.unlinkedOperator}`).click();
    await expect(cardIn(page, "Quoted", other.transactionId)).toBeVisible();
    await expect(cardIn(page, "Booked", bookedOther.transactionId)).toBeVisible();
    await expect(card(page, sun.transactionId)).toHaveCount(0);
    await expect(page.getByTestId("button-pipeline-filters")).toContainText("Filters 1");
  });
});

test.describe("quick chips", () => {
  async function quickWorld(page: Page) {
    const w = await boardWorld(page);
    const withTask = await quoteDeal(page.request, w, { title: "Has a task" });
    const noTask = await quoteDeal(page.request, w, { title: "No task here" });
    const quiet = await quoteDeal(page.request, w, { title: "Gone quiet" });
    const booked = await bookedDeal(page.request, w, { title: "Booked deal" });
    await seedQuoteTask({ userId: w.userId, orgId: w.agency.orgId, branchId: w.agency.branchId, quoteId: withTask.entityId });
    // Make "quiet" deal's whole activity ten days old, while its expiry still keeps it on the board.
    await queryRows(`update transaction set created_at = now() - interval '10 days' where id = $1`, [quiet.transactionId]);
    await queryRows(`update quote_table set date_created = now() - interval '10 days', date_expiry = now() + interval '3 days' where id = $1`, [quiet.entityId]);
    return { w, withTask, noTask, quiet, booked };
  }

  test("No task scheduled and Quiet 7+ days narrow the open columns, with counts that match; All deals resets", async ({ page }) => {
    const { withTask, noTask, quiet } = await quickWorld(page);
    await openBoard(page);
    await expect(page.getByTestId("chip-quick-all")).toHaveText("All deals 3");
    await expect(page.getByTestId("chip-quick-no_task")).toHaveText("No task scheduled 2");
    await expect(page.getByTestId("chip-quick-quiet_7")).toHaveText("Quiet 7+ days 1");

    await page.getByTestId("chip-quick-no_task").click();
    await expect(card(page, withTask.transactionId)).toHaveCount(0);
    await expect(cardIn(page, "Quoted", noTask.transactionId)).toBeVisible();
    await expect(cardIn(page, "Quoted", quiet.transactionId)).toBeVisible();

    await page.getByTestId("chip-quick-quiet_7").click();
    await expect(cardIn(page, "Quoted", quiet.transactionId)).toBeVisible();
    await expect(card(page, noTask.transactionId)).toHaveCount(0);
    await expect(cardIn(page, "Quoted", quiet.transactionId)).toContainText("10 days quiet");

    await page.getByTestId("chip-quick-all").click();
    await expect(cardIn(page, "Quoted", withTask.transactionId)).toBeVisible();
    await expect(cardIn(page, "Quoted", noTask.transactionId)).toBeVisible();
  });

  test("while a chip is active the Booked, Future and Lost columns are not queried and read as empty", async ({ page }) => {
    const { booked, noTask } = await quickWorld(page);
    await openBoard(page);
    await expect(cardIn(page, "Booked", booked.transactionId)).toBeVisible(); // control
    const asked: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/v2/transactions/pipeline/")) asked.push(new URL(r.url()).pathname);
    });
    await page.getByTestId("chip-quick-no_task").click();
    await expect(cardIn(page, "Quoted", noTask.transactionId)).toBeVisible();
    // The open columns were asked again (so the recording works), the other three were not.
    expect(asked.some((p) => p.endsWith("/pipeline/quote"))).toBe(true);
    expect(asked.filter((p) => /\/pipeline\/(booking|future|lost)$/.test(p))).toEqual([]);
    await expect(card(page, booked.transactionId)).toHaveCount(0);
    await expect(column(page, "Booked")).toContainText("Bookings you win will appear here");
    await page.getByTestId("chip-quick-all").click();
    await expect(cardIn(page, "Booked", booked.transactionId)).toBeVisible();
  });

  test("the chip counts follow the search box", async ({ page }) => {
    await quickWorld(page);
    await openBoard(page);
    const counted = page.waitForResponse((r) => r.url().includes("/pipeline-counts") && r.url().includes("search=Gone"));
    await page.getByTestId("input-pipeline-search").fill("Gone");
    await counted;
    await expect(page.getByTestId("chip-quick-all")).toHaveText("All deals 1");
    await expect(page.getByTestId("chip-quick-quiet_7")).toHaveText("Quiet 7+ days 1");
    await expect(page.getByTestId("chip-quick-no_task")).toHaveText("No task scheduled 1");
  });
});

test.describe("owner scope and sort", () => {
  async function twoAgentWorld(page: Page) {
    const w = await boardWorld(page);
    const mine = await quoteDeal(page.request, w, { title: "Mine" });
    const colleague = await seedMember({ orgId: w.agency.orgId, branchId: w.agency.branchId, orgRole: "agent", firstName: "Colin", lastName: "Colleague" });
    // The colleague's deal is created by the colleague (so the deal's agent and branch are theirs).
    const other = await signIn(page, colleague.email);
    const theirs = await quoteDeal(page.request, { ...w, userId: other }, { title: "Theirs" });
    await signIn(page, w.agency.agentEmail);
    return { w, mine, theirs, colleagueId: colleague.id };
  }

  test("My Deals shows only my deals; All Deals + All Agents shows the branch; the agent picker narrows to one colleague", async ({ page }) => {
    const { mine, theirs } = await twoAgentWorld(page);
    await openBoard(page);
    await expect(cardIn(page, "Quoted", mine.transactionId)).toBeVisible();
    await expect(card(page, theirs.transactionId)).toHaveCount(0);

    await page.getByTestId("pipeline-deals-tab-all").click();
    await expect(cardIn(page, "Quoted", theirs.transactionId)).toBeVisible();
    await expect(cardIn(page, "Quoted", mine.transactionId)).toBeVisible();
    await expect(page.getByTestId("select-agent-filter")).toBeVisible();

    await page.getByTestId("select-agent-filter").click();
    await page.getByRole("option", { name: /Colin Colleague/ }).click();
    await expect(cardIn(page, "Quoted", theirs.transactionId)).toBeVisible();
    await expect(card(page, mine.transactionId)).toHaveCount(0);

    await page.getByTestId("pipeline-deals-tab-mine").click(); // back to me
    await expect(cardIn(page, "Quoted", mine.transactionId)).toBeVisible();
    await expect(card(page, theirs.transactionId)).toHaveCount(0);
    await expect(page.getByTestId("select-agent-filter")).toHaveCount(0); // the picker only exists on All Deals
  });

  test("sorting: value high to low and deal name order the column", async ({ page }) => {
    const w = await boardWorld(page);
    // Created in the order Mike, Zulu, Alpha: neither name order (A, M, Z) nor value order (Zulu, Alpha, Mike) equals
    // creation order or its reverse, so a sort that did nothing could not pass.
    await quoteDeal(page.request, w, { title: "Mike small", sales_price: "500" });
    await quoteDeal(page.request, w, { title: "Zulu big", sales_price: "9000" });
    await quoteDeal(page.request, w, { title: "Alpha mid", sales_price: "2000" });
    await openBoard(page);
    const order = () => column(page, "Quoted").locator('[data-testid^="pipeline-title-"]').allTextContents();
    const initial = await order();
    expect([...initial].sort()).toEqual(["Alpha mid", "Mike small", "Zulu big"]);
    expect(initial).not.toEqual(["Zulu big", "Alpha mid", "Mike small"]);
    expect(initial).not.toEqual(["Alpha mid", "Mike small", "Zulu big"]);

    await page.getByTestId("select-pipeline-sort").click();
    await page.getByRole("option", { name: "Value, high to low" }).click();
    await expect.poll(order).toEqual(["Zulu big", "Alpha mid", "Mike small"]);

    await page.getByTestId("select-pipeline-sort").click();
    await page.getByRole("option", { name: "Deal name" }).click();
    await expect.poll(order).toEqual(["Alpha mid", "Mike small", "Zulu big"]);
  });
});

test.describe("other columns respect the filters", () => {
  test("a search narrows Future and Lost too", async ({ page }) => {
    const w: BoardWorld = await boardWorld(page);
    const f1 = await enquiryDeal(page.request, w, "Future needle");
    const f2 = await enquiryDeal(page.request, w, "Future hay");
    await parkFuture(page.request, f1.transactionId);
    await parkFuture(page.request, f2.transactionId);
    const l1 = await quoteDeal(page.request, w, { title: "Lost needle" });
    const l2 = await quoteDeal(page.request, w, { title: "Lost hay" });
    await markLost(page.request, l1.transactionId);
    await markLost(page.request, l2.transactionId);
    await openBoard(page);
    await page.getByTestId("button-expand-future").click();
    await page.getByTestId("button-expand-lost").click();
    for (const d of [f1, f2, l1, l2]) await expect(card(page, d.transactionId)).toHaveCount(1); // control

    // The search request is sent to every column; wait for the Lost one.
    const lostAsked = page.waitForResponse((r) => r.url().includes("/pipeline/lost?") && r.url().includes("search=needle"));
    await page.getByTestId("input-pipeline-search").fill("needle");
    await lostAsked;
    await expect(cardIn(page, "Future", f1.transactionId)).toBeVisible();
    await expect(cardIn(page, "Lost", l1.transactionId)).toBeVisible();
    await expect(card(page, f2.transactionId)).toHaveCount(0);
    await expect(card(page, l2.transactionId)).toHaveCount(0);
  });
});

