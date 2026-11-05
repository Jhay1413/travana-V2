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

/**
 * Length of a post as a reader sees it (and as Instagram counts a caption): the sent body with
 * each `<br>` line break counted as one newline character, in code points.
 */
export function onlySocialsPlainLength(sentBody: string): number {
  return Array.from(decodeEntities(sentBody.replace(/<br\s*\/?>\n?/gi, "\n"))).length;
}

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Entities are stored escaped but published as the character they stand for ("&amp;" is one character). */
function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (match, dec, hex, name) => {
    if (dec !== undefined || hex !== undefined) {
      const code = dec !== undefined ? Number(dec) : parseInt(hex, 16);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[String(name).toLowerCase()] ?? match;
  });
}
