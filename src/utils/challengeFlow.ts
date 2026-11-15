import { HandsFreeChallengeMode } from '../types/shadowreader';
import {
  calculateSimilarity,
  cleanSpeech,
  cleanString,
  isWordMatch,
  normalizeSpokenTranscriptNumbers
} from './shadowing';

export type PronounceButtonAction =
  | 'ignore'
  | 'stop_listening_early'
  | 'fast_forward_hands_free'
  | 'manual_listen';

export interface ResolvePronounceButtonInput {
  isOpen: boolean;
  hasActiveWord: boolean;
  isListening: boolean;
  isAdvancingWord: boolean;
  pronStatus: 'idle' | 'success' | 'error' | 'no_speech';
  autoHandsFree: boolean;
  handsFreeChallengeMode: HandsFreeChallengeMode;
}

/**
 * Determines the exact single-execution action when the user clicks "Pronunciar <palavra>"
 * in Stage 1 of PostSentenceChallengeModal.
 * Prevents duplicate mic captures when Hands-Free mode is preparing/speaking intro audio.
 */
export function resolvePronounceButtonAction(
  input: ResolvePronounceButtonInput
): PronounceButtonAction {
  if (!input.isOpen || !input.hasActiveWord) {
    return 'ignore';
  }
  if (input.isAdvancingWord || input.pronStatus === 'success') {
    return 'ignore';
  }
  if (input.isListening) {
    return 'stop_listening_early';
  }
  if (input.autoHandsFree && input.handsFreeChallengeMode !== 'auto_review') {
    return 'fast_forward_hands_free';
  }
  return 'manual_listen';
}

export interface WordPronunciationEvalResult {
  trimmedRaw: string;
  passed: boolean;
  score: number;
}

/**
 * Shared single-word pronunciation evaluator for both Hands-Free and Manual flows.
 */
export function evaluateWordPronunciation(
  targetWord: string,
  spokenRaw: string
): WordPronunciationEvalResult {
  const normalizedSpoken = normalizeSpokenTranscriptNumbers(spokenRaw || '', targetWord).trim();
  const trimmedRaw = normalizedSpoken;
  if (!trimmedRaw) {
    return { trimmedRaw: '', passed: false, score: 0 };
  }

  const cleanTarget = cleanString(targetWord);
  const cleanSpoken = cleanString(trimmedRaw);
  const spokenTokens = cleanSpeech(trimmedRaw).split(/\s+/).filter(Boolean);
  const { score } = calculateSimilarity(targetWord, trimmedRaw);

  const passed =
    score >= 70 ||
    (Boolean(cleanTarget) && cleanSpoken === cleanTarget) ||
    (Boolean(cleanTarget) && cleanSpoken.includes(cleanTarget)) ||
    isWordMatch(targetWord, cleanSpoken) ||
    spokenTokens.some(tok => isWordMatch(targetWord, tok));

  return {
    trimmedRaw,
    passed,
    score: passed ? Math.max(score, 92) : score
  };
}
