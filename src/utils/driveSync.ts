import {
  Book,
  DailyStatEntry,
  PedagogicalSettings,
  SentenceProgress,
  StudyStats,
  VocabItem
} from '../types/shadowreader';

export const DRIVE_SYNC_FILENAME = 'teacher-reader-sync-v1.json';
export const DRIVE_SYNC_MIME_TYPE = 'application/json';

export interface DriveBackupSnapshot {
  version: 1;
  updatedAt: string;
  deviceLabel: string;
  activeBookId: string;
  bookmarks: Record<string, number>;
  books: Book[];
  vocab: VocabItem[];
  stats: StudyStats;
  settings: PedagogicalSettings;
}

export interface SnapshotSummary {
  booksCount: number;
  customBooksCount: number;
  vocabCount: number;
  totalSentencesCompleted: number;
  bestStreak: number;
  updatedAt: string;
}

export type SyncDecision =
  | 'needs_initial_upload_confirm'
  | 'no_op'
  | 'pull_remote_auto'
  | 'push_local_auto'
  | 'needs_merge_confirm';

function sanitizeBook(raw: any): Book | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.title !== 'string') return null;
  if (!Array.isArray(raw.sentences) || raw.sentences.length === 0) return null;

  const validSentences = raw.sentences.filter(
    (s: any) => s && typeof s.en === 'string' && s.en.trim().length > 0
  );
  if (validSentences.length === 0) return null;

  const currentIndex = Math.max(
    0,
    Math.min(Number(raw.currentIndex) || 0, validSentences.length - 1)
  );
  const progressMap: Record<number, SentenceProgress> = {};
  if (raw.sentenceProgress && typeof raw.sentenceProgress === 'object') {
    for (const [k, v] of Object.entries(raw.sentenceProgress)) {
      const idx = Number(k);
      if (!Number.isInteger(idx) || idx < 0 || !v || typeof v !== 'object') continue;
      const prog = v as any;
      progressMap[idx] = {
        completed: Boolean(prog.completed),
        bestScore: Math.max(0, Math.min(100, Number(prog.bestScore) || 0)),
        attempts: Math.max(0, Number(prog.attempts) || 0),
        lastPracticed: typeof prog.lastPracticed === 'string' ? prog.lastPracticed : undefined
      };
    }
  }

  return {
    ...raw,
    id: raw.id.trim(),
    title: raw.title,
    author: typeof raw.author === 'string' ? raw.author : 'Upload do Usuário',
    sentences: validSentences,
    totalSentences: validSentences.length,
    currentIndex,
    lastRead: typeof raw.lastRead === 'string' ? raw.lastRead : new Date(0).toISOString(),
    progressPercent: Math.round(((currentIndex + 1) / validSentences.length) * 100),
    sentenceProgress: progressMap
  };
}

export function parseDriveBackupSnapshot(raw: unknown): DriveBackupSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, any>;
  if (obj.version !== 1) return null;
  if (!obj.settings || typeof obj.settings !== 'object') return null;
  if (!obj.stats || typeof obj.stats !== 'object') return null;

  const books = Array.isArray(obj.books)
    ? obj.books.map(sanitizeBook).filter((b): b is Book => b !== null)
    : [];

  const bookmarks: Record<string, number> = {};
  if (obj.bookmarks && typeof obj.bookmarks === 'object') {
    for (const [k, v] of Object.entries(obj.bookmarks)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) {
        bookmarks[k] = Math.floor(n);
      }
    }
  }

  const vocab: VocabItem[] = Array.isArray(obj.vocab)
    ? obj.vocab.filter(
        (v: any) => v && typeof v.word === 'string' && typeof v.sentence === 'string'
      )
    : [];

  const stats: StudyStats = {
    totalSentencesCompleted: Math.max(0, Number(obj.stats.totalSentencesCompleted) || 0),
    bestStreak: Math.max(0, Number(obj.stats.bestStreak) || 0),
    masteredWords: Array.isArray(obj.stats.masteredWords)
      ? obj.stats.masteredWords.filter((w: any) => typeof w === 'string')
      : [],
    trickyWords:
      obj.stats.trickyWords && typeof obj.stats.trickyWords === 'object'
        ? { ...obj.stats.trickyWords }
        : {},
    dailyHistory:
      obj.stats.dailyHistory && typeof obj.stats.dailyHistory === 'object'
        ? { ...obj.stats.dailyHistory }
        : {}
  };

  return {
    version: 1,
    updatedAt:
      typeof obj.updatedAt === 'string' && !Number.isNaN(Date.parse(obj.updatedAt))
        ? obj.updatedAt
        : new Date(0).toISOString(),
    deviceLabel: typeof obj.deviceLabel === 'string' ? obj.deviceLabel : 'Dispositivo',
    activeBookId: typeof obj.activeBookId === 'string' ? obj.activeBookId : '',
    bookmarks,
    books,
    vocab,
    stats,
    settings: obj.settings as PedagogicalSettings
  };
}

