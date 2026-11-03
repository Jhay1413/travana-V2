/**
 * Normalises a social post body for OnlySocials, which renders the body as
 * HTML: `<br>` makes a line break, a bare "\n" is ignored. Every `<br>` and
 * every "\n" is treated as ONE line break (a `<br>` immediately followed by
 * "\n" is the template's own convention and counts once), then lines are
 * re-joined with "<br>\n" so empty lines become blank lines.
 *
 * <span> tags (and their escaped "&lt;span ...&gt;" forms, left in stored
 * posts by the editor) are removed, keeping the inner text. Other escaped text
 * such as "a &lt; b" is left alone.
 *
 * Pure and idempotent. Shared so the editor can show exactly what is published.
 */
export function toOnlySocialsBody(post: string): string {
  const unified = post
    .replace(/<\/?span\b[^>]*>/gi, "")
    .replace(/&lt;\/?span\b(?:(?!&gt;).)*&gt;/gi, "")
    .replace(/\r\n?/g, "\n").replace(/<br\s*\/?>\n?/gi, "\n");

  const lines: string[] = [];
  let pendingBlank = false;
  for (const raw of unified.split("\n")) {
    if (raw.trim() === "") {
      // Blank lines before the first text line are dropped; runs collapse to one.
      if (lines.length > 0) pendingBlank = true;
      continue;
    }
    if (pendingBlank) lines.push("");
    pendingBlank = false;
    lines.push(raw);
  }

  return lines.join("<br>\n");
}
