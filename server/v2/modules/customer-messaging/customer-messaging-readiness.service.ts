import { AppError } from "../../utils/error-handler";
import { runWithSendSevenConfigAsync, type SendSevenConfig } from "../../utils/sendseven";
import type { PurposeTemplateConfig } from "@shared/schema";
import type { SsChannel } from "../channels/channels.types";
import { channelsService } from "../channels/channels.service";
import { conversationIntegrationService } from "../conversation-integration/conversation-integration.service";
import { isSmsConfigured } from "../sms/sms.service";
import { pickWhatsappChannel } from "../whatsapp-templates/whatsapp-delivery.service";
import { whatsappSettingsService } from "../whatsapp-templates/whatsapp-settings.service";
import { whatsappTemplatesRepository } from "../whatsapp-templates/whatsapp-templates.repository";
import type { SsWhatsappTemplate } from "../whatsapp-templates/whatsapp-templates.types";
import { customerMessagingRepository } from "./customer-messaging.repository";
import { smsRowMatchesPurpose } from "./customer-messaging.purposes";
import { customerMessagingService } from "./customer-messaging.service";
import { AUTO_PURPOSES, type AutoChannel, type PurposeReadiness, type ReadinessReason } from "./customer-messaging.types";

// For each automatic message type: is it switched on, which channel would it use, and if it is not going out, why.
// "Ready" means a send would really go: the agency is active, the channel is connected, and on WhatsApp the log
// table exists and the chosen template is still there, still approved, and its placeholders match what was saved.
// Everything is read once per request (the template list once per WhatsApp number, not once per card).

type Connection =
  | { kind: "ok"; channels: SsChannel[]; integration: SendSevenConfig }
  | { kind: "down"; reason: Extract<ReadinessReason, "not_connected" | "unreachable"> };

async function whatsappConnection(orgId: string): Promise<Connection> {
  try {
    const integration = await conversationIntegrationService.resolveConfig(orgId);
    if (!integration) return { kind: "down", reason: "not_connected" };
    const channels = await runWithSendSevenConfigAsync(integration, () => channelsService.listChannels(true));
    return { kind: "ok", channels, integration };
  } catch (err) {
    console.warn(`[customer-messaging] readiness could not reach SendSeven for org ${orgId}:`, err instanceof AppError ? err.message : err);
    return { kind: "down", reason: "unreachable" };
  }
}

const PLACEHOLDER = /\{\{\s*(\d+)\s*\}\}/g;

/** Placeholder numbers a template declares (header and body), sorted. */
export function declaredPlaceholders(template: Pick<SsWhatsappTemplate, "body_text" | "header_text">): string[] {
  const found = new Set<string>();
  for (const text of [template.header_text, template.body_text]) {
    for (const m of (text ?? "").matchAll(PLACEHOLDER)) found.add(m[1]);
  }
  return [...found].sort((a, b) => Number(a) - Number(b));
}

/** The saved mapping must cover exactly the placeholders the template declares now. */
export function mappingMatches(template: Pick<SsWhatsappTemplate, "body_text" | "header_text">, config: PurposeTemplateConfig): boolean {
  const declared = declaredPlaceholders(template);
  const mapped = Object.keys(config.variables ?? {}).sort((a, b) => Number(a) - Number(b));
  return declared.length === mapped.length && declared.every((p, i) => p === mapped[i]);
}

async function getReadiness(orgId: string): Promise<{ autoChannel: AutoChannel; purposes: PurposeReadiness[] }> {
  const autoChannel = await customerMessagingService.getAutoChannel(orgId);
  const [rows, templates, signIn, orgActive] = await Promise.all([
    customerMessagingRepository.listSwitchRows(orgId),
    whatsappSettingsService.getPurposeTemplates(orgId),
    whatsappSettingsService.getPinReset(orgId).catch(() => null),
    customerMessagingRepository.isOrgActive(orgId),
  ]);
  const smsReady = isSmsConfigured();
  const connection: Connection | null = autoChannel === "whatsapp" ? await whatsappConnection(orgId) : null;
  const logAvailable = autoChannel === "whatsapp" ? await customerMessagingRepository.isLogAvailable() : true;

  // One template list per WhatsApp number, shared by every card.
  const lists = new Map<string, Promise<SsWhatsappTemplate[] | null>>();
  const templatesOf = (channelId: string): Promise<SsWhatsappTemplate[] | null> => {
    const cached = lists.get(channelId);
    if (cached) return cached;
    const fetched =
      connection?.kind === "ok"
        ? runWithSendSevenConfigAsync(connection.integration, () => whatsappTemplatesRepository.list({ channel_id: channelId }))
            .then((r) => r.templates)
            .catch((err) => {
              console.warn(`[customer-messaging] readiness could not list templates for org ${orgId}:`, err instanceof AppError ? err.message : err);
              return null;
            })
        : Promise.resolve(null);
    lists.set(channelId, fetched);
    return fetched;
  };

  /** Why a WhatsApp message of this type would not go out, or null when it would. */
  const whatsappProblem = async (config: PurposeTemplateConfig | undefined): Promise<ReadinessReason | null> => {
    if (!logAvailable) return "database_update_needed";
    if (!connection) return null;
    if (connection.kind === "down") return connection.reason;
    const channel = pickWhatsappChannel(connection.channels, config?.channelId ?? null);
    if (!channel) return "no_channel";
    if (!config?.templateName) return "no_template";
    const list = await templatesOf(channel.id);
    if (list === null) return "unreachable";
    const template = list.find((t) => t.name === config.templateName && (!config.language || t.language === config.language));
    if (!template) return "template_missing";
    if (template.status !== "APPROVED") return "template_not_approved";
    if (!mappingMatches(template, config)) return "mapping_mismatch";
    return null;
  };

  const purposes: PurposeReadiness[] = [];
  for (const purpose of AUTO_PURPOSES) {
    const matching = rows.filter((r) => smsRowMatchesPurpose(r, purpose));
    const base = { purpose, switchedOn: matching.some((r) => r.active), hasSwitch: matching.length > 0, channel: autoChannel };
    const not = (reason: ReadinessReason): PurposeReadiness => ({ ...base, ready: false, reason });
    if (!base.switchedOn) purposes.push(not("switched_off"));
    else if (!orgActive) purposes.push(not("org_suspended"));
    else if (autoChannel === "sms") purposes.push(smsReady ? { ...base, ready: true, reason: null } : not("sms_not_configured"));
    else {
      const problem = await whatsappProblem(templates[purpose]);
      purposes.push(problem ? not(problem) : { ...base, ready: true, reason: null });
    }
  }

  // The sign-in link is customer-initiated: always on, and on WhatsApp it still works as plain text inside the 24-hour window.
  const base = { purpose: "portal_sign_in" as const, switchedOn: true, hasSwitch: false, channel: autoChannel };
  if (!orgActive) purposes.push({ ...base, ready: false, reason: "org_suspended" });
  else if (autoChannel === "sms") purposes.push(smsReady ? { ...base, ready: true, reason: null } : { ...base, ready: false, reason: "sms_not_configured" });
  else if (connection?.kind === "down") purposes.push({ ...base, ready: false, reason: connection.reason });
  else if (connection && !pickWhatsappChannel(connection.channels, signIn?.channelId ?? null)) purposes.push({ ...base, ready: false, reason: "no_channel" });
  else purposes.push({ ...base, ready: true, reason: null, ...(signIn?.templateName ? {} : { note: "no_template_outside_window" as const }) });
  return { autoChannel, purposes };
}

export const customerMessagingReadinessService = { getReadiness };
