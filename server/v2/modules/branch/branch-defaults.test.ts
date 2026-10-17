import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BRANCH_HOURS,
  buildDefaultBranchHours,
  buildDefaultBranchSchedule,
} from './branch-defaults';

describe('branch defaults', () => {
  it('is 08:00-17:00 Mon-Fri with Sat and Sun closed, in Mon..Sun order', () => {
    expect(DEFAULT_BRANCH_HOURS.map((h) => h.day)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(DEFAULT_BRANCH_HOURS.filter((h) => h.open).map((h) => h.day)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    for (const h of DEFAULT_BRANCH_HOURS) {
      expect(h.openTime).toBe('08:00');
      expect(h.closeTime).toBe('17:00');
    }
  });

  it('returns independent copies', () => {
    const a = buildDefaultBranchHours();
    a[0].open = false;
    expect(buildDefaultBranchHours()[0].open).toBe(true);
    expect(DEFAULT_BRANCH_HOURS[0].open).toBe(true);
  });

  it('builds the full schedule columns', () => {
    const s = buildDefaultBranchSchedule();
    expect(s.openingPattern).toBe('mon-fri');
    expect(s.bankHolidaysOpen).toBe(false);
    expect(s.openingHours).toHaveLength(7);
  });
});
