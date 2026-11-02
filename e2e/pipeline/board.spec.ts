import { apiAddQuote } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { queryRows } from "../helpers/seed";
import {
  bookedDeal,
  boardWorld,
  card,
  cardIn,
  column,
  columnTestId,
  enquiryDeal,
  markLost,
  openBoard,
  parkFuture,
  quoteDeal,
  type Stage,
} from "../helpers/pipeline";

const STAGES: Stage[] = ["Enquiry", "Quoted", "In Play", "Booked", "Future", "Lost"];

/** Future and Lost start collapsed to a rail; the rail's testid says which. */
async function expandRail(page: import("@playwright/test").Page, stage: "Future" | "Lost") {
  await page.getByTestId(`button-expand-${stage.toLowerCase()}`).click();
  await expect(column(page, stage)).toBeVisible();
}

/** The card shows the money the code computes: value = sales - discounts + service charge, profit = package + line-item commission. */
async function expectedMoney(transactionId: string): Promise<{ value: number; profit: number }> {
  const [row] = await queryRows<{ value: string; profit: string }>(
    `select coalesce(sum(coalesce(q.sales_price,0) - coalesce(q.discounts,0) + coalesce(q.service_charge,0)),0) as value,
            coalesce(sum(coalesce(q.package_commission,0)
              + coalesce((select sum(coalesce(commission,0)) from quote_transfers t where t.quote_id = q.id),0)
              + coalesce((select sum(coalesce(commission,0)) from quote_accomodation a where a.quote_id = q.id),0)
              + coalesce((select sum(coalesce(commission,0)) from quote_flights f where f.quote_id = q.id),0)),0) as profit
       from quote_table q
      where q.transaction_id = $1 and q."isQuoteCopy" is not true and q."isFreeQuote" is not true and q.deleted_at is null`,
    [transactionId],
  );
  return { value: Number(row.value), profit: Number(row.profit) };
}

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

