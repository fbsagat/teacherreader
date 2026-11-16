import { WordEntry } from '../types/shadowreader';

export interface LiteralTranslationResult {
  primaryPt: string;
  alternatives: string[];
}

export interface MatchingWordCandidate {
  id: string;
  en: string;
  pt: string;
  ipa: string;
  fromSentence: boolean;
  needsLiteralFetch: boolean;
  localAlternatives: string[];
  mistakeCount?: number;
}

export const MATCHING_STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'it',
  'is',
  'as',
  'or',
  'be',
  'so'
]);

export const EXTRA_DISTRACTOR_POOL: Array<{ en: string; pt: string; ipa: string }> = [
  { en: 'journey', pt: 'jornada', ipa: '/ˈdʒɜːr.ni/' },
  { en: 'knowledge', pt: 'conhecimento', ipa: '/ˈnɒl.ɪdʒ/' },
  { en: 'mountain', pt: 'montanha', ipa: '/ˈmaʊn.tən/' },
  { en: 'whisper', pt: 'sussurro', ipa: '/ˈwɪs.pər/' },
  { en: 'courage', pt: 'coragem', ipa: '/ˈkɜːr.ɪdʒ/' },
  { en: 'horizon', pt: 'horizonte', ipa: '/həˈraɪ.zən/' },
  { en: 'bridge', pt: 'ponte', ipa: '/brɪdʒ/' },
  { en: 'lantern', pt: 'lanterna', ipa: '/ˈlæn.tərn/' }
];

const PT_DANGLING_PREFIX_RE = /^(de|do|da|dos|das|em|no|na|nos|nas|para|por|com|ao|à)\s+/i;

/**
 * Cleans a raw token into lowercase ASCII-normalized English word without outer punctuation.
 */
export function normalizeEnglishChallengeToken(raw: string): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BC\u00B4]/g, "'")
    .replace(/[^a-z0-9']/g, '')
    .replace(/^'+|'+$/g, '')
    .trim();
}

/**
 * Cleans dictionary / translator Portuguese output into a concise literal label suitable for matching cards.
 */
export function sanitizeLiteralPtTranslation(enWord: string, rawPt: string): string {
  if (!rawPt) return '';
  const firstSense = rawPt.split('/')[0].trim();
  let cleaned = firstSense
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/[.!?,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned === '...') return '';
  if (cleaned.toUpperCase().includes('MYMEMORY')) return '';

  // Keep lowercase unless source is capitalized proper-noun-like or clean multi-word
  const cleanEn = normalizeEnglishChallengeToken(enWord);
  if (cleaned.toLowerCase() === cleanEn && !/^\d+$/.test(cleanEn)) {
    return '';
  }

  return cleaned.toLowerCase();
}

/**
 * Rejects noisy translation memory fragments (such as MyMemory returning "de arte" for "director").
 */
export function isSuspiciousMyMemoryFragment(
  enWord: string,
  ptCandidate: string,
  matchScore?: number
): boolean {
  const cleanEn = normalizeEnglishChallengeToken(enWord);
  const trimmedPt = (ptCandidate || '').trim();
  if (!trimmedPt) return true;
  if (trimmedPt.toUpperCase().includes('MYMEMORY')) return true;

  if (typeof matchScore === 'number' && matchScore < 0.85) {
    return true;
  }

  // Single English words should never start with dangling Portuguese prepositions like "de arte"
  if (!cleanEn.includes(' ') && PT_DANGLING_PREFIX_RE.test(trimmedPt)) {
    return true;
  }

  const ptWords = trimmedPt.split(/\s+/).filter(Boolean);
  if (!cleanEn.includes(' ') && ptWords.length > 3) {
    return true;
  }

  if (trimmedPt.toLowerCase() === cleanEn && !/^\d+$/.test(cleanEn)) {
    return true;
  }

  return false;
}

/**
 * Extracts primary literal translation + clean alternatives from Google Translate GTX JSON (`dt=t&dt=bd`).
 */
export function parseGoogleGtxWordResponse(
  enWord: string,
  gtxJson: unknown
): LiteralTranslationResult | null {
  if (!Array.isArray(gtxJson)) return null;

  const cleanEn = normalizeEnglishChallengeToken(enWord);
  let primaryRaw = '';
  if (Array.isArray(gtxJson[0])) {
    primaryRaw = gtxJson[0]
      .map(part => (Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''))
      .join('')
      .trim();
  }

  const alternatives: string[] = [];
  const seen = new Set<string>();

  const pushAlt = (candidate: string) => {
    const cleaned = sanitizeLiteralPtTranslation(cleanEn, candidate);
    if (!cleaned) return;
    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      alternatives.push(cleaned);
    }
  };

  const sanitizedPrimary = sanitizeLiteralPtTranslation(cleanEn, primaryRaw);
  if (sanitizedPrimary) {
    seen.add(sanitizedPrimary);
    alternatives.push(sanitizedPrimary);
  }

  // Bilingual dictionary entries at gtxJson[1]: [[pos, [word1, word2, ...], ...], ...]
  if (Array.isArray(gtxJson[1])) {
    for (const posGroup of gtxJson[1]) {
      if (!Array.isArray(posGroup) || !Array.isArray(posGroup[1])) continue;
      for (const wordCandidate of posGroup[1]) {
        if (typeof wordCandidate === 'string') {
          pushAlt(wordCandidate);
        }
      }
    }
  }

  const primaryPt = sanitizedPrimary || alternatives[0] || '';
  if (!primaryPt) return null;

  return {
    primaryPt,
    alternatives
  };
}

