/**
 * Owner decision: an agent or branch manager with NO shop (a newly created agent before branch assignment) sees and
 * edits NO deals. It fails closed on the board, the client page's deals list and the pickers behind it, and on every
 * write scope. Org admins are unaffected, and the pages still load (an empty state is fine).
 */
import type { Page } from "@playwright/test";
import { dataOf, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { openBoard } from "../helpers/pipeline";
import { shopsWorld } from "../helpers/shops";
import { queryRows, seedBranchlessMember } from "../helpers/seed";

for (const orgRole of ["agent", "branch_manager"] as const) {
  test.describe(`a ${orgRole} with no shop`, () => {
    test("sees no deals on the board or the client page, and every deal write is refused", async ({ page }) => {
      const o = await shopsWorld(page);
      const nobody = await seedBranchlessMember({ orgId: o.agency.orgId, orgRole });

      // Control: the same deals are visible to the org admin and to the shop's own agent.
      await signIn(page, o.agency.adminEmail);
      const adminBoard = await dataOf<{ items: { id: string }[] }>(await page.request.get("/api/v2/transactions/pipeline/quote?limit=50"));
      expect(adminBoard.items.map((i) => i.id)).toContain(o.deal2.transactionId);
      await signIn(page, o.agent2.email);
      const shop2Board = await dataOf<{ items: { id: string }[] }>(await page.request.get("/api/v2/transactions/pipeline/quote?limit=50"));
      expect(shop2Board.items.map((i) => i.id)).toContain(o.deal2.transactionId);

      await signIn(page, nobody.email);
      for (const column of ["enquiry", "quote", "booking", "lost", "future"]) {
        const res = await page.request.get(`/api/v2/transactions/pipeline/${column}?limit=50`);
        expect(res.status(), `board column ${column}`).toBe(200);
        const board = await dataOf<{ items: unknown[] }>(res);
        expect(board.items, `board column ${column}`).toEqual([]);
      }
      // The client page's deals list, and the pickers built on it, are empty for every client of the agency.
      for (const clientId of [o.deal2.clientId, o.booked2.clientId, o.w.clientId]) {
        expect(await dataOf<unknown[]>(await page.request.get(`/api/v2/transactions?clientId=${clientId}`)), clientId).toEqual([]);
      }
      expect(await dataOf<unknown[]>(await page.request.get("/api/v2/transactions"))).toEqual([]);

      // By-id reads: nothing opens, even though the deals are in the agent's own agency.
      const byId: [string, string][] = [
        ["quote", `/api/v2/quotes/${o.deal2.entityId}`],
        ["booking", `/api/v2/bookings/${o.booked2.bookingId}`],
        ["transaction", `/api/v2/transactions/${o.deal2.transactionId}`],
        ["enquiry", `/api/v2/enquiries/${o.enquiry2.entityId}`],
        ["enquiry by deal", `/api/v2/enquiries/transaction/${o.enquiry2.transactionId}`],
        ["deal notes", `/api/v2/notes/transaction/${o.deal2.transactionId}`],
      ];
      for (const [label, url] of byId) {
        const res = await page.request.get(url);
        expect(res.status(), `${label}: ${await res.text()}`).toBe(404);
      }
      // Opportunities and search: no deals, no bookings.
      for (const kind of ["quotes", "bookings", "enquiries"]) {
        const list = await dataOf<{ items: unknown[]; total: number }>(await page.request.get(`/api/v2/opportunities/${kind}?limit=100`));
        expect(list.items, `opportunities ${kind}`).toEqual([]);
      }
      const found = await dataOf<{ bookings: unknown[] }>(await page.request.get("/api/v2/search?q=HAY-1234567"));
      expect(found.bookings, "search finds no booking").toEqual([]);

      // Writes: refused, nothing changes.
      const q = o.deal2.entityId;
      const writes = [
        page.request.patch(`/api/v2/quotes/${q}`, { data: { title: "Hacked" } }),
        page.request.delete(`/api/v2/quotes/${q}`),
        page.request.patch(`/api/v2/quotes/${q}/flights/${o.deal2.flightId}`, { data: { flight_number: "HACKED" } }),
        page.request.post(`/api/v2/quotes/${q}/images`, { data: { images: ["https://images.e2e.test/a.jpg"] } }),
        page.request.patch(`/api/v2/bookings/${o.booked2.bookingId}`, { data: { supplier_ref: "HACKED" } }),
        page.request.delete(`/api/v2/bookings/${o.booked2.bookingId}`),
        page.request.post(`/api/v2/bookings/convert/${q}`, { data: { haysRef: "HAY-7654321", supplierRef: "X" } }),
        page.request.patch(`/api/v2/enquiries/${o.enquiry2.entityId}`, { data: { title: "Hacked" } }),
        page.request.post("/api/v2/notes", { data: { transaction_id: o.deal2.transactionId, content: "<p>x</p>", agent_id: nobody.id } }),
        page.request.post(`/api/v2/transactions/${o.deal2.transactionId}/lost`, { data: { lost: true } }),
        page.request.patch(`/api/v2/transactions/${o.deal2.transactionId}/priority`, { data: { priority: "high" } }),
      ];
      // Nothing here is readable for them, so every write is a plain 404 (never "another shop", which would confirm the deal exists).
      for (const res of await Promise.all(writes)) expect(res.status(), await res.text()).toBe(404);
      const [row] = await queryRows<{ title: string; deleted_at: string | null }>(`select title, deleted_at from quote_table where id = $1`, [q]);
      expect(row).toEqual({ title: "Shop 2 deal", deleted_at: null });
      const [booking] = await queryRows<{ supplier_ref: string }>(`select supplier_ref from booking_table where id = $1`, [o.booked2.bookingId]);
      expect(booking.supplier_ref).toBe("TUI 1");
    });

    test("their pages still load without errors (an empty state is fine)", async ({ page }) => {
      const o = await shopsWorld(page);
      const nobody = await seedBranchlessMember({ orgId: o.agency.orgId, orgRole });
      await signIn(page, nobody.email);

      const problems: string[] = [];
      page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
      page.on("response", (r) => {
        if (r.url().includes("/api/") && r.status() >= 500) problems.push(`${r.status()} ${r.url()}`);
      });
      const routes = ["/", orgRole === "agent" ? "/agent-overview" : "/branch-overview", "/pipeline", "/clients", `/clients/${o.deal2.clientId}`, "/my-profile"];
      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");
        await expect(page.locator("body")).not.toContainText(/something went wrong|application error/i);
      }
      await expectPipelineEmpty(page, o.deal2.transactionId);
      expect(problems).toEqual([]);
    });
  });
}

async function expectPipelineEmpty(page: Page, transactionId: string) {
  // openBoard waits until every column and the chip counts have answered (200) and the spinners are gone, so an
  // absent card can only be true because the server did not send it.
  await openBoard(page);
  await expect(page.getByTestId(`pipeline-card-${transactionId}`)).toHaveCount(0);
}
