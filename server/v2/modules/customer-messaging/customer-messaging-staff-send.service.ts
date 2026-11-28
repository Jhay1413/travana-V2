import type { NeonClient } from "@shared/schema";
import { AppError } from "../../utils/error-handler";
import { getPublicBaseUrl } from "../../utils/public-url";
import { getPortalBaseUrl, SITE_ADDRESS_ERROR, tryPortalUrl } from "../../utils/hosts";
import { createRecentSendGuard } from "../../utils/recent-send-guard";
import { holdsHomeworkerRole, type Scope } from "../../utils/scope";
import { neonClientRepository } from "../neon-client/neon-client.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import { organizationRepository } from "../organization/organization.repository";
import { MAGIC_LINK_TTL_MS, STAFF_LINK_TTL_HOURS } from "../portal/portal-auth";
import { portalLoginTokenRepository } from "../portal/portal-login-token.repository";
import { sendPinResetWhatsapp, type PinResetSkipReason } from "../portal/portal-pin-reset-sender";
import { buildStaffSignInText } from "../portal/portal-pin-reset-text";
import { quoteShareService } from "../quote-share/quote-share.service";
import type { QuoteWhatsappFallbackReason } from "../quote-share/quote-share.types";
import { quoteWhatsappService } from "../quote-share/quote-whatsapp.service";
import { smsRepository } from "../sms/sms.repository";
import {
  buildContextForClient as buildSmsContext,
  buildPublicQuoteMessage,
  isSmsConfigured,
  mergeTemplate,
  normalisePhone,
  resolveQuoteToken,
  sendTrackedSms,
} from "../sms/sms.service";
import { userRepository } from "../user/user.repository";
import { whatsappSettingsService } from "../whatsapp-templates/whatsapp-settings.service";
import { SKIP_REASON_TEXT } from "./customer-messaging.reasons";
import { customerMessagingService } from "./customer-messaging.service";
import { customerMessagingRepository } from "./customer-messaging.repository";
import { isSeededAgencyName, isSeededPortalLoginBody, SEEDED_SIGNATURE, withAgencySignature } from "./customer-messaging.seeds";
import type { AutoChannel, SkipReason } from "./customer-messaging.types";
import type { StaffPurpose, StaffSendInput, StaffSendResult } from "./customer-messaging-staff.types";

// A staff member pressed Send and chose the channel. Each (message, channel) pair goes to the implementation that
// already existed for it, so what goes out is what went out before:
//   quote link  + WhatsApp -> quoteWhatsappService.send (24h window text, quote template, wa.me fallback)
//   quote link  + SMS      -> the public quote message (signed with the customer's own agency name, if known)
//   sign-in     + WhatsApp -> the portal-pin-reset WhatsApp sender (own verified chat in window, else the template)
//   sign-in     + SMS      -> a tracked SMS carrying the same one-time link (the agency's own portal-login wording when it can take the link)
// Every customer stays reachable: when WhatsApp cannot go through the agency's inbox (homeworker, not connected, no
// template and no chat, send failed) the staff member is handed a wa.me fallback with the text, and the log says
// "staff_fallback" (we cannot know whether they pressed send in WhatsApp). Only the chosen provider is ever called, and a
// channel that cannot deliver never moves the message to the other one. Every outcome is written to customer_message_log
// (trigger source "staff"), which never throws.

export const STAFF_TRIGGER_SOURCE = "staff";
const QUOTE_SMS_DUPLICATE = "This quote was just texted to this client. Wait a minute before sending it again.";
const quoteSmsGuard = createRecentSendGuard(60_000);
const SIGN_IN_DUPLICATE = "A sign-in link was just sent to this customer. Wait a minute before sending another.";
const SIGN_IN_GUARD_MS = 60_000;
/** At most this many staff-minted sign-in links per customer in 24 hours. */
export const STAFF_LINK_DAILY_CAP = 10;
const STAFF_LINK_WINDOW_MS = 24 * 60 * 60 * 1000;

