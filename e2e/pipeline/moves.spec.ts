import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { HAYS_REF_MESSAGE } from "../../shared/booking-refs";
import { dbBookingFor, dbQuote, dbTransaction } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import {
  bookedDeal,
  boardWorld,
  card,
  cardIn,
  column,
  daysFromToday,
  drag,
  enquiryDeal,
  markLost,
  openBoard,
  parkFuture,
  quoteDeal,
  type BoardWorld,
  type Stage,
} from "../helpers/pipeline";
import { queryRows, seedQuoteTask, taskCompleted } from "../helpers/seed";

/** Where the deal really is, from the database (the same rules as the column queries in buildPipelineConditions). */
async function dbStage(transactionId: string): Promise<Stage> {
  const [t] = await queryRows<{ status: string }>(`select status from transaction where id = $1`, [transactionId]);
  if (t.status === "on_booking") return "Booked";
  if (t.status === "on_enquiry") {
    const [e] = await queryRows<{ status: string; is_future_deal: boolean }>(`select status, is_future_deal from enquiry_table where transaction_id = $1`, [transactionId]);
    return e.status === "LOST" ? "Lost" : e.is_future_deal ? "Future" : "Enquiry";
  }
  const [q] = await queryRows<{ quote_status: string; is_future_deal: boolean }>(
    `select quote_status, is_future_deal from quote_table where transaction_id = $1 and "isQuoteCopy" is not true and "isFreeQuote" is not true and deleted_at is null`,
    [transactionId],
  );
  if (q.quote_status === "lost") return "Lost";
  if (q.is_future_deal) return "Future";
  return q.quote_status === "in_play" ? "In Play" : "Quoted";
}

/** Opens a collapsed rail; if an earlier step in this test already opened it (the choice is kept in localStorage) it does nothing. */
async function expandRail(page: Page, stage: "Future" | "Lost") {
  if (await column(page, stage).isVisible()) return;
  await page.getByTestId(`button-expand-${stage.toLowerCase()}`).click();
  await expect(column(page, stage)).toBeVisible();
}

/** Reloads the page and checks the deal is in `stage` on screen AND nowhere else. */
async function expectAfterReload(page: Page, transactionId: string, stage: Stage) {
  await openBoard(page);
  if (stage === "Future" || stage === "Lost") await expandRail(page, stage);
  await expect(cardIn(page, stage, transactionId)).toBeVisible();
  await expect(card(page, transactionId)).toHaveCount(1);
}

