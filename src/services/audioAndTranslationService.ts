import { DICT_DB, SAMPLE_BOOKS } from '../data/dictionaryDb';
import { apiUrl } from '../utils/apiBase';
import {
  AiPronunciationFeedback,
  GeminiVoiceName,
  GeminiVoiceStyle,
  PedagogicalSettings,
  Sentence,
  SttProvider,
  TtsEngine,
  WordEntry,
  WordInfo
} from '../types/shadowreader';
import {
  cleanString,
  getEffectiveSpeed,
  lookupLocalWordInfo,
  normalizeSpokenTranscriptNumbers,
  splitSentenceIntoStudySteps
} from '../utils/shadowing';
import {
  computeAudioPlaybackTimeoutMs,
  computeEffectiveTtsRate
} from '../utils/voiceCompatibility';
import {
  extractDictionaryAlternatives,
  isSuspiciousMyMemoryFragment,
  LiteralTranslationResult,
  parseGoogleGtxWordResponse,
  sanitizeLiteralPtTranslation
} from '../utils/matchingPairs';
import {
  buildSentencePrefetchPlan,
  buildTtsCacheKey,
  normalizeTtsUtteranceText
} from '../utils/sentencePrefetch';
import {
  shouldTreatBrowserUtteranceAsFinished,
  splitTextIntoTtsChunks,
  TtsAudioChunkPayload
} from '../utils/ttsPlayback';

interface CachedTtsAudioEntry {
  chunks: TtsAudioChunkPayload[];
  providerUsed: string;
}

export const wordTranslationCache = new Map<string, WordEntry>();
const literalWordTranslationCache = new Map<string, LiteralTranslationResult>();
const literalWordInFlight = new Map<string, Promise<LiteralTranslationResult>>();
const sentenceTranslationCache = new Map<string, string>();
const sentenceTranslationInFlight = new Map<string, Promise<string>>();
const ttsAudioMemoryCache = new Map<string, CachedTtsAudioEntry>();
const ttsInFlightRequests = new Map<string, Promise<CachedTtsAudioEntry | null>>();
let activePrefetchGeneration = 0;
let activePrefetchAbortController: AbortController | null = null;
let ttsPrefetchCooldownUntil = 0;

export interface TtsVoiceHubOptions {
  preferredVoiceEnUri?: string;
  preferredVoicePtUri?: string;
  geminiVoiceName?: GeminiVoiceName;
  geminiVoiceStyle?: GeminiVoiceStyle;
  ttsCacheEnabled?: boolean;
}

export interface SystemVoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  isNaturalOrNeural: boolean;
}

let audioCtx: AudioContext | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];
let activePreferredVoiceEnUri = '';
let activePreferredVoicePtUri = '';

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    try {
      cachedVoices = window.speechSynthesis.getVoices();
    } catch {
      // ignore
    }
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function getAvailableSystemVoices(langPrefix: 'en' | 'pt'): SystemVoiceOption[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  try {
    const raw = window.speechSynthesis.getVoices();
    if (raw && raw.length > 0) {
      cachedVoices = raw;
    }
  } catch {
    // ignore
  }
  const filtered = cachedVoices.filter(v =>
    v.lang.toLowerCase().replace('_', '-').startsWith(langPrefix)
  );
  return filtered
    .map(v => ({
      voiceURI: v.voiceURI || v.name,
      name: v.name,
      lang: v.lang,
      localService: Boolean(v.localService),
      isNaturalOrNeural:
        v.name.includes('Natural') ||
        v.name.includes('Google') ||
        v.name.includes('Neural') ||
        v.name.includes('Premium') ||
        v.name.includes('Samantha') ||
        v.name.includes('Luciana')
    }))
    .sort((a, b) => Number(b.isNaturalOrNeural) - Number(a.isNaturalOrNeural));
}

export function getCachedTtsAudioCount(): number {
  return ttsAudioMemoryCache.size;
}

export function clearTtsAudioCache(): void {
  ttsAudioMemoryCache.clear();
  cancelBackgroundSentencePrefetch(true);
}

export function isTtsAudioCached(
  text: string,
  lang: string,
  provider: TtsEngine,
  options?: TtsVoiceHubOptions
): boolean {
  if (provider !== 'gemini_tts' && provider !== 'online') return false;
  const key = buildTtsCacheKey({
    provider,
    lang,
    voiceName: options?.geminiVoiceName || 'Kore',
    voiceStyle: options?.geminiVoiceStyle || 'clear_teacher',
    text
  });
  return ttsAudioMemoryCache.has(key);
}

export function hasCachedLiteralWord(rawWord: string): boolean {
  const cleanWord = cleanString(rawWord);
  if (!cleanWord) return true;
  if (literalWordTranslationCache.has(cleanWord)) return true;
  if (/^\d+$/.test(cleanWord)) return true;
  if (DICT_DB[cleanWord] && DICT_DB[cleanWord].pt && DICT_DB[cleanWord].pt !== '...') {
    return true;
  }
  return false;
}

export function hasCachedSentenceTranslation(text: string): boolean {
  const trimmed = (text || '').trim();
  if (!trimmed) return true;
  return sentenceTranslationCache.has(trimmed);
}

export function cancelBackgroundSentencePrefetch(abortInFlight = false): void {
  activePrefetchGeneration += 1;
  if (abortInFlight && activePrefetchAbortController) {
    try {
      activePrefetchAbortController.abort();
    } catch {
      // ignore
    }
    activePrefetchAbortController = null;
  }
}

export function playChime(type: 'your_turn' | 'success' | 'retry', enabled = true): void {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'your_turn') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === 'retry') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.setValueAtTime(220, now + 0.12);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch {
    // Ignore audio context restriction errors
  }
}

export function unlockAudioSession(): void {
  if (typeof window === 'undefined') return;
  const player = document.getElementById('globalAudioPlayer') as HTMLAudioElement | null;
  if (player) {
    player.setAttribute('playsinline', 'true');
    if (player.dataset.unlocked !== 'true') {
      const silentWav =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      try {
        if (!player.src || player.paused) {
          player.src = silentWav;
          const playPromise = player.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise
              .then(() => {
                player.dataset.unlocked = 'true';
              })
              .catch(() => {
                // Retry unlock on next direct user tap
              });
          } else {
            player.dataset.unlocked = 'true';
          }
        }
      } catch {
        // Retry unlock on next direct user tap
      }
    }
  }
  if ('speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // ignore
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    try {
      audioCtx.resume();
    } catch {
      // ignore
    }
  }
}

let audioCancelGeneration = 0;
let isUtteranceCurrentlySpeaking = false;
let activeTtsFetchController: AbortController | null = null;

