import assert from 'node:assert/strict';
import test from 'node:test';
import { computeBookProgress, computeBookProgressFromBook } from './bookProgress';
import { SentenceProgress } from '../types/shadowreader';

function done(score = 90): SentenceProgress {
  return { completed: true, bestScore: score, attempts: 1, lastPracticed: '2026-11-17T00:00:00.000Z' };
}

function attempted(score = 60): SentenceProgress {
  return { completed: false, bestScore: score, attempts: 2 };
}

test('computeBookProgress counts only completed sentences', () => {
  assert.deepEqual(computeBookProgress(0, {}), {
    completedCount: 0,
    total: 0,
    percent: 0,
    isComplete: false
  });

  assert.deepEqual(computeBookProgress(3, {}), {
    completedCount: 0,
    total: 3,
    percent: 0,
    isComplete: false
  });

  assert.deepEqual(computeBookProgress(3, { 0: done() }), {
    completedCount: 1,
    total: 3,
    percent: 33,
    isComplete: false
  });

  assert.deepEqual(computeBookProgress(3, { 0: done(), 1: done() }), {
    completedCount: 2,
    total: 3,
    percent: 67,
    isComplete: false
  });

  assert.deepEqual(computeBookProgress(3, { 0: done(), 1: done(), 2: done() }), {
    completedCount: 3,
    total: 3,
    percent: 100,
    isComplete: true
  });
});

test('computeBookProgress never reaches 100% with a pending sentence', () => {
  const progress: Record<number, SentenceProgress> = {};
  for (let i = 0; i < 199; i++) progress[i] = done();
  const summary = computeBookProgress(200, progress);
  assert.equal(summary.completedCount, 199);
  assert.equal(summary.percent, 99);
  assert.equal(summary.isComplete, false);
});

test('computeBookProgress ignores attempts, invalid keys and out-of-range entries', () => {
  const summary = computeBookProgress(4, {
    0: attempted(95),
    1: done(),
    2: { completed: true, bestScore: 100, attempts: 1 },
    '-1': done(),
    '4': done(),
    '1.5': done(),
    notANumber: done()
  } as unknown as Record<number, SentenceProgress>);

  assert.equal(summary.completedCount, 2);
  assert.equal(summary.percent, 50);
});

test('computeBookProgress tolerates garbage totals and null progress', () => {
  assert.equal(computeBookProgress(Number.NaN, null).percent, 0);
  assert.equal(computeBookProgress(-5, null).total, 0);
  assert.equal(computeBookProgress(2, null).percent, 0);
  assert.equal(computeBookProgress(1, { 0: done() }).isComplete, true);
});

test('computeBookProgressFromBook reads totalSentences or falls back to the sentence list', () => {
  assert.deepEqual(
    computeBookProgressFromBook({ sentences: [{}, {}, {}], sentenceProgress: { 1: done() } }),
    { completedCount: 1, total: 3, percent: 33, isComplete: false }
  );
  assert.deepEqual(
    computeBookProgressFromBook({ sentences: [{}, {}], totalSentences: 10, sentenceProgress: {} }),
    { completedCount: 0, total: 10, percent: 0, isComplete: false }
  );
  assert.equal(computeBookProgressFromBook({}).percent, 0);
});
