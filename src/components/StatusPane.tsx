'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import styles from './StatusPane.module.css';
import PromptModal, { PromptType } from './PromptModal';
import { syncAllFeeds, RssEntry } from '@/utils/rssParser';

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
}

export default function StatusPane({ onSyncComplete, onSyncStart }: StatusPaneProps) {
  const [feedCount, setFeedCount] = useState<number>(0);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [promptModalType, setPromptModalType] = useState<PromptType | null>(null);
  const [syncing, setSyncing] = useState(false);

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
        setLastSyncTime(syncDate.toLocaleString());
      } catch {
        setLastSyncTime(null);
      }
    }

    setMounted(true);
  }, []);

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
            </span>
          </div>
        </div>
        <div className={styles.actions}>
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
