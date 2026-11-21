import { boardFingerprint, MAX_EXCHANGES, roadFingerprint, RULE_VERSION } from './rules.ts';
import { CHALLENGES } from './challenges.generated.ts';
import { CAMPAIGN_ADDITIONS } from './campaign.generated.ts';
import { FRAME_LESSONS } from './frameLessons.ts';
import { FRAME_CHALLENGES } from './frameChallenges.ts';
import { certifyMinimum } from './difficulty.ts';
import { generateDailyChallenge, PLACE_TITLES, seedOf } from './generation.ts';
import type { AuthoredPuzzle, CatalogEntry, Edition, Puzzle, Swap, Theme } from './types.ts';
import { dailyLandscapeTheme } from './biomes.ts';
import { REASONING_AUDIT, REASONING_CAMPAIGN } from './reasoningCampaign.generated.ts';
import { REASONING_REFINEMENTS, REFINEMENT_AUDIT } from './reasoningRefinements.generated.ts';
import { campaignPlaces } from './progression.ts';

const s = (ar: number, ac: number, br: number, bc: number, rows = 1, cols = 1): Swap => ({
  a: { row: ar - 1, col: ac - 1 }, b: { row: br - 1, col: bc - 1 }, rows, cols,
});

export const AUTHORED: readonly AuthoredPuzzle[] = [
  {
    id: 'first-light', title: 'The first little step', chapter: 1, theme: 'meadow',
    note: 'One missing stone. One small change. A way home.',
    board: ['..o...', '......', 'Ao.ooB', '......', '......', '......'],
    area: 1, budget: 1, goals: [{ from: 'A', to: 'B' }], witness: [s(1, 3, 3, 3)],
  },
  {
    id: 'change-of-course', title: 'A change of course', chapter: 2, theme: 'meadow',
    note: 'You could fix the gap. Or find a different way around it.',
    board: ['.o~...', '......', 'Ao....', '..o...', '..oooB', '......'],
    area: 2, budget: 1, goals: [{ from: 'A', to: 'B' }], witness: [s(1, 2, 3, 3, 1, 2)],
  },
  {
    id: 'pond-and-bend', title: 'The pond & the bend', chapter: 3, theme: 'coast',
    note: 'Take a whole little corner with you. Yes, even the pond.',
    board: ['Ao..o~', '....oo', '...o..', '...o..', '...ooo', '.....B'],
    area: 4, budget: 1, goals: [{ from: 'A', to: 'B' }], witness: [s(1, 5, 2, 2, 2, 2)],
  },
  {
    id: 'rose-house', title: 'A stop at Rose House', chapter: 4, theme: 'orchard',
    note: 'Visit C on your way to B. A trail never doubles back.',
    board: ['Aoo..B', '..o..o', '..C..o', '......', 'oo....', '......'],
    area: 2, budget: 1, goals: [{ from: 'A', via: 'C', to: 'B' }], witness: [s(5, 1, 3, 4, 1, 2)],
  },
  {
    id: 'good-neighbors', title: 'Good neighbors', chapter: 5, theme: 'meadow',
    note: 'Find your way home without borrowing the neighbors\' road.',
    board: ['Ao..oB', '......', '......', 'CooooD', '..oo..', '..~~..'],
    area: 4, budget: 1, goals: [{ from: 'A', to: 'B' }, { from: 'C', to: 'D' }],
    witness: [s(5, 3, 1, 3, 2, 2)],
  },
  {
    id: 'begin-again', title: 'A place to begin again', chapter: 6, theme: 'coast',
    note: 'A little parking place makes the second exchange possible.',
    board: ['.oo...', '......', 'Ao.o..', '...o..', '......', '...oB.'],
    area: 2, budget: 2, goals: [{ from: 'A', to: 'B' }],
    witness: [s(1, 2, 3, 2, 1, 2), s(1, 2, 5, 4, 1, 2)],
  },
  {
    id: 'scenic-route', title: 'The scenic route', chapter: 7, theme: 'orchard',
    note: 'Past the park, or by the cafe? There is more than one good way.',
    board: ['oo....', 'oC..oo', 'A~~~~B', 'oo..Do', '......', '......'],
    area: 2, budget: 1, goals: [{ from: 'A', to: 'B' }], witness: [s(1, 1, 2, 3, 1, 2)],
  },
  {
    id: 'four-little-homes', title: 'Four little homes', chapter: 8, theme: 'meadow',
    note: 'One carefully chosen corner can bring a neighborhood together.',
    board: ['AooooB', '......', '....oo', 'o.o..D', 'ooo...', '..C...'],
    area: 4, budget: 1,
    goals: [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }, { from: 'A', to: 'D' }],
    witness: [s(4, 1, 2, 3, 2, 2)],
  },
  {
    id: 'canalside', title: 'Down by the canal', chapter: 9, theme: 'coast',
    note: 'Sometimes the right frame is the tall, quiet one.',
    board: ['Ao....', '....o.', '....o.', '.ooo..', '...o..', '...oB.'],
    area: 2, budget: 1, goals: [{ from: 'A', to: 'B' }], witness: [s(2, 5, 2, 2, 2, 1)],
  },
  {
    id: 'orchard-call', title: 'Calling at the orchard', chapter: 10, theme: 'orchard',
    note: 'A parcel for C, and another for B. Keep the little trail unbroken.',
    board: ['......', '....oB', '...~..', '.oCo..', '.o..o.', 'Ao..o.'],
    area: 2, budget: 1, goals: [{ from: 'A', via: 'C', to: 'B' }],
    witness: [s(5, 5, 2, 4, 2, 1)],
  },
  {
    id: 'gentle-crossing', title: 'A gentle crossing', chapter: 11, theme: 'coast',
    note: 'The lower road already works. Leave it a little better than you found it.',
    board: ['A....B', 'o....o', 'oo..oo', '..o...', '..o.oo', 'CooooD'],
    area: 4, budget: 1, goals: [{ from: 'A', to: 'B' }, { from: 'C', to: 'D' }],
    witness: [s(4, 5, 2, 3, 2, 2)],
  },
  {
    id: 'two-deliveries', title: 'Two deliveries, one afternoon', chapter: 12, theme: 'meadow',
    note: 'Two small repairs. Neither neighborhood needs to wait for the other.',
    board: ['Ao..oB', 'oo....', '......', 'Co..oD', '....oo', '......'],
    area: 2, budget: 2, goals: [{ from: 'A', to: 'B' }, { from: 'C', to: 'D' }],
    witness: [s(2, 1, 1, 3, 1, 2), s(5, 5, 4, 3, 1, 2)],
  },
  {
    id: 'enough-room', title: 'Just enough room', chapter: 13, theme: 'orchard',
    note: 'Take the long corner home, with one little stop along the way.',
    board: ['...ooA', '...o..', '..Co..', '......', '.o...o', 'Bo...o'],
    area: 4, budget: 1, goals: [{ from: 'A', via: 'C', to: 'B' }],
    witness: [s(5, 5, 3, 1, 2, 2)],
  },
  {
    id: 'all-roads-home', title: 'All roads lead home', chapter: 14, theme: 'meadow',
    note: 'A tiny place, a few good connections, and everyone can find a way.',
    board: ['Aoo..B', '.....o', '....oo', '..o.o.', '..o.oo', 'CooooD'],
    area: 4, budget: 1,
    goals: [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }, { from: 'A', to: 'D' }],
    witness: [s(4, 5, 2, 3, 2, 2)],
  },
];

