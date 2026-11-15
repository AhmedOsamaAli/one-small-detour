import { BOARD_SIZES, isAnchor, MAX_BOARD_SIZE, MAX_EXCHANGES, RuleError } from './rules.ts';
import type { AttemptStart, Bootstrap, CatalogEntry, Edition, Goal, Leaderboard, MyRank, Puzzle, RankedScore, SavedRepair, ScoreRecord, SubmitRepair, Swap } from './types.ts';
import { MAX_ATTEMPT_MS } from './timing.ts';
import { isGuideTopics } from './guidance.ts';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

function isCell(value: unknown): value is { row: number; col: number } {
  return isRecord(value) && integer(value['row'], 0, MAX_BOARD_SIZE - 1) && integer(value['col'], 0, MAX_BOARD_SIZE - 1);
}

export function isSwap(value: unknown): value is Swap {
  return isRecord(value) && isCell(value['a']) && isCell(value['b']) &&
    integer(value['rows'], 1, MAX_BOARD_SIZE) && integer(value['cols'], 1, MAX_BOARD_SIZE);
}

function isGoal(value: unknown): value is Goal {
  return isRecord(value) && typeof value['from'] === 'string' && isAnchor(value['from']) &&
    typeof value['to'] === 'string' && isAnchor(value['to']) &&
    (value['via'] === undefined || (typeof value['via'] === 'string' && isAnchor(value['via'])));
}

function isPuzzleMetadata(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value['id'] === 'string' && typeof value['title'] === 'string' &&
    typeof value['note'] === 'string' && integer(value['chapter'], 0, Number.MAX_SAFE_INTEGER) &&
    [1, 2, 4].includes(Number(value['area'])) && integer(value['area'], 1, 4) &&
    integer(value['budget'], 1, MAX_EXCHANGES) &&
    (value['minimum'] === undefined || integer(value['minimum'], 1, Number(value['budget']))) &&
    (value['theme'] === 'meadow' || value['theme'] === 'coast' || value['theme'] === 'orchard');
}

export function isCatalogEntry(value: unknown): value is CatalogEntry {
  return isPuzzleMetadata(value) && BOARD_SIZES.some((size) => size === value['size']);
}

export function isPuzzle(value: unknown): value is Puzzle {
  if (!isPuzzleMetadata(value)) return false;
  const board = value['board'];
  const journey = value['journey'];
  return Array.isArray(board) && BOARD_SIZES.some((size) => size === board.length) &&
    board.every((row: unknown) =>
      typeof row === 'string' && /^[.o~xhvABCDEF]+$/.test(row) && row.length === board.length) &&
    Array.isArray(value['goals']) && value['goals'].length > 0 && value['goals'].every(isGoal) &&
    (journey === undefined || (Array.isArray(journey) && journey.length >= 2 && journey.length <= 6 &&
      new Set(journey).size === journey.length && journey.every((anchor: unknown) =>
        typeof anchor === 'string' && isAnchor(anchor) && board.join('').includes(anchor))));
}

export function isEdition(value: unknown): value is Edition {
  return isRecord(value) && typeof value['id'] === 'string' && typeof value['date'] === 'string' &&
    integer(value['number'], 1, Number.MAX_SAFE_INTEGER) && isPuzzle(value['puzzle']);
}

export function isBootstrap(value: unknown): value is Bootstrap {
  return isRecord(value) && (value['edition'] === null || isEdition(value['edition'])) &&
    Array.isArray(value['catalog']) && value['catalog'].every(isCatalogEntry) &&
    (value['source'] === 'local' || value['source'] === 'reddit') &&
    typeof value['community'] === 'string' &&
    (value['playerName'] === null || typeof value['playerName'] === 'string') &&
    typeof value['now'] === 'string' && typeof value['nextReset'] === 'string' &&
    typeof value['seasonComplete'] === 'boolean' && isGuideTopics(value['seenGuides']);
}