test.describe("board loading", () => {
  test("every column shows exactly its own deals, and no other column shows them", async ({ page }) => {
    const w = await boardWorld(page);
    const enq = await enquiryDeal(page.request, w);
    const quoted = await quoteDeal(page.request, w);
    const inPlay = await quoteDeal(page.request, w, { inPlay: true });
    const booked = await bookedDeal(page.request, w);
    const future = await enquiryDeal(page.request, w);
    await parkFuture(page.request, future.transactionId);
    const lost = await quoteDeal(page.request, w);
    await markLost(page.request, lost.transactionId);

    await openBoard(page);
    await expandRail(page, "Future");
    await expandRail(page, "Lost");

    const expected: Record<Stage, string> = {
      Enquiry: enq.transactionId,
      Quoted: quoted.transactionId,
      "In Play": inPlay.transactionId,
      Booked: booked.transactionId,
      Future: future.transactionId,
      Lost: lost.transactionId,
    };
    for (const stage of STAGES) {
      await expect(cardIn(page, stage, expected[stage]), `${stage} has its deal`).toBeVisible();
      await expect(column(page, stage).locator('[data-testid^="pipeline-card-"]'), `${stage} has only one card`).toHaveCount(1);
    }
    // Page-wide: each card exists exactly once.
    for (const id of Object.values(expected)) await expect(card(page, id)).toHaveCount(1);
  });

  test("the page subline counts only the open columns (enquiry, quoted, in-play) and their money", async ({ page }) => {
    const w = await boardWorld(page);
    await enquiryDeal(page.request, w);
    const q = await quoteDeal(page.request, w, { sales_price: "3000", package_commission: "300" });
    const p = await quoteDeal(page.request, w, { sales_price: "2000", package_commission: "200", inPlay: true });
    await bookedDeal(page.request, w, { sales_price: "9000", package_commission: "900" }); // booked: must not count
    await openBoard(page);

    const qm = await expectedMoney(q.transactionId);
    const pm = await expectedMoney(p.transactionId);
    await expect(page.getByTestId("pipeline-subline")).toContainText(
      `3 open deals · ${gbp(qm.value + pm.value)} value · ${gbp(qm.profit + pm.profit)} expected profit`,
    );
  });

  test("a quote card shows title, destination, date, nights, client, phone and the money the code's own formula gives", async ({ page }) => {
    const w = await boardWorld(page);
    const r = w.agency.ref;
    const deal = await quoteDeal(page.request, w, {
      sales_price: "3000.00",
      discounts: "100.00",
      service_charge: "40.00",
      package_commission: "240.00",
      travel_date: "2027-06-14",
      num_of_nights: 10,
      extra: {
        primaryAccommodation: { accomodation_id: r.accommodation, board_basis_id: r.boardBasis, no_of_nights: 10, check_in_date_time: "2027-06-14T15:00:00" },
        transfers: [{ pick_up_location: "A", drop_off_location: "B", cost: "40.00", commission: "4.00", is_included_in_package: false }],
      },
    });
    await openBoard(page);
    const money = await expectedMoney(deal.transactionId);
    expect(money).toEqual({ value: 2940, profit: 244 }); // 3000 - 100 + 40, and 240 + the 4 line-item commission
    expect(gbp(money.value)).toBe("£2,940");
    expect(gbp(money.profit)).toBe("£244");

    const c = cardIn(page, "Quoted", deal.transactionId);
    await expect(page.getByTestId(`pipeline-title-${deal.transactionId}`)).toHaveText(deal.title);
    await expect(c).toContainText("Majorca · 14 Jun 2027 · 10 nights");
    await expect(c).toContainText(w.clientSurname);
    await expect(c).toContainText("07700900111");
    await expect(c).toContainText("ESH"); // the operator tile shows the initials of "E2E Sun Holidays"
    await expect(c).toContainText(`Cost ${gbp(money.value)}`);
    await expect(c).toContainText(`Profit ${gbp(money.profit)}`);
    await expect(c).toContainText("No task scheduled"); // the shared next-task row for a deal with no task
  });

  test("the column header totals equal the server sums for the deals in that column", async ({ page }) => {
    const w = await boardWorld(page);
    const a = await quoteDeal(page.request, w, { sales_price: "1000", package_commission: "100" });
    const b = await quoteDeal(page.request, w, { sales_price: "2500", discounts: "50", service_charge: "10", package_commission: "260" });
    await openBoard(page);
    const ma = await expectedMoney(a.transactionId);
    const mb = await expectedMoney(b.transactionId);
    await expect(page.getByTestId("column-totals-quoted")).toHaveText(
      new RegExp(`${gbp(ma.value + mb.value)}\\s*value\\s*·\\s*${gbp(ma.profit + mb.profit)}\\s*profit`),
    );
    await expect(column(page, "Quoted").getByRole("heading", { name: "Quotes" })).toBeVisible();
  });

  test("a quote with no price shows Cost TBC; an enquiry shows its destination and date and 'No quote yet' with an Add quote link", async ({ page }) => {
    const w = await boardWorld(page);
    const free = await quoteDeal(page.request, w, { sales_price: "0", package_commission: "0" });
    const enq = await enquiryDeal(page.request, w, undefined, { budget: "1800", travel_date: "2027-07-01", no_of_nights: 7, destinations: [w.agency.ref.destination] });
    await openBoard(page);
    await expect(cardIn(page, "Quoted", free.transactionId)).toContainText("Cost TBC");
    const e = cardIn(page, "Enquiry", enq.transactionId);
    await expect(e).toContainText("Majorca · 1 Jul 2027");
    await expect(e).toContainText("No quote yet");
    await expect(page.getByTestId(`button-add-quote-${enq.transactionId}`)).toBeVisible();
  });

  test("an enquiry card shows its nights and budget", async ({ page }) => {
    const w = await boardWorld(page);
    const enq = await enquiryDeal(page.request, w, undefined, { budget: "1800", travel_date: "2027-07-01", no_of_nights: 7, destinations: [w.agency.ref.destination] });
    await openBoard(page);
    const c = cardIn(page, "Enquiry", enq.transactionId);
    await expect(c).toContainText("Majorca · 1 Jul 2027 · 7 nights · Budget £1,800");
  });

  test("a deal with several quotes counts only its main quote's money, and shows a +N pill for the copies", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w, { sales_price: "2000", package_commission: "200" });
    await apiAddQuote(page.request, w.agency, deal.transactionId, { title: "Copy A", sales_price: "2100", package_commission: "210" });
    await apiAddQuote(page.request, w.agency, deal.transactionId, { title: "Copy B", sales_price: "2200", package_commission: "220" });
    await openBoard(page);
    const c = cardIn(page, "Quoted", deal.transactionId);
    await expect(c).toContainText(`Cost ${gbp(2000)}`);
    await expect(c).toContainText(`Profit ${gbp(200)}`);
    await expect(page.getByTestId(`button-duplicate-quotes-${deal.transactionId}`)).toHaveText("+2");
  });

  test("a booked card shows the booking's money and its refs", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await bookedDeal(page.request, w, { sales_price: "4000", discounts: "100", service_charge: "20", package_commission: "400" });
    // Give the booking its own figures, different from the quote it came from, so only a card that reads the booking can match.
    await queryRows(`update booking_table set sales_price = '5000.00', discounts = '250.00', service_charge = '30.00', package_commission = '555.00' where transaction_id = $1`, [deal.transactionId]);
    await openBoard(page);
    const c = cardIn(page, "Booked", deal.transactionId);
    await expect(c).toContainText("Cost £4,780"); // 5000 - 250 + 30 (the quote said £3,920)
    await expect(c).toContainText("Profit £555"); // the quote said £400
    await expect(c).not.toContainText("£3,920");
    await expect(c).toContainText("HAY-1234567");
  });
});

