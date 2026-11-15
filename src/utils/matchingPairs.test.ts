import test from 'node:test';
import assert from 'node:assert/strict';
import { DICT_DB } from '../data/dictionaryDb';
import { lookupLocalWordInfo } from './shadowing';
import {
  buildInitialMatchingItems,
  buildPronunciationChallengeWords,
  deduplicateMatchingTranslations,
  extractSentenceWordsForMatching,
  isSuspiciousMyMemoryFragment,
  parseGoogleGtxWordResponse,
  sanitizeLiteralPtTranslation
} from './matchingPairs';

test('isSuspiciousMyMemoryFragment rejects noisy TM fragments like "director" -> "de arte"', () => {
  assert.equal(isSuspiciousMyMemoryFragment('director', 'de arte', 0.99), true);
  assert.equal(isSuspiciousMyMemoryFragment('director', 'independente', 0.74), true);
  assert.equal(isSuspiciousMyMemoryFragment('director', 'diretor', 0.99), false);
  assert.equal(isSuspiciousMyMemoryFragment('director', 'director', 0.99), true);
  assert.equal(isSuspiciousMyMemoryFragment('director', 'MYMEMORY WARNING', 0.99), true);
});

test('parseGoogleGtxWordResponse extracts primary literal word and bilingual alternatives cleanly', () => {
  const sampleDirectorGtx = [
    [['diretor', 'director', null, null, 2]],
    [
      [
        'noun',
        ['diretor', 'administrador', 'chefe'],
        [],
        'director',
        1
      ]
    ]
  ];

  const parsed = parseGoogleGtxWordResponse('director', sampleDirectorGtx);
  assert.ok(parsed);
  assert.equal(parsed.primaryPt, 'diretor');
  assert.deepEqual(parsed.alternatives, ['diretor', 'administrador', 'chefe']);
});

test('sanitizeLiteralPtTranslation strips grammar notes and picks clean primary literal form', () => {
  assert.equal(sanitizeLiteralPtTranslation('they', 'elas / eles'), 'elas');
  assert.equal(sanitizeLiteralPtTranslation('did', 'fez (auxiliar passado)'), 'fez');
  assert.equal(sanitizeLiteralPtTranslation('its', 'dele / dela (coisa)'), 'dele');
  assert.equal(sanitizeLiteralPtTranslation('director', 'director'), '');
  assert.equal(sanitizeLiteralPtTranslation('unknown', '...'), '');
});

test('extractSentenceWordsForMatching pulls sentence words directly without morphological duplicates', () => {
  const words = extractSentenceWordsForMatching(
    'The heavy wooden books and book.',
    5
  );
  assert.ok(words.includes('wooden'));
  assert.ok(words.includes('heavy'));
  // Should not include both "book" and "books" in the same round
  const bookCount = words.filter(w => w === 'book' || w === 'books').length;
  assert.equal(bookCount, 1);
});

test('buildInitialMatchingItems flags non-DICT_DB words like "director" and contextual multi-sense entries for literal GTX resolution', () => {
  const items = buildInitialMatchingItems(
    'The director was six old.',
    DICT_DB,
    5
  );

  const directorItem = items.find(i => i.en === 'director');
  assert.ok(directorItem);
  assert.equal(directorItem.fromSentence, true);
  assert.equal(directorItem.needsLiteralFetch, true);

  const oldItem = items.find(i => i.en === 'old');
  assert.ok(oldItem);
  assert.equal(oldItem.needsLiteralFetch, true);

  // Also ensure unrelated -er words not in DICT_DB do not match wrong stems (e.g. drawer -> draw)
  assert.equal(lookupLocalWordInfo('drawer').pt, '...');
  assert.equal(lookupLocalWordInfo('hammer').pt, '...');
});

test('deduplicateMatchingTranslations prevents duplicate Portuguese cards by switching colliding cards to alternate senses', () => {
  const items = [
    { id: 'w_0_small', en: 'small', pt: 'pequeno' },
    { id: 'w_1_little', en: 'little', pt: 'pequeno' },
    { id: 'w_2_director', en: 'director', pt: 'diretor' }
  ];

  const deduped = deduplicateMatchingTranslations(items, {
    w_0_small: ['pequeno', 'pequena'],
    w_1_little: ['pequeno', 'pouco'],
    w_2_director: ['diretor', 'chefe']
  });

  const ptValues = deduped.map(i => i.pt);
  assert.equal(new Set(ptValues).size, 3);
  assert.equal(deduped[0].pt, 'pequeno');
  assert.equal(deduped[1].pt, 'pouco');
  assert.equal(deduped[2].pt, 'diretor');
});

test('buildPronunciationChallengeWords caps at 5 words and prioritizes most mispronounced sentence words', () => {
  const sentence = 'Suddenly we saw a tall dark man standing across the quiet street yesterday.';
  const mistakes = {
    saw: 3,
    dark: 2,
    street: 1
  };

  const challengeWords = buildPronunciationChallengeWords(sentence, DICT_DB, mistakes, 5);
  assert.equal(challengeWords.length, 5);
  // Mispronounced words must appear at the very front ordered by mistake count DESC
  assert.equal(challengeWords[0].en, 'saw');
  assert.equal(challengeWords[0].mistakeCount, 3);
  assert.equal(challengeWords[1].en, 'dark');
  assert.equal(challengeWords[1].mistakeCount, 2);
  assert.equal(challengeWords[2].en, 'street');
  assert.equal(challengeWords[2].mistakeCount, 1);
  // Remaining slots filled with sentence content words (0 mistakes)
  assert.equal(challengeWords[3].mistakeCount, 0);
  assert.equal(challengeWords[4].mistakeCount, 0);

  // Even stopwords / short words missed during speech must be included if missed
  const shortWordChallenge = buildPronunciationChallengeWords(
    'Every morning I walk to a small coffee shop.',
    DICT_DB,
    { to: 4, small: 2 },
    5
  );
  assert.equal(shortWordChallenge.length, 5);
  assert.equal(shortWordChallenge[0].en, 'to');
  assert.equal(shortWordChallenge[0].mistakeCount, 4);
  assert.equal(shortWordChallenge[1].en, 'small');
  assert.equal(shortWordChallenge[1].mistakeCount, 2);
});

