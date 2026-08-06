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
  // A credentials blob exists but this environment's key can't read it, so
  // every flag above reads false. Distinguishes that from "none set".
  credentialsUnreadable: boolean;
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
