import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalPracticeStore } from './practiceProgress.ts';
import { browserPracticeState } from '../shared/practiceProgress.ts';
import { getCatalog } from '../shared/puzzles.ts';
import { campaignPlaces } from '../shared/progression.ts';

test('Practice progress persists across local server reloads and stale writes cannot undo a saved clear', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'detour-practice-'));
  try {
    const file = join(directory, 'practice.json'), store = new LocalPracticeStore(file);
    const catalog = getCatalog(), first = campaignPlaces(catalog)[0];
    assert.ok(first);
    const progress = browserPracticeState(catalog, [first.id], { bests: { [first.id]: first.minimum ?? 1 }, unlockedWorlds: 1 });
    await Promise.all([store.merge('owner', 0, progress), store.merge('peer', 0, progress)]);
    assert.deepEqual((await new LocalPracticeStore(file).read('owner')).completed, [first.id]);
    await store.erase('owner');
    await assert.rejects(new LocalPracticeStore(file).merge('owner', 0, progress), /cleared on another device/);
    assert.deepEqual((await new LocalPracticeStore(file).read('peer')).completed, [first.id]);
  } finally {
    for (const name of await readdir(directory)) await rm(join(directory, name));
    await rmdir(directory);
  }
});

test('an invalid local Practice archive is surfaced and never overwritten', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'detour-practice-invalid-'));
  try {
    const file = join(directory, 'practice.json'), text = '{"version":1,"players":{"owner":{"completed":false}}}';
    await writeFile(file, text, 'utf8');
    await assert.rejects(new LocalPracticeStore(file).read('owner'), /invalid/);
    assert.equal(await readFile(file, 'utf8'), text);
  } finally {
    for (const name of await readdir(directory)) await rm(join(directory, name));
    await rmdir(directory);
  }
});
