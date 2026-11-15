import test from 'node:test';
import assert from 'node:assert/strict';
import { isGuideTopics, mergeGuideTopics, newTileGuides } from './guidance.ts';
import { TUTORIAL, TUTORIAL_MOVES, TUTORIAL_START_SHAPE, tutorialStage } from './tutorial.ts';
import { applySwap, checkPuzzle, rulesFor, shapesFor } from './rules.ts';

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
