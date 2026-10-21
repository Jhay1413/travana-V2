import type { OrgOperatorRow, RawOrgOperator, TourOperatorOption } from './tour-operator.types';

type Decrypt = (ciphertext: string) => string;

/** Decrypts a stored password; any failure (bad key, corrupt payload) yields null and never echoes the ciphertext. */
export function safeDecrypt(ciphertext: string | null, decrypt: Decrypt): string | null {
  if (!ciphertext) return null;
  try {
    return decrypt(ciphertext);
  } catch {
    return null;
  }
}

/** Dropdown option: identity and money settings only, never credentials. */
export function toOption(raw: RawOrgOperator): TourOperatorOption {
  return {
    id: raw.operatorId,
    linkId: raw.linkId,
    name: raw.name,
    logo_url: raw.logo_url,
    code: raw.code,
    commission_percentage: raw.commission_percentage,
    balance_due_weeks: raw.balance_due_weeks,
    is_active: raw.is_active,
  };
}

export interface RowMapOptions {
  revealPasswords: boolean;
  decrypt: Decrypt;
}

/**
 * Page row. `password` is present ONLY when revealPasswords is true; otherwise
 * the key is absent and only `hasPassword` tells the UI one is stored.
 */
export function toOrgOperatorRow(raw: RawOrgOperator, opts: RowMapOptions): OrgOperatorRow {
  const row: OrgOperatorRow = {
    linkId: raw.linkId,
    id: raw.operatorId,
    name: raw.name,
    code: raw.code,
    website: raw.website,
    phone: raw.phone,
    logo_url: raw.logo_url,
    username: raw.username,
    hasPassword: Boolean(raw.encrypted_password),
    commission_percentage: raw.commission_percentage,
    balance_due_weeks: raw.balance_due_weeks,
    is_active: raw.is_active,
    updated_at: raw.updated_at.toISOString(),
  };
  if (opts.revealPasswords) row.password = safeDecrypt(raw.encrypted_password, opts.decrypt);
  return row;
}
