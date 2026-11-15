export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface Sentence {
  en: string;
  pt: string;
  cefrLevel?: CefrLevel;
  actTitle?: string;
  grammarRule?: string;
}

export interface SentenceProgress {
  completed: boolean;
  bestScore: number;
  attempts: number;
  lastPracticed?: string;
}

export type BookLengthCategory = 'Pequeno' | 'Médio' | 'Grande';

export type BookDifficultyLabel =
  | 'Iniciante'
  | 'Básico'
  | 'Intermediário'
  | 'Avançado'
  | 'Fluente'
  | 'Progressivo A1→C1';

export interface Book {
  id: string;
  title: string;
  author: string;
  sentences: Sentence[];
  cefrLevel?: CefrLevel;
  difficultyLabel?: BookDifficultyLabel;
  lengthCategory?: BookLengthCategory;
  contextTag?: string;
  isProgressiveMasterpiece?: boolean;
  currentIndex?: number;
  totalSentences?: number;
  lastRead?: string;
  progressPercent?: number;
  sentenceProgress?: Record<number, SentenceProgress>;
}

export interface WordEntry {
  pt: string;
  pos: string;
  ipa: string;
  def: string;
}

export interface WordInfo extends WordEntry {
  word: string;
}

export interface VocabItem {
  word: string;
  sentence: string;
  date: string;
  // SRS (Spaced Repetition System - SM-2) fields
  interval?: number; // in days (0 = due today / learning)
  repetition?: number;
  efactor?: number;
  nextReviewDate?: string; // ISO string
  lastQuality?: 2 | 4 | 5; // 2 = Difícil, 4 = Bom, 5 = Fácil
}

export type TtsEngine = 'gemini_tts' | 'auto' | 'browser_custom' | 'online';

export type SttProvider = 'hybrid_ai' | 'web_speech' | 'gemini_stt';

export type GeminiVoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export type GeminiVoiceStyle =
  | 'clear_teacher'
  | 'audiobook'
  | 'conversational'
  | 'slow_learner';

export type SttSilencePauseMode = 'short' | 'normal' | 'long';

export type SttStrictnessMode = 'forgiving' | 'balanced' | 'strict';

export interface AiPronunciationFeedback {
  transcript: string;
  pronunciationScore: number;
  fluencyScore: number;
  prosodyScore: number;
  coachTipPt: string;
  focusWords: string[];
  providerUsed: string;
}

export type VisualCardType = 'pt' | 'en' | 'literal';

export type StudyStepCardType =
  | 'pt'
  | 'en'
  | 'en_slow'
  | 'literal'
  | 'speak'
  | 'speak_blind_en'
  | 'speak_challenge'
  | 'challenges'
  | 'challenge_pronunciation'
  | 'challenge_matching';

export type AudioFlow =
  | 'challenge'
  | 'pt_first'
  | 'en_first'
  | 'sandwich'
  | 'blind_en'
  | 'custom';

export type ThemeMode = 'dark' | 'light' | 'sepia' | 'forest' | 'ocean' | 'amethyst';

export type StudyViewMode = 'cards' | 'paragraph';

export type EnginePhase =
  | 'IDLE'
  | 'PLAYING_PT'
  | 'PLAYING_EN'
  | 'LISTENING_USER'
  | 'EVALUATING'
  | 'WORD_REVIEW'
  | 'PAUSED'
  | 'COMPLETED';

export type HandsFreeChallengeMode = 'voice_all' | 'pronunciation_only' | 'auto_review';

export interface PedagogicalSettings {
  ttsEngine: TtsEngine;
  preferredVoiceEnUri?: string;
  preferredVoicePtUri?: string;
  geminiVoiceName?: GeminiVoiceName;
  geminiVoiceStyle?: GeminiVoiceStyle;
  ttsCacheEnabled?: boolean;
  sttProvider?: SttProvider;
  sttSilencePauseMode?: SttSilencePauseMode;
  sttStrictness?: SttStrictnessMode;
  enableAiPronunciationCoach?: boolean;
  micNoiseSuppression?: boolean;
  audioFlow: AudioFlow;
  cardSequence: StudyStepCardType[];
  visualCardOrder: VisualCardType[];
  enableBlindSpeakingStage: boolean;
  blindMaxErrorsBeforeReveal: number;
  blindSpeakingOnFullSentence?: boolean;
  repeatOnError: boolean;
  slowdownOnError: boolean;
  readWordsOnSuccess: boolean;
  enablePostSentenceChallenges: boolean;
  enableWordPronunciationChallenge: boolean;
  enableWordMatchingChallenge: boolean;
  repeatSentenceOnChallengeFail: boolean;
  threshold: number;
  ttsSpeedEn: number;
  ttsSpeedPt: number;
  audioBeeps: boolean;
  autoHandsFree: boolean;
  handsFreeMaxAttempts?: number;
  handsFreeChallengeMode?: HandsFreeChallengeMode;
  handsFreeVoiceCommands?: boolean;
  handsFreeAutoStart?: boolean;
  themeMode: ThemeMode;
  fontSizeScale?: number;
  studyViewMode: StudyViewMode;
  showConnectedSpeech: boolean;
  dailyGoalSentences: number;
  practiceDaysGoal?: number;
}

export interface WordMatchResult {
  word: string;
  matched: boolean;
}

export interface EvaluationResult {
  score: number;
  wordResults: WordMatchResult[];
  matchedCount: number;
  totalWords: number;
}

export interface PhoneticTip {
  word: string;
  category: string;
  tip: string;
  ipaHint?: string;
}

export interface ProsodyChunk {
  text: string;
  displayWithLinks: string;
  words: string[];
}

export interface DailyStatEntry {
  dateKey: string; // YYYY-MM-DD
  sentencesPracticed: number;
  totalScoreSum: number;
  evaluationsCount: number;
}

export interface StudyStats {
  totalSentencesCompleted: number;
  bestStreak: number;
  masteredWords: string[]; // unique lowercase English words pronounced accurately
  trickyWords: Record<string, number>; // word -> error count
  dailyHistory: Record<string, DailyStatEntry>; // YYYY-MM-DD -> entry
}
