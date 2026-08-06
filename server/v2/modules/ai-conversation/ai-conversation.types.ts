// Shared types for the "brain" of AI-driven conversational drivers (currently
// the SendSeven auto-reply worker; intended to be reused by future drivers).
// This module must not depend on any single driver (e.g. sendseven-webhook).

// Free-text enquiry details the AI collects across turns (stored on
// sendseven_conversation_state.enquiry_slots). The worker resolves the lookup
// names → IDs server-side at creation time (§14).
export interface EnquirySlots {
  enquiryTitle?: string;
  holidayType?: string; // "Package Holiday" | "Cruise Package" | "Hot Tub Break"
  countries?: string[];
  destinations?: string[];
  resorts?: string[];
  departureAirports?: string[];
  boardBasis?: string[];
  starRating?: string;
  travelDate?: string;
  flexibility?: string;
  nights?: number | null;
  adults?: number;
  children?: number;
  infants?: number;
  childAges?: number[];
  budget?: string;
  budgetType?: string;
  // Cruise
  cabinType?: string;
  cruiseLine?: string;
  preCruiseStay?: number | null;
  postCruiseStay?: number | null;
  // Hot tub
  guests?: number | null;
  pets?: number | null;
  weekendLodge?: string;
  accommodationType?: string;
  notes?: string;
}

// Client details the AI collects when the contact isn't linked to a CRM client.
export interface ClientDetails {
  fullName?: string;
  phone?: string;
  email?: string;
}

// When the customer is enquiring on behalf of SOMEONE ELSE (e.g. "my friend
// James wants to book Benidorm"), the enquiry belongs to that third party — the
// traveller — not the person messaging. The AI reports the traveller's details
// here so the worker can file the enquiry under them and ask only for the phone.
export interface EnquiryBeneficiary {
  onBehalf?: boolean;
  fullName?: string;
  phone?: string;
}

// The AI's per-turn decision for the enquiry slot-filling state machine (§14).
// There is no customer-confirmation gate — the worker creates the enquiry in
// code once a single grouped follow-up has been asked (see reply-worker).
export interface AiTurn {
  hand_off: boolean;
  intent: "enquiry" | "other";
  // Model-declared "every core field has been given or explicitly declined".
  // Needed because a declined/no-preference core field (e.g. "any date is
  // fine") legitimately leaves its slot EMPTY, so the server-side
  // missingCoreFieldsFor gate alone would wait forever on a customer who has
  // in fact answered everything. Feeds shouldCreateEnquiryNow.
  complete?: boolean;
  slots: EnquirySlots;
  reply: string;
  // Populated while collecting client details for an unknown contact.
  client: ClientDetails;
  // Set when the enquiry is being made on behalf of a named third party.
  beneficiary?: EnquiryBeneficiary;
}

// Best-effort vector-retrieval matches (Phase 5a's aiEmbeddingsService.retrieve),
// threaded into buildSystemPrompt (Phase 5d). Redefined minimally here rather
// than importing the repository's EmbeddingMatch type across module boundaries.
export interface RetrievedMatch {
  sourceId: string;
  content: string;
  metadata: unknown;
  distance: number;
}

// One leg of the pinned deal's flights, resolved names + times — rendered into
// the prompt so the AI can answer "what are the flight times?" for a posted deal.
export interface RetrievedDealFlight {
  direction?: string | null; // quote_flights.flight_type (e.g. "outbound")
  flightNumber?: string | null;
  from?: string | null;
  to?: string | null;
  departs?: string | null; // ISO datetime
  arrives?: string | null; // ISO datetime
}

// The Facebook-posted deal this conversation is about (pinned on
// sendseven_conversation_state.context.dealRef, hydrated live each turn).
// PUBLIC content — unlike `quotes` below, which are internal-only reference,
// the AI is allowed to surface these details: they were published in the post.
export interface RetrievedDealContext {
  // True while the one-time "as posted, or any tweaks?" check hasn't happened
  // yet for this conversation — the driver computes it from
  // context.dealCheckAsked and flips that flag after the first sales turn
  // that had the chance to ask. Presentation-only; not persisted itself.
  tweakCheckPending?: boolean;
  title: string;
  travelDate?: string | null;
  nights?: number | null;
  boardBasis?: string | null;
  departureAirport?: string | null;
  price?: string | null; // as posted, "from" pricing
  hotelName?: string | null;
  resort?: string | null;
  destination?: string | null;
  country?: string | null;
  resortSummary?: string | null;
  luggageTransfers?: string | null;
  flights?: RetrievedDealFlight[];
}

export interface RetrievedContext {
  kb: RetrievedMatch[];
  quotes: RetrievedMatch[];
  // Present when the conversation has a pinned Facebook deal (see
  // deal-context.service in the sendseven-webhook module).
  deal?: RetrievedDealContext | null;
  // Possible-but-unconfirmed posted deals ("i saw a deal for tunisia…") —
  // set only when NO deal is pinned. The brain offers these titles and asks
  // which post the customer saw; their answer makes the next turn's vector
  // search pin it. Never seeded or stated as fact.
  dealCandidates?: Array<{
    title: string;
    travelDate?: string | null;
    nights?: number | null;
    price?: string | null;
  }>;
}

// Minimal shape buildTranscript needs from a transport-specific message type
// (e.g. SendSeven's SsMessage). Kept intentionally narrow so this module has
// no dependency on any single driver's message type.
export interface TranscriptMessage {
  direction: string;
  text?: string | null;
  created_at?: string | null;
}
