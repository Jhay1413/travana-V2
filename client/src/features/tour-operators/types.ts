/** Mirrors the server's `GET /tour-operators/manage` row (link joined with the catalogue). */
export interface OrgOperatorRow {
  linkId: string;
  /** Catalogue id. */
  id: string;
  name: string;
  code: string | null;
  website: string | null;
  phone: string | null;
  logo_url: string | null;
  username: string | null;
  /** Plain text, only sent to owners, admins and branch managers. */
  password?: string | null;
  hasPassword: boolean;
  /** Decimal string such as "10.00", or null when not set. */
  commission_percentage: string | null;
  balance_due_weeks: number;
  is_active: boolean;
  updated_at: string;
}

export interface ManageResponse {
  rows: OrgOperatorRow[];
  canWrite: boolean;
  canSeePasswords: boolean;
}

export interface CatalogueRow {
  id: string;
  name: string;
  code: string | null;
  website: string | null;
  phone: string | null;
  logo_url: string | null;
  linked: boolean;
}

export interface CreateOperatorPayload {
  tourOperatorId?: string;
  name?: string;
  website?: string;
  phone?: string;
  commissionPercentage: number;
  balanceDueWeeks: number;
  username?: string;
  password?: string;
}

export interface PatchOperatorPayload {
  name?: string;
  website?: string;
  phone?: string;
  /** null clears the rate (shown as "not set"). */
  commissionPercentage?: number | null;
  balanceDueWeeks?: number;
  username?: string;
  /** "" clears the stored password. */
  password?: string;
  isActive?: boolean;
}

export interface ImportRowInput {
  line: number;
  name: string;
  phone: string;
  website: string;
  username: string;
  password: string;
  commission: string;
  balanceWeeks: string;
}

export type ImportStatus = "new" | "update" | "same" | "error";

export interface ImportPlanRow {
  line: number;
  name: string;
  status: ImportStatus;
  message?: string;
  commission?: string | number | null;
}

export interface ImportPreview {
  rows: ImportPlanRow[];
  counts: Partial<Record<ImportStatus, number>>;
}

export interface ImportResult {
  added: number;
  updated: number;
  unchanged: number;
  errors: Array<{ row: number; message: string }>;
}

/** The seven form fields as typed, plus the Inactive switch when editing. */
export interface OperatorFormValues {
  name: string;
  phone: string;
  web: string;
  username: string;
  password: string;
  commission: string;
  balanceWeeks: string;
  isActive: boolean;
}

export type OperatorFormField = Exclude<keyof OperatorFormValues, "isActive">;
export type OperatorFormErrors = Partial<Record<OperatorFormField, string>>;

export type SortKey = "name" | "commission";
export interface SortState {
  key: SortKey;
  dir: 1 | -1;
}
