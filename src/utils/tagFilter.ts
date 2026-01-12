// Tag filter states:
// 'shown' - entries with this tag are visible (default)
// 'hidden' - entries with this tag are hidden
export type TagFilterState = 'shown' | 'hidden';

// Content-based tags (derived from entry content)
export type ContentTagType = 'comment' | 'crossPost' | 'deleted' | 'mentionsInterest' | 'github';

// Status-based tags (derived from entry disposition)
export type StatusTagType = 'statusToProcess' | 'statusDone' | 'statusIgnored';

// All tag types
export type TagType = ContentTagType | StatusTagType;

// Feed filters - dynamic based on feed titles
export type FeedFilters = Record<string, TagFilterState>;

export interface TagFilters {
  // Content tags
  comment: TagFilterState;
  crossPost: TagFilterState;
  deleted: TagFilterState;
  mentionsInterest: TagFilterState;
  github: TagFilterState;
  // Status tags
  statusToProcess: TagFilterState;
  statusDone: TagFilterState;
  statusIgnored: TagFilterState;
  // Feed filters (keyed by feed title)
  feeds: FeedFilters;
}

export const DEFAULT_TAG_FILTERS: TagFilters = {
  comment: 'shown',
  crossPost: 'shown',
  deleted: 'shown',
  mentionsInterest: 'shown',
  github: 'shown',
  statusToProcess: 'shown',
  statusDone: 'shown',
  statusIgnored: 'shown',
  feeds: {},
};

/**
 * Get the filter state for a feed, defaulting to 'shown' if not set
 */
export function getFeedFilterState(filters: TagFilters, feedTitle: string): TagFilterState {
  return filters.feeds[feedTitle] ?? 'shown';
}

/**
 * Update feed filters to include any new feeds, preserving existing filter states
 */
export function syncFeedFilters(filters: TagFilters, feedTitles: string[]): TagFilters {
  const updatedFeeds: FeedFilters = { ...filters.feeds };
  
  // Add any new feeds with default 'shown' state
  for (const title of feedTitles) {
    if (!(title in updatedFeeds)) {
      updatedFeeds[title] = 'shown';
    }
  }
  
  return {
    ...filters,
    feeds: updatedFeeds,
  };
}

export const CONTENT_TAG_LABELS: Record<ContentTagType, string> = {
  comment: 'Comment',
  crossPost: 'Cross Post',
  deleted: 'Deleted',
  mentionsInterest: 'Mentions Interest',
  github: 'GitHub',
};

export const STATUS_TAG_LABELS: Record<StatusTagType, string> = {
  statusToProcess: 'To Process',
  statusDone: 'Done',
  statusIgnored: 'Ignored',
};

export const TAG_LABELS: Record<TagType, string> = {
  ...CONTENT_TAG_LABELS,
  ...STATUS_TAG_LABELS,
};

export function toggleFilterState(current: TagFilterState): TagFilterState {
  return current === 'shown' ? 'hidden' : 'shown';
}
