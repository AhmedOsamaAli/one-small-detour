import type { Board, GuideTopic } from './types.ts';

export const GUIDE_TOPICS: readonly GuideTopic[] = ['basics', 'rocks', 'bridges'];

export function isGuideTopic(value: unknown): value is GuideTopic {
  return GUIDE_TOPICS.some((topic) => topic === value);
}

export function isGuideTopics(value: unknown): value is GuideTopic[] {
  return Array.isArray(value) && value.length <= GUIDE_TOPICS.length &&
    value.every(isGuideTopic) && new Set(value).size === value.length;
}

export function mergeGuideTopics(first: readonly GuideTopic[], second: readonly GuideTopic[]): GuideTopic[] {
  return GUIDE_TOPICS.filter((topic) => first.includes(topic) || second.includes(topic));
}

export function newTileGuides(board: Board, seen: readonly GuideTopic[]): GuideTopic[] {
  const topics: GuideTopic[] = [];
  if (!seen.includes('rocks') && board.some((row) => row.includes('x'))) topics.push('rocks');
  if (!seen.includes('bridges') && board.some((row) => /[hv]/.test(row))) topics.push('bridges');
  return topics;
}
