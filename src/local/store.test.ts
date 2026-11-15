import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalScoreStore } from './store.ts';
import { rankScores, scoreKey } from '../server/service.ts';

test('real local scores persist, concurrent writes survive, and erasure is scoped', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'detour-scores-'));
  try {
    const file = join(directory, 'scores.json');
    const store = new LocalScoreStore(file);
    const date = new Date().toISOString().slice(0, 10);
    const key = `detour:1:${date}:gentle`;
    await Promise.all(['one', 'two'].map((id) => store.put(key, {
      userId: id, name: id, footprint: 6, swaps: 2, submittedAt: new Date().toISOString(),
    })));
    assert.equal((await new LocalScoreStore(file).list(key)).length, 2);
    await store.erase('one');
    assert.equal((await store.list(key))[0]?.userId, 'two');
    await writeFile(file, '{corrupt', 'utf8');
    await assert.rejects(() => store.list(key));
    assert.equal(await readFile(file, 'utf8'), '{corrupt');
  } finally {
    for (const name of await readdir(directory)) await rm(join(directory, name));
    await rmdir(directory);
  }
});

test('timed daily results survive reload without overwriting a faster equal-move result or legacy scores', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'detour-timed-scores-'));
  try {
    const file = join(directory, 'scores.json');
    const store = new LocalScoreStore(file);
    const date = new Date().toISOString().slice(0, 10);
    const current = scoreKey(date, 'daily');
    const legacy = scoreKey(date, 'daily', '4');
    const base = { userId: 'owner', name: 'Owner', swaps: 3, footprint: 12, submittedAt: new Date().toISOString() };
    await store.put(legacy, base);
    await Promise.all([7000, 9000].map((solveMs) => store.put(current, { ...base, solveMs })));
    const reloaded = new LocalScoreStore(file);
    assert.equal(rankScores(await reloaded.list(current), 'owner', 'local').yourBest?.solveMs, 7000);
    assert.equal((await reloaded.list(legacy))[0]?.solveMs, undefined);
    await reloaded.erase('owner');
    assert.deepEqual(await reloaded.list(current), []);
    assert.deepEqual(await reloaded.list(legacy), []);
  } finally {
    for (const name of await readdir(directory)) await rm(join(directory, name));
    await rmdir(directory);
  }
});
