import type { Page } from "@playwright/test";
import { apiAddQuote } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { boardWorld, bookedDeal, card, cardIn, enquiryDeal, markLost, openBoard, quoteDeal } from "../helpers/pipeline";
import { queryRows } from "../helpers/seed";

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

async function openDrawer(page: Page, transactionId: string) {
  await card(page, transactionId).click();
  const drawer = page.getByTestId("transaction-detail-panel");
  await expect(drawer).toBeVisible();
  return drawer;
}

test.describe("deal drawer contents", () => {
  test("a quoted deal's drawer matches its card: title, stage, client, money and margin, operator, stepper and footer", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w, { sales_price: "3000", discounts: "100", service_charge: "40", package_commission: "240", travel_date: "2027-06-14", num_of_nights: 10 });
    await openBoard(page);
    const drawer = await openDrawer(page, deal.transactionId);

    await expect(drawer.getByRole("heading", { name: deal.title })).toBeVisible();
    await expect(drawer).toContainText(`Deal #${deal.transactionId.slice(0, 8)}`);
    await expect(drawer).toContainText("14 Jun 2027 · 10 nights");
    await expect(drawer.getByTestId("stage-pill")).toHaveText("Quoted");
    await expect(drawer).toContainText(w.clientSurname);
    await expect(drawer).toContainText("07700900111");
    // Money: value 3000 - 100 + 40 = 2940, profit 240, margin round(240 / 2940) = 8%.
    await expect(drawer).toContainText(`Cost${gbp(2940)}`);
    await expect(drawer).toContainText(`Profit${gbp(240)}`);
    await expect(drawer).toContainText("Margin8%");
    await expect(drawer.getByTestId("drawer-tour-operator")).toContainText(deal.title);
    await expect(drawer.getByTestId("drawer-tour-operator")).toContainText("E2E Sun Holidays");
    // Stepper: Enquiry done, Quoted is the current step (the orange bar), In-Play and Booked still to do.
    const stepper = drawer.getByTestId("drawer-stage-stepper");
    await expect(stepper.locator("div.flex-1:has(> div.bg-social-orange)")).toHaveText("Quoted");
    await expect(stepper.locator("div.flex-1:has(> div.bg-stage-booked-bg)")).toHaveText("Enquiry");
    await expect(stepper.locator("div.flex-1")).toHaveText(["Enquiry", "Quoted", "In-Play", "Booked"]);
    await expect(drawer.getByTestId("button-drawer-primary")).toHaveText("Move to In-Play");
    await expect(drawer.getByTestId("button-drawer-mark-lost")).toBeVisible();

    await page.getByTestId("button-close-panel").click();
    await expect(drawer).toBeHidden();
  });

  test("the footer's main button names the next stage for each stage, and Booked and Lost differ", async ({ page }) => {
    const w = await boardWorld(page);
    const enq = await enquiryDeal(page.request, w);
    const inPlay = await quoteDeal(page.request, w, { inPlay: true });
    const booked = await bookedDeal(page.request, w);
    const lost = await quoteDeal(page.request, w);
    await markLost(page.request, lost.transactionId);
    await openBoard(page);

    let drawer = await openDrawer(page, enq.transactionId);
    await expect(drawer.getByTestId("button-drawer-primary")).toHaveText("Move to Quoted");
    await page.getByTestId("button-close-panel").click();

    drawer = await openDrawer(page, inPlay.transactionId);
    await expect(drawer.getByTestId("button-drawer-primary")).toHaveText("Move to Booked");
    await page.getByTestId("button-close-panel").click();

    drawer = await openDrawer(page, booked.transactionId);
    await expect(drawer.getByTestId("button-drawer-primary")).toHaveText("Done"); // nothing after Booked
    await expect(drawer.getByTestId("button-drawer-mark-lost")).toHaveCount(0); // bookings cannot be lost
    await expect(drawer.getByTestId("drawer-stage-stepper")).toBeVisible();
    await page.getByTestId("button-close-panel").click();

    await page.getByTestId("button-expand-lost").click();
    drawer = await openDrawer(page, lost.transactionId);
    await expect(drawer.getByTestId("button-drawer-primary")).toHaveText("Reopen deal");
    await expect(drawer.getByTestId("button-drawer-mark-lost")).toHaveCount(0);
    await expect(drawer.getByTestId("drawer-stage-stepper")).toHaveCount(0); // not shown for Lost
  });
});

