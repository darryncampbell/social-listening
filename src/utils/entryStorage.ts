import { RssEntry } from './rssParser';

const ENTRIES_STORAGE_KEY = 'social-listening-entries';

/**
 * Strip bulky fields that aren't needed for display to reduce storage size.
 * rawXml is only used for a debug "Show Raw Details" view and can be re-fetched.
 */
function stripForStorage(entries: RssEntry[]): RssEntry[] {
  return entries.map(({ rawXml, ...rest }) => ({ ...rest, rawXml: '' }));
}

/**
 * Save entries to localStorage, stripping bulky fields to stay within quota.
 * If storage is still exceeded, trims the oldest entries until it fits.
 */
export function saveEntries(entries: RssEntry[]): void {
  if (typeof window === 'undefined') return;

  const stripped = stripForStorage(entries);

  try {
    localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(stripped));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      // Sort by date descending, then trim oldest entries until it fits
      const sorted = [...stripped].sort((a, b) =>
        new Date(b.publishedDate || 0).getTime() - new Date(a.publishedDate || 0).getTime()
      );

      let trimmed = sorted;
      while (trimmed.length > 0) {
        trimmed = trimmed.slice(0, Math.floor(trimmed.length * 0.8));
        try {
          localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(trimmed));
          console.warn(`Storage quota exceeded. Trimmed entries from ${entries.length} to ${trimmed.length}.`);
          return;
        } catch {
          // Keep trimming
        }
      }
    }
    throw e;
  }
}

/**
 * Load entries from localStorage
 */
export function loadEntries(): RssEntry[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(ENTRIES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

/**
 * Clear entries from localStorage
 */
export function clearEntries(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ENTRIES_STORAGE_KEY);
}
