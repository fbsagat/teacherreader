import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_BOOKS } from '../data/dictionaryDb';
import {
  cleanString,
  cleanSpeech,
  isWordMatch,
  calculateSimilarity,
  getEffectiveSpeed,
  getSpeakableWord,
  lookupLocalWordInfo,
  segmentBookText,
  MAX_BOOK_SENTENCE_CHARS,
  findDuplicatePhoneticWords,
  classifySentenceCefr,
  splitIntoProsodyChunks,
  getBrazilianPhoneticTip,
  calculateSrsNextReview,
  isVocabDueForReview,
  splitSentenceIntoStudySteps,
  alignPortugueseClauses,
  getAdaptiveSilenceDebounceMs,
  detectHandsFreeVoiceCommand,
  getHandsFreeEffectiveMaxAttempts,
  numberToEnglishWords,
  ordinalToEnglishWords,
  yearToEnglishWords,
  normalizeSpokenTranscriptNumbers
} from './shadowing';

test('cleanString removes punctuation and lowercases words', () => {
  assert.equal(cleanString('Magnificent!'), 'magnificent');
  assert.equal(cleanString(" 'Boa' "), 'boa');
  assert.equal(cleanString('grown-ups,'), 'grownups');
});

test('cleanSpeech normalizes contractions and digits into spoken English words', () => {
  assert.equal(
    cleanSpeech("I can't wait 6 years!"),
    'i cannot wait six years'
  );
  assert.equal(
    cleanSpeech("My 1st drawing wasn't a hat."),
    'my first drawing was not a hat'
  );
});

test('isWordMatch supports exact and forgiving ESL phonetic matches', () => {
  assert.equal(isWordMatch('picture', 'picture'), true);
  assert.equal(isWordMatch('pictures', 'picture'), true);
  assert.equal(isWordMatch('constrictor', 'constrictor'), true);
  assert.equal(isWordMatch('hat', 'elephant'), false);
});

test('calculateSimilarity returns 100% on identical or equivalent spoken sentence', () => {
  const target = 'Once when I was six years old I saw a magnificent picture in a book.';
  const spoken = 'once when i was 6 years old i saw a magnificent picture in a book';
  const result = calculateSimilarity(target, spoken);
  assert.equal(result.score, 100);
  assert.equal(result.matchedCount, result.totalWords);
  assert.equal(result.wordResults.every(w => w.matched), true);
});

test('calculateSimilarity handles partial matches and empty speech accurately', () => {
  const target = 'Once when I was six years old';
  const emptyRes = calculateSimilarity(target, '');
  assert.equal(emptyRes.score, 0);

  const partialRes = calculateSimilarity(target, 'Once when I was');
  assert.ok(partialRes.score >= 50 && partialRes.score < 90);
  assert.equal(partialRes.matchedCount, 4);
  assert.equal(partialRes.totalWords, 7);
});

test('getEffectiveSpeed computes clamped English and Portuguese speeds', () => {
  assert.equal(getEffectiveSpeed('en-US', 0.85, 1.15, 1.0), 0.85);
  assert.equal(getEffectiveSpeed('pt-BR', 0.85, 1.15, 1.0), 1.15);
  // Browser and cloud playback now share the same safe bounds (0.65x–1.5x).
  assert.equal(getEffectiveSpeed('en-US', 0.85, 1.15, 0.5), 0.65);
  assert.equal(getEffectiveSpeed('en-US', 1.2, 1.15, 1.5), 1.5);
});

test('lookupLocalWordInfo resolves known words from DICT_DB and falls back cleanly', () => {
  const known = lookupLocalWordInfo('Magnificent!');
  assert.equal(known.word, 'magnificent');
  assert.equal(known.pt, 'magnífica / esplêndida');
  assert.equal(known.ipa, '/mæɡˈnɪfɪsnt/');

  const unknown = lookupLocalWordInfo('astrobiology');
  assert.equal(unknown.word, 'astrobiology');
  assert.equal(unknown.pt, '...');
});

test('segmentBookText splits multi-sentence text, rejoins hyphenated words, and preserves abbreviations like Mr. and Dr.', () => {
  const sampleText =
    'Mr. Holmes and Dr. Watson lived at St. James Street in London. Once when I was six years old I saw a magni-\nficent picture in a book.';
  const sentences = segmentBookText(sampleText);
  assert.equal(sentences.length, 2);
  assert.ok(sentences[0].en.includes('Mr. Holmes and Dr. Watson'));
  assert.ok(sentences[1].en.includes('magnificent picture'));
});

test('classifySentenceCefr classifies simple vs complex literary sentences', () => {
  assert.equal(classifySentenceCefr('It looked like a hat.'), 'A1');
  const complex =
    'All emotions, and that one particularly, were abhorrent to his cold, precise but admirably balanced mind.';
  const level = classifySentenceCefr(complex);
  assert.ok(level === 'B2' || level === 'C1');
});

