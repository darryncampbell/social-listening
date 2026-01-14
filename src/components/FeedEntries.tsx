'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faBan, faUndo, faExternalLinkAlt, faChevronDown, faChevronUp, faSpinner, faWandMagicSparkles, faRedo, faLink, faComment, faCodeBranch, faTrash, faBullhorn, faExclamationTriangle, faCrown } from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { RssEntry } from '@/utils/rssParser';
import {
  getEntryStatus,
  markAsProcessed,
  markAsIgnored,
  restoreEntry,
  EntryStatus,
} from '@/utils/entryState';
import { getAiResponse, saveAiResponse } from '@/utils/aiResponseStorage';
import { getPrompt, getCommentPrompt } from '@/utils/promptConfig';
import { getInterest, getRecognizedUsers, findRecognizedUser, RecognizedUser, getPredefinedRecognizedUsers, fetchEnvConfig } from '@/utils/interestConfig';
import {
  getCachedAuthor,
  setCachedAuthor,
  isRedditUrl,
  getUncachedUrls,
} from '@/utils/redditAuthorCache';
import styles from './FeedEntries.module.css';

/**
 * Format a date string to a user-friendly format like "9th January 2026 15:50"
 */
/**
 * Check if an entry links to Reddit or Hacker News and is older than 72 hours.
 * These entries may have stale data since the original content could have been updated.
 */
