import type { SsChannel } from "@/features/conversations";
import { useSaveQuoteTemplateSettings } from "../api/use-whatsapp-templates";
import type { QuoteTemplateSettings, WaTemplate } from "../types";
import { TemplatePickerCard, type TemplatePickerCopy, type TemplatePickerSource } from "./template-picker-card";

const SOURCES: TemplatePickerSource[] = [
  { value: "client_first_name", label: "Client's first name" },
  { value: "agent_name", label: "Agent's name" },
  { value: "agency_name", label: "Agency name" },
  { value: "quote_link", label: "Quote link" },
  { value: "custom", label: "Fixed text" },
];

const COPY: TemplatePickerCopy = {
  idPrefix: "quote-template",
  title: "Quote link message",
  description:
    "Sent when an agent shares a quote link with a client whose 24-hour window has closed. Without one, the agent sends it from their own phone.",
  selectLabel: "Quote link template",
  noneLabel: "None — send from the agent's phone",
  inUseBy: "Quote links currently use",
  savedToast: "Quote links will use this template",
  clearedToast: "Quote links outside the 24-hour window will be sent from the agent's phone",
};

interface QuoteTemplateCardProps {
  channelId: string;
  /** All templates of the channel; only APPROVED ones can be chosen. */
  templates: WaTemplate[];
  templatesLoading: boolean;
  templatesError: boolean;
  /** The org's saved quote-link settings, fetched by the parent for write roles only. */
  settings: QuoteTemplateSettings | undefined;
  settingsLoading: boolean;
  /** Connected channels, used to name the number a saved template lives on. */
  channels: SsChannel[];
}

/** Which approved template carries a quote link once the client's 24-hour window has closed. */
export function QuoteTemplateCard(props: QuoteTemplateCardProps) {
  const save = useSaveQuoteTemplateSettings();
  return <TemplatePickerCard kind="quote" sources={SOURCES} copy={COPY} save={save} {...props} />;
}
