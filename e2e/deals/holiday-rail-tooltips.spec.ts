/** Left "All holidays" panel: a long quote title is cut off with "…" and shows the full title in a tooltip on hover. */
import { apiCreateClient, apiCreateQuoteDeal, openHoliday, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { seedDealsAgency, unique } from "../helpers/seed";

test("a truncated quote title shows the full title on hover", async ({ page }) => {
  const agency = await seedDealsAgency();
  const userId = await signIn(page, agency.agentEmail);
  const client = await apiCreateClient(page.request);
  const title = `A very long quote title for a family holiday to the Costa del Sol with sea view rooms ${unique("t")}`;
  const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId, { title });

  await openHoliday(page, client.id, "quote", deal.quoteId);
  const titleEl = page.getByTestId(`holiday-link-${deal.quoteId}`).getByTestId("holiday-link-title");
  await expect(titleEl).toHaveText(title);
  // Cut off: the text is wider than the box.
  expect(await titleEl.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

  await titleEl.hover();
  await expect(page.getByRole("tooltip")).toContainText(title);
});
