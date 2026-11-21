import assert from 'node:assert/strict';
import test from 'node:test';
import { certifyRepairSearch } from './repairSearch.ts';
import { applySwap, checkPuzzle, legalSwaps, rulesFor } from './rules.ts';
import { FRAME_CHALLENGES } from './frameChallenges.ts';
import { FRAME_LESSONS } from './frameLessons.ts';
import type { AuthoredPuzzle, Board } from './types.ts';

function breadthFirstMinimum(puzzle: AuthoredPuzzle, maximum: number): number | null {
  const swaps = legalSwaps(puzzle.board, puzzle.area, puzzle.frame), seen = new Set([puzzle.board.join('/')]);
  let frontier: Board[] = [puzzle.board];
  for (let depth = 0; depth <= maximum; depth++) {
    const next: Board[] = [];
    for (const board of frontier) {
      if (checkPuzzle(board, puzzle).solved) return depth;
      if (depth === maximum) continue;
      for (const move of swaps) {
        const candidate = applySwap(board, move, rulesFor(puzzle, 'daily'), depth), key = candidate.join('/');
        if (!seen.has(key)) { seen.add(key);next.push(candidate); }
      }
    }
    frontier = next;
  }
  return null;
}

test('bounded repair certificates agree with independent breadth-first search on interacting shape boards', () => {
  for (const puzzle of FRAME_CHALLENGES.filter((_, index) => index % 2 === 0)) {
    assert.equal(breadthFirstMinimum(puzzle, 2), null, puzzle.id);
    const proof = certifyRepairSearch(puzzle, 20_000);
    assert.equal(proof.status, 'certified', puzzle.id);
    if (proof.status === 'certified') assert.equal(proof.minimum, 3);
  }
});

test('the repair search finds the actual shorter repair instead of approving a padded witness', () => {
  const base = FRAME_LESSONS.find(puzzle => puzzle.frame === 'square' && puzzle.minimum === 1);
  assert.ok(base);
  const move = base.witness[0];assert.ok(move);
  const puzzle = { ...base, budget: 2000, minimum: 3, witness: [move, move, move] };
  assert.equal(breadthFirstMinimum(puzzle, 1), 1);
  const proof = certifyRepairSearch(puzzle);
  assert.equal(proof.status, 'shorter');
  if (proof.status === 'shorter') assert.equal(proof.minimum, 1);
});

test('exhausting a search budget never produces an accepted certificate', () => {
  const puzzle = FRAME_CHALLENGES[0];assert.ok(puzzle);
  const proof = certifyRepairSearch(puzzle, 1);
  assert.equal(proof.status, 'limit');
  if (proof.status === 'limit') assert.ok(proof.provedThrough < puzzle.witness.length);
});

test('water and grass remain equivalent only for movement proof, without changing the authored board', () => {
  const puzzle = FRAME_CHALLENGES.find(puzzle => puzzle.board.some(row => row.includes('~')));assert.ok(puzzle);
  const before = [...puzzle.board];
  const dry = { ...puzzle, board: puzzle.board.map(row => row.replaceAll('~', '.')) };
  const a = certifyRepairSearch(puzzle), b = certifyRepairSearch(dry);
  assert.equal(a.status, b.status);
  assert.deepEqual(puzzle.board, before);
});
