/**
 * Customer portal: the five-tab bar and the "Message <agent>" sheet. The fifth tab (the agent) does not navigate: it
 * opens the sheet over the current screen. The sheet posts ONE message into the existing chat. Nothing here sends a
 * real SMS or WhatsApp message: the portal's message endpoint only writes a chat row for the agent's inbox.
 */
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { seedPortalCustomer, startSignedIn } from "../helpers/portal";
import { seedPortalBooking } from "../helpers/portal-bookings";
import { portalMessageTexts, seedPortalQuote, seedPortalQuoteWorld, type PortalQuoteWorld, type SeededPortalQuote } from "../helpers/portal-quotes";
import { seedAgentMessage } from "../helpers/portal-screens";
import { queryRows } from "../helpers/seed";

const token = () => randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
const EMPTY_ERROR = "Write a few words, or pick something above.";

/** Makes the portal say the customer's agent is called `name` (the test agency has no real agent to name). */
async function agentCalled(page: Page, name: string): Promise<void> {
  await page.route("**/api/v2/portal/branding", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, json: { ...body, agentName: name } });
  });
}

interface Fixture {
  q: PortalQuoteWorld;
  tenerife: SeededPortalQuote;
  algarve: SeededPortalQuote;
  tripId: string;
}

/** A customer with two open quotes and one booking 45 days away, signed in; the agent is "James". */
async function fixture(page: Page, agent = "James"): Promise<Fixture> {
  await agentCalled(page, agent);
  const q = await seedPortalQuoteWorld(page);
  const tenerife = await seedPortalQuote(page, q, { title: "Tenerife Sun Break", token: token(), salesPrice: "1000.00", expiresInDays: 12 });
  const algarve = await seedPortalQuote(page, q, { title: "Algarve Golf Escape", token: token(), salesPrice: "1800.00", expiresInDays: 20 });
  const trip = await seedPortalBooking(page, q, { title: "Lisbon City Break", travelDate: 45 });
  await startSignedIn(page, q.portal);
  return { q, tenerife, algarve, tripId: trip.id };
}

const sheet = (page: Page) => page.getByTestId("sheet-message");
const checkedRadio = (page: Page) => page.getByTestId("message-about").locator('[role="radio"][aria-checked="true"]');

async function openFromTab(page: Page) {
  await page.getByTestId("nav-tab-agent").click();
  await expect(sheet(page)).toBeVisible();
}