async function bookDialog(page: Page) {
  const dialog = page.getByTestId("dialog-convert-booking");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("moving a deal forward by drag and drop", () => {
  test("Quoted -> In-Play and back: the quote's status changes in the database and survives a reload", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w);
    await openBoard(page);
    await expect(cardIn(page, "Quoted", deal.transactionId)).toBeVisible();

    await drag(page, deal.transactionId, "In Play");
    await expect(cardIn(page, "In Play", deal.transactionId)).toBeVisible();
    await expect(card(page, deal.transactionId)).toHaveCount(1);
    await expect.poll(async () => (await dbQuote(deal.entityId)).quote_status).toBe("in_play");
    await expectAfterReload(page, deal.transactionId, "In Play");

    await drag(page, deal.transactionId, "Quoted");
    await expect(cardIn(page, "Quoted", deal.transactionId)).toBeVisible();
    await expect.poll(async () => (await dbQuote(deal.entityId)).quote_status).toBe("quoted");
    await expectAfterReload(page, deal.transactionId, "Quoted");
  });

  test("Enquiry -> Quoted opens the quote drawer prefilled from the enquiry; saving it moves the deal, closing it leaves the deal where it was", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await enquiryDeal(page.request, w, undefined, { travel_date: "2027-06-14", adults: 3, no_of_nights: 9 });
    await openBoard(page);

    // Cancel first: nothing changes.
    await drag(page, deal.transactionId, "Quoted");
    const drawer = page.getByTestId("quote-create-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("input-drawer-title")).toHaveValue(deal.title);
    await expect(drawer.getByLabel("Travel Date")).toContainText("14/06/2027");
    await expect(drawer.getByLabel("Adults")).toHaveValue("3");
    await page.getByTestId("form-drawer-close").click();
    await expect(drawer).toBeHidden();
    await expect(cardIn(page, "Enquiry", deal.transactionId)).toBeVisible();
    expect(await dbStage(deal.transactionId)).toBe("Enquiry");
    expect(await queryRows(`select 1 from quote_table where transaction_id = $1`, [deal.transactionId])).toHaveLength(0);

    // Now save.
    await drag(page, deal.transactionId, "Quoted");
    await expect(drawer).toBeVisible();
    await drawer.getByTestId("drawer-costing-price").fill("1500");
    await drawer.getByTestId("form-drawer-submit").click();
    await expect(cardIn(page, "Quoted", deal.transactionId)).toBeVisible();
    expect(await dbStage(deal.transactionId)).toBe("Quoted");
    await expectAfterReload(page, deal.transactionId, "Quoted");
  });

  test("Enquiry -> In-Play creates the quote as in-play", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await enquiryDeal(page.request, w, undefined, { travel_date: "2027-06-14" });
    await openBoard(page);
    await drag(page, deal.transactionId, "In Play");
    const drawer = page.getByTestId("quote-create-drawer");
    await expect(drawer).toBeVisible();
    await drawer.getByTestId("form-drawer-submit").click();
    await expect(cardIn(page, "In Play", deal.transactionId)).toBeVisible();
    expect(await dbStage(deal.transactionId)).toBe("In Play");
  });

  for (const from of ["Quoted", "In Play"] as const) {
    test(`${from} -> Booked goes through the convert dialog: bad HAYS refs are refused, closing it leaves the deal, a good ref books it`, async ({ page }) => {
      const w = await boardWorld(page);
      const deal = await quoteDeal(page.request, w, { inPlay: from === "In Play" });
      await openBoard(page);

      await drag(page, deal.transactionId, "Booked");
      let dialog = await bookDialog(page);
      const hays = dialog.getByTestId("input-convert-hays-ref");
      const supplier = dialog.getByTestId("input-convert-tour-ref");
      const confirm = dialog.getByTestId("button-convert-to-booking");

      await supplier.fill("TUI 55");
      for (const [bad, message] of [
        ["HAY-123456", HAYS_REF_MESSAGE],
        ["HAY-123456789", HAYS_REF_MESSAGE],
        ["ABC-1234567", HAYS_REF_MESSAGE],
        ["", "Enter the HAYS reference."],
      ] as const) {
        await hays.fill(bad);
        await confirm.click();
        await expect(dialog.getByTestId("error-convert-hays-ref"), bad).toHaveText(message);
      }
      expect(await dbBookingFor(deal.transactionId)).toBeUndefined();

      // Close without booking: the card has not moved, in the UI or the database.
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(cardIn(page, from, deal.transactionId)).toBeVisible();
      expect(await dbStage(deal.transactionId)).toBe(from);
      expect(await dbBookingFor(deal.transactionId)).toBeUndefined();

      // Book it for real, with a forgiving spelling.
      await drag(page, deal.transactionId, "Booked");
      dialog = await bookDialog(page);
      await dialog.getByTestId("input-convert-hays-ref").fill("hay 7654321");
      await dialog.getByTestId("input-convert-tour-ref").fill("TUI 77");
      await dialog.getByTestId("button-convert-to-booking").click();
      await expectToast(page, "Converted to booking");
      await expect(cardIn(page, "Booked", deal.transactionId)).toBeVisible();
      expect(await dbBookingFor(deal.transactionId)).toMatchObject({ hays_ref: "HAY-7654321", supplier_ref: "TUI 77" });
      expect((await dbTransaction(deal.transactionId)).status).toBe("on_booking");
      await expectAfterReload(page, deal.transactionId, "Booked");
    });
  }

  test("a booking move sends nothing: the quote's tasks finish, the SMS trigger leaves one failed row and no sent message", async ({ page }) => {
    const w = await boardWorld(page);
    await queryRows(
      `insert into sms_templates (id, org_id, name, category, body, auto_trigger, active)
       values ($1, $2, 'Booked', 'booking_confirmation', 'Hi {{first_name}}, booked {{hays_ref}}', 'on_booking_create', true)`,
      [randomUUID(), w.agency.orgId],
    );
    const deal = await quoteDeal(page.request, w);
    const taskId = await seedQuoteTask({ userId: w.userId, orgId: w.agency.orgId, branchId: w.agency.branchId, quoteId: deal.entityId });
    await openBoard(page);

    // Moves that must not text anyone.
    await drag(page, deal.transactionId, "In Play");
    await expect(cardIn(page, "In Play", deal.transactionId)).toBeVisible();
    await drag(page, deal.transactionId, "Quoted");
    await expect(cardIn(page, "Quoted", deal.transactionId)).toBeVisible();
    // Texts are sent in the background after a move: give one the time to appear before saying there is none.
    await page.waitForTimeout(2_000);
    expect(await queryRows(`select 1 from sms_messages where client_id = $1`, [w.clientId])).toHaveLength(0);

    await drag(page, deal.transactionId, "Booked");
    const dialog = await bookDialog(page);
    await dialog.getByTestId("input-convert-hays-ref").fill("HAY-1111111");
    await dialog.getByTestId("input-convert-tour-ref").fill("TUI 1");
    await dialog.getByTestId("button-convert-to-booking").click();
    await expect(cardIn(page, "Booked", deal.transactionId)).toBeVisible();

    await expect.poll(async () => (await queryRows(`select 1 from sms_messages where client_id = $1`, [w.clientId])).length, { timeout: 20_000 }).toBe(1);
    await page.waitForTimeout(2_000); // and it stays one text (the trigger does not fire twice)
    expect(await queryRows(`select 1 from sms_messages where client_id = $1`, [w.clientId])).toHaveLength(1);
    const [row] = await queryRows<{ status: string; provider_error: string }>(`select status, provider_error from sms_messages where client_id = $1`, [w.clientId]);
    expect(row.status).toBe("failed");
    expect(row.provider_error).toMatch(/Connexa is not connected/);
    expect(await taskCompleted(taskId)).toBe(true);
    // (The global teardown fails the run if the server also tried to reach any outside host.)
  });
});

