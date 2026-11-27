import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchDailyReminders, MemoryReminderStore, nextDailyReminderAt, RedisReminderStore } from './reminders.ts';
import type { ReminderStore } from './reminders.ts';
import { RankingFixture } from './rankingFixture.ts';

const preference = { time: '18:00', timeZone: 'UTC' };
const before = new Date('2026-11-23T17:59:00Z');
const due = new Date('2026-11-23T18:00:30Z');
const edition = '2026-11-23';

test('reminders follow the chosen local time across UTC dates and fractional timezone offsets', () => {
  for (const [timeZone, after, expected] of [
    ['UTC', '2026-11-23T17:59:00Z', '2026-11-23T18:00:00.000Z'],
    ['UTC', '2026-11-23T18:00:00Z', '2026-11-24T18:00:00.000Z'],
    ['Asia/Kolkata', '2026-11-23T12:29:00Z', '2026-11-23T12:30:00.000Z'],
    ['Pacific/Kiritimati', '2026-11-23T05:00:00Z', '2026-11-24T04:00:00.000Z'],
    ['America/Los_Angeles', '2026-11-23T23:00:00Z', '2026-11-24T02:00:00.000Z'],
  ]) {
    assert.ok(timeZone && after && expected);
    assert.equal(nextDailyReminderAt({ time: '18:00', timeZone }, new Date(after)).toISOString(), expected);
  }
});

test('reminder scheduling handles missing and repeated DST times without slipping to the wrong day', () => {
  assert.equal(nextDailyReminderAt({ time: '02:30', timeZone: 'America/New_York' },
    new Date('2026-03-08T05:00:00Z')).toISOString(), '2026-03-08T07:30:00.000Z');
  assert.equal(nextDailyReminderAt({ time: '01:30', timeZone: 'America/New_York' },
    new Date('2026-11-01T04:00:00Z')).toISOString(), '2026-11-01T05:30:00.000Z');
  assert.equal(nextDailyReminderAt({ time: '01:30', timeZone: 'America/New_York' },
    new Date('2026-11-01T05:45:00Z')).toISOString(), '2026-11-01T06:30:00.000Z');
  assert.equal(nextDailyReminderAt({ time: '18:00', timeZone: 'America/New_York' },
    new Date('2026-03-07T23:00:01Z')).toISOString(), '2026-03-08T22:00:00.000Z');
});

for (const kind of ['memory', 'redis'] as const) {
  const create = (): ReminderStore => kind === 'memory' ? new MemoryReminderStore() : new RedisReminderStore(new RankingFixture());

  test(`${kind}: reminders are opt-in, skip finished turns and send once despite concurrent jobs and off/on changes`, async () => {
    const store = create(), sent: string[] = [];
    assert.equal(await store.read('owner'), null);
    await store.save('owner', preference, 't3_game', before, 0);
    await store.save('finished', preference, 't3_game', before, 0);
    assert.deepEqual(await store.due(before), []);
    const dispatch = () => dispatchDailyReminders({
      store, now: () => due,
      recipient: async id => ({ name: id, completed: id === 'finished' }),
      send: async (name, postId, date) => { assert.equal(postId, 't3_game');assert.equal(date, edition);sent.push(name); },
    });
    await Promise.all([dispatch(), dispatch()]);
    assert.deepEqual(sent, ['owner']);
    assert.equal((await store.delivery('finished', edition))?.status, 'skipped');
    await store.erase('owner');
    assert.equal(await store.read('owner'), null);
    await store.save('owner', { ...preference, time: '18:02' }, 't3_game', due, await store.generation('owner'));
    await dispatchDailyReminders({
      store, now: () => new Date('2026-11-23T18:02:30Z'),
      recipient: async id => ({ name: id, completed: false }), send: async name => { sent.push(name); },
    });
    assert.deepEqual(sent, ['owner']);
    assert.equal((await store.delivery('owner', edition))?.status, 'sent');
  });

  test(`${kind}: opting out or changing the chosen time during a queued reminder prevents the old send`, async () => {
    const store = create(), sent: string[] = [];
    await store.save('off', preference, 't3_game', before, 0);
    await store.save('changed', preference, 't3_game', before, 0);
    await dispatchDailyReminders({
      store, now: () => due,
      recipient: async id => {
        if (id === 'off') await store.erase(id);
        else await store.save(id, { ...preference, time: '19:00' }, 't3_game', due, 0);
        return { name: id, completed: false };
      },
      send: async name => { sent.push(name); },
    });
    assert.deepEqual(sent, []);
    assert.equal(await store.read('off'), null);
    assert.equal((await store.read('changed'))?.nextAt, Date.parse('2026-11-23T19:00:00Z'));
  });

  test(`${kind}: an uncertain send is reported, never retried for that edition, and does not block the next Daily`, async () => {
    const store = create();
    let calls = 0, now = due, fail = true;
    await store.save('owner', preference, 't3_game', before, 0);
    const dispatch = () => dispatchDailyReminders({
      store, now: () => now,
      recipient: async id => ({ name: id, completed: false }),
      send: async () => { calls++;if (fail) throw new Error('Synthetic message timeout'); },
    });
    await assert.rejects(dispatch(), AggregateError);
    assert.equal((await store.delivery('owner', edition))?.status, 'failed');
    await dispatch();
    assert.equal(calls, 1);
    fail = false;
    now = new Date('2026-11-24T18:00:30Z');
    await dispatch();
    assert.equal(calls, 2);
    assert.equal((await store.delivery('owner', '2026-11-24'))?.status, 'sent');
  });

  test(`${kind}: missed windows and missing accounts do not receive stale messages`, async () => {
    const store = create(), sent: string[] = [];
    await store.save('late', preference, 't3_game', before, 0);
    await store.save('missing', { ...preference, time: '19:01' }, 't3_game', before, 0);
    await dispatchDailyReminders({
      store, now: () => new Date('2026-11-23T19:01:30Z'),
      recipient: async id => id === 'missing' ? null : { name: id, completed: false },
      send: async name => { sent.push(name); },
    });
    assert.deepEqual(sent, []);
    assert.equal((await store.delivery('late', edition))?.status, 'skipped');
    assert.equal(await store.read('missing'), null);
  });

  test(`${kind}: a stale enable request cannot restore a reminder after opting out`, async () => {
    const store = create(), generation = await store.generation('owner');
    await store.erase('owner');
    await assert.rejects(store.save('owner', preference, 't3_game', before, generation), /turned off or cleared/);
    assert.equal(await store.read('owner'), null);
    await store.save('owner', preference, 't3_game', before, await store.generation('owner'));
    assert.ok(await store.read('owner'));
  });
}

