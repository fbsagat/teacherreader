import { DICT_DB } from '../data/dictionaryDb';
import {
  AiPronunciationFeedback,
  CefrLevel,
  EvaluationResult,
  PhoneticTip,
  ProsodyChunk,
  Sentence,
  SttSilencePauseMode,
  SttStrictnessMode,
  VocabItem,
  WordEntry,
  WordInfo
} from '../types/shadowreader';

export function cleanString(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

const ONES_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen'
];

const TENS_WORDS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety'
];

const ORDINAL_ONES_WORDS: Record<number, string> = {
  1: 'first',
  2: 'second',
  3: 'third',
  4: 'fourth',
  5: 'fifth',
  6: 'sixth',
  7: 'seventh',
  8: 'eighth',
  9: 'ninth',
  10: 'tenth',
  11: 'eleventh',
  12: 'twelfth',
  13: 'thirteenth',
  14: 'fourteenth',
  15: 'fifteenth',
  16: 'sixteenth',
  17: 'seventeenth',
  18: 'eighteenth',
  19: 'nineteenth'
};

const ORDINAL_TENS_WORDS: Record<number, string> = {
  20: 'twentieth',
  30: 'thirtieth',
  40: 'fortieth',
  50: 'fiftieth',
  60: 'sixtieth',
  70: 'seventieth',
  80: 'eightieth',
  90: 'ninetieth'
};

/**
 * Converts a non-negative integer (0..999,999,999) into English words.
 */
export function numberToEnglishWords(n: number, hyphenate = true): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  const intVal = Math.floor(n);
  if (intVal < 20) return ONES_WORDS[intVal];
  if (intVal < 100) {
    const tens = Math.floor(intVal / 10);
    const rem = intVal % 10;
    return rem === 0
      ? TENS_WORDS[tens]
      : `${TENS_WORDS[tens]}${hyphenate ? '-' : ' '}${ONES_WORDS[rem]}`;
  }
  if (intVal < 1000) {
    const hundreds = Math.floor(intVal / 100);
    const rem = intVal % 100;
    return rem === 0
      ? `${ONES_WORDS[hundreds]} hundred`
      : `${ONES_WORDS[hundreds]} hundred ${numberToEnglishWords(rem, hyphenate)}`;
  }
  if (intVal < 1_000_000) {
    const thousands = Math.floor(intVal / 1000);
    const rem = intVal % 1000;
    return rem === 0
      ? `${numberToEnglishWords(thousands, hyphenate)} thousand`
      : `${numberToEnglishWords(thousands, hyphenate)} thousand ${numberToEnglishWords(rem, hyphenate)}`;
  }
  if (intVal < 1_000_000_000) {
    const millions = Math.floor(intVal / 1_000_000);
    const rem = intVal % 1_000_000;
    return rem === 0
      ? `${numberToEnglishWords(millions, hyphenate)} million`
      : `${numberToEnglishWords(millions, hyphenate)} million ${numberToEnglishWords(rem, hyphenate)}`;
  }
  return String(intVal)
    .split('')
    .map(d => ONES_WORDS[Number(d)] ?? d)
    .join(' ');
}

/**
 * Converts a 4-digit year (e.g. 1984 -> "nineteen eighty-four", 2024 -> "twenty twenty-four")
 * into natural spoken English words.
 */
export function yearToEnglishWords(year: number, hyphenate = true): string {
  if (year === 2000) return 'two thousand';
  if (year >= 2001 && year <= 2009) {
    return `two thousand ${numberToEnglishWords(year - 2000, hyphenate)}`;
  }
  if (year >= 1100 && year <= 2099) {
    const hi = Math.floor(year / 100);
    const lo = year % 100;
    const hiWord = numberToEnglishWords(hi, hyphenate);
    if (lo === 0) return `${hiWord} hundred`;
    if (lo < 10) return `${hiWord} oh ${numberToEnglishWords(lo, hyphenate)}`;
    return `${hiWord} ${numberToEnglishWords(lo, hyphenate)}`;
  }
  return numberToEnglishWords(year, hyphenate);
}

/**
 * Converts a positive integer into its English ordinal word form (e.g. 1 -> "first", 21 -> "twenty-first").
 */
export function ordinalToEnglishWords(n: number, hyphenate = true): string {
  const intVal = Math.floor(n);
  if (intVal <= 0) return numberToEnglishWords(intVal, hyphenate);
  if (ORDINAL_ONES_WORDS[intVal]) return ORDINAL_ONES_WORDS[intVal];
  if (intVal < 100) {
    if (ORDINAL_TENS_WORDS[intVal]) return ORDINAL_TENS_WORDS[intVal];
    const tens = Math.floor(intVal / 10);
    const rem = intVal % 10;
    return `${TENS_WORDS[tens]}${hyphenate ? '-' : ' '}${ORDINAL_ONES_WORDS[rem]}`;
  }
  const cardinal = numberToEnglishWords(intVal, hyphenate);
  const lastTwo = intVal % 100;
  if (lastTwo === 0) {
    return `${cardinal}th`;
  }
  const prefix = numberToEnglishWords(intVal - lastTwo, hyphenate);
  return `${prefix} ${ordinalToEnglishWords(lastTwo, hyphenate)}`;
}

/**
 * Normalizes digits, times (e.g. "9:00" -> "nine o'clock"), ordinals ("1st" -> "first"),
 * currencies ("$5" -> "five dollars"), percentages, decimals, and years inside STT transcripts
 * so the voice engine displays and evaluates spoken numbers as English words instead of digits.
 */
