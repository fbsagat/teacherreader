import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCumulativeTranscriptFromResults,
  isMobileOrTouchBrowser,
  resolveDynamicViewportHeightPx,
  resolveMobileVisibleCards,
  shouldUseConcurrentMediaRecorder
} from './mobileHelpers.ts';

test('isMobileOrTouchBrowser detects Android, iPhone, iPadOS desktop-UA, and leaves desktop false', () => {
  assert.equal(
    isMobileOrTouchBrowser(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      5
    ),
    true
  );
  assert.equal(
    isMobileOrTouchBrowser(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
      5
    ),
    true
  );
  assert.equal(
    isMobileOrTouchBrowser(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      5
    ),
    true
  );
  assert.equal(
    isMobileOrTouchBrowser(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      0
    ),
    false
  );
});

test('shouldUseConcurrentMediaRecorder disables dual capture on mobile and single-word challenges', () => {
  const androidUa =
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 Mobile Safari/537.36';
  const desktopUa =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';

  assert.equal(
    shouldUseConcurrentMediaRecorder({ userAgent: androidUa, maxTouchPoints: 5, isSingleWord: false }),
    false
  );
  assert.equal(
    shouldUseConcurrentMediaRecorder({ userAgent: desktopUa, maxTouchPoints: 0, isSingleWord: true }),
    false
  );
  assert.equal(
    shouldUseConcurrentMediaRecorder({ userAgent: desktopUa, maxTouchPoints: 0, isSingleWord: false }),
    true
  );
});

test('extractCumulativeTranscriptFromResults deduplicates Android repeated & cumulative final results', () => {
  const normal = extractCumulativeTranscriptFromResults([
    { isFinal: true, 0: { transcript: 'Every morning' } },
    { isFinal: false, 0: { transcript: 'I walk' } }
  ]);
  assert.equal(normal.combinedText, 'Every morning I walk');

  const duplicatedAndroid = extractCumulativeTranscriptFromResults([
    { isFinal: true, 0: { transcript: 'Good morning' } },
    { isFinal: true, 0: { transcript: 'Good morning' } },
    { isFinal: true, 0: { transcript: 'Good morning everyone' } }
  ]);
  assert.equal(duplicatedAndroid.finalText, 'Good morning everyone');
  assert.equal(duplicatedAndroid.combinedText, 'Good morning everyone');
});

test('resolveMobileVisibleCards switches visible cards strictly by active training step even if manual panel was all', () => {
  const seq = ['pt', 'en', 'speak', 'speak_blind_en', 'literal', 'challenges'] as const;

  const ptStep = resolveMobileVisibleCards({
    isPlayingLoop: true,
    activeSequenceStepIdx: 0,
    effectiveSequence: [...seq],
    enginePhase: 'PLAYING_PT',
    activeCardHighlight: 'pt',
    isReadingWords: false,
    isListeningMic: false,
    isBlindEnglishStage: false,
    blindEnglishUnlocked: false,
    isEnglishTextHidden: false,
    manualSelectedPanel: 'all'
  });
  assert.deepEqual(ptStep, {
    activePanel: 'pt',
    isFocusedMode: true,
    showPtCard: true,
    showEnCard: false,
    showLiteralCard: false,
    showSpeechCard: false,
    compactEnReference: false,
    compactPtReference: false
  });

  const enStep = resolveMobileVisibleCards({
    isPlayingLoop: true,
    activeSequenceStepIdx: 1,
    effectiveSequence: [...seq],
    enginePhase: 'PLAYING_EN',
    activeCardHighlight: 'en',
    isReadingWords: false,
    isListeningMic: false,
    isBlindEnglishStage: false,
    blindEnglishUnlocked: false,
    isEnglishTextHidden: false,
    manualSelectedPanel: 'all'
  });
  assert.equal(enStep.activePanel, 'en');
  assert.equal(enStep.showEnCard, true);
  assert.equal(enStep.showSpeechCard, false);

  const speakStep = resolveMobileVisibleCards({
    isPlayingLoop: true,
    activeSequenceStepIdx: 2,
    effectiveSequence: [...seq],
    enginePhase: 'LISTENING_USER',
    activeCardHighlight: null,
    isReadingWords: false,
    isListeningMic: true,
    isBlindEnglishStage: false,
    blindEnglishUnlocked: false,
    isEnglishTextHidden: false,
    manualSelectedPanel: 'all'
  });
  assert.deepEqual(speakStep, {
    activePanel: 'speak',
    isFocusedMode: true,
    showPtCard: false,
    showEnCard: true,
    showLiteralCard: false,
    showSpeechCard: true,
    compactEnReference: true,
    compactPtReference: false
  });

  const blindHidden = resolveMobileVisibleCards({
    isPlayingLoop: true,
    activeSequenceStepIdx: 3,
    effectiveSequence: [...seq],
    enginePhase: 'LISTENING_USER',
    activeCardHighlight: null,
    isReadingWords: false,
    isListeningMic: true,
    isBlindEnglishStage: true,
    blindEnglishUnlocked: false,
    isEnglishTextHidden: true,
    manualSelectedPanel: 'en'
  });
  assert.equal(blindHidden.showPtCard, true);
  assert.equal(blindHidden.compactPtReference, true);
  assert.equal(blindHidden.showEnCard, false);
  assert.equal(blindHidden.showSpeechCard, true);

  const blindRevealed = resolveMobileVisibleCards({
    isPlayingLoop: true,
    activeSequenceStepIdx: 3,
    effectiveSequence: [...seq],
    enginePhase: 'LISTENING_USER',
    activeCardHighlight: null,
    isReadingWords: false,
    isListeningMic: true,
    isBlindEnglishStage: true,
    blindEnglishUnlocked: true,
    isEnglishTextHidden: false,
    manualSelectedPanel: 'en'
  });
  assert.equal(blindRevealed.showEnCard, true);
  assert.equal(blindRevealed.compactEnReference, true);
  assert.equal(blindRevealed.showPtCard, false);
  assert.equal(blindRevealed.showSpeechCard, true);

  const literalStep = resolveMobileVisibleCards({
    isPlayingLoop: true,
    activeSequenceStepIdx: 4,
    effectiveSequence: [...seq],
    enginePhase: 'WORD_REVIEW',
    activeCardHighlight: null,
    isReadingWords: true,
    isListeningMic: false,
    isBlindEnglishStage: false,
    blindEnglishUnlocked: false,
    isEnglishTextHidden: false,
    manualSelectedPanel: 'en'
  });
  assert.equal(literalStep.activePanel, 'literal');
  assert.equal(literalStep.showLiteralCard, true);
  assert.equal(literalStep.showEnCard, false);
  assert.equal(literalStep.showSpeechCard, false);
});

