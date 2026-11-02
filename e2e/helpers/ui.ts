/** Small UI drivers for the app's custom controls (date picker, searchable selects, Radix selects). */
import type { Locator, Page } from "@playwright/test";
import { expect } from "./fixtures";

/** Scrolls the control to the middle of its scroll area so a dropdown opening below it stays on screen. */
async function centre(el: Locator): Promise<void> {
  await el.evaluate((node) => node.scrollIntoView({ block: "center" }));
}

/** Picks `iso` (yyyy-MM-dd) in the app's DatePicker whose trigger button is `trigger`. */
export async function pickDate(page: Page, trigger: Locator, iso: string): Promise<void> {
  const [year, month] = iso.split("-").map(Number);
  await centre(trigger);
  await trigger.click();
  const year$ = page.locator('select[aria-label*="Year" i]').last();
  const month$ = page.locator('select[aria-label*="Month" i]').last();
  await expect(year$).toBeVisible();
  await year$.selectOption(String(year));
  await month$.selectOption(String(month - 1));
  await page.locator(`td[data-day="${iso}"]:not([data-outside="true"]) button`).click();
  await expect(trigger).toContainText(`${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`);
}

/** Radix <Select>: opens the trigger and clicks the option with exactly this name. */
export async function chooseOption(page: Page, trigger: Locator, name: string): Promise<void> {
  await centre(trigger);
  await trigger.click();
  await page.getByRole("option", { name, exact: true }).click();
}

/** The app's SearchableSelect / MultiSearchableSelect: open, (optionally search), click the option. Multi selects stay open, so close them again. */
export async function chooseSearchable(page: Page, trigger: Locator, name: string, opts: { multi?: boolean; search?: string } = {}): Promise<void> {
  await centre(trigger);
  await trigger.click();
  const listbox = page.getByRole("listbox").last();
  await expect(listbox).toBeVisible();
  if (opts.search) await listbox.getByRole("textbox").fill(opts.search);
  await listbox.getByRole("option", { name }).first().click();
  if (opts.multi) await trigger.click(); // toggle closed (Escape would close the drawer)
  await expect(page.getByRole("listbox")).toHaveCount(0);
}

/** Sets a number input to exactly this value. */
export async function setNumber(input: Locator, value: number): Promise<void> {
  await input.fill(String(value));
  await expect(input).toHaveValue(String(value));
}
