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

// The AI's per-turn decision for the enquiry slot-filling state machine (§14).
// There is no customer-confirmation gate — the worker creates the enquiry in
// code once a single grouped follow-up has been asked (see reply-worker).
export interface AiTurn {
  hand_off: boolean;
  intent: "enquiry" | "other";
  slots: EnquirySlots;
  reply: string;
  // Populated while collecting client details for an unknown contact.
  client: ClientDetails;
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

export interface RetrievedContext {
  kb: RetrievedMatch[];
  quotes: RetrievedMatch[];
}

// Minimal shape buildTranscript needs from a transport-specific message type
// (e.g. SendSeven's SsMessage). Kept intentionally narrow so this module has
// no dependency on any single driver's message type.
export interface TranscriptMessage {
  direction: string;
  text?: string | null;
  created_at?: string | null;
}
