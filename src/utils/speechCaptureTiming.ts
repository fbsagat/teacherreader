import { SttSilencePauseMode } from '../types/shadowreader';
import { getAdaptiveSilenceDebounceMs } from './shadowing';

export interface SpeechCaptureTimingPlan {
  preSpeechWaitMs: number;
  postSpeechDebounceMs: number;
  postInterimGraceMs: number;
  fullMatchSettleMs: number;
  activeSpeechMaxExtensionMs: number;
  startupSettleDelayMs: number;
}

export interface ComputeSpeechCaptureTimingInput {
  targetSentence: string;
  isSingleWord: boolean;
  pauseMode: SttSilencePauseMode;
  autoHandsFree: boolean;
  requestedMaxTimeoutMs?: number;
}

export function getSingleWordSilenceDebounceMs(pauseMode: SttSilencePauseMode = 'normal'): number {
  if (pauseMode === 'long') return 1750;
  if (pauseMode === 'short') return 900;
  return 1250;
}

/**
 * Computes generous pre-speech waiting room (so users can think/breathe before talking
 * and slow mic hardware warm-up never steals capture time) plus comfortable post-speech
 * settling windows so final syllables are never clipped.
 */
export function computeSpeechCaptureTimingPlan({
  targetSentence,
  isSingleWord,
  pauseMode,
  autoHandsFree,
  requestedMaxTimeoutMs
}: ComputeSpeechCaptureTimingInput): SpeechCaptureTimingPlan {
  let preSpeechWaitMs: number;
  if (autoHandsFree) {
    preSpeechWaitMs = isSingleWord ? 8500 : 12500;
  } else {
    const defaultFloor = isSingleWord ? 12500 : 19000;
    preSpeechWaitMs = Math.max(requestedMaxTimeoutMs ?? defaultFloor, defaultFloor);
  }

  if (pauseMode === 'long') {
    preSpeechWaitMs = Math.round(preSpeechWaitMs * 1.25);
  } else if (pauseMode === 'short') {
    preSpeechWaitMs = Math.max(isSingleWord ? 6500 : 9500, Math.round(preSpeechWaitMs * 0.85));
  }

  const postSpeechDebounceMs = isSingleWord
    ? getSingleWordSilenceDebounceMs(pauseMode)
    : getAdaptiveSilenceDebounceMs(targetSentence, pauseMode);

  const postInterimGraceMs = isSingleWord ? 240 : 380;

  const fullMatchSettleMs = isSingleWord
    ? pauseMode === 'long'
      ? 850
      : pauseMode === 'short'
        ? 500
        : 650
    : pauseMode === 'long'
      ? 1450
      : pauseMode === 'short'
        ? 900
        : 1150;

  const activeSpeechMaxExtensionMs = isSingleWord ? 4500 : 8500;
  const startupSettleDelayMs = 90;

  return {
    preSpeechWaitMs,
    postSpeechDebounceMs,
    postInterimGraceMs,
    fullMatchSettleMs,
    activeSpeechMaxExtensionMs,
    startupSettleDelayMs
  };
}

export interface ComputeDeadlineExtensionInput {
  nowMs: number;
  lastSpeechActivityAt: number;
  postSpeechDebounceMs: number;
  totalExtensionGrantedMs: number;
  activeSpeechMaxExtensionMs: number;
  isSpeechActive: boolean;
}

/**
 * Prevents the overall capture deadline from cutting the user off mid-sentence
 * if they started speaking near the end of the pre-speech wait window.
 */
export function computeDeadlineExtensionMs({
  nowMs,
  lastSpeechActivityAt,
  postSpeechDebounceMs,
  totalExtensionGrantedMs,
  activeSpeechMaxExtensionMs,
  isSpeechActive
}: ComputeDeadlineExtensionInput): number {
  const remainingBudget = activeSpeechMaxExtensionMs - totalExtensionGrantedMs;
  if (remainingBudget <= 0) return 0;

  const recentlyActive =
    lastSpeechActivityAt > 0 && nowMs - lastSpeechActivityAt < postSpeechDebounceMs + 700;

  if (!isSpeechActive && !recentlyActive) {
    return 0;
  }

  return Math.min(postSpeechDebounceMs + 800, remainingBudget);
}

export type RecognitionOnEndDecision = 'complete' | 'restart_fresh' | 'restart_append';

export interface RecognitionOnEndDecisionInput {
  lastSpokenText: string;
  hasSpeechStarted: boolean;
  isFullMatchSettled: boolean;
  isSingleWord: boolean;
  remainingMs: number;
  msSinceLastResult: number;
  postSpeechDebounceMs: number;
  partialRestartCount: number;
}

/**
 * Decides what to do when Web Speech API fires `onend`:
 * - Keeps waiting before speech starts while time remains in the capture window.
 * - Recovers gracefully if mobile/desktop Chrome terminates `continuous` capture right
 *   after a partial clause before the user finished the full sentence.
 */
export function evaluateRecognitionOnEnd({
  lastSpokenText,
  hasSpeechStarted,
  isFullMatchSettled,
  isSingleWord,
  remainingMs,
  msSinceLastResult,
  postSpeechDebounceMs,
  partialRestartCount
}: RecognitionOnEndDecisionInput): RecognitionOnEndDecision {
  const hasText = lastSpokenText.trim().length > 0;

  if (!hasText) {
    if (remainingMs > 650 || (hasSpeechStarted && remainingMs > 200)) {
      return 'restart_fresh';
    }
    return 'complete';
  }

  if (isFullMatchSettled || isSingleWord) {
    return 'complete';
  }

  if (
    partialRestartCount < 2 &&
    remainingMs > 1200 &&
    msSinceLastResult < Math.min(1300, Math.round(postSpeechDebounceMs * 0.6))
  ) {
    return 'restart_append';
  }

  return 'complete';
}

/**
 * Merges a committed transcript prefix (before a premature Chrome `onend` restart)
 * with the current recognition session's cumulative transcript without duplicating boundary words.
 */
export function mergeTranscriptWithPrefix(prefix: string, currentSessionText: string): string {
  const cleanPrefix = (prefix || '').replace(/\s+/g, ' ').trim();
  const cleanCurrent = (currentSessionText || '').replace(/\s+/g, ' ').trim();
  if (!cleanPrefix) return cleanCurrent;
  if (!cleanCurrent) return cleanPrefix;

  const prefixLower = cleanPrefix.toLowerCase();
  const currentLower = cleanCurrent.toLowerCase();
  if (currentLower.startsWith(prefixLower)) {
    return cleanCurrent;
  }
  if (prefixLower.endsWith(currentLower)) {
    return cleanPrefix;
  }

  const prefixWords = cleanPrefix.split(' ');
  const currentWords = cleanCurrent.split(' ');
  const maxOverlap = Math.min(4, prefixWords.length, currentWords.length);
  for (let overlap = maxOverlap; overlap >= 1; overlap--) {
    const tail = prefixWords.slice(-overlap).join(' ').toLowerCase();
    const head = currentWords.slice(0, overlap).join(' ').toLowerCase();
    if (tail === head) {
      return [...prefixWords, ...currentWords.slice(overlap)].join(' ').trim();
    }
  }

  return `${cleanPrefix} ${cleanCurrent}`.trim();
}
