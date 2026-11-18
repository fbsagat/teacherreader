import {
  GeminiVoiceStyle,
  PedagogicalSettings,
  SttProvider,
  SttStrictnessMode,
  TtsEngine
} from '../types/shadowreader';
import { getHandsFreeEffectiveMaxAttempts } from './blindAttempts';

export interface EffectiveTtsRateParams {
  lang: string;
  ttsEngine: TtsEngine;
  ttsSpeedEn: number;
  ttsSpeedPt: number;
  geminiVoiceStyle?: GeminiVoiceStyle;
  speedMultiplier?: number;
  /**
   * Explicit playback rate that wins over the user speed and the clarity floor.
   * Used by the dedicated slow-listening step, whose whole purpose is to be
   * audibly slower than normal playback.
   */
  absoluteRate?: number;
}

/**
 * Absolute playback rate for the "Ouvir EN 0.6x" step. Deliberately below the
 * automatic clarity floor (0.72x) because a slow step that sounds the same as
 * normal playback is useless.
 */
export const EN_SLOW_PLAYBACK_RATE = 0.6;

/** Absolute playback rate range accepted by browsers' HTMLAudioElement. */
export const MIN_ABSOLUTE_PLAYBACK_RATE = 0.5;
export const MAX_ABSOLUTE_PLAYBACK_RATE = 1.5;

export const GEMINI_STYLE_RATE_FACTORS: Record<GeminiVoiceStyle, number> = {
  clear_teacher: 0.98,
  audiobook: 1.0,
  conversational: 1.05,
  slow_learner: 0.92
};

/**
 * Computes a unified, artifact-free playback rate across all TTS engines.
 * Prevents double-compounding slow speed (e.g., ttsSpeedEn + slow_learner + -15% error slowdown)
 * from dropping below safe clarity bounds where audio distorts or triggers playback timeouts.
 */
export function computeEffectiveTtsRate({
  lang,
  ttsEngine,
  ttsSpeedEn,
  ttsSpeedPt,
  geminiVoiceStyle = 'clear_teacher',
  speedMultiplier = 1.0,
  absoluteRate
}: EffectiveTtsRateParams): number {
  if (
    typeof absoluteRate === 'number' &&
    Number.isFinite(absoluteRate) &&
    absoluteRate > 0
  ) {
    const clamped = Math.min(
      MAX_ABSOLUTE_PLAYBACK_RATE,
      Math.max(MIN_ABSOLUTE_PLAYBACK_RATE, absoluteRate)
    );
    return Number(clamped.toFixed(2));
  }

  const isPt = lang.toLowerCase().startsWith('pt');
  const userBaseRate = isPt ? ttsSpeedPt : ttsSpeedEn;
  const safeBase = Number.isFinite(userBaseRate) ? userBaseRate : isPt ? 1.35 : 0.7;
  const safeMult = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1.0;

  const styleFactor =
    !isPt && ttsEngine === 'gemini_tts'
      ? GEMINI_STYLE_RATE_FACTORS[geminiVoiceStyle] ?? 0.98
      : 1.0;

  const rawRate = safeBase * styleFactor * safeMult;
  // Neural cloud WAV audio keeps cleaner pitch fidelity >= 0.72x; browser synthesis tolerates >= 0.65x
  const minFloor = ttsEngine === 'gemini_tts' || ttsEngine === 'online' ? 0.72 : 0.65;
  const maxCeil = 1.5;

  return Number(Math.max(minFloor, Math.min(maxCeil, rawRate)).toFixed(2));
}

/**
 * Computes a safe upper-bound audio completion timeout from utterance length & effective speed
 * so slowed-down error repetitions (-15%) on full sentences never get aborted prematurely.
 */
export function computeAudioPlaybackTimeoutMs(
  spokenText: string,
  playbackRate: number,
  isCloudUrl = true
): number {
  const trimmed = (spokenText || '').trim();
  const isSingleWord = !trimmed.includes(' ');
  const safeRate = Math.max(0.55, Number.isFinite(playbackRate) ? playbackRate : 1.0);

  if (isSingleWord) {
    return Math.round((isCloudUrl ? 5000 : 4200) / Math.min(1.0, safeRate));
  }

  // Conservative bound: ~175ms per character scaled by rate + 4500ms buffer for buffering/pauses
  const estimatedMs = Math.round((trimmed.length * 175) / safeRate) + 4500;
  return Math.max(12000, Math.min(32000, estimatedMs));
}

