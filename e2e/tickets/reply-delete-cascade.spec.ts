/**
 * Deleting a ticket comment deletes everything beneath it, including other people's replies.
 * Driven through the holiday Tickets tab, whose confirm text names how many replies go with it.
 */
import { apiCreateClient, apiCreateEnquiry, dataOf, openHoliday, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { queryRows } from "../helpers/seed";
import { apiCreateTicket, dbReplies, ticketSubject, workWorld } from "../helpers/work";

test.describe("deleting a comment with replies", () => {
  test("the confirm text counts the replies, and confirming removes the comment, every reply (even Bea's) and their likes", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const client = await apiCreateClient(page.request);
    const enquiry = await apiCreateEnquiry(page.request, w.agency, client.id, w.agent.id);
    const t = await apiCreateTicket(page.request, { subject: ticketSubject("Cascade"), clientId: client.id, assignedTo: w.agentB.id });

    const keep = await dataOf<{ id: string }>(await page.request.post(`/api/v2/replies/ticket/${t.id}`, { data: { content: "A comment that stays" } }), 201);
    const top = await dataOf<{ id: string }>(await page.request.post(`/api/v2/replies/ticket/${t.id}`, { data: { content: "Comment to delete" } }), 201);
    await signIn(page, w.agentB.email);
    const child1 = await dataOf<{ id: string }>(
      await page.request.post(`/api/v2/replies/ticket/${t.id}`, { data: { content: "Bea first reply", parentReplyId: top.id } }),
      201,
    );
    await dataOf(await page.request.post(`/api/v2/replies/ticket/${t.id}`, { data: { content: "Bea second reply", parentReplyId: child1.id } }), 201);
    expect((await page.request.post(`/api/v2/replies/${child1.id}/like`)).ok()).toBe(true);
    // Both replies hang off the top comment (threads are one level deep).
    expect((await dbReplies(t.id)).filter((r) => r.parent_reply_id === top.id)).toHaveLength(2);

    await signIn(page, w.agent.email);
    await openHoliday(page, client.id, "enquiry", enquiry.enquiryId);
    await page.getByTestId("holiday-activity-tab-tickets").click();
    await page.getByTestId(`holiday-ticket-toggle-${t.id}`).click();

    await page.getByTestId(`ticket-reply-delete-${top.id}`).click();
    await expect(page.getByTestId(`ticket-reply-delete-warning-${top.id}`)).toHaveText("This will also delete 2 replies.");

    // A comment with no replies shows no such warning.
    await page.getByTestId(`ticket-reply-${top.id}`).getByRole("button", { name: "No", exact: true }).click();
    await page.getByTestId(`ticket-reply-delete-${keep.id}`).click();
    await expect(page.getByTestId(`ticket-reply-delete-warning-${keep.id}`)).toHaveCount(0);
    await page.getByTestId(`ticket-reply-${keep.id}`).getByRole("button", { name: "No", exact: true }).click();

    await page.getByTestId(`ticket-reply-delete-${top.id}`).click();
    await page.getByTestId(`ticket-reply-delete-confirm-${top.id}`).click();

    await expect(page.getByText("Comment to delete")).toHaveCount(0);
    await expect(page.getByText("Bea first reply")).toHaveCount(0);
    await expect(page.getByText("Bea second reply")).toHaveCount(0);
    await expect(page.getByText("A comment that stays")).toBeVisible();
    expect((await dbReplies(t.id)).map((r) => r.content)).toEqual(["A comment that stays"]);
    expect(await queryRows(`select 1 from ticket_reply_likes where reply_id = $1`, [child1.id])).toHaveLength(0);
  });

  test("someone else's comment cannot be deleted, and nothing changes", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const t = await apiCreateTicket(page.request, { subject: ticketSubject("Cascade denied"), assignedTo: w.agentB.id });
    const top = await dataOf<{ id: string }>(await page.request.post(`/api/v2/replies/ticket/${t.id}`, { data: { content: "Ann's comment" } }), 201);
    await dataOf(await page.request.post(`/api/v2/replies/ticket/${t.id}`, { data: { content: "Ann's own reply", parentReplyId: top.id } }), 201);

    await signIn(page, w.agentB.email);
    const res = await page.request.delete(`/api/v2/replies/${top.id}`);
    expect(res.status()).toBe(403);
    expect(await dbReplies(t.id)).toHaveLength(2);
  });
});