test('splitIntoProsodyChunks groups rhythm phrases and marks consonant-vowel linking', () => {
  const chunks = splitIntoProsodyChunks(
    'Once when I was six years old I saw a magnificent picture in a book.'
  );
  assert.ok(chunks.length >= 3);
  const combinedDisplay = chunks.map(c => c.displayWithLinks).join(' | ');
  // "when I" or "years old" or "in a" should have linking symbol ‿
  assert.ok(combinedDisplay.includes('‿'));
});

test('getBrazilianPhoneticTip detects TH, silent letters, and -ED endings', () => {
  const thTip = getBrazilianPhoneticTip('through');
  assert.ok(thTip && thTip.category.includes('TH'));

  const silentL = getBrazilianPhoneticTip('would');
  assert.ok(silentL && silentL.category.includes('L Muda'));

  const edTip = getBrazilianPhoneticTip('looked');
  assert.ok(edTip && edTip.category.includes('-ED'));
});

test('calculateSrsNextReview implements SM-2 spaced repetition intervals', () => {
  const now = new Date('2026-11-09T12:00:00Z');
  const initialItem = {
    word: 'magnificent',
    sentence: 'Ex sentence',
    date: '09/11/2026'
  };

  assert.equal(isVocabDueForReview(initialItem, now), true);

  // Rating "Bom" (4) -> 1 day interval
  const afterGood = calculateSrsNextReview(initialItem, 4, now);
  assert.equal(afterGood.interval, 1);
  assert.equal(afterGood.repetition, 1);
  assert.equal(isVocabDueForReview(afterGood, now), false);

  // Rating "Difícil" (2) -> resets interval to 0 and makes it due immediately
  const afterHard = calculateSrsNextReview(afterGood, 2, now);
  assert.equal(afterHard.interval, 0);
  assert.equal(afterHard.repetition, 0);
  assert.equal(isVocabDueForReview(afterHard, now), true);
});

test('splitSentenceIntoStudySteps breaks long sentences into forward and backchain steps with aligned Portuguese', () => {
  const longSentence =
    'After that they are not able to move, and they sleep through the six months that they need for digestion.';
  const longPt =
    'Depois disso elas não conseguem se mover, e dormem durante os seis meses necessários para a digestão.';

  const forwardSteps = splitSentenceIntoStudySteps(longSentence, 'forward', longPt);
  assert.ok(forwardSteps.length >= 3);
  assert.ok(forwardSteps[0].ptText.includes('Depois disso'));
  assert.equal(forwardSteps[forwardSteps.length - 1].isFull, true);
  assert.equal(forwardSteps[forwardSteps.length - 1].text, longSentence);
  assert.equal(forwardSteps[forwardSteps.length - 1].ptText, longPt);

  const backchainSteps = splitSentenceIntoStudySteps(longSentence, 'backchain', longPt);
  assert.ok(backchainSteps.length >= 2);
  assert.ok(backchainSteps[0].text.endsWith('digestion.'));
  assert.ok(backchainSteps[0].ptText.includes('digestão.'));
  assert.equal(backchainSteps[backchainSteps.length - 1].text, longSentence);
});

test('getAdaptiveSilenceDebounceMs increases breathing pause window for long sentences', () => {
  assert.equal(getAdaptiveSilenceDebounceMs('It was a hat.'), 2150);
  assert.equal(
    getAdaptiveSilenceDebounceMs(
      'After that they are not able to move, and they sleep through the six months that they need for digestion.'
    ),
    3450
  );
});

test('short isolated words like "through" match homophones, phonetic variants, and repeated utterances', () => {
  assert.equal(isWordMatch('through', 'through'), true);
  assert.equal(isWordMatch('through', 'threw'), true);
  assert.equal(isWordMatch('through', 'thru'), true);
  assert.equal(isWordMatch('through', 'true'), true);
  assert.equal(isWordMatch('through', 'throw'), true);

  assert.ok(calculateSimilarity('through', 'threw').score >= 90);
  assert.ok(calculateSimilarity('through', 'thru').score >= 90);
  assert.ok(calculateSimilarity('through', 'true').score >= 90);
  assert.ok(calculateSimilarity('through', 'through through').score >= 90);
});

test('getSpeakableWord preserves English pronoun I and contractions for natural TTS playback', () => {
  assert.equal(getSpeakableWord('i', 'en-US'), 'I');
  assert.equal(getSpeakableWord('"I"', 'en-US'), 'I');
  assert.equal(getSpeakableWord('dont', 'en-US'), "don't");
  assert.equal(getSpeakableWord("don't,", 'en-US'), "don't");
  assert.equal(getSpeakableWord('im', 'en-US'), "I'm");
  assert.equal(getSpeakableWord('book.', 'en-US'), 'book');
});

