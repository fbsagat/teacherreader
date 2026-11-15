import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDeadlineExtensionMs,
  computeSpeechCaptureTimingPlan,
  evaluateRecognitionOnEnd,
  getSingleWordSilenceDebounceMs,
  mergeTranscriptWithPrefix
} from './speechCaptureTiming';

test('getSingleWordSilenceDebounceMs provides extra settle room across pause modes', () => {
  assert.equal(getSingleWordSilenceDebounceMs('short'), 900);
  assert.equal(getSingleWordSilenceDebounceMs('normal'), 1250);
  assert.equal(getSingleWordSilenceDebounceMs('long'), 1750);
});

test('computeSpeechCaptureTimingPlan allocates generous pre-speech wait and post-speech settle windows', () => {
  const normalSentencePlan = computeSpeechCaptureTimingPlan({
    targetSentence: 'Every morning I walk to the coffee shop near my house.',
    isSingleWord: false,
    pauseMode: 'normal',
    autoHandsFree: false
  });
  assert.ok(normalSentencePlan.preSpeechWaitMs >= 19000);
  assert.equal(normalSentencePlan.postSpeechDebounceMs, 2750);
  assert.equal(normalSentencePlan.fullMatchSettleMs, 1150);
  assert.ok(normalSentencePlan.startupSettleDelayMs >= 60);

  const handsFreeSentencePlan = computeSpeechCaptureTimingPlan({
    targetSentence: 'Hello world friend.',
    isSingleWord: false,
    pauseMode: 'normal',
    autoHandsFree: true
  });
  assert.ok(
    handsFreeSentencePlan.preSpeechWaitMs >= 12000,
    'Hands-free must wait long enough before the user begins speaking'
  );

  const calmSingleWordPlan = computeSpeechCaptureTimingPlan({
    targetSentence: 'through',
    isSingleWord: true,
    pauseMode: 'long',
    autoHandsFree: true
  });
  assert.ok(calmSingleWordPlan.preSpeechWaitMs > 8500);
  assert.equal(calmSingleWordPlan.postSpeechDebounceMs, 1750);
  assert.equal(calmSingleWordPlan.fullMatchSettleMs, 850);
});

test('computeDeadlineExtensionMs extends deadline when user is actively speaking and stops when budget exhausted', () => {
  const ext1 = computeDeadlineExtensionMs({
    nowMs: 12000,
    lastSpeechActivityAt: 11200,
    postSpeechDebounceMs: 2150,
    totalExtensionGrantedMs: 0,
    activeSpeechMaxExtensionMs: 8500,
    isSpeechActive: true
  });
  assert.ok(ext1 > 0);

  const extNoneWhenSilentLongAgo = computeDeadlineExtensionMs({
    nowMs: 20000,
    lastSpeechActivityAt: 5000,
    postSpeechDebounceMs: 2150,
    totalExtensionGrantedMs: 0,
    activeSpeechMaxExtensionMs: 8500,
    isSpeechActive: false
  });
  assert.equal(extNoneWhenSilentLongAgo, 0);

  const extCapped = computeDeadlineExtensionMs({
    nowMs: 25000,
    lastSpeechActivityAt: 24500,
    postSpeechDebounceMs: 2150,
    totalExtensionGrantedMs: 8500,
    activeSpeechMaxExtensionMs: 8500,
    isSpeechActive: true
  });
  assert.equal(extCapped, 0);
});

test('evaluateRecognitionOnEnd restarts when waiting before speech and recovers partial mid-sentence cuts', () => {
  // No speech captured yet + plenty of wait time -> keep mic alive
  assert.equal(
    evaluateRecognitionOnEnd({
      lastSpokenText: '',
      hasSpeechStarted: false,
      isFullMatchSettled: false,
      isSingleWord: false,
      remainingMs: 5000,
      msSinceLastResult: 5000,
      postSpeechDebounceMs: 2150,
      partialRestartCount: 0
    }),
    'restart_fresh'
  );

  // Mid-sentence premature Chrome onend right after partial phrase -> restart & append
  assert.equal(
    evaluateRecognitionOnEnd({
      lastSpokenText: 'Every morning I walk',
      hasSpeechStarted: true,
      isFullMatchSettled: false,
      isSingleWord: false,
      remainingMs: 7000,
      msSinceLastResult: 500,
      postSpeechDebounceMs: 2750,
      partialRestartCount: 0
    }),
    'restart_append'
  );

  // Complete once all target words matched or max partial restarts reached
  assert.equal(
    evaluateRecognitionOnEnd({
      lastSpokenText: 'Every morning I walk to the coffee shop',
      hasSpeechStarted: true,
      isFullMatchSettled: true,
      isSingleWord: false,
      remainingMs: 7000,
      msSinceLastResult: 500,
      postSpeechDebounceMs: 2750,
      partialRestartCount: 0
    }),
    'complete'
  );

  assert.equal(
    evaluateRecognitionOnEnd({
      lastSpokenText: 'Every morning I walk',
      hasSpeechStarted: true,
      isFullMatchSettled: false,
      isSingleWord: false,
      remainingMs: 7000,
      msSinceLastResult: 500,
      postSpeechDebounceMs: 2750,
      partialRestartCount: 2
    }),
    'complete'
  );
});

test('mergeTranscriptWithPrefix combines restarted speech segments cleanly without duplicate boundary words', () => {
  assert.equal(
    mergeTranscriptWithPrefix('Every morning I', 'walk to the store'),
    'Every morning I walk to the store'
  );
  assert.equal(
    mergeTranscriptWithPrefix('Every morning I walk', 'I walk to the store'),
    'Every morning I walk to the store'
  );
  assert.equal(mergeTranscriptWithPrefix('', 'hello world'), 'hello world');
});