test.describe("customer portal: five tabs", () => {
  test("Home, Quotes, Bookings, Message and the agent, in that order, all inside a 360px screen with a very long agent name", async ({ page }) => {
    await fixture(page, "Bartholomew-Maximilian");
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/portal");
    await expect(page.getByTestId("portal-home")).toBeVisible();

    const ids = await page.getByTestId("nav-bottom").getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(ids).toEqual(["nav-tab-home", "nav-tab-quotes", "nav-tab-bookings", "nav-tab-messages", "nav-tab-agent"]);
    await expect(page.getByTestId("nav-label-home")).toHaveText("Home");
    await expect(page.getByTestId("nav-label-quotes")).toHaveText("Quotes");
    await expect(page.getByTestId("nav-label-bookings")).toHaveText("Bookings");
    await expect(page.getByTestId("nav-label-messages")).toHaveText("Message");
    await expect(page.getByTestId("nav-label-agent")).toHaveText("Bartholomew-Maximilian");
    // The Quotes tab keeps its count of quotes to consider.
    await expect(page.getByTestId("nav-badge-quotes")).toHaveText("2");

    const boxes = [];
    for (const id of ids) boxes.push(await page.getByTestId(id ?? "").boundingBox());
    for (const [i, b] of boxes.entries()) {
      expect(b && b.x >= -0.5 && b.x + b.width <= 360.5, `tab ${ids[i]} ${JSON.stringify(b)} is inside the screen`).toBe(true);
      expect(b?.height ?? 0, "tab is at least 60px high").toBeGreaterThanOrEqual(59.5);
      if (i > 0 && b && boxes[i - 1]) expect(b.x, "tabs do not overlap").toBeGreaterThanOrEqual((boxes[i - 1]?.x ?? 0) + (boxes[i - 1]?.width ?? 0) - 0.5);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth), "no sideways scroll").toBeLessThanOrEqual(360);

    // The four fixed labels fit whole; only the long name is cut, with an ellipsis, inside its own tab.
    for (const key of ["home", "quotes", "bookings", "messages"]) {
      const fits = await page.getByTestId(`nav-label-${key}`).evaluate((el) => el.scrollWidth <= el.clientWidth);
      expect(fits, `${key} label is not cut`).toBe(true);
    }
    const agentLabel = page.getByTestId("nav-label-agent");
    expect(await agentLabel.evaluate((el) => el.scrollWidth > el.clientWidth), "the long name is cut").toBe(true);
    expect(await agentLabel.evaluate((el) => getComputedStyle(el).textOverflow)).toBe("ellipsis");
    expect(await agentLabel.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe("nowrap");
  });

  test("an agent with no usable name is labelled Agent", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);
    await page.goto("/portal");
    await expect(page.getByTestId("nav-label-agent")).toHaveText("Agent");
    await page.getByTestId("nav-tab-agent").click();
    await expect(sheet(page)).toBeVisible();
    await expect(page.getByTestId("message-send")).toHaveText("Send to your agent");
  });

  test("Message opens the chat page and is the highlighted tab there", async ({ page }) => {
    await fixture(page);
    await page.goto("/portal");
    await page.getByTestId("nav-tab-messages").click();
    await expect(page).toHaveURL(/\/portal\/messages$/);
    await expect(page.getByTestId("portal-messages")).toBeVisible();
    await expect(page.getByTestId("nav-tab-messages")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("nav-tab-agent")).not.toHaveAttribute("aria-current", "page");
    await expect(sheet(page)).toHaveCount(0);
  });

  test("the agent tab opens the sheet over the current screen without navigating, and is the only highlighted tab while it is open", async ({ page }) => {
    await fixture(page);
    await page.goto("/portal/quotes");
    await expect(page.getByTestId("nav-tab-quotes")).toHaveAttribute("aria-current", "page");
    await openFromTab(page);
    await expect(page).toHaveURL(/\/portal\/quotes$/);
    await expect(page.getByRole("dialog")).toBeVisible();
    // The agent's tab opens a dialog: it says so with aria-expanded / aria-haspopup, never aria-current="page".
    await expect(page.getByTestId("nav-tab-agent")).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("nav-tab-agent")).toHaveAttribute("aria-haspopup", "dialog");
    await expect(page.getByTestId("nav-tab-agent")).not.toHaveAttribute("aria-current", /.*/);
    await expect(page.getByTestId("nav-tab-quotes")).not.toHaveAttribute("aria-current", "page");
    // Highlighted in white with the accent bar; the other tabs stay dim.
    expect(await page.getByTestId("nav-tab-agent").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");
    expect(await page.getByTestId("nav-tab-quotes").evaluate((el) => getComputedStyle(el).color)).not.toBe("rgb(255, 255, 255)");

    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.getByTestId("nav-tab-quotes")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("nav-tab-agent")).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("nav-tab-agent")).not.toHaveAttribute("aria-current", /.*/);
  });

  test("on the chat page the sheet opens on top of the chat and the chat stays where it was", async ({ page }) => {
    const { q } = await fixture(page);
    await seedAgentMessage(q.portal.clientId, "Hello from your agent", "James Agent", 5);
    await page.goto("/portal/messages");
    await expect(page.getByTestId("message-log")).toContainText("Hello from your agent");
    await openFromTab(page);
    await expect(page).toHaveURL(/\/portal\/messages$/);
    await expect(page.getByTestId("nav-tab-agent")).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("nav-tab-messages")).not.toHaveAttribute("aria-current", "page");
    await page.getByTestId("sheet-close").click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.getByTestId("nav-tab-messages")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("message-log")).toContainText("Hello from your agent");
  });
});

