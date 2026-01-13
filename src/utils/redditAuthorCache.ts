// Cache for Reddit post authors
// Stores: { [redditUrl]: { author: string, fetchedAt: string } }

const STORAGE_KEY = 'social-listening-reddit-authors';

interface AuthorCacheEntry {
  author: string;
  fetchedAt: string;
}

interface AuthorCache {
  [url: string]: AuthorCacheEntry;
}

export function getAuthorCache(): AuthorCache {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function getCachedAuthor(url: string): string | null {
  const cache = getAuthorCache();
  return cache[url]?.author || null;
}

export function setCachedAuthor(url: string, author: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = getAuthorCache();
    cache[url] = {
      author,
      fetchedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to cache Reddit author:', error);
  }
}

export function getCachedAuthorsForUrls(urls: string[]): Map<string, string> {
  const cache = getAuthorCache();
  const result = new Map<string, string>();
  for (const url of urls) {
    if (cache[url]?.author) {
      result.set(url, cache[url].author);
    }
  }
  return result;
}

export function getUncachedUrls(urls: string[]): string[] {
  const cache = getAuthorCache();
  return urls.filter(url => !cache[url]?.author);
}

// Check if a URL is a Reddit post (not a comment)
export function isRedditPostUrl(url: string): boolean {
  if (!url) return false;
  // Match Reddit post URLs like /r/subreddit/comments/id/title/
  // But not comment URLs which have additional path segments or query params pointing to comments
  const redditPostPattern = /^https?:\/\/(www\.)?reddit\.com\/r\/[^/]+\/comments\/[^/]+\/[^/]*\/?$/;
  return redditPostPattern.test(url);
}

// Check if a URL is a Reddit comment
export function isRedditCommentUrl(url: string): boolean {
  if (!url) return false;
  // Match Reddit comment URLs which contain /comments/ID/...more path segments
  // e.g., /r/subreddit/comments/1q8xhqn/c/nz2dqt2
  return url.includes('reddit.com/r/') && url.includes('/comments/') && url.includes('/c/');
}

// Check if a URL is any Reddit URL (post or comment) that we can look up
export function isRedditUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('reddit.com/r/') && url.includes('/comments/');
}
