import { isGuideTopics } from '../shared/guidance.ts';
import { isRecord } from '../shared/validation.ts';
import type { GuideTopic } from '../shared/types.ts';

export type AppearancePreference = 'light' | 'dark';

export interface Preferences {
  flat: boolean;
  completed: string[];
  soundWanted: boolean;
  seenGuides: GuideTopic[];
  appearance: AppearancePreference;
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
    return {
      value: { flat: value['flat'], completed: value['completed'], soundWanted: value['soundWanted'], seenGuides, appearance },
      warning: warnings.length ? warnings.join(' ') : null,
    };
  } catch (error) {
    console.warn('Saved Detour preferences could not be loaded:', error);
    return { value: defaults, warning: 'Saved preferences could not be read. The island is using fresh settings; nothing on your village board was changed.' };
  }
}
