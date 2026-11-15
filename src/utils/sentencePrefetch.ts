import {
  GeminiVoiceName,
  GeminiVoiceStyle,
  PedagogicalSettings,
  Sentence,
  StudyStepCardType,
  TtsEngine,
  WordEntry
} from '../types/shadowreader';
import { buildEffectiveCardSequence, isChallengeStepCard } from './cardSequencePresets';
import {
  buildInitialMatchingItems,
  buildPronunciationChallengeWords
} from './matchingPairs';
import {
  cleanString,
  getSpeakableWord,
  splitSentenceIntoStudySteps
} from './shadowing';

export interface TtsCacheKeyInput {
  provider: 'gemini_tts' | 'online';
  lang: string;
  voiceName?: GeminiVoiceName | string;
  voiceStyle?: GeminiVoiceStyle | string;
  text: string;
}

export interface PrefetchTtsTask {
  text: string;
  lang: 'en-US' | 'pt-BR';
  cacheKey: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SentencePrefetchPlan {
  sentenceTranslations: { sentenceIndex: number; text: string }[];
  literalWords: string[];
  ttsTasks: PrefetchTtsTask[];
}

export function normalizeTtsUtteranceText(rawText: string, lang: string): string {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return '';
  if (!trimmed.includes(' ')) {
    const speakable = getSpeakableWord(trimmed, lang);
    return speakable || trimmed;
  }
  return trimmed;
}

/**
 * Single source of truth for TTS memory cache keys shared between foreground playback
 * and background sentence pre-generation.
 */
export function buildTtsCacheKey({
  provider,
  lang,
  voiceName = 'Kore',
  voiceStyle = 'clear_teacher',
  text
}: TtsCacheKeyInput): string {
  const spokenText = normalizeTtsUtteranceText(text, lang);
  return `${provider}:${lang}:${voiceName}:${voiceStyle}:${spokenText.toLowerCase()}`;
}

export function needsSentenceTranslation(sentence?: Sentence | null): boolean {
  if (!sentence || !sentence.en || !sentence.en.trim()) return false;
  return !sentence.pt || sentence.pt.startsWith('[Tradução');
}

function resolvePrefetchTtsProvider(ttsEngine: TtsEngine): 'gemini_tts' | 'online' | null {
  if (ttsEngine === 'gemini_tts') return 'gemini_tts';
  if (ttsEngine === 'online') return 'online';
  return null;
}

function getSequenceLanguagePriority(effectiveSequence: StudyStepCardType[]): ('en-US' | 'pt-BR')[] {
  const order: ('en-US' | 'pt-BR')[] = [];
  for (const step of effectiveSequence) {
    if (step === 'pt' && !order.includes('pt-BR')) {
      order.push('pt-BR');
    } else if (
      (step === 'en' || step === 'en_slow' || step === 'literal') &&
      !order.includes('en-US')
    ) {
      order.push('en-US');
    }
  }
  if (!order.includes('en-US')) order.push('en-US');
  if (!order.includes('pt-BR')) order.push('pt-BR');
  return order;
}

export interface BuildSentencePrefetchPlanInput {
  currentSentence?: Sentence | null;
  nextSentence?: Sentence | null;
  nextSentenceIndex?: number;
  lookaheadSentence?: Sentence | null;
  lookaheadSentenceIndex?: number;
  settings: PedagogicalSettings;
  isStepByStepMode: boolean;
  exactDictLookup?: Record<string, WordEntry>;
  /** Optional predicate to skip TTS items already present in memory cache */
  isTtsCached?: (cacheKey: string) => boolean;
}

/**
 * Builds a deterministic, prioritized preparation plan for the next sentence (and any
 * remaining challenge/word assets of the current sentence) while the user is training.
 */
export function buildSentencePrefetchPlan({
  currentSentence,
  nextSentence,
  nextSentenceIndex = 1,
  lookaheadSentence,
  lookaheadSentenceIndex = 2,
  settings,
  isStepByStepMode,
  exactDictLookup = {},
  isTtsCached
}: BuildSentencePrefetchPlanInput): SentencePrefetchPlan {
  const sentenceTranslations: { sentenceIndex: number; text: string }[] = [];
  const literalWordSet = new Set<string>();
  const ttsTasks: PrefetchTtsTask[] = [];
  const seenTtsKeys = new Set<string>();

  const provider =
    (settings.ttsCacheEnabled ?? true)
      ? resolvePrefetchTtsProvider(settings.ttsEngine)
      : null;
  const voiceName = settings.geminiVoiceName || 'Kore';
  const voiceStyle = settings.geminiVoiceStyle || 'clear_teacher';

  const enqueueTts = (
    rawText: string | undefined,
    lang: 'en-US' | 'pt-BR',
    priority: 'high' | 'medium' | 'low'
  ) => {
    if (!provider || !rawText) return;
    const spoken = normalizeTtsUtteranceText(rawText, lang);
    if (!spoken) return;
    const cacheKey = buildTtsCacheKey({
      provider,
      lang,
      voiceName,
      voiceStyle,
      text: spoken
    });
    if (seenTtsKeys.has(cacheKey)) return;
    if (isTtsCached && isTtsCached(cacheKey)) return;
    seenTtsKeys.add(cacheKey);
    ttsTasks.push({
      text: spoken,
      lang,
      cacheKey,
      priority
    });
  };

  const addSentenceWords = (enText?: string) => {
    if (!enText) return;
    for (const token of enText.split(/\s+/)) {
      const clean = cleanString(token);
      if (clean) literalWordSet.add(clean);
    }
    for (const item of buildInitialMatchingItems(enText, exactDictLookup)) {
      if (item.fromSentence) {
        const clean = cleanString(item.en);
        if (clean) literalWordSet.add(clean);
      }
    }
    for (const item of buildPronunciationChallengeWords(enText, exactDictLookup)) {
      const clean = cleanString(item.en);
      if (clean) literalWordSet.add(clean);
    }
  };

  // 1. Translations needed for upcoming sentences
  if (nextSentence && needsSentenceTranslation(nextSentence)) {
    sentenceTranslations.push({
      sentenceIndex: nextSentenceIndex,
      text: nextSentence.en
    });
  }
  if (lookaheadSentence && needsSentenceTranslation(lookaheadSentence)) {
    sentenceTranslations.push({
      sentenceIndex: lookaheadSentenceIndex,
      text: lookaheadSentence.en
    });
  }

  const effectiveSequence = buildEffectiveCardSequence(settings, {
    isStepByStepMode,
    isSubClauseStep: false
  });
  const langOrder = getSequenceLanguagePriority(effectiveSequence);
  const includesPtStep = effectiveSequence.includes('pt');
  const includesLiteralStep = effectiveSequence.includes('literal');
  const includesChallenges = effectiveSequence.some(c => isChallengeStepCard(c));

  // 2. Ensure current sentence's challenge words & word-by-word tokens are warm before user reaches end of sentence
  if (currentSentence) {
    addSentenceWords(currentSentence.en);
    if (includesChallenges) {
      for (const cw of buildPronunciationChallengeWords(currentSentence.en, exactDictLookup)) {
        enqueueTts(cw.en, 'en-US', 'medium');
      }
      for (const mw of buildInitialMatchingItems(currentSentence.en, exactDictLookup)) {
        if (mw.fromSentence) {
          enqueueTts(mw.en, 'en-US', 'low');
        }
      }
    }
    if (includesLiteralStep) {
      for (const token of currentSentence.en.split(/\s+/).slice(0, 12)) {
        const clean = cleanString(token);
        if (clean) enqueueTts(clean, 'en-US', 'low');
      }
    }
  }

  // 3. Full pre-generation for next sentence (text, translations, sub-clauses, TTS, and challenge words)
  if (nextSentence && nextSentence.en.trim()) {
    addSentenceWords(nextSentence.en);

    // High priority: Next sentence's primary EN & PT audio in sequence order
    for (const lang of langOrder) {
      if (lang === 'en-US') {
        enqueueTts(nextSentence.en, 'en-US', 'high');
      } else if (lang === 'pt-BR' && includesPtStep && !needsSentenceTranslation(nextSentence)) {
        enqueueTts(nextSentence.pt, 'pt-BR', 'high');
      }
    }

    // High priority: Sub-clause EN & PT audio if Step-by-Step mode is active
    if (isStepByStepMode) {
      const steps = splitSentenceIntoStudySteps(
        nextSentence.en,
        'forward',
        needsSentenceTranslation(nextSentence) ? '' : nextSentence.pt
      );
      for (const step of steps) {
        if (step.isFull) continue;
        for (const lang of langOrder) {
          if (lang === 'en-US') {
            enqueueTts(step.text, 'en-US', 'high');
          } else if (lang === 'pt-BR' && includesPtStep && step.ptText) {
            enqueueTts(step.ptText, 'pt-BR', 'high');
          }
        }
      }
    }

    // Medium/Low priority: Next sentence's challenge pronunciation words & word tokens
    if (includesChallenges) {
      for (const cw of buildPronunciationChallengeWords(nextSentence.en, exactDictLookup)) {
        enqueueTts(cw.en, 'en-US', 'medium');
      }
    }
    if (includesLiteralStep) {
      for (const token of nextSentence.en.split(/\s+/).slice(0, 10)) {
        const clean = cleanString(token);
        if (clean) enqueueTts(clean, 'en-US', 'low');
      }
    }
  }

  // 4. Low priority: Lookahead sentence EN/PT audio
  if (lookaheadSentence && lookaheadSentence.en.trim()) {
    enqueueTts(lookaheadSentence.en, 'en-US', 'low');
    if (includesPtStep && !needsSentenceTranslation(lookaheadSentence)) {
      enqueueTts(lookaheadSentence.pt, 'pt-BR', 'low');
    }
  }

  return {
    sentenceTranslations,
    literalWords: Array.from(literalWordSet),
    ttsTasks
  };
}