export function isScoreRecord(value: unknown): value is ScoreRecord {
  return isRecord(value) && typeof value['userId'] === 'string' && value['userId'].length > 0 &&
    typeof value['name'] === 'string' && value['name'].length > 0 && value['name'].length <= 100 &&
    integer(value['footprint'], 2, MAX_EXCHANGES * 8) && integer(value['swaps'], 1, MAX_EXCHANGES) &&
    (value['solveMs'] === undefined || integer(value['solveMs'], 0, MAX_ATTEMPT_MS)) &&
    typeof value['submittedAt'] === 'string' && Number.isFinite(Date.parse(value['submittedAt']));
}

function isRankedScore(value: unknown): value is RankedScore {
  return isScoreRecord(value) && isRecord(value) && integer(value['rank'], 1, 10_000_000) &&
    typeof value['isYou'] === 'boolean';
}

const isPercentage = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100;

export function isLeaderboard(value: unknown): value is Leaderboard {
  return isRecord(value) && Array.isArray(value['entries']) && value['entries'].every(isRankedScore) &&
    integer(value['players'], 0, 10_000_000) &&
    (value['yourBest'] === null || isRankedScore(value['yourBest'])) &&
    (value['yourBest'] === null ? value['topPercent'] === null :
      integer(value['players'], 1, 10_000_000) &&
        (value['players'] === 1 ? value['topPercent'] === null : isPercentage(value['topPercent']))) &&
    (value['source'] === 'local' || value['source'] === 'reddit') &&
    (value['mode'] === 'daily' || value['mode'] === 'gentle');
}

export function isMyRank(value: unknown): value is MyRank {
  return isRecord(value) && typeof value['edition'] === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value['edition']) &&
    (value['source'] === 'local' || value['source'] === 'reddit') &&
    integer(value['participants'], 0, 10_000_000) &&
    ((value['rank'] === null && value['swaps'] === null && value['solveMs'] === null && value['topPercent'] === null) ||
      (integer(value['rank'], 1, Number(value['participants'])) && integer(value['swaps'], 1, MAX_EXCHANGES) &&
        integer(value['solveMs'], 0, MAX_ATTEMPT_MS) &&
        (value['participants'] === 1 ? value['topPercent'] === null : isPercentage(value['topPercent']))));
}

export function isSavedRepair(value: unknown): value is SavedRepair {
  return isLeaderboard(value) && isRecord(value) && isRecord(value['saved']) &&
    integer(value['saved']['swaps'], 1, MAX_EXCHANGES) &&
    (value['saved']['solveMs'] === null || integer(value['saved']['solveMs'], 0, MAX_ATTEMPT_MS));
}

export function isAttemptStart(value: unknown): value is AttemptStart {
  if (!isRecord(value) || (value['id'] !== null && (typeof value['id'] !== 'string' || !/^[a-f0-9-]{36}$/i.test(value['id']))) ||
      typeof value['edition'] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value['edition'])) return false;
  return ['startsAt', 'expiresAt', 'now'].every((field) =>
    typeof value[field] === 'string' && Number.isFinite(Date.parse(value[field]))) &&
    Date.parse(String(value['expiresAt'])) > Date.parse(String(value['startsAt']));
}

export function parseSubmission(value: unknown): SubmitRepair {
  if (!isRecord(value) || typeof value['edition'] !== 'string' ||
      (value['mode'] !== 'daily' && value['mode'] !== 'gentle') ||
      !Array.isArray(value['moves']) || value['moves'].length === 0 ||
      (value['attemptId'] !== undefined && (typeof value['attemptId'] !== 'string' || !/^[a-f0-9-]{36}$/i.test(value['attemptId']))) ||
      (value['solveId'] !== undefined && (typeof value['solveId'] !== 'string' || !/^[a-f0-9-]{36}$/i.test(value['solveId']))) ||
      value['moves'].length > MAX_EXCHANGES || !value['moves'].every(isSwap)) {
    throw new RuleError(`Send a numbered challenge and at most ${MAX_EXCHANGES} valid exchanges.`, 'invalid_submission');
  }
  return {
    edition: value['edition'], mode: value['mode'], moves: value['moves'],
    ...(typeof value['attemptId'] === 'string' ? { attemptId: value['attemptId'] } : {}),
    ...(typeof value['solveId'] === 'string' ? { solveId: value['solveId'] } : {}),
  };
}
