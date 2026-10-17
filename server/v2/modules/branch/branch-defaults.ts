// Default schedule for branches created by signup and the onboarding wizard.
// Day keys use the short form ("Mon".."Sun") because the branch editor reads
// them that way; no server code reads these keys.
export const DEFAULT_BRANCH_OPENING_PATTERN = 'mon-fri' as const;
export const DEFAULT_BRANCH_BANK_HOLIDAYS_OPEN = false;

export interface BranchDayHours {
  day: string;
  open: boolean;
  openTime: string;
  closeTime: string;
}

const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const DEFAULT_BRANCH_HOURS: ReadonlyArray<Readonly<BranchDayHours>> = DAY_KEYS.map((day, i) => ({
  day,
  open: i < 5,
  openTime: '08:00',
  closeTime: '17:00',
}));

/** A fresh, mutable copy of the default week. */
export function buildDefaultBranchHours(): BranchDayHours[] {
  return DEFAULT_BRANCH_HOURS.map((h) => ({ ...h }));
}

/** The schedule columns every wizard-created branch starts with. */
export function buildDefaultBranchSchedule() {
  return {
    openingPattern: DEFAULT_BRANCH_OPENING_PATTERN,
    bankHolidaysOpen: DEFAULT_BRANCH_BANK_HOLIDAYS_OPEN,
    openingHours: buildDefaultBranchHours(),
  };
}
