import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, DEFAULT_STATS } from '../services/storageService';
import {
  classifySyncDecision,
  computeSnapshotFingerprint,
  DriveBackupSnapshot,
  hasSubstantiveLocalData,
  mergeDriveSnapshots,
  parseDriveBackupSnapshot
} from './driveSync';

function makeSnapshot(overrides: Partial<DriveBackupSnapshot> = {}): DriveBackupSnapshot {
  return {
    version: 1,
    updatedAt: '2026-11-14T12:00:00.000Z',
    deviceLabel: 'Chrome Desktop',
    activeBookId: 'masterpiece_beacon_hill_v1',
    bookmarks: {},
    books: [],
    vocab: [],
    stats: {
      totalSentencesCompleted: 0,
      bestStreak: 0,
      masteredWords: [],
      trickyWords: {},
      dailyHistory: {}
    },
    settings: { ...DEFAULT_SETTINGS },
    ...overrides
  };
}

test('computeSnapshotFingerprint is deterministic and ignores volatile timestamps and device labels', () => {
  const snapA = makeSnapshot({
    updatedAt: '2026-11-14T10:00:00.000Z',
    deviceLabel: 'Laptop',
    bookmarks: { b1: 4, b2: 9 }
  });
  const snapB = makeSnapshot({
    updatedAt: '2026-11-14T22:45:00.000Z',
    deviceLabel: 'Pixel Phone',
    bookmarks: { b2: 9, b1: 4 }
  });
  assert.equal(computeSnapshotFingerprint(snapA), computeSnapshotFingerprint(snapB));

  const snapC = makeSnapshot({
    bookmarks: { b1: 5, b2: 9 }
  });
  assert.notEqual(computeSnapshotFingerprint(snapA), computeSnapshotFingerprint(snapC));
});

test('mergeDriveSnapshots combines books, sentence progress, vocab, and study stats without losing data', () => {
  const local = makeSnapshot({
    updatedAt: '2026-11-14T14:00:00.000Z',
    activeBookId: 'book_local_1',
    bookmarks: { book_shared: 3, book_local_1: 1 },
    books: [
      {
        id: 'book_shared',
        title: 'Shared Novel',
        author: 'Author',
        currentIndex: 3,
        lastRead: '2026-11-14T13:00:00.000Z',
        sentences: [
          { en: 'First sentence here.', pt: 'Primeira frase.' },
          { en: 'Second sentence here.', pt: 'Segunda frase.' },
          { en: 'Third sentence here.', pt: 'Terceira frase.' },
          { en: 'Fourth sentence here.', pt: 'Quarta frase.' }
        ],
        sentenceProgress: {
          0: { completed: true, bestScore: 88, attempts: 2 },
          1: { completed: false, bestScore: 60, attempts: 1 }
        }
      },
      {
        id: 'book_local_1',
        title: 'Local Exclusive Book',
        author: 'User',
        currentIndex: 1,
        lastRead: '2026-11-14T14:00:00.000Z',
        sentences: [
          { en: 'Alpha one.', pt: 'Alfa um.' },
          { en: 'Beta two.', pt: 'Beta dois.' }
        ]
      }
    ],
    vocab: [
      {
        word: 'resilient',
        sentence: 'Be resilient every day.',
        date: '14/11/2026',
        repetition: 1
      }
    ],
    stats: {
      totalSentencesCompleted: 5,
      bestStreak: 3,
      masteredWords: ['first', 'resilient'],
      trickyWords: { through: 2 },
      dailyHistory: {
        '2026-11-14': {
          dateKey: '2026-11-14',
          sentencesPracticed: 5,
          totalScoreSum: 430,
          evaluationsCount: 5
        }
      }
    }
  });

  const remote = makeSnapshot({
    updatedAt: '2026-11-14T16:00:00.000Z',
    activeBookId: 'book_remote_2',
    bookmarks: { book_shared: 2, book_remote_2: 0 },
    books: [
      {
        id: 'book_shared',
        title: 'Shared Novel',
        author: 'Author',
        currentIndex: 2,
        lastRead: '2026-11-14T12:00:00.000Z',
        sentences: [
          { en: 'First sentence here.', pt: 'Primeira frase.' },
          { en: 'Second sentence here.', pt: 'Segunda frase.' },
          { en: 'Third sentence here.', pt: 'Terceira frase.' },
          { en: 'Fourth sentence here.', pt: 'Quarta frase.' }
        ],
        sentenceProgress: {
          1: { completed: true, bestScore: 95, attempts: 3 },
          2: { completed: true, bestScore: 90, attempts: 1 }
        }
      },
      {
        id: 'book_remote_2',
        title: 'Phone Imported Book',
        author: 'PDF',
        currentIndex: 0,
        lastRead: '2026-11-14T16:00:00.000Z',
        sentences: [{ en: 'Remote story begins.', pt: 'A história remota começa.' }]
      }
    ],
    vocab: [
      {
        word: 'resilient',
        sentence: 'Be resilient every day.',
        date: '14/11/2026',
        repetition: 3,
        nextReviewDate: '2026-11-20T00:00:00.000Z'
      },
      {
        word: 'lantern',
        sentence: 'Carry the lantern.',
        date: '14/11/2026',
        repetition: 1
      }
    ],
    stats: {
      totalSentencesCompleted: 8,
      bestStreak: 6,
      masteredWords: ['lantern', 'second'],
      trickyWords: { through: 4, thorough: 1 },
      dailyHistory: {
        '2026-11-13': {
          dateKey: '2026-11-13',
          sentencesPracticed: 3,
          totalScoreSum: 250,
          evaluationsCount: 3
        },
        '2026-11-14': {
          dateKey: '2026-11-14',
          sentencesPracticed: 4,
          totalScoreSum: 380,
          evaluationsCount: 4
        }
      }
    }
  });

  const merged = mergeDriveSnapshots(local, remote);
  assert.equal(merged.books.length, 3);
  const shared = merged.books.find(b => b.id === 'book_shared')!;
  assert.equal(shared.currentIndex, 3); // local had newer lastRead on shared book
  assert.equal(shared.sentenceProgress?.[0].completed, true);
  assert.equal(shared.sentenceProgress?.[1].completed, true);
  assert.equal(shared.sentenceProgress?.[1].bestScore, 95);
  assert.equal(shared.sentenceProgress?.[2].completed, true);

  assert.equal(merged.vocab.length, 2);
  const resilient = merged.vocab.find(v => v.word === 'resilient')!;
  assert.equal(resilient.repetition, 3);

  assert.equal(merged.stats.bestStreak, 6);
  assert.equal(merged.stats.trickyWords.through, 4);
  assert.equal(merged.stats.trickyWords.thorough, 1);
  assert.ok(merged.stats.masteredWords.includes('first'));
  assert.ok(merged.stats.masteredWords.includes('lantern'));
  assert.ok(merged.stats.totalSentencesCompleted >= 8);
});

