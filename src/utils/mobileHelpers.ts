import { EnginePhase, StudyStepCardType } from '../types/shadowreader';

export interface MobileMediaCapabilitiesParams {
  userAgent?: string;
  maxTouchPoints?: number;
  isSingleWord?: boolean;
}

export interface SpeechResultAltLike {
  transcript?: string;
}

export interface SpeechResultItemLike {
  isFinal?: boolean;
  length?: number;
  [index: number]: SpeechResultAltLike | undefined;
}

export type MobileStagePanel = 'pt' | 'en' | 'literal' | 'speak' | 'all';

export interface ResolveMobileVisibleCardsParams {
  isPlayingLoop: boolean;
  activeSequenceStepIdx: number | null;
  effectiveSequence: StudyStepCardType[];
  enginePhase: EnginePhase;
  activeCardHighlight: 'pt' | 'en' | null;
  isReadingWords: boolean;
  isListeningMic: boolean;
  isBlindEnglishStage: boolean;
  blindEnglishUnlocked: boolean;
  isEnglishTextHidden: boolean;
  manualSelectedPanel: MobileStagePanel;
}

export interface MobileVisibleCardsPlan {
  activePanel: MobileStagePanel;
  isFocusedMode: boolean;
  showPtCard: boolean;
  showEnCard: boolean;
  showLiteralCard: boolean;
  showSpeechCard: boolean;
  compactEnReference: boolean;
  compactPtReference: boolean;
}

/**
 * Resolves which study card(s) should be displayed on mobile (< 768px) so the active
 * training stage fits cleanly within the mobile viewport without requiring vertical scrolling.
 */
export function resolveMobileVisibleCards({
  isPlayingLoop,
  activeSequenceStepIdx,
  effectiveSequence,
  enginePhase,
  activeCardHighlight,
  isReadingWords,
  isListeningMic,
  isBlindEnglishStage,
  blindEnglishUnlocked,
  isEnglishTextHidden,
  manualSelectedPanel
}: ResolveMobileVisibleCardsParams): MobileVisibleCardsPlan {
  const hasActiveSequenceStep =
    activeSequenceStepIdx !== null &&
    activeSequenceStepIdx >= 0 &&
    activeSequenceStepIdx < effectiveSequence.length;

  const shouldFollowActiveStep = isPlayingLoop || (hasActiveSequenceStep && manualSelectedPanel !== 'all');

  if (shouldFollowActiveStep) {
    let stepCard: StudyStepCardType | null = hasActiveSequenceStep
      ? effectiveSequence[activeSequenceStepIdx!]
      : null;

    if (!stepCard) {
      if (isReadingWords || enginePhase === 'WORD_REVIEW') {
        stepCard = 'literal';
      } else if (isListeningMic || enginePhase === 'LISTENING_USER' || enginePhase === 'EVALUATING') {
        stepCard = isBlindEnglishStage ? 'speak_blind_en' : 'speak';
      } else if (activeCardHighlight === 'pt' || enginePhase === 'PLAYING_PT') {
        stepCard = 'pt';
      } else {
        stepCard = 'en';
      }
    }

    if (stepCard === 'pt') {
      return {
        activePanel: 'pt',
        isFocusedMode: true,
        showPtCard: true,
        showEnCard: false,
        showLiteralCard: false,
        showSpeechCard: false,
        compactEnReference: false,
        compactPtReference: false
      };
    }

    if (stepCard === 'en' || stepCard === 'en_slow') {
      return {
        activePanel: 'en',
        isFocusedMode: true,
        showPtCard: false,
        showEnCard: true,
        showLiteralCard: false,
        showSpeechCard: false,
        compactEnReference: false,
        compactPtReference: false
      };
    }

    if (stepCard === 'literal') {
      return {
        activePanel: 'literal',
        isFocusedMode: true,
        showPtCard: false,
        showEnCard: false,
        showLiteralCard: true,
        showSpeechCard: false,
        compactEnReference: false,
        compactPtReference: false
      };
    }

    if (stepCard === 'speak_blind_en') {
      const revealedEn = blindEnglishUnlocked || !isEnglishTextHidden;
      return {
        activePanel: 'speak',
        isFocusedMode: true,
        showPtCard: !revealedEn,
        showEnCard: revealedEn,
        showLiteralCard: false,
        showSpeechCard: true,
        compactEnReference: revealedEn,
        compactPtReference: !revealedEn
      };
    }

    if (stepCard === 'speak' || stepCard === 'speak_challenge') {
      return {
        activePanel: 'speak',
        isFocusedMode: true,
        showPtCard: false,
        showEnCard: true,
        showLiteralCard: false,
        showSpeechCard: true,
        compactEnReference: true,
        compactPtReference: false
      };
    }

    // Challenges modal step
    return {
      activePanel: 'speak',
      isFocusedMode: true,
      showPtCard: false,
      showEnCard: false,
      showLiteralCard: false,
      showSpeechCard: true,
      compactEnReference: false,
      compactPtReference: false
    };
  }

  // Free Mode (outside active loop / post-eval sequence)
  if (manualSelectedPanel === 'all') {
    return {
      activePanel: 'all',
      isFocusedMode: false,
      showPtCard: true,
      showEnCard: true,
      showLiteralCard: true,
      showSpeechCard: true,
      compactEnReference: false,
      compactPtReference: false
    };
  }

  if (manualSelectedPanel === 'pt') {
    return {
      activePanel: 'pt',
      isFocusedMode: true,
      showPtCard: true,
      showEnCard: false,
      showLiteralCard: false,
      showSpeechCard: false,
      compactEnReference: false,
      compactPtReference: false
    };
  }

  if (manualSelectedPanel === 'literal') {
    return {
      activePanel: 'literal',
      isFocusedMode: true,
      showPtCard: false,
      showEnCard: false,
      showLiteralCard: true,
      showSpeechCard: false,
      compactEnReference: false,
      compactPtReference: false
    };
  }

  if (manualSelectedPanel === 'speak') {
    const showBlindPtRef = isEnglishTextHidden || (isBlindEnglishStage && !blindEnglishUnlocked);
    return {
      activePanel: 'speak',
      isFocusedMode: true,
      showPtCard: showBlindPtRef,
      showEnCard: !showBlindPtRef,
      showLiteralCard: false,
      showSpeechCard: true,
      compactEnReference: !showBlindPtRef,
      compactPtReference: showBlindPtRef
    };
  }

  // Default: 'en'
  return {
    activePanel: 'en',
    isFocusedMode: true,
    showPtCard: false,
    showEnCard: true,
    showLiteralCard: false,
    showSpeechCard: false,
    compactEnReference: false,
    compactPtReference: false
  };
}

