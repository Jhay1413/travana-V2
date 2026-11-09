/**
 * Browser-side stubs for the inbox. Everything the inbox reads comes from SendSeven through our server, and the
 * e2e server may not talk to the outside world, so every inbox route is answered here and nothing reaches the server
 * (the AI "generate enquiry" call included).
 */
import type { Page, Route } from "@playwright/test";
import type { ClientRow } from "./deals";

export const INBOX_CONVERSATION_ID = "conv-e2e-1";
export const INBOX_CONTACT_ID = "contact-e2e-1";

export interface StubbedIntent {
  enquiryTitle: string;
  holidayType: string;
  countries: string[];
  destinations: string[];
  resorts: string[];
  departureAirports: string[];
  boardBasis: string[];
  starRating: string;
  travelDate: string;
  flexibility: string;
  nights: number | null;
  adults: number;
  children: number;
  infants: number;
  childAges: number[];
  budget: string;
  budgetType: string;
  notes: string;
  confidence: "low" | "medium" | "high";
}

export const PACKAGE_INTENT: StubbedIntent = {
  enquiryTitle: "Majorca week in July",
  holidayType: "Package Holiday",
  countries: ["Spain"],
  destinations: ["Majorca"],
  resorts: [],
  departureAirports: ["Newcastle"],
  boardBasis: ["All Inclusive"],
  starRating: "4 Star",
  travelDate: "2027-07-10",
  flexibility: "Exact Date",
  nights: 7,
  adults: 2,
  children: 0,
  infants: 0,
  childAges: [],
  budget: "2500",
  budgetType: "Per Person",
  notes: "Quiet resort please",
  confidence: "high",
};

const ok = (data: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });

export interface InboxStubOptions {
  client: ClientRow;
  /** What the stubbed AI returns; a number makes it fail with that HTTP status instead. */
  intent: StubbedIntent | number;
  chatText?: string;
}

/** Answers every inbox endpoint in the browser. Returns the list of AI calls made (for assertions). */
export async function stubInbox(page: Page, opts: InboxStubOptions): Promise<{ aiCalls: string[] }> {
  const aiCalls: string[] = [];
  const now = new Date().toISOString();
  const text = opts.chatText ?? "Hi, we would love a week in Majorca in July, 2 adults, around 2500 each, all inclusive please.";
  const contact = { id: INBOX_CONTACT_ID, name: `${opts.client.firstName} ${opts.client.surename}`, phone: opts.client.phoneNumber ?? "07700900111" };
  const message = { id: "msg-1", conversation_id: INBOX_CONVERSATION_ID, direction: "inbound", message_type: "text", status: "delivered", created_at: now, text };
  const conversation = {
    id: INBOX_CONVERSATION_ID,
    tenant_id: "t1",
    channel_id: "ch1",
    channel_type: "sms",
    status: "open",
    created_at: now,
    updated_at: now,
    last_message_at: now,
    contact_id: INBOX_CONTACT_ID,
    contact,
    needs_reply: true,
    last_message: { id: "msg-1", text, created_at: now, direction: "inbound", message_type: "text" },
  };
  const pagination = { total: 1, page: 1, page_size: 25, total_pages: 1, has_next: false, has_prev: false };

  await page.route(/\/api\/v2\/(conversations|messages|inboxes|channels|comments|whatsapp-updates|contact-links|conversation-integration|ai-enquiry)(\/|\?|$)/, async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path === "/api/v2/ai-enquiry/from-conversation") {
      aiCalls.push(route.request().postData() ?? "");
      if (typeof opts.intent === "number") return route.fulfill({ status: opts.intent, contentType: "application/json", body: JSON.stringify({ success: false, message: "AI unavailable" }) });
      return route.fulfill(ok(opts.intent));
    }
    if (path.startsWith("/api/v2/contact-links/")) {
      if (path.includes("/by-client/")) return route.fulfill(ok({ clientId: opts.client.id, contactId: INBOX_CONTACT_ID, linkedAt: now }));
      return route.fulfill(ok({ contactId: INBOX_CONTACT_ID, linkedClient: opts.client, suggestions: [], suggestionMatch: "contact" }));
    }
    if (path === "/api/v2/inboxes") return route.fulfill(ok({ items: [] }));
    if (path === "/api/v2/conversations/badge-counts") {
      return route.fulfill(ok({ unanswered_assigned_to_me: 0, unassigned_count: 1, total_unanswered: 1, open_count: 1, snoozed_count: 0, is_multi_agent: false }));
    }
    if (path === "/api/v2/conversations" && method === "GET") return route.fulfill(ok({ items: [conversation], pagination }));
    if (path === `/api/v2/conversations/${INBOX_CONVERSATION_ID}` && method === "GET") return route.fulfill(ok(conversation));
    if (path === "/api/v2/messages" && method === "GET") return route.fulfill(ok({ items: [message], pagination }));
    if (path.endsWith("/previous")) return route.fulfill(ok({ items: [], total_previous: 0, distinct_channel_count: 0, mergeable: false }));
    if (path.endsWith("/ai-state")) return route.fulfill(ok({ enabled: false }));
    return route.fulfill(ok({ items: [] }));
  });
  return { aiCalls };
}