test.describe("parking: Future and Lost", () => {
  test("Enquiry -> Future asks for a date; closing the dialog leaves the deal; confirming parks it with that date", async ({ page }) => {
    const w = await boardWorld(page);
    const parkDate = daysFromToday(200); // strictly in the future whenever the suite runs
    const deal = await enquiryDeal(page.request, w);
    await openBoard(page);

    await page.getByTestId(`pipeline-card-${deal.transactionId}`).dragTo(page.getByTestId("pipeline-column-future-collapsed"));
    const dateInput = page.getByTestId("input-future-deal-date");
    await expect(dateInput).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dateInput).toBeHidden();
    await expect(cardIn(page, "Enquiry", deal.transactionId)).toBeVisible();
    expect(await dbStage(deal.transactionId)).toBe("Enquiry");

    await page.getByTestId(`pipeline-card-${deal.transactionId}`).dragTo(page.getByTestId("pipeline-column-future-collapsed"));
    await page.getByTestId("input-future-deal-date").fill(parkDate);
    await page.getByTestId("button-confirm-future-date").click();
    await expectToast(page, "Moved to Future");
    await expect(card(page, deal.transactionId)).toHaveCount(0); // the Future rail is collapsed, so the card is not in the open columns
    const [e] = await queryRows<{ is_future_deal: boolean; future_deal_date: string }>(`select is_future_deal, future_deal_date from enquiry_table where transaction_id = $1`, [deal.transactionId]);
    expect(e).toEqual({ is_future_deal: true, future_deal_date: parkDate });
    await expectAfterReload(page, deal.transactionId, "Future");
    await expect(cardIn(page, "Future", deal.transactionId)).toContainText(`Returns: ${parkDate}`);
  });

  test("Future -> its own column returns it to the pipeline", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await enquiryDeal(page.request, w);
    await parkFuture(page.request, deal.transactionId);
    await openBoard(page);
    await expandRail(page, "Future");
    await drag(page, deal.transactionId, "Enquiry");
    await expectToast(page, "Returned to pipeline");
    await expect(cardIn(page, "Enquiry", deal.transactionId)).toBeVisible();
    expect(await dbStage(deal.transactionId)).toBe("Enquiry");
    await expectAfterReload(page, deal.transactionId, "Enquiry");
  });

  test("Mark as lost asks first; 'Keep deal' leaves it, confirming moves it to Lost, and Reopen brings it back", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w);
    await openBoard(page);

    await card(page, deal.transactionId).dragTo(page.getByTestId("pipeline-column-lost-collapsed"));
    await expect(page.getByRole("alertdialog")).toContainText("Mark as lost?");
    await page.getByTestId("button-keep-deal").click();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(cardIn(page, "Quoted", deal.transactionId)).toBeVisible();
    expect(await dbStage(deal.transactionId)).toBe("Quoted");

    await card(page, deal.transactionId).dragTo(page.getByTestId("pipeline-column-lost-collapsed"));
    await page.getByTestId("button-confirm-mark-lost").click();
    await expectToast(page, "Deal marked as lost");
    expect(await dbStage(deal.transactionId)).toBe("Lost");
    await expectAfterReload(page, deal.transactionId, "Lost");

    await page.getByTestId(`button-reopen-${deal.transactionId}`).click();
    await expectToast(page, "Deal restored");
    await expect(cardIn(page, "Lost", deal.transactionId)).toHaveCount(0); // gone from the Lost column
    expect(await dbStage(deal.transactionId)).toBe("Quoted");
    await expectAfterReload(page, deal.transactionId, "Quoted");
  });

  for (const to of ["Enquiry", "Quoted", "In Play"] as const) {
    test(`a lost deal can be dragged back to ${to}`, async ({ page }) => {
      const w = await boardWorld(page);
      // An enquiry can only go back to Enquiry; a quote can go to Quoted or In-Play.
      const deal = to === "Enquiry" ? await enquiryDeal(page.request, w) : await quoteDeal(page.request, w);
      await markLost(page.request, deal.transactionId);
      await openBoard(page);
      await expandRail(page, "Lost");
      await expect(cardIn(page, "Lost", deal.transactionId)).toBeVisible();
      await drag(page, deal.transactionId, to);
      await expect(cardIn(page, to, deal.transactionId)).toBeVisible();
      await expect(card(page, deal.transactionId)).toHaveCount(1);
      await expect.poll(() => dbStage(deal.transactionId)).toBe(to);
      await expectAfterReload(page, deal.transactionId, to);
    });
  }
});