function displayTitle(id: string, title: string): string {
  // Display-only renames preserve the certified banks and saved puzzle identities.
  return id === 'routes-01' ? 'My sunrise' : title;
}

function publicPuzzle(puzzle: AuthoredPuzzle): Puzzle {
  const { witness: _witness, ...safe } = puzzle;
  return { ...safe, title: displayTitle(puzzle.id, puzzle.title), budget: MAX_EXCHANGES };
}

let seasonChecked = false;
const dailyCache = new Map<string, AuthoredPuzzle>();
let expeditions: readonly AuthoredPuzzle[] | null = null;
let campaign: readonly AuthoredPuzzle[] | null = null;
let widePractice: readonly AuthoredPuzzle[] | null = null;
let revised: readonly AuthoredPuzzle[] | null = null;

function getWidePractice(): readonly AuthoredPuzzle[] {
  if (!widePractice) {
    const places: { title: string; minimum: number; theme: Theme }[] = [
      { title: 'The wider meadow', minimum: 10, theme: 'meadow' },
      { title: 'The old river crossing', minimum: 12, theme: 'coast' },
      { title: 'The far orchard', minimum: 15, theme: 'orchard' },
    ];
    const preservedCount = CHALLENGES.length + getExpeditions().length + CAMPAIGN_ADDITIONS.length;
    widePractice = places.map((place, index) => {
      const id = `wide-practice-v${RULE_VERSION}-${index + 1}`;
      return {
        ...generateDailyChallenge({
          id, title: place.title, minimum: place.minimum, size: 12,
          seed: seedOf(`detour:${id}`), chapter: preservedCount + index + 1,
        }),
        theme: place.theme,
      };
    });
  }
  return widePractice;
}

