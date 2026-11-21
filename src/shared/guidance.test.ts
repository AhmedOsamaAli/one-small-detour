import test from 'node:test';
import assert from 'node:assert/strict';
import { isGuideTopics, mergeGuideTopics, newTileGuides } from './guidance.ts';
import { guidePatchStart, pendingTutorialProbe, TUTORIAL, TUTORIAL_LESSONS, TUTORIAL_MOVES, TUTORIAL_START_SHAPE, tutorialStage } from './tutorial.ts';
import { applySwap, canTraverse, checkPuzzle, inspectPatch, patchCells, rulesFor, shapesFor, tileAt } from './rules.ts';

test('guide choices accept only the fixed topics, without duplicates or arbitrary user data', () => {
  assert.equal(isGuideTopics([]), true);
  assert.equal(isGuideTopics(['basics', 'rocks', 'bridges']), true);
  for (const invalid of [['basics', 'basics'], ['unknown'], [1], null, {}, 'basics']) {
    assert.equal(isGuideTopics(invalid), false);
  }
});

test('merging remembered guides preserves all choices in a stable order', () => {
  assert.deepEqual(mergeGuideTopics(['bridges', 'basics'], ['rocks', 'basics']), ['basics', 'rocks', 'bridges']);
  assert.deepEqual(mergeGuideTopics([], ['rocks']), ['rocks']);
});

test('advanced rules are introduced only when present and not already acknowledged', () => {
  assert.deepEqual(newTileGuides(['Ao.B', '....', '....', '....'], []), []);
  const board = ['Ax.B', '.h..', '..v.', '....'];
  assert.deepEqual(newTileGuides(board, []), ['rocks', 'bridges']);
  assert.deepEqual(newTileGuides(board, ['basics', 'rocks']), ['bridges']);
  assert.deepEqual(newTileGuides(board, ['rocks', 'bridges']), []);
});

