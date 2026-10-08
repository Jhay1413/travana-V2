/**
 * Training descriptions (course, section, lesson, slide caption) are stored as
 * TipTap HTML. Older rows still hold plain text; both render through
 * `RichTextDisplay`.
 */

/** Typography isn't registered in Tailwind, so restore list/paragraph styling for rendered descriptions. */
export const TRAINING_RICH_TEXT_CLASS =
  "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_p+p]:mt-2 [&_a]:underline";

/** Plain-text view of an HTML (or plain-text) description, for `alt`, length checks and emptiness tests. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  const spaced = html.replace(/<\/(p|li|h[1-6])>|<br\s*\/?>/gi, " ");
  const text = new DOMParser().parseFromString(spaced, "text/html").body.textContent ?? "";
  return text.replace(/\s+/g, " ").trim();
}

/** TipTap emits `<p></p>` for an empty editor; store that as an empty string instead. */
export function normalizeRichText(html: string): string {
  return stripHtml(html) === "" ? "" : html;
}

/** Server cap on a stored slide description (`training-lesson.validator.ts`). It counts the HTML string, markup included. */
export const SLIDE_CAPTION_MAX_LENGTH = 2000;

/** Show a live character count once a description passes this share of its limit. */
const RICH_TEXT_WARN_RATIO = 0.8;

/** Length the server will validate: the normalized, trimmed HTML (an empty editor counts as 0, not 7). */
export function richTextLength(html: string): number {
  return normalizeRichText(html).trim().length;
}

export interface RichTextLengthStatus {
  length: number;
  max: number;
  /** Past the warning threshold (includes over the limit). */
  nearLimit: boolean;
  overLimit: boolean;
}

export function getRichTextLengthStatus(html: string, max: number = SLIDE_CAPTION_MAX_LENGTH): RichTextLengthStatus {
  const length = richTextLength(html);
  return { length, max, nearLimit: length >= max * RICH_TEXT_WARN_RATIO, overLimit: length > max };
}

/** Status-line text for a length status, or "" when there is nothing to show yet. */
export function describeRichTextLength({ length, max, nearLimit, overLimit }: RichTextLengthStatus): string {
  if (overLimit) {
    return `${length.toLocaleString()} / ${max.toLocaleString()} characters, ${(length - max).toLocaleString()} over the limit. Formatting counts toward the limit. Shorten it to save.`;
  }
  return nearLimit ? `${length.toLocaleString()} / ${max.toLocaleString()} characters` : "";
}