test.describe("what the board hides", () => {
  test("a quote that expired in an earlier month drops off the board; one that expired earlier this month stays (display only)", async ({ page }) => {
    const w = await boardWorld(page);
    const old = await quoteDeal(page.request, w);
    const recent = await quoteDeal(page.request, w);
    const live = await quoteDeal(page.request, w);
    await queryRows(`update quote_table set date_expiry = date_trunc('month', now()) - interval '2 days' where id = $1`, [old.entityId]);
    await queryRows(`update quote_table set date_expiry = date_trunc('month', now()) + interval '1 minute' where id = $1`, [recent.entityId]);
    await openBoard(page);
    await expect(cardIn(page, "Quoted", live.transactionId)).toBeVisible(); // control: the board did load and does show quotes
    await expect(cardIn(page, "Quoted", recent.transactionId)).toBeVisible();
    await expect(card(page, old.transactionId)).toHaveCount(0);
    // It was only hidden, never changed.
    const [row] = await queryRows<{ quote_status: string }>(`select quote_status from quote_table where id = $1`, [old.entityId]);
    expect(row.quote_status).toBe("quoted");
  });

  test("the Booked column shows only bookings made this month", async ({ page }) => {
    const w = await boardWorld(page);
    const thisMonth = await bookedDeal(page.request, w);
    const lastMonth = await bookedDeal(page.request, w);
    await queryRows(`update booking_table set date_created = date_trunc('month', now()) - interval '3 days' where transaction_id = $1`, [lastMonth.transactionId]);
    await openBoard(page);
    await expect(cardIn(page, "Booked", thisMonth.transactionId)).toBeVisible();
    await expect(card(page, lastMonth.transactionId)).toHaveCount(0);
  });

  test("test deals and deals with no client are never shown", async ({ page }) => {
    const w = await boardWorld(page);
    const shown = await enquiryDeal(page.request, w);
    const test1 = await enquiryDeal(page.request, w);
    const orphan = await enquiryDeal(page.request, w);
    await queryRows(`update transaction set is_test = true where id = $1`, [test1.transactionId]);
    await queryRows(`update transaction set client_id = null where id = $1`, [orphan.transactionId]);
    await openBoard(page);
    await expect(cardIn(page, "Enquiry", shown.transactionId)).toBeVisible();
    await expect(card(page, test1.transactionId)).toHaveCount(0);
    await expect(card(page, orphan.transactionId)).toHaveCount(0);
  });
});