export interface BlindErrorFeedbackInput {
  stepCard: string;
  attempts: number;
  blindMaxErrorsBeforeReveal: number;
  repeatOnError: boolean;
  slowdownOnError: boolean;
  autoHandsFree: boolean;
  handsFreeMaxAttempts: number;
  hasTargetPt: boolean;
}

export type BlindErrorFeedbackPlan =
  | {
      action: 'hands_free_advance';
      revealEnglish: boolean;
      speakLang: 'en-US';
      speedMultiplier: number;
      pauseAfterMs: number;
    }
  | {
      action: 'reveal_and_repeat_en';
      revealEnglish: true;
      speakLang: 'en-US';
      speedMultiplier: number;
      pauseAfterMs: number;
    }
  | {
      action: 'repeat_pt_hint';
      revealEnglish: boolean;
      speakLang: 'pt-BR';
      speedMultiplier: 1.0;
      pauseAfterMs: number;
    }
  | {
      action: 'repeat_en_error';
      revealEnglish: boolean;
      speakLang: 'en-US';
      speedMultiplier: number;
      pauseAfterMs: number;
    }
  | {
      action: 'silent_retry';
      revealEnglish: boolean;
      speakLang: null;
      speedMultiplier: 1.0;
      pauseAfterMs: number;
    };

/**
 * Resolves the exact single feedback action when a speech error occurs inside
 * `runShadowingStep` (including 'speak_blind_en'), guaranteeing at most one
 * support utterance per failed attempt.
 */
export function resolveSpeakErrorFeedbackPlan({
  stepCard,
  attempts,
  blindMaxErrorsBeforeReveal,
  repeatOnError,
  slowdownOnError,
  autoHandsFree,
  handsFreeMaxAttempts,
  hasTargetPt
}: BlindErrorFeedbackInput): BlindErrorFeedbackPlan {
  const isBlind = stepCard === 'speak_blind_en';
  const maxBlind = Number.isFinite(blindMaxErrorsBeforeReveal) ? blindMaxErrorsBeforeReveal : 2;
  const revealedByMaxErrors = isBlind && maxBlind > 0 && attempts >= maxBlind;

  const baseMax = Math.max(1, handsFreeMaxAttempts || 2);
  const effectiveHandsFreeMax = getHandsFreeEffectiveMaxAttempts(
    stepCard,
    baseMax,
    blindMaxErrorsBeforeReveal
  );

  if (autoHandsFree && attempts >= effectiveHandsFreeMax) {
    return {
      action: 'hands_free_advance',
      revealEnglish: isBlind,
      speakLang: 'en-US',
      speedMultiplier: 0.92,
      pauseAfterMs: 280
    };
  }

  if (!repeatOnError) {
    return {
      action: 'silent_retry',
      revealEnglish: revealedByMaxErrors,
      speakLang: null,
      speedMultiplier: 1.0,
      pauseAfterMs: 700
    };
  }

  const errorSpeedMult = slowdownOnError ? 0.85 : 1.0;

  if (isBlind && hasTargetPt && !revealedByMaxErrors) {
    return {
      action: 'repeat_pt_hint',
      revealEnglish: false,
      speakLang: 'pt-BR',
      speedMultiplier: 1.0,
      pauseAfterMs: 350
    };
  }

  if (revealedByMaxErrors) {
    return {
      action: 'reveal_and_repeat_en',
      revealEnglish: true,
      speakLang: 'en-US',
      speedMultiplier: errorSpeedMult,
      pauseAfterMs: 350
    };
  }

  return {
    action: 'repeat_en_error',
    revealEnglish: false,
    speakLang: 'en-US',
    speedMultiplier: errorSpeedMult,
    pauseAfterMs: 350
  };
}

export interface VoiceCompatibilitySummary {
  ttsEngine: TtsEngine;
  sttProvider: SttProvider;
  sttStrictness: SttStrictnessMode;
  usesGeminiTts: boolean;
  usesSystemVoicePicker: boolean;
  usesGoogleStreamOnly: boolean;
  ttsEngineLabel: string;
  ttsVoiceDetail: string;
  sttProviderLabel: string;
  sttStrictnessLabel: string;
  effectiveNormalEnRate: number;
  effectiveErrorRetryEnRate: number;
  isSlowdownRelevant: boolean;
  isAiCoachEnabled: boolean;
}