test('lookupLocalWordInfo resolves every word in all 13 SAMPLE_BOOKS and stemmed variants without "..."', () => {
  for (const book of SAMPLE_BOOKS) {
    for (const sentence of book.sentences) {
      for (const rawToken of sentence.en.split(/\s+/)) {
        const clean = cleanString(rawToken);
        if (!clean) continue;
        const info = lookupLocalWordInfo(rawToken);
        assert.notEqual(
          info.pt,
          '...',
          `Expected "${clean}" in book "${book.id}" to have a valid Portuguese translation`
        );
        assert.ok(info.pt.length > 0);
      }
    }
  }

  // Also test morphological stem resolution on inflected forms
  assert.notEqual(lookupLocalWordInfo('books').pt, '...');
  assert.notEqual(lookupLocalWordInfo('walked').pt, '...');
  assert.notEqual(lookupLocalWordInfo('1984').pt, '...');
});

test('splitSentenceIntoStudySteps and alignPortugueseClauses accurately align "Every morning I walk to a small coffee shop near my house." without truncating "cafeteria perto"', () => {
  const en = 'Every morning I walk to a small coffee shop near my house.';
  const pt = 'Toda manhã eu caminho até uma pequena cafeteria perto da minha casa.';

  const steps = splitSentenceIntoStudySteps(en, 'forward', pt);
  const subSteps = steps.filter(s => !s.isFull);
  assert.equal(subSteps.length, 3);
  assert.equal(subSteps[0].text, 'Every morning I walk');
  assert.equal(subSteps[0].ptText, 'Toda manhã eu caminho');
  assert.equal(subSteps[1].text, 'to a small coffee shop');
  assert.equal(subSteps[1].ptText, 'até uma pequena cafeteria');
  assert.equal(subSteps[2].text, 'near my house.');
  assert.equal(subSteps[2].ptText, 'perto da minha casa.');

  // Even if alignPortugueseClauses is called with a 2-clause split where clause 2 is "coffee shop near my house.",
  // it must include "cafeteria perto" in clause 2 and never return just "da minha casa."
  const twoClauseAligned = alignPortugueseClauses(
    ['Every morning I walk to a small', 'coffee shop near my house.'],
    pt
  );
  assert.equal(twoClauseAligned[1], 'cafeteria perto da minha casa.');

  // Validate that across all SAMPLE_BOOKS, sub-clauses reconstruct the full sentence and never leave empty or 1-word "da/de/do" fragments
  for (const book of SAMPLE_BOOKS) {
    for (const s of book.sentences) {
      const bookSteps = splitSentenceIntoStudySteps(s.en, 'forward', s.pt);
      const parts = bookSteps.filter(st => !st.isFull);
      if (parts.length > 0) {
        assert.equal(parts.map(p => p.text).join(' '), s.en);
        assert.equal(parts.map(p => p.ptText).join(' '), s.pt);
        for (const p of parts) {
          assert.ok(p.text.trim().length > 0 && p.ptText.trim().length > 0);
          const ptWords = p.ptText.trim().split(/\s+/);
          assert.ok(
            ptWords.length >= 2,
            `Expected at least 2 words in Portuguese step "${p.ptText}" for "${p.text}"`
          );
        }
      }
    }
  }
});

test('detectHandsFreeVoiceCommand recognizes Portuguese and English voice commands without hijacking target words', () => {
  assert.equal(detectHandsFreeVoiceCommand('pular', 'Once when I was six'), 'skip');
  assert.equal(detectHandsFreeVoiceCommand('próxima frase', 'Once when I was six'), 'skip');
  assert.equal(detectHandsFreeVoiceCommand('repetir', 'Once when I was six'), 'repeat');
  assert.equal(detectHandsFreeVoiceCommand('ouvir de novo', 'Once when I was six'), 'repeat');
  assert.equal(detectHandsFreeVoiceCommand('pausar treino', 'Once when I was six'), 'pause');
  assert.equal(detectHandsFreeVoiceCommand('skip', 'magnificent'), 'skip');

  // Must NOT hijack if the target word itself is "skip" or "repeat"
  assert.equal(detectHandsFreeVoiceCommand('skip', 'skip'), null);
  assert.equal(detectHandsFreeVoiceCommand('repeat', 'Please repeat after me'), null);
  assert.equal(detectHandsFreeVoiceCommand('Once when I was six', 'Once when I was six'), null);
});