export function getExpeditions(): readonly AuthoredPuzzle[] {
  if (!expeditions) {
    const destinations: { theme: Theme; title: string; minimum: number }[] = [
      { theme: 'meadow', title: 'The boulder garden', minimum: 7 },
      { theme: 'coast', title: 'The winding waterway', minimum: 10 },
      { theme: 'orchard', title: 'The grand expedition', minimum: 15 },
    ];
    expeditions = destinations.map((destination, index) => {
      const id = `expedition-v${RULE_VERSION}-${destination.theme}`;
      const puzzle = generateDailyChallenge({
        id, title: destination.title, minimum: destination.minimum,
        seed: seedOf(id), chapter: CHALLENGES.length + index + 1,
      });
      return { ...puzzle, theme: destination.theme };
    });
  }
  return expeditions;
}

export function getSeasonPuzzles(): readonly AuthoredPuzzle[] {
  if (!seasonChecked) {
    const seen = new Set<string>();
    for (const puzzle of CHALLENGES) {
      if (certifyMinimum(puzzle) !== puzzle.minimum) throw new Error(`Unverified minimum for ${puzzle.id}.`);
      const fingerprint = boardFingerprint(puzzle.board);
      if (seen.has(fingerprint)) throw new Error('Daily landscapes must be distinct.');
      seen.add(fingerprint);
    }
    seasonChecked = true;
  }
  return CHALLENGES;
}

export function getLegacyPuzzles(): readonly AuthoredPuzzle[] {
  if (!campaign) {
    const puzzles = [...getSeasonPuzzles(), ...getExpeditions(), ...CAMPAIGN_ADDITIONS, ...getWidePractice(), ...FRAME_LESSONS, ...FRAME_CHALLENGES];
    const ids = new Set<string>();
    const roads = new Set<string>();
    for (const puzzle of puzzles) {
      if (ids.has(puzzle.id) || roads.has(roadFingerprint(puzzle.board))) {
        throw new Error(`Repeated campaign place: ${puzzle.id}.`);
      }
      if (certifyMinimum(puzzle) !== puzzle.minimum) throw new Error(`Unverified campaign minimum: ${puzzle.id}.`);
      ids.add(puzzle.id);
      roads.add(roadFingerprint(puzzle.board));
    }
    campaign = puzzles;
  }
  return campaign;
}

export function getPuzzles(revision: 1 | 2 = 1): readonly AuthoredPuzzle[] {
  if (revision === 1) return getLegacyPuzzles();
  if (!revised) {
    if (REASONING_CAMPAIGN.length !== 1000 || REASONING_AUDIT.count !== 1000 ||
        REFINEMENT_AUDIT.baseSha256 !== REASONING_AUDIT.sha256 || REFINEMENT_AUDIT.count !== REASONING_REFINEMENTS.length) {
      throw new Error('The revised Practice bank is incomplete.');
    }
    const previous = new Map(REASONING_CAMPAIGN.map(puzzle => [puzzle.id, puzzle])), refinements = new Map<string, AuthoredPuzzle>();
    for (const puzzle of REASONING_REFINEMENTS) {
      const original = puzzle.legacyId ? previous.get(puzzle.legacyId) : undefined;
      if (!original || puzzle.campaignSlot !== original.campaignSlot || refinements.has(original.id) || previous.has(puzzle.id)) {
        throw new Error('The refined Practice manifest is inconsistent.');
      }
      refinements.set(original.id, puzzle);
    }
    const places = REASONING_CAMPAIGN.map(puzzle => refinements.get(puzzle.id) ?? puzzle);
    const active = new Set<string>();
    for (const [slot, puzzle] of places.entries()) {
      if (puzzle.campaignSlot !== slot || active.has(puzzle.id) || puzzle.minimum !== puzzle.witness.length) {
        throw new Error('The revised Practice manifest is inconsistent.');
      }
      active.add(puzzle.id);
    }
    const originalSlots = new Map(campaignPlaces(getCatalog(1)).map((place, index) => [place.id, index]));
    const originals = new Map([...getLegacyPuzzles(), ...REASONING_CAMPAIGN].map(puzzle => [puzzle.id, puzzle]));
    revised = [...places, ...[...originals.values()].filter(puzzle => !active.has(puzzle.id)).map(puzzle => ({ ...puzzle, archived: true }))]
      .map(puzzle => {
        const originalSlot = originalSlots.get(puzzle.id);
        return originalSlot === undefined ? puzzle : { ...puzzle, originalSlot };
      });
  }
  return revised;
}

