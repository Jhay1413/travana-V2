/** True when the URL search string carries ?preview=1 (an agent previewing the customer view). */
export function isPreviewSearch(search: string): boolean {
  return new URLSearchParams(search).get("preview") === "1";
}

/**
 * The address to hand to a customer: the page's own address without the staff-only `preview` parameter (and without
 * the hash), so a copied or shared link is always the plain public link.
 */
export function shareableQuoteUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("preview");
  url.hash = "";
  return url.toString();
}
