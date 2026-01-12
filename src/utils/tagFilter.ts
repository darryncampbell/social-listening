// Tag filter states:
// 'shown' - entries with this tag are visible (default)
// 'hidden' - entries with this tag are hidden
export type TagFilterState = 'shown' | 'hidden';

// Content-based tags (derived from entry content)
export type ContentTagType = 'comment' | 'crossPost' | 'deleted' | 'mentionsInterest';

// Status-based tags (derived from entry disposition)
export type StatusTagType = 'statusToProcess' | 'statusDone' | 'statusIgnored';

// All tag types
export type TagType = ContentTagType | StatusTagType;

export interface TagFilters {
  // Content tags
  comment: TagFilterState;
  crossPost: TagFilterState;
  deleted: TagFilterState;
  mentionsInterest: TagFilterState;
  // Status tags
  statusToProcess: TagFilterState;
  statusDone: TagFilterState;
  statusIgnored: TagFilterState;
}

export const DEFAULT_TAG_FILTERS: TagFilters = {
  comment: 'shown',
  crossPost: 'shown',
  deleted: 'shown',
  mentionsInterest: 'shown',
  statusToProcess: 'shown',
  statusDone: 'shown',
  statusIgnored: 'shown',
};

export const CONTENT_TAG_LABELS: Record<ContentTagType, string> = {
  comment: 'Comment',
  crossPost: 'Cross Post',
  deleted: 'Deleted',
  mentionsInterest: 'Mentions Interest',
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
