/**
 * Helpers for the deal journey specs (client -> enquiry -> quote -> booking).
 * API calls here are SETUP only; assertions about the journey itself go through the screens.
 */
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectLoginOk } from "./fixtures";
import { queryRows, unique, type DealsAgency } from "./seed";

export const DEFAULT_PHONE = "07700900111";

/** Signs the request context (shared with the page) in as the given email and returns the user id. */
export async function signIn(page: Page, email: string): Promise<string> {
  await expectLoginOk(page.request, email);
  const me = await page.request.get("/api/auth/user");
  expect(me.status(), await me.text()).toBe(200);
  return ((await me.json()) as { id: string }).id;
}

export async function dataOf<T>(res: import("@playwright/test").APIResponse, expected: number | number[] = [200, 201]): Promise<T> {
  const text = await res.text();
  const ok = Array.isArray(expected) ? expected.includes(res.status()) : res.status() === expected;
  expect(ok, `${res.url()} -> ${res.status()} ${text}`).toBe(true);
  return (JSON.parse(text) as { data: T }).data;
}

export interface ClientRow {
  id: string;
  firstName: string;
  surename: string;
  phoneNumber: string | null;
  email: string | null;
}

export function uniqueSurname(): string {
  return `Smith${unique("")}`.replace(/[^A-Za-z0-9]/g, "");
}

export async function apiCreateClient(request: APIRequestContext, overrides: Record<string, unknown> = {}): Promise<ClientRow> {
  const res = await request.post("/api/v2/neon-clients", {
    data: { firstName: "Cora", surename: uniqueSurname(), phoneNumber: DEFAULT_PHONE, email: `${unique("c")}@e2e.test`, ...overrides },
  });
  return dataOf<ClientRow>(res, 201);
}

export interface EnquiryInput {
  title?: string;
  travel_date?: string;
  adults?: number;
  children?: number;
  infants?: number;
  no_of_nights?: number;
  budget?: string;
  destinations?: string[];
  boardBases?: string[];
  departureAirports?: string[];
  /** Child passengers, e.g. [{ type: "child", age: 6 }]. */
  passengers?: { type: string; age: number }[];
  notes?: string;
}

/** Creates a deal that starts as an enquiry. Returns the transaction and enquiry ids. */
export async function apiCreateEnquiry(
  request: APIRequestContext,
  agency: DealsAgency,
  clientId: string,
  userId: string,
  input: EnquiryInput = {},
): Promise<{ transactionId: string; enquiryId: string }> {
  const res = await request.post("/api/v2/transactions", {
    data: {
      client_id: clientId,
      user_id: userId,
      enquiry: {
        title: input.title ?? `Enquiry ${unique("e")}`,
        holiday_type_id: agency.ref.packageType,
        travel_date: input.travel_date ?? "2027-06-14",
        adults: input.adults ?? 2,
        children: input.children ?? 0,
        infants: input.infants ?? 0,
        no_of_nights: input.no_of_nights ?? 7,
        budget: input.budget,
        status: "ACTIVE",
        destinations: input.destinations,
        boardBases: input.boardBases,
        departureAirports: input.departureAirports,
        passengers: input.passengers,
        notes: input.notes,
      },
    },
  });
  const data = await dataOf<{ transaction: { id: string }; enquiry: { id: string } }>(res, 201);
  return { transactionId: data.transaction.id, enquiryId: data.enquiry.id };
}

export interface QuoteInput {
  title?: string;
  travel_date?: string;
  sales_price?: string;
  package_commission?: string;
  discounts?: string;
  service_charge?: string;
  adult?: number;
  child?: number;
  infant?: number;
  num_of_nights?: number;
  main_tour_operator_id?: string;
  quote_status?: string;
  extra?: Record<string, unknown>;
}

export function quotePayload(agency: DealsAgency, input: QuoteInput = {}): Record<string, unknown> {
  return {
    holiday_type_id: agency.ref.packageType,
    travel_date: input.travel_date ?? "2027-06-14",
    quote_type: "manual",
    num_of_nights: input.num_of_nights ?? 7,
    adult: input.adult ?? 2,
    child: input.child ?? 0,
    infant: input.infant ?? 0,
    sales_price: input.sales_price ?? "2400.00",
    package_commission: input.package_commission ?? "240.00",
    discounts: input.discounts ?? "0",
    service_charge: input.service_charge ?? "0",
    title: input.title ?? `Quote ${unique("q")}`,
    main_tour_operator_id: input.main_tour_operator_id ?? agency.ref.operator,
    quote_status: input.quote_status ?? "quoted",
    ...(input.extra ?? {}),
  };
}

/** Creates a brand-new deal whose first quote is the primary one. */
export async function apiCreateQuoteDeal(
  request: APIRequestContext,
  agency: DealsAgency,
  clientId: string,
  userId: string,
  input: QuoteInput = {},
): Promise<{ transactionId: string; quoteId: string }> {
  const res = await request.post("/api/v2/transactions", {
    data: { client_id: clientId, user_id: userId, quote: quotePayload(agency, input) },
  });
  const data = await dataOf<{ transaction: { id: string }; quote: { id: string } }>(res, 201);
  return { transactionId: data.transaction.id, quoteId: data.quote.id };
}

/** Adds another quote to an existing deal. */
export async function apiAddQuote(
  request: APIRequestContext,
  agency: DealsAgency,
  transactionId: string,
  input: QuoteInput & { isQuoteCopy?: boolean } = {},
): Promise<string> {
  const res = await request.post("/api/v2/quotes", {
    data: { transaction_id: transactionId, isQuoteCopy: input.isQuoteCopy ?? true, ...quotePayload(agency, input) },
  });
  return (await dataOf<{ id: string }>(res, 201)).id;
}

/* -------------------------------- DB readers ------------------------------- */
export { dbBookingFor, dbClient, dbQuote, dbTransaction } from "./seed";

/** Opens a client's holiday (quote, enquiry or booking) page and waits for its top bar. */
export async function openHoliday(page: Page, clientId: string, kind: "quote" | "enquiry" | "booking", id: string): Promise<void> {
  await page.goto(`/clients/${clientId}?holiday=${kind}:${id}`);
  await expect(page.getByTestId("holiday-top-bar")).toBeVisible();
}

/** Opens the "..." actions menu in the holiday page's top bar. */
export async function openActionsMenu(page: Page): Promise<void> {
  await page.getByTestId("holiday-top-actions").getByTestId("client-header-actions").click();
}
