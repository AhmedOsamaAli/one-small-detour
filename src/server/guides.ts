import { GUIDE_TOPICS } from '../shared/guidance.ts';
import type { GuideTopic } from '../shared/types.ts';

export const GUIDE_PREFERENCE_TTL_SECONDS = 31 * 86_400;

export interface GuideStore {
  seen(userId: string): Promise<GuideTopic[]>;
  markSeen(userId: string, topics: readonly GuideTopic[]): Promise<void>;
  erase(userId: string): Promise<void>;
}

export class MemoryGuideStore implements GuideStore {
  private readonly choices = new Map<string, Set<GuideTopic>>();

  async seen(userId: string): Promise<GuideTopic[]> {
    const choices = this.choices.get(userId);
    return GUIDE_TOPICS.filter((topic) => choices?.has(topic));
  }

  async markSeen(userId: string, topics: readonly GuideTopic[]): Promise<void> {
    const choices = this.choices.get(userId) ?? new Set<GuideTopic>();
    for (const topic of topics) choices.add(topic);
    this.choices.set(userId, choices);
  }

  async erase(userId: string): Promise<void> {
    this.choices.delete(userId);
  }
}
