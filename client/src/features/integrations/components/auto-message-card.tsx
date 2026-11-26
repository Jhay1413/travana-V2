import type { SsChannel } from "@/features/conversations";
import { usePurposeTemplate, useSavePurposeTemplate } from "../api/use-customer-messaging";
import type { AutoMessagePurpose, PurposeReadiness, TemplateVariableMapping, WaTemplate } from "../types";
import { AutoSwitch } from "./auto-switch";
import { CARD } from "./classes";
import { ReadinessLine } from "./readiness-line";
import { TemplatePickerCard, type TemplatePickerCopy, type TemplatePickerSource } from "./template-picker-card";

const SOURCES: TemplatePickerSource[] = [
  { value: "client_first_name", label: "Client's first name" },
  { value: "agency_name", label: "Agency name" },
  { value: "destination", label: "Destination" },
  { value: "booking_reference", label: "Booking reference" },
  { value: "departure_date", label: "Departure date" },
  { value: "balance_due_date", label: "Balance due date" },
  { value: "portal_link", label: "Portal link" },
  { value: "custom", label: "Fixed text" },
];

interface PurposeCopy extends TemplatePickerCopy {
  /** Shown when WhatsApp isn't connected, so there is no picker. */
  short: string;
}

export const AUTO_COPY: Record<AutoMessagePurpose, PurposeCopy> = {
  booking_confirmation: {
    idPrefix: "auto-booking_confirmation",
    title: "Booking confirmation",
    short: "Sent to the customer when a booking is created.",
    description: "Sent to the customer when a booking is created.",
    selectLabel: "Booking confirmation template",
    noneLabel: "None — booking confirmations are not sent on WhatsApp",
    inUseBy: "Booking confirmations currently use",
    savedToast: "Booking confirmations will use this template",
    clearedToast: "Booking confirmations will not be sent on WhatsApp",
  },
  portal_ready: {
    idPrefix: "auto-portal_ready",
    title: "Portal ready",
    short: "Sent when a portal PIN is set, so the customer can sign in.",
    description: "Sent when a portal PIN is set for a customer, so they can sign in. The template must carry the portal link.",
    selectLabel: "Portal ready template",
    noneLabel: "None — portal ready messages are not sent on WhatsApp",
    inUseBy: "Portal ready messages currently use",
    savedToast: "Portal ready messages will use this template",
    clearedToast: "Portal ready messages will not be sent on WhatsApp",
  },
  balance_reminder: {
    idPrefix: "auto-balance_reminder",
    title: "Balance reminder",
    short: "Sent before departure while a balance is outstanding.",
    description: "Sent before departure while a balance is outstanding. It never states an amount.",
    selectLabel: "Balance reminder template",
    noneLabel: "None — balance reminders are not sent on WhatsApp",
    inUseBy: "Balance reminders currently use",
    savedToast: "Balance reminders will use this template",
    clearedToast: "Balance reminders will not be sent on WhatsApp",
  },
  departure_reminder: {
    idPrefix: "auto-departure_reminder",
    title: "Departure reminder",
    short: "Sent a set number of days before departure.",
    description: "Sent a set number of days before departure.",
    selectLabel: "Departure reminder template",
    noneLabel: "None — departure reminders are not sent on WhatsApp",
    inUseBy: "Departure reminders currently use",
    savedToast: "Departure reminders will use this template",
    clearedToast: "Departure reminders will not be sent on WhatsApp",
  },
};

function portalLinkProblem(mappings: Record<string, TemplateVariableMapping>): string | null {
  return Object.values(mappings).some((m) => m.source === "portal_link") ? null : "Pick one placeholder to hold the portal link.";
}

interface AutoMessageCardProps {
  purpose: AutoMessagePurpose;
  readiness: PurposeReadiness | undefined;
  /** The WhatsApp number whose templates are offered; null when none is connected. */
  channelId: string | null;
  templates: WaTemplate[];
  templatesLoading: boolean;
  templatesError: boolean;
  channels: SsChannel[];
}

/** One automatic message type: whether it is going out, and which approved template carries it on WhatsApp. */
export function AutoMessageCard({ purpose, readiness, channelId, templates, templatesLoading, templatesError, channels }: AutoMessageCardProps) {
  const copy = AUTO_COPY[purpose];
  const settings = usePurposeTemplate(purpose, channelId !== null);
  const save = useSavePurposeTemplate(purpose);
  const status = (
    <>
      <ReadinessLine readiness={readiness} testId={copy.idPrefix} />
      <AutoSwitch purpose={purpose} readiness={readiness} testId={copy.idPrefix} />
    </>
  );

  if (channelId === null) {
    return (
      <section className={CARD} aria-labelledby={`int-${copy.idPrefix}-h`} data-testid={`${copy.idPrefix}-section`}>
        <div>
          <h3 className="text-[14px] font-semibold xl:text-[15px]" id={`int-${copy.idPrefix}-h`}>
            {copy.title}
          </h3>
          <p className="mt-0.5 text-[12px] text-social-muted xl:text-[13px]">{copy.short}</p>
          {status}
        </div>
      </section>
    );
  }
  return (
    <TemplatePickerCard
      kind="auto"
      sources={SOURCES}
      copy={copy}
      save={save}
      extraValidation={purpose === "portal_ready" ? portalLinkProblem : undefined}
      channelId={channelId}
      templates={templates}
      templatesLoading={templatesLoading}
      templatesError={templatesError}
      settings={settings.data}
      settingsLoading={settings.isLoading}
      channels={channels}
      statusLine={status}
    />
  );
}
