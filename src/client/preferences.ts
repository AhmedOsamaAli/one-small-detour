import { isGuideTopics } from '../shared/guidance.ts';
import { isRecord } from '../shared/validation.ts';
import type { GuideTopic } from '../shared/types.ts';
import type { PracticeProgress } from '../shared/progression.ts';
import { MAX_EXCHANGES } from '../shared/rules.ts';

export type AppearancePreference = 'light' | 'dark';

export interface Preferences {
  flat: boolean;
  completed: string[];
  soundWanted: boolean;
  seenGuides: GuideTopic[];
  appearance: AppearancePreference;
  practice?: PracticeProgress;
}

export const PREF_KEY = 'detour:preferences:1';

export function resolveAppearance(preference: AppearancePreference | 'system'): AppearancePreference {
  return preference === 'dark' ? 'dark' : 'light';
}

export function loadPreferences(storage?: Pick<Storage, 'getItem'>): { value: Preferences; warning: string | null } {
  const defaults: Preferences = {
    flat: false, completed: [], soundWanted: false, seenGuides: [], appearance: 'light',
  };
  try {
    const text = (storage ?? localStorage).getItem(PREF_KEY);
    if (!text) return { value: defaults, warning: null };
    const value: unknown = JSON.parse(text);
    if (!isRecord(value) || typeof value['flat'] !== 'boolean' ||
        typeof value['soundWanted'] !== 'boolean' || !Array.isArray(value['completed']) ||
        !value['completed'].every((item: unknown) => typeof item === 'string')) throw new Error('Invalid saved preferences.');
    const warnings: string[] = [];
    let seenGuides: GuideTopic[] = [];
    if (value['seenGuides'] !== undefined) {
      if (isGuideTopics(value['seenGuides'])) seenGuides = value['seenGuides'];
      else {
        console.warn('Saved walkthrough choices could not be read.');
        warnings.push('The walkthrough choices could not be read. Other progress is safe; the guide may appear again.');
      }
    }
    let appearance: AppearancePreference = 'light';
    if (value['appearance'] !== undefined) {
      if (value['appearance'] === 'system' || value['appearance'] === 'light' || value['appearance'] === 'dark') {
        appearance = resolveAppearance(value['appearance']);
      } else {
        console.warn('The saved appearance choice could not be read.');
        warnings.push('The saved appearance could not be read. Light mode is being used; other progress is safe.');
      }
    }
    let practice: PracticeProgress | undefined;
    if (value['practice'] !== undefined) {
      const saved = value['practice'];
      if (isRecord(saved) && isRecord(saved['bests']) && typeof saved['unlockedWorlds'] === 'number' &&
          Number.isInteger(saved['unlockedWorlds']) && saved['unlockedWorlds'] >= 1 && saved['unlockedWorlds'] <= 10_000 &&
          Object.entries(saved['bests']).every(([id, moves]) => id.length > 0 && id.length <= 150 &&
            typeof moves === 'number' && Number.isInteger(moves) && moves >= 1 && moves <= MAX_EXCHANGES)) {
        const bests: Record<string, number> = {};
        for (const [id, moves] of Object.entries(saved['bests'])) if (typeof moves === 'number') bests[id] = moves;
        practice = { bests, unlockedWorlds: saved['unlockedWorlds'] };
      } else {
        console.warn('Saved Practice star records could not be read.');
        warnings.push('Practice stars could not be read. Completed stops are safe; world access will be restored from your discoveries.');
      }
    }
    return {
      value: { flat: value['flat'], completed: value['completed'], soundWanted: value['soundWanted'], seenGuides, appearance,
        ...(practice ? { practice } : {}) },
      warning: warnings.length ? warnings.join(' ') : null,
    };
  } catch (error) {
    console.warn('Saved Detour preferences could not be loaded:', error);
    return { value: defaults, warning: 'Saved preferences could not be read. The island is using fresh settings; nothing on your village board was changed.' };
  }
}
