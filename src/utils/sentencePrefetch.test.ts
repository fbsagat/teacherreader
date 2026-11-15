import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSentencePrefetchPlan,
  buildTtsCacheKey,
  needsSentenceTranslation,
  normalizeTtsUtteranceText
} from './sentencePrefetch';
import { PedagogicalSettings } from '../types/shadowreader';
import {
  clearTtsAudioCache,
  fetchSentenceTranslation,
  hasCachedLiteralWord,
  hasCachedSentenceTranslation,
  isTtsAudioCached,
  prepareNextSentenceResources,
  resolveLiteralWordWithAlternatives
} from '../services/audioAndTranslationService';

const BASE_SETTINGS: PedagogicalSettings = {
  ttsEngine: 'gemini_tts',
  geminiVoiceName: 'Kore',
  geminiVoiceStyle: 'clear_teacher',
  ttsCacheEnabled: true,
  sttProvider: 'web_speech',
  micNoiseSuppression: true,
  audioFlow: 'custom',
  cardSequence: ['pt', 'en', 'en_slow', 'literal', 'speak', 'challenge_pronunciation'],
  visualCardOrder: ['pt', 'en', 'literal'],
  enableBlindSpeakingStage: false,
  blindMaxErrorsBeforeReveal: 2,
  repeatOnError: false,
  slowdownOnError: false,
  readWordsOnSuccess: false,
  enablePostSentenceChallenges: true,
  enableWordPronunciationChallenge: true,
  enableWordMatchingChallenge: true,
  repeatSentenceOnChallengeFail: false,
  threshold: 70,
  ttsSpeedEn: 1.0,
  ttsSpeedPt: 1.15,
  audioBeeps: false,
  autoHandsFree: false,
  themeMode: 'dark',
  studyViewMode: 'cards',
  showConnectedSpeech: true,
  dailyGoalSentences: 10
};

test('normalizeTtsUtteranceText and buildTtsCacheKey handle casing, pronouns, and voice dimensions', () => {
  assert.equal(normalizeTtsUtteranceText('  i  ', 'en-US'), 'I');
  assert.equal(normalizeTtsUtteranceText('  Hello world. ', 'en-US'), 'Hello world.');

  const k1 = buildTtsCacheKey({
    provider: 'gemini_tts',
    lang: 'en-US',
    voiceName: 'Kore',
    voiceStyle: 'clear_teacher',
    text: 'Good Morning'
  });
  const k2 = buildTtsCacheKey({
    provider: 'gemini_tts',
    lang: 'en-US',
    voiceName: 'Kore',
    voiceStyle: 'clear_teacher',
    text: 'good morning'
  });
  const k3 = buildTtsCacheKey({
    provider: 'gemini_tts',
    lang: 'en-US',
    voiceName: 'Fenrir',
    voiceStyle: 'clear_teacher',
    text: 'good morning'
  });

  assert.equal(k1, k2);
  assert.notEqual(k1, k3);
});

test('needsSentenceTranslation detects empty or placeholder Portuguese translations', () => {
  assert.equal(needsSentenceTranslation(null), false);
  assert.equal(needsSentenceTranslation({ en: 'Hello there', pt: '' }), true);
  assert.equal(needsSentenceTranslation({ en: 'Hello there', pt: '[Tradução indisponível]' }), true);
  assert.equal(needsSentenceTranslation({ en: 'Hello there', pt: 'Olá' }), false);
});

test('buildSentencePrefetchPlan respects card sequence language priority and deduplicates en / en_slow', () => {
  const planPtFirst = buildSentencePrefetchPlan({
    currentSentence: { en: 'I drink water.', pt: 'Eu bebo água.' },
    nextSentence: {
      en: 'She reads books at night.',
      pt: 'Ela lê livros à noite.'
    },
    nextSentenceIndex: 1,
    settings: {
      ...BASE_SETTINGS,
      cardSequence: ['pt', 'en', 'en_slow', 'speak']
    },
    isStepByStepMode: false
  });

  const highTasksPtFirst = planPtFirst.ttsTasks.filter(t => t.priority === 'high');
  assert.equal(highTasksPtFirst.length, 2);
  assert.equal(highTasksPtFirst[0].lang, 'pt-BR');
  assert.equal(highTasksPtFirst[1].lang, 'en-US');

  const planEnFirst = buildSentencePrefetchPlan({
    currentSentence: { en: 'I drink water.', pt: 'Eu bebo água.' },
    nextSentence: {
      en: 'She reads books at night.',
      pt: 'Ela lê livros à noite.'
    },
    nextSentenceIndex: 1,
    settings: {
      ...BASE_SETTINGS,
      cardSequence: ['en', 'en_slow', 'pt', 'speak']
    },
    isStepByStepMode: false
  });

  const highTasksEnFirst = planEnFirst.ttsTasks.filter(t => t.priority === 'high');
  assert.equal(highTasksEnFirst.length, 2);
  assert.equal(highTasksEnFirst[0].lang, 'en-US');
  assert.equal(highTasksEnFirst[1].lang, 'pt-BR');
});

