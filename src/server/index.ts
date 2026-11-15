import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { context, createServer, getServerPort, reddit, redis } from '@devvit/web/server';
import { isScoreRecord } from '../shared/validation.ts';
import { getSeasonPuzzles, SEASON_START } from '../shared/puzzles.ts';
import { RULE_VERSION, RuleError } from '../shared/rules.ts';
import { MAX_ATTEMPT_MS, TIMED_SCORE_VERSION } from '../shared/timing.ts';
import { ATTEMPTS_PER_PLAYER, isAttemptCompletion, isAttemptRecord } from './attempts.ts';
import type { AttemptStore } from './attempts.ts';
import { createGameApi, scoreField, scoreKey } from './service.ts';
import type { ScoreStore } from './service.ts';
import type { Mode, ScoreRecord } from '../shared/types.ts';
import { GUIDE_TOPICS, isGuideTopic } from '../shared/guidance.ts';
import { GUIDE_PREFERENCE_TTL_SECONDS } from './guides.ts';
import type { GuideStore } from './guides.ts';

function isRedditId(id: string): id is `t2_${string}` {
  return /^t2_[a-z0-9]+$/i.test(id);
}

function parseRecords(values: Record<string, string>): ScoreRecord[] {
  return Object.values(values).map((text) => {
    const value: unknown = JSON.parse(text);
    if (!isScoreRecord(value)) throw new Error('A village-board record is invalid.');
    return value;
  });
}

