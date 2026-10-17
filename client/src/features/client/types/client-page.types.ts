/** What the "Add deal" / "New deal" menus and the page's ?create= param can open. */
export type ClientDealKind = "enquiry" | "quote" | "booking";

export type ClientCreateKind = ClientDealKind | "task" | "ticket";

/** Which kind of deal (transaction) a note belongs to. */
export type DealKind = "enquiry" | "quote" | "booking";

/** Everything a note row needs to render + open the deal it belongs to. */
export interface DealLabelInfo {
  kind: DealKind;
  /** The enquiry/quote/booking's own id, NOT the transaction id. */
  id: string;
  title: string;
}

/** transaction_id -> deal label, built once by the page from its loaded enquiries/quotes/bookings. */
export type DealLabelLookup = Map<string, DealLabelInfo>;
