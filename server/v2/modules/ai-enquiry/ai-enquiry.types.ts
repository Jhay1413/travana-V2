// The normalized, free-text travel enquiry the AI extracts from a conversation
// transcript. All values are plain names/strings — the client resolves them to
// lookup IDs (countries, destinations, board basis, airports, holiday type)
// against the same lookup data the enquiry wizard uses. Resorts are intentionally
// left as free text (added to notes) per product decision.
export interface EnquiryIntent {
  enquiryTitle: string;
  holidayType: string; // e.g. "Package Holiday" | "Cruise Package" | "Hot Tub Break"
  countries: string[];
  destinations: string[];
  resorts: string[];
  departureAirports: string[];
  boardBasis: string[];
  starRating: string; // "2 Star".."5 Star" or ""
  travelDate: string; // ISO yyyy-mm-dd or ""
  flexibility: string;
  nights: number | null;
  adults: number;
  children: number;
  infants: number;
  childAges: number[];
  budget: string; // numeric string or ""
  budgetType: string; // "Per Person" | "Package"
  notes: string; // summary of anything relevant but not captured in a field
  confidence: "low" | "medium" | "high";
}
