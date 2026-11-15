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

test('existing preferences gain device appearance without losing discoveries, sound or guide choices', () => {
  assert.deepEqual(loadPreferences(saved(existing)), { value: { ...existing, appearance: 'system' }, warning: null });
  assert.equal(loadPreferences({ getItem: () => null }).value.appearance, 'system');
});

test('explicit light and dark choices override the device, while first use follows it', () => {
  for (const systemDark of [false, true]) {
    assert.equal(resolveAppearance('light', systemDark), 'light');
    assert.equal(resolveAppearance('dark', systemDark), 'dark');
    assert.equal(resolveAppearance('system', systemDark), systemDark ? 'dark' : 'light');
  }
  for (const appearance of ['light', 'dark', 'system'] as const) {
    assert.deepEqual(loadPreferences(saved({ ...existing, appearance })), {
      value: { ...existing, appearance }, warning: null,
    });
  }
});

test('an invalid appearance is reported without discarding other progress', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  const result = loadPreferences(saved({ ...existing, appearance: 'unknown' }));
  assert.deepEqual(result.value, { ...existing, appearance: 'system' });
  assert.match(result.warning ?? '', /saved appearance/i);
  assert.equal(warning.mock.calls.length, 1);
});

test('invalid guides and appearance are reported independently, preserving valid settings', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  const result = loadPreferences(saved({ ...existing, seenGuides: ['unknown'], appearance: null }));
  assert.deepEqual(result.value, { ...existing, seenGuides: [], appearance: 'system' });
  assert.match(result.warning ?? '', /walkthrough/i);
  assert.match(result.warning ?? '', /appearance/i);
  assert.equal(warning.mock.calls.length, 2);
});

test('unreadable storage and malformed JSON remain explicit failures with safe device defaults', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  for (const storage of [
    { getItem: () => { throw new Error('Storage access denied.'); } },
    { getItem: () => '{' },
    saved({ appearance: 'dark' }),
  ]) {
    const result = loadPreferences(storage);
    assert.equal(result.value.appearance, 'system');
    assert.match(result.warning ?? '', /could not be read/);
  }
  assert.equal(warning.mock.calls.length, 3);
});
