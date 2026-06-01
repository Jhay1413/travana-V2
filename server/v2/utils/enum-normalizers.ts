const BUDGET_TYPE_MAP: Record<string, string> = {
  "Per Person": "PER_PERSON",
  "per person": "PER_PERSON",
  "PER_PERSON": "PER_PERSON",
  "Package": "PACKAGE",
  "package": "PACKAGE",
  "PACKAGE": "PACKAGE",
};

const ENQUIRY_STATUS_MAP: Record<string, string> = {
  "Active": "ACTIVE",
  "active": "ACTIVE",
  "ACTIVE": "ACTIVE",
  "New Lead": "NEW_LEAD",
  "new_lead": "NEW_LEAD",
  "NEW_LEAD": "NEW_LEAD",
  "Lost": "LOST",
  "LOST": "LOST",
  "Inactive": "INACTIVE",
  "INACTIVE": "INACTIVE",
  "Expired": "EXPIRED",
  "EXPIRED": "EXPIRED",
};

/**
 * Normalize enquiry display values (e.g. "Per Person", "New Lead") to the
 * underlying Postgres enum values before they reach the repository layer.
 */
export function normalizeEnquiry<T extends Record<string, any>>(data: T): T {
  const normalized: Record<string, any> = { ...data };
  if (normalized.budget_type) {
    normalized.budget_type = BUDGET_TYPE_MAP[normalized.budget_type] || "PACKAGE";
  }
  if (normalized.status) {
    normalized.status = ENQUIRY_STATUS_MAP[normalized.status] || "NEW_LEAD";
  }
  return normalized as T;
}
