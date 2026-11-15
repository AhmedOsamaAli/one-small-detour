import test from 'node:test';
import assert from 'node:assert/strict';
import { isGuideTopics, mergeGuideTopics, newTileGuides } from './guidance.ts';
import { TUTORIAL, TUTORIAL_MOVE, TUTORIAL_START_SHAPE, tutorialStage } from './tutorial.ts';
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

test('the hands-on lesson first requires changing the actual frame, then completes with its guided exchange', () => {
  assert.equal(tutorialStage(TUTORIAL_START_SHAPE, null, false), 'frame');
  assert.ok(shapesFor(TUTORIAL.area).some((shape) => shape.rows === TUTORIAL_MOVE.rows && shape.cols === TUTORIAL_MOVE.cols));
  assert.equal(tutorialStage(TUTORIAL_MOVE, null, false), 'first');
  assert.equal(tutorialStage(TUTORIAL_MOVE, TUTORIAL_MOVE.a, false), 'second');
  assert.equal(checkPuzzle(TUTORIAL.board, TUTORIAL).solved, false);
  const board = applySwap(TUTORIAL.board, TUTORIAL_MOVE, rulesFor(TUTORIAL, 'daily'), 0);
  assert.equal(checkPuzzle(board, TUTORIAL).solved, true);
  assert.equal(tutorialStage(TUTORIAL_START_SHAPE, null, true), 'home');
});
