/**
 * Shared Reddit URL helpers for FeedEntries and MetricsView.
 */

/**
 * Detect if a URL is a Reddit comment (contains /c/).
 */
export function isRedditComment(url: string): boolean {
  if (!url) return false;
  return url.includes('reddit.com') && url.includes('/c/');
}

/**
 * Extract subreddit name and URL from a Reddit URL.
 * Example: https://www.reddit.com/r/automation/comments/1qtvhsu/...
 * Returns: { name: 'r/automation', url: 'https://www.reddit.com/r/automation/' }
 */
export function getRedditSubreddit(url: string): { name: string; url: string } | null {
  if (!url || !url.includes('reddit.com')) return null;
  const match = url.match(/reddit\.com\/r\/([^/]+)/);
  if (!match) return null;
  const subredditName = match[1];
  return {
    name: `r/${subredditName}`,
    url: `https://www.reddit.com/r/${subredditName}/`,
  };
}

/**
 * Check if an entry link is from Reddit.
 */
export function isRedditUrl(url: string): boolean {
  return !!url && url.includes('reddit.com');
}
