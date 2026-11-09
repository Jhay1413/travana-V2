/** DOM id of a quote/booking form section; the side menu and scroll-spy use the same id. */
export function formSectionDomId(key: string): string {
  return `qf-${key}`;
}
