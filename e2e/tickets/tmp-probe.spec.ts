import { signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { apiCreateTicket, openQueue, ticketSubject, workWorld } from "../helpers/work";

[0,0,0,0,0,0,0,0,0,0].forEach((delay, n) => {
  test(`probe delay ${delay} ${n}`, async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    for (let i = 0; i < 3; i++) await apiCreateTicket(page.request, { assignedTo: w.agent.id, type: "Build", subject: ticketSubject("P" + i), priority: "Low" });
    await openQueue(page, { view: "list" });
    const t = page.getByTestId("select-ticket-sort");
    const names = ["Priority, highest first", "Due soonest", "Newest first", "Client name"];
    for (const n of names) {
      await t.click();
      const opt = page.getByRole("option", { name: n, exact: true });
      const ok = await opt.waitFor({ timeout: 3000 }).then(() => true, () => false);
      const info = await t.evaluate((el) => ({ exp: el.getAttribute("aria-expanded"), pe: document.body.style.pointerEvents, active: document.activeElement?.getAttribute("data-testid") }));
      console.log("PROBE", delay, n, ok, JSON.stringify(info));
      if (!ok) { await page.screenshot({ path: "test-results/probe-fail.png" }); break; }
      await opt.click();
      await expect(page.getByRole("listbox")).toHaveCount(0);
    }
  });
});
