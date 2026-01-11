export type EntryStatus = 'to_process' | 'processed' | 'ignored';

const STORAGE_KEY = 'social-listening-entry-states';

interface EntryStates {
  [entryId: string]: EntryStatus;
}

/**
 * Get all entry states from localStorage
 */
export function getEntryStates(): EntryStates {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

/**
 * Get status for a specific entry
 */
export function getEntryStatus(entryId: string): EntryStatus {
  const states = getEntryStates();
  return states[entryId] || 'to_process';
}

/**
 * Set status for a specific entry
 */
export function setEntryStatus(entryId: string, status: EntryStatus): void {
  const states = getEntryStates();
  
  if (status === 'to_process') {
    // Remove from states to save space (default is to_process)
    delete states[entryId];
  } else {
    states[entryId] = status;
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
}

/**
 * Mark entry as processed
 */
export function markAsProcessed(entryId: string): void {
  setEntryStatus(entryId, 'processed');
}

/**
 * Mark entry as ignored
 */
export function markAsIgnored(entryId: string): void {
  setEntryStatus(entryId, 'ignored');
}

/**
 * Restore entry to to_process
 */
export function restoreEntry(entryId: string): void {
  setEntryStatus(entryId, 'to_process');
}