const TTS_ENGINE_LABELS: Record<TtsEngine, string> = {
  gemini_tts: 'Gemini Neural TTS (Estúdio EUA)',
  auto: 'Híbrido Inteligente (Nativo + Nuvem)',
  browser_custom: 'Voz Manual do Dispositivo',
  online: 'Google Cloud Stream (GTX)'
};

const GEMINI_STYLE_LABELS: Record<GeminiVoiceStyle, string> = {
  clear_teacher: 'Professor Claro',
  audiobook: 'Narrador Audiobook',
  conversational: 'Conversa EUA',
  slow_learner: 'Articulado Calmo'
};

const STT_PROVIDER_LABELS: Record<SttProvider, string> = {
  hybrid_ai: 'Híbrido + Coach IA',
  web_speech: 'Web Speech Nativo',
  gemini_stt: 'Gemini Audio Coach'
};

const STT_STRICTNESS_LABELS: Record<SttStrictnessMode, string> = {
  forgiving: 'Tolerante',
  balanced: 'Equilibrado',
  strict: 'Rigoroso'
};

/**
 * Computes a synchronized compatibility summary connecting the 'Voz & IA' hub
 * settings with the 'Regras' and 'Aparência' panels.
 */
export function getVoiceCompatibilitySummary(
  settings: PedagogicalSettings
): VoiceCompatibilitySummary {
  const ttsEngine: TtsEngine = settings.ttsEngine || 'gemini_tts';
  const sttProvider: SttProvider = settings.sttProvider || 'hybrid_ai';
  const sttStrictness: SttStrictnessMode = settings.sttStrictness || 'balanced';
  const geminiVoice = settings.geminiVoiceName || 'Kore';
  const geminiStyle: GeminiVoiceStyle = settings.geminiVoiceStyle || 'clear_teacher';

  const usesGeminiTts = ttsEngine === 'gemini_tts';
  const usesSystemVoicePicker = ttsEngine === 'auto' || ttsEngine === 'browser_custom';
  const usesGoogleStreamOnly = ttsEngine === 'online';

  let ttsVoiceDetail = '';
  if (usesGeminiTts) {
    ttsVoiceDetail = `Voz ${geminiVoice} · ${GEMINI_STYLE_LABELS[geminiStyle] || geminiStyle}`;
  } else if (usesSystemVoicePicker) {
    ttsVoiceDetail = settings.preferredVoiceEnUri
      ? `Voz fixa: ${settings.preferredVoiceEnUri}`
      : 'Seleção automática da melhor voz do dispositivo';
  } else {
    ttsVoiceDetail = 'Stream leve EN-US / PT-BR via nuvem';
  }

  const effectiveNormalEnRate = computeEffectiveTtsRate({
    lang: 'en-US',
    ttsEngine,
    ttsSpeedEn: settings.ttsSpeedEn,
    ttsSpeedPt: settings.ttsSpeedPt,
    geminiVoiceStyle: geminiStyle,
    speedMultiplier: 1.0
  });

  const effectiveErrorRetryEnRate = computeEffectiveTtsRate({
    lang: 'en-US',
    ttsEngine,
    ttsSpeedEn: settings.ttsSpeedEn,
    ttsSpeedPt: settings.ttsSpeedPt,
    geminiVoiceStyle: geminiStyle,
    speedMultiplier: settings.slowdownOnError ? 0.85 : 1.0
  });

  return {
    ttsEngine,
    sttProvider,
    sttStrictness,
    usesGeminiTts,
    usesSystemVoicePicker,
    usesGoogleStreamOnly,
    ttsEngineLabel: TTS_ENGINE_LABELS[ttsEngine] || TTS_ENGINE_LABELS.gemini_tts,
    ttsVoiceDetail,
    sttProviderLabel: STT_PROVIDER_LABELS[sttProvider] || STT_PROVIDER_LABELS.hybrid_ai,
    sttStrictnessLabel: STT_STRICTNESS_LABELS[sttStrictness] || STT_STRICTNESS_LABELS.balanced,
    effectiveNormalEnRate,
    effectiveErrorRetryEnRate,
    isSlowdownRelevant: Boolean(settings.repeatOnError),
    isAiCoachEnabled: settings.enableAiPronunciationCoach ?? true
  };
}
