// Tag filter states:
// 'include' - show only entries WITH this tag
// 'exclude' - show only entries WITHOUT this tag
// 'off' - don't filter by this tag
export type TagFilterState = 'include' | 'exclude' | 'off';

export type TagType = 'comment' | 'crossPost' | 'deleted' | 'mentionsInterest';

export interface TagFilters {
  comment: TagFilterState;
  crossPost: TagFilterState;
  deleted: TagFilterState;
  mentionsInterest: TagFilterState;
}

export const DEFAULT_TAG_FILTERS: TagFilters = {
  comment: 'off',
  crossPost: 'off',
  deleted: 'off',
  mentionsInterest: 'off',
};

export const TAG_LABELS: Record<TagType, string> = {
  comment: 'Comment',
  crossPost: 'Cross Post',
  deleted: 'Deleted',
  mentionsInterest: 'Mentions Interest',
};

export function getNextFilterState(current: TagFilterState): TagFilterState {
  switch (current) {
    case 'off': return 'include';
    case 'include': return 'exclude';
    case 'exclude': return 'off';
  }
}

export function getFilterStateLabel(state: TagFilterState): string {
  switch (state) {
    case 'off': return 'Off';
    case 'include': return 'Only';
    case 'exclude': return 'Hide';
  }
}
