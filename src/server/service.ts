import { Hono } from 'hono';
import { createHash, randomUUID } from 'node:crypto';
import { editionById, editionForDate, findPuzzle, getCatalog, nextReset, puzzleDate } from '../shared/puzzles.ts';
import { RULE_VERSION, RuleError, validateRepair } from '../shared/rules.ts';
import { isRecord, parseSubmission } from '../shared/validation.ts';
import { COUNTDOWN_MS, firstDailyResultOnly, MAX_ATTEMPT_MS, TIMED_SCORE_VERSION } from '../shared/timing.ts';
import type { AttemptStore } from './attempts.ts';
import type { GuideStore } from './guides.ts';
import { isGuideTopics } from '../shared/guidance.ts';
import type { Leaderboard, Mode, Player, RankedScore, ScoreRecord } from '../shared/types.ts';
import type { DailyRankingStore } from './indexedRanking.ts';
import type { DailyWrite, FirstDailyStatus } from './firstDaily.ts';
import { isPracticeState, normalizePracticeState, projectPracticeSnapshot } from '../shared/practiceProgress.ts';
import type { PracticeStore } from './practiceProgress.ts';
import { isDailyReminderPreference } from '../shared/reminders.ts';
import { dailyReminderSettings } from './reminders.ts';
import type { ReminderStore } from './reminders.ts';

export interface ScoreStore {
  list(key: string): Promise<ScoreRecord[]>;
  put(key: string, record: ScoreRecord, solveId?: string): Promise<DailyWrite | void>;
  firstStatus?(key: string, userId: string): Promise<FirstDailyStatus>;
  erase(userId: string): Promise<void>;
}

export interface GameServiceOptions {
  store: ScoreStore;
  attempts: AttemptStore;
  guides: GuideStore;
  source: 'local' | 'reddit';
  community: () => string;
  player: (request: Request) => Promise<Player | null>;
  now?: () => Date;
  accountExists?: (userId: string) => Promise<boolean>;
  dailyRanking?: DailyRankingStore;
  practice?: PracticeStore;
  reminders?: ReminderStore;
  postId?: () => string | undefined;
}

function campaignRevision(url: string): 1 | 2 | 3 {
  const revision = new URL(url).searchParams.get('campaign');
  if (revision === null || revision === '1') return 1;
  if (revision === '2') return 2;
  if (revision === '3') return 3;
  throw new RuleError('This Practice campaign version is not supported. Refresh the game.', 'campaign_version');
}

export function scoreKey(edition: string, mode: Mode, version = mode === 'daily' ? TIMED_SCORE_VERSION : RULE_VERSION): string {
  return `detour:${version}:${edition}:${mode}`;
}

export function scoreField(record: ScoreRecord): string {
  const base = `${record.userId}:${record.footprint}:${record.swaps}`;
  return record.solveMs === undefined ? base : `${base}:${record.solveMs}`;
}

export function rankScores(records: readonly ScoreRecord[], userId: string | null, source: 'local' | 'reddit', mode: Mode = 'daily'): Leaderboard {
  const compare = (a: ScoreRecord, b: ScoreRecord): number => {
    if (mode === 'gentle') return a.footprint - b.footprint || a.swaps - b.swaps;
    if ((a.solveMs === undefined) !== (b.solveMs === undefined)) {
      throw new Error('Timed and untimed daily scores cannot share a ranking.');
    }
    return a.swaps - b.swaps || (a.solveMs !== undefined && b.solveMs !== undefined ? a.solveMs - b.solveMs : 0) ||
      a.footprint - b.footprint;
  };
  const best = new Map<string, ScoreRecord>();
  for (const record of records) {
    const previous = best.get(record.userId);
    if (!previous || compare(record, previous) < 0) best.set(record.userId, record);
  }
  const sorted = [...best.values()].sort((a, b) =>
    compare(a, b) || a.submittedAt.localeCompare(b.submittedAt));
  let currentRank = 0;
  const ranked: RankedScore[] = sorted.map((record, index) => {
    const previous = sorted[index - 1];
    if (!previous || compare(previous, record) !== 0) currentRank = index + 1;
    return { ...record, rank: currentRank, isYou: record.userId === userId };
  });
  const yourBest = ranked.find((record) => record.isYou) ?? null;
  const topPercent = yourBest && ranked.length > 1
    ? ranked.filter((record) => compare(record, yourBest) <= 0).length * 100 / ranked.length
    : null;
  return { entries: ranked.slice(0, 20), players: ranked.length, yourBest, topPercent, source, mode };
}

