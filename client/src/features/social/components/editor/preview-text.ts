import { postToEditorHtml } from "@/lib/post-editor-html";

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
};

/** Plain text of a post body, with line breaks kept as newlines. DOM-free so it runs anywhere. */
export function postToPlainText(post: string): string {
  const withBreaks = postToEditorHtml(post).replace(/<br\s*\/?>\n?/gi, "\n");
  return withBreaks
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:nbsp|lt|gt|quot|#39|#x27);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&amp;/g, "&")
    .trim();
}

/** Truncates to at most `max` characters, backing up to a word boundary; `truncated` says whether anything was cut. */
export function truncateText(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  const head = text.slice(0, max);
  // Mid-word cut: back up to the last whitespace, unless that would drop everything.
  const midWord = !/\s/.test(text.charAt(max));
  const boundary = midWord ? head.search(/\s\S*$/) : -1;
  const cut = boundary > 0 ? head.slice(0, boundary) : head;
  return { text: cut.trimEnd(), truncated: true };
}

/** Escapes text for use inside dangerouslySetInnerHTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
