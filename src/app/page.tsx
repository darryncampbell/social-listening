'use client';

import { useState, useEffect, useCallback } from 'react';
import StatusPane from '@/components/StatusPane';
import FeedEntries from '@/components/FeedEntries';
import { RssEntry, fetchOgData } from '@/utils/rssParser';
import { saveEntries, loadEntries } from '@/utils/entryStorage';
import { TagFilters, DEFAULT_TAG_FILTERS } from '@/utils/tagFilter';
import styles from './page.module.css';

const TAG_FILTERS_STORAGE_KEY = 'social-listening-tag-filters';

/**
 * Deduplicate entries by URL, keeping the entry with the most recent date.
 * This handles cases where the same article appears multiple times in feeds.
 */
function deduplicateEntries(entries: RssEntry[]): RssEntry[] {
  const urlMap = new Map<string, RssEntry>();
  
  for (const entry of entries) {
    const url = entry.link;
    if (!url) {
      // Keep entries without URLs as-is (shouldn't happen, but be safe)
      continue;
    }
    
    const existing = urlMap.get(url);
    if (!existing) {
      urlMap.set(url, entry);
    } else {
      // Keep the entry with the more recent date
      const existingDate = new Date(existing.publishedDate || 0).getTime();
      const newDate = new Date(entry.publishedDate || 0).getTime();
      
      if (newDate > existingDate) {
        // New entry is more recent - but preserve OG data from existing if available
        urlMap.set(url, {
          ...entry,
          og: entry.og || existing.og,
          ogLoading: entry.og ? false : existing.ogLoading,
        });
      } else if (existing.og && !entry.og) {
        // Keep existing (it's newer or same), but nothing to do
      }
      // Otherwise keep existing (it's newer)
    }
  }
  
  return Array.from(urlMap.values());
}

const ONLY_SHOW_MENTIONS_STORAGE_KEY = 'social-listening-only-show-mentions';

export default function Home() {
  const [entries, setEntries] = useState<RssEntry[]>([]);
  const [errors, setErrors] = useState<Array<{ feedTitle: string; error: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tagFilters, setTagFilters] = useState<TagFilters>(DEFAULT_TAG_FILTERS);
  const [onlyShowMentions, setOnlyShowMentions] = useState(false);

  // Load entries and tag filters from localStorage on mount
  useEffect(() => {
    const storedEntries = loadEntries();
    // Deduplicate in case there are existing duplicates from before this fix
    const deduplicatedEntries = deduplicateEntries(storedEntries);
    setEntries(deduplicatedEntries);
    // Save back if we removed duplicates
    if (deduplicatedEntries.length < storedEntries.length) {
      saveEntries(deduplicatedEntries);
    }
    
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
    
    // Load "only show mentions" filter
    const storedOnlyShowMentions = localStorage.getItem(ONLY_SHOW_MENTIONS_STORAGE_KEY);
    if (storedOnlyShowMentions === 'true') {
      setOnlyShowMentions(true);
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

  const handleOnlyShowMentionsChange = useCallback((enabled: boolean) => {
    setOnlyShowMentions(enabled);
    localStorage.setItem(ONLY_SHOW_MENTIONS_STORAGE_KEY, enabled ? 'true' : 'false');
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
    // Get existing entries to preserve historical data
    const existingEntries = loadEntries();
    
    // Create a map of existing OG data for reuse
    const existingOgMap = new Map(
      existingEntries
        .filter(e => e.og)
        .map(e => [e.id, e.og])
    );

    // Create a set of new entry URLs for quick lookup
    const newEntryUrls = new Set(newEntries.map(e => e.link));
    
    // Find historical entries that are NOT in the new sync (they "fell off" the feed)
    // These are entries we want to preserve
    const historicalEntries = existingEntries.filter(e => !newEntryUrls.has(e.link));

    // Apply existing OG data to new entries, but prefer new OG data if it has an image
    const entriesWithExistingOg = newEntries.map(entry => {
      const existingOg = existingOgMap.get(entry.id);
      if (existingOg) {
        // If new entry already has OG data with an image, keep it (don't override with cached data)
        if (entry.og?.ogImage) {
          return { ...entry, ogLoading: false };
        }
        return { ...entry, og: existingOg, ogLoading: false };
      }
      return entry;
    });

    // Combine new entries with historical entries
    // New entries come first so they take precedence in deduplication when dates are equal
    const allEntries = [...entriesWithExistingOg, ...historicalEntries];

    // Deduplicate entries by URL, keeping the most recent version
    const deduplicatedEntries = deduplicateEntries(allEntries);

    setEntries(deduplicatedEntries);
    setErrors(newErrors);
    setLoading(false);
    
    // Save entries immediately (without waiting for OG data)
    saveEntries(deduplicatedEntries);

    // Start fetching OG data asynchronously for entries that need it
    fetchOgDataForEntries(deduplicatedEntries);
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
        onlyShowMentions={onlyShowMentions}
        onOnlyShowMentionsChange={handleOnlyShowMentionsChange}
      />
      <FeedEntries entries={entries} errors={errors} loading={loading} tagFilters={tagFilters} onlyShowMentions={onlyShowMentions} />
    </div>
  );
}
