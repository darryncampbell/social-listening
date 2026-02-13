/**
 * Export and import entry data only (social-listening-entries in localStorage).
 */

const ENTRIES_STORAGE_KEY = 'social-listening-entries';

export interface ExportedEntriesData {
  entries: unknown[];
}

/**
 * Read current entries from localStorage.
 */
export function exportEntries(): ExportedEntriesData {
  if (typeof window === 'undefined') return { entries: [] };
  try {
    const raw = localStorage.getItem(ENTRIES_STORAGE_KEY);
    const entries = raw ? (JSON.parse(raw) as unknown[]) : [];
    return { entries: Array.isArray(entries) ? entries : [] };
  } catch {
    return { entries: [] };
  }
}

/**
 * Merge imported entries with current entries (by id; imported wins on duplicate).
 * Writes merged result to localStorage.
 */
export function importEntries(data: ExportedEntriesData): void {
  if (typeof window === 'undefined') return;
  const imported = Array.isArray(data?.entries) ? data.entries : [];
  try {
    const raw = localStorage.getItem(ENTRIES_STORAGE_KEY);
    const existing: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : [];
    const byId = new Map<string, unknown>();
    for (const entry of existing) {
      const id = (entry as { id?: string })?.id;
      if (id != null) byId.set(id, entry);
    }
    for (const entry of imported) {
      const id = (entry as { id?: string })?.id;
      if (id != null) byId.set(id, entry);
    }
    localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(Array.from(byId.values())));
  } catch {
    // If merge fails, just set to imported
    localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(imported));
  }
}

/**
 * Trigger download of current entries as a JSON file.
 */
export function downloadExportedEntries(): void {
  const data = exportEntries();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `social-listening-entries-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
