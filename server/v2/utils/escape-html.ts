const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape user-supplied text before interpolating it into HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * Plain text a person typed, as HTML that shows exactly that text on the same lines: every character escaped (so a typed
 * "<a href>" is read as text, never run or linked) and each line break turned into <br>.
 */
export function plainTextToHtml(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>");
}
