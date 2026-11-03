/**
 * Owner decision: referral agents get NO access to deals or clients.
 *
 * Their only screen is the Affiliate Hub (/referral-hub): a page that makes no deal or client calls of its own
 * (client/src/pages/referral-agent/index.tsx keeps its referrals in local state, and the server's /referrals
 * endpoints are for org admins and branch managers). So every deal endpoint (transactions, pipeline, quotes,
 * bookings, enquiries, upsells) and the client endpoints answer 403 for them, the hub still loads, and an agent
 * of the same shop is the control that the same calls work.
 */
import type { APIResponse, Page } from "@playwright/test";
import { dataOf, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { bookedDeal, boardWorld, enquiryDeal, quoteDeal, type BoardWorld } from "../helpers/pipeline";
import { queryRows, seedMember } from "../helpers/seed";
import { REFERRAL_AGENT_ALLOWED_MOUNTS } from "../../server/v2/middlewares/auth/referral-allowed-mounts";

async function build(page: Page) {
  const w = await boardWorld(page); // signed in as the shop's agent
  const quote = await quoteDeal(page.request, w, { title: "Referral-proof quote" });
  const enquiry = await enquiryDeal(page.request, w, "Referral-proof enquiry");
  const booked = await bookedDeal(page.request, w, { title: "Referral-proof booking" });
  const [{ id: bookingId }] = await queryRows<{ id: string }>(`select id from booking_table where transaction_id = $1`, [booked.transactionId]);
  const referral = await seedMember({ orgId: w.agency.orgId, branchId: w.agency.branchId, orgRole: "referral_agent", firstName: "Rita", lastName: "Referrer" });
  return { w, quote, enquiry, booked, bookingId, referral };
}

type Fixture = Awaited<ReturnType<typeof build>>;
type Call = [name: string, run: (page: Page, f: Fixture) => Promise<APIResponse>];

const CALLS: Call[] = [
  ["GET /transactions", (p) => p.request.get("/api/v2/transactions")],
  ["GET /transactions?clientId=", (p, f) => p.request.get(`/api/v2/transactions?clientId=${f.w.clientId}`)],
  ["GET /transactions/pipeline/quote", (p) => p.request.get("/api/v2/transactions/pipeline/quote?limit=50")],
  ["GET /transactions/pipeline/enquiry", (p) => p.request.get("/api/v2/transactions/pipeline/enquiry?limit=50")],
  ["GET /transactions/pipeline/lost", (p) => p.request.get("/api/v2/transactions/pipeline/lost?limit=50")],
  ["GET /transactions/:id", (p, f) => p.request.get(`/api/v2/transactions/${f.quote.transactionId}`)],
  ["POST /transactions", (p, f) => p.request.post("/api/v2/transactions", { data: { client_id: f.w.clientId, user_id: f.referral.id } })],
  ["PATCH /transactions/:id/priority", (p, f) => p.request.patch(`/api/v2/transactions/${f.quote.transactionId}/priority`, { data: { priority: "high" } })],
  ["POST /transactions/:id/lost", (p, f) => p.request.post(`/api/v2/transactions/${f.quote.transactionId}/lost`, { data: { lost: true } })],
  ["DELETE /transactions/:id", (p, f) => p.request.delete(`/api/v2/transactions/${f.quote.transactionId}`)],
  ["GET /quotes", (p) => p.request.get("/api/v2/quotes")],
  ["GET /quotes/:id", (p, f) => p.request.get(`/api/v2/quotes/${f.quote.entityId}`)],
  ["PATCH /quotes/:id", (p, f) => p.request.patch(`/api/v2/quotes/${f.quote.entityId}`, { data: { title: "Hijacked" } })],
  ["DELETE /quotes/:id", (p, f) => p.request.delete(`/api/v2/quotes/${f.quote.entityId}`)],
  ["POST /quotes", (p, f) => p.request.post("/api/v2/quotes", { data: { transaction_id: f.quote.transactionId } })],
  ["GET /bookings", (p) => p.request.get("/api/v2/bookings")],
  ["GET /bookings/:id", (p, f) => p.request.get(`/api/v2/bookings/${f.bookingId}`)],
  ["PATCH /bookings/:id", (p, f) => p.request.patch(`/api/v2/bookings/${f.bookingId}`, { data: { supplier_ref: "HIJACKED" } })],
  ["DELETE /bookings/:id", (p, f) => p.request.delete(`/api/v2/bookings/${f.bookingId}`)],
  ["POST /bookings/convert/:quoteId", (p, f) => p.request.post(`/api/v2/bookings/convert/${f.quote.entityId}`, { data: { haysRef: "HAY-7654321", supplierRef: "X" } })],
  ["GET /bookings/:id/upsells", (p, f) => p.request.get(`/api/v2/bookings/${f.bookingId}/upsells`)],
  ["GET /enquiries/:id", (p, f) => p.request.get(`/api/v2/enquiries/${f.enquiry.entityId}`)],
  ["PATCH /enquiries/:id", (p, f) => p.request.patch(`/api/v2/enquiries/${f.enquiry.entityId}`, { data: { title: "Hijacked" } })],
  ["POST /enquiries", (p, f) => p.request.post("/api/v2/enquiries", { data: { transaction_id: f.enquiry.transactionId } })],
  ["GET /clients", (p) => p.request.get("/api/v2/clients")],
  ["GET /neon-clients", (p) => p.request.get("/api/v2/neon-clients")],
  ["GET /neon-clients/:id", (p, f) => p.request.get(`/api/v2/neon-clients/${f.w.clientId}`)],
  ["GET /notes/client/:id", (p, f) => p.request.get(`/api/v2/notes/client/${f.w.clientId}?includeDeals=true`)],
  ["GET /notes/transaction/:id", (p, f) => p.request.get(`/api/v2/notes/transaction/${f.quote.transactionId}`)],
  ["POST /notes", (p, f) => p.request.post("/api/v2/notes", { data: { transaction_id: f.quote.transactionId, content: "<p>x</p>" } })],
  ["GET /tasks/all", (p) => p.request.get("/api/v2/tasks/all")],
  ["GET /tasks/for-client/:id", (p, f) => p.request.get(`/api/v2/tasks/for-client/${f.w.clientId}`)],
  ["GET /tickets", (p) => p.request.get("/api/v2/tickets")],
  ["GET /search", (p) => p.request.get("/api/v2/search?q=Referral")],
  ["GET /opportunities", (p) => p.request.get("/api/v2/opportunities")],
  ["GET /favorites", (p) => p.request.get("/api/v2/favorites")],
  ["GET /client-files", (p, f) => p.request.get(`/api/v2/client-files/${f.w.clientId}`)],
  ["GET /note-attachments", (p, f) => p.request.get(`/api/v2/note-attachments/transaction/${f.quote.transactionId}`)],
  ["POST /ai/ask/save", (p) => p.request.post("/api/v2/ai/ask/save", { data: { question: "q", answer: "a" } })],
  ["GET /ai-enquiry", (p) => p.request.get("/api/v2/ai-enquiry")],
  ["GET /sms", (p) => p.request.get("/api/v2/sms")],
  ["GET /image-upscale", (p) => p.request.get("/api/v2/image-upscale")],
  ["GET /dashboard/my-profit", (p) => p.request.get("/api/v2/dashboard/my-profit")],
  ["GET /dashboard/agent-stats", (p) => p.request.get("/api/v2/dashboard/agent-stats")],
  ["GET /conversations", (p) => p.request.get("/api/v2/conversations")],
  ["GET /reports", (p) => p.request.get("/api/v2/reports")],
  ["GET /departures", (p) => p.request.get("/api/v2/departures")],
  ["GET /wallet", (p) => p.request.get("/api/v2/wallet")],
  ["GET /targets", (p) => p.request.get("/api/v2/targets")],
  ["GET /revenue", (p) => p.request.get("/api/v2/revenue")],
  ["GET /branch-overview", (p) => p.request.get("/api/v2/branch-overview")],
  ["GET /agent-profile", (p) => p.request.get("/api/v2/agent-profile")],
  ["GET /destination-guru", (p) => p.request.get("/api/v2/destination-guru")],
  ["GET /quote-share", (p) => p.request.get("/api/v2/quote-share")],
  ["GET /airports", (p) => p.request.get("/api/v2/airports")],
  ["GET /tour-operators", (p) => p.request.get("/api/v2/tour-operators")],
  ["GET /tags", (p) => p.request.get("/api/v2/tags")],
];

test.describe("referral agents and deals", () => {
  test("a referral agent gets 403 on every deal and client endpoint, and nothing changes", async ({ page }) => {
    const f = await build(page);
    await signIn(page, f.referral.email);
    for (const [name, run] of CALLS) {
      const res = await run(page, f);
      expect(res.status(), `${name}: ${await res.text()}`).toBe(403);
    }
    const [q] = await queryRows<{ title: string; deleted_at: string | null; quote_status: string }>(`select title, deleted_at, quote_status from quote_table where id = $1`, [f.quote.entityId]);
    expect(q).toEqual({ title: "Referral-proof quote", deleted_at: null, quote_status: "quoted" });
    const [t] = await queryRows<{ priority: string; status: string }>(`select priority, status from transaction where id = $1`, [f.quote.transactionId]);
    expect(t).toEqual({ priority: "low", status: "on_quote" });
    const [b] = await queryRows<{ supplier_ref: string }>(`select supplier_ref from booking_table where id = $1`, [f.bookingId]);
    expect(b.supplier_ref).toBe("TUI 1");
    expect((await queryRows(`select 1 from transaction where client_id = $1`, [f.w.clientId])).length, "no deal was created").toBe(3);
  });

  test("a referral agent reaches only the allow-listed mounts (none of them answers 403)", async ({ page }) => {
    const f = await build(page);
    await signIn(page, f.referral.email);
    // /realtime is a live event stream that never ends, so it is left out of the request loop.
    for (const mount of REFERRAL_AGENT_ALLOWED_MOUNTS.filter((m) => m !== "realtime")) {
      const res = await page.request.get(`/api/v2/${mount}`);
      expect(res.status(), `/${mount}`).not.toBe(403);
      expect(res.status(), `/${mount} must not fail on the server`).toBeLessThan(500);
    }
    // And real allowed endpoints answer 200, so "not 403" cannot hide a route that is simply broken or missing.
    for (const path of ["/api/v2/users/profiles/me", "/api/v2/notifications", "/api/v2/announcements"]) {
      const res = await page.request.get(path);
      expect(res.status(), `${path}: ${await res.text()}`).toBe(200);
    }
    expect((await page.request.get("/api/v2/users")).status(), "the team directory is closed").toBe(403);
  });

  test("control: an agent of the same shop gets the same calls through (reads 200)", async ({ page }) => {
    const f = await build(page);
    await signIn(page, f.w.agency.agentEmail);
    for (const name of ["GET /transactions", "GET /transactions/pipeline/quote", "GET /quotes/:id", "GET /bookings/:id", "GET /enquiries/:id", "GET /neon-clients/:id"]) {
      const [, run] = CALLS.find(([n]) => n === name)!;
      const res = await run(page, f);
      expect(res.status(), `${name}: ${await res.text()}`).toBe(200);
    }
  });

  test("the Affiliate Hub still loads for a referral agent and nothing it calls is refused", async ({ page }) => {
    const f = await build(page);
    await signIn(page, f.referral.email);
    const refused: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/") && (r.status() === 401 || r.status() === 403)) refused.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("/");
    await expect(page).toHaveURL(/\/referral-hub$/);
    await expect(page.getByRole("heading", { name: "Submit a referral" })).toBeVisible();
    await expect(page.getByTestId("button-show-referral-form")).toBeVisible();
    await page.getByTestId("button-show-referral-form").click();
    await expect(page.getByText("Referrals", { exact: true }).first()).toBeVisible();
    expect(refused, "the hub makes no refused calls").toEqual([]);
  });

  test("a referral agent cannot open the board or a client page from the browser", async ({ page }) => {
    const f = await build(page);
    await signIn(page, f.referral.email);
    // Wait for the app's "403 - Access denied" screen (the loaded marker) before asserting that the deal
    // screens are absent, so "not here" cannot be true just because nothing has rendered yet.
    const denied = page.getByText("403 — Access denied");
    await page.goto("/pipeline");
    await expect(denied).toBeVisible();
    await expect(page.getByTestId("pipeline-title")).toHaveCount(0);
    await page.goto(`/clients/${f.w.clientId}`);
    await expect(denied).toBeVisible();
    await expect(page.getByText("Referral-proof quote")).toHaveCount(0);
  });
});
