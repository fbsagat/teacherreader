import { SentenceProgress } from '../types/shadowreader';

export interface BookProgressSummary {
  /** Number of sentences whose final full-sentence speaking pass was approved. */
  completedCount: number;
  total: number;
  /** 0-100. Reaches 100 only when every sentence is completed. */
  percent: number;
  isComplete: boolean;
}

/**
 * Book progress is measured by mastery, not by reading position: a sentence only
 * counts once `sentenceProgress[idx].completed` is true (final full-sentence
 * speaking pass approved). Reading position stays in `currentIndex`/bookmarks.
 *
 * Pure and defensive: ignores non-integer/negative/out-of-range keys and never
 * reports 100% while at least one sentence is still pending.
 */
export function computeBookProgress(
  total: number,
  progress: Record<number, SentenceProgress> | null | undefined
): BookProgressSummary {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  if (safeTotal === 0) {
    return { completedCount: 0, total: 0, percent: 0, isComplete: false };
  }

  const seen = new Set<number>();
  for (const [key, value] of Object.entries(progress || {})) {
    if (!value || value.completed !== true) continue;
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= safeTotal) continue;
    seen.add(idx);
  }

  const completedCount = Math.min(seen.size, safeTotal);
  const isComplete = completedCount === safeTotal;
  const percent = isComplete ? 100 : Math.min(99, Math.round((completedCount / safeTotal) * 100));

  return { completedCount, total: safeTotal, percent, isComplete };
}

/**
 * Convenience wrapper for the UI/backup paths that already carry a Book-shaped
 * object with `sentences`/`totalSentences` and `sentenceProgress`.
 */
export function computeBookProgressFromBook(book: {
  sentences?: unknown[];
  totalSentences?: number;
  sentenceProgress?: Record<number, SentenceProgress>;
}): BookProgressSummary {
  const total =
    typeof book.totalSentences === 'number' && book.totalSentences > 0
      ? book.totalSentences
      : Array.isArray(book.sentences)
        ? book.sentences.length
        : 0;
  return computeBookProgress(total, book.sentenceProgress);
}
