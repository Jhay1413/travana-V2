import type { SsChannel } from "@/features/conversations";
import { useSaveUpdateTemplateSettings } from "../api/use-whatsapp-templates";
import { messagePlaceholderProblem } from "../lib/template-placeholders";
import type { UpdateTemplateSettings, WaTemplate } from "../types";
import { TemplatePickerCard, type TemplatePickerCopy, type TemplatePickerSource } from "./template-picker-card";

const SOURCES: TemplatePickerSource[] = [
  { value: "client_first_name", label: "Client's first name" },
  { value: "agent_name", label: "Agent's name" },
  { value: "agency_name", label: "Agency name" },
  { value: "message", label: "Agent's message" },
  { value: "custom", label: "Fixed text" },
];

const COPY: TemplatePickerCopy = {
  idPrefix: "update-template",
  title: "General update message",
  description:
    "Used when an agent writes to a client whose 24-hour window has closed. What the agent types goes into the placeholder you mark as the agent's message.",
  selectLabel: "General update template",
  noneLabel: "None — agents can't message clients whose window has closed",
  inUseBy: "General updates currently use",
  savedToast: "Agents can now send updates with this template",
  clearedToast: "Agents can't message clients whose window has closed",
};

interface UpdateTemplateCardProps {
  channelId: string;
  /** All templates of the channel; only APPROVED ones can be chosen. */
  templates: WaTemplate[];
  templatesLoading: boolean;
  templatesError: boolean;
  /** The org's saved general-update settings, fetched by the parent for write roles only. */
  settings: UpdateTemplateSettings | undefined;
  settingsLoading: boolean;
  /** Connected channels, used to name the number a saved template lives on. */
  channels: SsChannel[];
}

/** Which approved template carries an agent's own message once the client's 24-hour window has closed. */
export function UpdateTemplateCard(props: UpdateTemplateCardProps) {
  const save = useSaveUpdateTemplateSettings();
  return <TemplatePickerCard kind="update" sources={SOURCES} copy={COPY} save={save} extraValidation={messagePlaceholderProblem} {...props} />;
}
