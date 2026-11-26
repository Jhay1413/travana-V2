export interface SplitTitle {
  lead: string;
  /** The italic second line; empty when the title is one word. */
  italic: string;
}

/**
 * Splits a quote title into the serif heading's two lines: the last two words go in italics, the rest lead.
 * A one-word title stays on one line and a two-word title is one word per line. Commas are dropped so a hotel
 * name such as "Hotel Roma, Rome" wraps cleanly, whatever its length.
 */
export function splitTitle(title: string): SplitTitle {
  const words = title.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lead: "", italic: "" };
  if (words.length === 1) return { lead: words[0], italic: "" };
  const cut = Math.max(1, words.length - 2);
  return { lead: words.slice(0, cut).join(" "), italic: words.slice(cut).join(" ") };
}