export function getAudioCancelGeneration(): number {
  return audioCancelGeneration;
}

export function stopAllAudioPlayback(): void {
  audioCancelGeneration += 1;
  isUtteranceCurrentlySpeaking = false;
  if (activeTtsFetchController) {
    try {
      activeTtsFetchController.abort();
    } catch {
      // ignore
    }
    activeTtsFetchController = null;
  }
  if (typeof window === 'undefined') return;
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  const player = document.getElementById('globalAudioPlayer') as HTMLAudioElement | null;
  if (player) {
    try {
      player.onended = null;
      player.onerror = null;
      player.onloadedmetadata = null;
      player.onplaying = null;
      player.pause();
      player.currentTime = 0;
      player.removeAttribute('src');
      player.load();
    } catch {
      // ignore
    }
  }
}

function normalizeUtteranceText(rawText: string, lang: string): string {
  return normalizeTtsUtteranceText(rawText, lang);
}

function selectVoiceForUtterance(
  lang: string,
  isShortWord: boolean,
  preferFallbackLocal: boolean
): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  if (!cachedVoices.length) {
    try {
      cachedVoices = window.speechSynthesis.getVoices();
    } catch {
      // ignore
    }
  }
  if (!cachedVoices.length) return null;

  const langLower = lang.toLowerCase();
  const langPrefix = langLower.slice(0, 2);
  const matchingLang = cachedVoices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
  if (!matchingLang.length) return null;

  // Check if user explicitly selected a preferred system voice for EN or PT.
  // Always honor the explicitly chosen voice first so retries never switch voices unexpectedly.
  const preferredUri = langPrefix === 'pt' ? activePreferredVoicePtUri : activePreferredVoiceEnUri;
  if (preferredUri) {
    const exactChosen = matchingLang.find(
      v => v.voiceURI === preferredUri || v.name === preferredUri
    );
    if (exactChosen && (!preferFallbackLocal || exactChosen.localService)) {
      return exactChosen;
    }
  }

  // On retry or for rapid single-word alternation, local OS voices avoid network-voice throttling/drops
  if (preferFallbackLocal) {
    const localExact = matchingLang.find(
      v => v.localService && v.lang.toLowerCase().replace('_', '-') === langLower
    );
    if (localExact) return localExact;
    const anyLocal = matchingLang.find(v => v.localService);
    if (anyLocal) return anyLocal;
    return null; // Let browser use its native default voice for utterance.lang
  }

  if (isShortWord) {
    const highQualityLocal = matchingLang.find(
      v =>
        v.localService &&
        (v.name.includes('Natural') ||
          v.name.includes('Samantha') ||
          v.name.includes('Luciana') ||
          v.name.includes('Microsoft') ||
          v.name.includes('Daniel') ||
          v.name.includes('Maria') ||
          v.lang.toLowerCase().replace('_', '-') === langLower)
    );
    if (highQualityLocal) return highQualityLocal;
  }

  return (
    matchingLang.find(
      v =>
        v.name.includes('Google') ||
        v.name.includes('Natural') ||
        v.name.includes('Samantha') ||
        v.name.includes('Luciana')
    ) ||
    matchingLang.find(v => v.lang.toLowerCase().replace('_', '-') === langLower) ||
    matchingLang[0]
  );
}

/**
 * Ensures the browser speech queue is ready for expectedGen.
 * If an older utterance was superseded mid-speech (hadActiveUtterance === true),
 * cancels it immediately so old words never keep talking when advancing quickly.
 */
async function ensureSpeechQueueReady(
  expectedGen: number,
  forceReset = false
): Promise<boolean> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  if (audioCancelGeneration !== expectedGen) return false;

  const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {
    // ignore
  }

  if (!forceReset && !isUtteranceCurrentlySpeaking) {
    // Wait up to 60ms for any natural trailing state of a finished utterance to clear
    for (let i = 0; i < 3; i++) {
      if (audioCancelGeneration !== expectedGen) return false;
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        return true;
      }
      await wait(20);
    }
  }

  if (audioCancelGeneration !== expectedGen) return false;

  // If still speaking/pending or forceReset requested, cancel cleanly and wait briefly for Chromium IPC flush
  if (
    forceReset ||
    isUtteranceCurrentlySpeaking ||
    window.speechSynthesis.speaking ||
    window.speechSynthesis.pending
  ) {
    isUtteranceCurrentlySpeaking = false;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    await wait(65);
    if (audioCancelGeneration !== expectedGen) return false;
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // ignore
    }
  }

  return audioCancelGeneration === expectedGen;
}

