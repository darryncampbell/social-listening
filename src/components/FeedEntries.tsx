'use client';

import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faBan, faUndo, faExternalLinkAlt, faChevronDown, faChevronUp, faSpinner, faWandMagicSparkles, faRedo, faLink } from '@fortawesome/free-solid-svg-icons';
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
import styles from './FeedEntries.module.css';

/**
 * Detect if an entry is a Reddit comment based on URL pattern
 * Reddit comment URLs contain 'reddit.com' and '/c/'
 */
function isRedditComment(url: string): boolean {
  if (!url) return false;
  return url.includes('reddit.com') && url.includes('/c/');
}

interface FeedEntriesProps {
  entries: RssEntry[];
  errors: Array<{ feedTitle: string; error: string }>;
  loading: boolean;
}

interface CategorizedEntries {
  toProcess: RssEntry[];
  processed: RssEntry[];
  ignored: RssEntry[];
}

/**
 * Sort entries by published date, newest first
 */
function sortByDateDescending(entries: RssEntry[]): RssEntry[] {
  return [...entries].sort((a, b) => {
    // Try to parse the date strings
    const dateA = a.publishedDate ? new Date(a.publishedDate).getTime() : 0;
    const dateB = b.publishedDate ? new Date(b.publishedDate).getTime() : 0;
    
    // Handle invalid dates (NaN)
    const validA = !isNaN(dateA) ? dateA : 0;
    const validB = !isNaN(dateB) ? dateB : 0;
    
    // Sort descending (newest first)
    return validB - validA;
  });
}

function categorizeEntriesFromSource(entries: RssEntry[]): CategorizedEntries {
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

  // Sort each category by date, newest first
  return {
    toProcess: sortByDateDescending(toProcess),
    processed: sortByDateDescending(processed),
    ignored: sortByDateDescending(ignored),
  };
}

export default function FeedEntries({ entries, errors, loading }: FeedEntriesProps) {
  const [categorized, setCategorized] = useState<CategorizedEntries>({
    toProcess: [],
    processed: [],
    ignored: [],
  });

  const recategorize = useCallback(() => {
    setCategorized(categorizeEntriesFromSource(entries));
  }, [entries]);

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
    setCategorized(categorizeEntriesFromSource(entries));
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
      />

      <EntryTable
        id="done"
        title="Done"
        entries={categorized.processed}
        status="processed"
        onAction={handleAction}
      />

      <EntryTable
        id="ignored"
        title="Ignored"
        entries={categorized.ignored}
        status="ignored"
        onAction={handleAction}
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
}

function EntryTable({ id, title, entries, status, onAction }: EntryTableProps) {
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
}

function EntryRow({ entry, status, onAction }: EntryRowProps) {
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

  return (
    <div className={styles.entry}>
      <div className={styles.entryHeader}>
        <span className={styles.entryFeed}>
          {entry.feedTitle}
          {isLoadingOg && (
            <FontAwesomeIcon icon={faSpinner} spin className={styles.ogLoadingIcon} />
          )}
        </span>
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
          <div className={`${styles.entryImageWrapper} ${displayImage === '/reddit-logo.svg' ? styles.redditImageWrapper : ''}`}>
            <img src={displayImage} alt="" className={`${styles.entryImage} ${displayImage === '/reddit-logo.svg' ? styles.redditImage : ''}`} />
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
