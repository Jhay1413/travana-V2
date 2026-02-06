import type { Quote, Client, User, Accommodation, Flight, Commission, QuoteImage, Note } from "@shared/schema";

export type { Quote, InsertQuote } from "@shared/schema";

export type UpdateQuoteDTO = Partial<import("@shared/schema").InsertQuote>;

export interface QuoteFullDetails extends Quote {
  accommodation: Accommodation | undefined;
  flights: Flight[];
  commission: Commission | undefined;
  images: QuoteImage[];
  notes: Note[];
  client: Client | undefined;
  owner: User | undefined;
}