test.describe("customer portal: the Message sheet, what it is about", () => {
  test("from a quote screen the quote is chosen; from a booking screen the booking; elsewhere the next booking", async ({ page }) => {
    const { tenerife, algarve, tripId } = await fixture(page);

    await page.goto(`/portal/quote/${algarve.token}`);
    await expect(page.getByTestId("portal-quote")).toBeVisible();
    await openFromTab(page);
    await expect(checkedRadio(page)).toHaveAttribute("data-testid", `message-about-quote:${algarve.id}`);
    await page.keyboard.press("Escape");

    await page.goto(`/portal/quote/${tenerife.token}`);
    await expect(page.getByTestId("portal-quote")).toBeVisible();
    await openFromTab(page);
    await expect(checkedRadio(page)).toHaveAttribute("data-testid", `message-about-quote:${tenerife.id}`);
    await page.keyboard.press("Escape");

    await page.goto(`/portal/booking/${tripId}`);
    await expect(page.getByTestId("portal-booking")).toBeVisible();
    await openFromTab(page);
    await expect(checkedRadio(page)).toHaveAttribute("data-testid", `message-about-booking:${tripId}`);
    await page.keyboard.press("Escape");

    for (const path of ["/portal", "/portal/bookings", "/portal/quotes"]) {
      await page.goto(path);
      await openFromTab(page);
      await expect(checkedRadio(page), `from ${path}`).toHaveAttribute("data-testid", `message-about-booking:${tripId}`);
      await page.keyboard.press("Escape");
    }
  });

  test("the list holds the booking, the open quotes, then Something else", async ({ page }) => {
    const { tenerife, algarve, tripId } = await fixture(page);
    await page.goto("/portal");
    await openFromTab(page);
    const keys = await page.getByTestId("message-about").getByRole("radio").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(keys).toHaveLength(4);
    expect(keys[0]).toBe(`message-about-booking:${tripId}`);
    expect(keys.slice(1, 3).sort()).toEqual([`message-about-quote:${tenerife.id}`, `message-about-quote:${algarve.id}`].sort());
    expect(keys[3]).toBe("message-about-other");
    await expect(page.getByTestId("message-about-other")).toHaveText("Something else");
    await expect(page.getByTestId(`message-about-booking:${tripId}`)).toContainText("Lisbon City Break");
  });

  test("with no booking the first quote is chosen, and with nothing at all Something else", async ({ page }) => {
    await agentCalled(page, "James");
    const q = await seedPortalQuoteWorld(page);
    const only = await seedPortalQuote(page, q, { title: "Tenerife Sun Break", token: token(), salesPrice: "1000.00", expiresInDays: 12 });
    await startSignedIn(page, q.portal);
    await page.goto("/portal");
    await openFromTab(page);
    await expect(checkedRadio(page)).toHaveAttribute("data-testid", `message-about-quote:${only.id}`);
    await page.keyboard.press("Escape");

    const empty = await seedPortalCustomer();
    // The later init script wins: the page now starts signed in as the customer with nothing.
    await startSignedIn(page, empty);
    await page.goto("/portal");
    await openFromTab(page);
    await expect(page.getByTestId("message-about").getByRole("radio")).toHaveCount(1);
    await expect(checkedRadio(page)).toHaveAttribute("data-testid", "message-about-other");
  });

  test("a declined quote's own page keeps that quote as the subject, never another trip", async ({ page }) => {
    const { algarve } = await fixture(page);
    await page.goto(`/portal/quote/${algarve.token}`);
    await page.getByTestId("button-not-interested").click();
    const decline = page.getByTestId("sheet-decline");
    await decline.getByTestId("chip-reason-0").click();
    await decline.getByTestId("button-decline-submit").click();
    await expect(page.getByTestId("quote-declined-banner")).toBeVisible();

    // Reload so the lists come from the server: the declined quote is no longer in the "open quotes" part of the list.
    await page.goto(`/portal/quote/${algarve.token}`);
    await expect(page.getByTestId("quote-declined-banner")).toBeVisible();
    await openFromTab(page);
    await expect(checkedRadio(page)).toHaveAttribute("data-testid", `message-about-quote:${algarve.id}`);
    await expect(checkedRadio(page)).toContainText(/Algarve|Golf/);
  });

  test("while the lists load there is a loading line and Send is off, so a quick send cannot go out as Something else", async ({ page }) => {
    const { q } = await fixture(page);
    // Hold the bookings and quotes lists back from the start: the sheet reads them when it opens.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/v2/portal/bookings", async (route) => {
      await gate;
      await route.continue();
    });
    await page.route("**/api/v2/portal/quotes", async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto("/portal/messages");
    await expect(page.getByTestId("portal-messages")).toBeVisible();
    await openFromTab(page);
    await expect(page.getByTestId("message-about-loading")).toBeVisible();
    await expect(page.getByTestId("message-about").getByRole("radio")).toHaveCount(0);
    await expect(page.getByTestId("message-send")).toBeDisabled();
    await page.getByTestId("message-text").fill("Too quick");
    await page.getByTestId("message-send").click({ force: true });
    expect(await portalMessageTexts(q.portal.clientId)).toHaveLength(0);

    release();
    await expect(page.getByTestId("message-about-loading")).toHaveCount(0);
    await expect(page.getByTestId("message-send")).toBeEnabled();
    await expect(page.getByTestId("message-about").getByRole("radio").first()).toBeVisible();
  });

  test("the radios, chips and reply choice work from the keyboard and announce their state", async ({ page }) => {
    const { tenerife, algarve, tripId } = await fixture(page);
    await page.goto("/portal");
    await openFromTab(page);
    const radios = page.getByTestId("message-about").getByRole("radio");
    const first = radios.first();
    // The list is the booking, then the open quotes in the server's order (newest first), then "Something else".
    await expect(radios).toHaveCount(4);
    await expect(first).toHaveAttribute("data-testid", `message-about-booking:${tripId}`);
    await expect(radios.nth(1)).toHaveAttribute("data-testid", `message-about-quote:${algarve.id}`);
    await expect(radios.nth(2)).toHaveAttribute("data-testid", `message-about-quote:${tenerife.id}`);
    await first.focus();
    await page.keyboard.press("ArrowDown");
    await expect(checkedRadio(page)).toHaveAttribute("data-testid", `message-about-quote:${algarve.id}`);
    await expect(checkedRadio(page)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(first).toHaveAttribute("aria-checked", "true");

    const chip = page.getByTestId("message-extra-airport-parking");
    await chip.focus();
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Space");
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Space");
    await expect(chip).toHaveAttribute("aria-pressed", "false");

    await expect(page.getByTestId("message-via-email")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("message-via-call").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("message-via-call")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("message-via-email")).toHaveAttribute("aria-pressed", "false");

    // Every control is at least 44px high.
    for (const id of ["message-extra-airport-parking", "message-via-call", "message-send"]) {
      expect((await page.getByTestId(id).boundingBox())?.height ?? 0, id).toBeGreaterThanOrEqual(43.5);
    }
    expect((await first.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.5);
  });
});

test.describe("customer portal: the Message sheet, sending", () => {
  test("the design's wording: the quick chips, the reply options and a message or a chip needed", async ({ page }) => {
    const { q } = await fixture(page);
    await page.goto("/portal");
    await openFromTab(page);
    await expect(sheet(page)).toContainText("Message James");
    await expect(sheet(page)).toContainText("Anything");
    await expect(sheet(page)).toContainText("to add?");
    await expect(sheet(page)).toContainText("James will reply by");
    const chips = await page.getByTestId("message-extras").getByRole("button").allTextContents();
    expect(chips).toEqual(["Room with a view", "Celebrating something", "Airport parking", "Extra luggage", "Dietary needs", "Transfer upgrade", "Travel insurance"]);
    const via = await page.getByTestId("message-reply-by").getByRole("button").allTextContents();
    expect(via).toEqual(["Email", "WhatsApp", "Phone call"]);
    await expect(page.getByTestId("message-send")).toHaveText("Send to James");

    await page.getByTestId("message-send").click();
    await expect(page.getByTestId("message-error")).toHaveText(EMPTY_ERROR);
    await expect(page.getByTestId("message-error")).toHaveAttribute("role", "alert");
    await page.getByTestId("message-text").fill("   ");
    await page.getByTestId("message-send").click();
    await expect(page.getByTestId("message-error")).toHaveText(EMPTY_ERROR);
    // Typing, or picking a chip, takes the error away.
    await page.getByTestId("message-extra-extra-luggage").click();
    await expect(page.getByTestId("message-error")).toHaveCount(0);
    expect(await portalMessageTexts(q.portal.clientId)).toHaveLength(0);
  });

  test("sends ONE chat message holding the about, the extras, the words and the reply choice, and it appears in the chat", async ({ page }) => {
    const { q, algarve } = await fixture(page);
    await page.goto("/portal");
    await openFromTab(page);
    await page.getByTestId(`message-about-quote:${algarve.id}`).click();
    const label = (await page.getByTestId(`message-about-quote:${algarve.id}`).innerText()).trim();
    await page.getByTestId("message-extra-airport-parking").click();
    await page.getByTestId("message-extra-room-with-a-view").click();
    await page.getByTestId("message-text").fill("It is our anniversary, could we have a sea view?");
    await page.getByTestId("message-via-whatsapp").click();

    // A double tap must not send twice.
    await page.getByTestId("message-send").dblclick();
    await expect(page.getByTestId("message-sent")).toBeVisible();
    await page.waitForTimeout(1500);
    const texts = await portalMessageTexts(q.portal.clientId);
    expect(texts).toEqual([
      `About: ${label}\nWould like: Room with a view, Airport parking\nIt is our anniversary, could we have a sea view?\nReply by: WhatsApp`,
    ]);

    await page.getByTestId("message-open-chat").click();
    await expect(page).toHaveURL(/\/portal\/messages$/);
    await expect(sheet(page)).toHaveCount(0);
    const log = page.getByTestId("message-log");
    await expect(log).toContainText(`About: ${label}`);
    await expect(log).toContainText("Would like: Room with a view, Airport parking");
    await expect(log).toContainText("It is our anniversary, could we have a sea view?");
    await expect(log).toContainText("Reply by: WhatsApp");
    await expect(log.getByText("It is our anniversary, could we have a sea view?")).toHaveCount(1);
  });

  test("the staff inbox stores the customer's words escaped, one <br> per line: a typed <a> or <img> is text, not markup", async ({ page }) => {
    const { q } = await fixture(page);
    await page.goto("/portal");
    await openFromTab(page);
    await page.getByTestId("message-extra-airport-parking").click();
    await page.getByTestId("message-text").fill('See <a href="https://evil.example">this</a> <img src=x onerror=alert(1)>\nSecond line');
    await page.getByTestId("message-send").click();
    await expect(page.getByTestId("message-sent")).toBeVisible();

    // Five lines on the customer's side (About, Would like, the words over two lines, Reply by) are five lines for staff (four with a one-line message).
    await expect
      .poll(async () => {
        const rows = await queryRows<{ content: string }>(`select content from chat_messages where sender_id = $1`, [`portal-client:${q.portal.clientId}`]);
        return rows.map((r) => r.content);
      })
      .toHaveLength(1);
    const [row] = await queryRows<{ content: string }>(`select content from chat_messages where sender_id = $1`, [`portal-client:${q.portal.clientId}`]);
    expect(row.content).not.toMatch(/<(?!br>)/);
    expect(row.content).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;this&lt;/a&gt;");
    expect(row.content).toContain("&lt;img src=x onerror=alert(1)&gt;<br>Second line");
    expect(row.content.split("<br>").length).toBeGreaterThanOrEqual(5);
  });

  test("a chip alone is enough, and the lines for what is empty are left out", async ({ page }) => {
    const { q, tripId } = await fixture(page);
    await page.goto(`/portal/booking/${tripId}`);
    await expect(page.getByTestId("portal-booking")).toBeVisible();
    await page.getByTestId("button-ask-about-booking").click();
    await expect(sheet(page)).toBeVisible();
    const label = (await checkedRadio(page).innerText()).trim();
    await page.getByTestId("message-extra-extra-luggage").click();
    await page.getByTestId("message-send").click();
    await expect(page.getByTestId("message-sent")).toBeVisible();
    expect(await portalMessageTexts(q.portal.clientId)).toEqual([`About: ${label}\nWould like: Extra luggage\nReply by: Email`]);
  });

  test("the sent state: Sent to the agent, the bubbles, the reply line, Add more and Done", async ({ page }) => {
    await fixture(page);
    await page.goto("/portal");
    await openFromTab(page);
    await page.getByTestId("message-extra-airport-parking").click();
    await page.getByTestId("message-extra-dietary-needs").click();
    await page.getByTestId("message-text").fill("Two vegetarians in the party.");
    await page.getByTestId("message-send").click();

    const sent = page.getByTestId("message-sent");
    await expect(sent).toBeVisible();
    await expect(sheet(page)).toContainText("Sent to");
    await expect(sheet(page)).toContainText("James.");
    await expect(sheet(page)).not.toContainText("Anything");
    const bubble = page.getByTestId("message-sent-bubble");
    await expect(bubble).toHaveCount(1);
    await expect(bubble).toContainText("About");
    await expect(bubble).toContainText("Airport parking · Dietary needs");
    await expect(bubble).toContainText("Two vegetarians in the party.");
    await expect(bubble).toContainText(/Sent today at \d{2}:\d{2}/);
    expect(await bubble.evaluate((el) => getComputedStyle(el).backgroundColor), "navy bubble").toBe("rgb(0, 44, 96)");
    await expect(page.getByTestId("message-reply-line")).toHaveText("James will reply by email, and you’ll see it here too.");
    await expect(page.getByTestId("message-open-chat")).toBeVisible();

    // Add more: back to a cleared form that keeps the reply choice; the next send adds a second bubble.
    await page.getByTestId("message-add-more").click();
    await expect(page.getByTestId("message-form")).toBeVisible();
    await expect(page.getByTestId("message-text")).toHaveValue("");
    await expect(page.getByTestId("message-extra-airport-parking")).toHaveAttribute("aria-pressed", "false");
    await page.getByTestId("message-via-call").click();
    await page.getByTestId("message-text").fill("Also a late check-out.");
    await page.getByTestId("message-send").click();
    await expect(page.getByTestId("message-sent-bubble")).toHaveCount(2);
    await expect(page.getByTestId("message-reply-line")).toHaveText("James will give you a call to talk it through.");

    await page.getByTestId("message-done").click();
    await expect(sheet(page)).toHaveCount(0);
  });

  test("a failed send says so, keeps everything typed and can be sent again, once", async ({ page }) => {
    const { q } = await fixture(page);
    await page.goto("/portal");
    await openFromTab(page);
    await page.getByTestId("message-extra-airport-parking").click();
    await page.getByTestId("message-text").fill("Please keep this safe.");
    await page.getByTestId("message-via-call").click();

    let failing = true;
    await page.route("**/api/portal/message", async (route) => {
      if (failing) await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "nope" }) });
      else await route.continue();
    });
    await page.getByTestId("message-send").click();
    await expect(page.getByTestId("message-error")).toHaveText("That didn't send. Please try again.");
    await expect(page.getByTestId("message-form")).toBeVisible();
    await expect(page.getByTestId("message-text")).toHaveValue("Please keep this safe.");
    await expect(page.getByTestId("message-extra-airport-parking")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("message-via-call")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("message-send")).toBeEnabled();
    expect(await portalMessageTexts(q.portal.clientId)).toHaveLength(0);

    failing = false;
    await page.getByTestId("message-send").click();
    await expect(page.getByTestId("message-sent")).toBeVisible();
    expect(await portalMessageTexts(q.portal.clientId)).toHaveLength(1);
  });

  test("Send is off while sending", async ({ page }) => {
    const { q } = await fixture(page);
    await page.goto("/portal");
    await openFromTab(page);
    await page.getByTestId("message-text").fill("Slow one.");
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/portal/message", async (route) => {
      await gate;
      await route.continue();
    });
    await page.getByTestId("message-send").click();
    await expect(page.getByTestId("message-send")).toBeDisabled();
    await expect(page.getByTestId("message-send")).toHaveText("Sending...");
    release();
    await expect(page.getByTestId("message-sent")).toBeVisible();
    expect(await portalMessageTexts(q.portal.clientId)).toHaveLength(1);
  });

  test("the draft and the sent bubbles follow the customer from page to page, and are gone after signing out", async ({ page }) => {
    const { q, algarve } = await fixture(page);
    await page.goto("/portal");
    await openFromTab(page);
    await page.getByTestId(`message-about-quote:${algarve.id}`).click();
    await page.getByTestId("message-text").fill("Half written on Home");
    await page.getByTestId("message-extra-travel-insurance").click();
    await page.getByTestId("message-via-whatsapp").click();
    await page.getByTestId("sheet-close").click();

    // Another page mounts its own sheet: the draft, the subject and the reply choice are still there.
    await page.getByTestId("nav-tab-quotes").click();
    await expect(page).toHaveURL(/\/portal\/quotes$/);
    await openFromTab(page);
    await expect(page.getByTestId("message-text")).toHaveValue("Half written on Home");
    await expect(page.getByTestId("message-extra-travel-insurance")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("message-via-whatsapp")).toHaveAttribute("aria-pressed", "true");
    await expect(checkedRadio(page)).toHaveAttribute("data-testid", `message-about-quote:${algarve.id}`);

    // Send it, change page again: the sent bubble is still part of the same conversation.
    await page.getByTestId("message-send").click();
    await expect(page.getByTestId("message-sent-bubble")).toHaveCount(1);
    await page.getByTestId("message-done").click();
    await page.getByTestId("nav-tab-bookings").click();
    await expect(page).toHaveURL(/\/portal\/bookings$/);
    await openFromTab(page);
    await page.getByTestId("message-text").fill("Second note");
    await page.getByTestId("message-send").click();
    await expect(page.getByTestId("message-sent-bubble")).toHaveCount(2);
    expect(await portalMessageTexts(q.portal.clientId)).toHaveLength(2);
  });

  test("what was typed survives closing the sheet", async ({ page }) => {
    await fixture(page);
    await page.goto("/portal");
    await openFromTab(page);
    await page.getByTestId("message-text").fill("Half written");
    await page.getByTestId("message-extra-travel-insurance").click();
    await page.getByTestId("sheet-close").click();
    await expect(sheet(page)).toHaveCount(0);
    await openFromTab(page);
    await expect(page.getByTestId("message-text")).toHaveValue("Half written");
    await expect(page.getByTestId("message-extra-travel-insurance")).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("customer portal: the Message sheet, every way in", () => {
  test("Escape closes it and focus goes back to the tab that opened it; the sheet is a modal dialog", async ({ page }) => {
    await fixture(page);
    await page.goto("/portal");
    const tab = page.getByTestId("nav-tab-agent");
    await tab.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Focus is trapped inside while it is open.
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="sheet-message"]')), "focus stays in the sheet").toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
    await expect(tab).toBeFocused();
  });

  test("the menu's Message <agent> opens it, and Escape returns focus to the Menu button; the Messages row opens the chat", async ({ page }) => {
    await fixture(page);
    await page.goto("/portal/quotes");
    await page.getByTestId("button-portal-menu").click();
    await expect(page.getByTestId("menu-message-agent")).toHaveText("Message James");
    await page.getByTestId("menu-message-agent").click();
    await expect(sheet(page)).toBeVisible();
    await expect(page.getByTestId("portal-menu")).toHaveCount(0);
    await expect(page).toHaveURL(/\/portal\/quotes$/);
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.getByTestId("button-portal-menu")).toBeFocused();

    await page.getByTestId("button-portal-menu").click();
    await page.getByTestId("menu-item-messages").click();
    await expect(page).toHaveURL(/\/portal\/messages$/);
    await expect(sheet(page)).toHaveCount(0);
  });

  test("Home's agent block opens it, naming the agent and choosing the next booking", async ({ page }) => {
    const { tripId } = await fixture(page);
    await page.goto("/portal");
    await expect(page.getByTestId("home-message-agent")).toHaveText("Message James");
    await page.getByTestId("home-message-agent").click();
    await expect(sheet(page)).toBeVisible();
    await expect(page).toHaveURL(/\/portal$/);
    await expect(checkedRadio(page)).toHaveAttribute("data-testid", `message-about-booking:${tripId}`);
  });

  test("the chat page's own ?about= prefill still works", async ({ page }) => {
    await fixture(page);
    await page.goto("/portal/messages?about=Hotel%20Playa%20Azul%20Majorca");
    await expect(page.getByTestId("input-message")).toHaveValue("About Hotel Playa Azul Majorca: ");
  });
});
