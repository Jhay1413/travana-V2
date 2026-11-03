export const CSV_HEADERS = [
  'Tour Operator',
  'Phone',
  'Weblink',
  'Username',
  'Password',
  'Commission Rate',
  'Balance Due (weeks)',
] as const;

export interface ExportRow {
  name: string;
  phone: string | null;
  website: string | null;
  username: string | null;
  /** Plaintext; only ever filled for admin-ish roles. */
  password: string | null;
  commission_percentage: string | null;
  balance_due_weeks: number;
}

/** A leading + or - is fine when the whole cell is just a phone number or a number. */
const PLAIN_SIGNED = /^[+-][\d\s().-]+$/;

/**
 * Spreadsheet formula-injection guard: a cell that Excel/Sheets would run as a
 * formula (=, @, tab, CR, or +/- that is not a plain phone/number) gets a
 * leading apostrophe so it is shown as text.
 */
export function guardFormula(cell: string): string {
  if (cell === '') return cell;
  const first = cell[0];
  if (first === '=' || first === '@' || first === '\t' || first === '\r') return `'${cell}`;
  if ((first === '+' || first === '-') && !PLAIN_SIGNED.test(cell)) return `'${cell}`;
  return cell;
}

/** RFC 4180: quote when the cell holds a comma, quote, CR or LF; double inner quotes. */
export function quoteCell(cell: string): string {
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

function formatCommission(value: string | null): string {
  if (value === null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : '';
}

/** Builds the export file. Passwords are blank unless `includePasswords`. */
export function buildOperatorsCsv(rows: ExportRow[], includePasswords: boolean): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    // The password cell is NOT formula-guarded: a leading apostrophe would change
    // the stored password on re-import. It is only RFC 4180 quoted.
    const password = includePasswords ? (r.password ?? '') : '';
    const cells = [
      guardFormula(r.name),
      guardFormula(r.phone ?? ''),
      guardFormula(r.website ?? ''),
      guardFormula(r.username ?? ''),
      password,
      formatCommission(r.commission_percentage),
      String(r.balance_due_weeks),
    ];
    lines.push(cells.map(quoteCell).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
