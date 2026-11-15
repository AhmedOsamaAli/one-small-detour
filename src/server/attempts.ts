import { RuleError } from '../shared/rules.ts';
import { isRecord } from '../shared/validation.ts';
import { MAX_ATTEMPT_MS, TIMED_SCORE_VERSION } from '../shared/timing.ts';

export const ATTEMPTS_PER_PLAYER = 8;

export interface AttemptRecord {
  id: string;
  userId: string;
  edition: string;
  rulesVersion: string;
  scoreVersion: string;
  startsAt: number;
  expiresAt: number;
}

export interface AttemptCompletion {
  solveId: string;
  movesHash: string;
  solveMs: number;
}

export interface AttemptStore {
  create(attempt: AttemptRecord): Promise<void>;
  get(id: string): Promise<AttemptRecord | null>;
  complete(id: string, completion: AttemptCompletion): Promise<AttemptCompletion>;
  erase(userId: string): Promise<void>;
}

export function isAttemptRecord(value: unknown): value is AttemptRecord {
  return isRecord(value) && typeof value['id'] === 'string' && /^[a-f0-9-]{36}$/i.test(value['id']) &&
    typeof value['userId'] === 'string' && value['userId'].length > 0 &&
    typeof value['edition'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value['edition']) &&
    typeof value['rulesVersion'] === 'string' && value['scoreVersion'] === TIMED_SCORE_VERSION &&
    typeof value['startsAt'] === 'number' && Number.isSafeInteger(value['startsAt']) &&
    typeof value['expiresAt'] === 'number' && Number.isSafeInteger(value['expiresAt']) &&
    value['expiresAt'] > value['startsAt'];
}

export function isAttemptCompletion(value: unknown): value is AttemptCompletion {
  return isRecord(value) && typeof value['solveId'] === 'string' && /^[a-f0-9-]{36}$/i.test(value['solveId']) &&
    typeof value['movesHash'] === 'string' && /^[a-f0-9]{64}$/.test(value['movesHash']) &&
    typeof value['solveMs'] === 'number' && Number.isInteger(value['solveMs']) &&
    value['solveMs'] >= 0 && value['solveMs'] <= MAX_ATTEMPT_MS;
}

export class MemoryAttemptStore implements AttemptStore {
  private readonly records = new Map<string, { attempt: AttemptRecord; completions: Map<string, AttemptCompletion> }>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async create(attempt: AttemptRecord): Promise<void> {
    for (const [id, entry] of this.records) {
      if (entry.attempt.expiresAt <= this.now()) this.records.delete(id);
    }
    const earlier = [...this.records.values()].filter((entry) => entry.attempt.userId === attempt.userId);
    while (earlier.length >= ATTEMPTS_PER_PLAYER) {
      const oldest = earlier.shift();
      if (oldest) this.records.delete(oldest.attempt.id);
    }
    this.records.set(attempt.id, { attempt, completions: new Map() });
  }

  async get(id: string): Promise<AttemptRecord | null> {
    const entry = this.records.get(id);
    if (!entry) return null;
    if (entry.attempt.expiresAt <= this.now()) { this.records.delete(id); return null; }
    return entry.attempt;
  }

  async complete(id: string, completion: AttemptCompletion): Promise<AttemptCompletion> {
    const entry = this.records.get(id);
    if (!entry || entry.attempt.expiresAt <= this.now()) {
      throw new RuleError('This timed attempt expired. Restart to begin a new countdown.', 'attempt_expired');
    }
    const existing = entry.completions.get(completion.solveId);
    if (existing) {
      if (existing.movesHash !== completion.movesHash) {
        throw new RuleError('That solve was already recorded with different exchanges.', 'solve_mismatch');
      }
      return existing;
    }
    entry.completions.set(completion.solveId, completion);
    return completion;
  }

  async erase(userId: string): Promise<void> {
    for (const [id, entry] of this.records) {
      if (entry.attempt.userId === userId) this.records.delete(id);
    }
  }
}
