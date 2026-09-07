// Client-side view of a per-org supplier scraper config. Mirrors
// SupplierScraperView on the server — credentials are never sent to the client,
// only booleans indicating whether each is set.
export interface SupplierScraperCredentialsState {
  hasUsername: boolean;
  hasPassword: boolean;
  hasApiKey: boolean;
  hasAbtaNumber: boolean;
}

export interface SupplierScraper {
  id: string;
  supplierKey: string;
  supplierName: string;
  adapterType: string;
  isActive: boolean;
  tourOperatorId: string | null;
  config: Record<string, unknown>;
  credentials: SupplierScraperCredentialsState;
  // A stored credentials blob exists but cannot be decrypted with the current
  // key. Never blocks an import — the capture flow does not use credentials.
  credentialsUnreadable?: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface UpsertSupplierScraperInput {
  supplierKey?: string; // required on create
  supplierName?: string;
  adapterType?: string;
  tourOperatorId?: string | null;
  isActive?: boolean;
  config?: Record<string, unknown>;
  // Send only fields you want to change; "" clears a stored credential.
  credentials?: { username?: string; password?: string; apiKey?: string; abtaNumber?: string };
}

// Result of POST /scrapers/picks (EXTRACTION_STATUS.md §4, "Picker → spec
// derivation"). The picker itself runs in the bookmarklet — an agent arms a
// field and clicks the element on the real page — and pastes the resulting
// payload here, exactly like the capture-import paste flow. This is the
// FIXED response contract; do not add fields the server doesn't send.
export interface SupplierScraperPickApplied {
  field: string;
  strategy: string;
  confidence: "high" | "medium" | "low";
  verifiedValue: string;
  replaced: "generated" | "picked" | null;
}

export interface SupplierScraperPickProblem {
  field: string;
  reason: string;
}

export interface SupplierScraperPicksResult {
  supplierKey: string;
  applied: SupplierScraperPickApplied[];
  problems: SupplierScraperPickProblem[];
  preserved: string[];
  specNeedsReview: boolean;
}
