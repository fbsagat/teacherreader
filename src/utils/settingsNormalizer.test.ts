import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, normalizeSettings } from './settingsNormalizer';

test('normalizeSettings returns full defaults for empty/hostile input', () => {
  for (const input of [null, undefined, 42, 'oops', [], {}]) {
    assert.deepEqual(normalizeSettings(input), DEFAULT_SETTINGS);
  }
});

test('normalizeSettings clamps every numeric field into its UI range', () => {
  const hostile = normalizeSettings({
    threshold: Number.NaN,
    ttsSpeedEn: 5,
    ttsSpeedPt: -3,
    blindMaxErrorsBeforeReveal: -1,
    handsFreeMaxAttempts: 99,
    fontSizeScale: 999,
    dailyGoalSentences: -3,
    practiceDaysGoal: 0
  });

  assert.equal(hostile.threshold, DEFAULT_SETTINGS.threshold);
  assert.equal(hostile.ttsSpeedEn, 1.2);
  assert.equal(hostile.ttsSpeedPt, 0.8);
  assert.equal(hostile.blindMaxErrorsBeforeReveal, 0);
  assert.equal(hostile.handsFreeMaxAttempts, 5);
  assert.equal(hostile.fontSizeScale, 135);
  assert.equal(hostile.dailyGoalSentences, 1);
  assert.equal(hostile.practiceDaysGoal, 1);

  assert.equal(normalizeSettings({ threshold: 0 }).threshold, 50);
  assert.equal(normalizeSettings({ threshold: 100 }).threshold, 95);
  assert.equal(normalizeSettings({ threshold: 72 }).threshold, 70);
  assert.equal(normalizeSettings({ fontSizeScale: 112 }).fontSizeScale, 110);
});

test('normalizeSettings validates enums and drops invalid sequences', () => {
  const result = normalizeSettings({
    ttsEngine: 'openai_tts',
    sttProvider: 'groq_whisper',
    themeMode: 'neon',
    audioFlow: 'nope',
    studyViewMode: 'tiled',
    handsFreeChallengeMode: 'always',
    sttStrictness: 'brutal',
    cardSequence: ['pt', 'nope', 'speak', 'pt', 42],
    visualCardOrder: ['en', 'invalid']
  });

  assert.equal(result.ttsEngine, 'gemini_tts');
  assert.equal(result.sttProvider, 'hybrid_ai');
  assert.equal(result.themeMode, 'dark');
  assert.equal(result.audioFlow, 'pt_first');
  assert.equal(result.studyViewMode, 'cards');
  assert.equal(result.handsFreeChallengeMode, 'voice_all');
  assert.equal(result.sttStrictness, 'balanced');
  assert.deepEqual(result.cardSequence, ['pt', 'speak']);
  assert.deepEqual(result.visualCardOrder, ['en']);
});

test('normalizeSettings keeps valid user values and discards unknown keys', () => {
  const result = normalizeSettings({
    threshold: 85,
    ttsSpeedEn: 0.7,
    ttsSpeedPt: 1.3,
    autoHandsFree: true,
    themeMode: 'sepia',
    cardSequence: ['en', 'speak_challenge', 'challenges'],
    hackTheGibson: 'yes'
  }) as unknown as Record<string, unknown>;

  assert.equal(result.threshold, 85);
  assert.equal(result.ttsSpeedEn, 0.7);
  assert.equal(result.ttsSpeedPt, 1.3);
  assert.equal(result.autoHandsFree, true);
  assert.equal(result.themeMode, 'sepia');
  assert.deepEqual(result.cardSequence, ['en', 'speak_challenge', 'challenges']);
  assert.equal('hackTheGibson' in result, false);
});

test('normalizeSettings never returns NaN or Infinity', () => {
  const result = normalizeSettings({
    threshold: Infinity,
    ttsSpeedEn: -Infinity,
    ttsSpeedPt: Number.NaN,
    blindMaxErrorsBeforeReveal: Infinity,
    fontSizeScale: Number.NaN,
    dailyGoalSentences: Number.NaN,
    practiceDaysGoal: Infinity,
    handsFreeMaxAttempts: Number.NaN
  });
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'number') {
      assert.ok(Number.isFinite(value), `${key} should be finite`);
    }
  }
});
