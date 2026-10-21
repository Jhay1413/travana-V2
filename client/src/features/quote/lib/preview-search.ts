/** True when the URL search string carries ?preview=1 (an agent previewing the customer view). */
export function isPreviewSearch(search: string): boolean {
  return new URLSearchParams(search).get("preview") === "1";
}
