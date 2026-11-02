import type { Page } from "@playwright/test";
import { expect } from "./fixtures";
import { uniqueEmail } from "./seed";

export const VALID_PHONE = "0191 000 0000";
export const VALID_ADDRESS = "12 High Street, Newcastle";

/** Opens /onboarding for the signed-in pending owner and waits for the first step. */
export async function openWizard(page: Page): Promise<void> {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Welcome to Travana" })).toBeVisible();
}

export interface BusinessInput {
  type?: "single" | "multi";
  phone?: string;
  address?: string;
}

/** Fills the business step (name and email are prefilled from signup). Does not press Next. */
export async function fillBusiness(page: Page, input: BusinessInput = {}): Promise<void> {
  if (input.type === "multi") await page.getByRole("radio", { name: "Multi Shops" }).click();
  await page.getByLabel("Phone", { exact: true }).fill(input.phone ?? VALID_PHONE);
  await page.getByLabel("Address", { exact: true }).fill(input.address ?? VALID_ADDRESS);
}

export async function clickNext(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Next/ }).click();
}

export async function skipForNow(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Skip for now" }).click();
}

export async function expectDoneStep(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();
}

export async function goToDashboard(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Go to dashboard/ }).click();
  await expect(page).toHaveURL(/\/agency\/overview$/);
}

export interface ShopInput {
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  managerEmail?: string;
}

/** Fills the open shop card on the shops step. */
export async function fillShop(page: Page, shop: ShopInput): Promise<void> {
  await page.locator("#shop-name").fill(shop.name);
  await page.locator("#shop-phone").fill(shop.phone ?? VALID_PHONE);
  await page.locator("#shop-address").fill(shop.address ?? VALID_ADDRESS);
  await page.locator("#shop-email").fill(shop.email ?? uniqueEmail("shop"));
  if (shop.managerEmail) await page.locator("#shop-manager-email").fill(shop.managerEmail);
}

export interface PersonInput {
  first: string;
  last: string;
  email: string;
}

/** Fills row `n` (1-based) of a people table. */
export async function fillPerson(page: Page, n: number, person: PersonInput): Promise<void> {
  await page.getByLabel(`First name, person ${n}`).fill(person.first);
  await page.getByLabel(`Last name, person ${n}`).fill(person.last);
  await page.getByLabel(`Email address, person ${n}`).fill(person.email);
}

/** Picks an option in a Radix select by its accessible name. */
export async function choose(page: Page, selectName: string, optionName: string): Promise<void> {
  await page.getByRole("combobox", { name: selectName }).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

export function csvBuffer(text: string): Buffer {
  return Buffer.from(text, "utf8");
}
