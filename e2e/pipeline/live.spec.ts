import { expect, expectLoginOk, test } from "../helpers/fixtures";
import { boardWorld, card, cardIn, openBoard, quoteDeal } from "../helpers/pipeline";

/**
 * The code has no live feed for the pipeline: the realtime stream (/api/v2/realtime) only carries inbox and
 * image-upscale events, the columns are plain TanStack queries with refetchOnWindowFocus and refetchInterval
 * both off (client/src/api/queryClient.ts), and the board only refetches after its own moves. So a change
 * made by someone else shows up on the next page load, not by itself. These tests pin that down. If a live
 * feed is added later, the first test fails on purpose and should be rewritten to expect the update.
 */
test.describe("changes made by someone else", () => {
  test("do not appear on an open board by themselves, but do after a reload", async ({ page, playwright, baseURL }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w);
    await openBoard(page);
    await expect(cardIn(page, "Quoted", deal.transactionId)).toBeVisible();
    // From here on, any request the board makes for its columns or counts would be a refresh nobody asked for.
    const boardRequests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/v2/transactions/pipeline")) boardRequests.push(`${r.method()} ${new URL(r.url()).pathname}`);
    });

    // Another session of the same agent (a second device) moves the deal and adds a new one.
    const other = await playwright.request.newContext({ baseURL: baseURL!, extraHTTPHeaders: { "X-Forwarded-For": "10.5.5.5" } });
    await expectLoginOk(other, w.agency.agentEmail);
    const moved = await other.patch(`/api/v2/quotes/${deal.entityId}`, { data: { quote_status: "in_play" } });
    expect(moved.status(), await moved.text()).toBe(200);
    const created = await other.post("/api/v2/transactions", {
      data: { client_id: w.clientId, user_id: w.userId, enquiry: { title: "Added elsewhere", holiday_type_id: w.agency.ref.packageType, status: "ACTIVE", travel_date: "2027-06-14" } },
    });
    expect(created.status(), await created.text()).toBe(201);
    await other.dispose();

    // Give a live feed a moment to act (no reload). The columns have no polling or focus refetch, so any
    // update would have to arrive as a new request, which is what is asserted.
    await page.waitForTimeout(2000);
    expect(boardRequests, "the board did not ask the server for anything by itself").toEqual([]);
    await expect(cardIn(page, "Quoted", deal.transactionId)).toBeVisible(); // still where this board last saw it
    await expect(page.getByText("Added elsewhere")).toHaveCount(0);

    await openBoard(page); // a reload
    await expect(cardIn(page, "In Play", deal.transactionId)).toBeVisible();
    await expect(card(page, deal.transactionId)).toHaveCount(1);
    await expect(page.getByText("Added elsewhere")).toBeVisible();
  });

  test("the board's own moves do refresh it: a deal moved here is in its new column without a reload, and the column totals updated", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w, { sales_price: "2000", package_commission: "200" });
    await openBoard(page);
    await expect(page.getByTestId("column-totals-quoted")).toContainText("£2,000");
    await expect(page.getByTestId("column-totals-in-play")).toContainText("£0");

    await card(page, deal.transactionId).dragTo(page.getByTestId("pipeline-column-in-play"));
    await expect(cardIn(page, "In Play", deal.transactionId)).toBeVisible();
    await expect(page.getByTestId("column-totals-in-play")).toContainText("£2,000");
    await expect(page.getByTestId("column-totals-quoted")).toContainText("£0");
    await expect(page.getByTestId("chip-quick-all")).toHaveText("All deals 1"); // unchanged on purpose: In-Play is still an open stage
  });
});