test.describe("Add quote", () => {
  test("only a deal with no quote offers Add quote; on an enquiry it opens the quote drawer prefilled from the enquiry", async ({ page }) => {
    const w = await boardWorld(page);
    const enq = await enquiryDeal(page.request, w, undefined, { travel_date: "2027-08-01", adults: 4 });
    const quoted = await quoteDeal(page.request, w);
    await openBoard(page);
    await expect(page.getByTestId(`button-add-quote-${enq.transactionId}`)).toBeVisible();
    await expect(page.getByTestId(`button-add-quote-${quoted.transactionId}`)).toHaveCount(0);
    await expect(cardIn(page, "Quoted", quoted.transactionId)).toContainText("Cost"); // control: the card did render its money block

    // From the card.
    await page.getByTestId(`button-add-quote-${enq.transactionId}`).click();
    const qd = page.getByTestId("quote-create-drawer");
    await expect(qd).toBeVisible();
    await expect(qd.getByTestId("input-drawer-title")).toHaveValue(enq.title);
    await expect(qd.getByLabel("Adults")).toHaveValue("4");
    await page.getByTestId("form-drawer-close").click();
    await expect(qd).toBeHidden();

    // From the drawer: it shows "No quote yet" and an Add quote button for the same deal.
    const drawer = await openDrawer(page, enq.transactionId);
    await expect(drawer).toContainText("No quote yet");
    await drawer.getByRole("button", { name: "Add quote" }).click();
    await expect(drawer).toBeHidden();
    await expect(qd).toBeVisible();
    await expect(qd.getByTestId("input-drawer-title")).toHaveValue(enq.title);
    expect(await queryRows(`select 1 from quote_table where transaction_id = $1`, [enq.transactionId])).toHaveLength(0);

    // The quoted deal's drawer has Cost/Profit/Margin tiles instead.
    await page.getByTestId("form-drawer-close").click();
    const qdrawer = await openDrawer(page, quoted.transactionId);
    await expect(qdrawer).not.toContainText("No quote yet");
    await expect(qdrawer).toContainText("Margin");
  });
});

test.describe("quote variants", () => {
  test("a deal with copies shows +N; the list marks the primary and 'Set as main' swaps it", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w, { title: "Primary one", sales_price: "2000" });
    const copy = await apiAddQuote(page.request, w.agency, deal.transactionId, { title: "Copy one", sales_price: "2100" });
    await openBoard(page);
    const pill = page.getByTestId(`button-duplicate-quotes-${deal.transactionId}`);
    await expect(pill).toHaveText("+1");
    await pill.click();
    const list = cardIn(page, "Quoted", deal.transactionId);
    // Each row is a button named after the quote; the primary one carries a "Primary" badge in its name.
    await expect(list.getByRole("button", { name: "Primary one Primary" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Copy one" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Copy one Primary" })).toHaveCount(0);

    // The button is only revealed on hover, as for a user.
    await list.getByRole("button", { name: "Copy one" }).hover();
    await list.getByTitle("Set as main").click();
    await expectToast(page, "Primary quote updated");
    const rows = await queryRows<{ id: string; isQuoteCopy: boolean }>(`select id, "isQuoteCopy" from quote_table where transaction_id = $1`, [deal.transactionId]);
    expect(Object.fromEntries(rows.map((r) => [r.id, r.isQuoteCopy]))).toEqual({ [deal.entityId]: true, [copy]: false });
  });
});

test.describe("drawer move buttons", () => {
  test("Move to In-Play changes the quote, closes the drawer and survives a reload", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w);
    await openBoard(page);
    const drawer = await openDrawer(page, deal.transactionId);
    await drawer.getByTestId("button-drawer-primary").click();
    await expect(drawer).toBeHidden();
    await expect(cardIn(page, "In Play", deal.transactionId)).toBeVisible();
    await expect.poll(async () => (await queryRows<{ quote_status: string }>(`select quote_status from quote_table where id = $1`, [deal.entityId]))[0].quote_status).toBe("in_play");
    await openBoard(page);
    await expect(cardIn(page, "In Play", deal.transactionId)).toBeVisible();
  });

  test("Mark as lost from the drawer closes it, asks to confirm and then moves the deal to Lost; Reopen brings a lost quote back as Quoted", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w);
    await openBoard(page);
    const drawer = await openDrawer(page, deal.transactionId);
    await drawer.getByTestId("button-drawer-mark-lost").click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("alertdialog")).toContainText("Mark as lost?");
    await page.getByTestId("button-confirm-mark-lost").click();
    await expectToast(page, "Deal marked as lost");

    await openBoard(page);
    await page.getByTestId("button-expand-lost").click();
    const lostDrawer = await openDrawer(page, deal.transactionId);
    await lostDrawer.getByTestId("button-drawer-primary").click(); // "Reopen deal"
    await expectToast(page, "Deal restored");
    await openBoard(page);
    await expect(cardIn(page, "Quoted", deal.transactionId)).toBeVisible();
  });

  test("In-Play -> Move to Booked opens the HAYS dialog; the drawer is already closed", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w, { inPlay: true });
    await openBoard(page);
    const drawer = await openDrawer(page, deal.transactionId);
    await drawer.getByTestId("button-drawer-primary").click();
    await expect(drawer).toBeHidden();
    await expect(page.getByTestId("dialog-convert-booking")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("dialog-convert-booking")).toBeHidden();
    await expect(cardIn(page, "In Play", deal.transactionId)).toBeVisible();
  });
});