/**
 * Deterministic fingerprint excluding volatile metadata (`updatedAt`, `deviceLabel`, `lastRead`)
 * so identical content never causes redundant cloud writes or false conflicts.
 */
export function computeSnapshotFingerprint(snapshot: DriveBackupSnapshot): string {
  const sortedBookmarks = Object.keys(snapshot.bookmarks)
    .sort()
    .map(k => [k, snapshot.bookmarks[k]]);

  const normalizedBooks = [...snapshot.books]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(b => ({
      id: b.id,
      title: b.title,
      currentIndex: b.currentIndex || 0,
      sentenceCount: b.sentences.length,
      sentenceProgress: Object.keys(b.sentenceProgress || {})
        .sort()
        .map(k => {
          const idx = Number(k);
          const p = b.sentenceProgress?.[idx];
          return [idx, Boolean(p?.completed), p?.bestScore || 0, p?.attempts || 0];
        })
    }));

  const normalizedVocab = [...snapshot.vocab]
    .map(v => `${v.word}::${v.sentence}::${v.repetition || 0}::${v.nextReviewDate || ''}`)
    .sort();

  const normalizedStats = {
    totalSentencesCompleted: snapshot.stats.totalSentencesCompleted || 0,
    bestStreak: snapshot.stats.bestStreak || 0,
    masteredWords: [...(snapshot.stats.masteredWords || [])].sort(),
    trickyWords: Object.keys(snapshot.stats.trickyWords || {})
      .sort()
      .map(k => [k, snapshot.stats.trickyWords[k]]),
    dailyHistory: Object.keys(snapshot.stats.dailyHistory || {})
      .sort()
      .map(k => [k, snapshot.stats.dailyHistory[k]])
  };

  const canonical = JSON.stringify({
    version: snapshot.version,
    activeBookId: snapshot.activeBookId,
    bookmarks: sortedBookmarks,
    books: normalizedBooks,
    vocab: normalizedVocab,
    stats: normalizedStats,
    settings: snapshot.settings
  });

  // Fast FNV-1a 64-bit-like hex digest (two 32-bit lanes)
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}-${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function summarizeSnapshot(snapshot: DriveBackupSnapshot): SnapshotSummary {
  const customBooksCount = snapshot.books.filter(
    b => b.id.startsWith('book_') || b.id.startsWith('custom_')
  ).length;
  return {
    booksCount: snapshot.books.length,
    customBooksCount,
    vocabCount: snapshot.vocab.length,
    totalSentencesCompleted: snapshot.stats.totalSentencesCompleted || 0,
    bestStreak: snapshot.stats.bestStreak || 0,
    updatedAt: snapshot.updatedAt
  };
}

export function hasSubstantiveLocalData(snapshot: DriveBackupSnapshot): boolean {
  const hasStats =
    (snapshot.stats.totalSentencesCompleted || 0) > 0 ||
    (snapshot.stats.masteredWords?.length || 0) > 0 ||
    Object.keys(snapshot.stats.dailyHistory || {}).length > 0;
  const hasVocab = snapshot.vocab.length > 0;
  const hasCustomBooks = snapshot.books.some(
    b => b.id.startsWith('book_') || b.id.startsWith('custom_')
  );
  const hasAdvancedBookmark = Object.values(snapshot.bookmarks).some(idx => idx > 0);
  const hasBookProgress = snapshot.books.some(
    b => (b.currentIndex || 0) > 0 || Object.keys(b.sentenceProgress || {}).length > 0
  );
  return hasStats || hasVocab || hasCustomBooks || hasAdvancedBookmark || hasBookProgress;
}

function mergeSentenceProgressMaps(
  a: Record<number, SentenceProgress> | undefined,
  b: Record<number, SentenceProgress> | undefined
): Record<number, SentenceProgress> {
  const merged: Record<number, SentenceProgress> = {};
  const keys = new Set([
    ...Object.keys(a || {}).map(Number),
    ...Object.keys(b || {}).map(Number)
  ]);

  for (const idx of keys) {
    if (!Number.isInteger(idx) || idx < 0) continue;
    const pa = a?.[idx];
    const pb = b?.[idx];
    if (pa && !pb) {
      merged[idx] = { ...pa };
    } else if (!pa && pb) {
      merged[idx] = { ...pb };
    } else if (pa && pb) {
      const aTime = Date.parse(pa.lastPracticed || '') || 0;
      const bTime = Date.parse(pb.lastPracticed || '') || 0;
      merged[idx] = {
        completed: Boolean(pa.completed || pb.completed),
        bestScore: Math.max(pa.bestScore || 0, pb.bestScore || 0),
        attempts: Math.max(pa.attempts || 0, pb.attempts || 0),
        lastPracticed: aTime >= bTime ? pa.lastPracticed : pb.lastPracticed
      };
    }
  }
  return merged;
}

export function mergeDriveSnapshots(
  local: DriveBackupSnapshot,
  remote: DriveBackupSnapshot
): DriveBackupSnapshot {
  const localTime = Date.parse(local.updatedAt) || 0;
  const remoteTime = Date.parse(remote.updatedAt) || 0;
  const remoteIsNewer = remoteTime > localTime;

  // 1. Merge Books by id
  const bookMap = new Map<string, Book>();
  for (const b of local.books) {
    bookMap.set(b.id, b);
  }
  for (const rb of remote.books) {
    const lb = bookMap.get(rb.id);
    if (!lb) {
      bookMap.set(rb.id, rb);
      continue;
    }
    const lRead = Date.parse(lb.lastRead || '') || 0;
    const rRead = Date.parse(rb.lastRead || '') || 0;
    const primary = rRead > lRead ? rb : lb;
    const secondary = rRead > lRead ? lb : rb;
    const chosenSentences =
      primary.sentences.length >= secondary.sentences.length
        ? primary.sentences
        : secondary.sentences;
    const mergedProgress = mergeSentenceProgressMaps(lb.sentenceProgress, rb.sentenceProgress);
    const total = chosenSentences.length || 1;
    const currentIndex = Math.max(0, Math.min(primary.currentIndex || 0, total - 1));

    bookMap.set(rb.id, {
      ...secondary,
      ...primary,
      sentences: chosenSentences,
      totalSentences: total,
      currentIndex,
      progressPercent: Math.round(((currentIndex + 1) / total) * 100),
      sentenceProgress: mergedProgress
    });
  }

  const mergedBooks = Array.from(bookMap.values()).sort(
    (a, b) => (Date.parse(b.lastRead || '') || 0) - (Date.parse(a.lastRead || '') || 0)
  );

  // 2. Merge Bookmarks
  const mergedBookmarks: Record<string, number> = { ...local.bookmarks };
  for (const [bookId, remoteIdx] of Object.entries(remote.bookmarks)) {
    const localIdx = mergedBookmarks[bookId];
    if (localIdx === undefined) {
      mergedBookmarks[bookId] = remoteIdx;
    } else {
      const lb = local.books.find(b => b.id === bookId);
      const rb = remote.books.find(b => b.id === bookId);
      const lRead = Date.parse(lb?.lastRead || '') || 0;
      const rRead = Date.parse(rb?.lastRead || '') || 0;
      if (rRead !== lRead) {
        mergedBookmarks[bookId] = rRead > lRead ? remoteIdx : localIdx;
      } else {
        mergedBookmarks[bookId] = remoteIsNewer ? remoteIdx : Math.max(localIdx, remoteIdx);
      }
    }
  }

  // 3. Merge Vocab
  const vocabMap = new Map<string, VocabItem>();
  const vocabKey = (v: VocabItem) =>
    `${v.word.trim().toLowerCase()}::${v.sentence.trim().toLowerCase()}`;

  for (const item of [...local.vocab, ...remote.vocab]) {
    const key = vocabKey(item);
    const existing = vocabMap.get(key);
    if (!existing) {
      vocabMap.set(key, item);
      continue;
    }
    const existingRep = existing.repetition || 0;
    const nextRep = item.repetition || 0;
    const existingReview = Date.parse(existing.nextReviewDate || '') || 0;
    const nextReview = Date.parse(item.nextReviewDate || '') || 0;
    if (nextRep > existingRep || (nextRep === existingRep && nextReview > existingReview)) {
      vocabMap.set(key, item);
    }
  }

  // 4. Merge Study Stats
  const masteredSet = new Set([
    ...(local.stats.masteredWords || []),
    ...(remote.stats.masteredWords || [])
  ]);
  const trickyWords: Record<string, number> = { ...(local.stats.trickyWords || {}) };
  for (const [word, count] of Object.entries(remote.stats.trickyWords || {})) {
    trickyWords[word] = Math.max(trickyWords[word] || 0, count || 0);
  }

  const dailyHistory: Record<string, DailyStatEntry> = {
    ...(local.stats.dailyHistory || {})
  };
  for (const [dateKey, rEntry] of Object.entries(remote.stats.dailyHistory || {})) {
    const lEntry = dailyHistory[dateKey];
    if (!lEntry) {
      dailyHistory[dateKey] = rEntry;
    } else {
      dailyHistory[dateKey] = {
        dateKey,
        sentencesPracticed: Math.max(
          lEntry.sentencesPracticed || 0,
          rEntry.sentencesPracticed || 0
        ),
        totalScoreSum: Math.max(lEntry.totalScoreSum || 0, rEntry.totalScoreSum || 0),
        evaluationsCount: Math.max(lEntry.evaluationsCount || 0, rEntry.evaluationsCount || 0)
      };
    }
  }

  const dailySum = Object.values(dailyHistory).reduce(
    (sum, d) => sum + (d.sentencesPracticed || 0),
    0
  );

  const mergedStats: StudyStats = {
    totalSentencesCompleted: Math.max(
      local.stats.totalSentencesCompleted || 0,
      remote.stats.totalSentencesCompleted || 0,
      dailySum
    ),
    bestStreak: Math.max(local.stats.bestStreak || 0, remote.stats.bestStreak || 0),
    masteredWords: Array.from(masteredSet),
    trickyWords,
    dailyHistory
  };

  return {
    version: 1,
    updatedAt: new Date(Math.max(localTime, remoteTime, Date.now())).toISOString(),
    deviceLabel: local.deviceLabel || remote.deviceLabel,
    activeBookId: remoteIsNewer
      ? remote.activeBookId || local.activeBookId
      : local.activeBookId || remote.activeBookId,
    bookmarks: mergedBookmarks,
    books: mergedBooks,
    vocab: Array.from(vocabMap.values()),
    stats: mergedStats,
    settings: remoteIsNewer ? { ...remote.settings } : { ...local.settings }
  };
}

export function classifySyncDecision(params: {
  local: DriveBackupSnapshot;
  remote: DriveBackupSnapshot | null;
  lastSyncedFingerprint?: string | null;
}): SyncDecision {
  const { local, remote, lastSyncedFingerprint } = params;
  const localFp = computeSnapshotFingerprint(local);

  if (!remote) {
    return 'needs_initial_upload_confirm';
  }

  const remoteFp = computeSnapshotFingerprint(remote);
  if (localFp === remoteFp) {
    return 'no_op';
  }

  // Pristine device with no local progress can safely restore remote automatically
  if (!hasSubstantiveLocalData(local) && hasSubstantiveLocalData(remote)) {
    return 'pull_remote_auto';
  }

  if (lastSyncedFingerprint) {
    // Only remote changed since last sync
    if (localFp === lastSyncedFingerprint && remoteFp !== lastSyncedFingerprint) {
      return 'pull_remote_auto';
    }
    // Only local changed since last sync
    if (remoteFp === lastSyncedFingerprint && localFp !== lastSyncedFingerprint) {
      return 'push_local_auto';
    }
  }

  // Both sides have independent changes or first connection between two active devices
  return 'needs_merge_confirm';
}
