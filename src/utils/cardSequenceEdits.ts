/**
 * Pure helpers for editing ordered, repeatable card lists (study steps and
 * visual cards). Extracted from `SettingsModal.tsx` so the "move / repeat /
 * remove" rules — including the minimum-length guard — are testable without a
 * browser.
 */

import { AudioFlow, PedagogicalSettings, StudyStepCardType } from '../types/shadowreader';

/**
 * Returns a new array with the item moved by `delta` positions, or `null` when
 * the move is impossible (out of bounds, non-integer index or delta).
 */
export function moveOrderItem<T>(
  order: readonly T[],
  index: number,
  delta: number
): T[] | null {
  if (!Array.isArray(order) || order.length === 0) return null;
  if (!Number.isInteger(index) || !Number.isInteger(delta) || delta === 0) return null;
  const targetIdx = index + delta;
  if (index < 0 || index >= order.length || targetIdx < 0 || targetIdx >= order.length) {
    return null;
  }
  const next = [...order];
  const [moved] = next.splice(index, 1);
  next.splice(targetIdx, 0, moved);
  return next;
}

/** Duplicates the item at `index` right after itself. */
export function duplicateOrderItem<T>(order: readonly T[], index: number): T[] | null {
  if (!Array.isArray(order) || order.length === 0) return null;
  if (!Number.isInteger(index) || index < 0 || index >= order.length) return null;
  const next = [...order];
  next.splice(index + 1, 0, order[index]);
  return next;
}

/**
 * Removes the item at `index`, refusing to go below `minLength` (the engine
 * needs at least one step/card to run).
 */
export function removeOrderItem<T>(
  order: readonly T[],
  index: number,
  minLength = 1
): T[] | null {
  if (!Array.isArray(order) || order.length <= Math.max(1, minLength)) return null;
  if (!Number.isInteger(index) || index < 0 || index >= order.length) return null;
  return order.filter((_, idx) => idx !== index);
}

/** Appends an item to the end of the list. */
export function appendOrderItem<T>(order: readonly T[], item: T): T[] {
  return Array.isArray(order) ? [...order, item] : [item];
}

export interface OccurrenceInfo {
  /** 1-based position among equal items ("2ª vez"). */
  occurrence: number;
  /** How many times this item appears in the whole list. */
  total: number;
  isRepeated: boolean;
}

/** Per-index occurrence info, used for the "🔁 2ª vez" badges. */
export function buildOccurrenceInfo<T>(order: readonly T[]): OccurrenceInfo[] {
  if (!Array.isArray(order)) return [];
  const totals = new Map<T, number>();
  order.forEach(item => totals.set(item, (totals.get(item) ?? 0) + 1));

  const seen = new Map<T, number>();
  return order.map(item => {
    const occurrence = (seen.get(item) ?? 0) + 1;
    seen.set(item, occurrence);
    const total = totals.get(item) ?? 1;
    return { occurrence, total, isRepeated: total > 1 };
  });
}

/**
 * Rebuilds the legacy boolean flags the study engine still reads
 * (`enableBlindSpeakingStage`, `readWordsOnSuccess`, `enablePostSentenceChallenges`,
 * …) from the explicit card sequence. Single source of truth: the sequence.
 */
export function buildLegacyFlagsForSequence(
  sequence: StudyStepCardType[],
  flow: AudioFlow
): Partial<PedagogicalSettings> {
  const seq = Array.isArray(sequence) ? sequence : [];
  const hasBlindStep = seq.includes('speak_blind_en');
  const hasLiteralStep = seq.includes('literal');
  const hasBothChallenges = seq.includes('challenges');
  const hasPronChallenge = hasBothChallenges || seq.includes('challenge_pronunciation');
  const hasMatchChallenge = hasBothChallenges || seq.includes('challenge_matching');
  const hasAnyChallenge = hasPronChallenge || hasMatchChallenge;

  return {
    audioFlow: flow,
    cardSequence: seq,
    enableBlindSpeakingStage: hasBlindStep,
    readWordsOnSuccess: hasLiteralStep,
    enablePostSentenceChallenges: hasAnyChallenge,
    enableWordPronunciationChallenge: hasPronChallenge,
    enableWordMatchingChallenge: hasMatchChallenge
  };
}