// One claim per customer, whatever the channel. It is taken before the first await (so two presses at once cannot both
// pass) and handed back when nothing was minted (a refused or failed press does not lock the customer out for a minute).
const signInClaims = new Map<string, number>();
function claimSignIn(key: string): void {
  const now = Date.now();
  signInClaims.forEach((at, k) => {
    if (now - at >= SIGN_IN_GUARD_MS) signInClaims.delete(k);
  });
  if (signInClaims.has(key)) throw new AppError(SIGN_IN_DUPLICATE, 429);
  signInClaims.set(key, now);
}
function releaseSignIn(key: string): void {
  signInClaims.delete(key);
}

/** What the sign-in sender could not do, as the fallback reasons the dialogs already word. */
const SIGN_IN_FALLBACK_REASON: Record<PinResetSkipReason, QuoteWhatsappFallbackReason> = {
  not_configured: "not_configured",
  no_channel: "no_channel",
  no_template: "no_contact",
  capped: "not_configured",
  send_failed: "template_failed",
};

interface Ctx {
  orgId: string;
  userId: string;
  scope: Scope;
  client: NeonClient;
  purpose: StaffPurpose;
  /** Set once a one-time link was minted for this press (so the duplicate claim is kept). */
  minted: boolean;
}

type Outcome = { status: "sent" } | { status: "skipped"; reason: SkipReason };