export const SEASON_START = '2026-11-11';
export const STARTER_DAILY_START = '2026-11-16';
const DAY = 86_400_000;

export function dailyMinimum(dateId: string): number {
  const day = Math.floor((Date.parse(`${dateId}T00:00:00Z`) - Date.parse(`${STARTER_DAILY_START}T00:00:00Z`)) / DAY);
  if (!Number.isInteger(day) || day < 0) throw new Error('The gradual Daily schedule starts on 2026-11-16.');
  let minimum = 3;
  for (let offset = 1; offset <= day; offset++) {
    const choices = offset < 7 ? [3, 3, 4, 4, 5] : offset < 14 ? [3, 4, 4, 5, 5, 6, 7] :
      [3, 4, 4, 5, 5, 6, 6, 7, 8, 10];
    const date = new Date(Date.parse(`${STARTER_DAILY_START}T00:00:00Z`) + offset * DAY).toISOString().slice(0, 10);
    const seed = seedOf(`detour:difficulty-v1:${date}`);
    const target = offset % 7 === 6 ? 3 + seed % 2 : choices[seed % choices.length];
    if (target === undefined) throw new Error('The Daily difficulty schedule has no candidate.');
    minimum = Math.max(minimum - 2, Math.min(minimum + 2, target));
  }
  return minimum;
}

export function puzzleDate(id: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return null;
  const date = new Date(`${id}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === id ? date : null;
}

export function dailyPuzzleForDate(date: Date): AuthoredPuzzle | null {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid puzzle date.');
  const id = date.toISOString().slice(0, 10);
  const index = Math.floor((Date.parse(`${id}T00:00:00Z`) - Date.parse(`${SEASON_START}T00:00:00Z`)) / DAY);
  if (index < 0) return null;
  const cached = dailyCache.get(id);
  if (cached) return cached;
  const weekly = [2, 3, 4, 5, 7, 10, 15];
  const starter = id >= STARTER_DAILY_START;
  const minimum = starter ? dailyMinimum(id) : index === 0 ? 1 : weekly[(index - 1) % weekly.length] ?? 2;
  const puzzle = generateDailyChallenge({
    id: `daily-v${RULE_VERSION}-${id}`,
    title: PLACE_TITLES[index % PLACE_TITLES.length] ?? 'A different way home',
    minimum,
    seed: seedOf(`detour:journey-v${RULE_VERSION}:${id}`), chapter: index + 1,
  });
  puzzle.theme = dailyLandscapeTheme(id, puzzle.theme);
  dailyCache.set(id, puzzle);
  if (dailyCache.size > 48) {
    const oldest = dailyCache.keys().next().value;
    if (oldest) dailyCache.delete(oldest);
  }
  return puzzle;
}

export function editionForDate(date: Date): Edition | null {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid puzzle date.');
  const dateId = date.toISOString().slice(0, 10);
  const index = Math.floor((Date.parse(`${dateId}T00:00:00Z`) - Date.parse(`${SEASON_START}T00:00:00Z`)) / DAY);
  const puzzle = dailyPuzzleForDate(date);
  return puzzle ? { id: dateId, number: index + 1, date: dateId, puzzle: publicPuzzle(puzzle) } : null;
}

export function editionById(id: string): Edition | null {
  const date = puzzleDate(id);
  return date ? editionForDate(date) : null;
}

export function findPuzzle(id: string, revision: 1 | 2 = 1): Puzzle | null {
  const puzzle = getPuzzles(revision).find((item) => item.id === id);
  return puzzle ? publicPuzzle(puzzle) : null;
}

export function getCatalog(revision: 1 | 2 = 1): CatalogEntry[] {
  return getPuzzles(revision).map(({ id, title, note, theme, chapter, area, board, minimum, frame, practiceAfter, campaignSlot, originalSlot, legacyId, archived, challengeTier }) => ({
    id, title: displayTitle(id, title), note, theme, chapter, area, budget: MAX_EXCHANGES, size: board.length,
    ...(minimum === undefined ? {} : { minimum }),
    ...(frame === undefined ? {} : { frame }),
    ...(practiceAfter === undefined ? {} : { practiceAfter }),
    ...(campaignSlot === undefined ? {} : { campaignSlot }),
    ...(originalSlot === undefined ? {} : { originalSlot }),
    ...(legacyId === undefined ? {} : { legacyId }),
    ...(archived === undefined ? {} : { archived }),
    ...(challengeTier === undefined ? {} : { challengeTier }),
  }));
}

export function nextReset(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)).toISOString();
}
