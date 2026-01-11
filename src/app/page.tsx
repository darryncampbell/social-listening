'use client';

import { useState, useEffect, useCallback } from 'react';
import StatusPane from '@/components/StatusPane';
import FeedEntries from '@/components/FeedEntries';
import { RssEntry, fetchOgData } from '@/utils/rssParser';
import { saveEntries, loadEntries } from '@/utils/entryStorage';
import styles from './page.module.css';

export default function Home() {
  const [entries, setEntries] = useState<RssEntry[]>([]);
  const [errors, setErrors] = useState<Array<{ feedTitle: string; error: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load entries from localStorage on mount
  useEffect(() => {
    const storedEntries = loadEntries();
    setEntries(storedEntries);
    setMounted(true);
  }, []);

  const handleSyncStart = () => {
    setLoading(true);
    setErrors([]);
  };

  // Fetch OG data for entries that don't have it yet
  const fetchOgDataForEntries = useCallback(async (entriesToProcess: RssEntry[]) => {
    const entriesNeedingOg = entriesToProcess.filter(e => e.ogLoading && !e.og);
    
    // Process entries one at a time to show progress
    for (const entry of entriesNeedingOg) {
      const og = await fetchOgData(entry.link);
      
      setEntries(prev => {
        const updated = prev.map(e => 
          e.id === entry.id 
            ? { ...e, og, ogLoading: false }
            : e
        );
        // Save to localStorage after each update
        saveEntries(updated);
        return updated;
      });
    }
  }, []);

  const handleSyncComplete = useCallback((
    newEntries: RssEntry[],
    newErrors: Array<{ feedTitle: string; error: string }>
  ) => {
    // Merge with existing OG data if we have it
    const existingEntries = loadEntries();
    const existingOgMap = new Map(
      existingEntries
        .filter(e => e.og)
        .map(e => [e.id, e.og])
    );

    // Apply existing OG data to new entries
    const entriesWithExistingOg = newEntries.map(entry => {
      const existingOg = existingOgMap.get(entry.id);
      if (existingOg) {
        return { ...entry, og: existingOg, ogLoading: false };
      }
      return entry;
    });

    setEntries(entriesWithExistingOg);
    setErrors(newErrors);
    setLoading(false);
    
    // Save entries immediately (without waiting for OG data)
    saveEntries(entriesWithExistingOg);

    // Start fetching OG data asynchronously for entries that need it
    fetchOgDataForEntries(entriesWithExistingOg);
  }, [fetchOgDataForEntries]);

  if (!mounted) {
    return null;
  }

  return (
    <div className={styles.container}>
      <StatusPane onSyncStart={handleSyncStart} onSyncComplete={handleSyncComplete} />
      <FeedEntries entries={entries} errors={errors} loading={loading} />
    </div>
  );
}