test.describe("moves the board refuses", () => {
  /** A deal parked in Future whose real position was a quote. */
  async function futureQuote(page: Page, w: BoardWorld) {
    const deal = await quoteDeal(page.request, w);
    await parkFuture(page.request, deal.transactionId);
    return deal;
  }

  test("a parked quote cannot be dragged back to Enquiry: a message appears and the card stays in Future", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await futureQuote(page, w);
    await openBoard(page);
    await expandRail(page, "Future");
    await drag(page, deal.transactionId, "Enquiry");
    await expectToast(page, "Deals can't move back to an earlier stage");
    await expect(cardIn(page, "Future", deal.transactionId)).toBeVisible();
    await expect(cardIn(page, "Enquiry", deal.transactionId)).toHaveCount(0);
    expect(await dbStage(deal.transactionId)).toBe("Future");
    await expectAfterReload(page, deal.transactionId, "Future");
  });

  test("a parked enquiry cannot go straight to Booked ('Create a quote before booking') and stays in Future", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await enquiryDeal(page.request, w);
    await parkFuture(page.request, deal.transactionId);
    await openBoard(page);
    await expandRail(page, "Future");
    await drag(page, deal.transactionId, "Booked");
    await expectToast(page, "Create a quote before booking");
    await expect(cardIn(page, "Future", deal.transactionId)).toBeVisible();
    expect(await dbStage(deal.transactionId)).toBe("Future");
  });

  test("drop targets that the rules forbid do not accept the card: backwards, Enquiry -> Booked, Booked -> Quoted / In-Play / Future / Lost", async ({ page }) => {
    const w = await boardWorld(page);
    const quoted = await quoteDeal(page.request, w);
    const enq = await enquiryDeal(page.request, w);
    const booked = await bookedDeal(page.request, w);
    await openBoard(page);
    // Control: the same drag onto an allowed column does move a card (so a drag in this setup really works).
    await drag(page, quoted.transactionId, "In Play");
    await expect(cardIn(page, "In Play", quoted.transactionId)).toBeVisible();
    const refusalToast = page.getByText(/Deals can.t move back|Create a quote before booking|Failed to move|Error moving/);
    await expect(refusalToast, "an accepted drop shows no refusal message").toHaveCount(0);
    await expect.poll(() => dbStage(quoted.transactionId)).toBe("In Play");

    await drag(page, quoted.transactionId, "Enquiry"); // backwards
    await drag(page, enq.transactionId, "Booked"); // enquiry has no quote
    await drag(page, booked.transactionId, "Quoted"); // a booking stays booked
    await drag(page, booked.transactionId, "In Play");
    await page.getByTestId(`pipeline-card-${booked.transactionId}`).dragTo(page.getByTestId("pipeline-column-lost-collapsed")); // bookings can't be lost
    await page.getByTestId(`pipeline-card-${booked.transactionId}`).dragTo(page.getByTestId("pipeline-column-future-collapsed")); // bookings can't be parked
    // Nothing opened (no dialog, no drawer), nothing moved.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByTestId("input-future-deal-date")).toHaveCount(0); // no "return date" prompt for the refused Booked -> Future drop
    await expect(cardIn(page, "In Play", quoted.transactionId)).toBeVisible();
    await expect(cardIn(page, "Enquiry", enq.transactionId)).toBeVisible();
    await expect(cardIn(page, "Booked", booked.transactionId)).toBeVisible();
    await expect(refusalToast, "forbidden drops are not accepted, so no handler runs and no message shows").toHaveCount(0);
    await expect.poll(() => dbStage(quoted.transactionId)).toBe("In Play");
    await expect.poll(() => dbStage(enq.transactionId)).toBe("Enquiry");
    await expect.poll(() => dbStage(booked.transactionId)).toBe("Booked");
  });

  test("the server's own rules: a booking cannot be marked lost or future (400), a deal cannot be moved back by PATCH (400)", async ({ page }) => {
    const w = await boardWorld(page);
    const booked = await bookedDeal(page.request, w);
    const quoted = await quoteDeal(page.request, w);
    const lost = await page.request.post(`/api/v2/transactions/${booked.transactionId}/lost`, { data: { lost: true } });
    expect(lost.status()).toBe(400);
    expect(await lost.text()).toContain("A booking cannot be marked lost via this endpoint");
    const future = await page.request.post(`/api/v2/transactions/${booked.transactionId}/future`, { data: { future_deal_date: daysFromToday(120) } });
    expect(future.status()).toBe(400);
    expect(await future.text()).toContain("A booking cannot be marked as a future deal");
    const back = await page.request.patch(`/api/v2/transactions/${quoted.transactionId}`, { data: { status: "on_enquiry" } });
    expect(back.status()).toBe(400);
    expect(await back.text()).toContain("A deal cannot move back to an earlier stage");
    const noBooking = await page.request.patch(`/api/v2/transactions/${quoted.transactionId}`, { data: { status: "on_booking" } });
    expect(noBooking.status()).toBe(400);
    expect(await noBooking.text()).toContain("Cannot move to booking: the deal has no booking");
    expect(await dbStage(booked.transactionId)).toBe("Booked");
    expect(await dbStage(quoted.transactionId)).toBe("Quoted");
  });

  // Owner decision: a booking cannot be parked in Future. The board refuses the drop (no prompt, no request) and the
  // card menu does not offer "Move to Future…". The server also still answers 400 (previous test).
  test("dragging a booking to Future is refused: no date prompt, no request, the card stays in Booked", async ({ page }) => {
    const w = await boardWorld(page);
    const booked = await bookedDeal(page.request, w);
    const moves: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET" && r.url().includes("/api/v2/transactions")) moves.push(`${r.method()} ${r.url()}`);
    });
    await openBoard(page);
    await page.getByTestId(`pipeline-card-${booked.transactionId}`).dragTo(page.getByTestId("pipeline-column-future-collapsed"));
    await expect(page.getByTestId("input-future-deal-date")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(cardIn(page, "Booked", booked.transactionId)).toBeVisible();
    expect(await dbStage(booked.transactionId)).toBe("Booked");
    expect(moves, "the refused drop sends no write").toEqual([]);
    // The card menu does not offer it either.
    await card(page, booked.transactionId).hover();
    await card(page, booked.transactionId).getByTestId("button-deal-menu").click();
    await expect(page.getByTestId("menu-open-deal")).toBeVisible();
    await expect(page.getByTestId("menu-move-to-future")).toHaveCount(0);
  });

  test("when the server refuses a Quoted -> In-Play move the card goes back to the same place in its column and a message shows", async ({ page }) => {
    const w = await boardWorld(page);
    await quoteDeal(page.request, w, { title: "Order A" });
    const b = await quoteDeal(page.request, w, { title: "Order B" });
    await quoteDeal(page.request, w, { title: "Order C" });
    await openBoard(page);
    const titles = () => column(page, "Quoted").locator('[data-testid^="pipeline-title-"]').allTextContents();
    const before = await titles();
    expect(before).toHaveLength(3);

    // A stand-in for a server that says no (a real refusal for a live quote does not exist, so it is simulated).
    await page.route("**/api/v2/quotes/*", async (route) => {
      if (route.request().method() === "PATCH") await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ success: false, message: "No" }) });
      else await route.fallback();
    });
    await drag(page, b.transactionId, "In Play");
    await expectToast(page, "Error moving transaction");
    await expect(cardIn(page, "Quoted", b.transactionId)).toBeVisible();
    await expect(cardIn(page, "In Play", b.transactionId)).toHaveCount(0);
    expect(await titles()).toEqual(before); // same cards, same order
    expect(await dbStage(b.transactionId)).toBe("Quoted");
  });
});
