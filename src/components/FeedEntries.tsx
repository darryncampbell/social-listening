'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faBan, faUndo, faExternalLinkAlt, faChevronDown, faChevronUp, faSpinner, faWandMagicSparkles, faRedo, faLink, faComment, faCodeBranch, faTrash, faBullhorn } from '@fortawesome/free-solid-svg-icons';
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
import { getInterest } from '@/utils/interestConfig';
import styles from './FeedEntries.module.css';

/**
 * Detect if an entry is a Reddit comment based on URL pattern
 * Reddit comment URLs contain 'reddit.com' and '/c/'
 */
function isRedditComment(url: string): boolean {
  if (!url) return false;
  return url.includes('reddit.com') && url.includes('/c/');
}

import { TagFilters } from '@/utils/tagFilter';

interface FeedEntriesProps {
  entries: RssEntry[];
  errors: Array<{ feedTitle: string; error: string }>;
  loading: boolean;
  tagFilters: TagFilters;
}

interface CategorizedEntries {
  toProcess: RssEntry[];
  processed: RssEntry[];
  ignored: RssEntry[];
}

/**
 * Sort entries by published date, newest first
 */
// Descriptions that should never be considered as cross-posts
const CROSS_POST_EXCEPTIONS = new Set([
  'keyword was found in submission title.',
]);

/**
 * Detect cross-posted entries (same description, different URLs)
 * Returns a Set of descriptions that appear more than once with different URLs
 */
function findCrossPostDescriptions(entries: RssEntry[]): Set<string> {
  const descriptionToUrls = new Map<string, Set<string>>();
  
  for (const entry of entries) {
    const description = (entry.og?.ogDescription || entry.description || '').trim().toLowerCase();
    if (!description) continue;
    
    // Skip descriptions that are in the exceptions list
    if (CROSS_POST_EXCEPTIONS.has(description)) continue;
    
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
  const date = entry.publishedDate ? new Date(entry.publishedDate).getTime() : 0;
  return !isNaN(date) ? date : 0;
}

function getEntryDescription(entry: RssEntry): string {
  return (entry.og?.ogDescription || entry.description || '').trim().toLowerCase();
}

/**
 * Sort entries by date descending, but group cross-posted articles together.
 * Cross-post groups are positioned by their newest entry, and all entries
 * in the group appear consecutively, sorted by date descending within the group.
 */
function sortWithCrossPostGrouping(entries: RssEntry[], crossPostDescriptions: Set<string>): RssEntry[] {
  // Separate cross-posted and non-cross-posted entries
  const crossPostGroups = new Map<string, RssEntry[]>();
  const nonCrossPost: RssEntry[] = [];
  
  for (const entry of entries) {
    const description = getEntryDescription(entry);
    if (description && crossPostDescriptions.has(description)) {
      if (!crossPostGroups.has(description)) {
        crossPostGroups.set(description, []);
      }
      crossPostGroups.get(description)!.push(entry);
    } else {
      nonCrossPost.push(entry);
    }
  }
  
  // Sort entries within each cross-post group by date descending
  for (const group of crossPostGroups.values()) {
    group.sort((a, b) => getEntryDate(b) - getEntryDate(a));
  }
  
  // Sort non-cross-posted entries by date descending
  nonCrossPost.sort((a, b) => getEntryDate(b) - getEntryDate(a));
  
  // Create sortable items: each cross-post group as one item, each non-cross-post as one item
  interface SortableItem {
    date: number;
    entries: RssEntry[];
  }
  
  const sortableItems: SortableItem[] = [];
  
  // Add cross-post groups (use newest entry's date for group position)
  for (const group of crossPostGroups.values()) {
    if (group.length > 0) {
      sortableItems.push({
        date: getEntryDate(group[0]), // Already sorted, so first is newest
        entries: group,
      });
    }
  }
  
  // Add non-cross-posted entries individually
  for (const entry of nonCrossPost) {
    sortableItems.push({
      date: getEntryDate(entry),
      entries: [entry],
    });
  }
  
  // Sort all items by date descending
  sortableItems.sort((a, b) => b.date - a.date);
  
  // Flatten back to a single array
  return sortableItems.flatMap(item => item.entries);
}

function sortByDateDescending(entries: RssEntry[]): RssEntry[] {
  return [...entries].sort((a, b) => getEntryDate(b) - getEntryDate(a));
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

  // Sort each category by date, grouping cross-posts together
  return {
    toProcess: sortWithCrossPostGrouping(toProcess, crossPostDescriptions),
    processed: sortWithCrossPostGrouping(processed, crossPostDescriptions),
    ignored: sortWithCrossPostGrouping(ignored, crossPostDescriptions),
  };
}

export default function FeedEntries({ entries, errors, loading, tagFilters }: FeedEntriesProps) {
  const [categorized, setCategorized] = useState<CategorizedEntries>({
    toProcess: [],
    processed: [],
    ignored: [],
  });
  const [interest, setInterest] = useState('Darryn Campbell');

  // Load interest configuration on mount
  useEffect(() => {
    setInterest(getInterest());
  }, []);

  // Compute cross-post descriptions across all entries
  const crossPostDescriptions = useMemo(() => findCrossPostDescriptions(entries), [entries]);

  // Apply tag filters to entries
  const filteredEntries = useMemo(() => {
    // If no filters are set to hidden, return all entries
    const hasActiveFilter = Object.values(tagFilters).some(v => v === 'hidden');
    if (!hasActiveFilter) return entries;

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
      
      // Apply status tag filters - hide entries with a hidden status
      if (tagFilters.statusToProcess === 'hidden' && isToProcess) return false;
      if (tagFilters.statusDone === 'hidden' && isDone) return false;
      if (tagFilters.statusIgnored === 'hidden' && isIgnored) return false;
      
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
      />

      <EntryTable
        id="done"
        title="Done"
        entries={categorized.processed}
        status="processed"
        onAction={handleAction}
        crossPostDescriptions={crossPostDescriptions}
        interest={interest}
      />

      <EntryTable
        id="ignored"
        title="Ignored"
        entries={categorized.ignored}
        status="ignored"
        onAction={handleAction}
        crossPostDescriptions={crossPostDescriptions}
        interest={interest}
      />
    </div>
  );
}

interface EntryTableProps {
  id: string;
  title: string;
  entries: RssEntry[];
  status: EntryStatus;
  onAction: (entryId: string, action: 'process' | 'ignore' | 'restore') => void;
  crossPostDescriptions: Set<string>;
  interest: string;
}

function EntryTable({ id, title, entries, status, onAction, crossPostDescriptions, interest }: EntryTableProps) {
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
          />
        ))}
      </div>
    </div>
  );
}