export function normalizeSpokenTranscriptNumbers(
  rawText: string,
  targetContext = ''
): string {
  if (!rawText) return '';

  const hasOclockPlain = Boolean(targetContext && /\boclock\b/i.test(targetContext));
  const hasOclockApostrophe = Boolean(targetContext && /\bo['’`]clock\b/i.test(targetContext));
  const oclockWord = hasOclockPlain && !hasOclockApostrophe ? 'oclock' : "o'clock";
  const preferThousandYear = Boolean(
    targetContext && /\b(?:one|two)\s+thousand\b/i.test(targetContext)
  );

  let text = rawText;

  // 1. Clock times (e.g. "9:00" -> "nine o'clock" / "nine oclock", "9:30" -> "nine thirty", "9:05" -> "nine oh five")
  text = text.replace(
    /\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/g,
    (match, hhStr: string, mmStr: string, _ssStr: string | undefined, offset: number, fullStr: string) => {
      const hourNum = parseInt(hhStr, 10);
      const minNum = parseInt(mmStr, 10);
      const hourWord = hourNum === 0 ? 'twelve' : numberToEnglishWords(hourNum);
      const after = fullStr.slice(offset + match.length);
      const hasTrailingOclock = /^\s*(?:o['’`]?clock|oclock)\b/i.test(after);
      const hasTrailingMeridiem = /^\s*(?:a\.?\s*m\.?|p\.?\s*m\.?)\b/i.test(after);

      if (minNum === 0) {
        if (hasTrailingOclock || hasTrailingMeridiem) {
          return hourWord;
        }
        return `${hourWord} ${oclockWord}`;
      }
      if (mmStr.startsWith('0')) {
        return `${hourWord} oh ${numberToEnglishWords(minNum)}`;
      }
      return `${hourWord} ${numberToEnglishWords(minNum)}`;
    }
  );

  // 2. US Dollar amounts (e.g. "$5" -> "five dollars", "$12.50" -> "twelve dollars and fifty cents")
  text = text.replace(
    /\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.([0-9]{1,2}))?\b/g,
    (_match, dollarsStr: string, centsStr?: string) => {
      const dollars = parseInt(dollarsStr.replace(/,/g, ''), 10);
      const dollarPart = `${numberToEnglishWords(dollars)} ${dollars === 1 ? 'dollar' : 'dollars'}`;
      if (centsStr !== undefined) {
        const cents = parseInt(centsStr.padEnd(2, '0'), 10);
        if (cents > 0) {
          return `${dollarPart} and ${numberToEnglishWords(cents)} ${cents === 1 ? 'cent' : 'cents'}`;
        }
      }
      return dollarPart;
    }
  );

  // 3. Percentages (e.g. "50%" -> "fifty percent", "3.5%" -> "three point five percent")
  text = text.replace(
    /\b([0-9]+)(?:\.([0-9]+))?\s*%/g,
    (_match, intPart: string, decPart?: string) => {
      const whole = numberToEnglishWords(parseInt(intPart, 10));
      if (decPart !== undefined) {
        const decWords = decPart
          .split('')
          .map(d => ONES_WORDS[Number(d)] ?? d)
          .join(' ');
        return `${whole} point ${decWords} percent`;
      }
      return `${whole} percent`;
    }
  );

  // 4. Ordinals (e.g. "1st" -> "first", "21st" -> "twenty-first")
  text = text.replace(/\b([0-9]+)(?:st|nd|rd|th)\b/gi, (_match, numStr: string) => {
    const val = parseInt(numStr, 10);
    return ordinalToEnglishWords(val);
  });

  // 5. Decimal numbers (e.g. "3.5" -> "three point five")
  text = text.replace(/\b([0-9]+)\.([0-9]+)\b/g, (_match, intPart: string, decPart: string) => {
    const whole = numberToEnglishWords(parseInt(intPart, 10));
    const decWords =
      decPart.startsWith('0') || decPart.length > 2
        ? decPart
            .split('')
            .map(d => ONES_WORDS[Number(d)] ?? d)
            .join(' ')
        : numberToEnglishWords(parseInt(decPart, 10));
    return `${whole} point ${decWords}`;
  });

  // 6. Remaining standalone integers & comma-grouped integers
  text = text.replace(/\b([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\b/g, (rawDigits: string) => {
    const hasCommas = rawDigits.includes(',');
    const cleanDigits = rawDigits.replace(/,/g, '');
    if (cleanDigits.length > 9) {
      return cleanDigits
        .split('')
        .map(d => ONES_WORDS[Number(d)] ?? d)
        .join(' ');
    }
    const n = parseInt(cleanDigits, 10);
    if (!Number.isFinite(n)) return rawDigits;
    if (!hasCommas && cleanDigits.length === 4 && n >= 1100 && n <= 2099 && !preferThousandYear) {
      return yearToEnglishWords(n);
    }
    return numberToEnglishWords(n);
  });

  return text;
}

export function cleanSpeech(text: string): string {
  if (!text) return '';
  let t = normalizeSpokenTranscriptNumbers(text).toLowerCase();
  t = t
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/n't\b/g, ' not')
    .replace(/'s\b/g, ' is')
    .replace(/'re\b/g, ' are')
    .replace(/'ll\b/g, ' will')
    .replace(/'ve\b/g, ' have')
    .replace(/'d\b/g, ' would')
    .replace(/\bo['’`]?clock\b/g, 'oclock')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\bo\s+clock\b/g, 'oclock');

  const words = t.split(/\s+/).filter(Boolean);
  return words.join(' ');
}

const HOMOPHONE_AND_PHONETIC_GROUPS: string[][] = [
  ['through', 'threw', 'thru', 'true', 'throw', 'thorough', 'though', 'truth', 'two', 'three', 'free', 'tree'],
  ['though', 'doe', 'dough', 'do', 'so', 'go', 'no', 'low', 'show', 'slow', 'know'],
  ['thought', 'taught', 'taut', 'tot', 'fought', 'bought', 'brought', 'caught', 'sought', 'short'],
  ['there', 'their', 'theyre', 'dare', 'air', 'hair', 'where', 'wear'],
  ['to', 'too', 'two'],
  ['for', 'four', 'fore'],
  ['one', 'won'],
  ['six', 'sick', 'seeks', 'sex'],
  ['saw', 'soar', 'sore', 'so'],
  ['old', 'hold', 'cold', 'gold', 'bold', 'told', 'fold', 'sold'],
  ['whole', 'hole', 'hold', 'role', 'roll'],
  ['boa', 'boar', 'bore', 'bow', 'boy'],
  ['prey', 'pray', 'play', 'pay'],
  ['sight', 'site', 'cite', 'side', 'sign'],
  ['night', 'knight', 'nine', 'light', 'right', 'write'],
  ['know', 'no', 'now', 'new', 'knew'],
  ['would', 'wood', 'good', 'could', 'should'],
  ['here', 'hear', 'ear', 'year', 'years', 'ears'],
  ['sea', 'see', 'she'],
  ['piece', 'peace', 'peas'],
  ['weak', 'week', 'wake'],
  ['meat', 'meet'],
  ['wait', 'weight', 'white'],
  ['ate', 'eight', 'hate'],
  ['son', 'sun', 'some', 'sum'],
  ['hour', 'our', 'are'],
  ['buy', 'by', 'bye'],
  ['eye', 'i', 'high', 'hi'],
  ['red', 'read'],
  ['past', 'passed'],
  ['aloud', 'allowed'],
  ['flower', 'flour']
];

export function normalizePhoneticSkeleton(word: string): string {
  if (!word) return '';
  let w = word.toLowerCase().trim();
  if (w === 'through' || w === 'threw' || w === 'thru') return 'tru';
  if (w === 'though' || w === 'dough' || w === 'doe') return 'to';
  w = w
    .replace(/^kn/, 'n')
    .replace(/^wr/, 'r')
    .replace(/^wh/, 'w')
    .replace(/ough/g, 'u')
    .replace(/augh/g, 'o')
    .replace(/igh/g, 'i')
    .replace(/ph/g, 'f')
    .replace(/gh/g, '')
    .replace(/^th/, 't')
    .replace(/th$/g, 't');
  return w;
}

export function isWordMatch(
  tw: string,
  sw: string,
  strictness: SttStrictnessMode = 'balanced'
): boolean {
  if (!tw || !sw) return false;
  const a = tw.toLowerCase().trim();
  const b = sw.toLowerCase().trim();
  if (a === b) return true;

  if (strictness === 'strict') {
    // In strict mode, only exact match or 1-letter plural/tense suffix on words >= 5 chars
    if (a.length >= 5 && b.length >= 5 && Math.abs(a.length - b.length) <= 1) {
      if (a.startsWith(b) || b.startsWith(a)) return true;
    }
    return false;
  }

  // Check homophones and common Web Speech API single-word phonetic transcriptions
  for (const group of HOMOPHONE_AND_PHONETIC_GROUPS) {
    if (group.includes(a) && group.includes(b)) {
      return true;
    }
  }

  // Check normalized phonetic skeleton (e.g., silent -ough / -gh / th-)
  const skelA = normalizePhoneticSkeleton(a);
  const skelB = normalizePhoneticSkeleton(b);
  if (skelA.length >= 2 && skelA === skelB) {
    return true;
  }

  if (a.length >= 3 && b.length >= 3) {
    if (a.startsWith(b) || b.startsWith(a)) return true;
    let diff = 0;
    const minL = Math.min(a.length, b.length);
    const maxL = Math.max(a.length, b.length);
    const maxAllowedDiff = strictness === 'forgiving' && minL >= 5 ? 2 : 1;
    if (maxL - minL <= maxAllowedDiff) {
      for (let i = 0; i < minL; i++) {
        if (a[i] !== b[i]) diff++;
      }
      if (diff <= maxAllowedDiff) return true;
    }
  }
  return false;
}

export function calculateSimilarity(
  target: string,
  spoken: string,
  strictness: SttStrictnessMode = 'balanced'
): EvaluationResult {
  const cleanTarget = cleanSpeech(target);
  const cleanSpoken = cleanSpeech(spoken);
  if (!cleanSpoken) {
    return { score: 0, wordResults: [], matchedCount: 0, totalWords: 1 };
  }

  const targetWords = cleanTarget.split(/\s+/).filter(Boolean);
  const spokenWords = cleanSpoken.split(/\s+/).filter(Boolean);
  if (targetWords.length === 0) {
    return { score: 100, wordResults: [], matchedCount: 0, totalWords: 0 };
  }

  let matchedCount = 0;
  const spokenUsed = new Set<number>();

  const wordResults = targetWords.map(tw => {
    let matched = false;
    for (let j = 0; j < spokenWords.length; j++) {
      if (!spokenUsed.has(j) && isWordMatch(tw, spokenWords[j], strictness)) {
        matched = true;
        spokenUsed.add(j);
        break;
      }
    }
    if (matched) matchedCount++;
    return { word: tw, matched };
  });

  const wordScore = Math.round((matchedCount / targetWords.length) * 100);

  // If evaluating a single word (e.g. post-sentence pronunciation challenge) and any spoken word matched it via isWordMatch, give full credit without spelling penalty on homophones (e.g., 'through' vs 'threw'/'thru')
  if (targetWords.length === 1 && matchedCount === 1) {
    return {
      score: 96,
      wordResults,
      matchedCount,
      totalWords: 1
    };
  }

  const n = cleanTarget.length;
  const m = cleanSpoken.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= n; i++) matrix[i] = [i];
  for (let j = 0; j <= m; j++) matrix[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (cleanTarget[i - 1] === cleanSpoken[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  const dist = matrix[n][m];
  const maxLen = Math.max(n, m);
  const stringScore = Math.max(0, Math.round(((maxLen - dist) / maxLen) * 100));

  let finalScore = Math.round(wordScore * 0.7 + stringScore * 0.3);
  if (strictness === 'forgiving' && finalScore > 0 && finalScore < 100) {
    finalScore = Math.min(100, finalScore + 5);
  } else if (strictness === 'strict' && finalScore < 100) {
    finalScore = Math.max(0, finalScore - 4);
  }

  return {
    score: finalScore,
    wordResults,
    matchedCount,
    totalWords: targetWords.length
  };
}

export function getEffectiveSpeed(
  lang: string,
  ttsSpeedEn: number,
  ttsSpeedPt: number,
  speedMultiplier = 1.0
): number {
  const isPt = lang.startsWith('pt');
  const base = isPt ? (ttsSpeedPt || 1.15) : (ttsSpeedEn || 0.85);
  return Math.max(0.6, Math.min(1.8, Number((base * speedMultiplier).toFixed(3))));
}

const CONTRACTION_SPEECH_MAP: Record<string, string> = {
  im: "I'm",
  ive: "I've",
  id: "I'd",
  dont: "don't",
  doesnt: "doesn't",
  didnt: "didn't",
  cant: "can't",
  couldnt: "couldn't",
  wont: "won't",
  wouldnt: "wouldn't",
  shouldnt: "shouldn't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  hasnt: "hasn't",
  havent: "haven't",
  hadnt: "hadn't",
  youre: "you're",
  theyre: "they're",
  hes: "he's",
  shes: "she's",
  thats: "that's",
  theres: "there's",
  whats: "what's",
  whos: "who's",
  lets: "let's",
  oclock: "o'clock"
};

/**
 * Produces a clean, natural token for TTS synthesis so single-letter words ("I", "a"),
 * contractions ("don't", "I'm", "I'll"), and hyphenated compounds never get dropped or misread.
 */
export function getSpeakableWord(rawWord: string, lang = 'en-US'): string {
  if (!rawWord) return '';
  const normalizedQuotes = rawWord.replace(/[’‘`]/g, "'");
  const trimmed = normalizedQuotes
    .replace(/^[^a-zA-Z0-9áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ']+|[^a-zA-Z0-9áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ']+$/g, '')
    .replace(/^'+|'+$/g, '')
    .trim();

  if (!trimmed) {
    return cleanString(rawWord);
  }

  if (lang.startsWith('en')) {
    const lower = trimmed.toLowerCase();
    if (lower === 'i') return 'I';
    if (lower === "i'm") return "I'm";
    if (lower === "i'll") return "I'll";
    if (lower === "i've") return "I've";
    if (lower === "i'd") return "I'd";
    if (CONTRACTION_SPEECH_MAP[lower]) {
      return CONTRACTION_SPEECH_MAP[lower];
    }
    if (trimmed.includes("'")) {
      return trimmed;
    }
    return lower;
  }

  return trimmed;
}

function findStemmedEntry(clean: string, cache?: Map<string, WordEntry>): WordEntry | null {
  const candidates: string[] = [];

  if (clean.endsWith('ies') && clean.length > 4) {
    candidates.push(`${clean.slice(0, -3)}y`);
  }
  if (clean.endsWith('es') && clean.length > 3) {
    candidates.push(clean.slice(0, -2));
    candidates.push(clean.slice(0, -1));
  }
  if (clean.endsWith('s') && clean.length > 2 && !clean.endsWith('ss')) {
    candidates.push(clean.slice(0, -1));
  }
  if (clean.endsWith('ied') && clean.length > 4) {
    candidates.push(`${clean.slice(0, -3)}y`);
  }
  if (clean.endsWith('ed') && clean.length > 3) {
    const base = clean.slice(0, -2);
    candidates.push(base);
    candidates.push(`${base}e`);
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      candidates.push(base.slice(0, -1));
    }
  }
  if (clean.endsWith('ing') && clean.length > 4) {
    const base = clean.slice(0, -3);
    candidates.push(base);
    candidates.push(`${base}e`);
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      candidates.push(base.slice(0, -1));
    }
  }
  if (clean.endsWith('ily') && clean.length > 4) {
    candidates.push(`${clean.slice(0, -3)}y`);
  }
  if (clean.endsWith('ly') && clean.length > 3) {
    candidates.push(clean.slice(0, -2));
    candidates.push(`${clean.slice(0, -2)}e`);
  }
  if (clean.endsWith('ier') && clean.length > 4) {
    candidates.push(`${clean.slice(0, -3)}y`);
  }
  if (clean.endsWith('iest') && clean.length > 5) {
    candidates.push(`${clean.slice(0, -4)}y`);
  }
  if (clean.endsWith('est') && clean.length > 4) {
    candidates.push(clean.slice(0, -3));
    candidates.push(clean.slice(0, -2));
  }

  for (const cand of candidates) {
    if (DICT_DB[cand]) return DICT_DB[cand];
    if (cache && cache.has(cand)) return cache.get(cand)!;
  }
  return null;
}

export function lookupLocalWordInfo(
  rawWord: string,
  cache?: Map<string, WordEntry>
): WordInfo {
  const clean = cleanString(rawWord);
  if (!clean) {
    return { word: '', pt: '', pos: 'Palavra', ipa: '', def: '' };
  }

  if (DICT_DB[clean]) {
    return { word: clean, ...DICT_DB[clean] };
  }

  if (cache && cache.has(clean)) {
    const cached = cache.get(clean)!;
    return {
      word: clean,
      pt: cached.pt,
      pos: cached.pos || 'Vocabulário',
      ipa: cached.ipa || `/${clean}/`,
      def: cached.def || `Tradução no contexto do livro: "${cached.pt}".`
    };
  }

  // Numeric token support (e.g. "1984", "20", "3")
  if (/^\d+$/.test(clean)) {
    return {
      word: clean,
      pt: clean,
      pos: 'Numeral',
      ipa: `/${clean}/`,
      def: `Numeral "${clean}" presente na frase.`
    };
  }

  const stemmed = findStemmedEntry(clean, cache);
  if (stemmed) {
    return {
      word: clean,
      pt: stemmed.pt,
      pos: stemmed.pos || 'Vocabulário',
      ipa: `/${clean}/`,
      def: stemmed.def || `Tradução derivada da raiz: "${stemmed.pt}".`
    };
  }

  return {
    word: clean,
    pt: '...',
    pos: 'Vocabulário',
    ipa: `/${clean}/`,
    def: `Consultando dicionário e tradução para "${clean}"...`
  };
}

const ABBREVIATIONS = [
  'Mr.',
  'Mrs.',
  'Ms.',
  'Dr.',
  'St.',
  'Prof.',
  'Jr.',
  'Sr.',
  'vs.',
  'etc.',
  'e.g.',
  'i.e.'
];

export function segmentBookText(rawText: string): Sentence[] {
  let cleaned = rawText
    .replace(/(\r\n|\n|\r)/gm, ' ')
    .replace(/\s+/g, ' ')
    .replace(/([a-z])-\s+([a-z])/gi, '$1$2')
    .trim();

  if (!cleaned) return [];

  // Protect common literary abbreviations before splitting by punctuation
  ABBREVIATIONS.forEach((abbr, idx) => {
    const escaped = abbr.replace('.', '\\.');
    const reg = new RegExp(`\\b${escaped}`, 'gi');
    cleaned = cleaned.replace(reg, `__ABBR_${idx}__`);
  });

  const rawSentences = cleaned.match(/[^.!?]+[.!?]+['"”’)]*(\s|$)/g) || [cleaned];
  const parsed: Sentence[] = [];

  for (const s of rawSentences) {
    let restored = s.trim();
    ABBREVIATIONS.forEach((abbr, idx) => {
      const reg = new RegExp(`__ABBR_${idx}__`, 'g');
      restored = restored.replace(reg, abbr);
    });

    if (restored.length > 10 && restored.length < 420) {
      // If a literary sentence is very long (> 130 chars) and has semicolons or ", and / , but", split into digestible study clauses
      const wordCount = restored.split(/\s+/).length;
      if (wordCount > 20 && /([;:]|,\s+(and|but|for|which|while|though)\b)/i.test(restored)) {
        const subParts = restored
          .split(/(?<=[;:])\s+|(?<=,)\s+(?=(?:and|but|for|which|while|though)\b)/i)
          .map(p => p.trim())
          .filter(p => p.length > 8);
        if (subParts.length > 1) {
          subParts.forEach(sp => parsed.push({ en: sp, pt: '' }));
          continue;
        }
      }
      parsed.push({
        en: restored,
        pt: ''
      });
    }
  }

  return parsed;
}

export interface SentenceStudyStep {
  index: number;
  label: string;
  text: string;
  ptText: string;
  isFull: boolean;
}

const EN_NON_FINAL_WORDS = new Set([
  'i',
  'he',
  'she',
  'we',
  'they',
  'you',
  'a',
  'an',
  'the',
  'my',
  'your',
  'his',
  'her',
  'its',
  'our',
  'their',
  'this',
  'that',
  'these',
  'those',
  'some',
  'any',
  'no',
  'every',
  'each',
  'all',
  'both',
  'another',
  'other',
  'many',
  'much',
  'few',
  'little',
  'several',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'twenty',
  'thirty',
  'first',
  'second',
  'third',
  'last',
  'next',
  'not',
  'never',
  'very',
  'too',
  'so',
  'quite',
  'rather',
  'really',
  'almost',
  'just',
  'still',
  'even',
  'only',
  'able',
  'am',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'shall',
  'should',
  'can',
  'could',
  'may',
  'might',
  'must',
  'to',
  'of',
  'in',
  'on',
  'at',
  'for',
  'with',
  'from',
  'by',
  'into',
  'onto',
  'upon',
  'about',
  'above',
  'below',
  'under',
  'over',
  'beneath',
  'underneath',
  'near',
  'beside',
  'between',
  'among',
  'through',
  'across',
  'along',
  'around',
  'behind',
  'before',
  'after',
  'during',
  'without',
  'within',
  'toward',
  'towards',
  'against',
  'and',
  'but',
  'or',
  'nor',
  'yet',
  'because',
  'although',
  'though',
  'while',
  'when',
  'where',
  'if',
  'whether',
  'since',
  'until',
  'unless',
  'who',
  'whom',
  'whose',
  'which',
  'what'
]);

const EN_PRENOMINAL_MODIFIERS = new Set([
  'small',
  'big',
  'large',
  'little',
  'old',
  'older',
  'elderly',
  'new',
  'young',
  'good',
  'bad',
  'great',
  'high',
  'higher',
  'highest',
  'low',
  'long',
  'short',
  'full',
  'empty',
  'hot',
  'cold',
  'warm',
  'cool',
  'fresh',
  'roasted',
  'black',
  'white',
  'red',
  'blue',
  'green',
  'yellow',
  'brown',
  'silver',
  'brass',
  'leather',
  'glass',
  'stone',
  'wooden',
  'iron',
  'tall',
  'bright',
  'busy',
  'colorful',
  'sunny',
  'calm',
  'gentle',
  'worried',
  'front',
  'clean',
  'international',
  'morning',
  'mobile',
  'rocky',
  'abandoned',
  'windy',
  'heavy',
  'loud',
  'spiral',
  'ancient',
  'traditional',
  'panoramic',
  'deep',
  'changing',
  'crisp',
  'mountain',
  'street',
  'coffee',
  'hotel',
  'room',
  'phone',
  'bottle',
  'video',
  'lighthouse',
  'lantern',
  'harbor',
  'valley',
  'pine',
  'cobblestone',
  'magnificent',
  'colored',
  'boa',
  'favorite',
  'quiet',
  'neighborhood',
  'english',
  'cheese',
  'corner',
  'software',
  'historical',
  'real',
  'true',
  'genuine',
  'rare',
  'stoic',
  'external',
  'disciplined',
  'constant',
  'meaningful',
  'trivial',
  'emotional',
  'wise',
  'storm',
  'daily',
  'inner',
  'deliberate',
  'intellectual',
  'relentless',
  'perfect',
  'observing',
  'reasoning',
  'Confirmed',
  'confirmed',
  'extraterrestrial',
  'encrypted',
  'data',
  'ocean',
  'harmonic',
  'acoustic',
  'synchronized',
  'translucent',
  'bioluminescent',
  'subterranean'
]);

const EN_CONJUNCTION_BREAKS = new Set([
  'and',
  'but',
  'or',
  'nor',
  'because',
  'although',
  'though',
  'while',
  'when',
  'where',
  'if',
  'whether',
  'since',
  'until',
  'unless',
  'that',
  'which',
  'who'
]);

const EN_PREPOSITION_BREAKS = new Set([
  'near',
  'to',
  'from',
  'in',
  'on',
  'at',
  'with',
  'without',
  'for',
  'by',
  'into',
  'through',
  'under',
  'underneath',
  'beneath',
  'over',
  'across',
  'along',
  'around',
  'toward',
  'towards',
  'behind',
  'before',
  'after',
  'during',
  'between',
  'among',
  'about',
  'against',
  'upon'
]);

const EN_PARTICIPLE_BREAKS = new Set([
  'reading',
  'digesting',
  'swallowing',
  'going',
  'walking',
  'shining',
  'resting',
  'filled',
  'written',
  'surrounded',
  'built',
  'detected',
  'exhausting',
  'working'
]);

const EN_OBJECT_PRONOUNS = new Set([
  'me',
  'him',
  'her',
  'us',
  'them',
  'it',
  'himself',
  'herself',
  'themselves'
]);

const EN_FINITE_VERBS_OR_AUX = new Set([
  'am',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'should',
  'can',
  'could',
  'may',
  'might',
  'must',
  'cannot',
  'fills',
  'begins',
  'stood',
  'led',
  'lay',
  'remains',
  'emerges',
  'transforms',
  'corresponded',
  'pulsed',
  'flowed',
  'understood',
  'reminded',
  'reclaim'
]);

function isLikelyEnglishModifier(cleanWord: string): boolean {
  if (!cleanWord) return false;
  if (EN_PRENOMINAL_MODIFIERS.has(cleanWord)) return true;
  const dictEntry = DICT_DB[cleanWord];
  if (dictEntry && dictEntry.pos) {
    const pos = dictEntry.pos.toLowerCase();
    if (
      pos.includes('adjetivo') ||
      pos.includes('artigo') ||
      pos.includes('determinante') ||
      pos.includes('numeral')
    ) {
      return true;
    }
  }
  return false;
}

function isProtectedEnglishBigram(prevClean: string, currClean: string): boolean {
  if (!prevClean || !currClean) return false;
  if (prevClean === 'years' && currClean === 'old') return true;
  if (prevClean === 'turn' && (currClean === 'off' || currClean === 'on')) return true;
  if (prevClean === 'knelt' && currClean === 'down') return true;
  if (prevClean === 'looked' && (currClean === 'around' || currClean === 'out' || currClean === 'at')) return true;
  if (prevClean === 'stepped' && currClean === 'onto') return true;
  if (prevClean === 'pointed' && (currClean === 'toward' || currClean === 'towards' || currClean === 'at')) return true;
  if (prevClean === 'ask' && currClean === 'for') return true;
  if (prevClean === 'asked' && currClean === 'for') return true;
  if (prevClean === 'waited' && currClean === 'for') return true;
  if (prevClean === 'corresponded' && currClean === 'exactly') return true;
  if (prevClean === 'going' && currClean === 'to') return true;
  if (prevClean === 'able' && currClean === 'to') return true;
  if (prevClean === 'next' && currClean === 'to') return true;
  if (prevClean === 'akin' && currClean === 'to') return true;
  if (prevClean === 'all' && currClean === 'the') return true;
  if (prevClean === 'way' && currClean === 'up') return true;
  if (prevClean === 'up' && currClean === 'to') return true;
  if (prevClean === 'step' && currClean === 'by') return true;
  if (prevClean === 'more' && currClean === 'than') return true;
  if (prevClean === 'rather' && currClean === 'than') return true;
  if (prevClean === 'close' && currClean === 'by') return true;
  if (prevClean === 'even' && (currClean === 'while' || currClean === 'though' || currClean === 'if')) return true;
  if (prevClean === 'so' && currClean === 'they') return false;
  return false;
}

function scoreEnglishBoundary(tokens: string[], breakBeforeIdx: number): number {
  const n = tokens.length;
  if (breakBeforeIdx < 2 || n - breakBeforeIdx < 2) return -1000;

  const prevRaw = tokens[breakBeforeIdx - 1];
  const currRaw = tokens[breakBeforeIdx];
  const prevClean = cleanString(prevRaw);
  const currClean = cleanString(currRaw);
  const nextClean = breakBeforeIdx + 1 < n ? cleanString(tokens[breakBeforeIdx + 1]) : '';
  const prevPrevClean = breakBeforeIdx >= 2 ? cleanString(tokens[breakBeforeIdx - 2]) : '';

  const prevEndsWithPunct = /[,.;:!?—–]['"”’)]*$/.test(prevRaw);

  if (prevEndsWithPunct) {
    // Avoid breaking inside tiny 2-word parenthetical like "He was, I take it,"
    if (breakBeforeIdx === 2 && breakBeforeIdx + 3 < n && /[,]$/.test(tokens[breakBeforeIdx + 2])) {
      return -20;
    }
    // Avoid breaking on a comma between coordinate prenominal adjectives ("crisp, cold mountain air")
    if (
      prevRaw.endsWith(',') &&
      isLikelyEnglishModifier(prevClean) &&
      isLikelyEnglishModifier(currClean)
    ) {
      return -25;
    }
    // Avoid breaking inside a short 3-item list at the end of a sentence ("about balance, patience, and craftsmanship")
    if (
      prevRaw.endsWith(',') &&
      n - breakBeforeIdx <= 3 &&
      (currClean === 'and' || currClean === 'or' || nextClean === 'and' || nextClean === 'or')
    ) {
      return -15;
    }
    return 48;
  }

  // Never end a clause on a non-final grammatical word
  if (EN_NON_FINAL_WORDS.has(prevClean)) {
    return -1000;
  }

  // Never split a protected phrasal verb or fixed expression
  if (isProtectedEnglishBigram(prevClean, currClean)) {
    return -1000;
  }

  // Never break right before an object pronoun (e.g., "to meet | her", "mention | her")
  if (EN_OBJECT_PRONOUNS.has(currClean)) {
    return -1000;
  }

  // Never split prenominal modifier / adjective from its following noun/adjective
  if (
    isLikelyEnglishModifier(prevClean) &&
    !EN_CONJUNCTION_BREAKS.has(currClean) &&
    !EN_PREPOSITION_BREAKS.has(currClean) &&
    !EN_FINITE_VERBS_OR_AUX.has(currClean)
  ) {
    return -900;
  }

  // Avoid splitting right before a comma that appears 1-2 words ahead (e.g. "hungry | and scared,")
  if (breakBeforeIdx + 1 < n && /[,;:]$/.test(tokens[breakBeforeIdx + 1])) {
    return -40;
  }

  let score = 0;

  if (EN_CONJUNCTION_BREAKS.has(currClean)) {
    // Check if 'and'/'or'/'but' is just linking two adjectives or two short nouns at the end of a phrase
    const remainingSlice = tokens.slice(breakBeforeIdx + 1);
    const hasVerbAfterCoord = remainingSlice.some(t => EN_FINITE_VERBS_OR_AUX.has(cleanString(t)));
    const isTightPair =
      ((currClean === 'and' || currClean === 'or') &&
        (n - breakBeforeIdx <= 3 ||
          (isLikelyEnglishModifier(prevClean) && isLikelyEnglishModifier(nextClean)))) ||
      (currClean === 'but' &&
        isLikelyEnglishModifier(prevClean) &&
        !hasVerbAfterCoord &&
        n - breakBeforeIdx <= 4);
    score += isTightPair ? 4 : 30;
  } else if (currClean === 'so' && (nextClean === 'i' || nextClean === 'they' || nextClean === 'we' || nextClean === 'he' || nextClean === 'she')) {
    score += 28;
  } else if (EN_PREPOSITION_BREAKS.has(currClean)) {
    // Avoid breaking before 'to' when preceded by a verb of telling/ordering with object ("told the man to meet", "ordered the crew to turn")
    if (
      currClean === 'to' &&
      (prevPrevClean === 'told' || prevPrevClean === 'ordered' || prevPrevClean === 'asked' || prevClean === 'merely')
    ) {
      score -= 15;
    } else {
      score += 24;
    }
  } else if (currClean === 'of') {
    // 'of' usually binds tightly ("slice of cheese", "picture of a hat", "wave of light")
    score += 2;
  } else if (EN_PARTICIPLE_BREAKS.has(currClean)) {
    score += 22;
  } else if (
    (currClean === 'i' || currClean === 'he' || currClean === 'she' || currClean === 'we' || currClean === 'they') &&
    breakBeforeIdx >= 3
  ) {
    // Subject pronoun after introductory adverbial phrase ("Every morning I...", "Through the window he...")
    score += 18;
  } else if (EN_FINITE_VERBS_OR_AUX.has(currClean) && breakBeforeIdx >= 4) {
    // Long subject NP followed by main verb
    score += 10;
  } else if (
    (currClean === 'the' || currClean === 'a' || currClean === 'an') &&
    breakBeforeIdx >= 5 &&
    n - breakBeforeIdx >= 5
  ) {
    // Allow breaking before a long direct-object Noun Phrase (5+ words) after a verb
    score += 14;
  }

  return score;
}

function segmentEnglishTokensIntoClauses(tokens: string[]): string[] {
  const n = tokens.length;
  if (n <= 5) return [tokens.join(' ')];

  // Determine ideal number of clauses (2 for 6..13 words, 2..3 for 12..19 words, 3..4 for 20+ words)
  const minClauses = 2;
  const maxClauses = n <= 10 ? 2 : n <= 17 ? 3 : 4;

  // Dynamic programming: dp[k][i] = best score to partition tokens[0..i-1] into k clauses
  const NEG_INF = -1e9;
  const dp: number[][] = Array.from({ length: maxClauses + 1 }, () =>
    Array(n + 1).fill(NEG_INF)
  );
  const parent: number[][] = Array.from({ length: maxClauses + 1 }, () =>
    Array(n + 1).fill(-1)
  );

  const clauseLenCost = (len: number, endsWithComma: boolean): number => {
    if (len < 2) return -1000;
    if (len === 2) return endsWithComma ? 2 : -42;
    if (len === 3) return endsWithComma ? 5 : 1;
    if (len >= 4 && len <= 7) return 8 - Math.abs(len - 5.5) * 1.2;
    if (len === 8) return 2;
    if (len === 9) return -3;
    return -10 - (len - 9) * 6;
  };

  for (let i = 2; i <= n; i++) {
    const endsComma = /[,.;:!?]['"”’)]*$/.test(tokens[i - 1]);
    dp[1][i] = clauseLenCost(i, endsComma);
  }

  for (let k = 2; k <= maxClauses; k++) {
    for (let i = k * 2; i <= n; i++) {
      const endsComma = /[,.;:!?]['"”’)]*$/.test(tokens[i - 1]);
      for (let prev = (k - 1) * 2; prev <= i - 2; prev++) {
        if (dp[k - 1][prev] <= NEG_INF / 2) continue;
        const bScore = scoreEnglishBoundary(tokens, prev);
        if (bScore <= -500) continue;
        const segScore = clauseLenCost(i - prev, endsComma);
        const total = dp[k - 1][prev] + bScore + segScore;
        if (total > dp[k][i]) {
          dp[k][i] = total;
          parent[k][i] = prev;
        }
      }
    }
  }

  let bestK = minClauses;
  let bestTotal = NEG_INF;
  for (let k = minClauses; k <= maxClauses; k++) {
    // Slight preference for fewer, cleaner clauses unless an extra split hits a strong boundary (> +22)
    const adjusted = dp[k][n] - (k - 2) * 18;
    if (adjusted > bestTotal) {
      bestTotal = adjusted;
      bestK = k;
    }
  }

  if (bestTotal <= NEG_INF / 2) {
    const mid = Math.ceil(n / 2);
    return [tokens.slice(0, mid).join(' '), tokens.slice(mid).join(' ')];
  }

  const breaks: number[] = [];
  let currPos = n;
  for (let k = bestK; k >= 2; k--) {
    const prevPos = parent[k][currPos];
    if (prevPos <= 0) break;
    breaks.unshift(prevPos);
    currPos = prevPos;
  }

  const clauses: string[] = [];
  let start = 0;
  for (const b of breaks) {
    clauses.push(tokens.slice(start, b).join(' '));
    start = b;
  }
  clauses.push(tokens.slice(start).join(' '));
  return clauses;
}

const PT_NON_FINAL_WORDS = new Set([
  'o',
  'a',
  'os',
  'as',
  'um',
  'uma',
  'uns',
  'umas',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'por',
  'pelo',
  'pela',
  'pelos',
  'pelas',
  'ao',
  'à',
  'aos',
  'às',
  'com',
  'sem',
  'para',
  'até',
  'sob',
  'sobre',
  'entre',
  'contra',
  'desde',
  'meu',
  'minha',
  'meus',
  'minhas',
  'seu',
  'sua',
  'seus',
  'suas',
  'nosso',
  'nossa',
  'nossos',
  'nossas',
  'este',
  'esta',
  'esse',
  'essa',
  'aquele',
  'aquela',
  'todo',
  'toda',
  'todos',
  'todas',
  'cada',
  'algum',
  'alguma',
  'nenhum',
  'nenhuma',
  'outro',
  'outra',
  'outros',
  'outras',
  'muito',
  'muita',
  'muitos',
  'muitas',
  'pouco',
  'pouca',
  'mais',
  'menos',
  'tão',
  'bem',
  'não',
  'nem',
  'que',
  'se',
  'e',
  'mas',
  'ou',
  'porque',
  'pois',
  'quando',
  'enquanto',
  'como',
  'onde',
  'qual',
  'quais',
  'quem',
  'me',
  'te',
  'lhe',
  'lhes',
  'nos',
  'se'
]);

const PT_LOCUTION_HEADS = new Set([
  'perto',
  'longe',
  'dentro',
  'fora',
  'antes',
  'depois',
  'através',
  'atraves',
  'além',
  'alem',
  'apesar',
  'debaixo',
  'embaixo',
  'acima',
  'abaixo',
  'redor',
  'direção',
  'direcao',
  'lado',
  'frente',
  'meio',
  'vez',
  'causa',
  'beira',
  'centro',
  'topo',
  'final',
  'parte',
  'cheio',
  'cheia',
  'fatia',
  'xícara',
  'xicara',
  'pote',
  'garrafa',
  'tampa',
  'número',
  'numero',
  'livro',
  'banco',
  'placa',
  'placas',
  'prédios',
  'predios',
  'barraquinha',
  'portão',
  'portao',
  'bússola',
  'bussola',
  'caderno',
  'mapas',
  'guardião',
  'guardiao',
  'baú',
  'bau',
  'estação',
  'estacao',
  'campos',
  'pontes',
  'lentes',
  'anos',
  'pacote',
  'floresta',
  'onda',
  'ondas',
  'ausência',
  'ausencia',
  'forma',
  'máquina',
  'maquina',
  'cadeia',
  'coelho'
]);

const PT_PRENOMINAL_ADJECTIVES = new Set([
  'pequeno',
  'pequena',
  'pequenos',
  'pequenas',
  'grande',
  'grandes',
  'bom',
  'boa',
  'bons',
  'boas',
  'novo',
  'nova',
  'novos',
  'novas',
  'velho',
  'velha',
  'antigo',
  'antiga',
  'antigos',
  'antigas',
  'primeiro',
  'primeira',
  'segundo',
  'segunda',
  'último',
  'ultimo',
  'última',
  'ultima',
  'único',
  'unico',
  'única',
  'unica',
  'próprio',
  'proprio',
  'própria',
  'propria',
  'verdadeiro',
  'verdadeira',
  'breve',
  'pesada',
  'pesado',
  'ampla',
  'amplo'
]);

const PT_CLAUSE_STARTERS = new Set([
  'e',
  'mas',
  'ou',
  'porque',
  'pois',
  'quando',
  'enquanto',
  'onde',
  'como',
  'se',
  'que',
  'para',
  'até',
  'ate',
  'sem',
  'com',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'pelo',
  'pela',
  'pelos',
  'pelas',
  'sob',
  'sobre',
  'debaixo',
  'durante',
  'antes',
  'depois',
  'perto'
]);

const EN_TO_PT_ANCHOR_MAP: Record<string, string[]> = {
  every: ['toda', 'todo', 'todos', 'todas', 'cada'],
  morning: ['manha', 'manhas', 'matinal'],
  walk: ['caminho', 'caminhou', 'caminhar', 'ando'],
  walked: ['caminhou', 'andou', 'caminhar'],
  walking: ['caminhando', 'andando'],
  to: ['ate', 'para', 'ao', 'a', 'as'],
  small: ['pequena', 'pequeno', 'pequenos', 'pequenas', 'cachorrinho'],
  coffee: ['cafe', 'cafeteria'],
  shop: ['cafeteria', 'loja'],
  near: ['perto', 'proximo', 'proxima'],
  rabbit: ['coelho'],
  white: ['branco', 'branca'],
  pink: ['rosa', 'corderosa'],
  eyes: ['olhos'],
  supplychain: ['cadeia', 'suprimentos'],
  metrics: ['metricas'],
  my: ['minha', 'meu', 'meus', 'minhas'],
  house: ['casa'],
  warm: ['quente', 'quentinho', 'morno'],
  smell: ['cheiro', 'aroma'],
  fresh: ['fresco', 'fresca', 'puro'],
  bread: ['pao'],
  and: ['e'],
  roasted: ['torrado', 'torrada'],
  fills: ['enche', 'preenche'],
  street: ['rua', 'ruas'],
  smile: ['sorrio', 'sorriso'],
  barista: ['barista'],
  ask: ['peco', 'pedir', 'pergunto'],
  asked: ['perguntou', 'perguntei', 'pediu'],
  hot: ['quente'],
  cup: ['xicara'],
  black: ['preto', 'preta'],
  gives: ['entrega', 'da'],
  gave: ['deu', 'entregou'],
  croissant: ['croissant'],
  plate: ['prato'],
  sit: ['sento', 'sentar'],
  sat: ['sentou', 'sentada'],
  sitting: ['sentada', 'sentado'],
  window: ['janela'],
  watch: ['observo', 'observa', 'assistir'],
  watched: ['observaram', 'observou', 'assistiu'],
  people: ['pessoas'],
  going: ['indo'],
  work: ['trabalho', 'trabalhando'],
  favorite: ['favorito', 'favorita'],
  quiet: ['tranquilo', 'tranquila', 'silencioso'],
  moment: ['momento'],
  before: ['antes'],
  busy: ['agitado', 'movimentado'],
  day: ['dia'],
  begins: ['comecar', 'comeca'],
  arrived: ['chegou'],
  airport: ['aeroporto'],
  friday: ['sexta'],
  took: ['pegou', 'tirou'],
  yellow: ['amarelo'],
  taxi: ['taxi'],
  from: ['do', 'da', 'de'],
  terminal: ['terminal'],
  hotel: ['hotel'],
  through: ['pela', 'pelo', 'atraves', 'durante', 'por'],
  saw: ['viu', 'vi', 'vimos', 'viram'],
  tall: ['altos', 'alto', 'alta', 'altas'],
  glass: ['vidro'],
  buildings: ['predios', 'edificios'],
  bright: ['luminosas', 'brilhante'],
  signs: ['placas', 'sinais'],
  reception: ['recepcao'],
  showed: ['mostrou', 'mostrei'],
  passport: ['passaporte'],
  got: ['pegou', 'conseguiu'],
  room: ['quarto', 'sala'],
  key: ['chave'],
  after: ['depois', 'apos'],
  short: ['breve', 'curto', 'curta', 'curtos', 'curtas'],
  rest: ['descanso'],
  with: ['com'],
  camera: ['camera'],
  families: ['familias'],
  picnics: ['piqueniques'],
  green: ['verde', 'verdes'],
  grass: ['grama'],
  under: ['sob', 'debaixo'],
  trees: ['arvores', 'pinheiros'],
  bought: ['comprou'],
  pretzel: ['pretzel'],
  cart: ['barraquinha', 'carrinho'],
  drank: ['bebeu'],
  cold: ['gelada', 'gelado', 'fria', 'frio'],
  water: ['agua'],
  evening: ['noite'],
  visited: ['visitou'],
  see: ['ver'],
  colorful: ['coloridas', 'coloridos'],
  lights: ['luzes'],
  ate: ['comeu'],
  slice: ['fatia'],
  cheese: ['queijo'],
  pizza: ['pizza'],
  corner: ['esquina'],
  restaurant: ['restaurante'],
  sleep: ['dormir', 'dormem'],
  sent: ['enviou'],
  three: ['tres'],
  photos: ['fotos'],
  family: ['familia'],
  sunny: ['ensolarada'],
  saturday: ['sabado'],
  afternoon: ['tarde'],
  neighborhood: ['bairro'],
  park: ['parque'],
  wooden: ['madeira'],
  bench: ['banco'],
  reading: ['lendo'],
  book: ['livro'],
  suddenly: ['repente'],
  brown: ['marrom'],
  dog: ['cachorro', 'cachorrinho'],
  ran: ['correu', 'corrido'],
  toward: ['direcao', 'para'],
  stopped: ['parou'],
  feet: ['pes'],
  looked: ['parecia', 'olhou'],
  hungry: ['faminto'],
  scared: ['assustado'],
  owner: ['dono'],
  around: ['perto', 'redor'],
  but: ['mas', 'porem'],
  nobody: ['ninguem'],
  calling: ['chamando'],
  knelt: ['ajoelhou'],
  spoke: ['falou', 'falaram'],
  calm: ['calma', 'calmo'],
  gentle: ['gentil'],
  voice: ['voz'],
  blue: ['azul'],
  collar: ['coleira'],
  found: ['encontrou'],
  silver: ['prateada'],
  tag: ['plaquinha'],
  name: ['nome'],
  phone: ['telefone'],
  number: ['numero'],
  back: ['tras', 'volta'],
  bag: ['bolsa'],
  called: ['ligou', 'chamou'],
  immediately: ['imediatamente'],
  older: ['velho'],
  man: ['senhor', 'homem', 'rapaz'],
  answered: ['atendeu', 'responderam'],
  worried: ['preocupada'],
  said: ['disse', 'dizia'],
  front: ['frente'],
  gate: ['portao'],
  twenty: ['vinte'],
  minutes: ['minutos'],
  ago: ['atras', 'ha'],
  told: ['disse', 'contou'],
  meet: ['encontra', 'encontrar'],
  fountain: ['fonte'],
  center: ['centro'],
  while: ['enquanto'],
  waited: ['esperavam'],
  clean: ['limpa'],
  bottle: ['garrafa'],
  cap: ['tampa'],
  ten: ['dez'],
  later: ['depois', 'tarde'],
  fast: ['rapido'],
  along: ['pelo', 'por'],
  path: ['caminho'],
  when: ['quando'],
  barked: ['latiu'],
  happily: ['feliz'],
  wagged: ['abanou'],
  tail: ['rabo'],
  thanked: ['agradeceu'],
  big: ['grande'],
  shook: ['apertou'],
  hand: ['mao'],
  without: ['sem'],
  because: ['porque', 'pois'],
  in: ['em', 'no', 'na', 'nos', 'nas'],
  on: ['em', 'no', 'na', 'sobre'],
  at: ['em', 'no', 'na', 'ao', 'a', 'as'],
  by: ['por', 'pelo', 'pela', 'perto', 'ao', 'de'],
  dark: ['escuro', 'escura', 'escuros', 'escuras'],
  coat: ['casaco', 'sobretudo', 'capa'],
  letter: ['carta', 'letra'],
  stood: ['ficava', 'estava', 'permaneceu', 'erguia', 'havia', 'ficou'],
  was: ['estava', 'era', 'foi', 'havia'],
  were: ['estavam', 'eram', 'foram', 'havia'],
  locked: ['trancada', 'trancado', 'fechada'],
  door: ['porta'],
  pier: ['pier'],
  resting: ['apoiada', 'apoiado', 'descansando', 'repousando'],
  compass: ['bussola'],
  frightened: ['assustado', 'assustada', 'medo', 'assustar'],
  balanced: ['equilibrada', 'equilibrado'],
  mind: ['mente'],
  precise: ['precisa', 'preciso'],
  abandoned: ['abandonado', 'abandonada'],
  rocky: ['rochoso', 'rochosa'],
  cliff: ['penhasco']
};

function normalizePtWord(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function stripPtInflection(ptNorm: string): string {
  if (ptNorm.length <= 3) return ptNorm;
  if (ptNorm.endsWith('es') && ptNorm.length >= 5) return ptNorm.slice(0, -2);
  if ((ptNorm.endsWith('os') || ptNorm.endsWith('as')) && ptNorm.length >= 5) {
    return ptNorm.slice(0, -2);
  }
  if ((ptNorm.endsWith('o') || ptNorm.endsWith('a') || ptNorm.endsWith('s')) && ptNorm.length >= 4) {
    return ptNorm.slice(0, -1);
  }
  return ptNorm;
}

function getExpectedPtRootsForEnToken(enRaw: string): string[] {
  const clean = cleanString(enRaw);
  if (!clean) return [];

  const roots = new Set<string>();
  if (EN_TO_PT_ANCHOR_MAP[clean]) {
    EN_TO_PT_ANCHOR_MAP[clean].forEach(r => roots.add(r));
  }

  const info = lookupLocalWordInfo(clean);
  if (info.pt && info.pt !== '...') {
    const senses = info.pt.split(/[/,;]+/).map(s => s.trim()).filter(Boolean);
    for (const sense of senses) {
      const parts = sense
        .replace(/\([^)]*\)/g, ' ')
        .split(/\s+/)
        .map(p => normalizePtWord(p))
        .filter(p => p.length >= 2);
      if (parts.length > 1) {
        // For multi-word glosses like "de repente" or "por todos", skip PT stopwords unless EN is also a preposition
        parts
          .filter(p => !PT_NON_FINAL_WORDS.has(p) || EN_NON_FINAL_WORDS.has(clean))
          .forEach(p => roots.add(p));
      } else {
        parts.forEach(p => roots.add(p));
      }
    }
  }

  return Array.from(roots);
}

function doesPtTokenMatchRoots(ptNorm: string, roots: string[]): boolean {
  if (!ptNorm || roots.length === 0) return false;
  const ptStem = stripPtInflection(ptNorm);
  for (const r of roots) {
    if (ptNorm === r) return true;
    const rStem = stripPtInflection(r);
    if (ptStem.length >= 3 && rStem.length >= 3 && ptStem === rStem) {
      return true;
    }
    // Allow hyphenated clitics like "encontra-la" -> "encontrala" matching "encontra"
    if (r.length >= 4 && ptNorm.length >= 4) {
      const prefixLen = Math.min(5, Math.min(r.length, ptNorm.length));
      if (prefixLen >= 4 && ptNorm.slice(0, prefixLen) === r.slice(0, prefixLen)) {
        return true;
      }
    }
  }
  return false;
}

export function alignPortugueseClauses(enClauses: string[], fullPt: string): string[] {
  const trimmedPt = (fullPt || '').trim();
  if (!trimmedPt || enClauses.length <= 1) {
    return enClauses.map(() => trimmedPt);
  }

  const ptTokens = trimmedPt.split(/\s+/).filter(Boolean);
  const P = ptTokens.length;
  const M = enClauses.length;
  if (P <= M) {
    return enClauses.map(() => trimmedPt);
  }

  const ptNorms = ptTokens.map(t => normalizePtWord(t));
  const enClauseTokens = enClauses.map(c => c.split(/\s+/).filter(Boolean));
  const enWordCounts = enClauseTokens.map(t => Math.max(1, t.length));
  const totalEnWords = Math.max(1, enWordCounts.reduce((a, b) => a + b, 0));

  // Precompute expected Portuguese roots for each word of each English clause
  const clauseWordRoots: string[][][] = enClauseTokens.map(tokens =>
    tokens.map(tok => getExpectedPtRootsForEnToken(tok))
  );

  // Score how well ptTokens[start..end] (inclusive) aligns with enClauses[cIdx]
  const scoreSegmentAlignment = (cIdx: number, start: number, end: number): number => {
    const len = end - start + 1;
    if (len < 1) return -1000;

    let score = len === 1 ? -28 : 0;
    const expectedShare = (enWordCounts[cIdx] / totalEnWords) * P;
    score -= Math.abs(len - expectedShare) * 2.4;

    const segPtNorms = ptNorms.slice(start, end + 1);
    const otherBeforeNorms = ptNorms.slice(0, start);
    const otherAfterNorms = ptNorms.slice(end + 1);

    const wordsRoots = clauseWordRoots[cIdx];
    const enTokens = enClauseTokens[cIdx];

    for (let wIdx = 0; wIdx < wordsRoots.length; wIdx++) {
      const roots = wordsRoots[wIdx];
      if (roots.length === 0) continue;
      const cleanEn = cleanString(enTokens[wIdx]);
      const isContentWord = cleanEn.length >= 4 || !EN_NON_FINAL_WORDS.has(cleanEn);
      const weight = isContentWord ? 9 : 3;

      const matchedInSeg = segPtNorms.some(ptN => doesPtTokenMatchRoots(ptN, roots));
      if (matchedInSeg) {
        score += weight;
      } else if (isContentWord) {
        const leakedBefore = otherBeforeNorms.some(ptN => doesPtTokenMatchRoots(ptN, roots));
        const leakedAfter = otherAfterNorms.some(ptN => doesPtTokenMatchRoots(ptN, roots));
        if (leakedBefore || leakedAfter) {
          score -= 22;
        }
      }
    }

    // Helper: check if a Portuguese content token matches any content word of clause `targetIdx`
    const matchesClauseContent = (ptNorm: string, targetIdx: number): boolean => {
      if (
        !ptNorm ||
        ptNorm.length < 3 ||
        PT_NON_FINAL_WORDS.has(ptNorm) ||
        targetIdx < 0 ||
        targetIdx >= M
      ) {
        return false;
      }
      const tRoots = clauseWordRoots[targetIdx];
      const tEn = enClauseTokens[targetIdx];
      for (let wIdx = 0; wIdx < tRoots.length; wIdx++) {
        const cleanEn = cleanString(tEn[wIdx]);
        if (!cleanEn || EN_NON_FINAL_WORDS.has(cleanEn) || cleanEn.length < 3) continue;
        if (doesPtTokenMatchRoots(ptNorm, tRoots[wIdx])) return true;
      }
      return false;
    };

    // First-token anchor match & left-leak guard for clauses after the first
    if (cIdx > 0 && wordsRoots.length > 0) {
      const firstPt = ptNorms[start];
      const secondPt = start + 1 <= end ? ptNorms[start + 1] : '';
      const firstRoots = wordsRoots[0];
      const secondRoots = wordsRoots.length > 1 ? wordsRoots[1] : [];

      if (doesPtTokenMatchRoots(firstPt, firstRoots)) {
        score += 22;
      } else if (secondPt && doesPtTokenMatchRoots(secondPt, firstRoots)) {
        score += 12;
      } else if (doesPtTokenMatchRoots(firstPt, secondRoots)) {
        score += 14;
      }

      // Guard: Do not start segment cIdx with a word that actually belongs exclusively to previous clause cIdx - 1
      if (matchesClauseContent(firstPt, cIdx - 1) && !matchesClauseContent(firstPt, cIdx)) {
        score -= 48;
      }
    }

    // Last-token anchor match, Adj+Noun coupling & right-leak guard for clauses before the last
    if (cIdx < M - 1 && wordsRoots.length > 0) {
      const lastPt = ptNorms[end];
      const prevLastPt = end - 1 >= start ? ptNorms[end - 1] : '';
      const lastRoots = wordsRoots[wordsRoots.length - 1];
      const penultRoots = wordsRoots.length >= 2 ? wordsRoots[wordsRoots.length - 2] : [];
      const tokenAtEnd = ptTokens[end];
      const nextPtNorm = ptNorms[end + 1] || '';

      // Detect EN [Adj + Noun] -> PT [Noun + Adj] reversal at the end of clause cIdx
      const nextMatchesPenult =
        penultRoots.length > 0 &&
        doesPtTokenMatchRoots(nextPtNorm, penultRoots) &&
        !matchesClauseContent(nextPtNorm, cIdx + 1);

      if (penultRoots.length > 0 && doesPtTokenMatchRoots(lastPt, penultRoots) && doesPtTokenMatchRoots(prevLastPt, lastRoots)) {
        // e.g. EN "tall man" -> PT "... homem alto" ending cleanly on "alto"
        score += 26;
      } else if (doesPtTokenMatchRoots(lastPt, lastRoots)) {
        if (nextMatchesPenult) {
          // Ending right on "homem" while "alto" is shoved into end + 1 breaks the PT noun phrase
          score -= 52;
        } else {
          score += 16;
        }
      }

      // Guard: Do not push any content word of clause cIdx into the start of clause cIdx + 1
      if (matchesClauseContent(nextPtNorm, cIdx) && !matchesClauseContent(nextPtNorm, cIdx + 1)) {
        score -= 48;
      }

      // Guard: Do not pull a content word (e.g. first verb/participle "stood" -> "ficava", "resting" -> "apoiada")
      // backward from clause cIdx + 1 into the end of clause cIdx
      if (matchesClauseContent(lastPt, cIdx + 1) && !matchesClauseContent(lastPt, cIdx)) {
        score -= 48;
      }

      // Evaluate Portuguese syntactic boundary between end and end + 1
      const enEndsPunct = /[,.;:!?—–]['"”’)]*$/.test(enTokens[enTokens.length - 1]);
      const ptEndsPunct = /[,.;:!?—–]['"”’)]*$/.test(tokenAtEnd);

      if (enEndsPunct && ptEndsPunct) {
        score += 32;
      } else if (ptEndsPunct) {
        score += 16;
      } else {
        // Never end a Portuguese segment on an article, preposition, pronoun, or conjunction
        if (PT_NON_FINAL_WORDS.has(lastPt)) {
          score -= 55;
        }

        // Never split a compound locution ("perto | da", "antes | de", "banco | de madeira", "portão | da frente")
        if (
          PT_LOCUTION_HEADS.has(lastPt) &&
          (nextPtNorm === 'de' ||
            nextPtNorm === 'do' ||
            nextPtNorm === 'da' ||
            nextPtNorm === 'dos' ||
            nextPtNorm === 'das' ||
            nextPtNorm === 'a' ||
            nextPtNorm === 'ao' ||
            nextPtNorm === 'que')
        ) {
          score -= 48;
        }

        // General penalty for breaking right before de/do/da/dos/das unless the English clause itself starts with an EN preposition
        const nextEnFirst = cleanString(enClauseTokens[cIdx + 1]?.[0] || '');
        const isEnPrepStart =
          nextEnFirst === 'of' ||
          nextEnFirst === 'from' ||
          nextEnFirst === 'in' ||
          nextEnFirst === 'with' ||
          nextEnFirst === 'at' ||
          nextEnFirst === 'on' ||
          nextEnFirst === 'by' ||
          nextEnFirst === 'about' ||
          nextEnFirst === 'over' ||
          nextEnFirst === 'for';
        if (
          (nextPtNorm === 'de' ||
            nextPtNorm === 'do' ||
            nextPtNorm === 'da' ||
            nextPtNorm === 'dos' ||
            nextPtNorm === 'das') &&
          !isEnPrepStart
        ) {
          score -= 22;
        }

        // Penalty for splitting prenominal Portuguese adjective from its noun ("pequena | cafeteria", "grande | sorriso")
        if (PT_PRENOMINAL_ADJECTIVES.has(lastPt) && !PT_CLAUSE_STARTERS.has(nextPtNorm)) {
          score -= 35;
        }

        // Bonus if nextPtNorm is a natural Portuguese clause starter
        if (PT_CLAUSE_STARTERS.has(nextPtNorm)) {
          score += 8;
        }
      }
    }

    return score;
  };

  // Dynamic programming to find the optimal partition of ptTokens[0..P-1] into M segments
  const NEG_INF = -1e9;
  const dp: number[][] = Array.from({ length: M }, () => Array(P).fill(NEG_INF));
  const parent: number[][] = Array.from({ length: M }, () => Array(P).fill(-1));

  for (let end = 0; end <= P - M; end++) {
    dp[0][end] = scoreSegmentAlignment(0, 0, end);
  }

  for (let c = 1; c < M; c++) {
    const maxEnd = c === M - 1 ? P - 1 : P - (M - c);
    const minEnd = c === M - 1 ? P - 1 : c;
    for (let end = minEnd; end <= maxEnd; end++) {
      for (let prevEnd = c - 1; prevEnd < end; prevEnd++) {
        if (dp[c - 1][prevEnd] <= NEG_INF / 2) continue;
        const segScore = scoreSegmentAlignment(c, prevEnd + 1, end);
        const total = dp[c - 1][prevEnd] + segScore;
        if (total > dp[c][end]) {
          dp[c][end] = total;
          parent[c][end] = prevEnd;
        }
      }
    }
  }

  const endIndices: number[] = Array(M).fill(0);
  let currEnd = P - 1;
  for (let c = M - 1; c >= 0; c--) {
    endIndices[c] = currEnd;
    currEnd = parent[c][currEnd];
  }

  const result: string[] = [];
  let startIdx = 0;
  for (let c = 0; c < M; c++) {
    const endIdx = Math.max(startIdx, endIndices[c]);
    const slice = ptTokens.slice(startIdx, endIdx + 1).join(' ').trim();
    result.push(slice || trimmedPt);
    startIdx = endIdx + 1;
  }

  return result;
}

/**
 * Splits a long sentence into progressive pedagogical steps (both English and aligned Portuguese):
 * - 'forward': Clause 1 -> Clause 2 -> ... -> Full Sentence
 * - 'backchain': End clause -> Middle + End -> Full Sentence (classic phonetic back-chaining)
 */
export function splitSentenceIntoStudySteps(
  sentenceEn: string,
  mode: 'forward' | 'backchain' = 'forward',
  sentencePt = ''
): SentenceStudyStep[] {
  const trimmed = sentenceEn.trim();
  const trimmedPt = sentencePt.trim();
  if (!trimmed) return [];

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length <= 5) {
    return [
      {
        index: 0,
        label: 'Frase Completa',
        text: trimmed,
        ptText: trimmedPt,
        isFull: true
      }
    ];
  }

  const clauses = segmentEnglishTokensIntoClauses(tokens);
  const ptClauses = alignPortugueseClauses(clauses, trimmedPt);
  const steps: SentenceStudyStep[] = [];

  if (mode === 'backchain') {
    for (let i = clauses.length - 1; i >= 0; i--) {
      const combined = clauses.slice(i).join(' ');
      const combinedPt = ptClauses.slice(i).join(' ').trim();
      const isFull = i === 0;
      steps.push({
        index: steps.length,
        label: isFull
          ? `Passo ${steps.length + 1}: Frase Completa`
          : `Passo ${steps.length + 1} (Final ${steps.length + 1}/${clauses.length})`,
        text: combined,
        ptText: isFull ? trimmedPt : combinedPt,
        isFull
      });
    }
  } else {
    clauses.forEach((cl, idx) => {
      steps.push({
        index: idx,
        label: `Parte ${idx + 1}/${clauses.length}`,
        text: cl,
        ptText: ptClauses[idx] || trimmedPt,
        isFull: false
      });
    });
    steps.push({
      index: clauses.length,
      label: 'Desafio Final: Frase Inteira',
      text: trimmed,
      ptText: trimmedPt,
      isFull: true
    });
  }

  return steps;
}

/**
 * Computes an adaptive microphone silence timeout so users have time to breathe
 * on commas during long sentences without being cut off prematurely.
 */
export function getAdaptiveSilenceDebounceMs(
  targetText: string,
  pauseMode: SttSilencePauseMode = 'normal'
): number {
  const wordCount = cleanSpeech(targetText).split(/\s+/).filter(Boolean).length;
  let base = 2150;
  if (wordCount >= 14) base = 3450;
  else if (wordCount >= 9) base = 2750;

  if (pauseMode === 'short') {
    return Math.max(1450, Math.round(base * 0.75));
  }
  if (pauseMode === 'long') {
    return Math.round(base * 1.45);
  }
  return base;
}

// --- CEFR LEVEL CLASSIFIER (A1 to C1) ---
const ADVANCED_WORDS = new Set([
  'magnificent',
  'constrictor',
  'constrictors',
  'swallowing',
  'digestion',
  'digesting',
  'pondered',
  'succeeded',
  'masterpiece',
  'frightened',
  'conversations',
  'considering',
  'remarkable',
  'seldom',
  'eclipses',
  'predominates',
  'abhorrent',
  'admirably',
  'particularly',
  'akin'
]);

export function classifySentenceCefr(sentenceEn: string): CefrLevel {
  const words = cleanSpeech(sentenceEn).split(/\s+/).filter(Boolean);
  const count = words.length;
  if (count === 0) return 'A1';

  let advancedCount = 0;
  let longWordsCount = 0;
  for (const w of words) {
    if (ADVANCED_WORDS.has(w)) advancedCount++;
    if (w.length >= 8) longWordsCount++;
  }

  const score = count * 1.1 + advancedCount * 4.5 + longWordsCount * 1.8;

  if (score <= 11) return 'A1';
  if (score <= 18) return 'A2';
  if (score <= 26) return 'B1';
  if (score <= 35) return 'B2';
  return 'C1';
}

// --- CONNECTED SPEECH / PROSODY CHUNKING & LINKING ---
const PAUSE_PREPOSITIONS = new Set([
  'in',
  'on',
  'at',
  'with',
  'without',
  'after',
  'through',
  'over',
  'by',
  'into',
  'from',
  'for',
  'whether',
  'because',
  'and',
  'but',
  'or',
  'nor',
  'so',
  'that',
  'to'
]);

function shouldLinkWords(prevRaw: string, nextRaw: string): boolean {
  // Don't link across punctuation
  if (/[,.;:!?'"”’()-]$/.test(prevRaw)) return false;
  const p = cleanString(prevRaw);
  const n = cleanString(nextRaw);
  if (!p || !n) return false;

  const endsWithLinkableConsonant = /[bdfgklmnprstvz]$/.test(p) || /[^aeiou]e$/.test(p);
  const startsWithVowelSound = /^[aeiou]/.test(n) || /^h(our|onest|eir)/.test(n);

  return endsWithLinkableConsonant && startsWithVowelSound;
}

export function splitIntoProsodyChunks(sentenceEn: string): ProsodyChunk[] {
  const rawTokens = sentenceEn.trim().split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return [];

  const chunks: string[][] = [];
  let current: string[] = [];

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    const clean = cleanString(token);

    // Break before conjunction/preposition if current chunk already has >= 3 words
    if (current.length >= 3 && PAUSE_PREPOSITIONS.has(clean) && rawTokens.length - i >= 2) {
      chunks.push(current);
      current = [token];
    } else {
      current.push(token);
    }

    // Break after punctuation or if chunk reaches 5 words
    if (/[,.;:!?]$/.test(token) || current.length >= 5) {
      chunks.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    // If trailing chunk is just 1 word and previous chunk wasn't punctuation-ended, merge it
    if (
      current.length === 1 &&
      chunks.length > 0 &&
      !/[,.;:!?]$/.test(chunks[chunks.length - 1][chunks[chunks.length - 1].length - 1])
    ) {
      chunks[chunks.length - 1].push(current[0]);
    } else {
      chunks.push(current);
    }
  }

  return chunks.map(words => {
    let displayWithLinks = words[0];
    for (let i = 1; i < words.length; i++) {
      const separator = shouldLinkWords(words[i - 1], words[i]) ? '‿' : ' ';
      displayWithLinks += separator + words[i];
    }
    return {
      text: words.join(' '),
      displayWithLinks,
      words
    };
  });
}

// --- BRAZILIAN PORTUGUESE PHONETIC DIAGNOSTIC ENGINE ---
const VOICELESS_TH = new Set([
  'thought',
  'through',
  'nothing',
  'something',
  'months',
  'worth',
  'three',
  'think',
  'thin',
  'truth',
  'both',
  'path'
]);

const VOICED_TH = new Set([
  'the',
  'that',
  'they',
  'their',
  'them',
  'then',
  'there',
  'this',
  'these',
  'those',
  'whether',
  'without',
  'other',
  'another',
  'mother',
  'father',
  'brother',
  'together'
]);

const VOICELESS_ED = new Set([
  'looked',
  'asked',
  'peeped',
  'worked',
  'walked',
  'talked',
  'helped',
  'stopped',
  'watched',
  'laughed',
  'finished'
]);

export function getBrazilianPhoneticTip(rawWord: string): PhoneticTip | null {
  const clean = cleanString(rawWord);
  if (!clean || clean.length < 2) return null;

  const dictIpa = DICT_DB[clean]?.ipa;

  if (VOICELESS_TH.has(clean)) {
    return {
      word: clean,
      category: 'Som do TH Surdo (/θ/)',
      tip: 'Coloque a ponta da língua suavemente entre os dentes e sopre o ar, sem vibrar a garganta (evite trocar por /t/, /f/ ou /s/).',
      ipaHint: dictIpa || '/θ/'
    };
  }

  if (VOICED_TH.has(clean)) {
    return {
      word: clean,
      category: 'Som do TH Vozeado (/ð/)',
      tip: 'Encoste a ponta da língua nos dentes superiores vibrando as cordas vocais (mais suave que o /d/ do português).',
      ipaHint: dictIpa || '/ð/'
    };
  }

  if (clean === 'would' || clean === 'should' || clean === 'could') {
    return {
      word: clean,
      category: 'Letra L Muda',
      tip: `A letra "L" não é pronunciada em "${clean}". Fale de forma curta: /${clean[0]}ʊd/ (sem fazer som de "u" forte no final).`,
      ipaHint: dictIpa || '/wʊd/'
    };
  }

  if (/^kn/.test(clean) || clean === 'whole' || clean === 'who') {
    return {
      word: clean,
      category: 'Consoante Inicial Muda',
      tip: clean.startsWith('kn')
        ? `O "K" inicial é totalmente mudo em "${clean}". Comece o som direto no "N".`
        : `O "W" inicial é mudo em "${clean}". Comece com som aspirado de H (/h/).`,
      ipaHint: dictIpa
    };
  }

  if (VOICELESS_ED.has(clean)) {
    return {
      word: clean,
      category: 'Passado -ED com som de /t/',
      tip: `Não pronuncie a vogal "e" no final de "${clean}". O "-ed" soa como um /t/ seco colado na consoante anterior.`,
      ipaHint: dictIpa
    };
  }

  if (clean.endsWith('ed') && clean.length > 4) {
    const endsInTorD = /[td]ed$/.test(clean);
    return {
      word: clean,
      category: endsInTorD ? 'Passado -ED (/ɪd/)' : 'Passado -ED com som de /d/',
      tip: endsInTorD
        ? `Como a raiz termina em T ou D, pronuncie o final como uma sílaba suave /ɪd/.`
        : `Ligue o "-ed" diretamente como um /d/ suave, sem acrescentar "édi" no final.`,
      ipaHint: dictIpa
    };
  }

  if (/^r[aeiou]/.test(clean)) {
    return {
      word: clean,
      category: 'R Retroflexo Inglês (/ɹ/)',
      tip: `Curve a ponta da língua levemente para trás sem tocar o céu da boca (nunca use o "R" arranhado da garganta do português).`,
      ipaHint: dictIpa
    };
  }

  if (/[ptkbdg]$/.test(clean)) {
    return {
      word: clean,
      category: 'Consoante Seca Final',
      tip: `Encerre "${clean}" de forma curta na consoante final, evitando adicionar a vogal "/i/" típica do sotaque brasileiro.`,
      ipaHint: dictIpa
    };
  }

  return null;
}

export function getSentencePhoneticTips(
  sentenceEn: string,
  priorityWords: string[] = []
): PhoneticTip[] {
  const seen = new Set<string>();
  const tips: PhoneticTip[] = [];

  // 1. Prioritize missed words first
  for (const w of priorityWords) {
    const clean = cleanString(w);
    if (!clean || seen.has(clean)) continue;
    const tip = getBrazilianPhoneticTip(clean);
    if (tip) {
      seen.add(clean);
      tips.push(tip);
    }
  }

  // 2. Scan sentence for top phonetic challenges if we have fewer than 3 tips
  const tokens = sentenceEn.split(/\s+/);
  for (const t of tokens) {
    if (tips.length >= 3) break;
    const clean = cleanString(t);
    if (!clean || seen.has(clean)) continue;
    const tip = getBrazilianPhoneticTip(clean);
    if (tip) {
      seen.add(clean);
      tips.push(tip);
    }
  }

  return tips.slice(0, 3);
}

// --- SPACED REPETITION SYSTEM (SRS - SM-2) ---
export function calculateSrsNextReview(
  item: VocabItem,
  quality: 2 | 4 | 5,
  now: Date = new Date()
): VocabItem {
  let repetition = item.repetition || 0;
  let interval = item.interval || 0;
  let efactor = item.efactor || 2.5;

  if (quality < 3) {
    // Difícil -> Reset repetition, review today (interval = 0)
    repetition = 0;
    interval = 0;
  } else {
    if (repetition === 0) {
      interval = quality === 5 ? 3 : 1;
    } else if (repetition === 1) {
      interval = quality === 5 ? 6 : 3;
    } else {
      interval = Math.round(interval * efactor * (quality === 5 ? 1.2 : 1.0));
    }
    repetition += 1;
  }

  efactor = efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (efactor < 1.3) efactor = 1.3;
  efactor = Number(efactor.toFixed(2));

  const nextDate = new Date(now.getTime());
  if (interval === 0) {
    // Due right now / in 1 minute
    nextDate.setMinutes(nextDate.getMinutes() - 1);
  } else {
    nextDate.setDate(nextDate.getDate() + interval);
  }

  return {
    ...item,
    repetition,
    interval,
    efactor,
    lastQuality: quality,
    nextReviewDate: nextDate.toISOString()
  };
}

export function isVocabDueForReview(item: VocabItem, now: Date = new Date()): boolean {
  if (!item.nextReviewDate) return true;
  return new Date(item.nextReviewDate).getTime() <= now.getTime();
}

export type HandsFreeVoiceCommand = 'skip' | 'repeat' | 'pause' | null;

/**
 * Detects spoken voice commands ("pular", "próxima", "repetir", "pausar treino", etc.)
 * during Hands-Free mode while ensuring words that are part of the target English sentence
 * are evaluated as normal pronunciation rather than hijacked as commands.
 */
export function detectHandsFreeVoiceCommand(
  spokenRaw: string,
  targetEnglishText = ''
): HandsFreeVoiceCommand {
  const norm = (spokenRaw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!norm) return null;

  const targetNormWords = new Set(
    cleanSpeech(targetEnglishText)
      .split(/\s+/)
      .filter(Boolean)
  );

  // If the user's speech already matches the target English sentence/word reasonably well, never treat as a command
  if (targetEnglishText.trim().length > 0) {
    const sim = calculateSimilarity(targetEnglishText, spokenRaw);
    if (sim.score >= 60) return null;
  }

  // Portuguese voice commands (unambiguous since target is in English)
  if (
    norm === 'pausar' ||
    norm === 'pausar treino' ||
    norm === 'parar treino' ||
    norm === 'pausa'
  ) {
    return 'pause';
  }

  if (
    norm === 'repetir' ||
    norm === 'repetir frase' ||
    norm === 'repetir audio' ||
    norm === 'ouvir de novo' ||
    norm === 'ouvir novamente'
  ) {
    return 'repeat';
  }

  if (
    norm === 'pular' ||
    norm === 'pular frase' ||
    norm === 'pular etapa' ||
    norm === 'pular palavra' ||
    norm === 'proxima' ||
    norm === 'proxima frase' ||
    norm === 'avancar'
  ) {
    return 'skip';
  }

  // English multi-word or isolated voice commands (only if not present in targetEnglishText)
  if (
    (norm === 'pause training' || norm === 'stop training') ||
    (norm === 'pause' && !targetNormWords.has('pause'))
  ) {
    return 'pause';
  }

  if (
    norm === 'repeat audio' ||
    norm === 'repeat sentence' ||
    (norm === 'repeat' && !targetNormWords.has('repeat'))
  ) {
    return 'repeat';
  }

  if (
    norm === 'skip sentence' ||
    norm === 'skip word' ||
    norm === 'next sentence' ||
    (norm === 'skip' && !targetNormWords.has('skip'))
  ) {
    return 'skip';
  }

  return null;
}

/**
 * Computes the effective maximum attempts before Hands-Free mode automatically advances
 * to the next step in the cycle. When in 'speak_blind_en' with blindMaxErrorsBeforeReveal > 0,
 * guarantees at least 1 additional attempt AFTER the English text is revealed so the user
 * can read the revealed text before advancing.
 */
export function getHandsFreeEffectiveMaxAttempts(
  stepCard: string,
  handsFreeMaxAttempts = 2,
  blindMaxErrorsBeforeReveal = 2
): number {
  const baseMax = Math.max(1, handsFreeMaxAttempts || 2);
  if (stepCard === 'speak_blind_en' && blindMaxErrorsBeforeReveal > 0) {
    return Math.max(baseMax, blindMaxErrorsBeforeReveal + 1);
  }
  return baseMax;
}

/**
 * Generates an instant local phonetic coaching diagnostic for Brazilian learners
 * when using hybrid/offline STT or while waiting for multimodal audio assessment.
 */
export function generateInstantPhoneticCoachFeedback(
  targetSentence: string,
  spokenText: string,
  evalResult: EvaluationResult,
  providerUsed = 'local_phonetic_coach'
): AiPronunciationFeedback {
  const missedWords = evalResult.wordResults.filter(w => !w.matched).map(w => w.word);
  const tips = getSentencePhoneticTips(targetSentence, missedWords);
  const topTip = tips[0];

  const chunks = splitIntoProsodyChunks(targetSentence);
  const linkedPair = chunks.find(c => c.displayWithLinks.includes('‿'))?.displayWithLinks;

  let coachTipPt = '';
  if (topTip) {
    coachTipPt = `${topTip.category} em "${topTip.word}"${topTip.ipaHint ? ` (${topTip.ipaHint})` : ''}: ${topTip.tip}`;
  } else if (linkedPair) {
    coachTipPt = `Dica de Ritmo (Connected Speech): conecte suavemente "${linkedPair}" sem pausar entre as palavras.`;
  } else if (evalResult.score >= 90) {
    coachTipPt =
      'Excelente cadência americana! Mantenha as consoantes finais curtas e o ritmo fluido.';
  } else {
    coachTipPt =
      'Atenção às palavras destacadas em vermelho: escute o áudio em 0.7x e imite a ligação entre as sílabas.';
  }

  const fluencyScore = Math.min(100, Math.max(45, evalResult.score + (missedWords.length === 0 ? 4 : -3)));
  const prosodyScore = Math.min(100, Math.max(50, Math.round((evalResult.score + fluencyScore) / 2)));

  return {
    transcript: spokenText,
    pronunciationScore: evalResult.score,
    fluencyScore,
    prosodyScore,
    coachTipPt,
    focusWords: missedWords.slice(0, 4),
    providerUsed
  };
}


