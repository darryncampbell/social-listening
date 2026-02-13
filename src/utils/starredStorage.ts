const STORAGE_KEY = 'social-listening-starred';

/**
 * Get all starred entry IDs from localStorage
 */
export function getStarredEntryIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const ids = JSON.parse(stored) as string[];
      return new Set(Array.isArray(ids) ? ids : []);
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

/**
 * Check if an entry is starred
 */
export function isEntryStarred(entryId: string): boolean {
  return getStarredEntryIds().has(entryId);
}

/**
 * Toggle starred state for an entry
 */
export function toggleStarred(entryId: string): void {
  const starred = getStarredEntryIds();
  if (starred.has(entryId)) {
    starred.delete(entryId);
  } else {
    starred.add(entryId);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(starred)));
}

/**
 * Set starred state for an entry
 */
export function setStarred(entryId: string, starred: boolean): void {
  const ids = getStarredEntryIds();
  if (starred) {
    ids.add(entryId);
  } else {
    ids.delete(entryId);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
}

/**
 * Remove starred status from all entries
 */
export function clearAllStarred(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
}
