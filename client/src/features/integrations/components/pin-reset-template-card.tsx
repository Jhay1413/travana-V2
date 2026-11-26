import type { ReactNode } from "react";
import type { SsChannel } from "@/features/conversations";
import { useSavePinResetTemplateSettings } from "../api/use-whatsapp-templates";
import { signInLinkPlaceholderProblem } from "../lib/template-placeholders";
import type { TemplateSettings, WaTemplate } from "../types";
import { TemplatePickerCard, type TemplatePickerCopy, type TemplatePickerSource } from "./template-picker-card";

const SOURCES: TemplatePickerSource[] = [
  { value: "client_first_name", label: "Client's first name" },
  { value: "agency_name", label: "Agency name" },
  { value: "sign_in_link", label: "Sign-in link" },
  { value: "custom", label: "Fixed text" },
];

const COPY: TemplatePickerCopy = {
  idPrefix: "pin-reset-template",
  title: "Portal sign-in link",
  description:
    "Sent on WhatsApp when a customer taps “Forgotten your PIN?”. Within 24 hours of their last message it goes as plain text; outside that window it needs a template. Without one, customers who haven't messaged you in the last 24 hours can't receive a PIN reset.",
  helper: "Used for both PIN resets and links your team sends. Don't state how long the link lasts in the template.",
  selectLabel: "Portal sign-in link template",
  noneLabel: "None — only customers inside the 24-hour window can reset",
  inUseBy: "Portal sign-in links currently use",
  savedToast: "Portal sign-in links will use this template",
  clearedToast: "Portal sign-in links outside the 24-hour window will not be sent",
};

interface PinResetTemplateCardProps {
  channelId: string;
  /** All templates of the channel; only APPROVED ones can be chosen. */
  templates: WaTemplate[];
  templatesLoading: boolean;
  templatesError: boolean;
  /** The org's saved sign-in link settings, fetched by the parent for write roles only. */
  settings: TemplateSettings | undefined;
  settingsLoading: boolean;
  /** Connected channels, used to name the number a saved template lives on. */
  channels: SsChannel[];
  /** Whether the sign-in link is going out (shown by the Automatic messages section). */
  statusLine?: ReactNode;
}

/** Which approved template carries a customer's one-time portal sign-in link once their 24-hour window has closed. */
export function PinResetTemplateCard(props: PinResetTemplateCardProps) {
  const save = useSavePinResetTemplateSettings();
  return <TemplatePickerCard kind="pinReset" sources={SOURCES} copy={COPY} save={save} extraValidation={signInLinkPlaceholderProblem} {...props} />;
}