interface EntryRowProps {
  entry: RssEntry;
  status: EntryStatus;
  onAction: (entryId: string, action: 'process' | 'ignore' | 'restore') => void;
  crossPostDescriptions: Set<string>;
  interest: string;
}

function EntryRow({ entry, status, onAction, crossPostDescriptions, interest }: EntryRowProps) {
  const [showRawXml, setShowRawXml] = useState(false);
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

  return (
    <div className={styles.entry}>
      <div className={styles.entryHeader}>
        <div className={styles.entryHeaderLeft}>
          <span className={styles.entryFeed}>
            {entry.feedTitle}
            {isLoadingOg && (
              <FontAwesomeIcon icon={faSpinner} spin className={styles.ogLoadingIcon} />
            )}
          </span>
          {(isComment || isCrossPost || isDeleted || mentionsInterest) && (
            <div className={styles.entryLabels}>
              {mentionsInterest && (
                <span className={`${styles.label} ${styles.labelMentionsInterest}`}>
                  <FontAwesomeIcon icon={faBullhorn} />
                  <span>Mentions {interest}</span>
                </span>
              )}
              {isComment && (
                <span className={`${styles.label} ${styles.labelComment}`}>
                  <FontAwesomeIcon icon={faComment} />
                  <span>Comment</span>
                </span>
              )}
              {isCrossPost && (
                <span className={`${styles.label} ${styles.labelCrossPost}`}>
                  <FontAwesomeIcon icon={faCodeBranch} />
                  <span>Cross Post</span>
                </span>
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
          {status === 'to_process' && (
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
          {(status === 'processed' || status === 'ignored') && (
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
              <span className={styles.entryDate}>{entry.publishedDate}</span>
            )}
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

          {/* AI Generated Response Section */}
          {(status === 'to_process' || hasAiResponse) && (
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
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.entryFooter}>
        <button
          className={styles.toggleXmlBtn}
          onClick={() => setShowRawXml(!showRawXml)}
        >
          <FontAwesomeIcon icon={showRawXml ? faChevronUp : faChevronDown} />
          <span>{showRawXml ? 'Hide' : 'Show'} Raw XML</span>
        </button>
      </div>

      {showRawXml && (
        <pre className={styles.entryXml}>{entry.rawXml}</pre>
      )}
    </div>
  );
}
