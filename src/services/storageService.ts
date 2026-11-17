import {
  Book,
  PedagogicalSettings,
  SentenceProgress,
  StudyStats,
  VocabItem,
  WordMatchResult
} from '../types/shadowreader';
import { localDayKey } from '../utils/localTime';
import { computeBookProgress } from '../utils/bookProgress';
import { DEFAULT_SETTINGS, normalizeSettings } from '../utils/settingsNormalizer';

export { DEFAULT_SETTINGS };

const DB_NAME = 'ShadowReaderDB';
const DB_VERSION = 1;

export const DEFAULT_STATS: StudyStats = {
  totalSentencesCompleted: 0,
  bestStreak: 0,
  masteredWords: [],
  trickyWords: {},
  dailyHistory: {}
};

function openShadowDB(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('books')) {
        const store = db.createObjectStore('books', { keyPath: 'id' });
        store.createIndex('lastRead', 'lastRead', { unique: false });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function saveBookToDB(book: Book): Promise<boolean> {
  try {
    const db = await openShadowDB();
    if (!db) return false;
    const tx = db.transaction(['books', 'meta'], 'readwrite');
    const booksStore = tx.objectStore('books');
    const metaStore = tx.objectStore('meta');

    const curIdx = book.currentIndex || 0;
    const record: Book = {
      id: book.id,
      title: book.title,
      author: book.author || 'Upload do Usuário',
      totalSentences: book.sentences.length,
      currentIndex: curIdx,
      lastRead: new Date().toISOString(),
      progressPercent: computeBookProgress(book.sentences.length, book.sentenceProgress).percent,
      sentences: book.sentences,
      sentenceProgress: book.sentenceProgress || {}
    };

    booksStore.put(record);
    metaStore.put({ key: 'activeBookId', value: book.id });

    return new Promise(r => {
      tx.oncomplete = () => r(true);
      tx.onerror = () => r(false);
    });
  } catch {
    return false;
  }
}

export function getBookmarkFromLocalStorage(bookId: string): number | null {
  try {
    const raw = localStorage.getItem(`sr_bookmark_${bookId}`);
    if (raw === null) return null;
    const idx = Number(raw);
    if (!Number.isFinite(idx) || idx < 0) return null;
    return Math.floor(idx);
  } catch {
    return null;
  }
}

export function clearBookmarkFromLocalStorage(bookId: string, alsoClearActive: boolean): void {
  try {
    localStorage.removeItem(`sr_bookmark_${bookId}`);
    if (alsoClearActive) localStorage.removeItem('sr_active_book_id');
  } catch {
    // ignore storage errors
  }
}

export async function updateBookmarkInDB(
  bookId: string,
  currentIndex: number,
  sentenceProgressUpdate?: { index: number; progress: SentenceProgress }
): Promise<boolean> {
  try {
    localStorage.setItem(`sr_bookmark_${bookId}`, currentIndex.toString());
    localStorage.setItem('sr_active_book_id', bookId);
  } catch {
    // ignore storage errors
  }

  try {
    const db = await openShadowDB();
    if (!db) return true;
    const tx = db.transaction(['books', 'meta'], 'readwrite');
    const booksStore = tx.objectStore('books');
    const metaStore = tx.objectStore('meta');

    metaStore.put({ key: 'activeBookId', value: bookId });

    const getReq = booksStore.get(bookId);
    getReq.onsuccess = () => {
      const b = getReq.result as Book | undefined;
      if (b) {
        b.currentIndex = currentIndex;
        b.lastRead = new Date().toISOString();
        if (sentenceProgressUpdate) {
          b.sentenceProgress = {
            ...(b.sentenceProgress || {}),
            [sentenceProgressUpdate.index]: sentenceProgressUpdate.progress
          };
        }
        // Progress = mastery (completed sentences), recomputed from the final map.
        b.progressPercent = computeBookProgress(
          b.totalSentences || b.sentences.length,
          b.sentenceProgress
        ).percent;
        booksStore.put(b);
      }
    };

    return new Promise(r => {
      tx.oncomplete = () => r(true);
      tx.onerror = () => r(false);
    });
  } catch {
    return false;
  }
}

export async function loadAllSavedBooksFromDB(): Promise<Book[]> {
  try {
    const db = await openShadowDB();
    if (!db) return [];
    const tx = db.transaction('books', 'readonly');
    const store = tx.objectStore('books');
    const req = store.getAll();
    return new Promise(resolve => {
      req.onsuccess = () => {
        const books = (req.result as Book[]) || [];
        books.sort(
          (a, b) =>
            new Date(b.lastRead || 0).getTime() - new Date(a.lastRead || 0).getTime()
        );
        resolve(books);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function getBookFromDB(bookId: string): Promise<Book | null> {
  try {
    const db = await openShadowDB();
    if (!db) return null;
    const tx = db.transaction('books', 'readonly');
    const req = tx.objectStore('books').get(bookId);
    return new Promise(resolve => {
      req.onsuccess = () => resolve((req.result as Book) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function getActiveBookFromDB(): Promise<Book | null> {
  try {
    const db = await openShadowDB();
    if (!db) return null;
    const tx = db.transaction(['books', 'meta'], 'readonly');
    const metaReq = tx.objectStore('meta').get('activeBookId');
    return new Promise(resolve => {
      metaReq.onsuccess = () => {
        const activeId = metaReq.result?.value || localStorage.getItem('sr_active_book_id');
        if (!activeId) {
          resolve(null);
          return;
        }
        const bookReq = tx.objectStore('books').get(activeId);
        bookReq.onsuccess = () => resolve((bookReq.result as Book) || null);
        bookReq.onerror = () => resolve(null);
      };
      metaReq.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteBookFromDB(bookId: string): Promise<boolean> {
  try {
    const db = await openShadowDB();
    if (!db) return false;
    const tx = db.transaction('books', 'readwrite');
    tx.objectStore('books').delete(bookId);
    return new Promise(r => {
      tx.oncomplete = () => r(true);
      tx.onerror = () => r(false);
    });
  } catch {
    return false;
  }
}

export function loadSavedSettings(): PedagogicalSettings {
  try {
    const raw = localStorage.getItem('shadowreader_opts');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Keep the raw merge for the legacy migrations below; the final value is
      // always sanitized by normalizeSettings(merged).
      const merged: PedagogicalSettings = { ...DEFAULT_SETTINGS, ...parsed };
      if (!parsed._v2BlindOptIn) {
        merged.enableBlindSpeakingStage = false;
      }
      if (!Array.isArray(merged.cardSequence) || merged.cardSequence.length === 0) {
        if (merged.audioFlow === 'sandwich') {
          merged.cardSequence = ['pt', 'en', 'speak', 'literal', 'challenges'];
        } else if (merged.audioFlow === 'en_first') {
          merged.cardSequence = ['en', 'en_slow', 'pt', 'speak', 'challenges'];
        } else if (merged.audioFlow === 'blind_en') {
          merged.cardSequence = ['pt', 'en', 'speak', 'speak_blind_en', 'challenges'];
        } else if (merged.audioFlow === 'challenge') {
          merged.cardSequence = [
            'en',
            'speak_challenge',
            'pt',
            'speak_blind_en',
            'literal',
            'challenges'
          ];
        } else {
          merged.cardSequence = ['pt', 'en', 'speak', 'challenges'];
        }
      } else if (!parsed._v3UnifiedSteps) {
        const nextSeq = [...merged.cardSequence];
        if (merged.enableBlindSpeakingStage && !nextSeq.includes('speak_blind_en')) {
          nextSeq.push('speak_blind_en');
        }
        if (merged.readWordsOnSuccess && !nextSeq.includes('literal')) {
          nextSeq.push('literal');
        }
        const hasAnyChallengeStep = nextSeq.some(
          c =>
            c === 'challenges' ||
            c === 'challenge_pronunciation' ||
            c === 'challenge_matching'
        );
        if (merged.enablePostSentenceChallenges !== false && !hasAnyChallengeStep) {
          if (
            merged.enableWordPronunciationChallenge &&
            !merged.enableWordMatchingChallenge
          ) {
            nextSeq.push('challenge_pronunciation');
          } else if (
            !merged.enableWordPronunciationChallenge &&
            merged.enableWordMatchingChallenge
          ) {
            nextSeq.push('challenge_matching');
          } else {
            nextSeq.push('challenges');
          }
        }
        merged.cardSequence = nextSeq;
      }
      if (!Array.isArray(merged.visualCardOrder) || merged.visualCardOrder.length === 0) {
        if (merged.audioFlow === 'en_first') {
          merged.visualCardOrder = ['en', 'literal', 'pt'];
        } else if (merged.audioFlow === 'challenge') {
          merged.visualCardOrder = ['en', 'pt', 'literal'];
        } else {
          merged.visualCardOrder = ['pt', 'en', 'literal'];
        }
      }
      // Migrate the initial "auto" default to Gemini Neural TTS on first load.
      // Invalid/removed providers and every numeric field are handled by
      // normalizeSettings below.
      if (!parsed._v4GeminiDefault && merged.ttsEngine === 'auto') {
        merged.ttsEngine = 'gemini_tts';
      }
      return normalizeSettings(merged);
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export function persistSettings(settings: PedagogicalSettings): void {
  try {
    localStorage.setItem(
      'shadowreader_opts',
      JSON.stringify({
        ...settings,
        _v2BlindOptIn: true,
        _v3UnifiedSteps: true,
        _v4GeminiDefault: true,
        _v5FontScale: true
      })
    );
  } catch {
    // ignore
  }
}

export function loadSavedVocab(): VocabItem[] {
  try {
    const raw = localStorage.getItem('shadowreader_vocab');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

export function persistVocab(vocab: VocabItem[]): void {
  try {
    localStorage.setItem('shadowreader_vocab', JSON.stringify(vocab));
  } catch {
    // ignore
  }
}

export function loadStudyStats(): StudyStats {
  try {
    const raw = localStorage.getItem('shadowreader_stats');
    if (raw) {
      return { ...DEFAULT_STATS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_STATS };
}

export function persistStudyStats(stats: StudyStats): void {
  try {
    localStorage.setItem('shadowreader_stats', JSON.stringify(stats));
  } catch {
    // ignore
  }
}

export function recordEvaluationInStats(
  currentStats: StudyStats,
  score: number,
  passed: boolean,
  newStreak: number,
  wordResults: WordMatchResult[],
  sentenceCompleted: boolean = passed
): StudyStats {
  const todayKey = localDayKey();
  const prevDay = currentStats.dailyHistory[todayKey] || {
    dateKey: todayKey,
    sentencesPracticed: 0,
    totalScoreSum: 0,
    evaluationsCount: 0
  };

  const masteredSet = new Set(currentStats.masteredWords);
  const trickyMap = { ...currentStats.trickyWords };

  for (const w of wordResults) {
    if (!w.word || w.word.length < 2) continue;
    if (w.matched) {
      masteredSet.add(w.word);
    } else {
      trickyMap[w.word] = (trickyMap[w.word] || 0) + 1;
    }
  }

  const nextStats: StudyStats = {
    totalSentencesCompleted:
      currentStats.totalSentencesCompleted + (sentenceCompleted ? 1 : 0),
    bestStreak: Math.max(currentStats.bestStreak, newStreak),
    masteredWords: Array.from(masteredSet),
    trickyWords: trickyMap,
    dailyHistory: {
      ...currentStats.dailyHistory,
      [todayKey]: {
        dateKey: todayKey,
        sentencesPracticed: prevDay.sentencesPracticed + (sentenceCompleted ? 1 : 0),
        totalScoreSum: prevDay.totalScoreSum + score,
        evaluationsCount: prevDay.evaluationsCount + 1
      }
    }
  };

  persistStudyStats(nextStats);
  return nextStats;
}

export function exportLocalBookmarksMap(): Record<string, number> {
  const bookmarks: Record<string, number> = {};
  if (typeof window === 'undefined') return bookmarks;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sr_bookmark_')) {
        const bookId = key.slice('sr_bookmark_'.length);
        const val = Number(localStorage.getItem(key));
        if (bookId && Number.isFinite(val) && val >= 0) {
          bookmarks[bookId] = Math.floor(val);
        }
      }
    }
  } catch {
    // ignore
  }
  return bookmarks;
}

export async function exportFullLocalBackupSnapshot(overrides?: {
  activeBookId?: string;
  settings?: PedagogicalSettings;
  vocab?: VocabItem[];
  stats?: StudyStats;
}): Promise<{
  version: 1;
  updatedAt: string;
  deviceLabel: string;
  activeBookId: string;
  bookmarks: Record<string, number>;
  books: Book[];
  vocab: VocabItem[];
  stats: StudyStats;
  settings: PedagogicalSettings;
}> {
  const books = await loadAllSavedBooksFromDB();
  const bookmarks = exportLocalBookmarksMap();
  let activeBookId = overrides?.activeBookId || '';
  if (!activeBookId && typeof window !== 'undefined') {
    try {
      activeBookId = localStorage.getItem('sr_active_book_id') || '';
    } catch {
      // ignore
    }
  }
  if (!activeBookId && books.length > 0) {
    activeBookId = books[0].id;
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const deviceLabel = /Android|iPhone|iPad|Mobile/i.test(ua) ? 'Celular' : 'Computador';

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    deviceLabel,
    activeBookId,
    bookmarks,
    books,
    vocab: overrides?.vocab ?? loadSavedVocab(),
    stats: overrides?.stats ?? loadStudyStats(),
    settings: overrides?.settings ?? loadSavedSettings()
  };
}

export async function applyBackupSnapshotToLocalStorageAndDB(snapshot: {
  activeBookId: string;
  bookmarks: Record<string, number>;
  books: Book[];
  vocab: VocabItem[];
  stats: StudyStats;
  settings: PedagogicalSettings;
}): Promise<boolean> {
  try {
    persistSettings(snapshot.settings);
    persistVocab(snapshot.vocab);
    persistStudyStats(snapshot.stats);

    if (typeof window !== 'undefined') {
      if (snapshot.activeBookId) {
        localStorage.setItem('sr_active_book_id', snapshot.activeBookId);
      }
      for (const [bookId, idx] of Object.entries(snapshot.bookmarks || {})) {
        if (bookId && Number.isFinite(idx) && idx >= 0) {
          localStorage.setItem(`sr_bookmark_${bookId}`, String(Math.floor(idx)));
        }
      }
    }

    const db = await openShadowDB();
    if (!db) return true;

    const tx = db.transaction(['books', 'meta'], 'readwrite');
    const booksStore = tx.objectStore('books');
    const metaStore = tx.objectStore('meta');

    for (const book of snapshot.books) {
      const total = book.sentences.length || 1;
      const curIdx = Math.max(0, Math.min(book.currentIndex || 0, total - 1));
      const sentenceProgress = book.sentenceProgress || {};
      booksStore.put({
        ...book,
        totalSentences: total,
        currentIndex: curIdx,
        progressPercent: computeBookProgress(total, sentenceProgress).percent,
        sentenceProgress
      });
    }

    if (snapshot.activeBookId) {
      metaStore.put({ key: 'activeBookId', value: snapshot.activeBookId });
    }

    return new Promise(resolve => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export function getDriveLastSyncedFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('sr_drive_last_fp');
  } catch {
    return null;
  }
}

export function setDriveLastSyncedFingerprint(fp: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (fp) {
      localStorage.setItem('sr_drive_last_fp', fp);
    } else {
      localStorage.removeItem('sr_drive_last_fp');
    }
  } catch {
    // ignore
  }
}

export function getDriveAutoSyncOptIn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('sr_drive_auto_sync_optin') === '1';
  } catch {
    return false;
  }
}

export function setDriveAutoSyncOptIn(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      localStorage.setItem('sr_drive_auto_sync_optin', '1');
    } else {
      localStorage.removeItem('sr_drive_auto_sync_optin');
    }
  } catch {
    // ignore
  }
}

// Unified Repository Facade (Item 3: Clean Architecture)
export const ShadowRepository = {
  books: {
    save: saveBookToDB,
    updateBookmark: updateBookmarkInDB,
    getBookmark: getBookmarkFromLocalStorage,
    clearBookmark: clearBookmarkFromLocalStorage,
    listAll: loadAllSavedBooksFromDB,
    getById: getBookFromDB,
    getActive: getActiveBookFromDB,
    remove: deleteBookFromDB
  },
  vocab: {
    load: loadSavedVocab,
    save: persistVocab
  },
  settings: {
    load: loadSavedSettings,
    save: persistSettings
  },
  stats: {
    load: loadStudyStats,
    save: persistStudyStats,
    recordEvaluation: recordEvaluationInStats
  },
  driveBackup: {
    exportLocalSnapshot: exportFullLocalBackupSnapshot,
    applySnapshotLocally: applyBackupSnapshotToLocalStorageAndDB,
    getLastSyncedFingerprint: getDriveLastSyncedFingerprint,
    setLastSyncedFingerprint: setDriveLastSyncedFingerprint,
    getAutoSyncOptIn: getDriveAutoSyncOptIn,
    setAutoSyncOptIn: setDriveAutoSyncOptIn
  }
};
