import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPreferences, PREF_KEY, resolveAppearance } from './preferences.ts';

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