test('classifySyncDecision accurately distinguishes first upload, auto pull/push, and merge confirmation', () => {
  const emptyLocal = makeSnapshot();
  const activeRemote = makeSnapshot({
    updatedAt: '2026-11-14T15:00:00.000Z',
    stats: { ...DEFAULT_STATS, totalSentencesCompleted: 12 },
    bookmarks: { masterpiece_beacon_hill_v1: 11 }
  });
  const activeLocal = makeSnapshot({
    updatedAt: '2026-11-14T16:00:00.000Z',
    stats: { ...DEFAULT_STATS, totalSentencesCompleted: 4 },
    bookmarks: { masterpiece_beacon_hill_v1: 3 }
  });

  assert.equal(hasSubstantiveLocalData(emptyLocal), false);
  assert.equal(hasSubstantiveLocalData(activeLocal), true);

  // No remote yet -> confirm creating backup
  assert.equal(
    classifySyncDecision({ local: activeLocal, remote: null }),
    'needs_initial_upload_confirm'
  );

  // Identical content -> no_op
  assert.equal(
    classifySyncDecision({ local: activeRemote, remote: activeRemote }),
    'no_op'
  );

  // Fresh device with no progress -> pull_remote_auto
  assert.equal(
    classifySyncDecision({ local: emptyLocal, remote: activeRemote }),
    'pull_remote_auto'
  );

  // Both sides have independent progress & no matching baseline -> ask user confirmation
  assert.equal(
    classifySyncDecision({ local: activeLocal, remote: activeRemote }),
    'needs_merge_confirm'
  );

  // Only local changed since last synced fingerprint -> push_local_auto
  const remoteFp = computeSnapshotFingerprint(activeRemote);
  assert.equal(
    classifySyncDecision({
      local: activeLocal,
      remote: activeRemote,
      lastSyncedFingerprint: remoteFp
    }),
    'push_local_auto'
  );

  // Only remote changed since last synced fingerprint -> pull_remote_auto
  const localFp = computeSnapshotFingerprint(activeLocal);
  assert.equal(
    classifySyncDecision({
      local: activeLocal,
      remote: activeRemote,
      lastSyncedFingerprint: localFp
    }),
    'pull_remote_auto'
  );
});

test('parseDriveBackupSnapshot validates schema version and rejects corrupted payloads', () => {
  assert.equal(parseDriveBackupSnapshot(null), null);
  assert.equal(parseDriveBackupSnapshot({ version: 99 }), null);

  const validRaw = makeSnapshot({
    vocab: [{ word: 'beacon', sentence: 'Follow the beacon.', date: '14/11/2026' }]
  });
  const parsed = parseDriveBackupSnapshot(validRaw);
  assert.ok(parsed);
  assert.equal(parsed?.vocab.length, 1);
});
