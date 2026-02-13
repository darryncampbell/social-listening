'use client';

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrown } from '@fortawesome/free-solid-svg-icons';
import { RssEntry } from '@/utils/rssParser';
import { RecognizedUser } from '@/utils/interestConfig';
import { getRedditSubreddit, isRedditComment, isRedditUrl } from '@/utils/redditUtils';
import styles from './MetricsView.module.css';

interface MetricsViewProps {
  entries: RssEntry[];
  redditAuthors: Map<string, string>;
  recognizedUsers: RecognizedUser[];
  interest: string;
}

/**
 * Reddit entries only (link contains reddit.com).
 */
function getRedditEntries(entries: RssEntry[]): RssEntry[] {
  return entries.filter((e) => e.link && isRedditUrl(e.link));
}

/**
 * Entries whose title or description mentions the interest (case-insensitive).
 */
function mentionsInterest(entry: RssEntry, interest: string): boolean {
  const lower = interest.toLowerCase();
  const title = (entry.og?.ogTitle || entry.title || '').toLowerCase();
  const desc = (entry.og?.ogDescription || entry.description || '').toLowerCase();
  return title.includes(lower) || desc.includes(lower);
}

function findUserRecognized(username: string, recognizedUsers: RecognizedUser[]): RecognizedUser | null {
  if (!username) return null;
  const normalizedUsername = username.toLowerCase().replace(/^u\//, '');
  return (
    recognizedUsers.find((user) => {
      const normalizedRecognized = user.username.toLowerCase().replace(/^u\//, '');
      return normalizedUsername === normalizedRecognized;
    }) ?? null
  );
}

export default function MetricsView({
  entries,
  redditAuthors,
  recognizedUsers,
  interest,
}: MetricsViewProps) {
  const redditEntries = useMemo(() => getRedditEntries(entries), [entries]);

  /** Reddit entries that mention the interest (for by-subreddit breakdown). */
  const redditEntriesMentioningInterest = useMemo(
    () => redditEntries.filter((e) => mentionsInterest(e, interest)),
    [redditEntries, interest]
  );

  const bySubreddit = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of redditEntriesMentioningInterest) {
      if (!entry.link) continue;
      const sub = getRedditSubreddit(entry.link);
      const key = sub?.name ?? 'Unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let otherCount = 0;
    const main: { name: string; count: number }[] = [];
    for (const [name, count] of Array.from(counts.entries()).sort((a, b) => b[1] - a[1])) {
      if (count >= 2) {
        main.push({ name, count });
      } else {
        otherCount += count;
      }
    }
    if (otherCount > 0) {
      main.push({ name: 'Other', count: otherCount });
    }
    return main;
  }, [redditEntriesMentioningInterest]);

  const commentVsPost = useMemo(() => {
    let comments = 0;
    let posts = 0;
    for (const entry of redditEntries) {
      if (!entry.link) continue;
      if (isRedditComment(entry.link)) comments++;
      else posts++;
    }
    return { comments, posts };
  }, [redditEntries]);

  const authorsMentioningInterest = useMemo(() => {
    const byAuthor = new Map<string, number>();
    for (const entry of redditEntries) {
      if (!entry.link || !mentionsInterest(entry, interest)) continue;
      const author = redditAuthors.get(entry.link) ?? 'Unknown';
      byAuthor.set(author, (byAuthor.get(author) ?? 0) + 1);
    }
    return Array.from(byAuthor.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([username, count]) => ({ username, count }));
  }, [redditEntries, redditAuthors, interest]);

  return (
    <div className={styles.metricsArea}>
      <section className={styles.redditBreakdown}>
        <h4 className={styles.breakdownTitle}>Reddit Breakdown</h4>

        <div className={styles.breakdownBlock}>
          <h5 className={styles.breakdownSubtitle}>Comment vs post</h5>
          {redditEntries.length === 0 ? (
            <p className={styles.breakdownEmpty}>No Reddit entries</p>
          ) : (
            <div className={styles.commentPostRow}>
              <span className={styles.commentPostItem}>
                <span className={styles.commentPostLabel}>Posts</span>
                <span className={styles.commentPostValue}>{commentVsPost.posts}</span>
              </span>
              <span className={styles.commentPostItem}>
                <span className={styles.commentPostLabel}>Comments</span>
                <span className={styles.commentPostValue}>{commentVsPost.comments}</span>
              </span>
            </div>
          )}
        </div>

        <div className={styles.breakdownBlock}>
          <h5 className={styles.breakdownSubtitle}>
            By subreddit (entries mentioning {interest} only)
          </h5>
          {bySubreddit.length === 0 ? (
            <p className={styles.breakdownEmpty}>No Reddit entries mentioning {interest}</p>
          ) : (
            <ul className={styles.breakdownListBySubreddit}>
              {bySubreddit.map(({ name, count }) => {
                const subredditSlug = name.startsWith('r/') ? name.slice(2) : name;
                const isOther = name === 'Other';
                const subredditUrl = isOther ? undefined : `https://www.reddit.com/r/${subredditSlug}/`;
                return (
                  <li key={name} className={styles.breakdownRow}>
                    {subredditUrl ? (
                      <a
                        href={subredditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.breakdownLink}
                      >
                        {name}
                      </a>
                    ) : (
                      <span>{name}</span>
                    )}
                    <span className={styles.breakdownCount}>{count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={styles.breakdownBlock}>
          <h5 className={styles.breakdownSubtitle}>
            Top authors mentioning {interest} (2+ mentions)
          </h5>
          {authorsMentioningInterest.length === 0 ? (
            <p className={styles.breakdownEmpty}>
              No Reddit authors with more than one mention of {interest}
            </p>
          ) : (
            <ul className={styles.breakdownListByAuthors}>
              {authorsMentioningInterest.map(({ username, count }) => {
                const recognized = findUserRecognized(username, recognizedUsers);
                const isRecognized = recognized !== null;
                const realName = recognized?.realName ?? '';
                return (
                  <li key={username} className={styles.breakdownRow}>
                    <a
                      href={`https://www.reddit.com/user/${username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.breakdownLink} ${isRecognized ? styles.authorRecognized : ''}`}
                    >
                      {isRecognized && (
                        <FontAwesomeIcon icon={faCrown} className={styles.crownIconLeft} />
                      )}
                      u/{username}
                      {realName && (
                        <span className={styles.authorRealName}> ({realName})</span>
                      )}
                      {isRecognized && (
                        <FontAwesomeIcon icon={faCrown} className={styles.crownIconRight} />
                      )}
                    </a>
                    <span className={styles.breakdownCount}>{count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