test('a slow recipient lookup cannot deliver outside the one-hour reminder window', async () => {
  const store = new MemoryReminderStore();
  let now = new Date('2026-11-23T18:59:59Z'), sent = false;
  await store.save('owner', preference, 't3_game', before, 0);
  await dispatchDailyReminders({
    store, now: () => now,
    recipient: async () => { now = new Date('2026-11-23T19:00:01Z');return { name: 'Owner', completed: false }; },
    send: async () => { sent = true; },
  });
  assert.equal(sent, false);
  assert.equal((await store.delivery('owner', edition))?.status, 'skipped');
});

test('a Redis unsubscribe that races with reservation cannot resurrect the preference or send a reminder', async () => {
  const fixture = new RankingFixture(), store = new RedisReminderStore(fixture);
  await store.save('owner', preference, 't3_game', before, 0);
  const saved = await store.read('owner');
  assert.ok(saved);
  fixture.beforeExec = () => {
    fixture.beforeExec = null;
    fixture.rawDel(['detour:daily-reminder:1:owner']);
    fixture.rawRemove('detour:daily-reminders:1:due', ['owner']);
  };
  assert.equal(await store.claim('owner', saved.revision, due, true), false);
  assert.equal(await store.read('owner'), null);
  assert.deepEqual(await store.due(due), []);
});

test('a queued send cannot cross into another UTC edition after reserving its reminder', async () => {
  const store = new MemoryReminderStore();
  let reads = 0, sent = false;
  await store.save('owner', { time: '23:59', timeZone: 'UTC' }, 't3_game', before, 0);
  await dispatchDailyReminders({
    store, now: () => new Date(++reads < 4 ? '2026-11-23T23:59:59Z' : '2026-11-24T00:00:01Z'),
    recipient: async () => ({ name: 'Owner', completed: false }),
    send: async () => { sent = true; },
  });
  assert.equal(sent, false);
  assert.equal((await store.delivery('owner', edition))?.status, 'skipped');
});

test('a failed failure-record write preserves both errors and does not retry an uncertain send', async () => {
  const store = new MemoryReminderStore(), sendError = new Error('Synthetic send failure');
  const recordError = new Error('Synthetic delivery storage failure');
  let calls = 0;
  store.finish = async () => { throw recordError; };
  await store.save('owner', preference, 't3_game', before, 0);
  const dispatch = () => dispatchDailyReminders({
    store, now: () => due, recipient: async () => ({ name: 'Owner', completed: false }),
    send: async () => { calls++;throw sendError; },
  });
  await assert.rejects(dispatch(), (error: unknown) => error instanceof AggregateError &&
    error.errors[0] instanceof AggregateError && error.errors[0].errors[0] === sendError &&
    error.errors[0].errors[1] === recordError);
  await dispatch();
  assert.equal(calls, 1);
  assert.equal((await store.delivery('owner', edition))?.status, 'attempted');
});

test('a Redis opt-out racing with the first enable watches the reset fence even when no preference exists yet', async () => {
  const fixture = new RankingFixture(), store = new RedisReminderStore(fixture);
  fixture.beforeExec = () => {
    fixture.beforeExec = null;
    fixture.rawSet('detour:daily-reminder:1:owner:generation', '1');
  };
  await assert.rejects(store.save('owner', preference, 't3_game', before, 0), /turned off or cleared/);
  assert.equal(await store.read('owner'), null);
  assert.deepEqual(await store.due(due), []);
});
