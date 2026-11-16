import {
  AudioFlow,
  GeminiVoiceName,
  GeminiVoiceStyle,
  HandsFreeChallengeMode,
  PedagogicalSettings,
  SttProvider,
  SttSilencePauseMode,
  SttStrictnessMode,
  StudyStepCardType,
  StudyViewMode,
  ThemeMode,
  TtsEngine,
  VisualCardType
} from '../types/shadowreader';

export const DEFAULT_SETTINGS: PedagogicalSettings = {
  ttsEngine: 'gemini_tts',
  preferredVoiceEnUri: '',
  preferredVoicePtUri: '',
  geminiVoiceName: 'Kore',
  geminiVoiceStyle: 'clear_teacher',
  ttsCacheEnabled: true,
  sttProvider: 'hybrid_ai',
  sttSilencePauseMode: 'normal',
  sttStrictness: 'balanced',
  enableAiPronunciationCoach: true,
  micNoiseSuppression: true,
  audioFlow: 'pt_first',
  cardSequence: ['pt', 'en', 'speak', 'challenges'],
  visualCardOrder: ['pt', 'en', 'literal'],
  enableBlindSpeakingStage: false,
  blindMaxErrorsBeforeReveal: 2,
  blindSpeakingOnFullSentence: true,
  repeatOnError: true,
  slowdownOnError: true,
  readWordsOnSuccess: false,
  enablePostSentenceChallenges: true,
  enableWordPronunciationChallenge: true,
  enableWordMatchingChallenge: true,
  repeatSentenceOnChallengeFail: true,
  threshold: 75,
  ttsSpeedEn: 0.85,
  ttsSpeedPt: 1.15,
  audioBeeps: true,
  autoHandsFree: false,
  handsFreeMaxAttempts: 2,
  handsFreeChallengeMode: 'voice_all',
  handsFreeVoiceCommands: true,
  handsFreeAutoStart: false,
  themeMode: 'dark',
  fontSizeScale: 110,
  studyViewMode: 'cards',
  showConnectedSpeech: false,
  dailyGoalSentences: 10,
  practiceDaysGoal: 14
};

export const VALID_TTS_ENGINES: TtsEngine[] = ['gemini_tts', 'auto', 'browser_custom', 'online'];
export const VALID_STT_PROVIDERS: SttProvider[] = ['hybrid_ai', 'web_speech', 'gemini_stt'];
export const VALID_STT_PAUSE_MODES: SttSilencePauseMode[] = ['short', 'normal', 'long'];
export const VALID_STT_STRICTNESS: SttStrictnessMode[] = ['forgiving', 'balanced', 'strict'];
export const VALID_GEMINI_VOICES: GeminiVoiceName[] = [
  'Kore',
  'Puck',
  'Charon',
  'Fenrir',
  'Zephyr'
];
export const VALID_GEMINI_STYLES: GeminiVoiceStyle[] = [
  'clear_teacher',
  'audiobook',
  'conversational',
  'slow_learner'
];
export const VALID_AUDIO_FLOWS: AudioFlow[] = [
  'challenge',
  'pt_first',
  'en_first',
  'sandwich',
  'blind_en',
  'custom'
];
export const VALID_THEME_MODES: ThemeMode[] = [
  'dark',
  'light',
  'sepia',
  'forest',
  'ocean',
  'amethyst'
];
export const VALID_STUDY_VIEW_MODES: StudyViewMode[] = ['cards', 'paragraph'];
export const VALID_HANDS_FREE_CHALLENGE_MODES: HandsFreeChallengeMode[] = [
  'voice_all',
  'pronunciation_only',
  'auto_review'
];
export const VALID_CARD_STEPS: StudyStepCardType[] = [
  'pt',
  'en',
  'en_slow',
  'literal',
  'speak',
  'speak_blind_en',
  'speak_challenge',
  'challenges',
  'challenge_pronunciation',
  'challenge_matching'
];
export const VALID_VISUAL_CARDS: VisualCardType[] = ['pt', 'en', 'literal'];

function pickEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pickNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  step?: number
): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  const stepped = step ? Math.round(num / step) * step : num;
  const clamped = Math.min(max, Math.max(min, stepped));
  // Round to avoid floating point noise from the step arithmetic.
  return Math.round(clamped * 1000) / 1000;
}

function pickString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function pickCardSequence(value: unknown, fallback: StudyStepCardType[]): StudyStepCardType[] {
  if (!Array.isArray(value)) return [...fallback];
  const seen = new Set<StudyStepCardType>();
  const result: StudyStepCardType[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    if (!(VALID_CARD_STEPS as string[]).includes(item)) continue;
    const card = item as StudyStepCardType;
    if (seen.has(card)) continue;
    seen.add(card);
    result.push(card);
  }
  return result.length > 0 ? result : [...fallback];
}

function pickVisualCardOrder(value: unknown, fallback: VisualCardType[]): VisualCardType[] {
  if (!Array.isArray(value)) return [...fallback];
  const seen = new Set<VisualCardType>();
  const result: VisualCardType[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    if (!(VALID_VISUAL_CARDS as string[]).includes(item)) continue;
    const card = item as VisualCardType;
    if (seen.has(card)) continue;
    seen.add(card);
    result.push(card);
  }
  return result.length > 0 ? result : [...fallback];
}

/**
 * Pure settings sanitizer used at every boundary where settings come from
 * untrusted storage (localStorage, Google Drive backup).
 *
 * Guarantees: no NaN/Infinity, every numeric field inside its UI range, enums
 * always valid, card sequences filtered against the known card types, unknown
 * keys dropped.
 */