function playSingleBrowserSpeechAttempt(
  spokenText: string,
  lang: string,
  ttsSpeedEn: number,
  ttsSpeedPt: number,
  speedMultiplier: number,
  expectedGen: number,
  isRetryAttempt: boolean
): Promise<boolean> {
  return new Promise(resolve => {
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      audioCancelGeneration !== expectedGen ||
      !spokenText
    ) {
      resolve(false);
      return;
    }

    let settled = false;
    let startWatchdog: ReturnType<typeof setTimeout> | null = null;
    let maxCompletionWatchdog: ReturnType<typeof setTimeout> | null = null;
    let resumeInterval: ReturnType<typeof setInterval> | null = null;
    let utteranceRef: SpeechSynthesisUtterance | null = null;

    const finish = (ok: boolean, audiblePlayed = false) => {
      if (settled) return;
      settled = true;
      if (startWatchdog) clearTimeout(startWatchdog);
      if (maxCompletionWatchdog) clearTimeout(maxCompletionWatchdog);
      if (resumeInterval) clearInterval(resumeInterval);
      const win = window as unknown as { activeUtterance: SpeechSynthesisUtterance | null };
      if (utteranceRef && win.activeUtterance === utteranceRef) {
        win.activeUtterance = null;
        isUtteranceCurrentlySpeaking = false;
      }
      resolve(ok || audiblePlayed);
    };

    const isShortWord = !spokenText.includes(' ');
    let rate = getEffectiveSpeed(lang, ttsSpeedEn, ttsSpeedPt, speedMultiplier);
    if (isShortWord && spokenText.length <= 3) {
      rate = Math.max(0.84, Math.min(1.15, rate));
    }
    const maxDurationMs = computeAudioPlaybackTimeoutMs(spokenText, rate, false);

    maxCompletionWatchdog = setTimeout(() => {
      if (audioCancelGeneration !== expectedGen) {
        finish(false);
        return;
      }
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // ignore
      }
      finish(true);
    }, maxDurationMs);

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(spokenText);
      utteranceRef = utterance;
      (window as unknown as { activeUtterance: SpeechSynthesisUtterance | null }).activeUtterance =
        utterance;
      isUtteranceCurrentlySpeaking = true;

      utterance.lang = lang;
      utterance.rate = rate;
      utterance.volume = 1.0;

      const chosenVoice = selectVoiceForUtterance(lang, isShortWord, isRetryAttempt);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }

      let started = false;
      let sawSpeaking = false;
      let startedAtMs = 0;
      let idleTicksAfterStart = 0;

      // Allow ample time for en-US <-> pt-BR voice switching in Chromium/OS synthesizers
      startWatchdog = setTimeout(() => {
        if (audioCancelGeneration !== expectedGen) {
          finish(false);
          return;
        }
        if (!started) {
          if (window.speechSynthesis.speaking) {
            started = true;
            sawSpeaking = true;
            startedAtMs = Date.now();
            return;
          }
          try {
            window.speechSynthesis.cancel();
          } catch {
            // ignore
          }
          finish(false);
        }
      }, isShortWord ? 2000 : 3400);

      resumeInterval = setInterval(() => {
        if (audioCancelGeneration !== expectedGen) {
          finish(false);
          return;
        }
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        } catch {
          // ignore
        }

        if (!started && window.speechSynthesis.speaking) {
          started = true;
          sawSpeaking = true;
          startedAtMs = Date.now();
          if (startWatchdog) clearTimeout(startWatchdog);
        }

        if (started) {
          if (window.speechSynthesis.speaking) {
            sawSpeaking = true;
            idleTicksAfterStart = 0;
          } else if (!window.speechSynthesis.pending) {
            idleTicksAfterStart += 1;
            const elapsedSinceStartMs = startedAtMs ? Date.now() - startedAtMs : 0;
            if (
              shouldTreatBrowserUtteranceAsFinished({
                sawSpeaking,
                idleTicksAfterStart,
                elapsedSinceStartMs,
                spokenText,
                rate
              })
            ) {
              finish(true);
            }
          }
        }
      }, 160);

      utterance.onstart = () => {
        if (audioCancelGeneration !== expectedGen) {
          finish(false);
          return;
        }
        started = true;
        if (!startedAtMs) startedAtMs = Date.now();
        if (startWatchdog) clearTimeout(startWatchdog);
      };

      utterance.onend = () => {
        finish(audioCancelGeneration === expectedGen);
      };

      utterance.onerror = (ev: SpeechSynthesisErrorEvent) => {
        if (audioCancelGeneration !== expectedGen) {
          finish(false);
          return;
        }
        const elapsedSinceStart = startedAtMs ? Date.now() - startedAtMs : 0;
        const estimatedMinMs = Math.max(
          750,
          Math.round((spokenText.length * 48) / Math.max(0.6, rate))
        );
        if (
          ev &&
          (ev.error === 'canceled' || ev.error === 'interrupted') &&
          started &&
          elapsedSinceStart >= estimatedMinMs
        ) {
          finish(true);
          return;
        }
        // Only suppress retry if nearly the entire chunk already played audibly
        finish(false, started && elapsedSinceStart >= Math.max(1400, estimatedMinMs));
      };

      if (audioCancelGeneration !== expectedGen) {
        finish(false);
        return;
      }

      window.speechSynthesis.speak(utterance);
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      finish(false);
    }
  });
}

async function playBrowserSpeech(
  text: string,
  lang: string,
  ttsSpeedEn: number,
  ttsSpeedPt: number,
  speedMultiplier = 1.0,
  expectedGen = audioCancelGeneration
): Promise<boolean> {
  const spokenText = normalizeUtteranceText(text, lang);
  if (!spokenText || audioCancelGeneration !== expectedGen) return false;

  // Split long multi-clause sentences into <= 145-char clause chunks so Chrome/Android/Safari
  // SpeechSynthesis never swallows middle clauses or triggers the 15-second long-utterance cutoff.
  const chunks = splitTextIntoTtsChunks(spokenText, 145);
  if (chunks.length === 0) return false;

  for (let i = 0; i < chunks.length; i++) {
    if (audioCancelGeneration !== expectedGen) return false;
    const chunkText = chunks[i];

    const ready = await ensureSpeechQueueReady(expectedGen, i > 0);
    if (!ready || audioCancelGeneration !== expectedGen) return false;

    let chunkOk = await playSingleBrowserSpeechAttempt(
      chunkText,
      lang,
      ttsSpeedEn,
      ttsSpeedPt,
      speedMultiplier,
      expectedGen,
      false
    );

    if (!chunkOk && audioCancelGeneration === expectedGen) {
      const readyRetry = await ensureSpeechQueueReady(expectedGen, true);
      if (!readyRetry || audioCancelGeneration !== expectedGen) return false;

      chunkOk = await playSingleBrowserSpeechAttempt(
        chunkText,
        lang,
        ttsSpeedEn,
        ttsSpeedPt,
        speedMultiplier,
        expectedGen,
        true
      );
    }

    if (!chunkOk || audioCancelGeneration !== expectedGen) {
      return false;
    }
  }

  return audioCancelGeneration === expectedGen;
}

function playOnlineTtsUrl(
  url: string,
  playbackRate: number,
  maxTimeoutMs: number,
  expectedGen: number
): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || audioCancelGeneration !== expectedGen) {
      resolve(false);
      return;
    }
    const player = document.getElementById('globalAudioPlayer') as HTMLAudioElement | null;
    if (!player) {
      resolve(false);
      return;
    }

    let done = false;
    let hasStartedAudio = false;
    let currentTimeoutMs = maxTimeoutMs;

    const cleanup = (result: boolean, stopPlayer = false) => {
      if (!done) {
        done = true;
        clearTimeout(maxTimer);
        clearInterval(genCheckTimer);
        if (audioCancelGeneration === expectedGen) {
          player.onended = null;
          player.onerror = null;
          player.onloadedmetadata = null;
          player.onplaying = null;
          if (stopPlayer) {
            try {
              player.pause();
              player.currentTime = 0;
            } catch {
              // ignore
            }
          }
        }
        resolve(result && audioCancelGeneration === expectedGen);
      }
    };

    const handleTimeout = () => {
      // Only treat as completed if the vast majority (>= 85%) of the clip has already played
      const playedNearlyComplete =
        hasStartedAudio &&
        Number.isFinite(player.duration) &&
        player.duration > 0 &&
        player.currentTime / player.duration >= 0.85;
      cleanup(playedNearlyComplete, true);
    };

    let maxTimer = setTimeout(handleTimeout, currentTimeoutMs);
    const genCheckTimer = setInterval(() => {
      if (audioCancelGeneration !== expectedGen) {
        cleanup(false, true);
      }
    }, 80);

    player.onplaying = () => {
      hasStartedAudio = true;
    };
    player.onended = () => cleanup(true, false);
    player.onerror = () => {
      const playedNearlyComplete =
        hasStartedAudio &&
        Number.isFinite(player.duration) &&
        player.duration > 0 &&
        player.currentTime / player.duration >= 0.85;
      cleanup(playedNearlyComplete, !playedNearlyComplete);
    };
    player.onloadedmetadata = () => {
      try {
        player.defaultPlaybackRate = playbackRate;
        player.playbackRate = playbackRate;
        if (Number.isFinite(player.duration) && player.duration > 0) {
          const neededMs = Math.ceil((player.duration / Math.max(0.5, playbackRate)) * 1000) + 4500;
          if (neededMs > currentTimeoutMs && !done) {
            currentTimeoutMs = Math.min(40000, neededMs);
            clearTimeout(maxTimer);
            maxTimer = setTimeout(handleTimeout, currentTimeoutMs);
          }
        }
      } catch {
        // ignore
      }
    };

    player.setAttribute('playsinline', 'true');
    player.src = url;
    player.defaultPlaybackRate = playbackRate;
    player.playbackRate = playbackRate;

    const promise = player.play();
    if (promise !== undefined) {
      promise
        .then(() => {
          player.dataset.unlocked = 'true';
        })
        .catch(() => {
          cleanup(false, true);
        });
    }
  });
}

