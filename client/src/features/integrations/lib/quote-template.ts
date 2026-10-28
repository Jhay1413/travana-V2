import type { QuoteTemplateSettings, WaTemplate } from "../types";

type Named = Pick<WaTemplate, "name" | "language">;

/** True when the template is the one saved for quote links (same name and language). */
export function isSavedQuoteTemplate(t: Named, saved: QuoteTemplateSettings | undefined): boolean {
  if (!saved?.templateName) return false;
  return t.name === saved.templateName && (saved.templateLanguage == null || t.language === saved.templateLanguage);
}

/** True when a template is saved on a different channel than the one currently shown. */
export function isSavedOnOtherChannel(saved: QuoteTemplateSettings | undefined, channelId: string): boolean {
  return !!saved?.templateName && !!saved.channelId && saved.channelId !== channelId;
}