test('buildSentencePrefetchPlan enqueues sub-clause TTS in step-by-step mode and skips cached items', () => {
  const fullPlan = buildSentencePrefetchPlan({
    currentSentence: { en: 'First sentence.', pt: 'Primeira frase.' },
    nextSentence: {
      en: 'Because the weather was cold, we stayed home.',
      pt: 'Porque o tempo estava frio, nós ficamos em casa.'
    },
    nextSentenceIndex: 1,
    lookaheadSentence: {
      en: 'Tomorrow will be sunny.',
      pt: ''
    },
    lookaheadSentenceIndex: 2,
    settings: BASE_SETTINGS,
    isStepByStepMode: true
  });

  const highTasks = fullPlan.ttsTasks.filter(t => t.priority === 'high');
  assert.ok(highTasks.length >= 4, 'expected full sentence plus sub-clause TTS tasks');
  assert.equal(fullPlan.sentenceTranslations.length, 1);
  assert.equal(fullPlan.sentenceTranslations[0].sentenceIndex, 2);
  assert.ok(fullPlan.literalWords.includes('weather'));

  const firstKey = highTasks[0].cacheKey;
  const filteredPlan = buildSentencePrefetchPlan({
    currentSentence: { en: 'First sentence.', pt: 'Primeira frase.' },
    nextSentence: {
      en: 'Because the weather was cold, we stayed home.',
      pt: 'Porque o tempo estava frio, nós ficamos em casa.'
    },
    nextSentenceIndex: 1,
    settings: BASE_SETTINGS,
    isStepByStepMode: true,
    isTtsCached: key => key === firstKey
  });

  assert.equal(
    filteredPlan.ttsTasks.some(t => t.cacheKey === firstKey),
    false
  );
});

test('buildSentencePrefetchPlan omits TTS tasks for browser_custom or disabled cache but keeps text/words', () => {
  const plan = buildSentencePrefetchPlan({
    currentSentence: { en: 'Sample line.', pt: 'Linha de exemplo.' },
    nextSentence: { en: 'Unseen astronomical phenomenon.', pt: '' },
    nextSentenceIndex: 1,
    settings: { ...BASE_SETTINGS, ttsEngine: 'browser_custom' },
    isStepByStepMode: false
  });

  assert.equal(plan.ttsTasks.length, 0);
  assert.equal(plan.sentenceTranslations.length, 1);
  assert.ok(plan.literalWords.includes('astronomical'));
});

test('prepareNextSentenceResources pre-generates missing translation, words, and TTS while deduplicating concurrent requests', async () => {
  clearTtsAudioCache();
  const originalFetch = globalThis.fetch;
  const fetchCalls: { url: string; body?: string }[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const body = typeof init?.body === 'string' ? init.body : undefined;
    fetchCalls.push({ url, body });

    if (url.includes('translate.googleapis.com/translate_a/single')) {
      const parsedUrl = new URL(url);
      const q = parsedUrl.searchParams.get('q') || '';
      const dtParams = parsedUrl.searchParams.getAll('dt');
      await new Promise(r => setTimeout(r, 15));

      if (dtParams.includes('bd')) {
        return new Response(JSON.stringify([[['fenômeno', q, null, null, 1]]]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (q.toLowerCase().includes('aurora')) {
        return new Response(
          JSON.stringify([[[
            'A aurora brilhava intensamente sobre a floresta congelada.',
            q
          ]]]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify([[['Estrelas brilhantes apareceram sobre o vale silencioso.', q]]]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (url.includes('/api/voice-hub/tts')) {
      await new Promise(r => setTimeout(r, 15));
      return new Response(
        JSON.stringify({
          audioBase64: 'UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA',
          mimeType: 'audio/wav',
          providerUsed: 'gemini_tts'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  try {
    // Verify in-flight deduplication for sentence translation
    const [t1, t2] = await Promise.all([
      fetchSentenceTranslation('The aurora glowed brightly above the frozen forest.'),
      fetchSentenceTranslation('The aurora glowed brightly above the frozen forest.')
    ]);
    assert.equal(t1, t2);
    assert.equal(
      hasCachedSentenceTranslation('The aurora glowed brightly above the frozen forest.'),
      true
    );
    const auroraGtxCalls = fetchCalls.filter(
      c => c.url.includes('translate.googleapis.com') && c.url.includes('aurora')
    );
    assert.equal(auroraGtxCalls.length, 1);

    // Verify in-flight deduplication for literal word resolution
    const [w1, w2] = await Promise.all([
      resolveLiteralWordWithAlternatives('aurora'),
      resolveLiteralWordWithAlternatives('aurora')
    ]);
    assert.equal(w1.primaryPt, w2.primaryPt);
    assert.equal(hasCachedLiteralWord('aurora'), true);

    const translatedEvents: Array<{ idx: number; pt: string }> = [];
    let wordsResolvedCalled = false;

    const nextEn = 'Brightly shining stars appeared, over the quiet valley.';
    await prepareNextSentenceResources({
      currentSentence: {
        en: 'The aurora glowed brightly above the frozen forest.',
        pt: 'A aurora brilhava intensamente sobre a floresta congelada.'
      },
      nextSentence: { en: nextEn, pt: '' },
      nextSentenceIndex: 1,
      settings: BASE_SETTINGS,
      isStepByStepMode: false,
      onSentenceTranslated: (idx, pt) => {
        translatedEvents.push({ idx, pt });
      },
      onWordsResolved: () => {
        wordsResolvedCalled = true;
      }
    });

    assert.equal(translatedEvents.length, 1);
    assert.equal(translatedEvents[0].idx, 1);
    assert.equal(wordsResolvedCalled, true);
    assert.equal(
      isTtsAudioCached(nextEn, 'en-US', 'gemini_tts', {
        geminiVoiceName: 'Kore',
        geminiVoiceStyle: 'clear_teacher'
      }),
      true
    );
    assert.equal(
      isTtsAudioCached('Estrelas brilhantes apareceram sobre o vale silencioso.', 'pt-BR', 'gemini_tts', {
        geminiVoiceName: 'Kore',
        geminiVoiceStyle: 'clear_teacher'
      }),
      true
    );
  } finally {
    globalThis.fetch = originalFetch;
    clearTtsAudioCache();
  }
});