test.describe("empty states, paging and collapsing", () => {
  test("an agency with no deals shows each column's empty text and zero totals", async ({ page }) => {
    await boardWorld(page);
    await openBoard(page);
    await expect(column(page, "Enquiry")).toContainText("No deals here");
    await expect(column(page, "Quoted")).toContainText("No deals here");
    await expect(column(page, "In Play")).toContainText("No deals here");
    await expect(column(page, "Booked")).toContainText("Bookings you win will appear here");
    await expandRail(page, "Future");
    await expect(column(page, "Future")).toContainText("Park deals for later and they appear here.");
    await expandRail(page, "Lost");
    await expect(column(page, "Lost")).toContainText("No deals here");
    await expect(page.getByTestId("pipeline-subline")).toContainText("0 open deals · £0 value · £0 expected profit");
    await expect(page.getByTestId("chip-quick-all")).toHaveText("All deals 0");
  });

  test("a column previews 4 deals, expands to show the rest, loads the next page, and shrinks back", async ({ page }) => {
    const w = await boardWorld(page);
    const titles: string[] = [];
    for (let i = 0; i < 12; i++) titles.push((await enquiryDeal(page.request, w, `Bulk ${String(i).padStart(2, "0")}`)).title);
    await openBoard(page);
    const cards = column(page, "Enquiry").locator('[data-testid^="pipeline-card-"]');
    await expect(cards).toHaveCount(4);
    await expect(page.getByTestId("button-show-more-enquiry")).toHaveText("Show 8 more deals");

    await page.getByTestId("button-show-more-enquiry").click();
    // 10 per page from the server, then the second page on demand.
    await expect(cards).toHaveCount(12, { timeout: 20_000 });
    await expect(page.getByTestId("button-load-more-enquiry")).toHaveCount(0);
    // What is on the screen is the 12 deals, each once (read from the page, not from the titles the test made up).
    const onScreen = await column(page, "Enquiry").locator('[data-testid^="pipeline-title-"]').allTextContents();
    expect([...onScreen].sort()).toEqual([...titles].sort());
    await page.getByTestId("button-show-fewer-enquiry").click();
    await expect(cards).toHaveCount(4);
  });

  test("Future and Lost start collapsed with their counts; collapsing a column is remembered after a reload", async ({ page }) => {
    const w = await boardWorld(page);
    const f = await enquiryDeal(page.request, w);
    await parkFuture(page.request, f.transactionId);
    await enquiryDeal(page.request, w);
    await openBoard(page);
    await expect(page.getByTestId("pipeline-column-future-collapsed")).toHaveText(/^Future Deals\s*1$/);
    await expect(page.getByTestId("pipeline-column-lost-collapsed")).toHaveText(/^Lost Deals\s*0$/);
    await expect(page.getByTestId(columnTestId("Enquiry"))).toBeVisible();

    await page.getByTestId("button-collapse-enquiry").click();
    await expect(page.getByTestId("pipeline-column-enquiry-collapsed")).toBeVisible();
    await openBoard(page); // a full reload
    await expect(page.getByTestId("pipeline-column-enquiry-collapsed")).toBeVisible();
    await page.getByTestId("button-expand-enquiry").click();
    await expect(page.getByTestId(columnTestId("Enquiry"))).toBeVisible();
  });

  test("the List view shows the same deals as rows, grouped by stage", async ({ page }) => {
    const w = await boardWorld(page);
    const e = await enquiryDeal(page.request, w);
    const q = await quoteDeal(page.request, w);
    await openBoard(page);
    await page.getByTestId("pipeline-view-tab-list").click();
    await expect(page.getByTestId("pipeline-list-table")).toBeVisible();
    await expect(page.getByTestId("list-group-enquiry").getByTestId(`list-row-${e.transactionId}`)).toBeVisible();
    await expect(page.getByTestId("list-group-quoted").getByTestId(`list-row-${q.transactionId}`)).toBeVisible();
    await page.getByTestId("pipeline-view-tab-board").click();
    await expect(cardIn(page, "Enquiry", e.transactionId)).toBeVisible();
  });
});
