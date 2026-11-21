import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPreferences, PRACTICE_FENCE_KEY, PREF_KEY, resolveAppearance } from './preferences.ts';

const existing = { flat: true, completed: ['routes-01', 'daily-v4-2026-11-14'], soundWanted: true, seenGuides: ['basics', 'rocks'] };
const saved = (value: unknown) => ({
  getItem(key: string): string {
    assert.equal(key, PREF_KEY);
    return JSON.stringify(value);
  },
});

test('new and existing preferences default to light without losing discoveries, sound or guide choices', () => {
  assert.deepEqual(loadPreferences(saved(existing)), { value: { ...existing, appearance: 'light' }, warning: null });
  assert.equal(loadPreferences({ getItem: () => null }).value.appearance, 'light');
});

test('new players request sound by default while saved mute and sound choices are preserved', () => {
  assert.equal(loadPreferences({ getItem: () => null }).value.soundWanted, true);
  for (const soundWanted of [false, true]) {
    assert.deepEqual(loadPreferences(saved({ ...existing, soundWanted })), {
      value: { ...existing, soundWanted, appearance: 'light' }, warning: null,
    });
  }
});

test('explicit light and dark choices remain unchanged', () => {
  for (const appearance of ['light', 'dark'] as const) {
    assert.equal(resolveAppearance(appearance), appearance);
    assert.deepEqual(loadPreferences(saved({ ...existing, appearance })), {
      value: { ...existing, appearance }, warning: null,
    });
  }
});

test('legacy automatic appearance migrates to light without resetting any other preference', () => {
  assert.equal(resolveAppearance('system'), 'light');
  assert.deepEqual(loadPreferences(saved({ ...existing, appearance: 'system' })), {
    value: { ...existing, appearance: 'light' }, warning: null,
  });
});

test('an invalid appearance is reported without discarding other progress', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  const result = loadPreferences(saved({ ...existing, appearance: 'unknown' }));
  assert.deepEqual(result.value, { ...existing, appearance: 'light' });
  assert.match(result.warning ?? '', /saved appearance/i);
  assert.match(result.warning ?? '', /Light mode/);
  assert.equal(warning.mock.calls.length, 1);
});

test('invalid guides and appearance are reported independently, preserving valid settings', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  const result = loadPreferences(saved({ ...existing, seenGuides: ['unknown'], appearance: null }));
  assert.deepEqual(result.value, { ...existing, seenGuides: [], appearance: 'light' });
  assert.match(result.warning ?? '', /walkthrough/i);
  assert.match(result.warning ?? '', /appearance/i);
  assert.equal(warning.mock.calls.length, 2);
});

test('unreadable storage and malformed JSON remain explicit failures with safe light defaults', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  for (const storage of [
    { getItem: () => { throw new Error('Storage access denied.'); } },
    { getItem: () => '{' },
    saved({ appearance: 'dark' }),
  ]) {
    const result = loadPreferences(storage);
    assert.equal(result.value.appearance, 'light');
    assert.match(result.warning ?? '', /could not be read/);
  }
  assert.equal(warning.mock.calls.length, 3);
});

test('Practice move records and earned world access survive reload without changing existing settings', () => {
  const practice = { bests: { 'routes-01': 3 }, unlockedWorlds: 2 };
  const result = loadPreferences(saved({ ...existing, appearance: 'dark', practice }));
  assert.deepEqual(result.value, { ...existing, appearance: 'dark', practice });
  assert.equal(result.warning, null);
});

test('invalid Practice stars are reported while old discoveries, sound and appearance survive', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  const result = loadPreferences(saved({ ...existing, appearance: 'dark', practice: { bests: { 'routes-01': -1 }, unlockedWorlds: 2 } }));
  assert.deepEqual(result.value, { ...existing, appearance: 'dark' });
  assert.match(result.warning ?? '', /stars could not be read/);
  assert.equal(warning.mock.calls.length, 1);
});

test('an old-client reset restores the newer client fence so authoritative sync can clear retained unknown IDs', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  const owner = 'a'.repeat(64), fence = { owner, generation: 0 };
  const value = { ...existing, completed: [...existing.completed, 'practice-v3-0003'],
    practice: { bests: {}, unlockedWorlds: 1 }, practiceAccount: { owner, generation: 1 } };
  const result = loadPreferences({ getItem: key => key === PREF_KEY ? JSON.stringify(value) :
    key === PRACTICE_FENCE_KEY ? JSON.stringify(fence) : null });
  assert.deepEqual(result.value.practiceAccount, fence);
  assert.deepEqual(result.value.completed, value.completed);
  assert.deepEqual(result.value.practice, value.practice);
  assert.match(result.warning ?? '', /older game version/);
  assert.equal(warning.mock.calls.length, 1);
});

test('ordinary old-client saves preserve newer completion credit when the account was not reset', () => {
  const practiceAccount = { owner: 'a'.repeat(64), generation: 0 };
  const value = { ...existing, completed: [...existing.completed, 'practice-v3-0003'],
    practice: { bests: {}, unlockedWorlds: 1 }, practiceAccount };
  const result = loadPreferences({ getItem: key => key === PREF_KEY ? JSON.stringify(value) : JSON.stringify(practiceAccount) });
  assert.deepEqual(result.value.completed, value.completed);
  assert.deepEqual(result.value.practiceAccount, practiceAccount);
  assert.equal(result.warning, null);
});

test('valid newer move records are never discarded because a reset-history stamp is older', () => {
  const value = { ...existing, completed: [...existing.completed, 'practice-v3-0003'],
    practice: { bests: { 'practice-v3-0003': 8 }, unlockedWorlds: 1 },
    practiceAccount: { owner: 'a'.repeat(64), generation: 1 } };
  const result = loadPreferences(saved(value));
  assert.deepEqual(result.value, { ...value, appearance: 'light' });
  assert.equal(result.warning, null);
});

test('unreadable reset history is reported without deleting preferences or changing account identity', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  const value = { ...existing, completed: [...existing.completed, 'practice-v3-0003'],
    practice: { bests: {}, unlockedWorlds: 1 }, practiceAccount: { owner: 'a'.repeat(64), generation: 1 } };
  const result = loadPreferences({ getItem: key => key === PREF_KEY ? JSON.stringify(value) : '{' });
  assert.deepEqual(result.value, { ...value, appearance: 'light' });
  assert.match(result.warning ?? '', /reset history could not be read/);
  assert.equal(warning.mock.calls.length, 1);
});

for (const [name, practiceAccount, fence] of [
  ['an older current generation', { owner: 'a'.repeat(64), generation: 0 }, { owner: 'a'.repeat(64), generation: 1 }],
  ['a different current account', { owner: 'b'.repeat(64), generation: 0 }, { owner: 'a'.repeat(64), generation: 0 }],
] as const) {
  test(`reset history must not replace ${name} and hide the existing authoritative reset check`, () => {
    const value = { ...existing, completed: ['practice-v3-0003'], practice: { bests: {}, unlockedWorlds: 1 }, practiceAccount };
    const result = loadPreferences({ getItem: key => key === PREF_KEY ? JSON.stringify(value) : JSON.stringify(fence) });
    assert.deepEqual(result.value.practiceAccount, practiceAccount);
    assert.deepEqual(result.value.completed, value.completed);
    assert.equal(result.warning, null);
  });
}
