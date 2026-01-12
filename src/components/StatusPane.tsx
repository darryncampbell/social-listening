'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync, faExclamationTriangle, faFilter, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import styles from './StatusPane.module.css';
import PromptModal, { PromptType } from './PromptModal';
import { syncAllFeeds, RssEntry } from '@/utils/rssParser';
import { TagFilters, TagType, ContentTagType, StatusTagType, CONTENT_TAG_LABELS, STATUS_TAG_LABELS, toggleFilterState } from '@/utils/tagFilter';
import { getInterest } from '@/utils/interestConfig';

const FEEDS_STORAGE_KEY = 'social-listening-feeds';
const SYNC_TIME_STORAGE_KEY = 'social-listening-last-sync';

interface Feed {
  id: string;
  title: string;
  url: string;
}

interface StatusPaneProps {
  onSyncComplete?: (entries: RssEntry[], errors: Array<{ feedTitle: string; error: string }>) => void;
  onSyncStart?: () => void;
  tagFilters: TagFilters;
  onTagFiltersChange: (filters: TagFilters) => void;
}

export default function StatusPane({ onSyncComplete, onSyncStart, tagFilters, onTagFiltersChange }: StatusPaneProps) {
  const [feedCount, setFeedCount] = useState<number>(0);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastSyncDate, setLastSyncDate] = useState<Date | null>(null);
  const [isSyncStale, setIsSyncStale] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [promptModalType, setPromptModalType] = useState<PromptType | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [interest, setInterest] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);

  // Check if sync is stale (more than 12 hours ago)
  const checkSyncStale = useCallback(() => {
    if (!lastSyncDate) {
      setIsSyncStale(false);
      return;
    }
    const now = new Date();
    const diffMs = now.getTime() - lastSyncDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    setIsSyncStale(diffHours > 12);
  }, [lastSyncDate]);

  useEffect(() => {
    // Load feeds
    const storedFeeds = localStorage.getItem(FEEDS_STORAGE_KEY);
    if (storedFeeds) {
      try {
        const parsedFeeds = JSON.parse(storedFeeds);
        if (Array.isArray(parsedFeeds)) {
          setFeeds(parsedFeeds);
          setFeedCount(parsedFeeds.length);
        }
      } catch {
        setFeedCount(0);
      }
    }

    // Load last sync time
    const storedSyncTime = localStorage.getItem(SYNC_TIME_STORAGE_KEY);
    if (storedSyncTime) {
      try {
        const syncDate = new Date(storedSyncTime);
        setLastSyncDate(syncDate);
        setLastSyncTime(syncDate.toLocaleString());
      } catch {
        setLastSyncDate(null);
        setLastSyncTime(null);
      }
    }

    setMounted(true);
  }, []);

  // Check stale status on mount and when lastSyncDate changes
  useEffect(() => {
    checkSyncStale();
  }, [checkSyncStale]);

  // Load interest name for display
  useEffect(() => {
    setInterest(getInterest());
  }, []);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTagFilterChange = (tag: TagType) => {
    onTagFiltersChange({
      ...tagFilters,
      [tag]: toggleFilterState(tagFilters[tag]),
    });
  };

  const activeFilterCount = Object.values(tagFilters).filter(v => v === 'hidden').length;

  const handleSync = async () => {
    if (feeds.length === 0) {
      return;
    }

    setSyncing(true);
    onSyncStart?.();

    try {
      const { entries, errors } = await syncAllFeeds(feeds);

      // Update last sync time
      const now = new Date();
      localStorage.setItem(SYNC_TIME_STORAGE_KEY, now.toISOString());
      setLastSyncDate(now);
      setLastSyncTime(now.toLocaleString());

      onSyncComplete?.(entries, errors);
    } catch (error) {
      console.error('Sync failed:', error);
      onSyncComplete?.([], [{ feedTitle: 'Sync', error: 'Failed to sync feeds' }]);
    } finally {
      setSyncing(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      <div className={styles.pane}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.label}>Feeds</span>
            <span className={styles.value}>{feedCount}</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.stat}>
            <span className={styles.label}>Last sync</span>
            <span className={styles.value}>
              {lastSyncTime || 'Never'}
              {isSyncStale && (
                <span className={styles.staleWarning}>
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span>&gt;12 hours ago</span>
                </span>
              )}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <div className={styles.filterWrapper} ref={filterRef}>
            <button
              className={`${styles.filterButton} ${activeFilterCount > 0 ? styles.filterActive : ''}`}
              onClick={() => setFilterOpen(!filterOpen)}
              title="Filter by tags"
            >
              <FontAwesomeIcon icon={faFilter} />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className={styles.filterBadge}>{activeFilterCount}</span>
              )}
            </button>
            {filterOpen && (
              <div className={styles.filterDropdown}>
                <div className={styles.filterHeader}>Filter by Content</div>
                {(['comment', 'crossPost', 'deleted', 'mentionsInterest'] as ContentTagType[]).map((tag) => (
                  <button
                    key={tag}
                    className={`${styles.filterOption} ${tagFilters[tag] === 'hidden' ? styles.filterOptionHidden : ''}`}
                    onClick={() => handleTagFilterChange(tag)}
                  >
                    <span className={styles.filterOptionLabel}>
                      {tag === 'mentionsInterest' ? `Mentions ${interest}` : CONTENT_TAG_LABELS[tag]}
                    </span>
                    <span className={`${styles.filterState} ${styles[`filterState_${tagFilters[tag]}`]}`}>
                      <FontAwesomeIcon icon={tagFilters[tag] === 'shown' ? faEye : faEyeSlash} />
                      <span>{tagFilters[tag] === 'shown' ? 'Shown' : 'Hidden'}</span>
                    </span>
                  </button>
                ))}
                <div className={styles.filterHeader}>Filter by Status</div>
                {(['statusToProcess', 'statusDone', 'statusIgnored'] as StatusTagType[]).map((tag) => (
                  <button
                    key={tag}
                    className={`${styles.filterOption} ${tagFilters[tag] === 'hidden' ? styles.filterOptionHidden : ''}`}
                    onClick={() => handleTagFilterChange(tag)}
                  >
                    <span className={styles.filterOptionLabel}>
                      {STATUS_TAG_LABELS[tag]}
                    </span>
                    <span className={`${styles.filterState} ${styles[`filterState_${tagFilters[tag]}`]}`}>
                      <FontAwesomeIcon icon={tagFilters[tag] === 'shown' ? faEye : faEyeSlash} />
                      <span>{tagFilters[tag] === 'shown' ? 'Shown' : 'Hidden'}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className={`${styles.syncButton} ${syncing ? styles.syncing : ''}`}
            onClick={handleSync}
            title="Sync"
            disabled={syncing || feedCount === 0}
          >
            <FontAwesomeIcon icon={faSync} spin={syncing} />
          </button>
          <button
            className={styles.promptButton}
            onClick={() => setPromptModalType('article')}
          >
            Article Response Prompt
          </button>
          <button
            className={styles.promptButton}
            onClick={() => setPromptModalType('comment')}
          >
            Comment Response Prompt
          </button>
        </div>
      </div>
      {promptModalType && (
        <PromptModal
          type={promptModalType}
          onClose={() => setPromptModalType(null)}
        />
      )}
    </>
  );
}
