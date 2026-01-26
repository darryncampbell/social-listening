'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync, faExclamationTriangle, faFilter, faEye, faEyeSlash, faChevronDown, faRss, faGlobe, faBullhorn } from '@fortawesome/free-solid-svg-icons';
import styles from './StatusPane.module.css';
import PromptModal, { PromptType } from './PromptModal';
import { fetchAndParseFeed, RssEntry } from '@/utils/rssParser';
import { TagFilters, TagType, ContentTagType, StatusTagType, CONTENT_TAG_LABELS, STATUS_TAG_LABELS, toggleFilterState, getFeedFilterState } from '@/utils/tagFilter';
import { getInterest, fetchEnvConfig, getPredefinedFeeds, getPredefinedExternalSources } from '@/utils/interestConfig';
import { getExternalSources, ExternalSource } from '@/utils/externalSourcesConfig';
import { SkoolPost, StackOverflowPost } from '@/app/api/scrape/route';
import { loadEntries } from '@/utils/entryStorage';

const FEEDS_STORAGE_KEY = 'social-listening-feeds';
const SYNC_TIME_STORAGE_KEY = 'social-listening-last-sync';

type SyncType = 'all' | 'rss' | 'external';

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
  entries: RssEntry[];
  onlyShowMentions: boolean;
  onOnlyShowMentionsChange: (enabled: boolean) => void;
}

