/**
 * Customer portal: Rewards (tier, referrals, wallet, withdrawal) in the new look. Written, not yet run. This screen
 * handles money: the specs check the figures the customer sees, the validation, and that a withdrawal is requested
 * exactly once with the right amount and bank details.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { seedPortalCustomer, startSignedIn, type PortalSetup } from "../helpers/portal";
import { seedReferral, seedWalletCredit, setVipTier, walletBalanceFor, walletDebits, type SeededReferral } from "../helpers/portal-screens";

interface Fixture {
  c: PortalSetup;
  inWallet: SeededReferral;
  pending: SeededReferral;
  paid: SeededReferral;
  voided: SeededReferral;
}

/**
 * A Standard VIP customer with three counting referrals (one in the wallet, one pending and not yet due, one paid),
 * one voided referral, and £25.00 of commission in the wallet.
 */
async function fixture(page: Page): Promise<Fixture> {
  const c = await seedPortalCustomer();
  await setVipTier(c.clientId, "standard");
  const inWallet = await seedReferral(c.clientId, { name: "Sam Friend", status: "IN_WALLET", payout: "25.00", email: "sam.friend@e2e.test" });
  const pending = await seedReferral(c.clientId, { name: "Pending Pat", status: "PENDING", payout: "40.00", daysToTrip: 200 });
  const paid = await seedReferral(c.clientId, { name: "Paid Pam", status: "PAID", payout: "30.00" });
  const voided = await seedReferral(c.clientId, { name: "Voided Vic", status: "VOIDED", payout: "500.00" });
  await seedWalletCredit(c.clientId, "25.00", inWallet.id);
  await startSignedIn(page, c);
  return { c, inWallet, pending, paid, voided };
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

test.describe("customer portal: Rewards", () => {
  test("shows the tier with its progress, the earnings and the referrals (voided ones left out)", async ({ page }) => {
    const { inWallet, pending, paid, voided } = await fixture(page);
    await page.goto("/portal/referrals");
    await expect(page.getByTestId("portal-rewards")).toBeVisible();

    await expect(page.getByTestId("text-tier-label")).toHaveText("Standard VIP");
    await expect(page.getByTestId("text-tier-perks")).toHaveText("25% commission reward per referral");
    await expect(page.getByTestId("text-tier-referrals")).toHaveText("3 referrals");
    // Gold needs 3: three counting referrals is a full bar.
    await expect(page.getByTestId("text-tier-remaining")).toHaveText("Upgrade ready!");
    await expect(page.getByTestId("tier-progress")).toHaveAttribute("aria-valuenow", "100");
    await expect(page.getByRole("progressbar", { name: "Progress to Gold Member" })).toBeVisible();

    await expect(page.getByTestId("earnings-available")).toHaveText("£25.00");
    await expect(page.getByTestId("earnings-pending")).toHaveText("£40.00");
    await expect(page.getByTestId("earnings-total-paid")).toHaveText("£30.00");

    await expect(page.getByTestId("referrals-list").locator("> li")).toHaveCount(3);
    await expect(page.getByTestId(`referral-${inWallet.id}`)).toContainText("Sam Friend");
    await expect(page.getByTestId(`referral-status-${inWallet.id}`)).toHaveText("In Your Wallet");
    await expect(page.getByTestId(`referral-amount-${inWallet.id}`)).toHaveText("£25.00");
    await expect(page.getByTestId(`referral-status-${pending.id}`)).toHaveText("Pending");
    await expect(page.getByTestId(`referral-due-${pending.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`referral-status-${paid.id}`)).toHaveText("Paid Out");
    await expect(page.getByTestId(`referral-${voided.id}`)).toHaveCount(0);
    await expect(page.getByTestId("count-rewards-referrals")).toHaveText("3");
    await expect(page.getByTestId("count-rewards-wallet")).toHaveText("1");
  });

  test("a referral opens to its details, and closes again", async ({ page }) => {
    const { inWallet } = await fixture(page);
    await page.goto("/portal/referrals");
    const row = page.getByTestId(`button-referral-${inWallet.id}`);
    await expect(row).toHaveAttribute("aria-expanded", "false");
    await row.click();
    await expect(row).toHaveAttribute("aria-expanded", "true");
    const item = page.getByTestId(`referral-${inWallet.id}`);
    await expect(item).toContainText("sam.friend@e2e.test");
    await expect(item).toContainText("Commission rate");
    await expect(item).toContainText("25%");
    await expect(item).toContainText("Referred on");
    await row.click();
    await expect(row).toHaveAttribute("aria-expanded", "false");
  });

  test("a customer with no referrals sees the tier, the empty list and zero earnings", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);
    await page.goto("/portal/referrals");
    await expect(page.getByTestId("text-tier-label")).toHaveText("Not Enrolled");
    await expect(page.getByTestId("text-tier-remaining")).toHaveText("1 more referral");
    await expect(page.getByTestId("referrals-empty")).toBeVisible();
    await expect(page.getByTestId("earnings-available")).toHaveText("£0.00");
    await page.getByTestId("tab-rewards-wallet").click();
    await expect(page.getByTestId("wallet-balance")).toHaveText("£0.00");
    await expect(page.getByTestId("wallet-balance-note")).toHaveText("No available balance");
    await expect(page.getByTestId("button-open-withdraw")).toHaveCount(0);
    await expect(page.getByTestId("wallet-empty")).toBeVisible();
  });

  test("the Wallet tab shows the balance, the unreleased and paid-out figures and the transactions", async ({ page }) => {
    await fixture(page);
    await page.goto("/portal/referrals");
    await page.getByTestId("tab-rewards-wallet").click();
    await expect(page.getByTestId("tab-rewards-wallet")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("wallet-balance")).toHaveText("£25.00");
    await expect(page.getByTestId("wallet-balance-note")).toHaveText("£25.00 available to withdraw");
    await expect(page.getByTestId("wallet-unreleased")).toHaveText("£40.00");
    await expect(page.getByTestId("wallet-total-paid")).toHaveText("£30.00");
    const rows = page.getByTestId("wallet-transactions").locator("> li");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Commission credited");
    await expect(rows.first()).toContainText("Sam Friend");
    await expect(rows.first()).toContainText("+£25.00");
    await expect(page.getByTestId("button-open-withdraw")).toHaveText("Withdraw · £25.00");
  });

  test("the withdrawal form validates, then requests the whole balance exactly once with the bank details", async ({ page }) => {
    const { c } = await fixture(page);
    const logged: string[] = [];
    page.on("console", (m) => logged.push(m.text()));
    await page.goto("/portal/referrals");
    await page.getByTestId("tab-rewards-wallet").click();
    await page.getByTestId("button-open-withdraw").click();

    const sheet = page.getByTestId("sheet-withdraw");
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("withdraw-amount")).toHaveText("£25.00");
    await expect(page.getByTestId("button-withdraw-submit")).toHaveText("Withdraw £25.00");
    // Bank transfer is the only method offered (booking credit is switched off until the owner decides what it does).
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    await expect(sheet).not.toContainText(/booking credit/i);
    // The bank fields are plain text fields, as before.
    for (const id of ["input-account-name", "input-account-number", "input-sort-code"]) {
      await expect(page.getByTestId(id)).toHaveAttribute("type", "text");
    }

    // Empty and partly filled forms send nothing.
    const missing = "Please fill in all bank details before withdrawing.";
    await page.getByTestId("button-withdraw-submit").click();
    await expect(page.getByTestId("withdraw-error")).toHaveText(missing);
    await page.getByTestId("input-account-name").fill("A Customer");
    await page.getByTestId("input-account-number").fill("12345678");
    await page.getByTestId("button-withdraw-submit").click();
    await expect(page.getByTestId("withdraw-error")).toHaveText(missing);
    // Spaces alone are not details.
    await page.getByTestId("input-sort-code").fill("   ");
    await page.getByTestId("button-withdraw-submit").click();
    await expect(page.getByTestId("withdraw-error")).toHaveText(missing);
    expect(await walletDebits(c.clientId)).toEqual([]);

    await page.getByTestId("input-sort-code").fill("12-34-56");
    await page.getByTestId("button-withdraw-submit").click();

    await expect(page.getByTestId("withdraw-done")).toContainText("Withdrawal requested");
    await expect(page.getByTestId("withdraw-done-amount")).toHaveText("£25.00");
    await expect(page.getByTestId("withdraw-done-method")).toHaveText("Bank transfer");
    await expect(sheet).toContainText("Your agent will process your payment shortly.");

    const debits = await walletDebits(c.clientId);
    expect(debits).toHaveLength(1);
    expect(Number(debits[0].amount)).toBe(25);
    expect(debits[0]).toMatchObject({ source: "bank_transfer", status: "pending", account_name: "A Customer", account_number: "12345678", sort_code: "12-34-56" });
    expect(await walletBalanceFor(page)).toBe("0.00");

    // Closing shows the new balance, and the request in the history; nothing was sent twice.
    await page.getByTestId("button-withdraw-close").click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId("wallet-balance")).toHaveText("£0.00");
    await expect(page.getByTestId("button-open-withdraw")).toHaveCount(0);
    await expect(page.getByTestId("wallet-transactions")).toContainText("Withdrawal requested");
    await expect(page.getByTestId("wallet-transactions")).toContainText("−£25.00");
    expect(await walletDebits(c.clientId)).toHaveLength(1);

    // The account number and sort code are never written to the console.
    expect(logged.filter((l) => l.includes("12345678") || l.includes("12-34-56"))).toEqual([]);
  });

  test("the withdrawal sheet closes with Escape without sending anything, and starts empty next time", async ({ page }) => {
    const { c } = await fixture(page);
    await page.goto("/portal/referrals");
    await page.getByTestId("tab-rewards-wallet").click();
    await page.getByTestId("button-open-withdraw").click();
    await page.getByTestId("input-account-name").fill("Half Done");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sheet-withdraw")).toHaveCount(0);
    await page.getByTestId("button-open-withdraw").click();
    await expect(page.getByTestId("input-account-name")).toHaveValue("");
    expect(await walletDebits(c.clientId)).toEqual([]);
  });

  test("works at 360px wide on both tabs and in the withdrawal sheet", async ({ page }) => {
    const { inWallet } = await fixture(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/portal/referrals");
    await expect(page.getByTestId("rewards-referrals")).toBeVisible();
    await page.getByTestId(`button-referral-${inWallet.id}`).click();
    expect(await overflow(page)).toBeLessThanOrEqual(360);
    await page.getByTestId("tab-rewards-wallet").click();
    await expect(page.getByTestId("rewards-wallet")).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(360);
    await page.getByTestId("button-open-withdraw").click();
    await expect(page.getByTestId("sheet-withdraw")).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(360);
  });
});
