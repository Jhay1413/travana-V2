/**
 * Setup helpers for the customer-portal Deals, Messages, Rewards and Interests specs. Setup only (rows are written
 * straight to the practice database); the specs assert through the real screens and the portal's own endpoints.
 */
import "./test-db-env";
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../../server/v2/config/database";
import { clientTable, portalMessages, quoteTags, referral, tags, wallet_transaction } from "../../shared/schema";
import { expect } from "./fixtures";
import type { PortalSetup } from "./portal";
import { queryRows } from "./seed";

/** Gives a published deal a tag by name, creating the tag when it does not exist yet. */
export async function tagDealWith(dealQuoteId: string, tagName: string): Promise<void> {
  const [existing] = await db.select().from(tags).where(eq(tags.name, tagName));
  const tag = existing ?? (await db.insert(tags).values({ name: tagName }).returning())[0];
  await db.insert(quoteTags).values({ quoteId: dealQuoteId, tagId: tag.id });
}

/** Takes a deal off the portal (what staff do with "hide from portal"), so it is no longer listed. */
export async function hideDealFromPortal(dealQuoteId: string): Promise<void> {
  await queryRows("update quote_table set show_on_portal = false where id = $1", [dealQuoteId]);
}

/** Signs the page in as a different customer (for "someone else's data never shows" checks). */
export async function signInAs(page: Page, who: PortalSetup): Promise<void> {
  await page.context().clearCookies();
  const login = await page.request.post("/api/v2/portal/login", { data: { email: who.email, pin: who.pin, org: who.slug } });
  expect(login.status()).toBe(200);
  const { token, clientId } = (await login.json()) as { token: string; clientId: string };
  await page.addInitScript(
    ([t, id]) => {
      localStorage.setItem("portal_token", t);
      localStorage.setItem("portal_client_id", id);
      localStorage.setItem("portal_setup_wizard_done", "1");
      sessionStorage.setItem("portal_push_banner_dismissed", "1");
    },
    [token, clientId],
  );
}

// ── Messages ────────────────────────────────────────────────────────────────

/** A message from the agent in the customer's conversation, `minutesAgo` minutes ago. */
export async function seedAgentMessage(clientId: string, text: string, agentName: string, minutesAgo = 0): Promise<void> {
  await db.insert(portalMessages).values({
    clientId,
    sender: "agent",
    agentName,
    text,
    createdAt: new Date(Date.now() - minutesAgo * 60_000),
  });
}

/** Every message in the customer's conversation, oldest first. */
export async function portalConversation(clientId: string): Promise<{ sender: string; text: string }[]> {
  return queryRows<{ sender: string; text: string }>("select sender, text from portal_messages where client_id = $1 order by created_at", [clientId]);
}

// ── Rewards ─────────────────────────────────────────────────────────────────

export async function setVipTier(clientId: string, tier: "standard" | "gold" | "elite" | null): Promise<void> {
  await db.update(clientTable).set({ vipTier: tier }).where(eq(clientTable.id, clientId));
}

export interface SeededReferral {
  id: string;
  name: string;
}

/** A referral made by the customer. `daysToTrip` sets the travel date (and so whether it is due: it releases 8 weeks before travel). */
export async function seedReferral(
  clientId: string,
  opts: { name: string; status: "PENDING" | "IN_WALLET" | "PAID" | "VOIDED"; payout: string; daysToTrip?: number; email?: string; commissionRate?: string },
): Promise<SeededReferral> {
  const day = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const trip = opts.daysToTrip ?? 200;
  const [row] = await db
    .insert(referral)
    .values({
      id: randomUUID(),
      referrerClientId: clientId,
      referredName: opts.name,
      referredEmail: opts.email ?? null,
      referralStatus: opts.status,
      payoutAmount: opts.payout,
      commissionRate: opts.commissionRate ?? "25",
      travelDate: day(trip),
      payoutTriggerDate: day(trip - 56),
      paidAt: opts.status === "PAID" ? new Date() : null,
    })
    .returning();
  return { id: row.id, name: opts.name };
}

/** A processed commission credit in the wallet, optionally for a referral. */
export async function seedWalletCredit(clientId: string, amount: string, referralId: string | null = null): Promise<void> {
  await db.insert(wallet_transaction).values({ client_id: clientId, type: "credit", amount, source: "referral_commission", referral_id: referralId, status: "processed" });
}

export interface WalletDebitRow {
  amount: string;
  source: string;
  status: string;
  account_name: string | null;
  account_number: string | null;
  sort_code: string | null;
}

/** The customer's withdrawal requests (debits in the wallet ledger). */
export async function walletDebits(clientId: string): Promise<WalletDebitRow[]> {
  return queryRows<WalletDebitRow>(
    "select amount::text as amount, source::text as source, status::text as status, account_name, account_number, sort_code from wallet_transaction where client_id = $1 and type = 'debit' order by created_at",
    [clientId],
  );
}

export async function walletBalanceFor(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem("portal_token"));
  const res = await page.request.get("/api/portal/wallet/balance", { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { balance: string }).balance;
}
