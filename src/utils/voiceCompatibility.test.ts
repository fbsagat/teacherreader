import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SETTINGS } from '../services/storageService';
import {
  EN_SLOW_PLAYBACK_RATE,
  computeAudioPlaybackTimeoutMs,
  computeEffectiveTtsRate,
  getVoiceCompatibilitySummary,
  resolveSpeakErrorFeedbackPlan
} from './voiceCompatibility';

test('computeEffectiveTtsRate applies Gemini style cleanly without distorting slow speech', () => {
  // Normal Gemini clear_teacher on default 0.85x EN speed -> ~0.83x
  const normalRate = computeEffectiveTtsRate({
    lang: 'en-US',
    ttsEngine: 'gemini_tts',
    ttsSpeedEn: 0.85,
    ttsSpeedPt: 1.15,
    geminiVoiceStyle: 'clear_teacher',
    speedMultiplier: 1.0
  });
  assert.equal(normalRate, 0.83);

  // Even when combining lowest base (0.65x) + slow_learner (0.92) + -15% error slowdown (0.85),
  // rate is clamped to >= 0.72x for neural cloud audio clarity
  const errorRateFloor = computeEffectiveTtsRate({
    lang: 'en-US',
    ttsEngine: 'gemini_tts',
    ttsSpeedEn: 0.65,
    ttsSpeedPt: 1.15,
    geminiVoiceStyle: 'slow_learner',
    speedMultiplier: 0.85
  });
  assert.equal(errorRateFloor, 0.72);

  // Portuguese ignores Gemini EN style multiplier
  const ptRate = computeEffectiveTtsRate({
    lang: 'pt-BR',
    ttsEngine: 'gemini_tts',
    ttsSpeedEn: 0.85,
    ttsSpeedPt: 1.15,
    geminiVoiceStyle: 'slow_learner',
    speedMultiplier: 1.0
  });
  assert.equal(ptRate, 1.15);

  // Non-Gemini engines keep exact base rate * multiplier without Gemini style factor
  const autoRate = computeEffectiveTtsRate({
    lang: 'en-US',
    ttsEngine: 'auto',
    ttsSpeedEn: 0.85,
    ttsSpeedPt: 1.15,
    geminiVoiceStyle: 'conversational',
    speedMultiplier: 0.85
  });
  assert.equal(autoRate, 0.72);
});

test('EN_SLOW_PLAYBACK_RATE is an absolute rate that stays audibly slower than normal playback', () => {
  const base = {
    lang: 'en-US',
    ttsEngine: 'gemini_tts' as const,
    ttsSpeedEn: DEFAULT_SETTINGS.ttsSpeedEn,
    ttsSpeedPt: DEFAULT_SETTINGS.ttsSpeedPt,
    geminiVoiceStyle: DEFAULT_SETTINGS.geminiVoiceStyle,
    speedMultiplier: 1.0
  };

  const normalRate = computeEffectiveTtsRate(base);
  const slowRate = computeEffectiveTtsRate({ ...base, absoluteRate: EN_SLOW_PLAYBACK_RATE });

  assert.equal(normalRate, 0.72);
  assert.equal(slowRate, 0.6);
  assert.ok(slowRate < normalRate, 'slow step must be distinguishable from normal playback');

  // Absolute rates bypass the neural clarity floor but still respect browser-safe bounds.
  assert.equal(computeEffectiveTtsRate({ ...base, absoluteRate: 0.05 }), 0.5);
  assert.equal(computeEffectiveTtsRate({ ...base, absoluteRate: 4 }), 1.5);
  // Invalid absolute rates fall back to the regular computation.
  assert.equal(computeEffectiveTtsRate({ ...base, absoluteRate: Number.NaN }), normalRate);
});

test('computeAudioPlaybackTimeoutMs scales proportionally for slowed full sentences', () => {
  const shortWordMs = computeAudioPlaybackTimeoutMs('through', 0.85, true);
  assert.ok(shortWordMs >= 5000);

  const longSentenceSlowMs = computeAudioPlaybackTimeoutMs(
    'Every morning I walk slowly through Beacon Hill to practice my American pronunciation cleanly.',
    0.72,
    true
  );
  // Must far exceed the old 9500ms fixed cap so slow audio never times out and triggers a second voice
  assert.ok(longSentenceSlowMs >= 20000);
});

