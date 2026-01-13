'use client';

import { useState, useEffect, useCallback } from 'react';
import StatusPane from '@/components/StatusPane';
import FeedEntries from '@/components/FeedEntries';
import { RssEntry, fetchOgData } from '@/utils/rssParser';
import { saveEntries, loadEntries } from '@/utils/entryStorage';
import { TagFilters, DEFAULT_TAG_FILTERS } from '@/utils/tagFilter';
import styles from './page.module.css';

const TAG_FILTERS_STORAGE_KEY = 'social-listening-tag-filters';

export default function Home() {
  const [entries, setEntries] = useState<RssEntry[]>([]);
  const [errors, setErrors] = useState<Array<{ feedTitle: string; error: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tagFilters, setTagFilters] = useState<TagFilters>(DEFAULT_TAG_FILTERS);

  // Load entries and tag filters from localStorage on mount
  useEffect(() => {
    const storedEntries = loadEntries();
    setEntries(storedEntries);
    
    // Load tag filters
    const storedFilters = localStorage.getItem(TAG_FILTERS_STORAGE_KEY);
    if (storedFilters) {
      try {
        const parsed = JSON.parse(storedFilters);
        
        // Sanitize filter values - convert any old values to 'shown'
        // (handles migration from old 3-state model: 'include'/'exclude'/'off')
        const sanitizeValue = (val: unknown): 'shown' | 'hidden' => 
          val === 'hidden' ? 'hidden' : 'shown';
        
        const sanitizedFilters: TagFilters = {
          comment: sanitizeValue(parsed.comment),
          crossPost: sanitizeValue(parsed.crossPost),
          deleted: sanitizeValue(parsed.deleted),
          mentionsInterest: sanitizeValue(parsed.mentionsInterest),
          github: sanitizeValue(parsed.github),
          statusToProcess: sanitizeValue(parsed.statusToProcess),
          statusDone: sanitizeValue(parsed.statusDone),
          statusIgnored: sanitizeValue(parsed.statusIgnored),
          feeds: {},
        };
        
        // Sanitize feed filters
        if (parsed.feeds && typeof parsed.feeds === 'object') {
          for (const [key, val] of Object.entries(parsed.feeds)) {
            sanitizedFilters.feeds[key] = sanitizeValue(val);
          }
        }
        
        setTagFilters(sanitizedFilters);
      } catch {
        // Use defaults if parsing fails
      }
    }
    
    setMounted(true);
  }, []);

  const handleSyncStart = () => {
    setLoading(true);
    setErrors([]);
  };

  const handleTagFiltersChange = useCallback((filters: TagFilters) => {
    setTagFilters(filters);
    localStorage.setItem(TAG_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, []);

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
      <StatusPane 
        onSyncStart={handleSyncStart} 
        onSyncComplete={handleSyncComplete}
        tagFilters={tagFilters}
        onTagFiltersChange={handleTagFiltersChange}
        entries={entries}
      />
      <FeedEntries entries={entries} errors={errors} loading={loading} tagFilters={tagFilters} />
    </div>
  );
}