test('getHandsFreeEffectiveMaxAttempts respects blindMaxErrorsBeforeReveal so user gets an attempt after English reveal', () => {
  assert.equal(getHandsFreeEffectiveMaxAttempts('speak', 2, 2), 2);
  assert.equal(getHandsFreeEffectiveMaxAttempts('speak_challenge', 3, 2), 3);
  // In speak_blind_en with blindMaxErrorsBeforeReveal=2, effective max attempts is at least 3 (2 errors to reveal + 1 attempt reading)
  assert.equal(getHandsFreeEffectiveMaxAttempts('speak_blind_en', 2, 2), 3);
  assert.equal(getHandsFreeEffectiveMaxAttempts('speak_blind_en', 4, 2), 4);
});

test('Teacher Reader Masterpiece book progresses strictly from A1 to C1 across 50 sentences with grammar rules and act titles', () => {
  const masterpiece = SAMPLE_BOOKS.find(b => b.id === 'teacher-reader-masterpiece');
  assert.ok(masterpiece, 'Expected teacher-reader-masterpiece book to exist in SAMPLE_BOOKS');
  assert.equal(masterpiece.isProgressiveMasterpiece, true);
  assert.equal(masterpiece.sentences.length, 50);

  const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1'];
  let lastRank = 0;

  masterpiece.sentences.forEach((s, idx) => {
    assert.ok(s.cefrLevel, `Sentence #${idx + 1} must have cefrLevel`);
    assert.ok(s.actTitle && s.actTitle.length > 5, `Sentence #${idx + 1} must have actTitle`);
    assert.ok(
      s.grammarRule && s.grammarRule.length > 10,
      `Sentence #${idx + 1} must have grammarRule`
    );
    const rank = cefrOrder.indexOf(s.cefrLevel!);
    assert.ok(
      rank >= lastRank,
      `Expected non-decreasing CEFR progression at sentence #${idx + 1}`
    );
    lastRank = rank;
  });

  assert.equal(masterpiece.sentences[0].cefrLevel, 'A1');
  assert.equal(masterpiece.sentences[15].cefrLevel, 'A2');
  assert.equal(masterpiece.sentences[25].cefrLevel, 'B1');
  assert.equal(masterpiece.sentences[35].cefrLevel, 'B2');
  assert.equal(masterpiece.sentences[49].cefrLevel, 'C1');
});

test('speakTextUniversal and stopAllAudioPlayback strictly increment audioCancelGeneration on every call to prevent challenge voice leaks', async () => {
  const {
    getAudioCancelGeneration,
    speakTextUniversal,
    stopAllAudioPlayback
  } = await import('../services/audioAndTranslationService');

  const g0 = getAudioCancelGeneration();
  stopAllAudioPlayback();
  const g1 = getAudioCancelGeneration();
  assert.equal(g1, g0 + 1);

  // Calling speakTextUniversal rapidly (simulating rapid pair matching in challenge) must increment generation on every single call
  const p1 = speakTextUniversal('first', 'en-US', 'auto', 1.0, 1.0, 1.0);
  const g2 = getAudioCancelGeneration();
  assert.equal(g2, g1 + 1);

  const p2 = speakTextUniversal('second', 'en-US', 'auto', 1.0, 1.0, 1.0);
  const g3 = getAudioCancelGeneration();
  assert.equal(g3, g2 + 1);

  // Finishing the challenge calls stopAllAudioPlayback, which advances the generation again
  stopAllAudioPlayback();
  const g4 = getAudioCancelGeneration();
  assert.equal(g4, g3 + 1);

  await Promise.all([p1, p2]);
});

test('buildEffectiveCardSequence respects blindSpeakingOnFullSentence and omits post-sentence challenges on intermediate sub-parts', async () => {
  const { buildEffectiveCardSequence } = await import('./cardSequencePresets');
  const { DEFAULT_SETTINGS } = await import('../services/storageService');

  const baseSettings = {
    ...DEFAULT_SETTINGS,
    cardSequence: ['pt', 'en', 'speak', 'speak_blind_en', 'challenges'] as any
  };

  // When blindSpeakingOnFullSentence is true: 'speak_blind_en' appears in both 'Em Partes' and 'Desafio Final: Frase Inteira',
  // while 'challenges' only appears on the full sentence ('isSubClauseStep: false')
  const enabledSettings = { ...baseSettings, blindSpeakingOnFullSentence: true };
  assert.deepEqual(
    buildEffectiveCardSequence(enabledSettings, { isStepByStepMode: true, isSubClauseStep: true }),
    ['pt', 'en', 'speak', 'speak_blind_en']
  );
  assert.deepEqual(
    buildEffectiveCardSequence(enabledSettings, { isStepByStepMode: true, isSubClauseStep: false }),
    ['pt', 'en', 'speak', 'speak_blind_en', 'challenges']
  );

  // When blindSpeakingOnFullSentence is false: 'speak_blind_en' appears ONLY in 'Em Partes' sub-clauses and NOT in 'Desafio Final: Frase Inteira'
  const disabledSettings = { ...baseSettings, blindSpeakingOnFullSentence: false };
  assert.deepEqual(
    buildEffectiveCardSequence(disabledSettings, { isStepByStepMode: true, isSubClauseStep: true }),
    ['pt', 'en', 'speak', 'speak_blind_en']
  );
  assert.deepEqual(
    buildEffectiveCardSequence(disabledSettings, { isStepByStepMode: true, isSubClauseStep: false }),
    ['pt', 'en', 'speak', 'challenges']
  );
  assert.deepEqual(
    buildEffectiveCardSequence(disabledSettings, { isStepByStepMode: false, isSubClauseStep: false }),
    ['pt', 'en', 'speak', 'challenges']
  );

  // If 'speak_blind_en' was the only speak step, full sentence converts it to 'speak' when blindSpeakingOnFullSentence is false
  const onlyBlindSettings = {
    ...DEFAULT_SETTINGS,
    blindSpeakingOnFullSentence: false,
    cardSequence: ['pt', 'en', 'speak_blind_en', 'challenges'] as any
  };
  assert.deepEqual(
    buildEffectiveCardSequence(onlyBlindSettings, { isStepByStepMode: true, isSubClauseStep: false }),
    ['pt', 'en', 'speak', 'challenges']
  );
});