function buildPlayableUrlsFromChunks(chunks: TtsAudioChunkPayload[]): {
  urls: string[];
  revoke: () => void;
} {
  const objectUrlsToRevoke: string[] = [];
  const canUseBlobUrl =
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function';

  const urls = chunks.map(chunk => {
    const mimeType = chunk.mimeType || 'audio/mpeg';
    if (canUseBlobUrl) {
      try {
        const binary = atob(chunk.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        const objUrl = URL.createObjectURL(blob);
        objectUrlsToRevoke.push(objUrl);
        return objUrl;
      } catch {
        // fallback to data URL below
      }
    }
    return `data:${mimeType};base64,${chunk.audioBase64}`;
  });

  return {
    urls,
    revoke: () => {
      for (const objUrl of objectUrlsToRevoke) {
        try {
          URL.revokeObjectURL(objUrl);
        } catch {
          // ignore
        }
      }
    }
  };
}

async function playAudioChunksSequentially(
  chunks: TtsAudioChunkPayload[],
  playbackRate: number,
  fullSpokenText: string,
  expectedGen: number
): Promise<boolean> {
  if (!chunks.length || audioCancelGeneration !== expectedGen) return false;

  const { urls, revoke } = buildPlayableUrlsFromChunks(chunks);
  try {
    const approxChunkLen = Math.max(40, Math.ceil(fullSpokenText.length / chunks.length));
    const chunkTextProxy = fullSpokenText.slice(0, approxChunkLen) || fullSpokenText;

    for (let i = 0; i < urls.length; i++) {
      if (audioCancelGeneration !== expectedGen) return false;
      const chunkTimeoutMs = computeAudioPlaybackTimeoutMs(
        chunks.length === 1 ? fullSpokenText : chunkTextProxy,
        playbackRate,
        true
      );
      const ok = await playOnlineTtsUrl(urls[i], playbackRate, chunkTimeoutMs, expectedGen);
      if (!ok || audioCancelGeneration !== expectedGen) {
        return false;
      }
    }
    return audioCancelGeneration === expectedGen;
  } finally {
    revoke();
  }
}

async function playOnlineTts(
  text: string,
  lang: string,
  ttsSpeedEn: number,
  ttsSpeedPt: number,
  speedMultiplier = 1.0,
  expectedGen = audioCancelGeneration
): Promise<boolean> {
  if (typeof window === 'undefined' || audioCancelGeneration !== expectedGen) {
    return false;
  }
  const spokenText = normalizeUtteranceText(text, lang);
  if (!spokenText) return false;

  const chunks = splitTextIntoTtsChunks(spokenText, 145);
  if (chunks.length === 0) return false;

  const langCode = lang.startsWith('pt') ? 'pt-BR' : 'en-US';
  const fallbackLangCode = lang.startsWith('pt') ? 'pt' : 'en';
  const playbackRate = computeEffectiveTtsRate({
    lang,
    ttsEngine: 'online',
    ttsSpeedEn,
    ttsSpeedPt,
    speedMultiplier
  });

  for (const chunk of chunks) {
    if (audioCancelGeneration !== expectedGen) return false;
    const cleanChunk = chunk.replace(/["]/g, '').trim();
    if (!cleanChunk) continue;
    const encoded = encodeURIComponent(cleanChunk);
    const maxTimeoutMs = computeAudioPlaybackTimeoutMs(cleanChunk, playbackRate, true);

    const primaryUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${langCode}&q=${encoded}`;
    let ok = await playOnlineTtsUrl(primaryUrl, playbackRate, maxTimeoutMs, expectedGen);
    if (!ok && audioCancelGeneration === expectedGen) {
      const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${fallbackLangCode}&q=${encoded}`;
      ok = await playOnlineTtsUrl(fallbackUrl, playbackRate, maxTimeoutMs, expectedGen);
    }
    if (!ok || audioCancelGeneration !== expectedGen) {
      return false;
    }
  }
  return audioCancelGeneration === expectedGen;
}

async function requestServerNeuralTtsAudio(params: {
  spokenText: string;
  lang: string;
  provider: 'gemini_tts' | 'online';
  voiceName: string;
  voiceStyle: string;
  cacheEnabled: boolean;
  cacheKey: string;
  isBackground?: boolean;
  backgroundSignal?: AbortSignal;
}): Promise<CachedTtsAudioEntry | null> {
  const {
    spokenText,
    lang,
    provider,
    voiceName,
    voiceStyle,
    cacheEnabled,
    cacheKey,
    isBackground = false,
    backgroundSignal
  } = params;

  if (cacheEnabled && ttsAudioMemoryCache.has(cacheKey)) {
    return ttsAudioMemoryCache.get(cacheKey)!;
  }

  if (ttsInFlightRequests.has(cacheKey)) {
    return ttsInFlightRequests.get(cacheKey)!;
  }

  if (isBackground && backgroundSignal?.aborted) {
    return null;
  }

  const fetchPromise = (async (): Promise<CachedTtsAudioEntry | null> => {
    const controller = new AbortController();
    if (!isBackground) {
      if (activeTtsFetchController) {
        try {
          activeTtsFetchController.abort();
        } catch {
          // ignore
        }
      }
      activeTtsFetchController = controller;
    }

    const onBackgroundAbort = () => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    };
    if (isBackground && backgroundSignal) {
      backgroundSignal.addEventListener('abort', onBackgroundAbort, { once: true });
    }

    // Scale fetch timeout cleanly when synthesizing multi-clause full sentences
    const fetchTimeoutMs =
      spokenText.length > 160
        ? provider === 'gemini_tts'
          ? 14500
          : 9500
        : provider === 'gemini_tts'
          ? 10500
          : 6500;
    const timeoutId = setTimeout(() => controller.abort(), fetchTimeoutMs);

    try {
      const res = await fetch(apiUrl('/api/voice-hub/tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: spokenText,
          lang,
          provider,
          voiceName,
          voiceStyle
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!isBackground && activeTtsFetchController === controller) {
        activeTtsFetchController = null;
      }

      if (!res.ok) {
        if (res.status === 429 || res.status === 503) {
          ttsPrefetchCooldownUntil = Date.now() + 45_000;
        }
        return null;
      }

      const data = await res.json();
      const defaultMimeType = data?.mimeType || 'audio/mpeg';
      const chunks: TtsAudioChunkPayload[] =
        Array.isArray(data?.audioChunks) && data.audioChunks.length > 0
          ? data.audioChunks
              .filter((c: any) => typeof c?.audioBase64 === 'string' && c.audioBase64.length > 0)
              .map((c: any) => ({
                audioBase64: c.audioBase64,
                mimeType: c.mimeType || defaultMimeType
              }))
          : data?.audioBase64
            ? [{ audioBase64: data.audioBase64, mimeType: defaultMimeType }]
            : [];

      if (chunks.length === 0) {
        return null;
      }

      const providerUsed = String(data.providerUsed || provider);

      if (provider === 'gemini_tts' && providerUsed !== 'gemini_tts') {
        ttsPrefetchCooldownUntil = Date.now() + 45_000;
      }

      // Avoid caching non-Gemini fallback audio under a Gemini cache key so voices stay consistent
      const shouldCacheEntry =
        cacheEnabled && (provider !== 'gemini_tts' || providerUsed === 'gemini_tts');
      const entry: CachedTtsAudioEntry = { chunks, providerUsed };

      if (shouldCacheEntry) {
        if (ttsAudioMemoryCache.size >= 260) {
          const oldestKey = ttsAudioMemoryCache.keys().next().value;
          if (oldestKey) ttsAudioMemoryCache.delete(oldestKey);
        }
        ttsAudioMemoryCache.set(cacheKey, entry);
      }

      return entry;
    } catch {
      clearTimeout(timeoutId);
      if (!isBackground && activeTtsFetchController === controller) {
        activeTtsFetchController = null;
      }
      return null;
    } finally {
      if (isBackground && backgroundSignal) {
        backgroundSignal.removeEventListener('abort', onBackgroundAbort);
      }
      ttsInFlightRequests.delete(cacheKey);
    }
  })();

  ttsInFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

async function playServerNeuralTts(
  text: string,
  lang: string,
  provider: 'gemini_tts' | 'online',
  ttsSpeedEn: number,
  ttsSpeedPt: number,
  speedMultiplier: number,
  options: TtsVoiceHubOptions | undefined,
  expectedGen: number
): Promise<boolean> {
  if (typeof window === 'undefined' || audioCancelGeneration !== expectedGen) {
    return false;
  }
  const spokenText = normalizeUtteranceText(text, lang);
  if (!spokenText) return false;

  // Cancel any lingering browser speech synthesis so server neural audio plays cleanly
  if ('speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
  }

  const voiceName = options?.geminiVoiceName || 'Kore';
  const voiceStyle = options?.geminiVoiceStyle || 'clear_teacher';
  const cacheEnabled = options?.ttsCacheEnabled ?? true;
  const cacheKey = buildTtsCacheKey({
    provider,
    lang,
    voiceName,
    voiceStyle,
    text: spokenText
  });

  const playbackRate = computeEffectiveTtsRate({
    lang,
    ttsEngine: provider,
    ttsSpeedEn,
    ttsSpeedPt,
    geminiVoiceStyle: voiceStyle,
    speedMultiplier
  });

  if (cacheEnabled && ttsAudioMemoryCache.has(cacheKey)) {
    const cached = ttsAudioMemoryCache.get(cacheKey)!;
    return playAudioChunksSequentially(cached.chunks, playbackRate, spokenText, expectedGen);
  }

  const audioResult = await requestServerNeuralTtsAudio({
    spokenText,
    lang,
    provider,
    voiceName,
    voiceStyle,
    cacheEnabled,
    cacheKey,
    isBackground: false
  });

  if (!audioResult?.chunks?.length || audioCancelGeneration !== expectedGen) {
    return false;
  }

  return playAudioChunksSequentially(audioResult.chunks, playbackRate, spokenText, expectedGen);
}

export async function prefetchTtsAudio(
  text: string,
  lang: 'en-US' | 'pt-BR',
  settings: PedagogicalSettings,
  backgroundSignal?: AbortSignal
): Promise<boolean> {
  if (!(settings.ttsCacheEnabled ?? true)) return false;
  if (settings.ttsEngine !== 'gemini_tts' && settings.ttsEngine !== 'online') return false;
  if (Date.now() < ttsPrefetchCooldownUntil) return false;

  const provider = settings.ttsEngine;
  const spokenText = normalizeUtteranceText(text, lang);
  if (!spokenText) return false;

  const voiceName = settings.geminiVoiceName || 'Kore';
  const voiceStyle = settings.geminiVoiceStyle || 'clear_teacher';
  const cacheKey = buildTtsCacheKey({
    provider,
    lang,
    voiceName,
    voiceStyle,
    text: spokenText
  });

  if (ttsAudioMemoryCache.has(cacheKey)) return true;

  const playbackRate = computeEffectiveTtsRate({
    lang,
    ttsEngine: provider,
    ttsSpeedEn: settings.ttsSpeedEn,
    ttsSpeedPt: settings.ttsSpeedPt,
    geminiVoiceStyle: voiceStyle,
    speedMultiplier: 1.0
  });

  const result = await requestServerNeuralTtsAudio({
    spokenText,
    lang,
    provider,
    voiceName,
    voiceStyle,
    cacheEnabled: true,
    cacheKey,
    isBackground: true,
    backgroundSignal
  });
  return Boolean(result?.chunks?.length);
}

export async function speakTextUniversal(
  text: string,
  lang = 'en-US',
  ttsEngine: TtsEngine = 'gemini_tts',
  ttsSpeedEn = 0.85,
  ttsSpeedPt = 1.15,
  speedMultiplier = 1.0,
  options?: TtsVoiceHubOptions
): Promise<boolean> {
  // Increment generation on EVERY new speakTextUniversal invocation so any previous in-flight
  // word or sentence is immediately invalidated and can NEVER retry or bleed into later steps.
  audioCancelGeneration += 1;
  const startGen = audioCancelGeneration;

  if (activeTtsFetchController) {
    try {
      activeTtsFetchController.abort();
    } catch {
      // ignore
    }
    activeTtsFetchController = null;
  }

  if (options?.preferredVoiceEnUri !== undefined) {
    activePreferredVoiceEnUri = options.preferredVoiceEnUri;
  }
  if (options?.preferredVoicePtUri !== undefined) {
    activePreferredVoicePtUri = options.preferredVoicePtUri;
  }

  // Unlock mobile audio synchronously inside the click/tap gesture BEFORE any async network TTS fetch
  unlockAudioSession();

  if (typeof window !== 'undefined') {
    const player = document.getElementById('globalAudioPlayer') as HTMLAudioElement | null;
    if (player && !player.paused) {
      try {
        player.onended = null;
        player.onerror = null;
        player.onloadedmetadata = null;
        player.onplaying = null;
        player.pause();
        player.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }

  let success = false;

  // 1. If user chose a Cloud Neural AI TTS provider ('gemini_tts' or 'online')
  if (ttsEngine === 'gemini_tts' || ttsEngine === 'online') {
    success = await playServerNeuralTts(
      text,
      lang,
      ttsEngine,
      ttsSpeedEn,
      ttsSpeedPt,
      speedMultiplier,
      options,
      startGen
    );
    if (success || audioCancelGeneration !== startGen) {
      return success && audioCancelGeneration === startGen;
    }
  }

  // 2. Native / Browser Speech ('auto', 'browser_custom', or fallback from cloud neural)
  if (ttsEngine !== 'online' && audioCancelGeneration === startGen) {
    success = await playBrowserSpeech(
      text,
      lang,
      ttsSpeedEn,
      ttsSpeedPt,
      speedMultiplier,
      startGen
    );
  }

  // 3. Universal Cloud Stream Fallback (never called if superseded/cancelled)
  if (!success && audioCancelGeneration === startGen) {
    success = await playOnlineTts(
      text,
      lang,
      ttsSpeedEn,
      ttsSpeedPt,
      speedMultiplier,
      startGen
    );
  }
  return success && audioCancelGeneration === startGen;
}

export interface VoiceHubProviderStatus {
  gemini: boolean;
  googleStream: boolean;
}

export async function fetchVoiceHubServerStatus(): Promise<VoiceHubProviderStatus> {
  try {
    const res = await fetch(apiUrl('/api/voice-hub/status'));
    if (res.ok) {
      const data = await res.json();
      if (data && data.providers) {
        return {
          gemini: Boolean(data.providers.gemini),
          googleStream: Boolean(data.providers.googleStream ?? true)
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    gemini: true,
    googleStream: true
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function evaluateAudioWithCloudStt(
  audioBlob: Blob,
  targetSentence: string,
  provider: SttProvider = 'gemini_stt',
  evaluatePronunciation = true
): Promise<AiPronunciationFeedback | null> {
  try {
    if (!audioBlob || audioBlob.size < 100) return null;
    const audioBase64 = await blobToBase64(audioBlob);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7500);
    const res = await fetch(apiUrl('/api/voice-hub/stt'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        mimeType: audioBlob.type || 'audio/webm',
        targetSentence,
        provider,
        evaluatePronunciation
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.transcript !== 'string') return null;
    const normalizedTranscript = normalizeSpokenTranscriptNumbers(
      data.transcript,
      targetSentence
    ).trim();
    return {
      transcript: normalizedTranscript || data.transcript,
      pronunciationScore: Number(data.pronunciationScore ?? 85),
      fluencyScore: Number(data.fluencyScore ?? 85),
      prosodyScore: Number(data.prosodyScore ?? 85),
      coachTipPt: String(data.coachTipPt || ''),
      focusWords: Array.isArray(data.focusWords) ? data.focusWords : [],
      providerUsed: String(data.providerUsed || provider)
    };
  } catch {
    return null;
  }
}

export function getWordInfo(rawWord: string): WordInfo {
  return lookupLocalWordInfo(rawWord, wordTranslationCache);
}

export async function resolveLiteralWordWithAlternatives(
  rawWord: string
): Promise<LiteralTranslationResult> {
  const cleanWord = cleanString(rawWord);
  if (!cleanWord || cleanWord.length < 1) {
    return { primaryPt: '', alternatives: [] };
  }

  if (literalWordTranslationCache.has(cleanWord)) {
    return literalWordTranslationCache.get(cleanWord)!;
  }

  if (/^\d+$/.test(cleanWord)) {
    const numResult = { primaryPt: cleanWord, alternatives: [cleanWord] };
    literalWordTranslationCache.set(cleanWord, numResult);
    return numResult;
  }

  if (literalWordInFlight.has(cleanWord)) {
    return literalWordInFlight.get(cleanWord)!;
  }

  const wordPromise = (async (): Promise<LiteralTranslationResult> => {

  // 1. Primary: Google Translate GTX isolated literal word + bilingual dictionary senses (dt=t&dt=bd)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const query = encodeURIComponent(cleanWord);
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&dt=bd&q=${query}`;
    const res = await fetch(gtxUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const parsed = parseGoogleGtxWordResponse(cleanWord, data);
      if (parsed && parsed.primaryPt) {
        literalWordTranslationCache.set(cleanWord, parsed);
        if (!DICT_DB[cleanWord] && !wordTranslationCache.has(cleanWord)) {
          wordTranslationCache.set(cleanWord, {
            pt: parsed.alternatives.slice(0, 2).join(' / '),
            pos: 'Vocabulário',
            ipa: `/${cleanWord}/`,
            def: `Tradução literal: "${parsed.primaryPt}". Toque no alto-falante para praticar a pronúncia.`
          });
        }
        return parsed;
      }
    }
  } catch {
    // fallback below
  }

  // 2. Secondary fallback: MyMemory with strict anti-fragment validation
  // (Rejects noisy subtitle fragments like "director" -> "de arte")
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1400);
    const query = encodeURIComponent(cleanWord);
    const url = `https://api.mymemory.translated.net/get?q=${query}&langpair=en|pt-br`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const rawText = data?.responseData?.translatedText || '';
      const matchScore = Number(data?.responseData?.match ?? 0);
      const cleanCandidate = sanitizeLiteralPtTranslation(cleanWord, rawText);
      if (
        cleanCandidate &&
        !isSuspiciousMyMemoryFragment(cleanWord, cleanCandidate, matchScore)
      ) {
        const result: LiteralTranslationResult = {
          primaryPt: cleanCandidate,
          alternatives: [cleanCandidate]
        };
        literalWordTranslationCache.set(cleanWord, result);
        if (!DICT_DB[cleanWord]) {
          wordTranslationCache.set(cleanWord, {
            pt: cleanCandidate,
            pos: 'Vocabulário',
            ipa: `/${cleanWord}/`,
            def: `Tradução direta: "${cleanCandidate}". Toque no alto-falante para praticar a pronúncia.`
          });
        }
        return result;
      }
    }
  } catch {
    // ignore fetch/abort error
  }

  // 3. Offline local dictionary fallback (exact entry preferred)
  const exactLocal = DICT_DB[cleanWord];
  if (exactLocal) {
    const alts = extractDictionaryAlternatives(cleanWord, exactLocal);
    if (alts.length > 0) {
      return { primaryPt: alts[0], alternatives: alts };
    }
  }

  const localInfo = lookupLocalWordInfo(cleanWord, wordTranslationCache);
  if (localInfo.pt && localInfo.pt !== '...') {
    const cleaned = sanitizeLiteralPtTranslation(cleanWord, localInfo.pt);
    if (cleaned) {
      return { primaryPt: cleaned, alternatives: [cleaned] };
    }
  }

  return { primaryPt: cleanWord, alternatives: [] };
  })();

  literalWordInFlight.set(cleanWord, wordPromise);
  try {
    return await wordPromise;
  } finally {
    literalWordInFlight.delete(cleanWord);
  }
}

export async function resolveWordTranslation(cleanWord: string): Promise<string> {
  if (!cleanWord || cleanWord.length < 1) return '';
  const clean = cleanString(cleanWord);
  if (DICT_DB[clean] && DICT_DB[clean].pt && DICT_DB[clean].pt !== '...') {
    return DICT_DB[clean].pt.split('/')[0].trim();
  }
  if (wordTranslationCache.has(clean)) {
    const cached = wordTranslationCache.get(clean)!;
    if (cached.pt && cached.pt !== '...') {
      return cached.pt.split('/')[0].trim();
    }
  }

  const literal = await resolveLiteralWordWithAlternatives(clean);
  return literal.primaryPt || clean;
}

function isCompleteTranslationCandidate(sourceEn: string, candidatePt: string): boolean {
  const cleanCandidate = (candidatePt || '').trim();
  if (!cleanCandidate) return false;
  const upper = cleanCandidate.toUpperCase();
  if (
    upper.includes('MYMEMORY WARNING') ||
    upper.includes('QUERY LENGTH LIMIT') ||
    upper.includes('INVALID EMAIL')
  ) {
    return false;
  }

  const enWords = sourceEn.trim().split(/\s+/).filter(Boolean);
  const ptWords = cleanCandidate.split(/\s+/).filter(Boolean);

  // Reject truncated translations (e.g. 5+ English words translated into just 1-2 words or < 50% when missing head nouns)
  if (enWords.length >= 4 && ptWords.length < Math.ceil(enWords.length * 0.55)) {
    return false;
  }
  return true;
}

export function buildOfflineSentenceTranslation(sourceEn: string): string {
  const trimmed = sourceEn.trim();
  if (!trimmed) return '';

  // Normalize common multi-word compounds before token-by-token lookup
  let working = trimmed
    .replace(/\bcoffee shop\b/gi, 'cafeteria')
    .replace(/\bnear my house\b/gi, 'perto da minha casa')
    .replace(/\bevery morning\b/gi, 'toda manhã');

  const tokens = working.split(/\s+/).filter(Boolean);
  const translatedTokens = tokens.map(t => {
    const trailingPunct = (t.match(/[,.;:!?'"”’)]+$/) || [''])[0];
    const clean = cleanString(t);
    if (!clean) return t;
    const local = lookupLocalWordInfo(clean, wordTranslationCache);
    if (local.pt && local.pt !== '...') {
      const primary = local.pt.split('/')[0].replace(/\(a\)/g, '').trim();
      return `${primary}${trailingPunct}`;
    }
    return t;
  });

  const assembled = translatedTokens.join(' ').trim();
  return assembled.charAt(0).toUpperCase() + assembled.slice(1);
}

export async function fetchSentenceTranslation(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (sentenceTranslationCache.has(trimmed)) return sentenceTranslationCache.get(trimmed)!;

  // 1. Check curated SAMPLE_BOOKS sentences or sub-clauses first
  const lowerTrimmed = trimmed.toLowerCase();
  for (const book of SAMPLE_BOOKS) {
    for (const s of book.sentences) {
      if (s.en.trim().toLowerCase() === lowerTrimmed && s.pt) {
        sentenceTranslationCache.set(trimmed, s.pt);
        return s.pt;
      }
    }
  }

  if (sentenceTranslationInFlight.has(trimmed)) {
    return sentenceTranslationInFlight.get(trimmed)!;
  }

  const translationPromise = (async (): Promise<string> => {
    const query = encodeURIComponent(trimmed.slice(0, 360));

    // 2. Primary neural translation endpoint (Google GTX)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2200);
      const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${query}`;
      const res = await fetch(gtxUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const joined = data[0]
            .map((part: unknown) =>
              Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''
            )
            .join('')
            .trim();
          if (isCompleteTranslationCandidate(trimmed, joined)) {
            sentenceTranslationCache.set(trimmed, joined);
            return joined;
          }
        }
      }
    } catch {
      // fallback to secondary endpoint
    }

    // 3. Secondary translation endpoint (MyMemory) with completeness check
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2200);
      const url = `https://api.mymemory.translated.net/get?q=${query}&langpair=en|pt-br`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.responseData && data.responseData.translatedText) {
          let translated: string = data.responseData.translatedText;
          translated = translated
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .trim();
          if (isCompleteTranslationCandidate(trimmed, translated)) {
            sentenceTranslationCache.set(trimmed, translated);
            return translated;
          }
        }
      }
    } catch {
      // fallback to offline contextual word assembly
    }

    // 4. Phrase-aware & stem-aware offline dictionary fallback
    const assembled = buildOfflineSentenceTranslation(trimmed);
    sentenceTranslationCache.set(trimmed, assembled);
    return assembled;
  })();

  sentenceTranslationInFlight.set(trimmed, translationPromise);
  try {
    return await translationPromise;
  } finally {
    sentenceTranslationInFlight.delete(trimmed);
  }
}

export interface PrepareNextSentenceParams {
  currentSentence?: Sentence | null;
  nextSentence?: Sentence | null;
  nextSentenceIndex?: number;
  lookaheadSentence?: Sentence | null;
  lookaheadSentenceIndex?: number;
  settings: PedagogicalSettings;
  isStepByStepMode: boolean;
  onSentenceTranslated?: (sentenceIndex: number, translatedPt: string) => void;
  onWordsResolved?: () => void;
}

/**
 * Background pre-generation pipeline: while the user is training the current sentence,
 * silently prepares the upcoming sentence's Portuguese translation, sub-clause segmentation,
 * word-by-word literal dictionary entries, challenge word translations, and prioritized TTS audio
 * so transitions between sentences and challenges happen with zero loading delay.
 */
export async function prepareNextSentenceResources({
  currentSentence,
  nextSentence,
  nextSentenceIndex = 1,
  lookaheadSentence,
  lookaheadSentenceIndex = 2,
  settings,
  isStepByStepMode,
  onSentenceTranslated,
  onWordsResolved
}: PrepareNextSentenceParams): Promise<void> {
  activePrefetchGeneration += 1;
  const myGen = activePrefetchGeneration;
  const controller = new AbortController();
  activePrefetchAbortController = controller;

  const isStale = () => myGen !== activePrefetchGeneration || controller.signal.aborted;

  const plan = buildSentencePrefetchPlan({
    currentSentence,
    nextSentence,
    nextSentenceIndex,
    lookaheadSentence,
    lookaheadSentenceIndex,
    settings,
    isStepByStepMode,
    exactDictLookup: DICT_DB,
    isTtsCached: cacheKey => ttsAudioMemoryCache.has(cacheKey)
  });

  // Step 1: Resolve missing sentence translations immediately (in parallel)
  let resolvedNextPt = nextSentence?.pt || '';
  const translationTask = Promise.all(
    plan.sentenceTranslations.map(async item => {
      if (isStale()) return;
      const pt = await fetchSentenceTranslation(item.text);
      if (isStale() || !pt) return;
      if (item.sentenceIndex === nextSentenceIndex) {
        resolvedNextPt = pt;
      }
      onSentenceTranslated?.(item.sentenceIndex, pt);
    })
  );

  // Step 2: Pre-resolve literal word translations (for Card 03 & Post-Sentence Challenge Pairs)
  const pendingWords = plan.literalWords.filter(w => !hasCachedLiteralWord(w));
  const wordTask = (async () => {
    let resolvedAny = false;
    const batchSize = 4;
    for (let i = 0; i < pendingWords.length; i += batchSize) {
      if (isStale()) return;
      const batch = pendingWords.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async word => {
          if (isStale()) return;
          await resolveLiteralWordWithAlternatives(word);
          resolvedAny = true;
        })
      );
    }
    if (resolvedAny && !isStale()) {
      onWordsResolved?.();
    }
  })();

  // Step 3: Immediately start high-priority TTS synthesis (EN/known PT) in parallel without waiting for word lookups
  const runTtsBatchQueue = async (tasks: typeof plan.ttsTasks) => {
    const concurrency = 2;
    for (let i = 0; i < tasks.length; i += concurrency) {
      if (isStale() || Date.now() < ttsPrefetchCooldownUntil) return;
      const chunk = tasks.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(task => prefetchTtsAudio(task.text, task.lang, settings, controller.signal))
      );
      if (i + concurrency < tasks.length && !isStale()) {
        await new Promise(r => setTimeout(r, 40));
      }
    }
  };

  const immediateHighTasks = plan.ttsTasks.filter(t => t.priority === 'high');
  const immediateHighTtsPromise = runTtsBatchQueue(immediateHighTasks);

  // Step 4: Once sentence translation completes, queue any newly translated PT / sub-clause PT TTS immediately
  await translationTask;
  if (isStale()) return;

  const dynamicNextSentence =
    nextSentence && resolvedNextPt ? { ...nextSentence, pt: resolvedNextPt } : nextSentence;
  const finalPlan = buildSentencePrefetchPlan({
    currentSentence,
    nextSentence: dynamicNextSentence,
    nextSentenceIndex,
    lookaheadSentence,
    lookaheadSentenceIndex,
    settings,
    isStepByStepMode,
    exactDictLookup: DICT_DB,
    isTtsCached: cacheKey => ttsAudioMemoryCache.has(cacheKey)
  });

  if (
    dynamicNextSentence &&
    isStepByStepMode &&
    resolvedNextPt &&
    (settings.ttsCacheEnabled ?? true) &&
    (settings.ttsEngine === 'gemini_tts' || settings.ttsEngine === 'online')
  ) {
    const steps = splitSentenceIntoStudySteps(dynamicNextSentence.en, 'forward', resolvedNextPt);
    for (const step of steps) {
      if (step.isFull || !step.ptText) continue;
      const cacheKey = buildTtsCacheKey({
        provider: settings.ttsEngine,
        lang: 'pt-BR',
        voiceName: settings.geminiVoiceName || 'Kore',
        voiceStyle: settings.geminiVoiceStyle || 'clear_teacher',
        text: step.ptText
      });
      if (
        !ttsAudioMemoryCache.has(cacheKey) &&
        !finalPlan.ttsTasks.some(t => t.cacheKey === cacheKey)
      ) {
        finalPlan.ttsTasks.unshift({
          text: step.ptText,
          lang: 'pt-BR',
          cacheKey,
          priority: 'high'
        });
      }
    }
  }

  await immediateHighTtsPromise;
  if (isStale()) return;

  const immediateKeySet = new Set(immediateHighTasks.map(t => t.cacheKey));
  const priorityWeight: Record<'high' | 'medium' | 'low', number> = {
    high: 0,
    medium: 1,
    low: 2
  };
  const remainingTasks = finalPlan.ttsTasks
    .filter(t => !immediateKeySet.has(t.cacheKey) && !ttsAudioMemoryCache.has(t.cacheKey))
    .sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]);

  await Promise.all([wordTask, runTtsBatchQueue(remainingTasks)]);
}

export async function fetchOnlineDictionaryDetails(cleanWord: string): Promise<{
  phonetic?: string;
  partOfSpeech?: string;
  enDefinition?: string;
}> {
  try {
    const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`;
    const res = await fetch(dictUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data[0]) {
        const phonetic =
          data[0].phonetic ||
          (data[0].phonetics && data[0].phonetics.find((p: { text?: string }) => p.text)?.text);
        let partOfSpeech: string | undefined;
        let enDefinition: string | undefined;
        if (data[0].meanings && data[0].meanings.length > 0) {
          const m = data[0].meanings[0];
          partOfSpeech = m.partOfSpeech;
          if (m.definitions && m.definitions[0]) {
            enDefinition = m.definitions[0].definition;
          }
        }
        return { phonetic, partOfSpeech, enDefinition };
      }
    }
  } catch {
    // ignore
  }
  return {};
}