test('resolveSpeakErrorFeedbackPlan emits at most one deterministic audio plan per error in speak_blind_en', () => {
  // Error 1 before reveal threshold (2): repeat Portuguese hint, keep English hidden
  const firstBlindError = resolveSpeakErrorFeedbackPlan({
    stepCard: 'speak_blind_en',
    attempts: 1,
    blindMaxErrorsBeforeReveal: 2,
    repeatOnError: true,
    slowdownOnError: true,
    autoHandsFree: false,
    handsFreeMaxAttempts: 2,
    hasTargetPt: true
  });
  assert.deepEqual(firstBlindError, {
    action: 'repeat_pt_hint',
    revealEnglish: false,
    speakLang: 'pt-BR',
    speedMultiplier: 1.0,
    pauseAfterMs: 350
  });

  // Error 2 hits blindMaxErrorsBeforeReveal=2: reveal English and play EN ONCE at 0.85x
  const revealBlindError = resolveSpeakErrorFeedbackPlan({
    stepCard: 'speak_blind_en',
    attempts: 2,
    blindMaxErrorsBeforeReveal: 2,
    repeatOnError: true,
    slowdownOnError: true,
    autoHandsFree: false,
    handsFreeMaxAttempts: 2,
    hasTargetPt: true
  });
  assert.deepEqual(revealBlindError, {
    action: 'reveal_and_repeat_en',
    revealEnglish: true,
    speakLang: 'en-US',
    speedMultiplier: 0.85,
    pauseAfterMs: 350
  });

  // Hands-free advance at attempt 3 (blindMaxErrorsBeforeReveal + 1): plays EN model once & advances
  const hfAdvance = resolveSpeakErrorFeedbackPlan({
    stepCard: 'speak_blind_en',
    attempts: 3,
    blindMaxErrorsBeforeReveal: 2,
    repeatOnError: true,
    slowdownOnError: true,
    autoHandsFree: true,
    handsFreeMaxAttempts: 2,
    hasTargetPt: true
  });
  assert.equal(hfAdvance.action, 'hands_free_advance');
  assert.equal(hfAdvance.speakLang, 'en-US');

  // If repeatOnError is disabled, silent retry even when revealing English
  const silentReveal = resolveSpeakErrorFeedbackPlan({
    stepCard: 'speak_blind_en',
    attempts: 2,
    blindMaxErrorsBeforeReveal: 2,
    repeatOnError: false,
    slowdownOnError: true,
    autoHandsFree: false,
    handsFreeMaxAttempts: 2,
    hasTargetPt: true
  });
  assert.equal(silentReveal.action, 'silent_retry');
  assert.equal(silentReveal.revealEnglish, true);
  assert.equal(silentReveal.speakLang, null);
});

test('getVoiceCompatibilitySummary reflects connected Voice Hub engines & Regras settings', () => {
  const summaryDefault = getVoiceCompatibilitySummary(DEFAULT_SETTINGS);
  assert.equal(summaryDefault.usesGeminiTts, true);
  assert.equal(summaryDefault.usesSystemVoicePicker, false);
  assert.equal(summaryDefault.isSlowdownRelevant, true);
  assert.equal(summaryDefault.effectiveNormalEnRate, 0.72);
  assert.equal(summaryDefault.effectiveErrorRetryEnRate, 0.72);

  const summaryBrowser = getVoiceCompatibilitySummary({
    ...DEFAULT_SETTINGS,
    ttsEngine: 'browser_custom',
    preferredVoiceEnUri: 'Google US English',
    repeatOnError: false,
    sttProvider: 'web_speech',
    sttStrictness: 'strict'
  });
  assert.equal(summaryBrowser.usesGeminiTts, false);
  assert.equal(summaryBrowser.usesSystemVoicePicker, true);
  assert.equal(summaryBrowser.isSlowdownRelevant, false);
  assert.match(summaryBrowser.ttsVoiceDetail, /Google US English/);
  assert.equal(summaryBrowser.sttStrictnessLabel, 'Rigoroso');
});
