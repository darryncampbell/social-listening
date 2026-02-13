/**
 * Date filter for entries. Values are stored in localStorage.
 * Cutoff is computed at filter time: keep entries with date >= (now - period).
 */

export type DateFilterValue =
  | '24h'
  | '2d'
  | '3d'
  | '5d'
  | '7d'
  | '14d'
  | '30d'
  | 'all';

export const DEFAULT_DATE_FILTER: DateFilterValue = 'all';

export const DATE_FILTER_OPTIONS: { value: DateFilterValue; label: string }[] = [
  { value: 'all', label: 'All-time' },
  { value: '24h', label: 'Past 24 hours' },
  { value: '2d', label: 'Past 2 days' },
  { value: '3d', label: 'Past 3 days' },
  { value: '5d', label: 'Past 5 days' },
  { value: '7d', label: 'Past 7 days' },
  { value: '14d', label: 'Past 14 days' },
  { value: '30d', label: 'Past month' },
];

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Return minimum timestamp (ms) for entries to keep, or null for no date filter. */
export function getDateFilterCutoff(value: DateFilterValue): number | null {
  if (value === 'all') return null;
  const now = Date.now();
  switch (value) {
    case '24h':
      return now - 24 * MS_PER_HOUR;
    case '2d':
      return now - 2 * MS_PER_DAY;
    case '3d':
      return now - 3 * MS_PER_DAY;
    case '5d':
      return now - 5 * MS_PER_DAY;
    case '7d':
      return now - 7 * MS_PER_DAY;
    case '14d':
      return now - 14 * MS_PER_DAY;
    case '30d':
      return now - 30 * MS_PER_DAY;
    default:
      return null;
  }
}

/** Sanitize stored value to a valid DateFilterValue. */
export function parseDateFilterValue(stored: string | null): DateFilterValue {
  const valid: DateFilterValue[] = ['24h', '2d', '3d', '5d', '7d', '14d', '30d', 'all'];
  if (stored && valid.includes(stored as DateFilterValue)) {
    return stored as DateFilterValue;
  }
  return DEFAULT_DATE_FILTER;
}
