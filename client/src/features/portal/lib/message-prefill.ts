/** Opening Messages from a quote: the composer starts with "About <quote title>: " so the agent knows which. */

export const MAX_ABOUT = 120;

/** The `?about=` query value for a quote title. */
export function aboutParam(title: string): string {
  return encodeURIComponent(title.trim().slice(0, MAX_ABOUT));
}

/** The composer's starting text from the page's query string ("" when there is no `about`). */
export function prefillFromSearch(search: string): string {
  const about = new URLSearchParams(search).get("about")?.trim().slice(0, MAX_ABOUT);
  return about ? `About ${about}: ` : "";
}