const store: ScoreStore = {
  async list(key) {
    return parseRecords(await redis.hGetAll(key));
  },
  async put(key, record) {
    // Immutable score-specific fields avoid concurrent worse repairs overwriting
    // a player's better one; ranking collapses them to the genuine personal best.
    const day = key.split(':')[2];
    if (!day) throw new Error('Leaderboard key has no edition.');
    const remaining = Math.max(1, Math.ceil((Date.parse(`${day}T00:00:00Z`) + 30 * 86_400_000 - Date.now()) / 1000));
    const indexKey = `detour:player-records:${record.userId}`;
    // Index first: a successful score write must never become undiscoverable
    // when the player asks to erase records from an open-ended daily schedule.
    const prior = await redis.hGetAll(indexKey);
    const expired = Object.entries(prior).filter(([, edition]) => {
      const timestamp = Date.parse(`${edition}T00:00:00Z`);
      if (!Number.isFinite(timestamp)) throw new Error('The player record index has an invalid date.');
      return timestamp + 30 * 86_400_000 <= Date.now();
    }).map(([field]) => field);
    if (expired.length) await redis.hDel(indexKey, expired);
    await redis.hSet(indexKey, { [key]: day });
    await redis.expire(indexKey, 31 * 86_400);
    await redis.hSet(key, { [scoreField(record)]: JSON.stringify(record) });
    await redis.expire(key, remaining);
  },
  async erase(userId) {
    const indexKey = `detour:player-records:${userId}`;
    const index = await redis.hGetAll(indexKey);
    const keys = new Set<string>();
    for (const key of Object.keys(index)) {
      if (!/^detour:\d+:\d{4}-\d{2}-\d{2}:(daily|gentle)$/.test(key)) throw new Error('The player record index is invalid.');
      keys.add(key);
    }
    for (let offset = 0; offset < getSeasonPuzzles().length; offset++) {
      const date = new Date(Date.parse(`${SEASON_START}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
      const age = Date.now() - Date.parse(`${date}T00:00:00Z`);
      if (age < 0 || age > 30 * 86_400_000) continue;
      for (const version of new Set(['1', '2', '3', RULE_VERSION, TIMED_SCORE_VERSION])) {
        for (const mode of ['daily', 'gentle'] satisfies Mode[]) keys.add(scoreKey(date, mode, version));
      }
    }
    const allKeys = [...keys];
    for (let offset = 0; offset < allKeys.length; offset += 8) {
      await Promise.all(allKeys.slice(offset, offset + 8).map(async (key) => {
        const entries = await redis.hGetAll(key);
        const fields = Object.entries(entries).filter(([, text]) => {
          const value: unknown = JSON.parse(text);
          if (!isScoreRecord(value)) throw new Error('A village-board record is invalid.');
          return value.userId === userId;
        }).map(([field]) => field);
        if (fields.length) await redis.hDel(key, fields);
      }));
    }
    await redis.del(indexKey);
  },
};

const attempts: AttemptStore = {
  async create(attempt) {
    const indexKey = `detour:attempts:${attempt.userId}`;
    const entries = Object.entries(await redis.hGetAll(indexKey)).map(([id, timestamp]) => {
      if (!/^[a-f0-9-]{36}$/i.test(id) || !Number.isFinite(Number(timestamp))) throw new Error('The attempt index is invalid.');
      return { id, startsAt: Number(timestamp) };
    }).sort((a, b) => a.startsAt - b.startsAt);
    const expired = entries.filter((entry) => entry.startsAt + MAX_ATTEMPT_MS <= Date.now());
    const remaining = entries.filter((entry) => !expired.includes(entry));
    const removed = [...expired, ...remaining.slice(0, Math.max(0, remaining.length - ATTEMPTS_PER_PLAYER + 1))];
    if (removed.length) {
      await redis.hDel(indexKey, removed.map((entry) => entry.id));
      for (const entry of removed) await redis.del(`detour:attempt:${entry.id}`);
    }
    await redis.hSet(indexKey, { [attempt.id]: String(attempt.startsAt) });
    await redis.expire(indexKey, Math.ceil(MAX_ATTEMPT_MS / 1000) + 4);
    await redis.hSet(`detour:attempt:${attempt.id}`, { metadata: JSON.stringify(attempt) });
    await redis.expire(`detour:attempt:${attempt.id}`, Math.ceil((attempt.expiresAt - Date.now()) / 1000));
  },
  async get(id) {
    const text = await redis.hGet(`detour:attempt:${id}`, 'metadata');
    if (!text) return null;
    const record: unknown = JSON.parse(text);
    if (!isAttemptRecord(record) || record.id !== id) throw new Error('A stored attempt is invalid.');
    return record.expiresAt > Date.now() ? record : null;
  },
  async complete(id, completion) {
    const key = `detour:attempt:${id}`;
    const attempt = await this.get(id);
    if (!attempt) throw new Error('The timed attempt expired before its completion could be recorded.');
    const field = `solve:${completion.solveId}`;
    await redis.hSetNX(key, field, JSON.stringify(completion));
    await redis.expire(key, Math.max(1, Math.ceil((attempt.expiresAt - Date.now()) / 1000)));
    const text = await redis.hGet(key, field);
    if (!text) throw new Error('The solve timestamp could not be recorded.');
    const recorded: unknown = JSON.parse(text);
    if (!isAttemptCompletion(recorded) || recorded.solveId !== completion.solveId) throw new Error('A recorded solve timestamp is invalid.');
    if (recorded.movesHash !== completion.movesHash) {
      throw new RuleError('That solve was already recorded with different exchanges.', 'solve_mismatch');
    }
    return recorded;
  },
  async erase(userId) {
    const indexKey = `detour:attempts:${userId}`;
    const entries = await redis.hGetAll(indexKey);
    for (const id of Object.keys(entries)) {
      if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('The attempt index is invalid.');
      await redis.del(`detour:attempt:${id}`);
    }
    await redis.del(indexKey);
  },
};

const guides: GuideStore = {
  async seen(userId) {
    const choices = await redis.hGetAll(`detour:guides:${userId}`);
    if (Object.entries(choices).some(([topic, value]) => !isGuideTopic(topic) || value !== '1')) {
      throw new Error('A remembered guide preference is invalid.');
    }
    return GUIDE_TOPICS.filter((topic) => choices[topic] === '1');
  },
  async markSeen(userId, topics) {
    const key = `detour:guides:${userId}`;
    await redis.hSet(key, Object.fromEntries(topics.map((topic) => [topic, '1'])));
    await redis.expire(key, GUIDE_PREFERENCE_TTL_SECONDS);
  },
  async erase(userId) {
    await redis.del(`detour:guides:${userId}`);
  },
};

const app = createGameApi({
  store,
  attempts,
  guides,
  source: 'reddit',
  community: () => context.subredditName ? `r/${context.subredditName}` : 'This little community',
  player: async () => {
    const id = context.userId;
    if (!id || !isRedditId(id)) return null;
    const user = await reddit.getUserById(id);
    return user ? { id, name: user.username } : null;
  },
  accountExists: async (id) => isRedditId(id) && Boolean(await reddit.getUserById(id)),
});

const internal = new Hono();
internal.post('/menu/create-detour', async (c) => {
  try {
    const post = await reddit.submitCustomPost({
      title: 'One Small Detour - a little change, a different way home',
    });
    return c.json({ navigateTo: `https://www.reddit.com/r/${context.subredditName}/comments/${post.id}` });
  } catch (error) {
    console.error('Could not create the explicitly requested Detour post:', error);
    return c.json({ showToast: 'The post could not be created. Please try again.' }, 500);
  }
});
app.route('/internal', internal);

serve({ fetch: app.fetch, createServer, port: getServerPort() });