function isRedditOrHNEntryOlderThan72Hours(entry: RssEntry): boolean {
  // Check if the entry URL points to Reddit or Hacker News
  const url = entry.link?.toLowerCase() || '';
  const isRedditOrHN = url.includes('reddit.com') || url.includes('news.ycombinator');
  if (!isRedditOrHN) return false;
  
  // Check if it's older than 72 hours
  const dateString = entry.publishedDate;
  if (!dateString) return false;
  
  const entryDate = new Date(dateString);
  if (isNaN(entryDate.getTime())) return false;
  
  const now = new Date();
  const hoursOld = (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60);
  return hoursOld > 72;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  const day = date.getDate();
  const suffix = getDaySuffix(day);
  const month = date.toLocaleString('en-GB', { month: 'long' });
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}${suffix} ${month} ${year} ${hours}:${minutes}`;
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Detect if an entry is a Reddit comment based on URL pattern
 * Reddit comment URLs contain 'reddit.com' and '/c/'
 */
function isRedditComment(url: string): boolean {
  if (!url) return false;
  return url.includes('reddit.com') && url.includes('/c/');
}

/**
 * Extract the parent article ID from a Reddit URL
 * Example: https://www.reddit.com/r/voiceagents/comments/1q8xhqn/c/nz2dqt2
 * Returns: "1q8xhqn"
 */
function getRedditArticleId(url: string): string | null {
  if (!url) return null;
  // Match /comments/ARTICLE_ID/ pattern
  const match = url.match(/\/comments\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Get the base article URL from a Reddit URL (removing comment part)
 * Example: https://www.reddit.com/r/voiceagents/comments/1q8xhqn/c/nz2dqt2
 * Returns: https://www.reddit.com/r/voiceagents/comments/1q8xhqn/
 */
function getRedditArticleUrl(url: string): string | null {
  if (!url) return null;
  // Match everything up to and including /comments/ARTICLE_ID/
  const match = url.match(/(.*\/comments\/[a-zA-Z0-9]+\/)/);
  return match ? match[1] : null;
}

import { TagFilters, getFeedFilterState } from '@/utils/tagFilter';

interface FeedEntriesProps {
  entries: RssEntry[];
  errors: Array<{ feedTitle: string; error: string }>;
  loading: boolean;
  tagFilters: TagFilters;
}

interface CategorizedEntries {
  toProcess: EntryWithThread[];
  processed: EntryWithThread[];
  ignored: EntryWithThread[];
}

/**
 * Sort entries by published date, newest first
 */
// Patterns in descriptions that indicate F5 Bot entries which should never be considered as cross-posts
const CROSS_POST_EXCEPTION_PATTERNS = [
  'keyword was found in',
  'keyword was found in submission title',
  'keyword was found in comment',
];

/**
 * Check if a description should be excluded from cross-post detection
 */
function isCrossPostException(description: string): boolean {
  const lowerDesc = description.toLowerCase();
  return CROSS_POST_EXCEPTION_PATTERNS.some(pattern => lowerDesc.includes(pattern));
}

/**
 * Detect cross-posted entries (same description, different URLs)
 * Returns a Set of descriptions that appear more than once with different URLs
 */
function findCrossPostDescriptions(entries: RssEntry[]): Set<string> {
  const descriptionToUrls = new Map<string, Set<string>>();
  
  for (const entry of entries) {
    const description = (entry.og?.ogDescription || entry.description || '').trim().toLowerCase();
    if (!description) continue;
    
    // Skip descriptions that match F5 Bot patterns (these aren't true cross-posts)
    if (isCrossPostException(description)) continue;
    
    if (!descriptionToUrls.has(description)) {
      descriptionToUrls.set(description, new Set());
    }
    if (entry.link) {
      descriptionToUrls.get(description)!.add(entry.link);
    }
  }
  
  // Return descriptions that have multiple different URLs
  const crossPostDescriptions = new Set<string>();
  for (const [description, urls] of descriptionToUrls) {
    if (urls.size > 1) {
      crossPostDescriptions.add(description);
    }
  }
  
  return crossPostDescriptions;
}

function getEntryDate(entry: RssEntry): number {
  // Use lastCommentTime if available (for scraped content like Skool), otherwise use publishedDate
  const lastCommentTime = entry.rawDetails?.lastCommentTime as string | undefined;
  const dateString = lastCommentTime || entry.publishedDate;
  const date = dateString ? new Date(dateString).getTime() : 0;
  return !isNaN(date) ? date : 0;
}

function getEntryDescription(entry: RssEntry): string {
  return (entry.og?.ogDescription || entry.description || '').trim().toLowerCase();
}

/**
 * Sort entries by date descending.
 * Cross-post detection is still done for visual indicators, but entries are not grouped.
 */
function sortByDate(entries: RssEntry[]): RssEntry[] {
  return [...entries].sort((a, b) => getEntryDate(b) - getEntryDate(a));
}

/**
 * Group Reddit comments under their parent articles.
 * - If the parent article exists in the list, comments appear right after it
 * - If the parent article doesn't exist, a dummy placeholder entry is created
 * Returns entries with an additional isCommentThread property for indentation
 */
interface EntryWithThread extends RssEntry {
  isCommentThread?: boolean;
  isDummyParent?: boolean;
}

function groupCommentsUnderArticles(entries: RssEntry[], listName: string): EntryWithThread[] {
  // Build maps for Reddit article/comment grouping
  const articleIdToEntry = new Map<string, RssEntry>();
  const commentsByArticleId = new Map<string, RssEntry[]>();
  const nonCommentEntries: RssEntry[] = [];
  
  // First pass: categorize entries and separate comments from main entries
  for (const entry of entries) {
    const articleId = getRedditArticleId(entry.link);
    
    if (!articleId) {
      // Not a Reddit URL - add to main entries list
      nonCommentEntries.push(entry);
      continue;
    }
    
    if (isRedditComment(entry.link)) {
      // This is a comment - store separately, don't add to main list
      if (!commentsByArticleId.has(articleId)) {
        commentsByArticleId.set(articleId, []);
      }
      commentsByArticleId.get(articleId)!.push(entry);
    } else {
      // This is an article - add to main entries list
      nonCommentEntries.push(entry);
      articleIdToEntry.set(articleId, entry);
    }
  }
  
  // Sort comments within each group by date descending
  for (const comments of commentsByArticleId.values()) {
    comments.sort((a, b) => getEntryDate(b) - getEntryDate(a));
  }
  
  // Sort main entries (non-comments) by date descending
  nonCommentEntries.sort((a, b) => getEntryDate(b) - getEntryDate(a));
  
  // Build result: iterate through non-comment entries only
  // Comments are attached to their parent articles without affecting sort order
  const result: EntryWithThread[] = [];
  const processedArticleIds = new Set<string>();
  
  // Process non-comment entries in sorted order
  for (const entry of nonCommentEntries) {
    const articleId = getRedditArticleId(entry.link);
    
    if (!articleId) {
      // Non-Reddit entry - add in sorted position
      result.push(entry);
      continue;
    }
    
    // This is a Reddit article - add it and its comments
    result.push(entry);
    processedArticleIds.add(articleId);
    
    // Add any comments for this article right after it
    const comments = commentsByArticleId.get(articleId);
    if (comments) {
      for (const comment of comments) {
        result.push({ ...comment, isCommentThread: true });
      }
    }
  }
  
  // Handle orphan comments (parent article not in list)
  // These are comments whose parent article wasn't in this category
  // Add them at the end with a dummy parent, sorted by the newest comment's date
  const orphanArticleIds = new Set<string>();
  for (const [articleId] of commentsByArticleId) {
    if (!processedArticleIds.has(articleId)) {
      orphanArticleIds.add(articleId);
    }
  }
  
  // Sort orphan groups by the date of their newest comment
  const orphanGroups = Array.from(orphanArticleIds).map(articleId => ({
    articleId,
    comments: commentsByArticleId.get(articleId)!,
    newestDate: getEntryDate(commentsByArticleId.get(articleId)![0]) // Already sorted
  })).sort((a, b) => b.newestDate - a.newestDate);
  
  // Insert orphan groups into the result at appropriate positions based on their newest comment's date
  // Merge orphan groups with the result while maintaining date order
  if (orphanGroups.length > 0) {
    const finalResult: EntryWithThread[] = [];
    let resultIndex = 0;
    let orphanIndex = 0;
    
    while (resultIndex < result.length || orphanIndex < orphanGroups.length) {
      // Get the date of the next result entry (use its actual date, not thread date)
      const nextResultDate = resultIndex < result.length ? getEntryDate(result[resultIndex]) : -Infinity;
      // Get the date of the next orphan group (use newest comment's date)
      const nextOrphanDate = orphanIndex < orphanGroups.length ? orphanGroups[orphanIndex].newestDate : -Infinity;
      
      if (nextOrphanDate > nextResultDate && orphanIndex < orphanGroups.length) {
        // Insert orphan group here
        const { articleId, comments } = orphanGroups[orphanIndex];
        const firstComment = comments[0];
        const articleUrl = getRedditArticleUrl(firstComment.link);
        const dummyParent: EntryWithThread = {
          id: `dummy-article-${articleId}`,
          title: `Reddit Thread (${comments.length} comment${comments.length > 1 ? 's' : ''})`,
          description: `Parent article not in '${listName}' list - click to view the original thread`,
          link: articleUrl || firstComment.link.replace(/\/c\/.*$/, '/'),
          publishedDate: firstComment.publishedDate,
          feedTitle: firstComment.feedTitle,
          feedId: firstComment.feedId,
          rawXml: '',
          isDummyParent: true,
        };
        
        finalResult.push(dummyParent);
        for (const comment of comments) {
          finalResult.push({ ...comment, isCommentThread: true });
        }
        orphanIndex++;
      } else if (resultIndex < result.length) {
        // Add next result entry
        finalResult.push(result[resultIndex]);
        resultIndex++;
      } else {
        break;
      }
    }
    
    return finalResult;
  }
  
  return result;
}

/**
 * Sort entries with cross-post grouping AND comment threading
 */
function sortWithGrouping(entries: RssEntry[], crossPostDescriptions: Set<string>, listName: string): EntryWithThread[] {
  // Sort entries by date (cross-post grouping removed - was causing ordering issues)
  const sortedEntries = sortByDate(entries);
  
  // Then apply comment threading
  return groupCommentsUnderArticles(sortedEntries, listName);
}

function categorizeEntriesFromSource(entries: RssEntry[], crossPostDescriptions: Set<string>): CategorizedEntries {
  const toProcess: RssEntry[] = [];
  const processed: RssEntry[] = [];
  const ignored: RssEntry[] = [];

  for (const entry of entries) {
    const status = getEntryStatus(entry.id);
    switch (status) {
      case 'processed':
        processed.push(entry);
        break;
      case 'ignored':
        ignored.push(entry);
        break;
      default:
        toProcess.push(entry);
    }
  }

  // Sort each category by date, grouping cross-posts and comments together
  return {
    toProcess: sortWithGrouping(toProcess, crossPostDescriptions, 'To Process'),
    processed: sortWithGrouping(processed, crossPostDescriptions, 'Done'),
    ignored: sortWithGrouping(ignored, crossPostDescriptions, 'Ignored'),
  };
}

export default function FeedEntries({ entries, errors, loading, tagFilters }: FeedEntriesProps) {
  const [categorized, setCategorized] = useState<CategorizedEntries>({
    toProcess: [],
    processed: [],
    ignored: [],
  });
  const [interest, setInterest] = useState('Darryn Campbell');
  // Track which cross-post description is currently highlighted (null = none)
  const [highlightedCrossPost, setHighlightedCrossPost] = useState<string | null>(null);
  // Store Reddit authors keyed by URL
  const [redditAuthors, setRedditAuthors] = useState<Map<string, string>>(new Map());
  // Store recognized users list
  const [recognizedUsers, setRecognizedUsers] = useState<RecognizedUser[]>([]);

  // Load interest configuration on mount
  useEffect(() => {
    fetchEnvConfig().then(() => {
      setInterest(getInterest());
      // Combine predefined and custom recognized users
      const predefinedUsers = getPredefinedRecognizedUsers();
      const customUsers = getRecognizedUsers();
      setRecognizedUsers([...predefinedUsers, ...customUsers]);
    });
  }, []);

  // Fetch Reddit authors asynchronously after entries are loaded
  useEffect(() => {
    if (loading || entries.length === 0) return;

    // Find all Reddit URLs (posts and comments) that need author lookup
    const redditPostUrls = entries
      .filter(entry => entry.link && isRedditUrl(entry.link))
      .map(entry => entry.link!);

    if (redditPostUrls.length === 0) return;

    // Load cached authors first
    const cachedAuthors = new Map<string, string>();
    for (const url of redditPostUrls) {
      const cached = getCachedAuthor(url);
      if (cached) {
        cachedAuthors.set(url, cached);
      }
    }
    
    // Update state with cached authors
    if (cachedAuthors.size > 0) {
      setRedditAuthors(prev => new Map([...prev, ...cachedAuthors]));
    }

    // Find URLs that need to be fetched
    const uncachedUrls = getUncachedUrls(redditPostUrls);
    if (uncachedUrls.length === 0) return;

    // Fetch uncached authors with rate limiting (one at a time with delay)
    let cancelled = false;
    
    const fetchAuthors = async () => {
      for (const url of uncachedUrls) {
        if (cancelled) break;
        
        try {
          const response = await fetch(`/api/reddit-author?url=${encodeURIComponent(url)}`);
          
          if (response.status === 429) {
            // Rate limited - stop fetching for now
            console.log('Reddit API rate limited, pausing author fetches');
            break;
          }
          
          if (response.ok) {
            const data = await response.json();
            if (data.author) {
              // Cache the result
              setCachedAuthor(url, data.author);
              // Update state
              setRedditAuthors(prev => new Map([...prev, [url, data.author]]));
            }
          }
          
          // Small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('Error fetching Reddit author for', url, error);
        }
      }
    };

    fetchAuthors();

    return () => {
      cancelled = true;
    };
  }, [entries, loading]);

  // Toggle cross-post highlight
  const toggleCrossPostHighlight = useCallback((description: string) => {
    setHighlightedCrossPost(prev => prev === description ? null : description);
  }, []);

  // Compute cross-post descriptions across all entries
  const crossPostDescriptions = useMemo(() => findCrossPostDescriptions(entries), [entries]);

  // Apply tag filters to entries
  const filteredEntries = useMemo(() => {
    // Check if any static filters are hidden
    const hasStaticFilter = Object.entries(tagFilters)
      .filter(([key]) => key !== 'feeds')
      .some(([, value]) => value === 'hidden');
    
    // Check if any feed filters are hidden
    const hasFeedFilter = Object.values(tagFilters.feeds).some(v => v === 'hidden');
    
    // If no filters are set to hidden, return all entries
    if (!hasStaticFilter && !hasFeedFilter) return entries;

    const interestLower = interest.toLowerCase();
    
    return entries.filter(entry => {
      const displayTitle = entry.og?.ogTitle || entry.title || '';
      const displayDescription = entry.og?.ogDescription || entry.description || '';
      
      // Compute content tag values for this entry
      const isComment = isRedditComment(entry.link);
      const isCrossPost = crossPostDescriptions.has(displayDescription.trim().toLowerCase());
      const isDeleted = displayDescription.toLowerCase().includes('[removed]');
      const mentionsInterest = 
        displayTitle.toLowerCase().includes(interestLower) || 
        displayDescription.toLowerCase().includes(interestLower);
      const isGitHub = entry.link?.includes('github.com/livekit') ?? false;
      
      // Compute status tag values for this entry
      const status = getEntryStatus(entry.id);
      const isToProcess = status === 'to_process';
      const isDone = status === 'processed';
      const isIgnored = status === 'ignored';
      
      // Apply content tag filters - hide entries that have a hidden tag
      if (tagFilters.comment === 'hidden' && isComment) return false;
      if (tagFilters.crossPost === 'hidden' && isCrossPost) return false;
      if (tagFilters.deleted === 'hidden' && isDeleted) return false;
      if (tagFilters.mentionsInterest === 'hidden' && mentionsInterest) return false;
      if (tagFilters.github === 'hidden' && isGitHub) return false;
      
      // Apply status tag filters - hide entries with a hidden status
      if (tagFilters.statusToProcess === 'hidden' && isToProcess) return false;
      if (tagFilters.statusDone === 'hidden' && isDone) return false;
      if (tagFilters.statusIgnored === 'hidden' && isIgnored) return false;
      
      // Apply feed filters - hide entries from hidden feeds
      if (entry.feedTitle && getFeedFilterState(tagFilters, entry.feedTitle) === 'hidden') {
        return false;
      }
      
      return true;
    });
  }, [entries, tagFilters, interest, crossPostDescriptions]);

  const recategorize = useCallback(() => {
    setCategorized(categorizeEntriesFromSource(filteredEntries, crossPostDescriptions));
  }, [filteredEntries, crossPostDescriptions]);

  useEffect(() => {
    recategorize();
  }, [recategorize]);

  const handleAction = (entryId: string, action: 'process' | 'ignore' | 'restore') => {
    switch (action) {
      case 'process':
        markAsProcessed(entryId);
        break;
      case 'ignore':
        markAsIgnored(entryId);
        break;
      case 'restore':
        restoreEntry(entryId);
        break;
    }
    // Immediately recategorize after state change
    setCategorized(categorizeEntriesFromSource(filteredEntries, crossPostDescriptions));
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Syncing feeds...</div>
      </div>
    );
  }

  if (entries.length === 0 && errors.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      {errors.length > 0 && (
        <div className={styles.errors}>
          <h3 className={styles.errorsTitle}>Sync Errors</h3>
          {errors.map((err, index) => (
            <div key={index} className={styles.error}>
              <span className={styles.errorFeed}>{err.feedTitle}:</span> {err.error}
            </div>
          ))}
        </div>
      )}

      <EntryTable
        id="to-process"
        title="To Process"
        entries={categorized.toProcess}
        status="to_process"
        onAction={handleAction}
        crossPostDescriptions={crossPostDescriptions}
        interest={interest}
        highlightedCrossPost={highlightedCrossPost}
        onCrossPostClick={toggleCrossPostHighlight}
        redditAuthors={redditAuthors}
        recognizedUsers={recognizedUsers}
      />

      <EntryTable
        id="done"
        title="Done"
        entries={categorized.processed}
        status="processed"
        onAction={handleAction}
        crossPostDescriptions={crossPostDescriptions}
        interest={interest}
        highlightedCrossPost={highlightedCrossPost}
        onCrossPostClick={toggleCrossPostHighlight}
        redditAuthors={redditAuthors}
        recognizedUsers={recognizedUsers}
      />

      <EntryTable
        id="ignored"
        title="Ignored"
        entries={categorized.ignored}
        status="ignored"
        onAction={handleAction}
        crossPostDescriptions={crossPostDescriptions}
        interest={interest}
        highlightedCrossPost={highlightedCrossPost}
        onCrossPostClick={toggleCrossPostHighlight}
        redditAuthors={redditAuthors}
        recognizedUsers={recognizedUsers}
      />
    </div>
  );
}

interface EntryTableProps {
  id: string;
  title: string;
  entries: EntryWithThread[];
  status: EntryStatus;
  onAction: (entryId: string, action: 'process' | 'ignore' | 'restore') => void;
  crossPostDescriptions: Set<string>;
  interest: string;
  highlightedCrossPost: string | null;
  onCrossPostClick: (description: string) => void;
  redditAuthors: Map<string, string>;
  recognizedUsers: RecognizedUser[];
}

function EntryTable({ id, title, entries, status, onAction, crossPostDescriptions, interest, highlightedCrossPost, onCrossPostClick, redditAuthors, recognizedUsers }: EntryTableProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div id={id} className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {title} ({entries.length})
      </h3>
      <div className={styles.entries}>
        {entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            status={status}
            onAction={onAction}
            crossPostDescriptions={crossPostDescriptions}
            interest={interest}
            isIndented={entry.isCommentThread}
            isDummyParent={entry.isDummyParent}
            highlightedCrossPost={highlightedCrossPost}
            onCrossPostClick={onCrossPostClick}
            redditAuthor={entry.link ? redditAuthors.get(entry.link) : undefined}
            recognizedUsers={recognizedUsers}
          />
        ))}
      </div>
    </div>
  );
}

interface EntryRowProps {
  entry: EntryWithThread;
  status: EntryStatus;
  onAction: (entryId: string, action: 'process' | 'ignore' | 'restore') => void;
  crossPostDescriptions: Set<string>;
  interest: string;
  isIndented?: boolean;
  isDummyParent?: boolean;
  highlightedCrossPost: string | null;
  onCrossPostClick: (description: string) => void;
  redditAuthor?: string;
  recognizedUsers: RecognizedUser[];
}

// Find a recognized user by username (tolerant of u/ prefix)
// Returns the RecognizedUser object if found, or null otherwise
function findUserRecognized(username: string, recognizedUsers: RecognizedUser[]): RecognizedUser | null {
  if (!username) return null;
  const normalizedUsername = username.toLowerCase().replace(/^u\//, '');
  return recognizedUsers.find(user => {
    const normalizedRecognized = user.username.toLowerCase().replace(/^u\//, '');
    return normalizedUsername === normalizedRecognized;
  }) || null;
}

// Check if a username matches any recognized user (tolerant of u/ prefix)
function isUserRecognized(username: string, recognizedUsers: RecognizedUser[]): boolean {
  return findUserRecognized(username, recognizedUsers) !== null;
}

function EntryRow({ entry, status, onAction, crossPostDescriptions, interest, isIndented, isDummyParent, highlightedCrossPost, onCrossPostClick, redditAuthor, recognizedUsers }: EntryRowProps) {
  const [showRawDetails, setShowRawDetails] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load AI response on mount
  useEffect(() => {
    const stored = getAiResponse(entry.id);
    setAiResponse(stored);
  }, [entry.id]);

  const handleCopyAiResponse = async () => {
    if (!aiResponse) return;
    
    try {
      await navigator.clipboard.writeText(aiResponse);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleIgnore = () => {
    onAction(entry.id, 'ignore');
  };

  const handleDone = () => {
    onAction(entry.id, 'process');
  };

  const handleRestore = () => {
    onAction(entry.id, 'restore');
  };

  // Determine if this is a comment or article
  const isComment = isRedditComment(entry.link);

  // Build prompt preview for hover tooltip
  const promptPreview = useMemo(() => {
    const basePrompt = isComment ? getCommentPrompt() : getPrompt();
    const displayTitle = entry.og?.ogTitle || entry.title || 'Untitled';
    const displayDescription = entry.og?.ogDescription || entry.description || '';
    
    // Replace placeholders with actual values
    return basePrompt
      .replace(/\$\{url\}/g, entry.link || '')
      .replace(/\$\{title\}/g, displayTitle)
      .replace(/\$\{description\}/g, displayDescription);
  }, [isComment, entry.link, entry.og?.ogTitle, entry.og?.ogDescription, entry.title, entry.description]);

  const handleGenerateAiReply = async () => {
    setGenerating(true);
    setAiError(null);
    setAiResponse(''); // Clear previous response and start fresh
    
    try {
      // Use appropriate prompt based on whether this is a comment or article
      const prompt = isComment ? getCommentPrompt() : getPrompt();
      const displayTitle = entry.og?.ogTitle || entry.title || 'Untitled';
      const displayDescription = entry.og?.ogDescription || entry.description || '';
      
      const response = await fetch('/api/generate-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          url: entry.link,
          prompt: prompt,
          title: displayTitle,
          description: displayDescription,
        }),
      });
      
      // Check if it's a streaming response
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('text/event-stream')) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        
        if (!reader) {
          throw new Error('No response body');
        }
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.error) {
                  throw new Error(data.error);
                }
                
                if (data.content) {
                  fullResponse += data.content;
                  setAiResponse(fullResponse);
                }
                
                if (data.done) {
                  // Save the complete response
                  saveAiResponse(entry.id, fullResponse);
                }
              } catch (parseErr) {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
        }
        
        // Ensure we save even if done signal wasn't received
        if (fullResponse) {
          saveAiResponse(entry.id, fullResponse);
        }
      } else {
        // Handle non-streaming (error) response
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate AI reply');
        }
        
        saveAiResponse(entry.id, data.reply);
        setAiResponse(data.reply);
      }
    } catch (err: any) {
      console.error('Error generating AI reply:', err);
      setAiError(err.message || 'Failed to generate AI reply');
    } finally {
      setGenerating(false);
    }
  };

  // Use OG data if available, fallback to RSS data
  const displayTitle = entry.og?.ogTitle || entry.title || 'Untitled';
  const displayDescription = entry.og?.ogDescription || entry.description;
  const displayImage = entry.og?.ogImage;
  const isLoadingOg = entry.ogLoading && !entry.og;
  const hasAiResponse = !!aiResponse;

  // Determine labels
  const isCrossPost = crossPostDescriptions.has((displayDescription || '').trim().toLowerCase());
  const isDeleted = (displayDescription || '').toLowerCase().includes('[removed]');
  const interestLower = interest.toLowerCase();
  const mentionsInterest = 
    displayTitle.toLowerCase().includes(interestLower) || 
    (displayDescription || '').toLowerCase().includes(interestLower);
  const isGitHub = entry.link?.includes('github.com/livekit') ?? false;

  // Build class names for the entry
  const entryClassNames = [styles.entry];
  if (isIndented) entryClassNames.push(styles.entryIndented);
  if (isDummyParent) entryClassNames.push(styles.entryDummyParent);
  
  // Check if this entry should be highlighted as a cross-post
  const entryDescription = (displayDescription || '').trim().toLowerCase();
  const isHighlightedCrossPost = highlightedCrossPost !== null && entryDescription === highlightedCrossPost;
  if (isHighlightedCrossPost) entryClassNames.push(styles.entryCrossPostHighlight);

  return (
    <div className={entryClassNames.join(' ')}>
      <div className={styles.entryHeader}>
        <div className={styles.entryHeaderLeft}>
          <span className={styles.entryFeed}>
            {entry.feedTitle}
            {isLoadingOg && (
              <FontAwesomeIcon icon={faSpinner} spin className={styles.ogLoadingIcon} />
            )}
          </span>
          {(isComment || isCrossPost || isDeleted || mentionsInterest || isGitHub) && (
            <div className={styles.entryLabels}>
              {mentionsInterest && (
                <span className={`${styles.label} ${styles.labelMentionsInterest}`}>
                  <FontAwesomeIcon icon={faBullhorn} />
                  <span>Mentions {interest}</span>
                </span>
              )}
              {isGitHub && (
                <span className={`${styles.label} ${styles.labelGitHub}`}>
                  <FontAwesomeIcon icon={faGithub} />
                  <span>GitHub</span>
                </span>
              )}
              {isComment && (
                <span className={`${styles.label} ${styles.labelComment}`}>
                  <FontAwesomeIcon icon={faComment} />
                  <span>Comment</span>
                </span>
              )}
              {isCrossPost && (
                <button 
                  className={`${styles.label} ${styles.labelCrossPost}`}
                  onClick={() => onCrossPostClick((displayDescription || '').trim().toLowerCase())}
                  title="Click to highlight all cross-posts with the same content"
                >
                  <FontAwesomeIcon icon={faCodeBranch} />
                  <span>Cross Post</span>
                </button>
              )}
              {isDeleted && (
                <span className={`${styles.label} ${styles.labelDeleted}`}>
                  <FontAwesomeIcon icon={faTrash} />
                  <span>Deleted</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className={styles.entryActions}>
          {status === 'to_process' && !isDummyParent && (
            <>
              <button
                className={`${styles.actionBtn} ${styles.ignoreBtn}`}
                onClick={handleIgnore}
              >
                <FontAwesomeIcon icon={faBan} />
                <span>Ignore</span>
              </button>
              <button
                className={`${styles.actionBtn} ${styles.doneBtn}`}
                onClick={handleDone}
              >
                <FontAwesomeIcon icon={faCheck} />
                <span>Done</span>
              </button>
            </>
          )}
          {(status === 'processed' || status === 'ignored') && !isDummyParent && (
            <button
              className={`${styles.actionBtn} ${styles.restoreBtn}`}
              onClick={handleRestore}
            >
              <FontAwesomeIcon icon={faUndo} />
              <span>Restore</span>
            </button>
          )}
        </div>
      </div>
      
      <div className={styles.entryContent}>
        {displayImage && (
          <div className={`${styles.entryImageWrapper} ${displayImage === '/reddit-logo.svg' ? styles.redditImageWrapper : ''} ${displayImage === '/hackernews-logo.svg' ? styles.hackerNewsImageWrapper : ''}`}>
            <img src={displayImage} alt="" className={`${styles.entryImage} ${displayImage === '/reddit-logo.svg' ? styles.redditImage : ''} ${displayImage === '/hackernews-logo.svg' ? styles.hackerNewsImage : ''}`} />
          </div>
        )}
        <div className={styles.entryText}>
          <div className={styles.entryMeta}>
            {entry.publishedDate && (
              <span className={styles.entryDate}>
                {formatDate(entry.publishedDate)}
                {isRedditOrHNEntryOlderThan72Hours(entry) && (
                  <span className={styles.oldEntryWarning}>
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    <span>&gt;72 hours old</span>
                  </span>
                )}
              </span>
            )}
            {typeof entry.rawDetails?.lastCommentTime === 'string' && entry.rawDetails.lastCommentTime && (
              <span className={styles.entryLastComment}>
                Last activity: {formatDate(entry.rawDetails.lastCommentTime)}
              </span>
            )}
            {redditAuthor && (() => {
              const recognizedUser = findUserRecognized(redditAuthor, recognizedUsers);
              const isRecognized = recognizedUser !== null;
              const realName = recognizedUser?.realName || '';
              
              return (
                <span className={styles.entryAuthor}>
                  by <a 
                    href={`https://www.reddit.com/user/${redditAuthor}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.entryAuthorLink} ${isRecognized ? styles.entryAuthorRecognized : ''}`}
                  >
                    {isRecognized && (
                      <FontAwesomeIcon icon={faCrown} className={styles.crownIconLeft} />
                    )}
                    u/{redditAuthor}
                    {realName && <span className={styles.authorRealName}> ({realName})</span>}
                    {isRecognized && (
                      <FontAwesomeIcon icon={faCrown} className={styles.crownIconRight} />
                    )}
                  </a>
                </span>
              );
            })()}
            {entry.og?.ogSiteName && (
              <span className={styles.entrySiteName}>{entry.og.ogSiteName}</span>
            )}
          </div>
          
          <h4 className={styles.entryTitle}>
            {displayTitle}
            {entry.link && (
              <a
                href={entry.link}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.entryLink}
                title="Open link"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
              </a>
            )}
          </h4>
          
          {displayDescription && (
            <p className={styles.entryDescription}>{displayDescription}</p>
          )}
          
          {entry.link && (
            <a
              href={entry.link}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.entryUrl}
            >
              {entry.link}
            </a>
          )}
          
          {/* Show parent article link for comments */}
          {isComment && entry.link && getRedditArticleUrl(entry.link) && (
            <a
              href={getRedditArticleUrl(entry.link)!}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.entryParentUrl}
            >
              Parent article: {getRedditArticleUrl(entry.link)}
            </a>
          )}

          {/* AI Generated Response Section - not shown for dummy parent entries */}
          {(status === 'to_process' || hasAiResponse) && !isDummyParent && (
            <div className={styles.aiSection}>
              {aiError && (
                <div className={styles.aiError}>{aiError}</div>
              )}
              {(hasAiResponse || generating) && (
                <div className={styles.aiResponse}>
                  <div className={styles.aiResponseHeader}>
                    <div className={styles.aiResponseLabel}>
                      AI {isComment ? 'Comment' : 'Article'} Response:
                      {generating && <FontAwesomeIcon icon={faSpinner} spin className={styles.streamingIndicator} />}
                    </div>
                    {hasAiResponse && !generating && (
                      <button
                        className={styles.copyBtn}
                        onClick={handleCopyAiResponse}
                        title="Copy to clipboard"
                      >
                        <FontAwesomeIcon icon={copied ? faCheck : faLink} />
                        <span>{copied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                  <div className={styles.aiResponseText}>
                    {aiResponse || (generating ? 'Thinking...' : '')}
                  </div>
                </div>
              )}
              {status === 'to_process' && (
                <div className={styles.generateAiBtnWrapper}>
                  <button
                    className={styles.generateAiBtn}
                    onClick={handleGenerateAiReply}
                    disabled={generating}
                  >
                    {generating ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin />
                        <span>Generating...</span>
                      </>
                    ) : hasAiResponse ? (
                      <>
                        <FontAwesomeIcon icon={faRedo} />
                        <span>Regenerate {isComment ? 'Comment' : 'Article'} Response</span>
                      </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faWandMagicSparkles} />
                      <span>Generate {isComment ? 'Comment' : 'Article'} Response</span>
                    </>
                  )}
                  </button>
                  <div className={styles.promptTooltip}>{promptPreview}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.entryFooter}>
        <button
          className={styles.toggleXmlBtn}
          onClick={() => setShowRawDetails(!showRawDetails)}
        >
          <FontAwesomeIcon icon={showRawDetails ? faChevronUp : faChevronDown} />
          <span>{showRawDetails ? 'Hide' : 'Show'} Raw Details</span>
        </button>
      </div>

      {showRawDetails && (
        <pre className={styles.entryXml}>{
          entry.rawDetails 
            ? JSON.stringify(entry.rawDetails, null, 2)
            : entry.rawXml || JSON.stringify(entry, null, 2)
        }</pre>
      )}
    </div>
  );
}
