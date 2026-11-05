/**
 * A reply must read as a reply: indented under the note it answers, on a thread line, with a smaller avatar and
 * "Replying to <name>". Top-level notes stay full width. Driven on the ticket page and the holiday Tickets tab.
 */
import { apiCreateClient, apiCreateEnquiry, dataOf, openHoliday, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { apiCreateTicket, ticketSubject, workWorld } from "../helpers/work";

test.describe("nested replies", () => {
  test("ticket page: the reply sits on a rail to the right of its parent and says who it answers", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const t = await apiCreateTicket(page.request, { subject: ticketSubject("Nest"), type: "Build", assignedTo: w.agentB.id });
    const top = await dataOf<{ id: string }>(await page.request.post(`/api/v2/replies/ticket/${t.id}`, { data: { content: "Top note" } }), 201);
    const child = await dataOf<{ id: string }>(
      await page.request.post(`/api/v2/replies/ticket/${t.id}`, { data: { content: "Answer note", parentReplyId: top.id } }),
      201,
    );

    await page.goto(`/tickets/${t.id}`);
    await expect(page.getByTestId("ticket-centre-header")).toBeVisible();
    const parentBox = (await page.getByTestId(`ticket-note-${top.id}`).boundingBox())!;
    const rail = page.getByTestId(`ticket-note-replies-${top.id}`);
    const childCard = rail.getByTestId(`ticket-note-${child.id}`);
    await expect(childCard).toBeVisible();
    const childBox = (await childCard.boundingBox())!;
    expect(childBox.x).toBeGreaterThan(parentBox.x + 24);
    expect(childBox.width).toBeLessThan(parentBox.width);
    await expect(page.getByTestId(`ticket-note-replying-to-${child.id}`)).toContainText("Replying to Ann Agent");
    await expect(page.getByTestId(`ticket-note-replying-to-${top.id}`)).toHaveCount(0);
  });

  test("holiday Tickets tab: the reply is indented on a thread line under its parent, whoever wrote it", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    const enquiry = await apiCreateEnquiry(page.request, w.agency, client.id, w.agent.id);
    const t = await apiCreateTicket(page.request, { subject: ticketSubject("Nest tab"), clientId: client.id, assignedTo: w.agentB.id });
    const top = await dataOf<{ id: string }>(await page.request.post(`/api/v2/replies/ticket/${t.id}`, { data: { content: "Tab top note" } }), 201);
    const child = await dataOf<{ id: string }>(
      await page.request.post(`/api/v2/replies/ticket/${t.id}`, { data: { content: "Tab answer", parentReplyId: top.id } }),
      201,
    );

    await openHoliday(page, client.id, "enquiry", enquiry.enquiryId);
    await page.getByTestId("holiday-activity-tab-tickets").click();
    await page.getByTestId(`holiday-ticket-toggle-${t.id}`).click();

    const parentBox = (await page.getByTestId(`ticket-reply-${top.id}`).boundingBox())!;
    const rail = page.getByTestId(`ticket-reply-replies-${top.id}`);
    const childRow = rail.getByTestId(`ticket-reply-${child.id}`);
    await expect(childRow).toBeVisible();
    expect((await childRow.boundingBox())!.x).toBeGreaterThan(parentBox.x + 24);
    await expect(page.getByTestId(`ticket-reply-replying-to-${child.id}`)).toContainText("Replying to Ann Agent");
  });
});
