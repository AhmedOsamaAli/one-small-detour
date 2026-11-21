import assert from 'node:assert/strict';
import test from 'node:test';
import { constructPatchChallenge, constructPreparedPatchChallenge } from './patchGeneration.ts';
import { certifyPatchMinimum, coverPatchStock, evaluatePatchChallenge, patchPlanningScore, patchStockInsulation } from './patchDifficulty.ts';
import { pairGeometry } from './pairDifficulty.ts';
import { PRACTICE_CURRICULUM, structuralPuzzleIdentity } from './campaignCurriculum.ts';
import { checkPuzzle, isAnchor, patchCells, shapesFor, validateRepair, walkable } from './rules.ts';

test('all four actual frame families use necessary road cargo and attain their import lower bound', () => {
  for (const [frame, minimum, seed, pairs] of [
    ['pair', 3, 5, 7], ['strip', 4, 1, 20], ['square', 4, 1, 20], ['ell', 4, 6, 20],
  ] as const) {
    const result = constructPatchChallenge(frame, minimum, seed, pairs);
    if (result.status !== 'constructed') throw new Error(`${frame}: ${result.reason}`);
    const puzzle = result.puzzle, proof = certifyPatchMinimum(puzzle), geometry = pairGeometry(puzzle);
    assert.equal(proof.minimum, minimum);
    assert.equal(proof.outsideRoadTiles, minimum * puzzle.area);
    assert.equal(proof.suppliedRoadTiles, proof.requiredRoadTiles);
    const repair = validateRepair(puzzle, 'daily', puzzle.witness);
    assert.equal(checkPuzzle(repair.board, puzzle).journey?.path.length, proof.suppliedRoadTiles + (puzzle.journey?.length ?? 0));
    const insulation = patchStockInsulation(puzzle, geometry);
    for (const [index, tile] of [...puzzle.board.join('')].entries()) {
      if (walkable(tile) && !isAnchor(tile) && !geometry.geodesic[index]) assert.equal(insulation[index], 1);
    }
    for (const move of puzzle.witness) assert.equal(patchCells(move.a, move).length, puzzle.area);
    assert.equal(puzzle.frame, frame === 'pair' ? undefined : frame);
  }
});

test('a necessary preparation move is proved by impossible source tiling, not a padded scramble', () => {
  let proved = 0;
  for (const frame of ['pair', 'strip', 'square', 'ell'] as const) {
    let found = false;
    for (let seed = 1; seed <= 40; seed++) {
      const result = constructPreparedPatchChallenge(frame, 4, seed, 20);
      if (result.status !== 'constructed') continue;
      const certificate = certifyPatchMinimum(result.puzzle);
      assert.equal(certificate.preparationMovesProved, 1);
      assert.equal(certificate.minimum, 4);
      assert.equal(certificate.outsideRoadTiles, 3 * result.puzzle.area);
      assert.equal(coverPatchStock(result.puzzle, result.puzzle.board).status, 'impossible');
      found = true; proved++; break;
    }
    assert.ok(found, `${frame}: a genuinely non-tileable preparation example must be available.`);
  }
  assert.equal(proved, 4);
});

test('the square and L preparation proof insulates the full footprint, not just immediate neighbors', () => {
  for (const frame of ['square', 'ell'] as const) {
    const result = constructPatchChallenge(frame, 3, 6, 20);
    if (result.status !== 'constructed') throw new Error(result.reason);
    const geometry = pairGeometry(result.puzzle), mask = patchStockInsulation(result.puzzle, geometry);
    for (const shape of shapesFor(4, result.puzzle.board.length, frame)) {
      for (let row = 0; row + shape.rows <= geometry.size; row++) {
        for (let col = 0; col + shape.cols <= geometry.size; col++) {
          const cells = patchCells({ row, col }, shape).map(cell => cell.row * geometry.size + cell.col);
          assert.equal(cells.some(index => mask[index] === 1) && cells.some(index => geometry.geodesic[index] === 1), false);
        }
      }
    }
  }
});

test('the final curriculum leaves room for its full L preparation quota without weakening the global grade', () => {
  const previous = PRACTICE_CURRICULUM.at(-2), last = PRACTICE_CURRICULUM.at(-1);
  assert.ok(previous && last);
  const recipes = [[900005, 22], [900007, 25], [900014, 22], [900048, 22], [900060, 22]] as const;
  assert.ok(recipes.length >= Math.ceil((last.end - previous.end) / last.frames.length / 3));
  for (const [seed, pairs] of recipes) {
    const built = constructPreparedPatchChallenge('ell', last.minimum, seed, pairs);
    if (built.status !== 'constructed') throw new Error(built.reason);
    const graded = evaluatePatchChallenge(built.puzzle);
    if (graded.status !== 'accepted') throw new Error(graded.reason);
    assert.equal(graded.evaluation.certificate.preparationMovesProved, 1);
    assert.ok(graded.evaluation.route.pressure >= previous.pressureCap);
    assert.ok(graded.evaluation.route.pressure <= last.pressureCap);
    assert.ok(patchPlanningScore(graded.evaluation) >= 8 * previous.minimum + 4 * previous.pressureCap + 12 + 4);
  }
});

test('functional duplicate identity ignores water recolours but retains real footprint and bridge changes', () => {
  const result = constructPatchChallenge('strip', 3, 6, 12);
  if (result.status !== 'constructed') throw new Error(result.reason);
  const board = result.puzzle.board, identity = structuralPuzzleIdentity(board).key;
  assert.equal(structuralPuzzleIdentity(board.map(row => row.replaceAll('~', '.'))).key, identity);
  const row = board.findIndex(line => line.includes('o')), line = board[row];
  assert.ok(line);
  const col = line.indexOf('o');
  const changed = board.map((value, index) => index === row ? value.slice(0, col) + '.' + value.slice(col + 1) : value);
  assert.notEqual(structuralPuzzleIdentity(changed).key, identity);
});