function normalizeWordErrorMap(
  wordErrorCounts?: Record<string, number>
): Record<string, number> {
  const normalized: Record<string, number> = {};
  if (!wordErrorCounts) return normalized;
  for (const [rawKey, rawVal] of Object.entries(wordErrorCounts)) {
    const clean = normalizeEnglishChallengeToken(rawKey);
    if (!clean || typeof rawVal !== 'number' || rawVal <= 0) continue;
    normalized[clean] = (normalized[clean] || 0) + rawVal;
  }
  return normalized;
}

/**
 * Selects up to `maxWords` distinct English words directly from the sentence,
 * prioritizing words the user mispronounced most often in this sentence, then content words.
 */
export function extractSentenceWordsForMatching(
  sentenceEn: string,
  maxWords = 5,
  wordErrorCounts?: Record<string, number>
): string[] {
  const errMap = normalizeWordErrorMap(wordErrorCounts);
  const rawTokens = (sentenceEn || '').split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const missedCandidates: Array<{ word: string; count: number; order: number }> = [];
  const primaryCandidates: string[] = [];
  const secondaryCandidates: string[] = [];
  const tinyCandidates: string[] = [];

  const isDuplicateMorph = (candidate: string): boolean => {
    if (seen.has(candidate)) return true;
    // Avoid picking both singular & plural of exact same root in one 5-card round
    if (seen.has(`${candidate}s`) || (candidate.endsWith('s') && seen.has(candidate.slice(0, -1)))) {
      return true;
    }
    return false;
  };

  let tokenOrder = 0;
  for (const tok of rawTokens) {
    const clean = normalizeEnglishChallengeToken(tok);
    if (!clean || isDuplicateMorph(clean)) continue;
    seen.add(clean);

    const errCount = errMap[clean] || 0;
    if (errCount > 0) {
      missedCandidates.push({ word: clean, count: errCount, order: tokenOrder++ });
      continue;
    }
    tokenOrder++;

    if (clean.length >= 3 && !MATCHING_STOP_WORDS.has(clean)) {
      primaryCandidates.push(clean);
    } else if (clean.length >= 2) {
      secondaryCandidates.push(clean);
    } else {
      tinyCandidates.push(clean);
    }
  }

  missedCandidates.sort(
    (a, b) =>
      b.count - a.count || b.word.length - a.word.length || a.order - b.order
  );

  const ordered = [
    ...missedCandidates.map(m => m.word),
    ...[...primaryCandidates].sort((a, b) => b.length - a.length),
    ...[...secondaryCandidates].sort((a, b) => b.length - a.length),
    ...tinyCandidates
  ];

  return ordered.slice(0, maxWords);
}

/**
 * Extracts all clean Portuguese senses from an exact dictionary entry string (e.g. "de idade / velho").
 */
