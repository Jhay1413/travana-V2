import type { TemplateSettings, WaTemplate } from "../types";

type Named = Pick<WaTemplate, "name" | "language">;

/** True when the template is the one saved in these settings (same name, language and, when given, channel). */
export function isSavedTemplate(t: Named, saved: TemplateSettings | undefined, channelId?: string): boolean {
  if (!saved?.templateName) return false;
  if (channelId !== undefined && saved.channelId != null && saved.channelId !== channelId) return false;
  return t.name === saved.templateName && (saved.templateLanguage == null || t.language === saved.templateLanguage);
}

/** True when a template is saved on a different channel than the one currently shown. */
export function isSavedOnOtherChannel(saved: TemplateSettings | undefined, channelId: string): boolean {
  return !!saved?.templateName && !!saved.channelId && saved.channelId !== channelId;
}

/** Kept for the quote-only callers and tests. */
export const isSavedQuoteTemplate = isSavedTemplate;
