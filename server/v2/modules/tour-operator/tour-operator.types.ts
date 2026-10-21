
/** Dropdown option for quote/booking/pipeline forms. `id` is the CATALOGUE id. No credentials. */
export interface TourOperatorOption {
  id: string;
  linkId: string;
  name: string;
  logo_url: string | null;
  code: string | null;
  commission_percentage: string | null;
  balance_due_weeks: number;
  is_active: boolean;
}

/** A link joined with its catalogue row, exactly as the repository returns it. */
export interface RawOrgOperator {
  linkId: string;
  operatorId: string;
  name: string;
  code: string | null;
  website: string | null;
  phone: string | null;
  logo_url: string | null;
  username: string | null;
  encrypted_password: string | null;
  commission_percentage: string | null;
  balance_due_weeks: number;
  is_active: boolean;
  updated_at: Date;
}

/** A row on the Tour operators page. `password` only exists for admin-ish roles. */
export interface OrgOperatorRow {
  linkId: string;
  id: string;
  name: string;
  code: string | null;
  website: string | null;
  phone: string | null;
  logo_url: string | null;
  username: string | null;
  password?: string | null;
  hasPassword: boolean;
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

/** One uploaded line; all cells are raw strings (parsed client-side from CSV). */
export interface ImportRowInput {
  line: number;
  name?: string;
  phone?: string;
  website?: string;
  username?: string;
  password?: string;
  commission?: string;
  balanceWeeks?: string;
}

export type ImportStatus = 'new' | 'update' | 'same' | 'error';

/** The cleaned values an import row will write (blank cells are undefined = keep). */
export interface ImportValues {
  name: string;
  phone?: string;
  website?: string;
  username?: string;
  password?: string;
  commission?: number;
  balanceWeeks?: number;
}

export interface ImportPlanRow {
  line: number;
  name: string;
  status: ImportStatus;
  message?: string;
  commission?: number | null;
}

/** Internal plan: the public row plus what apply() needs. Never sent to the client. */
export interface ImportPlanEntry extends ImportPlanRow {
  values?: ImportValues;
  linkId?: string;
  operatorId?: string;
  /** True when the catalogue row has to be created. */
  createCatalogue?: boolean;
}

export interface ImportCounts {
  new: number;
  update: number;
  same: number;
  error: number;
}

export interface ImportPreview {
  rows: ImportPlanRow[];
  counts: ImportCounts;
}

export interface ImportResult {
  added: number;
  updated: number;
  unchanged: number;
  errors: Array<{ row: number; message: string }>;
}

/** What an existing link looks like to the import planner (password decrypted or null). */
export interface ExistingLink {
  linkId: string;
  operatorId: string;
  name: string;
  phone: string | null;
  website: string | null;
  username: string | null;
  password: string | null;
  commission: number | null;
  balanceWeeks: number;
}

/** A catalogue operator the planner can match by lower-cased trimmed name. */
export interface CatalogueMatch {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
}

/** A trusted internal call (no request scope) is allowed to skip operator-in-org checks. */
export type ScopeOrTrusted = { orgId: string | null };
