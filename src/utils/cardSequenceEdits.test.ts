import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendOrderItem,
  buildLegacyFlagsForSequence,
  buildOccurrenceInfo,
  duplicateOrderItem,
  moveOrderItem,
  removeOrderItem
} from './cardSequenceEdits';
import { getAddableStepGroups } from './cardSequencePresets';

const SEQ = ['pt', 'en', 'speak'] as const;

test('moveOrderItem moves items without mutating the source', () => {
  const source = [...SEQ];
  assert.deepEqual(moveOrderItem(source, 0, 1), ['en', 'pt', 'speak']);
  assert.deepEqual(moveOrderItem(source, 2, -1), ['pt', 'speak', 'en']);
  assert.deepEqual(source, [...SEQ]);
});

test('moveOrderItem rejects out-of-bounds and invalid moves', () => {
  assert.equal(moveOrderItem(SEQ, 0, -1), null);
  assert.equal(moveOrderItem(SEQ, 2, 1), null);
  assert.equal(moveOrderItem(SEQ, -1, 1), null);
  assert.equal(moveOrderItem(SEQ, 1, 0), null);
  assert.equal(moveOrderItem(SEQ, 1.5, 1), null);
  assert.equal(moveOrderItem([], 0, 1), null);
});

test('duplicateOrderItem repeats right after the source index', () => {
  assert.deepEqual(duplicateOrderItem(SEQ, 1), ['pt', 'en', 'en', 'speak']);
  assert.equal(duplicateOrderItem(SEQ, 3), null);
  assert.equal(duplicateOrderItem([], 0), null);
});

test('removeOrderItem keeps the minimum length', () => {
  assert.deepEqual(removeOrderItem(SEQ, 1), ['pt', 'speak']);
  assert.deepEqual(removeOrderItem(SEQ, 0, 2), ['en', 'speak']);
  assert.deepEqual(removeOrderItem(['pt', 'en'], 0), ['en']);
  assert.equal(removeOrderItem(['pt'], 0), null);
  assert.equal(removeOrderItem(['pt', 'en'], 0, 2), null);
  assert.equal(removeOrderItem(SEQ, 9), null);
});

test('appendOrderItem always returns a new array', () => {
  const source = [...SEQ];
  const next = appendOrderItem(source, 'literal');
  assert.deepEqual(next, ['pt', 'en', 'speak', 'literal']);
  assert.deepEqual(source, [...SEQ]);
});

test('buildOccurrenceInfo tags repeated items 1-based', () => {
  const info = buildOccurrenceInfo(['pt', 'en', 'en', 'en']);
  assert.deepEqual(info, [
    { occurrence: 1, total: 1, isRepeated: false },
    { occurrence: 1, total: 3, isRepeated: true },
    { occurrence: 2, total: 3, isRepeated: true },
    { occurrence: 3, total: 3, isRepeated: true }
  ]);
  assert.deepEqual(buildOccurrenceInfo([]), []);
});

test('buildLegacyFlagsForSequence derives every engine flag from the sequence', () => {
  const flags = buildLegacyFlagsForSequence(
    ['pt', 'en', 'speak_blind_en', 'literal', 'challenge_pronunciation', 'challenge_matching'],
    'custom'
  );
  assert.equal(flags.audioFlow, 'custom');
  assert.deepEqual(flags.cardSequence, [
    'pt',
    'en',
    'speak_blind_en',
    'literal',
    'challenge_pronunciation',
    'challenge_matching'
  ]);
  assert.equal(flags.enableBlindSpeakingStage, true);
  assert.equal(flags.readWordsOnSuccess, true);
  assert.equal(flags.enablePostSentenceChallenges, true);
  assert.equal(flags.enableWordPronunciationChallenge, true);
  assert.equal(flags.enableWordMatchingChallenge, true);

  const minimal = buildLegacyFlagsForSequence(['en', 'speak'], 'custom');
  assert.equal(minimal.audioFlow, 'custom');
  assert.equal(minimal.blindMaxErrorsBeforeReveal, undefined);
  assert.equal(minimal.enableBlindSpeakingStage, false);
  assert.equal(minimal.readWordsOnSuccess, false);
  assert.equal(minimal.enablePostSentenceChallenges, false);

  const combined = buildLegacyFlagsForSequence(['challenges'], 'custom');
  assert.equal(combined.enableWordPronunciationChallenge, true);
  assert.equal(combined.enableWordMatchingChallenge, true);
});

test('getAddableStepGroups exposes every step exactly once', () => {
  const groups = getAddableStepGroups();
  const all = groups.flatMap(group => group.steps.map(step => step.type));
  assert.equal(all.length, 10);
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(
    groups.map(group => group.category.id),
    ['audio', 'speak', 'review', 'challenge']
  );
  assert.ok(groups.every(group => group.steps.length > 0));
});