test('the hands-on lesson requires three real exchanges, including changing both frame orientations', () => {
  const move = TUTORIAL_MOVES[0];
  assert.equal(tutorialStage(TUTORIAL_START_SHAPE, null, false), 'frame');
  assert.ok(shapesFor(TUTORIAL.area).some((shape) => shape.rows === move.rows && shape.cols === move.cols));
  assert.equal(tutorialStage(move, null, false), 'first');
  assert.equal(tutorialStage(move, move.a, false), 'second');
  assert.equal(checkPuzzle(TUTORIAL.board, TUTORIAL).solved, false);
  let board = TUTORIAL.board;
  TUTORIAL_MOVES.forEach((repair, index) => {
    board = applySwap(board, repair, rulesFor(TUTORIAL, 'daily'), index);
    assert.equal(checkPuzzle(board, TUTORIAL).solved, index === TUTORIAL_MOVES.length - 1);
  });
  assert.equal(tutorialStage(move, null, false, TUTORIAL_MOVES[1]), 'frame');
  assert.equal(tutorialStage(TUTORIAL_START_SHAPE, null, true), 'home');
  assert.throws(() => tutorialStage(move, null, false, null), /ended before/);
});

  test('every guided chapter needs its real exchanges and ends with a complete ordered journey', () => {
    for (const lesson of TUTORIAL_LESSONS) {
      if (!lesson.moves.length) continue;
      let board = lesson.puzzle.board;
      assert.equal(checkPuzzle(board, lesson.puzzle).solved, false);
      lesson.moves.forEach((move, used) => {
        board = applySwap(board, move, rulesFor(lesson.puzzle, 'daily'), used);
        assert.equal(checkPuzzle(board, lesson.puzzle).solved, used === lesson.moves.length - 1);
      });
      const journey = checkPuzzle(board, lesson.puzzle).journey;
      assert.deepEqual(journey?.stops.map((stop) => stop.anchor), lesson.puzzle.journey);
      assert.equal(new Set(journey?.path.map((cell) => `${cell.row}:${cell.col}`)).size, journey?.path.length);
    }
  });

  test('the first chapter exchanges water rather than deleting it and the second checks actual immovable tiles', () => {
    const lesson = TUTORIAL_LESSONS[1];
    assert.ok(lesson);
    const firstProbe = pendingTutorialProbe(lesson, 0, []);
    assert.ok(firstProbe);
    assert.equal(inspectPatch(lesson.puzzle.board, firstProbe.cell, { rows: 1, cols: 1 })?.code, 'home');
    const secondProbe = pendingTutorialProbe(lesson, 0, [firstProbe.id]);
    assert.ok(secondProbe);
    assert.equal(inspectPatch(lesson.puzzle.board, secondProbe.cell, { rows: 1, cols: 1 })?.code, 'boulder');
    assert.equal(pendingTutorialProbe(lesson, 0, [firstProbe.id, secondProbe.id]), null);
    const [first, move] = TUTORIAL_MOVES;
    assert.ok(first && move);
    const before = applySwap(TUTORIAL.board, first, rulesFor(TUTORIAL, 'daily'));
    const solved = applySwap(before, move, rulesFor(TUTORIAL, 'daily'), 1);
    for (const cell of patchCells(move.a, move)) assert.equal(tileAt(solved, cell), '~');
    for (const cell of patchCells(move.b, move)) assert.equal(tileAt(solved, cell), 'o');
    assert.equal(tileAt(lesson.puzzle.board, firstProbe.cell), 'A');
    assert.equal(tileAt(lesson.puzzle.board, secondProbe.cell), 'x');
    assert.equal(lesson.moves.length, 0);
  });

  test('the bridge chapter contrasts direct house connections with an adjacent sideways bridge that fails', () => {
    const lesson = TUTORIAL_LESSONS[2];
    assert.ok(lesson);
    const [first, second] = lesson.moves;
    assert.ok(first && second);
    assert.equal(pendingTutorialProbe(lesson, 0, []), null);
    const partial = applySwap(lesson.puzzle.board, first, rulesFor(lesson.puzzle, 'daily'));
    const house = { row: 1, col: 5 }, left = { row: 1, col: 4 }, below = { row: 2, col: 5 };
    assert.equal(tileAt(partial, left), 'h');
    assert.equal(canTraverse(partial, left, house), true);
    assert.equal(canTraverse(partial, house, left), true);
    assert.equal(tileAt(partial, below), 'h');
    assert.equal(canTraverse(partial, below, house), false);
    assert.equal(canTraverse(partial, house, below), false);
    assert.deepEqual(pendingTutorialProbe(lesson, 1, [])?.cell, below);
    const solved = applySwap(partial, second, rulesFor(lesson.puzzle, 'daily'), 1);
    assert.equal(tileAt(solved, below), 'v');
    assert.equal(canTraverse(solved, below, house), true);
    assert.equal(canTraverse(solved, house, below), true);
    assert.equal(tileAt(solved, second.a), 'h');
    assert.equal(canTraverse(solved, below, { row: 2, col: 4 }), false);
  });

  test('every tile in a preoutlined guided patch selects the same anchor without guessing other patches', () => {
    for (const move of [
      TUTORIAL_MOVES[0], TUTORIAL_MOVES[1],
      { rows: 3, cols: 2, kind: 'ell' as const, a: { row: 0, col: 0 }, b: { row: 0, col: 4 } },
    ]) {
      for (const cell of patchCells(move.a, move)) {
        assert.deepEqual(guidePatchStart(cell, move, null), move.a);
        assert.deepEqual(guidePatchStart(cell, move, move.a), move.a);
      }
      for (const cell of patchCells(move.b, move)) assert.deepEqual(guidePatchStart(cell, move, move.a), move.b);
      const outside = { row: 5, col: 5 };
      assert.deepEqual(guidePatchStart(outside, move, null), outside);
    }
    const ell = { rows: 3, cols: 2, kind: 'ell' as const, a: { row: 0, col: 0 }, b: { row: 0, col: 4 } };
    assert.deepEqual(guidePatchStart({ row: 0, col: 1 }, ell, null), { row: 0, col: 1 });
  });