export default function StatusPane({ onSyncComplete, onSyncStart, tagFilters, onTagFiltersChange, entries, onlyShowMentions, onOnlyShowMentionsChange }: StatusPaneProps) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [externalSources, setExternalSources] = useState<ExternalSource[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastSyncDate, setLastSyncDate] = useState<Date | null>(null);
  const [isSyncStale, setIsSyncStale] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [promptModalType, setPromptModalType] = useState<PromptType | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; currentName: string } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [syncDropdownOpen, setSyncDropdownOpen] = useState(false);
  const [interest, setInterest] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef<HTMLDivElement>(null);

  // Extract unique feed titles from entries
  const uniqueFeedTitles = useMemo(() => {
    const titles = new Set<string>();
    for (const entry of entries) {
      if (entry.feedTitle) {
        titles.add(entry.feedTitle);
      }
    }
    return Array.from(titles).sort();
  }, [entries]);

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
    // Load feeds and external sources (including predefined from env vars)
    fetchEnvConfig().then(() => {
      // Load feeds
      const predefinedFeeds = getPredefinedFeeds();
      const storedFeeds = localStorage.getItem(FEEDS_STORAGE_KEY);
      let customFeeds: Feed[] = [];
      
      if (storedFeeds) {
        try {
          const parsedFeeds = JSON.parse(storedFeeds);
          if (Array.isArray(parsedFeeds)) {
            customFeeds = parsedFeeds;
          }
        } catch {
          // Failed to parse feeds, leave as empty array
        }
      }
      
      // Combine predefined and custom feeds
      setFeeds([...predefinedFeeds, ...customFeeds]);

      // Load external sources (including predefined from env vars)
      const predefinedExternalSources = getPredefinedExternalSources();
      const customExternalSources = getExternalSources();
      
      // Combine predefined and custom external sources
      setExternalSources([...predefinedExternalSources, ...customExternalSources]);
    });

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
      if (syncRef.current && !syncRef.current.contains(event.target as Node)) {
        setSyncDropdownOpen(false);
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

  const handleFeedFilterChange = (feedTitle: string) => {
    const currentState = getFeedFilterState(tagFilters, feedTitle);
    onTagFiltersChange({
      ...tagFilters,
      feeds: {
        ...tagFilters.feeds,
        [feedTitle]: toggleFilterState(currentState),
      },
    });
  };

  // Count hidden filters (excluding feeds object, then add hidden feed count)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    // Count static filters
    for (const [key, value] of Object.entries(tagFilters)) {
      if (key !== 'feeds' && value === 'hidden') {
        count++;
      }
    }
    // Count hidden feeds
    for (const value of Object.values(tagFilters.feeds)) {
      if (value === 'hidden') {
        count++;
      }
    }
    return count;
  }, [tagFilters]);

  // Convert Skool posts to RssEntry format
  const convertSkoolPostToRssEntry = (post: SkoolPost): RssEntry => {
    // Create a description that includes all the scraped metadata
    const metaInfo = [
      post.category ? `[${post.category}]` : '',
      `👍 ${post.likes}`,
      `💬 ${post.comments}`,
      post.lastCommentTime ? `Last comment: ${post.lastCommentTime}` : '',
    ].filter(Boolean).join(' • ');

    const fullDescription = post.description 
      ? `${post.description}\n\n${metaInfo}`
      : metaInfo;

    return {
      id: post.id,
      feedId: `skool-${post.sourceUrl}`,
      feedTitle: post.sourceName,
      rawXml: '',
      link: post.link,
      title: post.title || `Post by ${post.author}`,
      // Use post.date if available; empty string will sort to end (getEntryDate returns 0)
      publishedDate: post.date || '',
      description: fullDescription,
      og: post.authorAvatar ? {
        ogImage: post.authorAvatar,
        ogSiteName: 'Skool',
      } : undefined,
      ogLoading: false, // Prevent OG fetcher from overriding
      rawDetails: {
        author: post.author,
        authorAvatar: post.authorAvatar,
        category: post.category,
        likes: post.likes,
        comments: post.comments,
        lastCommentTime: post.lastCommentTime,
        isPinned: post.isPinned,
        originalDescription: post.description,
      },
    };
  };

  // Convert Stack Overflow posts to RssEntry format
  const convertStackOverflowPostToRssEntry = (post: StackOverflowPost): RssEntry => {
    // Create a description that includes all the scraped metadata
    const tagsList = post.tags.length > 0 ? `Tags: ${post.tags.join(', ')}` : '';
    const metaInfo = [
      `⬆️ ${post.votes} votes`,
      `💬 ${post.answers} answers${post.hasAcceptedAnswer ? ' ✓' : ''}`,
      `👁️ ${post.views} views`,
    ].filter(Boolean).join(' • ');

    const fullDescription = [
      post.description,
      tagsList,
      metaInfo,
    ].filter(Boolean).join('\n\n');

    return {
      id: post.id,
      feedId: `stackoverflow-${post.sourceUrl}`,
      feedTitle: post.sourceName,
      rawXml: '',
      link: post.link,
      title: post.title,
      publishedDate: post.date || '',
      description: fullDescription,
      og: {
        ogImage: '/stackoverflow-logo.svg',
        ogSiteName: 'Stack Overflow',
      },
      ogLoading: false, // Prevent OG fetcher from overriding
      rawDetails: {
        author: post.author,
        authorReputation: post.authorReputation,
        date: post.date,
        tags: post.tags,
        votes: post.votes,
        answers: post.answers,
        views: post.views,
        hasAcceptedAnswer: post.hasAcceptedAnswer,
        originalDescription: post.description,
      },
    };
  };

  const scrapeExternalSource = async (source: ExternalSource): Promise<{ entries: RssEntry[]; error?: string }> => {
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: source.url, sourceName: source.name }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { entries: [], error: data.error || 'Failed to scrape' };
      }

      const data = await response.json();
      
      // Route to appropriate converter based on site type
      if (data.siteType === 'stackoverflow') {
        const entries = (data.posts || []).map(convertStackOverflowPostToRssEntry);
        return { entries };
      } else {
        // Default: Skool
        const entries = (data.posts || []).map(convertSkoolPostToRssEntry);
        return { entries };
      }
    } catch (error) {
      console.error('External source scrape error:', error);
      return { entries: [], error: 'Failed to scrape external source' };
    }
  };

  const handleSync = async (syncType: SyncType = 'all') => {
    const shouldSyncRss = (syncType === 'all' || syncType === 'rss') && feeds.length > 0;
    const shouldSyncExternal = (syncType === 'all' || syncType === 'external') && externalSources.length > 0;

    if (!shouldSyncRss && !shouldSyncExternal) {
      return;
    }

    setSyncing(true);
    setSyncDropdownOpen(false);
    onSyncStart?.();

    // Calculate total items to sync
    const rssCount = shouldSyncRss ? feeds.length : 0;
    const externalCount = shouldSyncExternal ? externalSources.length : 0;
    const totalItems = rssCount + externalCount;
    let currentItem = 0;

    try {
      const rssEntries: RssEntry[] = [];
      const rssErrors: Array<{ feedTitle: string; error: string }> = [];
      const seenUrls = new Set<string>();

      // Sync RSS feeds one by one with progress
      if (shouldSyncRss) {
        for (const feed of feeds) {
          currentItem++;
          setSyncProgress({ current: currentItem, total: totalItems, currentName: feed.title });
          
          const result = await fetchAndParseFeed(feed.id, feed.title, feed.url);
          
          if (result.error) {
            rssErrors.push({ feedTitle: result.feedTitle, error: result.error });
          } else {
            // Deduplicate entries by URL
            for (const entry of result.entries) {
              if (!seenUrls.has(entry.link)) {
                seenUrls.add(entry.link);
                rssEntries.push(entry);
              }
            }
          }
        }
      }

      // Scrape external sources one by one with progress
      const externalEntries: RssEntry[] = [];
      const externalErrors: Array<{ feedTitle: string; error: string }> = [];

      if (shouldSyncExternal) {
        for (const source of externalSources) {
          currentItem++;
          setSyncProgress({ current: currentItem, total: totalItems, currentName: source.name });
          
          const result = await scrapeExternalSource(source);
          
          if (result.error) {
            externalErrors.push({ feedTitle: source.name, error: result.error });
          } else {
            externalEntries.push(...result.entries);
          }
        }
      }

      // For partial syncs, preserve entries from the source type we didn't sync
      let allEntries: RssEntry[];
      
      // Helper to check if an entry is from an external source (scraped, not RSS)
      const isExternalEntry = (e: RssEntry) => 
        e.feedId?.startsWith('skool-') || e.feedId?.startsWith('stackoverflow-');
      
      if (syncType === 'all') {
        // Full sync: replace everything
        allEntries = [...rssEntries, ...externalEntries];
      } else {
        // Partial sync: merge with existing entries from the other source type
        const existingEntries = loadEntries();
        
        if (syncType === 'rss') {
          // Keep existing external entries
          const existingExternalEntries = existingEntries.filter(isExternalEntry);
          allEntries = [...rssEntries, ...existingExternalEntries];
        } else {
          // Keep existing RSS entries (not from external sources)
          const existingRssEntries = existingEntries.filter(e => !isExternalEntry(e));
          allEntries = [...existingRssEntries, ...externalEntries];
        }
      }

      const allErrors = [...rssErrors, ...externalErrors];

      // Update last sync time
      const now = new Date();
      localStorage.setItem(SYNC_TIME_STORAGE_KEY, now.toISOString());
      setLastSyncDate(now);
      setLastSyncTime(now.toLocaleString());

      onSyncComplete?.(allEntries, allErrors);
    } catch (error) {
      console.error('Sync failed:', error);
      onSyncComplete?.([], [{ feedTitle: 'Sync', error: 'Failed to sync feeds' }]);
    } finally {
      setSyncing(false);
      setSyncProgress(null);
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
            <span className={styles.label}>Sources</span>
            <span className={styles.value}>{feeds.length + externalSources.length}</span>
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
          <div className={styles.syncWrapper} ref={syncRef}>
            <button
              className={`${styles.syncButton} ${syncing ? styles.syncing : ''}`}
              onClick={() => handleSync('all')}
              title="Sync All Sources"
              disabled={syncing || (feeds.length === 0 && externalSources.length === 0)}
            >
              <FontAwesomeIcon icon={faSync} spin={syncing} />
            </button>
            <button
              className={`${styles.syncDropdownToggle} ${syncing ? styles.syncing : ''}`}
              onClick={() => setSyncDropdownOpen(!syncDropdownOpen)}
              disabled={syncing || (feeds.length === 0 && externalSources.length === 0)}
              title="Sync Options"
            >
              <FontAwesomeIcon icon={faChevronDown} />
            </button>
            {syncDropdownOpen && (
              <div className={styles.syncDropdown}>
                <button
                  className={styles.syncOption}
                  onClick={() => handleSync('all')}
                  disabled={feeds.length === 0 && externalSources.length === 0}
                >
                  <FontAwesomeIcon icon={faSync} />
                  <span>Sync All</span>
                  <span className={styles.syncOptionCount}>({feeds.length + externalSources.length})</span>
                </button>
                <button
                  className={styles.syncOption}
                  onClick={() => handleSync('rss')}
                  disabled={feeds.length === 0}
                >
                  <FontAwesomeIcon icon={faRss} />
                  <span>Sync RSS Feeds Only</span>
                  <span className={styles.syncOptionCount}>({feeds.length})</span>
                </button>
                <button
                  className={styles.syncOption}
                  onClick={() => handleSync('external')}
                  disabled={externalSources.length === 0}
                >
                  <FontAwesomeIcon icon={faGlobe} />
                  <span>Sync External Sites Only</span>
                  <span className={styles.syncOptionCount}>({externalSources.length})</span>
                </button>
              </div>
            )}
          </div>
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
                {(['comment', 'crossPost', 'deleted', 'github'] as ContentTagType[]).map((tag) => (
                  <button
                    key={tag}
                    className={`${styles.filterOption} ${tagFilters[tag] === 'hidden' ? styles.filterOptionHidden : ''}`}
                    onClick={() => handleTagFilterChange(tag)}
                  >
                    <span className={styles.filterOptionLabel}>
                      {CONTENT_TAG_LABELS[tag]}
                    </span>
                    <span className={`${styles.filterState} ${styles[`filterState_${tagFilters[tag]}`]}`}>
                      <FontAwesomeIcon icon={tagFilters[tag] === 'shown' ? faEye : faEyeSlash} />
                      <span>{tagFilters[tag] === 'shown' ? 'Shown' : 'Hidden'}</span>
                    </span>
                  </button>
                ))}
                {uniqueFeedTitles.length > 0 && (
                  <>
                    <div className={styles.filterHeader}>Filter by Feed</div>
                    {uniqueFeedTitles.map((feedTitle) => {
                      const feedState = getFeedFilterState(tagFilters, feedTitle);
                      return (
                        <button
                          key={feedTitle}
                          className={`${styles.filterOption} ${feedState === 'hidden' ? styles.filterOptionHidden : ''}`}
                          onClick={() => handleFeedFilterChange(feedTitle)}
                        >
                          <span className={styles.filterOptionLabel}>
                            {feedTitle}
                          </span>
                          <span className={`${styles.filterState} ${styles[`filterState_${feedState}`]}`}>
                            <FontAwesomeIcon icon={feedState === 'shown' ? faEye : faEyeSlash} />
                            <span>{feedState === 'shown' ? 'Shown' : 'Hidden'}</span>
                          </span>
                        </button>
                      );
                    })}
                  </>
                )}
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
            className={`${styles.onlyShowMentionsButton} ${onlyShowMentions ? styles.onlyShowMentionsButtonActive : ''}`}
            onClick={() => onOnlyShowMentionsChange(!onlyShowMentions)}
            title={`${onlyShowMentions ? 'Show all entries' : `Only show entries mentioning ${interest}`}`}
          >
            <FontAwesomeIcon icon={faBullhorn} />
            <span>Only show {interest}</span>
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
      {syncProgress && (
        <div className={styles.syncProgressPane}>
          <div className={styles.syncProgressHeader}>
            <FontAwesomeIcon icon={faSync} spin className={styles.syncProgressIcon} />
            <span>Syncing sources...</span>
          </div>
          <div className={styles.syncProgressDetails}>
            <span className={styles.syncProgressName}>{syncProgress.currentName}</span>
            <span className={styles.syncProgressCount}>
              {syncProgress.current} of {syncProgress.total}
            </span>
          </div>
          <div className={styles.syncProgressBarLarge}>
            <div 
              className={styles.syncProgressFillLarge} 
              style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
      {promptModalType && (
        <PromptModal
          type={promptModalType}
          onClose={() => setPromptModalType(null)}
        />
      )}
    </>
  );
}