export interface DynamicViewportParams {
  innerHeight: number;
  visualViewportHeight?: number | null;
  visualViewportScale?: number | null;
  isTextInputFocused?: boolean;
}

/**
 * Computes the exact visible viewport height in CSS pixels for real mobile browsers
 * where `100vh` overlaps the browser's bottom toolbar/address bar.
 */
export function resolveDynamicViewportHeightPx({
  innerHeight,
  visualViewportHeight,
  visualViewportScale = 1,
  isTextInputFocused = false
}: DynamicViewportParams): number | null {
  if (!Number.isFinite(innerHeight) || innerHeight <= 0) {
    return null;
  }

  const scale =
    typeof visualViewportScale === 'number' && Number.isFinite(visualViewportScale)
      ? visualViewportScale
      : 1;

  const hasValidVisualViewport =
    typeof visualViewportHeight === 'number' &&
    Number.isFinite(visualViewportHeight) &&
    visualViewportHeight > 0;

  if (!isTextInputFocused && hasValidVisualViewport && scale <= 1.02) {
    return Math.max(280, Math.round(Math.min(innerHeight, visualViewportHeight as number)));
  }

  return Math.max(280, Math.round(innerHeight));
}

/**
 * Detects mobile/tablet browsers (iOS, iPadOS, Android) where hardware audio focus
 * is exclusive and Web APIs behave differently from desktop browsers.
 */
export function isMobileOrTouchBrowser(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0
): boolean {
  const ua = (userAgent || '').toLowerCase();
  if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/.test(ua)) {
    return true;
  }
  // iPadOS desktop-class Safari reports Macintosh UA + multi-touch points > 1
  if (ua.includes('macintosh') && maxTouchPoints > 1) {
    return true;
  }
  return false;
}

/**
 * On Android/iOS mobile browsers, opening a concurrent MediaRecorder stream via
 * navigator.mediaDevices.getUserMedia while SpeechRecognition is starting often
 * steals exclusive hardware audio focus and causes 'audio-capture' / 'aborted' errors.
 * We only run concurrent MediaRecorder on desktop browsers for multi-word sentences.
 */
export function shouldUseConcurrentMediaRecorder({
  userAgent,
  maxTouchPoints,
  isSingleWord = false
}: MobileMediaCapabilitiesParams = {}): boolean {
  if (isSingleWord) return false;
  if (isMobileOrTouchBrowser(userAgent, maxTouchPoints)) return false;
  return true;
}

/**
 * Merges SpeechRecognitionResultList segments safely without duplicating overlapping
 * final chunks emitted by Android Chrome Web Speech implementations.
 */
export function extractCumulativeTranscriptFromResults(
  results: ArrayLike<SpeechResultItemLike>
): { finalText: string; interimText: string; combinedText: string } {
  const finalSegments: string[] = [];
  let interimText = '';

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    if (!item) continue;
    const raw = String(item[0]?.transcript || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!raw) continue;

    if (item.isFinal) {
      const prevCumulative = finalSegments.join(' ').trim();
      const rawLower = raw.toLowerCase();
      const prevLower = prevCumulative.toLowerCase();
      const lastSegLower =
        finalSegments.length > 0 ? finalSegments[finalSegments.length - 1].toLowerCase() : '';

      // Android Chrome sometimes repeats the exact last final chunk or emits the entire cumulative string as a new final chunk
      if (rawLower === lastSegLower) {
        continue;
      }
      if (prevLower && rawLower.startsWith(prevLower + ' ')) {
        const suffix = raw.slice(prevCumulative.length).trim();
        if (suffix) finalSegments.push(suffix);
        continue;
      }
      finalSegments.push(raw);
    } else {
      interimText = interimText ? `${interimText} ${raw}` : raw;
    }
  }

  const finalText = finalSegments.join(' ').replace(/\s+/g, ' ').trim();
  const cleanInterim = interimText.replace(/\s+/g, ' ').trim();
  const combinedText = [finalText, cleanInterim].filter(Boolean).join(' ').trim();

  return {
    finalText,
    interimText: cleanInterim,
    combinedText
  };
}
