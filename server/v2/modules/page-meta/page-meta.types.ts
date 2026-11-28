/** What the page head says about a customer-facing page. Never more than an agency's public identity. */
export interface PageMeta {
  title: string;
  description: string;
  /** Absolute, http(s) URL of the agency logo that passed the portal's safe-URL check; null when there is none. */
  imageUrl: string | null;
}