test('Voice & AI Hub: getAdaptiveSilenceDebounceMs, strictness modes, and generateInstantPhoneticCoachFeedback behave accurately', async () => {
  const {
    getAdaptiveSilenceDebounceMs,
    calculateSimilarity,
    isWordMatch,
    generateInstantPhoneticCoachFeedback
  } = await import('./shadowing');

  // Breathing pause mode scales silence debounce duration
  const shortPause = getAdaptiveSilenceDebounceMs('Every morning I walk to a coffee shop', 'short');
  const normalPause = getAdaptiveSilenceDebounceMs('Every morning I walk to a coffee shop', 'normal');
  const longPause = getAdaptiveSilenceDebounceMs('Every morning I walk to a coffee shop', 'long');
  assert.ok(shortPause < normalPause, `Expected shortPause (${shortPause}) < normalPause (${normalPause})`);
  assert.ok(normalPause < longPause, `Expected normalPause (${normalPause}) < longPause (${longPause})`);

  // Strictness modes affect fuzzy word matching and similarity scoring
  assert.equal(isWordMatch('walking', 'walkin', 'forgiving'), true);
  assert.equal(isWordMatch('cat', 'bat', 'strict'), false);

  const forgivingEval = calculateSimilarity('I am going to the market today', 'I going to market today', 'forgiving');
  const strictEval = calculateSimilarity('I am going to the market today', 'I going to market today', 'strict');
  assert.ok(forgivingEval.score >= strictEval.score);

  // Instant phonetic coach generates valid fluency/prosody scores and Portuguese tips
  const thEval = calculateSimilarity('Thought and truth are through the door', 'taught and true are true the door', 'balanced');
  const coachFeedback = generateInstantPhoneticCoachFeedback(
    'Thought and truth are through the door',
    'taught and true are true the door',
    thEval,
    'local_phonetic_coach'
  );
  assert.ok(coachFeedback.fluencyScore >= 35 && coachFeedback.fluencyScore <= 100);
  assert.ok(coachFeedback.prosodyScore >= 40 && coachFeedback.prosodyScore <= 100);
  assert.ok(coachFeedback.coachTipPt.includes('TH'));
});

test('Voice & AI Hub defaults to Gemini Neural TTS and normalizes removed paid/unconnected providers', async () => {
  const { DEFAULT_SETTINGS, loadSavedSettings } = await import('../services/storageService');

  assert.equal(DEFAULT_SETTINGS.ttsEngine, 'gemini_tts');
  assert.equal(DEFAULT_SETTINGS.sttProvider, 'hybrid_ai');

  const store = new Map<string, string>();
  const prevLocalStorage = (globalThis as any).localStorage;
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k)
  };

  try {
    // Legacy saved paid providers are normalized cleanly
    store.set(
      'shadowreader_opts',
      JSON.stringify({ ttsEngine: 'openai_tts', sttProvider: 'groq_whisper' })
    );
    const normalizedPaid = loadSavedSettings();
    assert.equal(normalizedPaid.ttsEngine, 'gemini_tts');
    assert.equal(normalizedPaid.sttProvider, 'hybrid_ai');

    // Legacy untouched 'auto' migrates to Gemini Neural TTS on first load
    store.set('shadowreader_opts', JSON.stringify({ ttsEngine: 'auto', sttProvider: 'web_speech' }));
    const migratedLegacy = loadSavedSettings();
    assert.equal(migratedLegacy.ttsEngine, 'gemini_tts');
    assert.equal(migratedLegacy.sttProvider, 'web_speech');

    // Explicit user choice after v4 migration is preserved
    store.set(
      'shadowreader_opts',
      JSON.stringify({ ttsEngine: 'auto', sttProvider: 'gemini_stt', _v4GeminiDefault: true })
    );
    const preservedUserChoice = loadSavedSettings();
    assert.equal(preservedUserChoice.ttsEngine, 'auto');
    assert.equal(preservedUserChoice.sttProvider, 'gemini_stt');
  } finally {
    (globalThis as any).localStorage = prevLocalStorage;
  }
});

