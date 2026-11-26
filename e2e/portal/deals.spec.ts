/**
 * Customer portal: the Deals tab in the new look. Written, not yet run. The list, the interest filter, a tag filter
 * (by mouse and keyboard), clearing filters, "I'm interested" once, For you, another agency's deals never shown,
 * and 360px.
 */
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { seedPortalCustomer, startSignedIn } from "../helpers/portal";
import { portalMessageTexts, seedPortalQuoteWorld, seedPublishedDeal, tagDealWithInterest, type PortalQuoteWorld, type SeededPortalQuote } from "../helpers/portal-quotes";
import { hideDealFromPortal, signInAs, tagDealWith } from "../helpers/portal-screens";

const token = () => randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

interface Fixture {
  q: PortalQuoteWorld;
  /** Matches the customer's saved interest. */
  beach: SeededPortalQuote;
  /** Tagged with something that is not one of the customer's interests. */
  golf: SeededPortalQuote;
  golfTag: string;
}

async function fixture(page: Page): Promise<Fixture> {
  const q = await seedPortalQuoteWorld(page);
  const beach = await seedPublishedDeal(page, q, { title: "Cyprus Beach Deal", token: token(), forClientId: null, salesPrice: "899.00" });
  await tagDealWithInterest(beach.id, q.portal.tagName);
  const golf = await seedPublishedDeal(page, q, { title: "Algarve Golf Deal", token: token(), forClientId: null, salesPrice: "1250.00" });
  const golfTag = `Golf ${token()}`;
  await tagDealWith(golf.id, golfTag);
  await startSignedIn(page, q.portal);
  return { q, beach, golf, golfTag };
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

test.describe("customer portal: Deals", () => {
  test("lists the deals that match the customer's interests, and 'Match my interests' off shows them all", async ({ page }) => {
    const { beach, golf } = await fixture(page);
    await page.goto("/portal/deals");

    await expect(page.getByTestId("portal-deals")).toBeVisible();
    await expect(page.getByTestId("nav-tab-deals")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("tab-deals-latest")).toHaveAttribute("aria-selected", "true");
    const card = page.getByTestId(`card-deal-${beach.id}`);
    await expect(card).toBeVisible();
    await expect(card).toContainText("Cyprus Beach Deal");
    await expect(card).toContainText("from £899.00");
    await expect(page.getByTestId(`card-deal-${golf.id}`)).toHaveCount(0);

    // The stored figure is not per person, so the page never says so.
    expect(await page.getByTestId("portal-deals").innerText()).not.toMatch(/per person/i);

    const toggle = page.getByTestId("chip-matching-interests");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId(`card-deal-${golf.id}`)).toBeVisible();
    await expect(page.getByTestId(`card-deal-${beach.id}`)).toBeVisible();
    await expect(page.getByTestId(`card-deal-${golf.id}`)).toContainText("from £1,250.00");
  });

  test("a tag chip filters by that tag (mouse and keyboard), turns the interest filter off, and choosing it again undoes it", async ({ page }) => {
    const { beach, golf, golfTag } = await fixture(page);
    await page.goto("/portal/deals");
    const chip = page.getByTestId(`button-tag-filter-${golfTag}`);
    await expect(chip).toBeVisible();

    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId(`card-deal-${golf.id}`)).toBeVisible();
    await expect(page.getByTestId(`card-deal-${beach.id}`)).toHaveCount(0);
    // A chosen tag replaces the interest filter, so its toggle goes away.
    await expect(page.getByTestId("chip-matching-interests")).toHaveCount(0);

    // Keyboard: Enter on the focused chip clears it, and the interest filter is back.
    await chip.focus();
    await page.keyboard.press("Enter");
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("chip-matching-interests")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId(`card-deal-${beach.id}`)).toBeVisible();
    await expect(page.getByTestId(`card-deal-${golf.id}`)).toHaveCount(0);
  });

  test("when the filters match nothing it says so and 'Clear filters' brings the list back", async ({ page }) => {
    const { q, beach } = await fixture(page);
    // A third deal with its own tag, which is hidden after the page has loaded the tag list.
    const rare = await seedPublishedDeal(page, q, { title: "Short Lived Deal", token: token(), forClientId: null });
    const rareTag = `Rare ${token()}`;
    await tagDealWith(rare.id, rareTag);

    await page.goto("/portal/deals");
    const chip = page.getByTestId(`button-tag-filter-${rareTag}`);
    await expect(chip).toBeVisible();
    await hideDealFromPortal(rare.id);

    await chip.click();
    await expect(page.getByTestId("text-empty-deals")).toContainText("No deals match");
    await expect(page.getByTestId("deals-list")).toHaveCount(0);
    await page.getByTestId("button-empty-clear-filters").click();
    await expect(page.getByTestId(`card-deal-${beach.id}`)).toBeVisible();
    await expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  test("'I'm interested' tells the agent once, shows the told state, and stays told after a reload", async ({ page }) => {
    const { q, beach } = await fixture(page);
    await page.goto("/portal/deals");
    await page.getByTestId(`button-interest-${beach.id}`).click();
    await expect(page.getByTestId(`deal-told-${beach.id}`)).toContainText("has been told");
    await expect(page.getByTestId(`button-interest-${beach.id}`)).toHaveCount(0);

    const told = async () => (await portalMessageTexts(q.portal.clientId)).filter((t) => t.includes(beach.id));
    expect(await told()).toHaveLength(1);

    await page.reload();
    await expect(page.getByTestId(`deal-told-${beach.id}`)).toBeVisible();
    expect(await told()).toHaveLength(1);
  });

  test("the card flips to told after a successful tap even when the summary could not load", async ({ page }) => {
    const { beach } = await fixture(page);
    await page.route("**/api/v2/portal/summary", (route) => route.abort());
    await page.goto("/portal/deals");
    await page.getByTestId(`button-interest-${beach.id}`).click();
    await expect(page.getByTestId(`deal-told-${beach.id}`)).toContainText("has been told");
    await expect(page.getByTestId(`button-interest-${beach.id}`)).toHaveCount(0);
  });

  test("For you lists only the deals matching the customer's tags; the empty For you sends them to their interests", async ({ page }) => {
    const { beach, golf } = await fixture(page);
    await page.goto("/portal/deals?tab=for-you");
    await expect(page.getByTestId("tab-deals-for-you")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId(`card-deal-${beach.id}`)).toBeVisible();
    await expect(page.getByTestId(`card-deal-${golf.id}`)).toHaveCount(0);
    await expect(page.getByTestId("deals-filters")).toHaveCount(0);

    // A customer with an interest but no matching deal.
    const lonely = await seedPortalCustomer();
    await signInAs(page, lonely);
    await page.goto("/portal/deals?tab=for-you");
    await expect(page.getByTestId("text-empty-deals")).toContainText("Nothing for you just yet");
    await page.getByTestId("button-empty-for-you-tags").click();
    await expect(page).toHaveURL(/\/portal\/tags/);
  });

  test("another agency's deals are never shown, in the list or from the API", async ({ page }) => {
    const { beach, golf } = await fixture(page);
    const outsider = await seedPortalCustomer();
    await signInAs(page, outsider);
    await page.goto("/portal/deals");
    await expect(page.getByTestId("portal-deals")).toBeVisible();
    // Interests on (the default), then off: either way nothing of the other agency.
    await expect(page.getByTestId("deals-empty")).toBeVisible();
    await page.getByTestId("button-empty-latest-browse-all").click();
    await expect(page.getByTestId("deals-empty")).toBeVisible();
    await expect(page.getByTestId(`card-deal-${beach.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`card-deal-${golf.id}`)).toHaveCount(0);

    const headers = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` };
    for (const url of ["/api/v2/portal/deals?recent=1", "/api/v2/portal/deals/for-you?recent=1"]) {
      const res = await page.request.get(url, { headers });
      expect(res.status()).toBe(200);
      expect(JSON.stringify(await res.json())).not.toMatch(new RegExp(`${beach.id}|${golf.id}`));
    }
  });

  test("the Travel interests button opens the interests page", async ({ page }) => {
    await fixture(page);
    await page.goto("/portal/deals");
    await page.getByTestId("link-travel-interests").click();
    await expect(page).toHaveURL(/\/portal\/tags/);
  });

  test("works at 360px wide: nothing overflows sideways", async ({ page }) => {
    const { beach } = await fixture(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/portal/deals");
    await expect(page.getByTestId(`card-deal-${beach.id}`)).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(360);
  });
});