test('resolveMobileVisibleCards respects manual tabs in Free Mode and falls back cleanly', () => {
  const base = {
    isPlayingLoop: false,
    activeSequenceStepIdx: null,
    effectiveSequence: ['pt', 'en', 'speak', 'challenges'] as ('pt' | 'en' | 'speak' | 'challenges')[],
    enginePhase: 'IDLE' as const,
    activeCardHighlight: null,
    isReadingWords: false,
    isListeningMic: false,
    isBlindEnglishStage: false,
    blindEnglishUnlocked: false,
    isEnglishTextHidden: false
  };

  const freeEn = resolveMobileVisibleCards({ ...base, manualSelectedPanel: 'en' });
  assert.equal(freeEn.isFocusedMode, true);
  assert.equal(freeEn.showEnCard, true);
  assert.equal(freeEn.showPtCard, false);
  assert.equal(freeEn.showSpeechCard, false);

  const freeAll = resolveMobileVisibleCards({ ...base, manualSelectedPanel: 'all' });
  assert.equal(freeAll.isFocusedMode, false);
  assert.equal(freeAll.showPtCard, true);
  assert.equal(freeAll.showEnCard, true);
  assert.equal(freeAll.showLiteralCard, true);
  assert.equal(freeAll.showSpeechCard, true);
});

test('resolveDynamicViewportHeightPx tracks visible mobile viewport excluding browser toolbars and ignores keyboard shrink', () => {
  // Real mobile phone with bottom/top browser chrome reducing visualViewport below innerHeight
  assert.equal(
    resolveDynamicViewportHeightPx({
      innerHeight: 740,
      visualViewportHeight: 676,
      visualViewportScale: 1,
      isTextInputFocused: false
    }),
    676
  );

  // When a text input is focused (virtual keyboard open), preserve innerHeight so background shell stays stable
  assert.equal(
    resolveDynamicViewportHeightPx({
      innerHeight: 740,
      visualViewportHeight: 380,
      visualViewportScale: 1,
      isTextInputFocused: true
    }),
    740
  );

  // When user pinch-zoomed, ignore zoomed visualViewportHeight
  assert.equal(
    resolveDynamicViewportHeightPx({
      innerHeight: 740,
      visualViewportHeight: 420,
      visualViewportScale: 1.5,
      isTextInputFocused: false
    }),
    740
  );

  // Invalid innerHeight returns null cleanly
  assert.equal(resolveDynamicViewportHeightPx({ innerHeight: 0 }), null);
});