test('Global text size defaults to 110% (larger than 100%) and clamps custom values cleanly', async () => {
  const { DEFAULT_SETTINGS, loadSavedSettings } = await import('../services/storageService');

  assert.equal(DEFAULT_SETTINGS.fontSizeScale, 110);

  const store = new Map<string, string>();
  const prevLocalStorage = (globalThis as any).localStorage;
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k)
  };

  try {
    store.set('shadowreader_opts', JSON.stringify({ fontSizeScale: 125 }));
    assert.equal(loadSavedSettings().fontSizeScale, 125);

    store.set('shadowreader_opts', JSON.stringify({ fontSizeScale: 200 }));
    assert.equal(loadSavedSettings().fontSizeScale, 135);

    store.set('shadowreader_opts', JSON.stringify({ fontSizeScale: 50 }));
    assert.equal(loadSavedSettings().fontSizeScale, 85);

    store.set('shadowreader_opts', JSON.stringify({}));
    assert.equal(loadSavedSettings().fontSizeScale, 110);
  } finally {
    (globalThis as any).localStorage = prevLocalStorage;
  }
});

test('findRestartSeqIdxBeforeBlind rewinds strictly before speak_blind_en to nearest en or en_slow step', async () => {
  const { findRestartSeqIdxBeforeBlind } = await import('./cardSequencePresets');

  assert.equal(findRestartSeqIdxBeforeBlind(['pt', 'en', 'speak', 'speak_blind_en', 'challenges'], 3), 1);
  assert.equal(findRestartSeqIdxBeforeBlind(['pt', 'en', 'en_slow', 'speak', 'speak_blind_en'], 4), 2);
  assert.equal(findRestartSeqIdxBeforeBlind(['pt', 'en', 'speak_blind_en', 'speak'], 2), 1);
  assert.equal(findRestartSeqIdxBeforeBlind(['pt', 'speak_blind_en'], 1), 0);
  assert.equal(findRestartSeqIdxBeforeBlind(['speak_blind_en', 'pt'], 0), 0);
  // Also handles null/paused activeSeqIdx by finding speak_blind_en in sequence
  assert.equal(findRestartSeqIdxBeforeBlind(['pt', 'en', 'speak', 'speak_blind_en'], null), 1);
});

test('splitSentenceIntoStudySteps keeps exact Portuguese translations aligned per English clause without cross-clause word leaks', () => {
  // #17: Suddenly, we saw a tall man in a dark coat across the street.
  const s17 = splitSentenceIntoStudySteps(
    'Suddenly, we saw a tall man in a dark coat across the street.',
    'forward',
    'De repente, nós vimos um homem alto de casaco escuro do outro lado da rua.'
  ).filter(s => !s.isFull);
  assert.deepEqual(
    s17.map(s => [s.text, s.ptText]),
    [
      ['Suddenly, we saw a tall man', 'De repente, nós vimos um homem alto'],
      ['in a dark coat', 'de casaco escuro'],
      ['across the street.', 'do outro lado da rua.']
    ]
  );

  // #12: Yesterday she received a short letter from her father.
  const s12 = splitSentenceIntoStudySteps(
    'Yesterday she received a short letter from her father.',
    'forward',
    'Ontem ela recebeu uma carta curta do pai dela.'
  ).filter(s => !s.isFull);
  assert.deepEqual(
    s12.map(s => [s.text, s.ptText]),
    [
      ['Yesterday she received a short letter', 'Ontem ela recebeu uma carta curta'],
      ['from her father.', 'do pai dela.']
    ]
  );

  // #29: At the end of the wooden pier stood a locked door.
  const s29 = splitSentenceIntoStudySteps(
    'At the end of the wooden pier stood a locked door.',
    'forward',
    'No final do píer de madeira havia uma porta trancada.'
  ).filter(s => !s.isFull);
  assert.deepEqual(
    s29.map(s => [s.text, s.ptText]),
    [
      ['At the end of the wooden pier', 'No final do píer de madeira'],
      ['stood a locked door.', 'havia uma porta trancada.']
    ]
  );

  // old-lighthouse-secret #7: resting on a wooden desk
  const lighthouse7 = splitSentenceIntoStudySteps(
    'At the top, they discovered an old brass compass resting on a wooden desk.',
    'forward',
    'No topo, eles descobriram uma antiga bússola de latão apoiada sobre uma escrivaninha de madeira.'
  ).filter(s => !s.isFull);
  assert.equal(lighthouse7[lighthouse7.length - 1].text, 'resting on a wooden desk.');
  assert.equal(lighthouse7[lighthouse7.length - 1].ptText, 'apoiada sobre uma escrivaninha de madeira.');

  // sherlock #5: cold, precise but admirably balanced mind
  const sherlock5 = splitSentenceIntoStudySteps(
    'All emotions, and that one particularly, were abhorrent to his cold, precise but admirably balanced mind.',
    'forward',
    'Todas as emoções, e aquela particularmente, eram repugnantes à sua mente fria, precisa, mas admiravelmente equilibrada.'
  ).filter(s => !s.isFull);
  assert.deepEqual(
    sherlock5.map(s => [s.text, s.ptText]),
    [
      ['All emotions,', 'Todas as emoções,'],
      ['and that one particularly,', 'e aquela particularmente,'],
      [
        'were abhorrent to his cold, precise but admirably balanced mind.',
        'eram repugnantes à sua mente fria, precisa, mas admiravelmente equilibrada.'
      ]
    ]
  );

  // little-prince hat sentence: "Who would be frightened by a hat?"
  const lp = splitSentenceIntoStudySteps(
    'They answered me: "Why should anyone be frightened by a hat?"',
    'forward',
    'Elas me responderam: "Por que alguém ficaria com medo de um chapéu?"'
  ).filter(s => !s.isFull);
  assert.equal(lp[lp.length - 1].text, 'by a hat?"');
  assert.equal(lp[lp.length - 1].ptText, 'de um chapéu?"');
});