export function extractDictionaryAlternatives(enWord: string, entry?: WordEntry): string[] {
  if (!entry?.pt || entry.pt === '...') return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of entry.pt.split('/')) {
    const clean = sanitizeLiteralPtTranslation(enWord, part);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

/**
 * Builds up to `maxWords` (default 5) pronunciation challenge words directly from the sentence,
 * prioritizing the words the user mispronounced most often on that sentence.
 */
export function buildPronunciationChallengeWords(
  sentenceEn: string,
  exactDictLookup: Record<string, WordEntry>,
  wordErrorCounts?: Record<string, number>,
  maxWords = 5
): MatchingWordCandidate[] {
  const errMap = normalizeWordErrorMap(wordErrorCounts);
  const selectedTokens = extractSentenceWordsForMatching(sentenceEn, maxWords, errMap);

  const items: MatchingWordCandidate[] = selectedTokens.map((w, i) => {
    const exactEntry = exactDictLookup[w];
    const localAlternatives = extractDictionaryAlternatives(w, exactEntry);
    const localPt = localAlternatives[0] || '';
    const needsLiteralFetch =
      !localPt ||
      PT_DANGLING_PREFIX_RE.test(localPt) ||
      Boolean(exactEntry?.pt && exactEntry.pt.includes('/'));

    return {
      id: `p_${i}_${w}`,
      en: w,
      pt: localPt || w,
      ipa: exactEntry?.ipa || `/${w}/`,
      fromSentence: true,
      needsLiteralFetch,
      localAlternatives,
      mistakeCount: errMap[w] || 0
    };
  });

  if (items.length === 0) {
    const fallback = EXTRA_DISTRACTOR_POOL[0];
    items.push({
      id: 'w_fallback_0',
      en: fallback.en,
      pt: fallback.pt,
      ipa: fallback.ipa,
      fromSentence: false,
      needsLiteralFetch: false,
      localAlternatives: [fallback.pt],
      mistakeCount: 0
    });
  }

  return items;
}

/**
 * Builds the initial matching & pronunciation items directly from sentence words,
 * tagging items that should fetch an isolated literal translation from GTX.
 */
export function buildInitialMatchingItems(
  sentenceEn: string,
  exactDictLookup: Record<string, WordEntry>,
  maxWords = 5,
  wordErrorCounts?: Record<string, number>
): MatchingWordCandidate[] {
  const errMap = normalizeWordErrorMap(wordErrorCounts);
  const selectedTokens = extractSentenceWordsForMatching(sentenceEn, maxWords, errMap);

  const items: MatchingWordCandidate[] = selectedTokens.map((w, i) => {
    const exactEntry = exactDictLookup[w];
    const localAlternatives = extractDictionaryAlternatives(w, exactEntry);
    const localPt = localAlternatives[0] || '';

    // Always fetch isolated literal translation for:
    // 1) Words absent from exact DICT_DB (like "director")
    // 2) Entries whose first local sense starts with a contextual preposition ("de idade", "de madeira")
    //    or has multiple book-contextual meanings where isolated literal translation is clearer.
    const needsLiteralFetch =
      !localPt ||
      PT_DANGLING_PREFIX_RE.test(localPt) ||
      Boolean(exactEntry?.pt && exactEntry.pt.includes('/'));

    return {
      id: `w_${i}_${w}`,
      en: w,
      pt: localPt || w,
      ipa: exactEntry?.ipa || `/${w}/`,
      fromSentence: true,
      needsLiteralFetch,
      localAlternatives,
      mistakeCount: errMap[w] || 0
    };
  });

  // Pad up to maxWords with verified distractors only if sentence had fewer than maxWords unique words
  let dIdx = 0;
  while (items.length < maxWords && dIdx < EXTRA_DISTRACTOR_POOL.length) {
    const dist = EXTRA_DISTRACTOR_POOL[dIdx++];
    if (!items.some(item => item.en === dist.en)) {
      items.push({
        id: `dist_${dist.en}`,
        en: dist.en,
        pt: dist.pt,
        ipa: dist.ipa,
        fromSentence: false,
        needsLiteralFetch: false,
        localAlternatives: [dist.pt],
        mistakeCount: 0
      });
    }
  }

  return items;
}

/**
 * Ensures every card in the matching pool has a distinct, non-empty literal Portuguese translation
 * (never duplicating the same Portuguese string on two different English cards).
 */
export function deduplicateMatchingTranslations<
  T extends { id: string; en: string; pt: string }
>(items: T[], alternativesById: Record<string, string[]>): T[] {
  const usedPt = new Set<string>();

  return items.map(item => {
    const currentClean = (item.pt || '').trim().toLowerCase();
    const candidates = [
      currentClean,
      ...(alternativesById[item.id] || []).map(a => a.trim().toLowerCase())
    ].filter(c => c && c !== '...' && c !== item.en.toLowerCase());

    const uniqueCandidate = candidates.find(c => !usedPt.has(c));
    const chosen = uniqueCandidate || currentClean || item.en;
    usedPt.add(chosen.toLowerCase());

    if (chosen === item.pt) {
      return item;
    }
    return {
      ...item,
      pt: chosen
    };
  });
}