export function createGameApi(options: GameServiceOptions): Hono {
  const api = new Hono();
  const clock = options.now ?? (() => new Date());
  const checkedAt = new Map<string, number>();
  const erasePlayer = async (userId: string): Promise<void> => {
    await options.reminders?.erase(userId);
    await options.dailyRanking?.erase(userId);
    await options.attempts.erase(userId);
    await options.store.erase(userId);
    await options.guides.erase(userId);
  };
  const recordsFor = async (key: string): Promise<ScoreRecord[]> => {
    const records = await options.store.list(key);
    if (key.startsWith(`detour:${TIMED_SCORE_VERSION}:`) && key.endsWith(':daily') && records.some((record) => record.solveMs === undefined)) {
      throw new Error('An untimed result was found in the timed daily ranking.');
    }
    if (!options.accountExists) return records;
    const ids = [...new Set(records.map((record) => record.userId))];
    const deleted = new Set<string>();
    for (const id of ids) {
      if ((checkedAt.get(id) ?? 0) > clock().getTime() - 300_000) continue;
      if (!(await options.accountExists(id))) {
        await erasePlayer(id);
        deleted.add(id);
      } else {
        checkedAt.set(id, clock().getTime());
      }
    }
    return records.filter((record) => !deleted.has(record.userId));
  };
  const resolveEdition = (id: string) => {
    const date = puzzleDate(id);
    if (!date) throw new RuleError('Choose a valid daily edition.', 'edition');
    const age = clock().getTime() - Date.parse(`${id}T00:00:00Z`);
    if (age < 0) throw new RuleError('That daily challenge has not opened yet. Explore it in the unranked atlas.', 'future');
    if (age > 30 * 86_400_000) throw new RuleError('That challenge is now an unranked archive. Your local completion still counts.', 'archived');
    const edition = editionById(id);
    if (!edition) throw new RuleError('That challenge has not opened yet.', 'edition');
    return edition;
  };
  const boardFor = async (key: string, mode: Mode, userId: string | null, includeLeaders = false): Promise<Leaderboard> =>
    mode === 'daily' && options.dailyRanking ? options.dailyRanking.read(key, userId, includeLeaders) :
      rankScores(await recordsFor(key), userId, options.source, mode);

  api.onError((error, c) => {
    if (error instanceof RuleError) {
      const temporary = error.code === 'ranking_busy' || error.code === 'ranking_indexing' ||
        error.code === 'practice_busy' || error.code === 'reminder_busy';
      if (error.code === 'practice_reset' || error.code === 'reminder_reset') return c.json({ error: error.message, code: error.code }, 409);
      if (temporary) c.header('Retry-After', '1');
      return c.json({ error: error.message, code: error.code }, temporary ? 503 : 400);
    }
    console.error(`Detour API ${c.req.method} ${c.req.path} failed:`, error);
    return c.json({ error: 'The village board could not be reached. Your puzzle is safe; please try again.', code: 'service_error' }, 503);
  });

  api.get('/api/bootstrap', async (c) => {
    const now = clock();
    const revision = campaignRevision(c.req.url);
    const player = await options.player(c.req.raw);
    const seenGuides = player ? await options.guides.seen(player.id) : [];
    return c.json({
      edition: editionForDate(now),
      catalog: getCatalog(revision),
      campaignRevision: revision,
      source: options.source,
      community: options.community(),
      playerName: player?.name ?? null,
      now: now.toISOString(),
      nextReset: nextReset(now),
      seasonComplete: false,
      seenGuides,
    });
  });

  api.post('/api/me/guides', async (c) => {
    const player = await options.player(c.req.raw);
    if (!player) return c.json({ error: 'Sign in to sync your guide preferences.', code: 'sign_in' }, 401);
    let input: unknown;
    try { input = await c.req.json<unknown>(); }
    catch (error) {
      if (error instanceof SyntaxError) throw new RuleError('The guide choice could not be read.', 'invalid_json');
      throw error;
    }
    if (!isRecord(input) || !isGuideTopics(input['topics']) || input['topics'].length === 0) {
      throw new RuleError('Choose a valid guide topic.', 'guide_topic');
    }
    await options.guides.markSeen(player.id, input['topics']);
    return c.json({ seenGuides: await options.guides.seen(player.id) });
  });

  api.all('/api/me/reminder', async (c) => {
    c.header('Cache-Control', 'no-store');
    const player = await options.player(c.req.raw);
    if (!player) return c.json({ error: 'Sign in to Reddit to manage daily inbox reminders.', code: 'sign_in' }, 401);
    const reminders = options.reminders;
    if (!reminders) return c.json({ error: 'Daily reminders are temporarily unavailable. Please try again.', code: 'reminder_unavailable' }, 503);
    if (c.req.method === 'GET') return c.json(await dailyReminderSettings(reminders, player.id, options.source, clock()));
    if (c.req.method === 'DELETE') {
      await reminders.erase(player.id);
      return c.json(await dailyReminderSettings(reminders, player.id, options.source, clock()));
    }
    if (c.req.method !== 'PUT') return c.json({ error: 'Choose a supported reminder action.', code: 'method' }, 405);
    let input: unknown;
    try { input = await c.req.json<unknown>(); }
    catch (error) {
      if (error instanceof SyntaxError) throw new RuleError('The reminder choice could not be read.', 'invalid_json');
      throw error;
    }
    if (!isRecord(input) || !isDailyReminderPreference(input) || typeof input['generation'] !== 'number' ||
        !Number.isSafeInteger(input['generation']) || input['generation'] < 0) {
      throw new RuleError('Choose a valid reminder time and timezone after checking your current reminder.', 'reminder_invalid');
    }
    const postId = options.postId?.() ?? null;
    if (options.source === 'reddit' && (postId === null || !/^t3_[a-z0-9]+$/i.test(postId))) {
      throw new RuleError('Open the game from its Reddit post before enabling reminders.', 'reminder_post');
    }
    await reminders.save(player.id, { time: input.time, timeZone: input.timeZone }, postId, clock(), input['generation']);
    return c.json(await dailyReminderSettings(reminders, player.id, options.source, clock()));
  });

  api.all('/api/me/progress', async (c) => {
    const catalog = getCatalog(campaignRevision(c.req.url));
    const player = await options.player(c.req.raw);
    if (!player) return c.json({ error: 'Sign in to Reddit to sync your Practice stops across devices.', code: 'sign_in' }, 401);
    const store = options.practice;
    if (!store) return c.json({ error: 'Practice sync is temporarily unavailable. Your local stops are safe.', code: 'practice_unavailable' }, 503);
    const owner = createHash('sha256').update(`${options.source}:${options.community()}:${player.id}`).digest('hex');
    if (c.req.method === 'GET') return c.json({ owner, snapshot: projectPracticeSnapshot(catalog, await store.read(player.id)) });
    if (c.req.method === 'DELETE') return c.json({ owner, snapshot: projectPracticeSnapshot(catalog, await store.erase(player.id)) });
    if (c.req.method !== 'POST') return c.json({ error: 'Choose a supported Practice sync action.', code: 'method' }, 405);
    let input: unknown;
    try { input = await c.req.json<unknown>(); }
    catch (error) {
      if (error instanceof SyntaxError) throw new RuleError('The Practice progress could not be read.', 'invalid_json');
      throw error;
    }
    if (!isPracticeState(input) || !isRecord(input) || typeof input['generation'] !== 'number' ||
        !Number.isSafeInteger(input['generation']) || input['generation'] < 0) {
      throw new RuleError('Choose valid Practice progress to sync. Your saved progress was not replaced.', 'practice_invalid');
    }
    const scoped = normalizePracticeState(catalog, input);
    return c.json({ owner, snapshot: projectPracticeSnapshot(catalog, await store.merge(player.id, input['generation'], scoped)) });
  });

  api.get('/api/places/:id', (c) => {
    const puzzle = findPuzzle(c.req.param('id'), campaignRevision(c.req.url));
    if (!puzzle) return c.json({ error: 'That place is not in the atlas.', code: 'not_found' }, 404);
    c.header('Cache-Control', 'public, max-age=3600');
    return c.json(puzzle);
  });

  api.post('/api/attempts', async (c) => {
    let input: unknown;
    try { input = await c.req.json<unknown>(); }
    catch (error) {
      if (error instanceof SyntaxError) throw new RuleError('The countdown request could not be read.', 'invalid_json');
      throw error;
    }
    if (!isRecord(input) || typeof input['edition'] !== 'string') {
      throw new RuleError('Choose a daily edition before starting its timer.', 'edition');
    }
    const edition = resolveEdition(input['edition']);
    const player = await options.player(c.req.raw);
    const key = scoreKey(edition.id, 'daily');
    let ranking: FirstDailyStatus | 'guest' | undefined;
    if (firstDailyResultOnly(edition.id)) {
      if (!player) ranking = 'guest';
      else if (options.dailyRanking) ranking = await options.dailyRanking.firstStatus(key, player.id);
      else if (options.store.firstStatus) ranking = await options.store.firstStatus(key, player.id);
      else throw new Error('First-result Daily storage has not been configured.');
    }
    const now = clock().getTime();
    const startsAt = now + COUNTDOWN_MS;
    const expiresAt = startsAt + MAX_ATTEMPT_MS;
    const id = player && ranking !== 'replay' && ranking !== 'removed' ? randomUUID() : null;
    if (id && player) {
      await options.attempts.create({
        id, userId: player.id, edition: edition.id, rulesVersion: RULE_VERSION,
        scoreVersion: TIMED_SCORE_VERSION, startsAt, expiresAt,
      });
    }
    return c.json({
      id, edition: edition.id, startsAt: new Date(startsAt).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(), now: new Date(now).toISOString(),
      ...(ranking ? { ranking } : {}),
    });
  });

  api.get('/api/leaderboard', async (c) => {
    const edition = resolveEdition(c.req.query('edition') ?? '');
    const mode = c.req.query('mode');
    if (mode !== 'daily' && mode !== 'gentle') throw new RuleError('Choose a valid challenge mode.', 'mode');
    const player = await options.player(c.req.raw);
    return c.json(await boardFor(scoreKey(edition.id, mode), mode, player?.id ?? null, true));
  });

  api.get('/api/my-rank', async (c) => {
    const edition = resolveEdition(c.req.query('edition') ?? '');
    const player = await options.player(c.req.raw);
    const board = await boardFor(scoreKey(edition.id, 'daily'), 'daily', player?.id ?? null);
    return c.json({
      edition: edition.id,
      rank: board.yourBest?.rank ?? null,
      swaps: board.yourBest?.swaps ?? null,
      solveMs: board.yourBest?.solveMs ?? null,
      participants: board.players,
      topPercent: board.topPercent,
      source: options.source,
    });
  });

  api.post('/api/repairs', async (c) => {
    const receivedAt = clock().getTime();
    const player = await options.player(c.req.raw);
    if (!player) return c.json({ error: 'Sign in to Reddit before adding a repair. You can still play without submitting.', code: 'sign_in' }, 401);
    let input: unknown;
    try { input = await c.req.json<unknown>(); }
    catch (error) {
      if (error instanceof SyntaxError) throw new RuleError('The request could not be read.', 'invalid_json');
      throw error;
    }
    const body = parseSubmission(input);
    const edition = resolveEdition(body.edition);
    const attempt = body.mode === 'daily' && body.attemptId ? await options.attempts.get(body.attemptId) : null;
    if (body.mode === 'daily') {
      if (!body.solveId) throw new RuleError('This daily result needs its solve identifier. Restart this attempt.', 'solve_id');
      if (!attempt) throw new RuleError('Start a timed attempt before saving this daily score. Restart to begin its countdown.', 'attempt_expired');
      if (attempt.userId !== player.id || attempt.edition !== edition.id ||
          attempt.rulesVersion !== RULE_VERSION || attempt.scoreVersion !== TIMED_SCORE_VERSION) {
        throw new RuleError('This timer belongs to a different player, edition or ranking.', 'attempt_mismatch');
      }
      if (receivedAt < attempt.startsAt) throw new RuleError('Wait for 3, 2, 1 before playing.', 'countdown');
      if (receivedAt >= attempt.expiresAt) throw new RuleError('This timed attempt expired. Restart to begin a new countdown.', 'attempt_expired');
    }
    const repair = validateRepair(edition.puzzle, body.mode, body.moves);
    let solveMs: number | undefined;
    if (attempt && body.mode === 'daily') {
      const solveId = body.solveId;
      if (!solveId) throw new RuleError('This daily result is missing its solve identifier.', 'solve_id');
      const movesHash = createHash('sha256').update(JSON.stringify(body.moves.map((move) =>
        move.kind ? [move.a.row, move.a.col, move.b.row, move.b.col, move.rows, move.cols, move.kind] :
          [move.a.row, move.a.col, move.b.row, move.b.col, move.rows, move.cols]))).digest('hex');
      const completion = await options.attempts.complete(attempt.id, { solveId, movesHash, solveMs: receivedAt - attempt.startsAt });
      solveMs = completion.solveMs;
    }
    const key = scoreKey(edition.id, body.mode);
    const record: ScoreRecord = {
      userId: player.id, name: player.name,
      footprint: repair.footprint, swaps: repair.swaps, submittedAt: new Date(receivedAt).toISOString(),
      ...(solveMs === undefined ? {} : { solveMs }),
    };
    const written = body.mode === 'daily' && options.dailyRanking
      ? await options.dailyRanking.put(key, record, body.solveId) : await options.store.put(key, record, body.solveId);
    if (body.mode === 'daily' && firstDailyResultOnly(edition.id) && !written) {
      throw new Error('The first Daily result could not be confirmed by its score store.');
    }
    return c.json({
      ...await boardFor(key, body.mode, player.id),
      saved: { swaps: repair.swaps, solveMs: solveMs ?? null },
      ...(written ? { ranking: written.ranking } : {}),
    });
  });

  api.delete('/api/me', async (c) => {
    const player = await options.player(c.req.raw);
    if (!player) return c.json({ error: 'Sign in to remove your leaderboard records.', code: 'sign_in' }, 401);
    await erasePlayer(player.id);
    return c.json({ deleted: true });
  });

  return api;
}