test('normalizeSpokenTranscriptNumbers converts clock times, cardinals, ordinals, years, decimals, and currencies into English words', () => {
  // User bug report: speaking "it's nine oclock" detected as "it's 9:00"
  assert.equal(normalizeSpokenTranscriptNumbers("it's 9:00"), "it's nine o'clock");
  assert.equal(
    normalizeSpokenTranscriptNumbers("it's 9:00", "It's nine oclock."),
    "it's nine oclock"
  );
  assert.equal(
    normalizeSpokenTranscriptNumbers("it's 9:00 o'clock"),
    "it's nine o'clock"
  );
  assert.equal(
    normalizeSpokenTranscriptNumbers('At 9:00 a.m. we met'),
    'At nine a.m. we met'
  );
  assert.equal(
    normalizeSpokenTranscriptNumbers("It's 9:30 and 9:05"),
    "It's nine thirty and nine oh five"
  );
  assert.equal(
    normalizeSpokenTranscriptNumbers('I waited 25 minutes on my 21st birthday'),
    'I waited twenty-five minutes on my twenty-first birthday'
  );
  assert.equal(
    normalizeSpokenTranscriptNumbers('It cost $12.50 with 15% tax and 3.5 stars'),
    'It cost twelve dollars and fifty cents with fifteen percent tax and three point five stars'
  );
  assert.equal(
    normalizeSpokenTranscriptNumbers('Written in 1984 and updated in 2024'),
    'Written in nineteen eighty-four and updated in twenty twenty-four'
  );
  assert.equal(numberToEnglishWords(1205), 'one thousand two hundred five');
  assert.equal(ordinalToEnglishWords(42), 'forty-second');
  assert.equal(yearToEnglishWords(2005), 'two thousand five');
});

test('calculateSimilarity scores spoken clock-time digits as 100% against spelled-out target phrases', () => {
  const sim1 = calculateSimilarity("It's nine oclock", "it's 9:00");
  assert.equal(sim1.score, 100);
  assert.equal(sim1.matchedCount, sim1.totalWords);

  const sim2 = calculateSimilarity("It's nine o'clock", "it's 9:00");
  assert.equal(sim2.score, 100);

  const sim3 = calculateSimilarity(
    'At nine oclock, I opened my laptop and joined the morning video call.',
    'At 9:00, I opened my laptop and joined the morning video call.'
  );
  assert.equal(sim3.score, 100);

  const sim4 = calculateSimilarity(
    'The last page contained a message written by the lighthouse keeper in 1984.',
    'The last page contained a message written by the lighthouse keeper in nineteen eighty four'
  );
  assert.equal(sim4.score, 100);
});

