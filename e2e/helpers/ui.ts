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

/**
 * Radix <Select>: opens the trigger and clicks the option with exactly this name.
 * Radix keeps the page's pointer-events off until the closing list has fully unmounted (after its fade-out), and a
 * click that lands in that last frame is swallowed. So the helper starts from a closed select and only returns once
 * the list is gone and the trigger reports it is collapsed, which makes a second choose straight after a first safe.
 */
export async function chooseOption(page: Page, trigger: Locator, name: string | RegExp): Promise<void> {
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await centre(trigger);
  await trigger.click();
  const option = page.getByRole("option", typeof name === "string" ? { name, exact: true } : { name });
  await option.click();
  await expect(option).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
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

/** Chips / Seg groups of the form pop-ups: clicks the option with this text and checks it is now pressed (aria-pressed). */
export async function pressChip(group: Locator, name: string | RegExp): Promise<void> {
  const chip = group.getByRole("button", { name, exact: typeof name === "string" });
  await centre(chip);
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
}

/** Expects the option with this text in a chip group to be pressed (or not). */
export async function expectChip(group: Locator, name: string, pressed = true): Promise<void> {
  await expect(group.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", String(pressed));
}

/**
 * Layout check for a small screen: the page must not scroll sideways, and nothing in the page's content may stick out
 * past the right edge. Elements inside a horizontally scrolling rail (marked `data-scroll-rail`) and fixed or sticky
 * chrome (tab bar, header, dialogs) are skipped; an element that is merely clipped by an `overflow: hidden` ancestor
 * is skipped too, since the clip is deliberate (photo crops). Waits are the caller's job: assert a specific element is
 * visible first, never a sleep.
 */
export async function expectFitsViewport(page: Page, width: number, what: string): Promise<void> {
  const result = await page.evaluate((w) => {
    const skipped = (el: Element): boolean => {
      for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
        if (node.hasAttribute("data-scroll-rail")) return true;
        const style = getComputedStyle(node);
        if (style.position === "fixed" || style.position === "sticky") return true;
        if (node !== el && (style.overflowX === "hidden" || style.overflowX === "clip" || style.overflowX === "auto" || style.overflowX === "scroll")) {
          const box = node.getBoundingClientRect();
          if (box.right <= w + 0.5) return true;
        }
      }
      return false;
    };
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || box.right <= w + 0.5) continue;
      if (skipped(el)) continue;
      const id = el.getAttribute("data-testid");
      offenders.push(`${el.tagName.toLowerCase()}${id ? `[${id}]` : ""} right=${Math.round(box.right)} "${(el.textContent ?? "").trim().slice(0, 40)}"`);
      if (offenders.length >= 8) break;
    }
    return { scrollWidth: document.documentElement.scrollWidth, offenders };
  }, width);
  expect(result.scrollWidth, `${what} at ${width}px: page width`).toBeLessThanOrEqual(width);
  expect(result.offenders, `${what} at ${width}px: elements past the right edge`).toEqual([]);
}