export function normalizeSettings(partial: unknown): PedagogicalSettings {
  const input: Record<string, unknown> =
    partial && typeof partial === 'object' && !Array.isArray(partial)
      ? (partial as Record<string, unknown>)
      : {};
  const d = DEFAULT_SETTINGS;

  return {
    ttsEngine: pickEnum(input.ttsEngine, VALID_TTS_ENGINES, d.ttsEngine),
    preferredVoiceEnUri: pickString(input.preferredVoiceEnUri, d.preferredVoiceEnUri),
    preferredVoicePtUri: pickString(input.preferredVoicePtUri, d.preferredVoicePtUri),
    geminiVoiceName: pickEnum(input.geminiVoiceName, VALID_GEMINI_VOICES, d.geminiVoiceName || 'Kore'),
    geminiVoiceStyle: pickEnum(
      input.geminiVoiceStyle,
      VALID_GEMINI_STYLES,
      d.geminiVoiceStyle || 'clear_teacher'
    ),
    ttsCacheEnabled: pickBoolean(input.ttsCacheEnabled, Boolean(d.ttsCacheEnabled)),
    sttProvider: pickEnum(input.sttProvider, VALID_STT_PROVIDERS, d.sttProvider || 'hybrid_ai'),
    sttSilencePauseMode: pickEnum(
      input.sttSilencePauseMode,
      VALID_STT_PAUSE_MODES,
      d.sttSilencePauseMode || 'normal'
    ),
    sttStrictness: pickEnum(input.sttStrictness, VALID_STT_STRICTNESS, d.sttStrictness || 'balanced'),
    enableAiPronunciationCoach: pickBoolean(
      input.enableAiPronunciationCoach,
      Boolean(d.enableAiPronunciationCoach)
    ),
    micNoiseSuppression: pickBoolean(input.micNoiseSuppression, Boolean(d.micNoiseSuppression)),
    audioFlow: pickEnum(input.audioFlow, VALID_AUDIO_FLOWS, d.audioFlow),
    cardSequence: pickCardSequence(input.cardSequence, d.cardSequence),
    visualCardOrder: pickVisualCardOrder(input.visualCardOrder, d.visualCardOrder),
    enableBlindSpeakingStage: pickBoolean(
      input.enableBlindSpeakingStage,
      d.enableBlindSpeakingStage
    ),
    blindMaxErrorsBeforeReveal: Math.round(
      pickNumber(input.blindMaxErrorsBeforeReveal, d.blindMaxErrorsBeforeReveal, 0, 5)
    ),
    blindSpeakingOnFullSentence: pickBoolean(
      input.blindSpeakingOnFullSentence,
      Boolean(d.blindSpeakingOnFullSentence)
    ),
    repeatOnError: pickBoolean(input.repeatOnError, d.repeatOnError),
    slowdownOnError: pickBoolean(input.slowdownOnError, d.slowdownOnError),
    readWordsOnSuccess: pickBoolean(input.readWordsOnSuccess, d.readWordsOnSuccess),
    enablePostSentenceChallenges: pickBoolean(
      input.enablePostSentenceChallenges,
      d.enablePostSentenceChallenges
    ),
    enableWordPronunciationChallenge: pickBoolean(
      input.enableWordPronunciationChallenge,
      d.enableWordPronunciationChallenge
    ),
    enableWordMatchingChallenge: pickBoolean(
      input.enableWordMatchingChallenge,
      d.enableWordMatchingChallenge
    ),
    repeatSentenceOnChallengeFail: pickBoolean(
      input.repeatSentenceOnChallengeFail,
      d.repeatSentenceOnChallengeFail
    ),
    threshold: Math.round(pickNumber(input.threshold, d.threshold, 50, 95, 5)),
    ttsSpeedEn: pickNumber(input.ttsSpeedEn, d.ttsSpeedEn, 0.65, 1.2, 0.05),
    ttsSpeedPt: pickNumber(input.ttsSpeedPt, d.ttsSpeedPt, 0.8, 1.4, 0.05),
    audioBeeps: pickBoolean(input.audioBeeps, d.audioBeeps),
    autoHandsFree: pickBoolean(input.autoHandsFree, d.autoHandsFree),
    handsFreeMaxAttempts: Math.round(
      pickNumber(input.handsFreeMaxAttempts, d.handsFreeMaxAttempts ?? 2, 1, 5)
    ),
    handsFreeChallengeMode: pickEnum(
      input.handsFreeChallengeMode,
      VALID_HANDS_FREE_CHALLENGE_MODES,
      d.handsFreeChallengeMode || 'voice_all'
    ),
    handsFreeVoiceCommands: pickBoolean(
      input.handsFreeVoiceCommands,
      Boolean(d.handsFreeVoiceCommands)
    ),
    handsFreeAutoStart: pickBoolean(input.handsFreeAutoStart, Boolean(d.handsFreeAutoStart)),
    themeMode: pickEnum(input.themeMode, VALID_THEME_MODES, d.themeMode),
    fontSizeScale: pickNumber(input.fontSizeScale, d.fontSizeScale ?? 110, 85, 135, 5),
    studyViewMode: pickEnum(input.studyViewMode, VALID_STUDY_VIEW_MODES, d.studyViewMode),
    showConnectedSpeech: pickBoolean(input.showConnectedSpeech, d.showConnectedSpeech),
    dailyGoalSentences: Math.round(
      pickNumber(input.dailyGoalSentences, d.dailyGoalSentences, 1, 50)
    ),
    practiceDaysGoal: Math.round(
      pickNumber(input.practiceDaysGoal, d.practiceDaysGoal ?? 14, 1, 60)
    )
  };
}
