'use client';

import { useState, useEffect } from 'react';
import FeedRow from './FeedRow';
import styles from './FeedList.module.css';

const STORAGE_KEY = 'social-listening-feeds';

interface Feed {
  id: string;
  title: string;
  url: string;
}

export default function FeedList() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [mounted, setMounted] = useState(false);
  const [newRowKey, setNewRowKey] = useState(0);

  // Load feeds from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setFeeds(JSON.parse(stored));
      } catch {
        // Invalid JSON, ignore
      }
    }
    setMounted(true);
  }, []);

  // Save feeds to localStorage whenever they change
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(feeds));
    }
  }, [feeds, mounted]);

  const handleSave = (index: number, title: string, url: string) => {
    setFeeds((prev) => {
      const updated = [...prev];
      if (index < prev.length) {
        // Update existing feed
        updated[index] = { ...updated[index], title, url };
      } else {
        // Add new feed
        updated.push({ id: crypto.randomUUID(), title, url });
      }
      return updated;
    });
    // Increment key to force new row to reset
    if (index >= feeds.length) {
      setNewRowKey((prev) => prev + 1);
    }
  };

  const handleDelete = (index: number) => {
    setFeeds((prev) => prev.filter((_, i) => i !== index));
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Configure social data sources (RSS feeds)</h2>
      <div className={styles.list}>
        {feeds.map((feed, index) => (
          <FeedRow
            key={feed.id}
            initialTitle={feed.title}
            initialUrl={feed.url}
            isEditing={false}
            isNew={false}
            onSave={(title, url) => handleSave(index, title, url)}
            onDelete={() => handleDelete(index)}
          />
        ))}
        {/* Always show one empty row for adding new feeds */}
        <FeedRow
          key={`new-${newRowKey}`}
          isNew={true}
          onSave={(title, url) => handleSave(feeds.length, title, url)}
        />
      </div>
    </div>
  );
}