async function record(ctx: Ctx, channel: AutoChannel, outcome: Outcome, templateName?: string | null): Promise<void> {
  await customerMessagingService.recordOutcome({
    orgId: ctx.orgId,
    clientId: ctx.client.id,
    purpose: ctx.purpose,
    channel,
    triggerSource: STAFF_TRIGGER_SOURCE,
    actorId: ctx.userId,
    templateName: templateName ?? null,
    outcome,
  });
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const notSent = (channel: AutoChannel, reason: SkipReason): StaffSendResult => ({ status: "not_sent", channel, reason, message: `${capitalise(SKIP_REASON_TEXT[reason])}.` });

/** The checks every text has: a phone, the provider set up, the customer not opted out (today's rule for staff texts). */
function smsPreflight(client: NeonClient): SkipReason | null {
  if (!normalisePhone(client.phoneNumber)) return "no_phone";
  if (!isSmsConfigured()) return "not_configured";
  if (!client.smsOptIn) return "opted_out";
  return null;
}

async function staffName(userId: string): Promise<string> {
  const u = await userRepository.findById(userId);
  return (u && (`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email)) || "staff";
}

/** The template name a sent-by-template message used; best effort, a read failure only leaves the log field empty. */
async function templateNameFor(ctx: Ctx): Promise<string | null> {
  try {
    const s = ctx.purpose === "quote_link" ? await whatsappSettingsService.getQuote(ctx.orgId) : await whatsappSettingsService.getPinReset(ctx.orgId);
    return s.templateName;
  } catch {
    return null;
  }
}

/** Is there an address to put in front of a customer link? The portal host when there is one, else the site address. */
function hasSiteAddress(): boolean {
  return Boolean(getPortalBaseUrl() ?? getPublicBaseUrl());
}

/**
 * A one-time sign-in link, for a caller that already checked the site address. A customer with no PIN is flagged to choose
 * one at the portal PIN gate (no PIN value is ever written). The customer's older unused staff links stop working.
 */
async function mintSignInLink(ctx: Ctx): Promise<string> {
  if (!hasSiteAddress()) throw new AppError("The site address is not configured", 500);
  const { client } = ctx;
  if (!client.portalPin) await neonClientRepository.setPortalPin(client.id, null, { mustChange: true });
  await portalLoginTokenRepository.retireStaffLinks(client.id);
  const code = await portalLoginTokenRepository.create(client.id, MAGIC_LINK_TTL_MS, "staff");
  ctx.minted = true;
  const link = tryPortalUrl(`/portal/login?mt=${code}&next=${encodeURIComponent("/portal")}`);
  if (!link) throw new AppError(SITE_ADDRESS_ERROR, 500);
  return link;
}

/**
 * Has this customer had ten staff links in the last 24 hours? Counted from the token rows (they carry the staff label), or
 * from the message log before that column exists. If neither can be read it answers "no" and says so in the server log:
 * staff must still be able to help a customer.
 */
async function staffLinkCapReached(ctx: Ctx): Promise<boolean> {
  const since = new Date(Date.now() - STAFF_LINK_WINDOW_MS);
  let count: number | null = null;
  try {
    count = await portalLoginTokenRepository.countStaffLinksSince(ctx.client.id, since);
  } catch {
    try {
      count = await customerMessagingRepository.countStaffSignInSince({ orgId: ctx.orgId, clientId: ctx.client.id, since });
    } catch (err) {
      console.warn("[customer-messaging] cannot count recent staff sign-in links (token source and log both unreadable); not limiting this send:", err);
    }
  }
  return count !== null && count >= STAFF_LINK_DAILY_CAP;
}

const fullName = (c: NeonClient): string => `${c.firstName ?? ""} ${c.surename ?? ""}`.trim();

// ── Quote link ──

async function quoteByWhatsapp(ctx: Ctx, quoteId: string): Promise<StaffSendResult> {
  let result;
  try {
    result = await quoteWhatsappService.send(quoteId, ctx.client.id, ctx.userId, ctx.scope);
  } catch (err) {
    // A refused request (access, bad quote) was never a send; a duplicate or a provider failure is logged.
    if (err instanceof AppError && err.statusCode === 429) await record(ctx, "whatsapp", { status: "skipped", reason: "duplicate" });
    else if (!(err instanceof AppError) || err.statusCode >= 500) await record(ctx, "whatsapp", { status: "skipped", reason: "send_failed" });
    throw err;
  }
  if (result.status === "sent") {
    await record(ctx, "whatsapp", { status: "sent" }, result.viaTemplate ? await templateNameFor(ctx) : null);
    return { status: "sent", channel: "whatsapp", viaTemplate: result.viaTemplate === true };
  }
  // Nothing went out through the integration: the agent is handed the wa.me button (homeworkers always are).
  await record(ctx, "whatsapp", { status: "skipped", reason: "staff_fallback" });
  return {
    status: "fallback",
    channel: "whatsapp",
    fallback: { reason: result.reason, text: result.text, quoteUrl: result.quoteUrl, ...(result.detail !== undefined ? { detail: result.detail } : {}) },
  };
}

async function quoteBySms(ctx: Ctx, quoteId: string): Promise<StaffSendResult> {
  await quoteShareService.verifyAccess(quoteId, ctx.userId, ctx.scope);
  const quote = await resolveQuoteToken(ctx.client.id, quoteId);
  if (!quote) {
    await record(ctx, "sms", { status: "skipped", reason: "no_quote_link" });
    return notSent("sms", "no_quote_link");
  }
  const blocked = smsPreflight(ctx.client);
  if (blocked) {
    await record(ctx, "sms", { status: "skipped", reason: blocked });
    return notSent("sms", blocked);
  }
  const guardKey = `${ctx.orgId}:${quoteId}:${ctx.client.id}:sms`;
  quoteSmsGuard.assert(guardKey, QUOTE_SMS_DUPLICATE);
  // Signed with the customer's own agency (from data), never a fixed name.
  const org = await organizationRepository.findById(ctx.orgId);
  const { text } = buildPublicQuoteMessage({ firstName: ctx.client.firstName, token: quote.token, companyName: org?.name ?? null });
  const outcome = await sendTrackedSms({
    orgId: ctx.orgId,
    templateId: null,
    templateName: "Quote link",
    clientId: ctx.client.id,
    clientName: fullName(ctx.client),
    phone: normalisePhone(ctx.client.phoneNumber) as string,
    body: text,
    triggerSource: "staff.quote-link",
    triggeredBy: ctx.userId,
    triggeredByName: await staffName(ctx.userId),
  });
  if (!outcome.ok) {
    await record(ctx, "sms", { status: "skipped", reason: "send_failed" });
    return notSent("sms", "send_failed");
  }
  quoteSmsGuard.record(guardKey);
  await record(ctx, "sms", { status: "sent" });
  return { status: "sent", channel: "sms" };
}

// ── Portal sign-in link ──

const PORTAL_LINK_PLACEHOLDER = /\{\{?\s*portal_link\s*\}?\}/;

/**
 * The text for the SMS. The agency's own "Portal Login" template is used only when it is active, has been EDITED away from
 * the seeded default (the seed promises a PIN "we shared" and ends with a fixed agency name), and contains the
 * {{portal_link}} placeholder (the existing merge fills it with the one-time link). If the merged text still carries the
 * seeded signature the built-in text is used instead, so a fixed agency name never goes out from here. The built-in text is
 * the only one that says the link works once and lasts 48 hours: the agency's own wording is never edited or added to.
 */
async function signInSmsBody(ctx: Ctx, link: string, orgName: string | null): Promise<{ body: string; templateName: string; templateId: string | null }> {
  const template = await smsRepository.findTemplateByCategory(ctx.orgId, "portal_login");
  if (template?.active && PORTAL_LINK_PLACEHOLDER.test(template.body) && !isSeededPortalLoginBody(template.body)) {
    const merge = await buildSmsContext({ id: ctx.client.id, orgId: ctx.orgId, email: ctx.client.email, firstName: ctx.client.firstName, surename: ctx.client.surename });
    // A row seeded with the old fixed signature is signed with this agency's own name instead.
    const merged = mergeTemplate(withAgencySignature(template.body, merge.company_name), { ...merge, portal_link: link });
    // The fixed signature only blocks the template when it is another agency's: an agency really called Tina's Travel may use it.
    if (!(SEEDED_SIGNATURE.test(merged) && !isSeededAgencyName(merge.company_name))) return { body: merged, templateName: template.name, templateId: template.id };
  }
  return {
    body: buildStaffSignInText({ firstName: ctx.client.firstName, orgName, link, hours: STAFF_LINK_TTL_HOURS }),
    templateName: "Portal sign-in link",
    templateId: null,
  };
}

async function signInBySms(ctx: Ctx): Promise<StaffSendResult> {
  const blocked = smsPreflight(ctx.client);
  if (blocked) {
    await record(ctx, "sms", { status: "skipped", reason: blocked });
    return notSent("sms", blocked);
  }
  if (!hasSiteAddress()) {
    await record(ctx, "sms", { status: "skipped", reason: "no_public_url" });
    return notSent("sms", "no_public_url");
  }
  if (await staffLinkCapReached(ctx)) {
    await record(ctx, "sms", { status: "skipped", reason: "capped" });
    return notSent("sms", "capped");
  }
  const link = await mintSignInLink(ctx);
  const org = await organizationRepository.findById(ctx.orgId);
  const text = await signInSmsBody(ctx, link, org?.name ?? null);
  const outcome = await sendTrackedSms({
    orgId: ctx.orgId,
    templateId: text.templateId,
    templateName: text.templateName,
    clientId: ctx.client.id,
    clientName: fullName(ctx.client),
    phone: normalisePhone(ctx.client.phoneNumber) as string,
    body: text.body,
    triggerSource: "staff.portal-sign-in",
    triggeredBy: ctx.userId,
    triggeredByName: await staffName(ctx.userId),
  });
  if (!outcome.ok) {
    await record(ctx, "sms", { status: "skipped", reason: "send_failed" });
    return notSent("sms", "send_failed");
  }
  await record(ctx, "sms", { status: "sent" });
  return { status: "sent", channel: "sms" };
}

async function signInByWhatsapp(ctx: Ctx): Promise<StaffSendResult> {
  const phone = normalisePhone(ctx.client.phoneNumber);
  if (!phone) {
    await record(ctx, "whatsapp", { status: "skipped", reason: "no_phone" });
    return notSent("whatsapp", "no_phone");
  }
  // No site address, no link: nothing is minted and nothing is offered.
  if (!hasSiteAddress()) {
    await record(ctx, "whatsapp", { status: "skipped", reason: "no_public_url" });
    return notSent("whatsapp", "no_public_url");
  }
  if (await staffLinkCapReached(ctx)) {
    await record(ctx, "whatsapp", { status: "skipped", reason: "capped" });
    return notSent("whatsapp", "capped");
  }
  const org = await organizationRepository.findById(ctx.orgId);
  const orgName = org?.name ?? null;
  const buildText = (link: string): string => buildStaffSignInText({ firstName: ctx.client.firstName, orgName, link, hours: STAFF_LINK_TTL_HOURS });

  // The link is minted once, only now that Send was pressed: by the sender when it gets that far, otherwise for the fallback.
  let minted: string | null = null;
  const mint = async (): Promise<string> => {
    minted = await mintSignInLink(ctx);
    return minted;
  };
  // The agent sends it from their own WhatsApp: the link travels only inside the wa.me text the dialog builds.
  const fallback = async (reason: QuoteWhatsappFallbackReason): Promise<StaffSendResult> => {
    const link = minted ?? (await mint());
    await record(ctx, "whatsapp", { status: "skipped", reason: "staff_fallback" });
    return { status: "fallback", channel: "whatsapp", fallback: { reason, text: buildText(link) } };
  };

  // Homeworkers are barred from SendSeven everywhere: straight to the fallback.
  if (holdsHomeworkerRole(ctx.scope)) return fallback("not_allowed");
  const outcome = await sendPinResetWhatsapp({ orgId: ctx.orgId, clientId: ctx.client.id, firstName: ctx.client.firstName, orgName, phone, reserve: mint, buildText, staffUserId: ctx.userId });
  if (outcome.status === "sent") {
    await record(ctx, "whatsapp", { status: "sent" }, outcome.viaTemplate ? await templateNameFor(ctx) : null);
    return { status: "sent", channel: "whatsapp", viaTemplate: outcome.viaTemplate };
  }
  return fallback(SIGN_IN_FALLBACK_REASON[outcome.reason]);
}

async function send(input: StaffSendInput, userId: string, scope: Scope): Promise<StaffSendResult> {
  if (!scope.orgId) throw new AppError("No organisation in scope", 400);
  // The sign-in claim is taken here, before the first await, and kept only if a link was really minted.
  const claimKey = input.purpose === "portal_sign_in" ? `${scope.orgId}:${input.clientId}` : null;
  if (claimKey) claimSignIn(claimKey);
  let ctx: Ctx | null = null;
  try {
    // Scope-enforced: a client of another agency (or one the caller cannot see) reads as not found, before anything else.
    const client = await neonClientService.getNeonClientById(input.clientId, scope);
    ctx = { orgId: scope.orgId, userId, scope, client, purpose: input.purpose, minted: false };

    if (input.purpose === "quote_link") {
      if (!input.quoteId) throw new AppError("quoteId is required to send a quote link", 400);
      return input.channel === "whatsapp" ? await quoteByWhatsapp(ctx, input.quoteId) : await quoteBySms(ctx, input.quoteId);
    }
    return input.channel === "whatsapp" ? await signInByWhatsapp(ctx) : await signInBySms(ctx);
  } finally {
    // Nothing minted (refused, opted out, capped, failed early): the customer is not locked out for a minute.
    if (claimKey && !ctx?.minted) releaseSignIn(claimKey);
  }
}

export const customerMessagingStaffSendService = { send };