test('isWordMatch rejects minimal pairs and accepts real homophones/inflections', () => {
  // Regression: these used to return true through overlapping rhyme groups.
  assert.equal(isWordMatch('right', 'nine'), false);
  assert.equal(isWordMatch('do', 'so'), false);
  assert.equal(isWordMatch('know', 'show'), false);
  assert.equal(isWordMatch('thought', 'taught'), false);
  assert.equal(isWordMatch('art', 'part'), false);
  assert.equal(isWordMatch('in', 'point'), false);
  assert.equal(isWordMatch('sight', 'sit'), false);
  assert.equal(isWordMatch('hat', 'bat'), false);

  // Real homophones still match.
  assert.equal(isWordMatch('right', 'write'), true);
  assert.equal(isWordMatch('know', 'no'), true);
  assert.equal(isWordMatch('knight', 'night'), true);

  // Regular inflections still match without bare-prefix matching.
  assert.equal(isWordMatch('walk', 'walking'), true);
  assert.equal(isWordMatch('pictures', 'picture'), true);
});

test('homophone table has no word in more than one group', () => {
  assert.deepEqual(findDuplicatePhoneticWords(), []);
});

test('calculateSimilarity guards empty targets and never returns NaN', () => {
  const emptyTarget = calculateSimilarity('', 'banana');
  assert.equal(emptyTarget.score, 0);
  assert.equal(emptyTarget.totalWords, 0);

  const punctuationOnly = calculateSimilarity('!!!', 'banana');
  assert.equal(punctuationOnly.score, 0);

  const numeric = calculateSimilarity('hello', 'hello');
  assert.equal(Number.isFinite(numeric.score), true);
});

test('segmentBookText keeps very short sentences and text without final punctuation', () => {
  assert.deepEqual(segmentBookText('Yes!').map(s => s.en), ['Yes!']);

  const mixed = segmentBookText('A. B sem ponto');
  assert.deepEqual(mixed.map(s => s.en), ['A.', 'B sem ponto']);
});

test('segmentBookText splits long sentences instead of dropping them (no word loss)', () => {
  const makeSentence = (chars: number) => {
    const words: string[] = [];
    let length = 0;
    let i = 0;
    while (length < chars) {
      const word = `word${i++}`;
      words.push(word);
      length += word.length + 1;
    }
    return `${words.join(' ')}.`;
  };

  for (const chars of [400, 500, 800]) {
    const input = makeSentence(chars);
    const sentences = segmentBookText(input);
    assert.ok(sentences.length >= 1, `expected sentences for ${chars} chars`);
    assert.ok(
      sentences.every(s => s.en.length <= MAX_BOOK_SENTENCE_CHARS),
      `expected every sentence <= ${MAX_BOOK_SENTENCE_CHARS} chars (${chars})`
    );

    const countWords = (text: string) =>
      text
        .replace(/[^a-z0-9\s]/gi, ' ')
        .split(/\s+/)
        .filter(Boolean).length;
    const outputWords = sentences.reduce((acc, s) => acc + countWords(s.en), 0);
    assert.equal(outputWords, countWords(input), `no word loss for ${chars} chars`);
  }

  const singleWord = segmentBookText('Hello');
  assert.deepEqual(singleWord.map(s => s.en), ['Hello']);
});

test('alignPortugueseClauses distributes the translation instead of repeating the whole sentence', () => {
  // P === M: one token per clause.
  assert.deepEqual(alignPortugueseClauses(['Hello there', 'my old friend'], 'Olá amigo'), [
    'Olá',
    'amigo'
  ]);

  // P < M: never duplicate the full PT sentence across steps and never lose a token.
  const aligned = alignPortugueseClauses(
    ['Hello', 'my old friend', 'goodbye'],
    'Olá amigo'
  );
  assert.equal(aligned.length, 3);
  assert.equal(aligned.join(' ').replace(/\s+/g, ' ').trim(), 'Olá amigo');
  assert.ok(aligned.every(part => part !== 'Olá amigo'));

  // Empty translation stays empty.
  assert.deepEqual(alignPortugueseClauses(['Hello', 'world'], ''), ['', '']);
});

test('isVocabDueForReview treats invalid review dates as due instead of hiding the word forever', () => {
  const base = { word: 'hat', sentence: 'It looked like a hat.', date: '2026-01-01' };
  assert.equal(isVocabDueForReview({ ...base, nextReviewDate: 'not-a-date' }), true);
  assert.equal(isVocabDueForReview({ ...base, nextReviewDate: '' }), true);
  assert.equal(
    isVocabDueForReview({ ...base, nextReviewDate: '2999-01-01T00:00:00.000Z' }, new Date('2026-01-01')),
    false
  );
  assert.equal(
    isVocabDueForReview({ ...base, nextReviewDate: '2020-01-01T00:00:00.000Z' }, new Date('2026-01-01')),
    true
  );
});

test('cleanString and cleanSpeech normalize accents and typographic apostrophes', () => {
  assert.equal(cleanString('café'), 'cafe');
  assert.equal(cleanString('não'), 'nao');
  assert.equal(cleanSpeech('I can’t wait'), 'i cannot wait');
  assert.equal(cleanSpeech('It’s 9:00'), 'it is nine oclock');
});



