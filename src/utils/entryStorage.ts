import { RssEntry } from './rssParser';

const ENTRIES_STORAGE_KEY = 'social-listening-entries';

/**
 * Save entries to localStorage
 */
export function saveEntries(entries: RssEntry[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
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
