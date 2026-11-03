/** Helpers for the pipeline board specs: seeding a deal into any column and driving the board. */
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { apiCreateClient, apiCreateEnquiry, apiCreateQuoteDeal, signIn, type QuoteInput } from "./deals";
import { expect } from "./fixtures";
import { seedDealsAgency, type DealsAgency } from "./seed";

export type Stage = "Enquiry" | "Quoted" | "In Play" | "Booked" | "Future" | "Lost";

// The board names its columns after the stage label, lower-cased, with the space turned into a hyphen.
export const columnTestId = (stage: Stage) => `pipeline-column-${stage.toLowerCase().replace(" ", "-")}`;

export function column(page: Page, stage: Stage): Locator {
  return page.getByTestId(columnTestId(stage));
}

export function card(page: Page, transactionId: string): Locator {
  return page.getByTestId(`pipeline-card-${transactionId}`);
}

/** The card inside one particular column (proves WHERE it is, not just that it exists). */
export function cardIn(page: Page, stage: Stage, transactionId: string): Locator {
  return column(page, stage).getByTestId(`pipeline-card-${transactionId}`);
}

/**
 * Opens /pipeline and waits until all six column requests and the chip counts have answered, so that
 * "this card is not here" can only be true because the server did not send it.
 */
export async function openBoard(page: Page): Promise<void> {
  // The listeners are created before the navigation starts, and awaited together with it, so a fast answer cannot be missed.
  const answered = ["enquiry", "quote", "in_play", "booking", "future", "lost"].map((s) =>
    page.waitForResponse((r) => r.url().includes(`/api/v2/transactions/pipeline/${s}`) && r.request().method() === "GET"),
  );
  const counts = page.waitForResponse((r) => r.url().includes("/api/v2/transactions/pipeline-counts"));
  const [responses] = await Promise.all([Promise.all([...answered, counts]), page.goto("/pipeline")]);
  for (const r of responses) expect(r.status(), r.url()).toBe(200);
  await expect(page.getByTestId("pipeline-title")).toBeVisible();
  // The cards render a frame after the response: wait for the loading spinners to go.
  await expect(page.locator('[data-testid^="pipeline-column-"] .animate-spin')).toHaveCount(0);
}

export interface BoardWorld {
  agency: DealsAgency;
  userId: string;
  clientId: string;
  clientSurname: string;
}

/** A fresh agency with its agent signed in on `page`, and one client for the deals. */
export async function boardWorld(page: Page): Promise<BoardWorld> {
  const agency = await seedDealsAgency();
  const userId = await signIn(page, agency.agentEmail);
  const client = await apiCreateClient(page.request);
  return { agency, userId, clientId: client.id, clientSurname: client.surename };
}

export interface Deal {
  transactionId: string;
  title: string;
  /** enquiry id, or primary quote id, or booking's quote id */
  entityId: string;
}

let counter = 0;
const tag = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export async function enquiryDeal(request: APIRequestContext, w: BoardWorld, title = `Enq ${tag()}`, extra: Parameters<typeof apiCreateEnquiry>[4] = {}, clientId = w.clientId): Promise<Deal> {
  const d = await apiCreateEnquiry(request, w.agency, clientId, w.userId, { ...extra, title });
  return { transactionId: d.transactionId, title, entityId: d.enquiryId };
}

export async function quoteDeal(
  request: APIRequestContext,
  w: BoardWorld,
  input: QuoteInput & { inPlay?: boolean } = {},
  clientId = w.clientId,
): Promise<Deal> {
  const title = input.title ?? `Quote ${tag()}`;
  const d = await apiCreateQuoteDeal(request, w.agency, clientId, w.userId, { ...input, title, quote_status: input.inPlay ? "in_play" : "quoted" });
  return { transactionId: d.transactionId, title, entityId: d.quoteId };
}

export async function bookedDeal(request: APIRequestContext, w: BoardWorld, input: QuoteInput = {}, clientId = w.clientId): Promise<Deal> {
  const d = await quoteDeal(request, w, input, clientId);
  const res = await request.post(`/api/v2/bookings/convert/${d.entityId}`, { data: { haysRef: "HAY-1234567", supplierRef: "TUI 1" } });
  expect(res.status(), await res.text()).toBe(201);
  return d;
}

/**
 * A yyyy-MM-dd date `days` after today. The server wants a strictly future date and compares calendar days in UTC
 * (transaction.validator.ts), so this counts in UTC too and never depends on the day the suite runs.
 */
export function daysFromToday(days: number): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days)).toISOString().slice(0, 10);
}

export async function parkFuture(request: APIRequestContext, transactionId: string, date = daysFromToday(120)): Promise<void> {
  const res = await request.post(`/api/v2/transactions/${transactionId}/future`, { data: { future_deal_date: date } });
  expect(res.status(), await res.text()).toBe(200);
}

export async function markLost(request: APIRequestContext, transactionId: string, lost = true): Promise<void> {
  const res = await request.post(`/api/v2/transactions/${transactionId}/lost`, { data: { lost } });
  expect(res.status(), await res.text()).toBe(200);
}

/** Drags a card onto a column. */
export async function drag(page: Page, transactionId: string, to: Stage): Promise<void> {
  await card(page, transactionId).dragTo(column(page, to));
}

