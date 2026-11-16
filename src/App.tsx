import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DictionaryModal } from './components/DictionaryModal';
import { DonateCoffeeModal, CoffeeCupIcon } from './components/DonateCoffeeModal';
import {
  DrivePendingConfirmation,
  DriveSyncUiStatus,
  GoogleDriveSyncModal
} from './components/GoogleDriveSyncModal';
import { HeaderBar } from './components/HeaderBar';
import { LibraryModal } from './components/LibraryModal';
import {
  BookCompletedModal,
  FallbackSpeechModal,
  PocketModeOverlay
} from './components/OverlaysAndModals';
import { PostSentenceChallengeModal } from './components/PostSentenceChallengeModal';
import { SentenceNavigatorModal } from './components/SentenceNavigatorModal';
import { SettingsModal, SettingsTabId } from './components/SettingsModal';
import { StatsModal } from './components/StatsModal';
import { VocabModal } from './components/VocabModal';
import { SAMPLE_BOOKS } from './data/dictionaryDb';
import {
  cancelBackgroundSentencePrefetch,
  evaluateAudioWithCloudStt,
  fetchSentenceTranslation,
  getAudioCancelGeneration,
  getWordInfo,
  playChime,
  prepareNextSentenceResources,
  resolveWordTranslation,
  speakTextUniversal,
  stopAllAudioPlayback,
  unlockAudioSession
} from './services/audioAndTranslationService';
import {
  deleteAppDataBackup,
  downloadAppDataBackup,
  DriveRemoteFileMeta,
  DriveRedirectStartedError,
  DriveSyncUserInfo,
  DriveUnauthorizedError,
  FIREBASE_AUTH_SETTINGS_URL,
  findAppDataBackupFile,
  getInMemoryDriveAccessToken,
  initDriveAuth,
  signInWithGoogleForDrive,
  signOutFromGoogleDrive,
  upsertAppDataBackup
} from './services/googleDriveSyncService';
import { ShadowRepository } from './services/storageService';
import { describeDriveAuthError } from './utils/driveApiErrors';
import {
  classifySyncDecision,
  computeSnapshotFingerprint,
  DriveBackupSnapshot,
  mergeDriveSnapshots,
  SnapshotSummary,
  summarizeSnapshot
} from './utils/driveSync';
import {
  AiPronunciationFeedback,
  Book,
  EnginePhase,
  PedagogicalSettings,
  Sentence,
  SentenceProgress,
  StudyStats,
  StudyStepCardType,
  ThemeMode,
  VisualCardType,
  VocabItem,
  WordMatchResult
} from './types/shadowreader';
import {
  STEP_CARD_META,
  buildEffectiveCardSequence,
  findRestartSeqIdxBeforeBlind,
  formatCardSequenceSummary,
  isChallengeStepCard,
  isSpeakStepCard
} from './utils/cardSequencePresets';
import { normalizeEnglishChallengeToken } from './utils/matchingPairs';
import {
  calculateSimilarity,
  calculateSrsNextReview,
  classifySentenceCefr,
  cleanSpeech,
  cleanString,
  detectHandsFreeVoiceCommand,
  generateInstantPhoneticCoachFeedback,
  getSentencePhoneticTips,
  getSpeakableWord,
  isVocabDueForReview,
  isWordMatch,
  normalizeSpokenTranscriptNumbers,
  splitIntoProsodyChunks,
  splitSentenceIntoStudySteps
} from './utils/shadowing';
import {
  computeDeadlineExtensionMs,
  computeSpeechCaptureTimingPlan,
  evaluateRecognitionOnEnd,
  mergeTranscriptWithPrefix
} from './utils/speechCaptureTiming';
import {
  ChallengeOutcome,
  resolveChallengeResolution,
  resolveLoopButtonMode,
  resolveLoopInterruptionPlan,
  resolveStepChipClickBehavior,
  shouldContinueAsyncStep
} from './utils/studyFlowLifecycle';
import { resolveSpeakErrorFeedbackPlan } from './utils/voiceCompatibility';
import {
  extractCumulativeTranscriptFromResults,
  MobileStagePanel,
  resolveDynamicViewportHeightPx,
  resolveMobileVisibleCards,
  shouldUseConcurrentMediaRecorder
} from './utils/mobileHelpers';

interface CardAudioButtonProps {
  id: string;
  label: string;
  stopLabel?: string;
  isPlaying: boolean;
  disabled?: boolean;
  title: string;
  ariaLabel?: string;
  onClick: () => void;
}

function CardAudioButton({
  id,
  label,
  stopLabel = 'Parar',
  isPlaying,
  disabled = false,
  title,
  ariaLabel,
  onClick
}: CardAudioButtonProps) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || (isPlaying ? stopLabel : label)}
      title={title}
      className={`min-h-[36px] sm:min-h-0 text-[10px] font-semibold px-2.5 py-1.5 sm:py-1 rounded-md border transition flex items-center gap-1.5 whitespace-nowrap shadow-xs ${
        disabled
          ? 'bg-slate-900/40 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
          : isPlaying
            ? 'bg-amber-500/25 border-amber-400 text-amber-200 cursor-pointer'
            : 'bg-slate-900/80 hover:bg-slate-700/90 border-slate-700 text-slate-200 hover:text-white cursor-pointer'
      }`}
    >
      {isPlaying ? (
        <>
          <svg className="w-3 h-3 text-amber-300 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1.5" />
          </svg>
          <span>{stopLabel}</span>
        </>
      ) : (
        <>
          <svg
            className="w-3.5 h-3.5 text-brand-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

export default function App() {
  // Active Book & Sentences State
  const [currentBookId, setCurrentBookId] = useState<string>(SAMPLE_BOOKS[0].id);
  const [currentBookTitle, setCurrentBookTitle] = useState<string>(SAMPLE_BOOKS[0].title);
  const [sentences, setSentences] = useState<Sentence[]>([...SAMPLE_BOOKS[0].sentences]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [sentenceProgress, setSentenceProgress] = useState<Record<number, SentenceProgress>>({});

  // Saved Books, Vocabulary & Study Stats State (via ShadowRepository)
  const [savedBooks, setSavedBooks] = useState<Book[]>([]);
  const [savedVocab, setSavedVocab] = useState<VocabItem[]>(() => ShadowRepository.vocab.load());
  const [studyStats, setStudyStats] = useState<StudyStats>(() => ShadowRepository.stats.load());

  // Pedagogical Settings State
  const [settings, setSettings] = useState<PedagogicalSettings>(() =>
    ShadowRepository.settings.load()
  );

  // Finite State Machine (FSM) for Shadowing Engine
  const [enginePhase, setEnginePhase] = useState<EnginePhase>('IDLE');
  const [isPlayingLoop, setIsPlayingLoop] = useState<boolean>(false);
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);
  const [isSpeakingTTS, setIsSpeakingTTS] = useState<boolean>(false);
  const [audioWaveLabel, setAudioWaveLabel] = useState<string>('Lendo...');
  const [activeCardHighlight, setActiveCardHighlight] = useState<'pt' | 'en' | null>(null);
  const [highlightedWordIdx, setHighlightedWordIdx] = useState<number | null>(null);
  const [isReadingWords, setIsReadingWords] = useState<boolean>(false);
  const [activeManualAudio, setActiveManualAudio] = useState<
    'pt' | 'en' | 'en_slow' | 'step' | null
  >(null);

  // Real-time Microphone Spectrum Level & Recorded User Voice Blob
  const [lastUserAudioUrl, setLastUserAudioUrl] = useState<string | null>(null);
  const [isPlayingUserAudio, setIsPlayingUserAudio] = useState<boolean>(false);
  // Level meter is written straight to the DOM from the analyser interval:
  // feeding it through React state re-rendered the whole App at ~11 Hz.
  const micLevelBarRef = useRef<HTMLDivElement | null>(null);

  // Challenge Mode, Blind Speaking Stage & Evaluation Feedback State
  const [challengeUnlocked, setChallengeUnlocked] = useState<boolean>(false);
  const [blindEnglishUnlocked, setBlindEnglishUnlocked] = useState<boolean>(false);
  const [isBlindStageActive, setIsBlindStageActive] = useState<boolean>(false);
  const [blindErrorCount, setBlindErrorCount] = useState<number>(0);
  const [activeSequenceStepIdx, setActiveSequenceStepIdx] = useState<number | null>(null);
  const [pausedResumeSeqIdx, setPausedResumeSeqIdx] = useState<number | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [stateBadgeText, setStateBadgeText] = useState<string>('Pronto');
  const [stateBadgeColor, setStateBadgeColor] = useState<string>('text-slate-300');
  const [bookmarkSaving, setBookmarkSaving] = useState<boolean>(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean>(false);

  // Live Speech Feedback State
  const [userTranscript, setUserTranscript] = useState<string>(
    'Pressione "Iniciar Treino" para começar.'
  );
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [wordResults, setWordResults] = useState<WordMatchResult[]>([]);
  const [aiCoachFeedback, setAiCoachFeedback] = useState<AiPronunciationFeedback | null>(null);

  // Step-by-Step (Sub-clause) State for Long Sentences
  const [isStepByStepMode, setIsStepByStepMode] = useState<boolean>(true);
  const [showStepHowItWorks, setShowStepHowItWorks] = useState<boolean>(false);
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);
  const [completedStepIndices, setCompletedStepIndices] = useState<number[]>([]);

  // Modals & Overlays State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabId>('models');
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isVocabOpen, setIsVocabOpen] = useState<boolean>(false);
  const [isStatsOpen, setIsStatsOpen] = useState<boolean>(false);
  const [isSentenceNavOpen, setIsSentenceNavOpen] = useState<boolean>(false);
  const [isPocketMode, setIsPocketMode] = useState<boolean>(false);
  const [isBookCompletedOpen, setIsBookCompletedOpen] = useState<boolean>(false);
  const [isDonateModalOpen, setIsDonateModalOpen] = useState<boolean>(false);
  const [isDriveSyncModalOpen, setIsDriveSyncModalOpen] = useState<boolean>(false);
  const [driveUser, setDriveUser] = useState<DriveSyncUserInfo | null>(null);
  const [hasDriveToken, setHasDriveToken] = useState<boolean>(false);
  const [driveSyncStatus, setDriveSyncStatus] = useState<DriveSyncUiStatus>('disconnected');
  const [driveSyncError, setDriveSyncError] = useState<string | null>(null);
  const [driveAuthHelpUrl, setDriveAuthHelpUrl] = useState<string | null>(null);
  const [driveLastSyncedAt, setDriveLastSyncedAt] = useState<string | null>(null);
  const [driveRemoteFileMeta, setDriveRemoteFileMeta] = useState<DriveRemoteFileMeta | null>(null);
  const [drivePendingConfirmation, setDrivePendingConfirmation] =
    useState<DrivePendingConfirmation | null>(null);
  const [driveLocalSummary, setDriveLocalSummary] = useState<SnapshotSummary | null>(null);
  const [dictWord, setDictWord] = useState<{ word: string; context: string } | null>(null);
  const [fallbackSpeechRequest, setFallbackSpeechRequest] = useState<{
    target: string;
    resolve: (val: string) => void;
  } | null>(null);
  const [postSentenceChallengeRequest, setPostSentenceChallengeRequest] = useState<{
    sentenceEn: string;
    sentenceIndex: number;
    enablePronunciation: boolean;
    enableMatching: boolean;
    wordMistakes?: Record<string, number>;
    resolve: (outcome: ChallengeOutcome) => void;
  } | null>(null);

  // Dynamic Word Translations Trigger
  const [, setWordTranslationTick] = useState<number>(0);
  const [translatingSentence, setTranslatingSentence] = useState<boolean>(false);

  // Toast Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Mobile Viewport & Focused Stage Card Navigation (prevents vertical page scrolling on phones)
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [mobileSelectedPanel, setMobileSelectedPanel] = useState<MobileStagePanel>('en');

  // Page Mode (Modo Página) Staged Pagination & Incremental Loading for Large Books
  const [pageStageSize, setPageStageSize] = useState<number>(8);
  const [extraLoadedStagesCount, setExtraLoadedStagesCount] = useState<number>(0);
  const pageSentencesScrollRef = useRef<HTMLDivElement | null>(null);

  // Mutable Refs for Async Shadowing Loop & Cancellation Token
  const activeStepTokenRef = useRef<number>(0);
  const isPlayingLoopRef = useRef<boolean>(false);
  const sentencesRef = useRef<Sentence[]>(sentences);
  const currentIndexRef = useRef<number>(currentIndex);
  const settingsRef = useRef<PedagogicalSettings>(settings);
  const streakRef = useRef<number>(streak);
  const recognitionRef = useRef<any>(null);
  const finishSpeechEarlyRef = useRef<(() => void) | null>(null);
  const abortSpeechCaptureRef = useRef<(() => void) | null>(null);
  const abortFallbackSpeechRef = useRef<(() => void) | null>(null);
  const wakeLockSentinelRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const analyserIntervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const captureGenerationRef = useRef<number>(0);
  const pendingChallengeResolveRef = useRef<((outcome: ChallengeOutcome) => void) | null>(null);
  const isSessionRestoredRef = useRef<boolean>(false);
  const userAudioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const isStepByStepModeRef = useRef<boolean>(isStepByStepMode);
  const activeStepIdxRef = useRef<number>(activeStepIdx);
  const completedChallengeIndicesRef = useRef<Set<number>>(new Set());
  const skipWordReviewRef = useRef<boolean>(false);
  const isManualWordReviewRef = useRef<boolean>(false);
  const isPostSuccessWordReviewRef = useRef<boolean>(false);
  const abortWordReviewRef = useRef<(() => void) | null>(null);
  const isBlindStageActiveRef = useRef<boolean>(false);
  const blindErrorCountRef = useRef<number>(0);
  const manualSpeakStageIdxRef = useRef<number>(0);
  const lastInputWasSimulatorRef = useRef<boolean>(false);
  const fallbackCancelledByUserRef = useRef<boolean>(false);
  const lastUserAudioBlobRef = useRef<Blob | null>(null);
  const sentenceWordMistakeCountsRef = useRef<Record<number, Record<string, number>>>({});
  const activeSequenceStepIdxRef = useRef<number | null>(null);
  const pausedResumeSeqIdxRef = useRef<number | null>(null);
  const driveRemoteSnapshotRef = useRef<DriveBackupSnapshot | null>(null);
  const driveAutoSyncArmedRef = useRef<boolean>(false);
  const driveSyncInFlightRef = useRef<boolean>(false);
  const driveAutoSyncTimerRef = useRef<number | null>(null);
  const isApplyingDriveRestoreRef = useRef<boolean>(false);
  const driveRemoteFileIdRef = useRef<string | null>(null);
  const reconcileWithGoogleDriveRef = useRef<
    ((accessToken: string, userInitiated?: boolean) => Promise<void>) | null
  >(null);
  const sentenceProgressRef = useRef<Record<number, SentenceProgress>>(sentenceProgress);
  const studyStatsRef = useRef<StudyStats>(studyStats);
  const savedVocabRef = useRef<VocabItem[]>(savedVocab);

  useEffect(() => {
    activeSequenceStepIdxRef.current = activeSequenceStepIdx;
  }, [activeSequenceStepIdx]);

  useEffect(() => {
    sentencesRef.current = sentences;
  }, [sentences]);

  // O prefetch do Modo Página traduz e colapsa a paginação, recriando `sentences`.
  // Zerar as etapas extras a cada mudança apagava as páginas já carregadas; o
  // contador só deve voltar ao início quando o livro muda.
  useEffect(() => {
    setExtraLoadedStagesCount(0);
  }, [currentBookId]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
    if (settingsRef.current.studyViewMode === 'paragraph' && pageSentencesScrollRef.current) {
      const activeEl = pageSentencesScrollRef.current.querySelector(
        `[data-page-sentence-idx="${currentIndex}"]`
      );
      if (activeEl && typeof (activeEl as HTMLElement).scrollIntoView === 'function') {
        (activeEl as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [currentIndex]);

  useEffect(() => {
    if (!isMobileViewport || activeSequenceStepIdx === null) return;
    const chipEl = document.getElementById(`btnStepOrderChip_${activeSequenceStepIdx}`);
    if (chipEl) {
      chipEl.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }, [activeSequenceStepIdx, isMobileViewport]);

  useEffect(() => {
    settingsRef.current = settings;
    const scale = Math.min(135, Math.max(85, Number(settings.fontSizeScale) || 110));
    document.documentElement.style.setProperty('--app-font-scale', (scale / 100).toFixed(2));
    document.documentElement.dataset.fontScale = String(scale);
  }, [settings]);

  // Mirror refs so async handlers can compute the next value outside setState
  // updaters (no storage writes inside an updater).
  useEffect(() => {
    sentenceProgressRef.current = sentenceProgress;
  }, [sentenceProgress]);

  useEffect(() => {
    studyStatsRef.current = studyStats;
  }, [studyStats]);

  useEffect(() => {
    savedVocabRef.current = savedVocab;
  }, [savedVocab]);

  useEffect(() => {
    streakRef.current = streak;
  }, [streak]);

  useEffect(() => {
    isStepByStepModeRef.current = isStepByStepMode;
  }, [isStepByStepMode]);

  useEffect(() => {
    activeStepIdxRef.current = activeStepIdx;
  }, [activeStepIdx]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');

    const syncViewport = () => {
      setIsMobileViewport(mq.matches);

      const activeEl = document.activeElement as HTMLElement | null;
      const activeTag = activeEl?.tagName || '';
      const activeInputType =
        activeTag === 'INPUT' ? ((activeEl as HTMLInputElement).type || 'text').toLowerCase() : '';
      const isTextInputFocused =
        activeTag === 'TEXTAREA' ||
        activeEl?.isContentEditable === true ||
        (activeTag === 'INPUT' &&
          !['checkbox', 'radio', 'range', 'button', 'submit', 'file'].includes(activeInputType));

      const heightPx = resolveDynamicViewportHeightPx({
        innerHeight: window.innerHeight,
        visualViewportHeight: window.visualViewport?.height,
        visualViewportScale: window.visualViewport?.scale,
        isTextInputFocused
      });

      if (heightPx) {
        document.documentElement.style.setProperty('--app-dvh', `${heightPx}px`);
      }
    };

    syncViewport();
    const rafId = window.requestAnimationFrame(syncViewport);
    const t1 = window.setTimeout(syncViewport, 150);
    const t2 = window.setTimeout(syncViewport, 500);

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', syncViewport);
    }
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    window.addEventListener('pageshow', syncViewport);
    window.visualViewport?.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('scroll', syncViewport);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (typeof mq.removeEventListener === 'function') {
        mq.removeEventListener('change', syncViewport);
      }
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      window.removeEventListener('pageshow', syncViewport);
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  }, []);

  const refreshSavedBooksList = useCallback(async () => {
    const list = await ShadowRepository.books.listAll();
    setSavedBooks(list);
  }, []);

  const exportCurrentDriveSnapshot = useCallback(async (): Promise<DriveBackupSnapshot> => {
    const snap = await ShadowRepository.driveBackup.exportLocalSnapshot({
      activeBookId: currentBookId,
      settings,
      vocab: savedVocab,
      stats: studyStats
    });
    const activeTotal = sentences.length || 1;
    const validCurIdx = Math.max(0, Math.min(currentIndex, activeTotal - 1));
    const existingIdx = snap.books.findIndex(b => b.id === currentBookId);
    const liveBookRecord: Book = {
      ...(existingIdx >= 0 ? snap.books[existingIdx] : {}),
      id: currentBookId,
      title: currentBookTitle,
      author:
        existingIdx >= 0
          ? snap.books[existingIdx].author
          : 'Teacher Reader',
      sentences,
      totalSentences: activeTotal,
      currentIndex: validCurIdx,
      progressPercent: Math.round(((validCurIdx + 1) / activeTotal) * 100),
      lastRead: new Date().toISOString(),
      sentenceProgress
    };
    const nextBooks = [...snap.books];
    if (existingIdx >= 0) {
      nextBooks[existingIdx] = liveBookRecord;
    } else {
      nextBooks.unshift(liveBookRecord);
    }
    return {
      ...snap,
      activeBookId: currentBookId,
      bookmarks: {
        ...snap.bookmarks,
        [currentBookId]: validCurIdx
      },
      books: nextBooks
    };
  }, [
    currentBookId,
    currentBookTitle,
    currentIndex,
    savedVocab,
    sentenceProgress,
    sentences,
    settings,
    studyStats
  ]);

  const applySnapshotToAppState = useCallback(
    async (snapshot: DriveBackupSnapshot) => {
      isApplyingDriveRestoreRef.current = true;
      try {
        await ShadowRepository.driveBackup.applySnapshotLocally(snapshot);
        setSettings(snapshot.settings);
        settingsRef.current = snapshot.settings;
        setSavedVocab(snapshot.vocab);
        setStudyStats(snapshot.stats);
        await refreshSavedBooksList();

        const targetBookId = snapshot.activeBookId || SAMPLE_BOOKS[0].id;
        const dbBook = snapshot.books.find(b => b.id === targetBookId);
        const sampleMatch = SAMPLE_BOOKS.find(sb => sb.id === targetBookId);

        if (dbBook && dbBook.sentences.length > 0) {
          const mergedSentences = sampleMatch
            ? dbBook.sentences.map((s, idx) => ({
                ...sampleMatch.sentences[idx],
                ...s,
                cefrLevel: s.cefrLevel || sampleMatch.sentences[idx]?.cefrLevel,
                actTitle: s.actTitle || sampleMatch.sentences[idx]?.actTitle,
                grammarRule: s.grammarRule || sampleMatch.sentences[idx]?.grammarRule
              }))
            : dbBook.sentences;
          const bookmarkIdx = snapshot.bookmarks[targetBookId] ?? dbBook.currentIndex ?? 0;
          const validIdx = Math.max(0, Math.min(bookmarkIdx, mergedSentences.length - 1));
          setCurrentBookId(dbBook.id);
          setCurrentBookTitle(sampleMatch ? sampleMatch.title : dbBook.title);
          setSentences(mergedSentences);
          setCurrentIndex(validIdx);
          currentIndexRef.current = validIdx;
          sentencesRef.current = mergedSentences;
          setSentenceProgress(dbBook.sentenceProgress || {});
        } else if (sampleMatch) {
          const bookmarkIdx = snapshot.bookmarks[sampleMatch.id] ?? 0;
          const validIdx = Math.max(0, Math.min(bookmarkIdx, sampleMatch.sentences.length - 1));
          setCurrentBookId(sampleMatch.id);
          setCurrentBookTitle(sampleMatch.title);
          setSentences([...sampleMatch.sentences]);
          setCurrentIndex(validIdx);
          currentIndexRef.current = validIdx;
          sentencesRef.current = [...sampleMatch.sentences];
          setSentenceProgress({});
        }
      } finally {
        window.setTimeout(() => {
          isApplyingDriveRestoreRef.current = false;
        }, 400);
      }
    },
    [refreshSavedBooksList]
  );

  const handleDriveApiError = useCallback((err: unknown) => {
    if (err instanceof DriveUnauthorizedError) {
      driveAutoSyncArmedRef.current = false;
      setHasDriveToken(false);
      setDriveSyncStatus('needs_reauth');
      setDriveSyncError('Sessão de sincronização expirada. Clique em Reconectar com Google.');
      return;
    }
    const msg = err instanceof Error ? err.message : 'Falha na sincronização com o Google Drive.';
    setDriveSyncStatus('error');
    setDriveSyncError(msg);
  }, []);

  const reconcileWithGoogleDrive = useCallback(
    async (accessToken: string, userInitiated = false) => {
      if (driveSyncInFlightRef.current) return;
      driveSyncInFlightRef.current = true;
      setDriveSyncError(null);
      setDriveSyncStatus('checking');

      try {
        const localSnap = await exportCurrentDriveSnapshot();
        const localSummary = summarizeSnapshot(localSnap);
        setDriveLocalSummary(localSummary);

        const remoteMeta = await findAppDataBackupFile(accessToken);
        driveRemoteFileIdRef.current = remoteMeta?.id || null;
        setDriveRemoteFileMeta(remoteMeta);

        let remoteSnap: DriveBackupSnapshot | null = null;
        if (remoteMeta) {
          remoteSnap = await downloadAppDataBackup(accessToken, remoteMeta.id);
        }
        driveRemoteSnapshotRef.current = remoteSnap;

        const decision = classifySyncDecision({
          local: localSnap,
          remote: remoteSnap,
          lastSyncedFingerprint: ShadowRepository.driveBackup.getLastSyncedFingerprint()
        });

        if (decision === 'no_op') {
          ShadowRepository.driveBackup.setLastSyncedFingerprint(
            computeSnapshotFingerprint(localSnap)
          );
          ShadowRepository.driveBackup.setAutoSyncOptIn(true);
          driveAutoSyncArmedRef.current = true;
          setDrivePendingConfirmation(null);
          setDriveSyncStatus('synced');
          setDriveLastSyncedAt(remoteMeta?.modifiedTime || new Date().toISOString());
          if (userInitiated) {
            showToast('Google Drive já está 100% sincronizado!');
          }
          return;
        }

        if (decision === 'pull_remote_auto' && remoteSnap) {
          await applySnapshotToAppState(remoteSnap);
          ShadowRepository.driveBackup.setLastSyncedFingerprint(
            computeSnapshotFingerprint(remoteSnap)
          );
          ShadowRepository.driveBackup.setAutoSyncOptIn(true);
          driveAutoSyncArmedRef.current = true;
          setDrivePendingConfirmation(null);
          setDriveSyncStatus('synced');
          setDriveLastSyncedAt(remoteMeta?.modifiedTime || new Date().toISOString());
          showToast('Livros e progresso restaurados do Google Drive!');
          return;
        }

        if (
          decision === 'push_local_auto' &&
          ShadowRepository.driveBackup.getAutoSyncOptIn() &&
          driveAutoSyncArmedRef.current
        ) {
          setDriveSyncStatus('syncing');
          const savedMeta = await upsertAppDataBackup(
            accessToken,
            localSnap,
            driveRemoteFileIdRef.current
          );
          driveRemoteFileIdRef.current = savedMeta.id;
          setDriveRemoteFileMeta(savedMeta);
          ShadowRepository.driveBackup.setLastSyncedFingerprint(
            computeSnapshotFingerprint(localSnap)
          );
          setDrivePendingConfirmation(null);
          setDriveSyncStatus('synced');
          setDriveLastSyncedAt(savedMeta.modifiedTime || new Date().toISOString());
          return;
        }

        // Needs explicit confirmation before creating a new Drive backup or overwriting divergent remote data
        setDriveSyncStatus('needs_confirmation');
        if (decision === 'needs_initial_upload_confirm' || !remoteSnap) {
          setDrivePendingConfirmation({
            kind: 'initial_upload',
            localSummary
          });
        } else {
          setDrivePendingConfirmation({
            kind: 'merge_or_overwrite',
            localSummary,
            remoteSummary: summarizeSnapshot(remoteSnap)
          });
        }
        setIsDriveSyncModalOpen(true);
      } catch (err) {
        handleDriveApiError(err);
      } finally {
        driveSyncInFlightRef.current = false;
      }
    },
    [applySnapshotToAppState, exportCurrentDriveSnapshot, handleDriveApiError, showToast]
  );

  const handleDriveSignIn = useCallback(async () => {
    setDriveSyncError(null);
    setDriveAuthHelpUrl(null);
    setDriveSyncStatus('checking');
    try {
      const { user, accessToken } = await signInWithGoogleForDrive();
      setDriveUser(user);
      setHasDriveToken(true);
      await reconcileWithGoogleDrive(accessToken, true);
    } catch (err) {
      if (err instanceof DriveRedirectStartedError) {
        setDriveSyncStatus('checking');
        showToast('Popup bloqueado pelo navegador. Abrindo o login do Google...');
        return;
      }
      if (err instanceof DriveUnauthorizedError) {
        handleDriveApiError(err);
        return;
      }
      const guidance = describeDriveAuthError(err, window.location.origin);
      setDriveSyncStatus(previous => (previous === 'needs_reauth' ? 'needs_reauth' : 'disconnected'));
      setDriveAuthHelpUrl(guidance.code ? FIREBASE_AUTH_SETTINGS_URL : null);
      setDriveSyncError(
        guidance.action ? `${guidance.message} ${guidance.action}` : guidance.message
      );
    }
  }, [handleDriveApiError, reconcileWithGoogleDrive, showToast]);

  const handleDriveSignOut = useCallback(async () => {
    driveAutoSyncArmedRef.current = false;
    if (driveAutoSyncTimerRef.current) {
      window.clearTimeout(driveAutoSyncTimerRef.current);
      driveAutoSyncTimerRef.current = null;
    }
    ShadowRepository.driveBackup.setAutoSyncOptIn(false);
    await signOutFromGoogleDrive();
    setDriveUser(null);
    setHasDriveToken(false);
    setDriveSyncStatus('disconnected');
    setDriveSyncError(null);
    setDrivePendingConfirmation(null);
    setDriveRemoteFileMeta(null);
    driveRemoteFileIdRef.current = null;
    driveRemoteSnapshotRef.current = null;
    showToast('Conta Google desconectada. Seus dados continuam salvos localmente.');
  }, [showToast]);

  const handleConfirmInitialDriveUpload = useCallback(async () => {
    const token = getInMemoryDriveAccessToken();
    if (!token) {
      setHasDriveToken(false);
      setDriveSyncStatus('needs_reauth');
      return;
    }
    setDriveSyncStatus('syncing');
    setDriveSyncError(null);
    try {
      const localSnap = await exportCurrentDriveSnapshot();
      const savedMeta = await upsertAppDataBackup(
        token,
        localSnap,
        driveRemoteFileIdRef.current
      );
      driveRemoteFileIdRef.current = savedMeta.id;
      setDriveRemoteFileMeta(savedMeta);
      ShadowRepository.driveBackup.setLastSyncedFingerprint(
        computeSnapshotFingerprint(localSnap)
      );
      ShadowRepository.driveBackup.setAutoSyncOptIn(true);
      driveAutoSyncArmedRef.current = true;
      setDrivePendingConfirmation(null);
      setDriveSyncStatus('synced');
      setDriveLastSyncedAt(savedMeta.modifiedTime || new Date().toISOString());
      showToast('Backup oculto ativado no Google Drive!');
    } catch (err) {
      handleDriveApiError(err);
    }
  }, [exportCurrentDriveSnapshot, handleDriveApiError, showToast]);

  const handleConfirmMergeDriveSync = useCallback(async () => {
    const token = getInMemoryDriveAccessToken();
    const remoteSnap = driveRemoteSnapshotRef.current;
    if (!token || !remoteSnap) return;
    setDriveSyncStatus('syncing');
    setDriveSyncError(null);
    try {
      const localSnap = await exportCurrentDriveSnapshot();
      const mergedSnap = mergeDriveSnapshots(localSnap, remoteSnap);
      await applySnapshotToAppState(mergedSnap);
      const savedMeta = await upsertAppDataBackup(
        token,
        mergedSnap,
        driveRemoteFileIdRef.current
      );
      driveRemoteFileIdRef.current = savedMeta.id;
      setDriveRemoteFileMeta(savedMeta);
      ShadowRepository.driveBackup.setLastSyncedFingerprint(
        computeSnapshotFingerprint(mergedSnap)
      );
      ShadowRepository.driveBackup.setAutoSyncOptIn(true);
      driveAutoSyncArmedRef.current = true;
      setDrivePendingConfirmation(null);
      setDriveSyncStatus('synced');
      setDriveLastSyncedAt(savedMeta.modifiedTime || new Date().toISOString());
      showToast('Dados mesclados e sincronização automática ativada!');
    } catch (err) {
      handleDriveApiError(err);
    }
  }, [applySnapshotToAppState, exportCurrentDriveSnapshot, handleDriveApiError, showToast]);

  const handleRestoreFromDriveOnly = useCallback(async () => {
    const remoteSnap = driveRemoteSnapshotRef.current;
    if (!remoteSnap) return;
    await applySnapshotToAppState(remoteSnap);
    ShadowRepository.driveBackup.setLastSyncedFingerprint(computeSnapshotFingerprint(remoteSnap));
    ShadowRepository.driveBackup.setAutoSyncOptIn(true);
    driveAutoSyncArmedRef.current = true;
    setDrivePendingConfirmation(null);
    setDriveSyncStatus('synced');
    setDriveLastSyncedAt(driveRemoteFileMeta?.modifiedTime || new Date().toISOString());
    showToast('Backup do Google Drive restaurado neste dispositivo!');
  }, [applySnapshotToAppState, driveRemoteFileMeta?.modifiedTime, showToast]);

  const handleDeleteRemoteDriveBackup = useCallback(async () => {
    const token = getInMemoryDriveAccessToken();
    const fileId = driveRemoteFileIdRef.current;
    if (!token || !fileId) return;
    setDriveSyncStatus('syncing');
    try {
      await deleteAppDataBackup(token, fileId);
      driveAutoSyncArmedRef.current = false;
      ShadowRepository.driveBackup.setAutoSyncOptIn(false);
      ShadowRepository.driveBackup.setLastSyncedFingerprint(null);
      driveRemoteFileIdRef.current = null;
      driveRemoteSnapshotRef.current = null;
      setDriveRemoteFileMeta(null);
      setDrivePendingConfirmation(null);
      setDriveLastSyncedAt(null);
      setDriveSyncStatus('disconnected');
      showToast('Backup na nuvem excluído. Dados locais preservados.');
    } catch (err) {
      handleDriveApiError(err);
    }
  }, [handleDriveApiError, showToast]);

  // Keep the latest reconcile implementation reachable from the auth listener
  // without making the listener re-subscribe on every sentence/settings change.
  useEffect(() => {
    reconcileWithGoogleDriveRef.current = reconcileWithGoogleDrive;
  }, [reconcileWithGoogleDrive]);

  // Monitor Firebase Auth state cleanly (in-memory token only)
  useEffect(() => {
    const unsubscribe = initDriveAuth(
      (user, accessToken) => {
        setDriveUser(user);
        setHasDriveToken(true);
        void reconcileWithGoogleDriveRef.current?.(accessToken, false);
      },
      signedInWithoutToken => {
        driveAutoSyncArmedRef.current = false;
        setHasDriveToken(false);
        if (signedInWithoutToken) {
          setDriveUser(signedInWithoutToken);
          setDriveSyncStatus('needs_reauth');
        } else {
          setDriveUser(null);
          setDriveSyncStatus('disconnected');
        }
      }
    );
    return unsubscribe;
  }, []);

  // Update local summary whenever modal opens
  useEffect(() => {
    if (!isDriveSyncModalOpen) return;
    exportCurrentDriveSnapshot().then(snap => {
      setDriveLocalSummary(summarizeSnapshot(snap));
    });
  }, [exportCurrentDriveSnapshot, isDriveSyncModalOpen]);

  // Invisible debounced auto-sync whenever books, bookmarks, vocab, stats, or settings change
  useEffect(() => {
    if (
      !hasDriveToken ||
      !driveAutoSyncArmedRef.current ||
      isApplyingDriveRestoreRef.current ||
      drivePendingConfirmation !== null
    ) {
      return;
    }

    if (driveAutoSyncTimerRef.current) {
      window.clearTimeout(driveAutoSyncTimerRef.current);
    }

    driveAutoSyncTimerRef.current = window.setTimeout(async () => {
      const token = getInMemoryDriveAccessToken();
      if (
        !token ||
        !driveAutoSyncArmedRef.current ||
        driveSyncInFlightRef.current ||
        isApplyingDriveRestoreRef.current
      ) {
        return;
      }

      try {
        const localSnap = await exportCurrentDriveSnapshot();
        const fp = computeSnapshotFingerprint(localSnap);
        const lastFp = ShadowRepository.driveBackup.getLastSyncedFingerprint();
        if (lastFp && fp === lastFp) {
          return;
        }

        driveSyncInFlightRef.current = true;
        setDriveSyncStatus('syncing');
        const savedMeta = await upsertAppDataBackup(
          token,
          localSnap,
          driveRemoteFileIdRef.current
        );
        driveRemoteFileIdRef.current = savedMeta.id;
        setDriveRemoteFileMeta(savedMeta);
        ShadowRepository.driveBackup.setLastSyncedFingerprint(fp);
        setDriveSyncStatus('synced');
        setDriveLastSyncedAt(savedMeta.modifiedTime || new Date().toISOString());
      } catch (err) {
        handleDriveApiError(err);
      } finally {
        driveSyncInFlightRef.current = false;
      }
    }, 1800);

    return () => {
      if (driveAutoSyncTimerRef.current) {
        window.clearTimeout(driveAutoSyncTimerRef.current);
        driveAutoSyncTimerRef.current = null;
      }
    };
  }, [
    currentBookId,
    currentIndex,
    drivePendingConfirmation,
    exportCurrentDriveSnapshot,
    handleDriveApiError,
    hasDriveToken,
    savedBooks,
    savedVocab,
    sentenceProgress,
    settings,
    studyStats
  ]);

  // Initial load: Restore active book session and check mic permission
  useEffect(() => {
    refreshSavedBooksList();
    let cancelled = false;
    isSessionRestoredRef.current = false;

    ShadowRepository.books
      .getActive()
      .then(book => {
        if (cancelled) return;
        if (book && book.sentences && book.sentences.length > 0) {
          const sampleMatch = SAMPLE_BOOKS.find(sb => sb.id === book.id);
          const mergedSentences = sampleMatch
            ? book.sentences.map((s, idx) => ({
                ...sampleMatch.sentences[idx],
                ...s,
                cefrLevel: s.cefrLevel || sampleMatch.sentences[idx]?.cefrLevel,
                actTitle: s.actTitle || sampleMatch.sentences[idx]?.actTitle,
                grammarRule: s.grammarRule || sampleMatch.sentences[idx]?.grammarRule
              }))
            : book.sentences;
          const validIdx = Math.max(
            0,
            Math.min(book.currentIndex || 0, mergedSentences.length - 1)
          );
          setCurrentBookId(book.id);
          setCurrentBookTitle(sampleMatch ? sampleMatch.title : book.title);
          setSentences(mergedSentences);
          setCurrentIndex(validIdx);
          setSentenceProgress(book.sentenceProgress || {});
          return;
        }

        // Only fall back to the demo book when there is really no active book.
        const masterBook = SAMPLE_BOOKS[0];
        setCurrentBookId(masterBook.id);
        setCurrentBookTitle(masterBook.title);
        setSentences([...masterBook.sentences]);
        setCurrentIndex(0);
        setSentenceProgress({});
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) isSessionRestoredRef.current = true;
      });

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then(status => {
          setMicPermissionGranted(status.state === 'granted');
          status.onchange = () => {
            setMicPermissionGranted(status.state === 'granted');
          };
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [refreshSavedBooksList]);

  const currentSentence = sentences[currentIndex] || sentences[0];

  // Ensure current sentence is translated & resolve literal word translations
  useEffect(() => {
    if (!currentSentence) return;

    // Do not write a bookmark with the demo book before the session restore
    // finishes: it used to poison sr_active_book_id on every reload.
    if (isSessionRestoredRef.current) {
      setBookmarkSaving(true);
      ShadowRepository.books.updateBookmark(currentBookId, currentIndex).then(() => {
        setBookmarkSaving(false);
        refreshSavedBooksList();
      });
    }

    if (!currentSentence.pt || currentSentence.pt.startsWith('[Tradução')) {
      setTranslatingSentence(true);
      fetchSentenceTranslation(currentSentence.en).then(translated => {
        setSentences(prev => {
          const next = [...prev];
          if (next[currentIndex]) {
            next[currentIndex] = { ...next[currentIndex], pt: translated };
          }
          return next;
        });
        setTranslatingSentence(false);
      });
    } else {
      setTranslatingSentence(false);
    }

    const tokens = currentSentence.en.split(/\s+/);
    tokens.forEach(token => {
      const clean = cleanString(token);
      if (!clean) return;
      const info = getWordInfo(clean);
      if (info.pt === '...') {
        resolveWordTranslation(clean).then(() => {
          setWordTranslationTick(t => t + 1);
        });
      }
    });
  }, [currentIndex, currentBookId, currentSentence?.en, refreshSavedBooksList]);

  // Background pre-generation: while the user is training the current sentence, silently prepare
  // the next sentence's Portuguese translation, literal word dictionary, sub-clauses, challenge words, and TTS audio.
  const nextSentenceEn = sentences[currentIndex + 1]?.en || '';
  const lookaheadSentenceEn = sentences[currentIndex + 2]?.en || '';
  const cardSequenceSignature = (settings.cardSequence || []).join(',');

  useEffect(() => {
    const curr = sentencesRef.current[currentIndex];
    if (!curr) return;
    const nextIdx = currentIndex + 1;
    const lookaheadIdx = currentIndex + 2;
    const nextItem = nextIdx < sentencesRef.current.length ? sentencesRef.current[nextIdx] : null;
    const lookaheadItem =
      lookaheadIdx < sentencesRef.current.length ? sentencesRef.current[lookaheadIdx] : null;

    // Brief 260ms stagger ensures the current sentence's foreground audio/translation always runs first
    const timer = window.setTimeout(() => {
      prepareNextSentenceResources({
        currentSentence: curr,
        nextSentence: nextItem,
        nextSentenceIndex: nextIdx,
        lookaheadSentence: lookaheadItem,
        lookaheadSentenceIndex: lookaheadIdx,
        settings: settingsRef.current,
        isStepByStepMode: isStepByStepModeRef.current,
        onSentenceTranslated: (targetIdx, translatedPt) => {
          setSentences(prev => {
            const existing = prev[targetIdx];
            if (!existing || (existing.pt && !existing.pt.startsWith('[Tradução'))) {
              return prev;
            }
            const next = [...prev];
            next[targetIdx] = { ...existing, pt: translatedPt };
            return next;
          });
        },
        onWordsResolved: () => {
          setWordTranslationTick(t => t + 1);
        }
      });
    }, 260);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    currentIndex,
    currentBookId,
    currentSentence?.en,
    nextSentenceEn,
    lookaheadSentenceEn,
    isStepByStepMode,
    settings.ttsEngine,
    settings.geminiVoiceName,
    settings.geminiVoiceStyle,
    settings.ttsCacheEnabled,
    settings.audioFlow,
    cardSequenceSignature
  ]);

  // Abort stale background prefetch when switching books or unmounting
  useEffect(() => {
    return () => {
      cancelBackgroundSentencePrefetch(true);
    };
  }, [currentBookId]);

  // Update settings helper
  const handleUpdateSettings = useCallback((partial: Partial<PedagogicalSettings>) => {
    // Compute outside the setState updater: React may call an updater more than
    // once, and persisting/DOM work inside it caused duplicated writes.
    const updated = { ...settingsRef.current, ...partial };
    settingsRef.current = updated;
    setSettings(updated);
    ShadowRepository.settings.save(updated);
    if (partial.audioFlow !== undefined || partial.cardSequence !== undefined) {
      setChallengeUnlocked(false);
      setBlindEnglishUnlocked(false);
      isBlindStageActiveRef.current = false;
      setIsBlindStageActive(false);
      blindErrorCountRef.current = 0;
      setBlindErrorCount(0);
      manualSpeakStageIdxRef.current = 0;
      pausedResumeSeqIdxRef.current = null;
      setPausedResumeSeqIdx(null);
      setLastScore(null);
      setWordResults([]);
    }
    if (partial.enableBlindSpeakingStage !== undefined) {
      manualSpeakStageIdxRef.current = 0;
      if (!partial.enableBlindSpeakingStage) {
        isBlindStageActiveRef.current = false;
        setIsBlindStageActive(false);
      } else {
        setLastScore(null);
        setWordResults([]);
      }
    }
  }, []);

  // Cycle Reading Theme (6 Themes: Escuro -> Claro -> Sépia -> Floresta -> Oceano -> Ametista)
  const handleCycleTheme = useCallback(() => {
    const order: ThemeMode[] = ['dark', 'light', 'sepia', 'forest', 'ocean', 'amethyst'];
    const current = order.includes(settings.themeMode) ? settings.themeMode : 'dark';
    const nextTheme = order[(order.indexOf(current) + 1) % order.length];
    handleUpdateSettings({ themeMode: nextTheme });
    const labels: Record<ThemeMode, string> = {
      dark: '🌙 Tema Escuro (Noturno)',
      light: '☀️ Tema Claro (Diurno)',
      sepia: '📜 Tema Sépia (Papel Antigo)',
      forest: '🌲 Tema Floresta (Esmeralda)',
      ocean: '🌊 Tema Oceano (Azul Profundo)',
      amethyst: '🔮 Tema Ametista (Violeta)'
    };
    showToast(labels[nextTheme]);
  }, [handleUpdateSettings, settings.themeMode, showToast]);

  // Stop MediaRecorder, Audio Spectrum Analyser and release the AudioContext.
  // Bumping the capture generation invalidates any getUserMedia() permission
  // prompt that is still pending, so a late grant can never leave the mic on.
  const stopVoiceRecordingAndAnalyser = useCallback(() => {
    captureGenerationRef.current += 1;
    if (analyserIntervalRef.current) {
      window.clearInterval(analyserIntervalRef.current);
      analyserIntervalRef.current = null;
    }
    if (micLevelBarRef.current) {
      micLevelBarRef.current.style.width = '18%';
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    try {
      analyserSourceRef.current?.disconnect();
    } catch {
      // ignore
    }
    try {
      analyserNodeRef.current?.disconnect();
    } catch {
      // ignore
    }
    analyserSourceRef.current = null;
    analyserNodeRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== 'closed') {
      void ctx.close().catch(() => {});
    }
  }, []);

  // Start capturing user's voice with MediaRecorder + Web Audio AnalyserNode
  const startVoiceRecordingAndAnalyser = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    // Never stack captures: release any previous stream/recorder first.
    stopVoiceRecordingAndAnalyser();
    const generation = captureGenerationRef.current;
    try {
      const useNoiseFilter = settingsRef.current.micNoiseSuppression ?? true;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: useNoiseFilter,
          noiseSuppression: useNoiseFilter,
          autoGainControl: useNoiseFilter
        }
      });

      // The capture may have been stopped/navigated away while the permission
      // prompt was open: drop the stream instead of assigning it.
      if (generation !== captureGenerationRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      micStreamRef.current = stream;

      // 1. Web Audio AnalyserNode for real-time volume meter
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserSourceRef.current = source;
        analyserNodeRef.current = analyser;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyserIntervalRef.current = window.setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const level = Math.min(100, Math.round((avg / 128) * 100));
          // Direct DOM write (no React state) keeps the App from re-rendering
          // on every 90 ms sample.
          if (micLevelBarRef.current) {
            micLevelBarRef.current.style.width = `${Math.max(18, level)}%`;
          }
        }, 90);
      }

      // 2. MediaRecorder for self-listening playback & AI pronunciation assessment
      if (typeof MediaRecorder !== 'undefined') {
        const chunks: BlobPart[] = [];
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = e => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            lastUserAudioBlobRef.current = blob;
            const url = URL.createObjectURL(blob);
            setLastUserAudioUrl(prev => {
              if (prev) URL.revokeObjectURL(prev);
              return url;
            });
          }
        };
        recorder.start();
      }
    } catch {
      // ignore if stream unavailable in sandbox
    }
  }, [stopVoiceRecordingAndAnalyser]);

  // Microphone permission request
  const requestMicrophonePermission = useCallback(
    async (interactive = true): Promise<boolean> => {
      if (micPermissionGranted) return true;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          setMicPermissionGranted(true);
          if (interactive) {
            showToast('🎤 Microfone liberado com sucesso!');
          }
          return true;
        } catch {
          setMicPermissionGranted(false);
          if (interactive) {
            showToast('Permita o microfone ou use a Entrada de Fala interativa.');
          }
          return false;
        }
      }
      return false;
    },
    [micPermissionGranted, showToast]
  );

  const stopUserVoicePlayback = useCallback(() => {
    if (userAudioPlaybackRef.current) {
      try {
        userAudioPlaybackRef.current.onended = null;
        userAudioPlaybackRef.current.onerror = null;
        userAudioPlaybackRef.current.pause();
        userAudioPlaybackRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      userAudioPlaybackRef.current = null;
    }
    setIsPlayingUserAudio(false);
  }, []);

  // Stop all audio, active word review, & speech recognition cleanly (zero zombie callbacks)
  const stopAllAudio = useCallback(() => {
    activeStepTokenRef.current += 1;
    if (abortWordReviewRef.current) {
      const abortFn = abortWordReviewRef.current;
      abortWordReviewRef.current = null;
      abortFn();
    }
    if (abortSpeechCaptureRef.current) {
      const abortMicFn = abortSpeechCaptureRef.current;
      abortSpeechCaptureRef.current = null;
      abortMicFn();
    }
    if (abortFallbackSpeechRef.current) {
      const abortFallbackFn = abortFallbackSpeechRef.current;
      abortFallbackSpeechRef.current = null;
      abortFallbackFn();
    }
    stopAllAudioPlayback();
    stopUserVoicePlayback();
    stopVoiceRecordingAndAnalyser();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    finishSpeechEarlyRef.current = null;
    setIsSpeakingTTS(false);
    setIsListeningMic(false);
    setActiveCardHighlight(null);
    setHighlightedWordIdx(null);
    setIsReadingWords(false);
    setActiveManualAudio(null);
  }, [stopUserVoicePlayback, stopVoiceRecordingAndAnalyser]);

  // Speak text wrapper
  const speakText = useCallback(
    async (text: string, lang = 'en-US', speedMultiplier = 1.0): Promise<boolean> => {
      setIsSpeakingTTS(true);
      const isPt = lang.startsWith('pt');
      setEnginePhase(isPt ? 'PLAYING_PT' : 'PLAYING_EN');
      setAudioWaveLabel(isPt ? 'Lendo em português...' : 'Lendo em inglês...');
      setStateBadgeText(isPt ? 'Ouvindo tradução...' : 'Ouvindo leitura...');
      setStateBadgeColor('text-indigo-300');

      const curSettings = settingsRef.current;
      const expectedGen = getAudioCancelGeneration() + 1;
      const ok = await speakTextUniversal(
        text,
        lang,
        curSettings.ttsEngine,
        curSettings.ttsSpeedEn,
        curSettings.ttsSpeedPt,
        speedMultiplier,
        {
          preferredVoiceEnUri: curSettings.preferredVoiceEnUri,
          preferredVoicePtUri: curSettings.preferredVoicePtUri,
          geminiVoiceName: curSettings.geminiVoiceName,
          geminiVoiceStyle: curSettings.geminiVoiceStyle,
          ttsCacheEnabled: curSettings.ttsCacheEnabled
        }
      );

      if (getAudioCancelGeneration() === expectedGen) {
        setIsSpeakingTTS(false);
      }
      return ok;
    },
    []
  );

  // Speech recognition / Fallback input promise
  const listenForSpeech = useCallback(
    (
      targetSentence: string,
      maxTimeoutMs = 19000,
      singleWordChallenge = false
    ): Promise<string> => {
      return new Promise(resolve => {
        const SpeechRecognitionClass =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognitionClass) {
          // Hands-Free must never fill in the target text by itself: without speech
          // recognition we report "no speech" so the engine keeps the exercise open
          // (retry / model pronunciation) instead of marking it as solved.
          if (settingsRef.current.autoHandsFree) {
            resolve('');
            return;
          }
          let settledFallback = false;
          const finishFallback = (val: string) => {
            if (settledFallback) return;
            settledFallback = true;
            abortFallbackSpeechRef.current = null;
            setFallbackSpeechRequest(null);
            resolve(val);
          };
          abortFallbackSpeechRef.current = () => {
            fallbackCancelledByUserRef.current = false;
            finishFallback('');
          };
          setFallbackSpeechRequest({
            target: targetSentence,
            resolve: (val: string) => finishFallback(val)
          });
          return;
        }

        // Stop any active TTS playback so speaker audio never interferes with mic capture
        stopAllAudioPlayback();

        // Cleanly abort any previous SpeechRecognition session so stale onend events never resolve the new session early
        if (abortSpeechCaptureRef.current) {
          const prevAbort = abortSpeechCaptureRef.current;
          abortSpeechCaptureRef.current = null;
          prevAbort();
        }
        if (recognitionRef.current) {
          try {
            recognitionRef.current.onstart = null;
            recognitionRef.current.onspeechstart = null;
            recognitionRef.current.onspeechend = null;
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onend = null;
            recognitionRef.current.abort();
          } catch {
            // ignore
          }
        }

        const recognition = new SpeechRecognitionClass();
        recognitionRef.current = recognition;

        const targetWords = cleanSpeech(targetSentence).split(/\s+/).filter(Boolean);
        const isSingleWord = singleWordChallenge || targetWords.length <= 2;
        const singleTargetClean = targetWords[0] || cleanString(targetSentence);

        playChime('your_turn', settingsRef.current.audioBeeps);
        setEnginePhase('LISTENING_USER');
        setIsListeningMic(true);
        setStateBadgeText(
          isSingleWord
            ? `Pronuncie "${targetSentence}"...`
            : 'Sua vez: fale a frase em inglês...'
        );
        setStateBadgeColor('text-emerald-300');
        setUserTranscript(
          isSingleWord
            ? `Ouvindo a palavra "${targetSentence}"...`
            : 'Ouvindo... Pode falar a frase em inglês com naturalidade.'
        );

        // Avoid opening getUserMedia/MediaRecorder concurrently during short single-word challenges
        // or on mobile touch devices where Android/iOS OS mic exclusivity throws audio-capture.
        const useConcurrentRecorder = shouldUseConcurrentMediaRecorder({ isSingleWord });
        let recorderActive = useConcurrentRecorder;
        let retriedWithoutRecorder = false;
        if (recorderActive) {
          startVoiceRecordingAndAnalyser();
        }

        const pauseMode = settingsRef.current.sttSilencePauseMode ?? 'normal';
        const strictness = settingsRef.current.sttStrictness ?? 'balanced';
        const timingPlan = computeSpeechCaptureTimingPlan({
          targetSentence,
          isSingleWord,
          pauseMode,
          autoHandsFree: Boolean(settingsRef.current.autoHandsFree),
          requestedMaxTimeoutMs: maxTimeoutMs
        });

        let committedPrefix = '';
        let lastSpokenText = '';
        let resolved = false;
        let hasCompletedFirstStart = false;
        let hasSpeechStarted = false;
        let isSpeechActive = false;
        let isFullMatchSettled = false;
        let lastSpeechActivityAt = 0;
        let lastResultAt = 0;
        let partialRestartCount = 0;
        let silenceDebounceTimer: number | null = null;
        let overallTimeoutTimer: number | null = null;
        let restartTimer: number | null = null;
        let handsFreeAutoFallbackTimer: number | null = null;
        let totalExtensionGrantedMs = 0;
        let deadlineTime =
          Date.now() + timingPlan.preSpeechWaitMs + timingPlan.startupSettleDelayMs;

        const clearRecognitionHandlers = () => {
          try {
            recognition.onstart = null;
            recognition.onspeechstart = null;
            recognition.onspeechend = null;
            recognition.onresult = null;
            recognition.onerror = null;
            recognition.onend = null;
          } catch {
            // ignore
          }
        };

        const clearAllTimersAndHandlers = () => {
          if (silenceDebounceTimer) window.clearTimeout(silenceDebounceTimer);
          if (overallTimeoutTimer) window.clearTimeout(overallTimeoutTimer);
          if (restartTimer) window.clearTimeout(restartTimer);
          if (handsFreeAutoFallbackTimer) window.clearTimeout(handsFreeAutoFallbackTimer);
          finishSpeechEarlyRef.current = null;
          if (abortSpeechCaptureRef.current === abortCapture) {
            abortSpeechCaptureRef.current = null;
          }
        };

        const abortCapture = () => {
          if (resolved) return;
          resolved = true;
          clearAllTimersAndHandlers();
          setIsListeningMic(false);
          if (recorderActive) {
            stopVoiceRecordingAndAnalyser();
          }
          clearRecognitionHandlers();
          try {
            recognition.abort();
          } catch {
            // ignore
          }
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
          }
          resolve('');
        };

        const complete = (text: string) => {
          if (resolved) return;
          resolved = true;
          clearAllTimersAndHandlers();
          setIsListeningMic(false);
          if (recorderActive) {
            stopVoiceRecordingAndAnalyser();
          }
          clearRecognitionHandlers();
          try {
            recognition.stop();
          } catch {
            // ignore
          }
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
          }
          const finalNormalized = text
            ? normalizeSpokenTranscriptNumbers(text.trim(), targetSentence)
            : '';
          resolve(finalNormalized);
        };

        const scheduleOverallDeadline = () => {
          if (resolved) return;
          if (overallTimeoutTimer) window.clearTimeout(overallTimeoutTimer);
          const remaining = Math.max(80, deadlineTime - Date.now());
          overallTimeoutTimer = window.setTimeout(() => {
            if (resolved) return;
            const extMs = computeDeadlineExtensionMs({
              nowMs: Date.now(),
              lastSpeechActivityAt,
              postSpeechDebounceMs: timingPlan.postSpeechDebounceMs,
              totalExtensionGrantedMs,
              activeSpeechMaxExtensionMs: timingPlan.activeSpeechMaxExtensionMs,
              isSpeechActive
            });
            if (extMs > 0) {
              totalExtensionGrantedMs += extMs;
              deadlineTime = Date.now() + extMs;
              scheduleOverallDeadline();
              return;
            }
            complete(lastSpokenText);
          }, remaining);
        };

        abortSpeechCaptureRef.current = abortCapture;
        finishSpeechEarlyRef.current = () => {
          complete(lastSpokenText);
        };

        try {
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 8;
          recognition.lang = 'en-US';
        } catch {
          // ignore
        }

        const armSilenceDebounce = (delayMs = timingPlan.postSpeechDebounceMs) => {
          if (silenceDebounceTimer) window.clearTimeout(silenceDebounceTimer);
          silenceDebounceTimer = window.setTimeout(() => {
            if (resolved || !lastSpokenText.trim()) return;
            if (
              isSpeechActive &&
              Date.now() - lastSpeechActivityAt < 1200 &&
              totalExtensionGrantedMs < timingPlan.activeSpeechMaxExtensionMs
            ) {
              totalExtensionGrantedMs += Math.min(delayMs, 900);
              armSilenceDebounce(Math.min(delayMs, timingPlan.postSpeechDebounceMs));
              return;
            }
            complete(lastSpokenText);
          }, delayMs);
        };

        recognition.onstart = () => {
          if (resolved) return;
          if (!hasCompletedFirstStart) {
            hasCompletedFirstStart = true;
            // Begin pre-speech countdown AFTER mic hardware finishes opening
            deadlineTime = Date.now() + timingPlan.preSpeechWaitMs;
            scheduleOverallDeadline();
          }
        };

        recognition.onspeechstart = () => {
          if (resolved) return;
          hasSpeechStarted = true;
          isSpeechActive = true;
          lastSpeechActivityAt = Date.now();
          // Give Chrome time to transcribe a resumed phrase before closing silence debounce
          if (lastSpokenText.trim()) {
            armSilenceDebounce(
              isFullMatchSettled
                ? timingPlan.fullMatchSettleMs
                : timingPlan.postSpeechDebounceMs
            );
          }
        };

        recognition.onspeechend = () => {
          if (resolved) return;
          isSpeechActive = false;
          lastSpeechActivityAt = Date.now();
        };

        recognition.onresult = (event: any) => {
          if (resolved) return;
          hasSpeechStarted = true;
          const now = Date.now();
          lastResultAt = now;
          lastSpeechActivityAt = now;

          let matchedAlternativeForSingleWord = '';

          if (isSingleWord && singleTargetClean && event.results) {
            for (let i = 0; i < event.results.length; ++i) {
              const res = event.results[i];
              const altCount = typeof res?.length === 'number' ? res.length : 1;
              for (let a = 0; a < altCount; a++) {
                const altRaw = normalizeSpokenTranscriptNumbers(
                  String(res[a]?.transcript || '').trim(),
                  targetSentence
                );
                if (!altRaw) continue;
                const altWords = cleanSpeech(altRaw).split(/\s+/).filter(Boolean);
                const matchesTarget =
                  altWords.some(w => isWordMatch(singleTargetClean, w, strictness)) ||
                  calculateSimilarity(singleTargetClean, altRaw, strictness).score >= 70;
                if (matchesTarget) {
                  matchedAlternativeForSingleWord = altRaw;
                  break;
                }
              }
              if (matchedAlternativeForSingleWord) break;
            }
          }

          const { combinedText, interimText } = extractCumulativeTranscriptFromResults(
            event.results || []
          );
          const rawSessionSpoken = normalizeSpokenTranscriptNumbers(
            (matchedAlternativeForSingleWord || combinedText)
              .replace(/\s+/g, ' ')
              .trim(),
            targetSentence
          );
          const currentSpoken = mergeTranscriptWithPrefix(committedPrefix, rawSessionSpoken);

          if (currentSpoken) {
            lastSpokenText = currentSpoken;
            setUserTranscript(`"${currentSpoken}"`);

            const sim = calculateSimilarity(targetSentence, currentSpoken, strictness);
            isFullMatchSettled = isSingleWord
              ? sim.score >= 75 || Boolean(matchedAlternativeForSingleWord)
              : sim.matchedCount >= sim.totalWords &&
                sim.score >= Math.max(settingsRef.current.threshold, 85);

            const baseDelay = isFullMatchSettled
              ? timingPlan.fullMatchSettleMs
              : timingPlan.postSpeechDebounceMs;
            const settleDelay = interimText ? baseDelay + timingPlan.postInterimGraceMs : baseDelay;
            armSilenceDebounce(settleDelay);
          }
        };

        recognition.onerror = (event: any) => {
          if (resolved) return;
          if (event.error === 'audio-capture' && recorderActive && !retriedWithoutRecorder) {
            recorderActive = false;
            retriedWithoutRecorder = true;
            stopVoiceRecordingAndAnalyser();
            if (restartTimer) window.clearTimeout(restartTimer);
            restartTimer = window.setTimeout(() => {
              if (resolved) return;
              try {
                recognition.start();
              } catch {
                // fall through on next error
              }
            }, 140);
            return;
          }
          if (
            event.error === 'not-allowed' ||
            event.error === 'service-not-allowed' ||
            event.error === 'audio-capture' ||
            event.error === 'network'
          ) {
            clearAllTimersAndHandlers();
            setIsListeningMic(false);
            if (recorderActive) {
              stopVoiceRecordingAndAnalyser();
            }
            resolved = true;
            clearRecognitionHandlers();
            try {
              recognition.abort();
            } catch {
              // ignore
            }
            if (recognitionRef.current === recognition) {
              recognitionRef.current = null;
            }
            if (settingsRef.current.autoHandsFree) {
              handsFreeAutoFallbackTimer = window.setTimeout(() => {
                // Never resolve with the target text here: that would auto-solve the
                // exercise. Empty text is treated as "no speech captured" by the engine.
                resolve('');
              }, 550);
              return;
            }
            let settledFallback = false;
            const finishFallback = (val: string) => {
              if (settledFallback) return;
              settledFallback = true;
              abortFallbackSpeechRef.current = null;
              setFallbackSpeechRequest(null);
              resolve(val);
            };
            abortFallbackSpeechRef.current = () => {
              fallbackCancelledByUserRef.current = false;
              finishFallback('');
            };
            setFallbackSpeechRequest({
              target: targetSentence,
              resolve: (val: string) => finishFallback(val)
            });
          } else if (event.error === 'no-speech' && !lastSpokenText) {
            setUserTranscript('(Aguardando sua voz... pode falar no microfone)');
          }
        };

        recognition.onend = () => {
          if (resolved) return;
          isSpeechActive = false;

          const decision = evaluateRecognitionOnEnd({
            lastSpokenText,
            hasSpeechStarted,
            isFullMatchSettled,
            isSingleWord,
            remainingMs: deadlineTime - Date.now(),
            msSinceLastResult: lastResultAt ? Date.now() - lastResultAt : Number.MAX_SAFE_INTEGER,
            postSpeechDebounceMs: timingPlan.postSpeechDebounceMs,
            partialRestartCount
          });

          if (decision === 'restart_fresh' || decision === 'restart_append') {
            if (decision === 'restart_append') {
              partialRestartCount += 1;
              committedPrefix = lastSpokenText;
            }
            if (restartTimer) window.clearTimeout(restartTimer);
            restartTimer = window.setTimeout(() => {
              if (resolved) return;
              try {
                recognition.start();
              } catch {
                complete(lastSpokenText);
              }
            }, 65);
            return;
          }

          complete(lastSpokenText);
        };

        const openFallbackInput = () => {
          clearAllTimersAndHandlers();
          setIsListeningMic(false);
          if (recorderActive) {
            stopVoiceRecordingAndAnalyser();
          }
          resolved = true;
          clearRecognitionHandlers();
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
          }
          // Hands-Free keeps running without a manual fallback dialog: report no speech
          // instead of pre-filling the target text (which would auto-solve the exercise).
          if (settingsRef.current.autoHandsFree) {
            resolve('');
            return;
          }
          let settledFallback = false;
          const finishFallback = (val: string) => {
            if (settledFallback) return;
            settledFallback = true;
            abortFallbackSpeechRef.current = null;
            setFallbackSpeechRequest(null);
            resolve(val);
          };
          abortFallbackSpeechRef.current = () => {
            fallbackCancelledByUserRef.current = false;
            finishFallback('');
          };
          setFallbackSpeechRequest({
            target: targetSentence,
            resolve: (val: string) => finishFallback(val)
          });
        };

        scheduleOverallDeadline();

        restartTimer = window.setTimeout(() => {
          if (resolved) return;
          try {
            recognition.start();
          } catch {
            openFallbackInput();
          }
        }, timingPlan.startupSettleDelayMs);
      });
    },
    [startVoiceRecordingAndAnalyser, stopVoiceRecordingAndAnalyser]
  );

  // Record evaluation result in UI, Book SentenceProgress, and Global StudyStats
  const applyEvaluationFeedback = useCallback(
    (
      spoken: string,
      score: number,
      results: WordMatchResult[],
      sentenceIdx: number,
      isFinalSentencePass = true,
      targetTextForCoach?: string
    ) => {
      setEnginePhase('EVALUATING');
      setUserTranscript(spoken ? `"${spoken}"` : '(Nenhuma fala detectada)');
      setLastScore(score);
      setWordResults(results);

      if (Array.isArray(results) && results.length > 0) {
        const prevMistakes = sentenceWordMistakeCountsRef.current[sentenceIdx] || {};
        const nextMistakes: Record<string, number> = { ...prevMistakes };
        let changed = false;
        for (const item of results) {
          if (!item.matched) {
            const norm = normalizeEnglishChallengeToken(item.word);
            if (norm) {
              nextMistakes[norm] = (nextMistakes[norm] || 0) + 1;
              changed = true;
            }
          }
        }
        if (changed) {
          sentenceWordMistakeCountsRef.current[sentenceIdx] = nextMistakes;
        }
      }

      const coachEnabled = settingsRef.current.enableAiPronunciationCoach ?? true;
      const targetStr =
        targetTextForCoach || sentencesRef.current[sentenceIdx]?.en || '';

      if (coachEnabled && spoken && targetStr) {
        const matchedCount = results.filter(w => w.matched).length;
        const instantFeedback = generateInstantPhoneticCoachFeedback(
          targetStr,
          spoken,
          {
            score,
            wordResults: results,
            matchedCount,
            totalWords: Math.max(1, results.length)
          },
          settingsRef.current.sttProvider || 'hybrid_ai'
        );
        setAiCoachFeedback(instantFeedback);

        // If we have a real recorded audio blob and an AI STT provider is selected, enrich with multimodal audio analysis
        const sttProv = settingsRef.current.sttProvider ?? 'hybrid_ai';
        const audioBlob = lastUserAudioBlobRef.current;
        if (
          audioBlob &&
          audioBlob.size > 200 &&
          (sttProv === 'hybrid_ai' || sttProv === 'gemini_stt')
        ) {
          evaluateAudioWithCloudStt(audioBlob, targetStr, sttProv, true).then(cloudCoach => {
            if (cloudCoach && currentIndexRef.current === sentenceIdx) {
              setAiCoachFeedback(cloudCoach);
            }
          });
        }
      } else if (!spoken) {
        setAiCoachFeedback(null);
      }

      const passed = score >= settingsRef.current.threshold;
      const sentenceCompleted = passed && isFinalSentencePass;
      const nextStreak = passed ? streakRef.current + 1 : 0;
      setStreak(nextStreak);

      // Update per-sentence progress (only mark sentence completed when the final full-sentence speaking step passes)
      const existing = sentenceProgressRef.current[sentenceIdx];
      const updatedProg: SentenceProgress = {
        completed: Boolean(existing?.completed || sentenceCompleted),
        bestScore: Math.max(existing?.bestScore || 0, score),
        attempts: (existing?.attempts || 0) + 1,
        lastPracticed: new Date().toISOString()
      };
      const nextProgress = {
        ...sentenceProgressRef.current,
        [sentenceIdx]: updatedProg
      };
      sentenceProgressRef.current = nextProgress;
      setSentenceProgress(nextProgress);
      ShadowRepository.books.updateBookmark(currentBookId, sentenceIdx, {
        index: sentenceIdx,
        progress: updatedProg
      });

      // Update global StudyStats (pure computation, then persist once)
      const nextStats = ShadowRepository.stats.recordEvaluation(
        studyStatsRef.current,
        score,
        passed,
        nextStreak,
        results,
        sentenceCompleted
      );
      studyStatsRef.current = nextStats;
      setStudyStats(nextStats);
      ShadowRepository.stats.save(nextStats);
    },
    [currentBookId]
  );

  // Trigger a Challenge Step ('challenges' = both, 'challenge_pronunciation' = 1 only, 'challenge_matching' = 2 only)
  const runPostSentenceChallenges = useCallback(
    (
      sentenceEn: string,
      sentenceIndex: number,
      forceOpen = false,
      challengeStepType:
        | 'challenges'
        | 'challenge_pronunciation'
        | 'challenge_matching' = 'challenges'
    ): Promise<ChallengeOutcome> => {
      const seq = buildEffectiveCardSequence(settingsRef.current);
      const firstChallengeInSeq = seq.find(c => isChallengeStepCard(c)) as
        | 'challenges'
        | 'challenge_pronunciation'
        | 'challenge_matching'
        | undefined;

      if (!forceOpen && !firstChallengeInSeq) {
        return Promise.resolve('advance');
      }

      const effectiveType = forceOpen
        ? challengeStepType
        : challengeStepType || firstChallengeInSeq || 'challenges';
      const enablePronunciation =
        effectiveType === 'challenges' || effectiveType === 'challenge_pronunciation';
      const enableMatching =
        effectiveType === 'challenges' || effectiveType === 'challenge_matching';

      // Hard-stop any audio from previous steps before opening the challenge modal
      stopAllAudioPlayback();
      setIsSpeakingTTS(false);

      const mistakeSnapshot = {
        ...(sentenceWordMistakeCountsRef.current[sentenceIndex] || {})
      };

      return new Promise<ChallengeOutcome>(resolve => {
        let settled = false;
        const settle = (outcome: ChallengeOutcome) => {
          // Resolve at most once: Escape / onFinish / navigation can all race.
          if (settled) return;
          settled = true;
          if (pendingChallengeResolveRef.current === settle) {
            pendingChallengeResolveRef.current = null;
          }
          // Hard-stop any lingering challenge voices and mic capture immediately upon finishing, skipping, or closing
          abortSpeechCaptureRef.current?.();
          stopAllAudioPlayback();
          setIsSpeakingTTS(false);
          setPostSentenceChallengeRequest(null);
          if (outcome === 'advance') {
            completedChallengeIndicesRef.current.add(sentenceIndex);
          }
          resolve(outcome);
        };
        pendingChallengeResolveRef.current = settle;
        setPostSentenceChallengeRequest({
          sentenceEn,
          sentenceIndex,
          enablePronunciation,
          enableMatching,
          wordMistakes: mistakeSnapshot,
          resolve: settle
        });
      });
    },
    []
  );

  // Automatic or manual word-by-word review ('literal' step in the learning sequence)
  const readWordByWordReview = useCallback(
    async (
      textEn: string,
      stepToken: number,
      _requireLoop = true,
      isStandaloneManual = false,
      startIndex = 0
    ): Promise<boolean> => {
      const startSentenceIdx = currentIndexRef.current;
      skipWordReviewRef.current = false;
      const canContinue = () =>
        !skipWordReviewRef.current &&
        currentIndexRef.current === startSentenceIdx &&
        stepToken === activeStepTokenRef.current;

      if (!canContinue()) {
        return false;
      }

      const tokens = textEn.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return false;
      const validStart = Math.max(0, Math.min(startIndex, tokens.length - 1));
      const startWordClean = cleanString(tokens[validStart] || '');

      isManualWordReviewRef.current = isStandaloneManual;
      isPostSuccessWordReviewRef.current = !isStandaloneManual;
      if (isStandaloneManual) {
        setMobileSelectedPanel(prev => (prev === 'all' ? 'all' : 'literal'));
      }
      setIsReadingWords(true);
      setHighlightedWordIdx(validStart);
      setEnginePhase('WORD_REVIEW');
      setStateBadgeText(
        validStart > 0 && startWordClean
          ? `Lendo de "${startWordClean}"...`
          : '🔤 Etapa: Revisão Automática...'
      );
      setStateBadgeColor('text-amber-300');
      showToast(
        validStart > 0 && startWordClean
          ? `Leitura pulada para "${startWordClean}"...`
          : '🔤 Revisão Automática: lendo cada palavra + tradução (ou clique em Pular)...'
      );

      await new Promise<void>(resolveReview => {
        let settled = false;
        const finishReview = () => {
          if (settled) return;
          settled = true;
          if (abortWordReviewRef.current === finishReview) {
            abortWordReviewRef.current = null;
          }
          resolveReview();
        };
        abortWordReviewRef.current = finishReview;

        const waitMs = (ms: number) =>
          new Promise<void>(r => {
            const t = window.setTimeout(r, ms);
            if (settled) window.clearTimeout(t);
          });

        (async () => {
          for (let i = validStart; i < tokens.length; i++) {
            if (settled || !canContinue()) break;

            const rawToken = tokens[i];
            const clean = cleanString(rawToken);
            const speakableEn = getSpeakableWord(rawToken, 'en-US') || clean;
            if (!clean) continue;

            setHighlightedWordIdx(i);
            const chipEl = document.querySelector(
              `#literalWordsList [data-word-idx="${i}"]`
            ) as HTMLElement | null;
            if (chipEl) {
              chipEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }

            await Promise.race([speakText(speakableEn, 'en-US', 0.92), waitMs(3800)]);
            if (settled || !canContinue()) break;

            const info = getWordInfo(clean);
            let ptWord = info.pt && info.pt !== '...' ? info.pt.split('/')[0].trim() : '';
            if (!ptWord) {
              const resolved = await Promise.race([
                resolveWordTranslation(clean),
                waitMs(1500).then(() => '')
              ]);
              ptWord = resolved ? resolved.split('/')[0].trim() : '';
            }
            if (settled || !canContinue()) break;

            await waitMs(120);
            if (settled || !canContinue()) break;

            if (ptWord && ptWord !== '...') {
              await Promise.race([speakText(ptWord, 'pt-BR', 1.08), waitMs(3800)]);
              if (settled || !canContinue()) break;
              await waitMs(160);
            }
          }
          finishReview();
        })();
      });

      const wasSkipped = skipWordReviewRef.current;
      skipWordReviewRef.current = false;
      isManualWordReviewRef.current = false;
      isPostSuccessWordReviewRef.current = false;
      setHighlightedWordIdx(null);
      setIsReadingWords(false);
      return wasSkipped;
    },
    [showToast, speakText]
  );

  const releaseWakeLockIfHeld = useCallback(() => {
    if (wakeLockSentinelRef.current) {
      try {
        wakeLockSentinelRef.current.release();
      } catch {
        // ignore
      }
      wakeLockSentinelRef.current = null;
    }
  }, []);

  const stopLoop = useCallback(
    (preserveResumePos = true) => {
      const wasActive = isPlayingLoopRef.current;
      const resumeSeq =
        preserveResumePos && wasActive ? (activeSequenceStepIdxRef.current ?? 0) : null;
      isPlayingLoopRef.current = false;
      setIsPlayingLoop(false);
      if (preserveResumePos && resumeSeq !== null) {
        pausedResumeSeqIdxRef.current = resumeSeq;
        setPausedResumeSeqIdx(resumeSeq);
      } else if (!preserveResumePos) {
        pausedResumeSeqIdxRef.current = null;
        setPausedResumeSeqIdx(null);
      }
      activeSequenceStepIdxRef.current = null;
      setActiveSequenceStepIdx(null);
      releaseWakeLockIfHeld();
      setEnginePhase('PAUSED');
      // Never leave a suspended challenge promise with the old sentence closure.
      pendingChallengeResolveRef.current?.('cancel');
      stopAllAudio();
      setStateBadgeText('Pausado');
      setStateBadgeColor('text-slate-300');
    },
    [releaseWakeLockIfHeld, stopAllAudio]
  );

  // Cleanly pauses an active training loop when the user triggers a manual card/step action in Free Mode
  const pauseLoopForManualControl = useCallback(
    (toastMsg?: string): boolean => {
      const wasLooping = isPlayingLoopRef.current;
      isPlayingLoopRef.current = false;
      setIsPlayingLoop(false);
      setActiveSequenceStepIdx(null);
      releaseWakeLockIfHeld();
      pendingChallengeResolveRef.current?.('cancel');
      stopAllAudio();
      setEnginePhase('IDLE');
      setStateBadgeText('Pronto');
      setStateBadgeColor('text-slate-300');
      if (wasLooping && toastMsg) {
        showToast(toastMsg);
      }
      return wasLooping;
    },
    [releaseWakeLockIfHeld, showToast, stopAllAudio]
  );

  // Unified manual audio runner for standalone card buttons, chips, prosody blocks & shortcuts
  const runManualAudioPlayback = useCallback(
    async (
      audioKey: 'pt' | 'en' | 'en_slow' | 'step' | null,
      cardHighlight: 'pt' | 'en' | null,
      text: string,
      lang: 'en-US' | 'pt-BR',
      speedMultiplier = 1.0,
      toggleIfCurrentlyPlaying = false,
      preserveSequenceHighlight = false
    ) => {
      if (!text) return;
      unlockAudioSession();

      const wasLooping = isPlayingLoopRef.current;
      if (toggleIfCurrentlyPlaying) {
        pauseLoopForManualControl(wasLooping ? '⏸️ Treino pausado.' : undefined);
        return;
      }

      if (wasLooping) {
        pauseLoopForManualControl('⏸️ Treino pausado para reprodução manual.');
      } else {
        stopAllAudio();
        if (!preserveSequenceHighlight) {
          setActiveSequenceStepIdx(null);
        }
      }

      activeStepTokenRef.current += 1;
      const token = activeStepTokenRef.current;
      if (audioKey === 'pt') {
        setMobileSelectedPanel(prev => (prev === 'all' ? 'all' : 'pt'));
      } else if (audioKey === 'en' || audioKey === 'en_slow') {
        setMobileSelectedPanel(prev => (prev === 'all' ? 'all' : 'en'));
      }
      if (audioKey) setActiveManualAudio(audioKey);
      if (cardHighlight) setActiveCardHighlight(cardHighlight);

      await speakText(text, lang, speedMultiplier);

      if (token === activeStepTokenRef.current && !isPlayingLoopRef.current) {
        setActiveCardHighlight(null);
        setActiveManualAudio(null);
        setActiveSequenceStepIdx(null);
        setEnginePhase('IDLE');
        setStateBadgeText('Pronto');
        setStateBadgeColor('text-slate-300');
      }
    },
    [pauseLoopForManualControl, speakText, stopAllAudio]
  );

  // Helper to play bilingual audio preview for a step when clicked manually outside loop
  const playStepBilingualPreview = useCallback(
    async (enText: string, ptText: string, isSubClauseStep = true) => {
      unlockAudioSession();
      const wasLooping = isPlayingLoopRef.current;
      pauseLoopForManualControl(
        wasLooping ? '⏸️ Treino pausado para reprodução da parte selecionada.' : undefined
      );
      activeStepTokenRef.current += 1;
      const previewToken = activeStepTokenRef.current;
      const isStillCurrent = () =>
        previewToken === activeStepTokenRef.current && !isPlayingLoopRef.current;

      setActiveManualAudio('step');
      const seq = buildEffectiveCardSequence(settingsRef.current, {
        isStepByStepMode: isStepByStepModeRef.current,
        isSubClauseStep
      });
      const firstSpeakPos = seq.findIndex(s => isSpeakStepCard(s));
      const firstSpeakType = firstSpeakPos >= 0 ? seq[firstSpeakPos] : undefined;
      const isChallengeFirst =
        settingsRef.current.audioFlow === 'challenge' || firstSpeakType === 'speak_challenge';
      const preSpeakSlice = firstSpeakPos > 0 ? seq.slice(0, firstSpeakPos) : seq;
      // Preview only plays pre-speak audio steps ('pt', 'en', 'en_slow'), never 'literal' word-by-word review
      const audioSteps = preSpeakSlice.filter(
        s => (s === 'pt' && !isChallengeFirst) || s === 'en' || s === 'en_slow'
      );

      if (audioSteps.length === 0) {
        setActiveCardHighlight('en');
        await speakText(enText, 'en-US', 0.92);
        if (!isStillCurrent()) return;
        setActiveCardHighlight(null);
      } else {
        for (let i = 0; i < audioSteps.length; i++) {
          if (!isStillCurrent()) return;
          const step = audioSteps[i];
          if (step === 'pt' && ptText) {
            setActiveCardHighlight('pt');
            await speakText(ptText, 'pt-BR', 1.0);
            if (!isStillCurrent()) return;
            setActiveCardHighlight(null);
          } else if (step === 'en') {
            setActiveCardHighlight('en');
            await speakText(enText, 'en-US', 0.92);
            if (!isStillCurrent()) return;
            setActiveCardHighlight(null);
          } else if (step === 'en_slow') {
            setActiveCardHighlight('en');
            await speakText(enText, 'en-US', 0.72);
            if (!isStillCurrent()) return;
            setActiveCardHighlight(null);
          }
          if (!isStillCurrent()) return;
          if (i < audioSteps.length - 1) {
            await new Promise(r => setTimeout(r, 250));
          }
        }
      }

      if (isStillCurrent()) {
        setActiveManualAudio(null);
        setActiveSequenceStepIdx(null);
        setEnginePhase('IDLE');
        setStateBadgeText('Pronto');
        setStateBadgeColor('text-slate-300');
      }
    },
    [pauseLoopForManualControl, speakText]
  );

  // Main Shadowing Loop Step (executes every step in effectiveSequence in exact order!)
  const runShadowingStep = useCallback(async (startSeqIdx = 0) => {
    if (!isPlayingLoopRef.current) return;

    activeStepTokenRef.current += 1;
    const currentToken = activeStepTokenRef.current;
    const idx = currentIndexRef.current;
    const list = sentencesRef.current;
    const current = list[idx];
    const isValid = () =>
      shouldContinueAsyncStep({
        token: currentToken,
        activeToken: activeStepTokenRef.current,
        sentenceIdx: idx,
        currentSentenceIdx: currentIndexRef.current,
        requireLoop: true,
        isPlayingLoop: isPlayingLoopRef.current
      });

    if (!current) {
      stopLoop(false);
      setEnginePhase('COMPLETED');
      playChime('success', settingsRef.current.audioBeeps);
      setIsBookCompletedOpen(true);
      return;
    }

    let ptText = current.pt;
    if (!ptText || ptText.startsWith('[Tradução')) {
      ptText = await fetchSentenceTranslation(current.en);
      setSentences(prev => {
        const next = [...prev];
        if (next[idx]) next[idx] = { ...next[idx], pt: ptText };
        return next;
      });
    }
    if (!isValid()) return;

    const inStepMode = isStepByStepModeRef.current;
    const steps = inStepMode
      ? splitSentenceIntoStudySteps(current.en, 'forward', ptText)
      : [];
    const sIdx = inStepMode
      ? Math.max(0, Math.min(activeStepIdxRef.current, steps.length - 1))
      : 0;
    const stepObj = inStepMode ? steps[sIdx] : null;
    const isIntermediateSubClause = Boolean(
      inStepMode && stepObj && !stepObj.isFull && sIdx + 1 < steps.length
    );

    const targetEn = stepObj ? stepObj.text : current.en;
    const targetPt = stepObj && stepObj.ptText ? stepObj.ptText : ptText;

    const effectiveSequence = buildEffectiveCardSequence(settingsRef.current, {
      isStepByStepMode: inStepMode,
      isSubClauseStep: isIntermediateSubClause
    });
    const lastSpeakStepIdx = effectiveSequence.reduce(
      (last, card, i) => (isSpeakStepCard(card) ? i : last),
      -1
    );
    const hasChallengeCard =
      settingsRef.current.audioFlow === 'challenge' ||
      effectiveSequence.includes('speak_challenge');

    const initialSeqIdx =
      Number.isFinite(startSeqIdx) && startSeqIdx > 0
        ? Math.min(Math.floor(startSeqIdx), Math.max(0, effectiveSequence.length - 1))
        : 0;

    const speakChallengePos = effectiveSequence.indexOf('speak_challenge');
    const shouldLockForChallenge =
      hasChallengeCard && (speakChallengePos === -1 || initialSeqIdx <= speakChallengePos);
    setChallengeUnlocked(!shouldLockForChallenge);
    isBlindStageActiveRef.current = false;
    setIsBlindStageActive(false);
    setBlindEnglishUnlocked(false);
    blindErrorCountRef.current = 0;
    setBlindErrorCount(0);

    // Hard-stop any lingering audio from previous sentences or steps before starting sequence
    stopAllAudioPlayback();

    for (let seqIdx = initialSeqIdx; seqIdx < effectiveSequence.length; seqIdx++) {
      if (!isValid()) return;
      stopAllAudioPlayback();
      const stepCard = effectiveSequence[seqIdx];
      activeSequenceStepIdxRef.current = seqIdx;
      setActiveSequenceStepIdx(seqIdx);

      if (stepCard === 'pt') {
        if (targetPt) {
          setChallengeUnlocked(true);
          setActiveCardHighlight('pt');
          await speakText(targetPt, 'pt-BR', 1.0);
          setActiveCardHighlight(null);
          if (!isValid()) return;
          await new Promise(r => setTimeout(r, 300));
          if (!isValid()) return;
        }
      } else if (stepCard === 'en') {
        setActiveCardHighlight('en');
        await speakText(targetEn, 'en-US', 1.0);
        setActiveCardHighlight(null);
        if (!isValid()) return;
        await new Promise(r => setTimeout(r, 300));
        if (!isValid()) return;
      } else if (stepCard === 'en_slow') {
        setActiveCardHighlight('en');
        await speakText(targetEn, 'en-US', 0.72);
        setActiveCardHighlight(null);
        if (!isValid()) return;
        await new Promise(r => setTimeout(r, 300));
        if (!isValid()) return;
      } else if (stepCard === 'literal') {
        await readWordByWordReview(targetEn, currentToken, true, false);
        if (!isValid()) return;
      } else if (isChallengeStepCard(stepCard)) {
        // Run the Challenge step when on the full sentence (or final sub-step)
        if (!isIntermediateSubClause) {
          setStateBadgeText('🏆 Etapa de Desafios!');
          setStateBadgeColor('text-purple-300');
          const challengeOutcome = await runPostSentenceChallenges(
            current.en,
            idx,
            true,
            stepCard as 'challenges' | 'challenge_pronunciation' | 'challenge_matching'
          );
          if (!isValid()) return;

          const resolution = resolveChallengeResolution(challengeOutcome, true);
          if (resolution.action === 'stay_paused') {
            stopLoop();
            showToast('⏸️ Desafio fechado — treino pausado.');
            return;
          }

          if (resolution.action === 'repeat_sentence') {
            activeStepIdxRef.current = 0;
            setActiveStepIdx(0);
            setCompletedStepIndices([]);
            setChallengeUnlocked(false);
            setBlindEnglishUnlocked(false);
            isBlindStageActiveRef.current = false;
            setIsBlindStageActive(false);
            manualSpeakStageIdxRef.current = 0;
            setLastScore(null);
            setWordResults([]);
            setAiCoachFeedback(null);
            setStateBadgeText('Repetindo sentença...');
            setStateBadgeColor('text-amber-300');
            showToast('Repetindo a sentença para reforçar as palavras do desafio!');
            await new Promise(r => setTimeout(r, 500));
            if (isValid()) {
              runShadowingStep();
            }
            return;
          }
        }
      } else if (isSpeakStepCard(stepCard)) {
        if (stepCard === 'speak_blind_en') {
          isBlindStageActiveRef.current = true;
          setIsBlindStageActive(true);
          setBlindEnglishUnlocked(false);
          blindErrorCountRef.current = 0;
          setBlindErrorCount(0);
          setLastScore(null);
          setWordResults([]);
          setUserTranscript('🧠 Modo sem ler o inglês: olhe apenas o português e fale!');
          setStateBadgeText('🧠 Etapa Sem Ler EN: Olhe apenas o PT e fale!');
          setStateBadgeColor('text-emerald-300');
          showToast('🧠 Fale agora sem ler o inglês (olhando apenas o português)!');
        } else if (stepCard === 'speak_challenge') {
          setChallengeUnlocked(false);
          isBlindStageActiveRef.current = false;
          setIsBlindStageActive(false);
        } else {
          isBlindStageActiveRef.current = false;
          setIsBlindStageActive(false);
        }

        let speakPassed = false;
        let attempts = 0;

        while (!speakPassed && isValid()) {
          attempts++;
          fallbackCancelledByUserRef.current = false;
          const rawSpoken = await listenForSpeech(targetEn);
          if (fallbackCancelledByUserRef.current) {
            fallbackCancelledByUserRef.current = false;
            stopLoop();
            showToast('⏸️ Treino pausado.');
            return;
          }
          if (!isValid()) return;
          const spoken = normalizeSpokenTranscriptNumbers(rawSpoken, targetEn);

          // Hands-Free Voice Commands ("pular", "repetir", "pausar treino")
          if (
            settingsRef.current.autoHandsFree &&
            (settingsRef.current.handsFreeVoiceCommands ?? true) &&
            spoken.trim().length > 0
          ) {
            const voiceCmd = detectHandsFreeVoiceCommand(spoken, targetEn);
            if (voiceCmd === 'pause') {
              stopLoop();
              showToast('⏸️ Treino pausado por comando de voz!');
              return;
            }
            if (voiceCmd === 'repeat') {
              attempts = Math.max(0, attempts - 1);
              showToast('🔁 Repetindo áudio por comando de voz...');
              if (stepCard === 'speak_blind_en' && targetPt) {
                await speakText(targetPt, 'pt-BR', 1.0);
              } else {
                await speakText(targetEn, 'en-US', 0.92);
              }
              continue;
            }
            if (voiceCmd === 'skip') {
              speakPassed = true;
              setChallengeUnlocked(true);
              setBlindEnglishUnlocked(true);
              isBlindStageActiveRef.current = false;
              setIsBlindStageActive(false);
              showToast('⏭️ Etapa avançada por comando de voz!');
              break;
            }
          }

          const { score, wordResults: wRes } = calculateSimilarity(
            targetEn,
            spoken,
            settingsRef.current.sttStrictness ?? 'balanced'
          );
          const isFinalSpeakOfFullSentence =
            !isIntermediateSubClause &&
            (lastSpeakStepIdx === -1 || seqIdx >= lastSpeakStepIdx);
          applyEvaluationFeedback(
            spoken,
            score,
            wRes,
            idx,
            isFinalSpeakOfFullSentence,
            targetEn
          );

          if (score >= settingsRef.current.threshold) {
            speakPassed = true;
            playChime('success', settingsRef.current.audioBeeps);

            if (stepCard === 'speak_challenge') {
              setChallengeUnlocked(true);
              setStateBadgeText('Desafio Superado!');
              setStateBadgeColor('text-emerald-300');
              showToast(`🏆 Correto! (${score}%) Desbloqueando tradução...`);
            } else if (stepCard === 'speak_blind_en') {
              isBlindStageActiveRef.current = false;
              setIsBlindStageActive(false);
              setBlindEnglishUnlocked(true);
              blindErrorCountRef.current = 0;
              setBlindErrorCount(0);
              setStateBadgeText('Etapa Sem Ler Concluída!');
              setStateBadgeColor('text-emerald-300');
              showToast(`🧠 Fala sem leitura dominada (${score}%)!`);
            } else {
              setStateBadgeText('Excelente!');
              setStateBadgeColor('text-emerald-300');
              showToast(
                inStepMode && stepObj && !stepObj.isFull
                  ? `✓ ${stepObj.label} dominada (${score}%)!`
                  : `Correto! (${score}%)`
              );
            }

            await new Promise(r => setTimeout(r, 1500));
            if (!isValid()) return;
          } else {
            playChime('retry', settingsRef.current.audioBeeps);
            const maxBlindErrors = settingsRef.current.blindMaxErrorsBeforeReveal ?? 2;
            const errorPlan = resolveSpeakErrorFeedbackPlan({
              stepCard,
              attempts,
              blindMaxErrorsBeforeReveal: maxBlindErrors,
              repeatOnError: settingsRef.current.repeatOnError,
              slowdownOnError: settingsRef.current.slowdownOnError,
              autoHandsFree: settingsRef.current.autoHandsFree,
              handsFreeMaxAttempts: settingsRef.current.handsFreeMaxAttempts ?? 2,
              hasTargetPt: Boolean(targetPt)
            });

            if (stepCard === 'speak_blind_en') {
              blindErrorCountRef.current = attempts;
              setBlindErrorCount(attempts);
              if (errorPlan.revealEnglish) {
                setBlindEnglishUnlocked(true);
              }
            }

            // Hands-Free Auto-Progression: after effectiveHandsFreeMax attempts, play model audio once and advance to the next step
            if (errorPlan.action === 'hands_free_advance') {
              speakPassed = true;
              setChallengeUnlocked(true);
              setBlindEnglishUnlocked(true);
              isBlindStageActiveRef.current = false;
              setIsBlindStageActive(false);
              setStateBadgeText('🙌 Mãos Livres: avançando etapa...');
              setStateBadgeColor('text-emerald-300');
              showToast(
                `🙌 Mãos Livres: ouvindo pronúncia modelo e avançando após ${attempts} tentativa(s)...`
              );
              await new Promise(r => setTimeout(r, 320));
              if (!isValid()) return;
              await speakText(targetEn, 'en-US', errorPlan.speedMultiplier);
              if (!isValid()) return;
              await new Promise(r => setTimeout(r, errorPlan.pauseAfterMs));
              break;
            }

            setStateBadgeText(
              errorPlan.revealEnglish
                ? `👀 Inglês revelado após ${attempts} erro(s)!`
                : stepCard === 'speak_blind_en'
                  ? 'Olhe o PT e fale em inglês'
                  : 'Tente novamente'
            );
            setStateBadgeColor('text-amber-300');

            if (errorPlan.revealEnglish) {
              showToast(
                `👀 Você errou ${attempts}x sem ler — o texto em inglês foi revelado para ajudar!`
              );
            }

            if (errorPlan.action === 'repeat_pt_hint') {
              await new Promise(r => setTimeout(r, 450));
              if (!isValid()) return;
              showToast('Ouvindo o português de apoio...');
              await speakText(targetPt, 'pt-BR', errorPlan.speedMultiplier);
              if (!isValid()) return;
              await new Promise(r => setTimeout(r, errorPlan.pauseAfterMs));
            } else if (
              errorPlan.action === 'reveal_and_repeat_en' ||
              errorPlan.action === 'repeat_en_error'
            ) {
              await new Promise(r => setTimeout(r, 450));
              if (!isValid()) return;
              showToast(
                errorPlan.revealEnglish
                  ? '👀 Inglês revelado! Ouvindo a pronúncia de apoio...'
                  : 'Repetindo em inglês...'
              );
              await speakText(targetEn, 'en-US', errorPlan.speedMultiplier);
              if (!isValid()) return;
              await new Promise(r => setTimeout(r, errorPlan.pauseAfterMs));
            } else {
              await new Promise(r => setTimeout(r, errorPlan.pauseAfterMs));
            }
          }
        }
      }
    }

    if (!isValid()) return;
    stopAllAudioPlayback();
    setActiveSequenceStepIdx(null);
    setChallengeUnlocked(false);
    setBlindEnglishUnlocked(false);
    isBlindStageActiveRef.current = false;
    setIsBlindStageActive(false);
    blindErrorCountRef.current = 0;
    setBlindErrorCount(0);
    manualSpeakStageIdxRef.current = 0;

    if (isIntermediateSubClause) {
      setCompletedStepIndices(prev => (prev.includes(sIdx) ? prev : [...prev, sIdx]));
      const nextStepIdx = sIdx + 1;
      activeStepIdxRef.current = nextStepIdx;
      setActiveStepIdx(nextStepIdx);
      setLastScore(null);
      setWordResults([]);
      setAiCoachFeedback(null);
      await new Promise(r => setTimeout(r, 450));
      if (isValid()) {
        runShadowingStep();
      }
      return;
    }

    const nextIdx = idx + 1;
    if (nextIdx >= list.length) {
      stopLoop(false);
      setEnginePhase('COMPLETED');
      playChime('success', settingsRef.current.audioBeeps);
      setIsBookCompletedOpen(true);
      return;
    }

    delete sentenceWordMistakeCountsRef.current[nextIdx];
    currentIndexRef.current = nextIdx;
    setCurrentIndex(nextIdx);
    activeStepIdxRef.current = 0;
    setActiveStepIdx(0);
    setCompletedStepIndices([]);
    setLastScore(null);
    setWordResults([]);
    setAiCoachFeedback(null);
    await new Promise(r => setTimeout(r, 500));
    if (
      shouldContinueAsyncStep({
        token: currentToken,
        activeToken: activeStepTokenRef.current,
        sentenceIdx: nextIdx,
        currentSentenceIdx: currentIndexRef.current,
        requireLoop: true,
        isPlayingLoop: isPlayingLoopRef.current
      })
    ) {
      runShadowingStep();
    }
  }, [
    applyEvaluationFeedback,
    listenForSpeech,
    readWordByWordReview,
    runPostSentenceChallenges,
    showToast,
    speakText,
    stopLoop
  ]);

  const startLoop = useCallback(() => {
    unlockAudioSession();
    if (settingsRef.current.autoHandsFree && 'wakeLock' in navigator) {
      try {
        (navigator as any).wakeLock
          .request('screen')
          .then((sentinel: any) => {
            wakeLockSentinelRef.current = sentinel;
          })
          .catch(() => {});
      } catch {
        // ignore
      }
    }
    const resumeSeqIdx = pausedResumeSeqIdxRef.current ?? 0;
    pausedResumeSeqIdxRef.current = null;
    setPausedResumeSeqIdx(null);
    isPlayingLoopRef.current = true;
    setIsPlayingLoop(true);
    runShadowingStep(resumeSeqIdx);
  }, [runShadowingStep]);

  const handleToggleLoop = useCallback(async () => {
    if (isPlayingLoopRef.current) {
      stopLoop(true);
    } else {
      if (!micPermissionGranted) {
        await requestMicrophonePermission(false);
      }
      startLoop();
    }
  }, [micPermissionGranted, requestMicrophonePermission, startLoop, stopLoop]);

  const jumpToSentence = useCallback(
    (targetIdx: number) => {
      if (targetIdx >= 0 && targetIdx < sentencesRef.current.length) {
        const wasPlaying = isPlayingLoopRef.current;
        isPlayingLoopRef.current = false;
        setIsPlayingLoop(false);
        pausedResumeSeqIdxRef.current = null;
        setPausedResumeSeqIdx(null);
        pendingChallengeResolveRef.current?.('cancel');
        setPostSentenceChallengeRequest(null);
        stopAllAudio();

        currentIndexRef.current = targetIdx;
        setCurrentIndex(targetIdx);
        setChallengeUnlocked(false);
        setBlindEnglishUnlocked(false);
        isBlindStageActiveRef.current = false;
        setIsBlindStageActive(false);
        blindErrorCountRef.current = 0;
        setBlindErrorCount(0);
        activeSequenceStepIdxRef.current = null;
        setActiveSequenceStepIdx(null);
        manualSpeakStageIdxRef.current = 0;
        setLastScore(null);
        setWordResults([]);
        setAiCoachFeedback(null);
        activeStepIdxRef.current = 0;
        setActiveStepIdx(0);
        setCompletedStepIndices([]);

        if (wasPlaying) {
          setUserTranscript('Aguardando próxima fala...');
          window.setTimeout(() => {
            isPlayingLoopRef.current = true;
            setIsPlayingLoop(true);
            runShadowingStep();
          }, 250);
        } else {
          setEnginePhase('IDLE');
          setStateBadgeText('Pronto');
          setStateBadgeColor('text-slate-300');
          setUserTranscript('Modo Livre: ouça os cards, fale ou clique em "Iniciar Treino".');
        }
      }
    },
    [runShadowingStep, stopAllAudio]
  );

  const navigateSentence = useCallback(
    (delta: number) => {
      jumpToSentence(currentIndexRef.current + delta);
    },
    [jumpToSentence]
  );

  const studySteps = useMemo(
    () =>
      currentSentence
        ? splitSentenceIntoStudySteps(
            currentSentence.en,
            'forward',
            currentSentence.pt || ''
          )
        : [],
    [currentSentence]
  );

  const activeStudyStep = studySteps[activeStepIdx] || studySteps[0] || null;

  // Jump word-by-word reading directly to a clicked word in Card 03 and open the dictionary simultaneously
  const handleLiteralWordClick = useCallback(
    async (clean: string, wordIdx: number) => {
      if (!currentSentence) return;

      // 1. Open the dictionary modal for the clicked word
      setDictWord({
        word: clean,
        context: currentSentence.en
      });

      const wasLooping = isPlayingLoopRef.current;
      pauseLoopForManualControl(
        wasLooping ? '⏸️ Treino pausado para consultar palavra.' : undefined
      );

      activeStepTokenRef.current += 1;
      const manualToken = activeStepTokenRef.current;
      const targetText =
        isStepByStepMode && activeStudyStep ? activeStudyStep.text : currentSentence.en;

      const skipped = await readWordByWordReview(targetText, manualToken, false, true, wordIdx);
      if (
        !skipped &&
        manualToken === activeStepTokenRef.current &&
        !isPlayingLoopRef.current
      ) {
        setActiveSequenceStepIdx(null);
        setEnginePhase('IDLE');
        setStateBadgeText('Pronto');
        setStateBadgeColor('text-slate-300');
      }
    },
    [
      activeStudyStep,
      currentSentence,
      isStepByStepMode,
      pauseLoopForManualControl,
      readWordByWordReview
    ]
  );

  const evaluateTargetOrStep = useCallback(
    async (spoken: string, idx: number, curr: Sentence) => {
      const targetText =
        isStepByStepMode && activeStudyStep ? activeStudyStep.text : curr.en;
      const targetPt =
        isStepByStepMode && activeStudyStep && activeStudyStep.ptText
          ? activeStudyStep.ptText
          : curr.pt;
      const isIntermediateSubClause = Boolean(
        isStepByStepMode &&
          activeStudyStep &&
          !activeStudyStep.isFull &&
          activeStepIdx + 1 < studySteps.length
      );
      const effectiveSequence = buildEffectiveCardSequence(settingsRef.current, {
        isStepByStepMode,
        isSubClauseStep: isIntermediateSubClause
      });
      const speakStepPositions = effectiveSequence
        .map((c, i) => (isSpeakStepCard(c) ? i : -1))
        .filter(i => i >= 0);
      const currentSpeakStageIdx = manualSpeakStageIdxRef.current;
      const currentSeqPos =
        speakStepPositions[currentSpeakStageIdx] ?? speakStepPositions[0] ?? -1;
      const currentSpeakCard =
        (currentSeqPos >= 0 ? effectiveSequence[currentSeqPos] : undefined) || 'speak';
      const nextSpeakStageIdx = currentSpeakStageIdx + 1;
      const hasMoreSpeakSteps = nextSpeakStageIdx < speakStepPositions.length;
      const nextSeqPos = hasMoreSpeakSteps
        ? speakStepPositions[nextSpeakStageIdx]
        : effectiveSequence.length;

      const normalizedSpoken = normalizeSpokenTranscriptNumbers(spoken, targetText);
      const { score, wordResults: wRes } = calculateSimilarity(
        targetText,
        normalizedSpoken,
        settingsRef.current.sttStrictness ?? 'balanced'
      );
      const isFinalSentencePass = !isIntermediateSubClause && !hasMoreSpeakSteps;
      applyEvaluationFeedback(normalizedSpoken, score, wRes, idx, isFinalSentencePass, targetText);

      if (score >= settingsRef.current.threshold) {
        playChime('success', settingsRef.current.audioBeeps);
        activeStepTokenRef.current += 1;
        const evalToken = activeStepTokenRef.current;
        const isEvalValid = () =>
          shouldContinueAsyncStep({
            token: evalToken,
            activeToken: activeStepTokenRef.current,
            sentenceIdx: idx,
            currentSentenceIdx: currentIndexRef.current,
            requireLoop: false,
            isPlayingLoop: isPlayingLoopRef.current
          }) && !isPlayingLoopRef.current;

        stopVoiceRecordingAndAnalyser();
        if (recognitionRef.current) {
          try {
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onend = null;
            recognitionRef.current.abort();
          } catch {
            // ignore
          }
          recognitionRef.current = null;
        }
        setIsListeningMic(false);

        if (
          settingsRef.current.audioFlow === 'challenge' ||
          currentSpeakCard === 'speak_challenge'
        ) {
          setChallengeUnlocked(true);
        }

        if (currentSpeakCard === 'speak_blind_en') {
          isBlindStageActiveRef.current = false;
          setIsBlindStageActive(false);
          setBlindEnglishUnlocked(true);
          blindErrorCountRef.current = 0;
          setBlindErrorCount(0);
        }

        // Execute all non-speaking steps configured between currentSeqPos + 1 and nextSeqPos
        // (such as 'pt', 'en', 'en_slow', 'literal' [Revisão Automática], and 'challenges' [Desafios]!)
        for (let s = currentSeqPos + 1; s < nextSeqPos; s++) {
          if (!isEvalValid()) return;
          stopAllAudioPlayback();
          const stepType = effectiveSequence[s];
          setActiveSequenceStepIdx(s);

          if (stepType === 'pt' && targetPt) {
            setChallengeUnlocked(true);
            setActiveCardHighlight('pt');
            await speakText(targetPt, 'pt-BR', 1.0);
            setActiveCardHighlight(null);
            if (!isEvalValid()) return;
          } else if (stepType === 'en') {
            setActiveCardHighlight('en');
            await speakText(targetText, 'en-US', 1.0);
            setActiveCardHighlight(null);
            if (!isEvalValid()) return;
          } else if (stepType === 'en_slow') {
            setActiveCardHighlight('en');
            await speakText(targetText, 'en-US', 0.72);
            setActiveCardHighlight(null);
            if (!isEvalValid()) return;
          } else if (stepType === 'literal') {
            await readWordByWordReview(targetText, evalToken, false, false);
            if (!isEvalValid()) return;
          } else if (isChallengeStepCard(stepType) && !isIntermediateSubClause) {
            setStateBadgeText('🏆 Etapa de Desafios!');
            setStateBadgeColor('text-purple-300');
            const challengeOutcome = await runPostSentenceChallenges(
              curr.en,
              idx,
              true,
              stepType as 'challenges' | 'challenge_pronunciation' | 'challenge_matching'
            );
            stopAllAudioPlayback();
            if (!isEvalValid()) return;

            const resolution = resolveChallengeResolution(challengeOutcome, false);
            if (resolution.action === 'stay_free') {
              manualSpeakStageIdxRef.current = 0;
              setActiveSequenceStepIdx(null);
              setEnginePhase('IDLE');
              setStateBadgeText('Pronto');
              setStateBadgeColor('text-slate-300');
              showToast('Desafio fechado — permanecendo nesta sentença.');
              return;
            }

            if (resolution.action === 'repeat_sentence') {
              activeStepIdxRef.current = 0;
              setActiveStepIdx(0);
              setCompletedStepIndices([]);
              setChallengeUnlocked(false);
              setBlindEnglishUnlocked(false);
              isBlindStageActiveRef.current = false;
              setIsBlindStageActive(false);
              setActiveSequenceStepIdx(null);
              manualSpeakStageIdxRef.current = 0;
              setLastScore(null);
              setWordResults([]);
              setStateBadgeText('Repetindo sentença...');
              setStateBadgeColor('text-amber-300');
              showToast('Repetindo a sentença para reforçar as palavras do desafio!');
              await speakText(curr.en, 'en-US');
              if (isEvalValid()) {
                setEnginePhase('IDLE');
                setStateBadgeText('Pronto');
                setStateBadgeColor('text-slate-300');
              }
              return;
            }
          }
        }

        if (!isEvalValid()) return;
        stopAllAudioPlayback();

        // If there is another speaking step in effectiveSequence (e.g. 'speak_blind_en' after 'speak'), transition into it!
        if (hasMoreSpeakSteps) {
          manualSpeakStageIdxRef.current = nextSpeakStageIdx;
          const nextSpeakCard = effectiveSequence[nextSeqPos];
          activeSequenceStepIdxRef.current = nextSeqPos;
          setActiveSequenceStepIdx(nextSeqPos);
          if (pausedResumeSeqIdxRef.current !== null) {
            pausedResumeSeqIdxRef.current = nextSeqPos;
            setPausedResumeSeqIdx(nextSeqPos);
          }

          if (nextSpeakCard === 'speak_blind_en') {
            isBlindStageActiveRef.current = true;
            setIsBlindStageActive(true);
            setBlindEnglishUnlocked(false);
            blindErrorCountRef.current = 0;
            setBlindErrorCount(0);
            setLastScore(null);
            setWordResults([]);
            setUserTranscript('🧠 Modo sem ler o inglês: olhe apenas o português e fale!');
            setStateBadgeText('🧠 Etapa Sem Ler EN: Olhe apenas o PT e fale!');
            setStateBadgeColor('text-emerald-300');
            showToast(
              '🧠 Etapa Falar Sem Inglês: O texto em inglês foi ocultado! Agora fale olhando apenas o português.'
            );
          } else if (nextSpeakCard === 'speak_challenge') {
            isBlindStageActiveRef.current = false;
            setIsBlindStageActive(false);
            setChallengeUnlocked(false);
            setStateBadgeText(
              `🔒 Etapa de Fala (${nextSpeakStageIdx + 1}/${speakStepPositions.length}): Sem PT!`
            );
            setStateBadgeColor('text-amber-300');
            showToast(
              `🔒 Etapa de Fala ${nextSpeakStageIdx + 1}/${speakStepPositions.length}: Pronuncie com PT oculto!`
            );
          } else {
            isBlindStageActiveRef.current = false;
            setIsBlindStageActive(false);
            setStateBadgeText(
              `🎤 Etapa de Fala (${nextSpeakStageIdx + 1}/${speakStepPositions.length}) — Fale novamente!`
            );
            setStateBadgeColor('text-emerald-300');
            showToast(
              `🔁 Etapa de Fala (${nextSpeakStageIdx + 1}/${speakStepPositions.length}): Pronuncie mais uma vez para fixar!`
            );
          }
          if (!isEvalValid()) return;

          const handlePausedSecondSpeakStage = () => {
            fallbackCancelledByUserRef.current = false;
            setEnginePhase('IDLE');
            setStateBadgeText(
              nextSpeakCard === 'speak_blind_en'
                ? '🧠 Pronto p/ Falar Sem Inglês'
                : `🎤 Pronto p/ ${nextSpeakStageIdx + 1}ª Fala`
            );
            setStateBadgeColor('text-emerald-300');
            setUserTranscript(
              'Clique em "Falar Agora" quando estiver pronto para concluir esta etapa de fala!'
            );
          };

          if (lastInputWasSimulatorRef.current) {
            let settled = false;
            const resolveSimulatorNext = (nextSpoken: string) => {
              if (settled) return;
              settled = true;
              abortFallbackSpeechRef.current = null;
              setFallbackSpeechRequest(null);
              if (!isEvalValid()) return;
              if (nextSpoken && nextSpoken.trim().length > 0) {
                evaluateTargetOrStep(nextSpoken, idx, curr);
              } else {
                handlePausedSecondSpeakStage();
              }
            };
            abortFallbackSpeechRef.current = () => resolveSimulatorNext('');
            setFallbackSpeechRequest({
              target: targetText,
              resolve: resolveSimulatorNext
            });
          } else {
            const nextSpoken = await listenForSpeech(targetText);
            if (!isEvalValid()) return;
            if (nextSpoken && nextSpoken.trim().length > 0) {
              await evaluateTargetOrStep(nextSpoken, idx, curr);
            } else {
              handlePausedSecondSpeakStage();
            }
          }
          return;
        }

        // All steps in the sequence for this sentence/sub-step have finished!
        manualSpeakStageIdxRef.current = 0;
        isBlindStageActiveRef.current = false;
        setIsBlindStageActive(false);
        setActiveSequenceStepIdx(null);

        if (isIntermediateSubClause && activeStudyStep) {
          setCompletedStepIndices(prev =>
            prev.includes(activeStepIdx) ? prev : [...prev, activeStepIdx]
          );
          setStateBadgeText(`Parte concluída! (${score}%)`);
          setStateBadgeColor('text-emerald-300');
          showToast(`✓ ${activeStudyStep.label} dominada (${score}%)!`);

          setChallengeUnlocked(false);
          setBlindEnglishUnlocked(false);
          blindErrorCountRef.current = 0;
          setBlindErrorCount(0);
          setLastScore(null);
          setWordResults([]);
          const nextStepIndex = Math.min(studySteps.length - 1, activeStepIdx + 1);
          activeStepIdxRef.current = nextStepIndex;
          setActiveStepIdx(nextStepIndex);
          const nextStepObj = studySteps[nextStepIndex];
          if (nextStepObj) {
            await playStepBilingualPreview(
              nextStepObj.text,
              nextStepObj.ptText || curr.pt,
              !nextStepObj.isFull
            );
            if (currentIndexRef.current === idx && !isPlayingLoopRef.current) {
              setUserTranscript(
                `${nextStepObj.label} pronta — toque em "Falar Agora" ou "Iniciar Treino".`
              );
            }
          }
        } else {
          if (isStepByStepMode && activeStudyStep) {
            setCompletedStepIndices(prev =>
              prev.includes(activeStepIdx) ? prev : [...prev, activeStepIdx]
            );
          }
          setStateBadgeText('Excelente!');
          setStateBadgeColor('text-emerald-300');
          showToast(`Excelente pronúncia! (${score}%)`);
          setBlindEnglishUnlocked(false);

          if (idx + 1 < sentencesRef.current.length) {
            delete sentenceWordMistakeCountsRef.current[idx + 1];
            jumpToSentence(idx + 1);
          } else {
            setEnginePhase('COMPLETED');
            playChime('success', settingsRef.current.audioBeeps);
            setIsBookCompletedOpen(true);
          }
        }
      } else {
        playChime('retry', settingsRef.current.audioBeeps);
        setEnginePhase('IDLE');
        const firstSpeakInSeq = effectiveSequence.find(c => isSpeakStepCard(c));

        const isBlindAttempt =
          isBlindStageActiveRef.current ||
          currentSpeakCard === 'speak_blind_en' ||
          firstSpeakInSeq === 'speak_blind_en';

        if (isBlindAttempt) {
          const nextErrCount = blindErrorCountRef.current + 1;
          blindErrorCountRef.current = nextErrCount;
          setBlindErrorCount(nextErrCount);
          const maxBlindErrors = settingsRef.current.blindMaxErrorsBeforeReveal ?? 2;

          if (maxBlindErrors > 0 && nextErrCount >= maxBlindErrors) {
            setBlindEnglishUnlocked(true);
            setStateBadgeText(`👀 Inglês revelado após ${nextErrCount} erro(s)!`);
            setStateBadgeColor('text-amber-300');
            showToast(
              `👀 Você errou ${nextErrCount}x sem ler — o texto em inglês foi mostrado novamente para ajudar!`
            );
            return;
          }

          setStateBadgeText(
            maxBlindErrors > 0
              ? `Sem ler EN (${nextErrCount}/${maxBlindErrors} erros p/ revelar)`
              : 'Tente novamente sem ler'
          );
          setStateBadgeColor('text-amber-300');
          showToast(
            maxBlindErrors > 0
              ? `Tente mais uma vez! (${nextErrCount}/${maxBlindErrors} erros antes de mostrar o inglês)`
              : 'Tente mais uma vez.'
          );
        } else {
          setStateBadgeText('Tente novamente');
          setStateBadgeColor('text-amber-300');
          showToast('Tente mais uma vez.');
        }
      }
    },
    [
      activeStepIdx,
      activeStudyStep,
      applyEvaluationFeedback,
      isStepByStepMode,
      jumpToSentence,
      listenForSpeech,
      playStepBilingualPreview,
      readWordByWordReview,
      runPostSentenceChallenges,
      showToast,
      speakText,
      stopVoiceRecordingAndAnalyser,
      studySteps
    ]
  );

  // Synchronize active speaking step visual state before manual mic or speech simulator
  const syncManualSpeakStageState = useCallback(() => {
    const isSubClause = Boolean(
      isStepByStepMode &&
        activeStudyStep &&
        !activeStudyStep.isFull &&
        activeStepIdx + 1 < studySteps.length
    );
    const seq = buildEffectiveCardSequence(settingsRef.current, {
      isStepByStepMode,
      isSubClauseStep: isSubClause
    });
    const speakStepPositions = seq
      .map((c, i) => (isSpeakStepCard(c) ? i : -1))
      .filter(i => i >= 0);
    const stageIdx = Math.min(
      manualSpeakStageIdxRef.current,
      Math.max(0, speakStepPositions.length - 1)
    );
    manualSpeakStageIdxRef.current = stageIdx;
    const seqPos = speakStepPositions[stageIdx] ?? -1;
    if (seqPos >= 0) {
      setActiveSequenceStepIdx(seqPos);
      const card = seq[seqPos];
      if (card === 'speak_blind_en') {
        isBlindStageActiveRef.current = true;
        setIsBlindStageActive(true);
      } else if (card === 'speak_challenge') {
        isBlindStageActiveRef.current = false;
        setIsBlindStageActive(false);
        setChallengeUnlocked(false);
      } else {
        isBlindStageActiveRef.current = false;
        setIsBlindStageActive(false);
      }
    }
  }, [activeStepIdx, activeStudyStep, isStepByStepMode, studySteps.length]);

  // Manual Mic Record / Evaluation (Free Mode — cleanly pauses any active Training Loop)
  const handleManualMic = useCallback(async () => {
    unlockAudioSession();
    const idx = currentIndexRef.current;
    const curr = sentencesRef.current[idx];
    if (!curr) return;

    const wasLooping = isPlayingLoopRef.current;
    pauseLoopForManualControl(wasLooping ? '⏸️ Treino pausado para fala manual.' : undefined);
    activeStepTokenRef.current += 1;
    const micToken = activeStepTokenRef.current;

    lastInputWasSimulatorRef.current = false;
    setMobileSelectedPanel(prev => (prev === 'all' ? 'all' : 'speak'));
    syncManualSpeakStageState();
    const targetText =
      isStepByStepMode && activeStudyStep ? activeStudyStep.text : curr.en;
    const spoken = await listenForSpeech(targetText);

    if (
      micToken !== activeStepTokenRef.current ||
      currentIndexRef.current !== idx ||
      isPlayingLoopRef.current
    ) {
      return;
    }

    if (spoken && spoken.trim().length > 0) {
      evaluateTargetOrStep(spoken, idx, curr);
    } else {
      setActiveSequenceStepIdx(null);
      setEnginePhase('IDLE');
      setStateBadgeText('Pronto');
      setStateBadgeColor('text-slate-300');
    }
  }, [
    activeStudyStep,
    evaluateTargetOrStep,
    isStepByStepMode,
    listenForSpeech,
    pauseLoopForManualControl,
    syncManualSpeakStageState
  ]);

  // Trigger simulated/typed speech dialog directly (Free Mode — cleanly pauses any active Training Loop)
  const handleOpenSpeechSimulator = useCallback(() => {
    const idx = currentIndexRef.current;
    const curr = sentencesRef.current[idx];
    if (!curr) return;

    const wasLooping = isPlayingLoopRef.current;
    pauseLoopForManualControl(
      wasLooping ? '⏸️ Treino pausado para entrada de fala manual.' : undefined
    );
    activeStepTokenRef.current += 1;
    const simToken = activeStepTokenRef.current;

    lastInputWasSimulatorRef.current = true;
    setMobileSelectedPanel(prev => (prev === 'all' ? 'all' : 'speak'));
    syncManualSpeakStageState();
    const targetText =
      isStepByStepMode && activeStudyStep ? activeStudyStep.text : curr.en;

    let settled = false;
    const finishSimulator = (spoken: string) => {
      if (settled) return;
      settled = true;
      abortFallbackSpeechRef.current = null;
      setFallbackSpeechRequest(null);
      if (
        simToken !== activeStepTokenRef.current ||
        currentIndexRef.current !== idx ||
        isPlayingLoopRef.current
      ) {
        return;
      }
      if (spoken && spoken.trim().length > 0) {
        evaluateTargetOrStep(spoken, idx, curr);
      } else {
        setActiveSequenceStepIdx(null);
        setEnginePhase('IDLE');
        setStateBadgeText('Pronto');
        setStateBadgeColor('text-slate-300');
      }
    };
    abortFallbackSpeechRef.current = () => finishSimulator('');
    setFallbackSpeechRequest({
      target: targetText,
      resolve: finishSimulator
    });
  }, [
    activeStudyStep,
    evaluateTargetOrStep,
    isStepByStepMode,
    pauseLoopForManualControl,
    syncManualSpeakStageState
  ]);

  // Open Post-Sentence Challenges directly on demand (Free Mode)
  const handleOpenChallengeManual = useCallback(
    async (
      specificType:
        | 'challenges'
        | 'challenge_pronunciation'
        | 'challenge_matching' = 'challenges'
    ) => {
      const idx = currentIndexRef.current;
      const curr = sentencesRef.current[idx];
      if (!curr) return;
      const wasLooping = isPlayingLoopRef.current;
      pauseLoopForManualControl(
        wasLooping ? '⏸️ Treino pausado para abrir o desafio.' : undefined
      );
      activeStepTokenRef.current += 1;
      const challengeToken = activeStepTokenRef.current;

      // Challenges test the full sentence: if currently on an intermediate sub-part, switch to 'Desafio Final: Frase Inteira'
      if (isStepByStepModeRef.current && studySteps.length > 1) {
        const finalStepIdx = studySteps.length - 1;
        activeStepIdxRef.current = finalStepIdx;
        setActiveStepIdx(finalStepIdx);
      }
      const outcome = await runPostSentenceChallenges(curr.en, idx, true, specificType);
      if (
        challengeToken !== activeStepTokenRef.current ||
        currentIndexRef.current !== idx ||
        isPlayingLoopRef.current
      ) {
        return;
      }

      const resolution = resolveChallengeResolution(outcome, false);
      if (resolution.action === 'stay_free') {
        setActiveSequenceStepIdx(null);
        setEnginePhase('IDLE');
        setStateBadgeText('Pronto');
        setStateBadgeColor('text-slate-300');
        return;
      }

      if (resolution.action === 'repeat_sentence') {
        activeStepIdxRef.current = 0;
        setActiveStepIdx(0);
        setCompletedStepIndices([]);
        setChallengeUnlocked(false);
        setBlindEnglishUnlocked(false);
        isBlindStageActiveRef.current = false;
        setIsBlindStageActive(false);
        manualSpeakStageIdxRef.current = 0;
        setLastScore(null);
        setWordResults([]);
        setStateBadgeText('Repetindo sentença...');
        setStateBadgeColor('text-amber-300');
        showToast('Repetindo a sentença para reforçar as palavras do desafio!');
        await speakText(curr.en, 'en-US');
        if (
          challengeToken === activeStepTokenRef.current &&
          currentIndexRef.current === idx &&
          !isPlayingLoopRef.current
        ) {
          setActiveSequenceStepIdx(null);
          setEnginePhase('IDLE');
          setStateBadgeText('Pronto');
          setStateBadgeColor('text-slate-300');
        }
      } else if (idx + 1 < sentencesRef.current.length) {
        jumpToSentence(idx + 1);
      } else {
        setEnginePhase('COMPLETED');
        playChime('success', settingsRef.current.audioBeeps);
        setIsBookCompletedOpen(true);
      }
    },
    [
      jumpToSentence,
      pauseLoopForManualControl,
      runPostSentenceChallenges,
      showToast,
      speakText,
      studySteps.length
    ]
  );

  // Restart current sentence/sub-part right before the "Falar sem ler o inglês" stage so users who forgot the English can re-listen & retry
  const handleRestartBeforeBlindStage = useCallback(async () => {
    const idx = currentIndexRef.current;
    const curr = sentencesRef.current[idx];
    if (!curr) return;

    const wasPlaying = isPlayingLoopRef.current;
    const inStepMode = isStepByStepModeRef.current;
    const steps = inStepMode
      ? splitSentenceIntoStudySteps(curr.en, 'forward', curr.pt)
      : [];
    const sIdx = inStepMode
      ? Math.max(0, Math.min(activeStepIdxRef.current, Math.max(0, steps.length - 1)))
      : 0;
    const stepObj = inStepMode ? steps[sIdx] : null;
    const isSubClause = Boolean(inStepMode && stepObj && !stepObj.isFull && sIdx + 1 < steps.length);
    const seq = buildEffectiveCardSequence(settingsRef.current, {
      isStepByStepMode: inStepMode,
      isSubClauseStep: isSubClause
    });

    const restartSeqIdx = findRestartSeqIdxBeforeBlind(seq, activeSequenceStepIdx);
    const restartCard = seq[restartSeqIdx];
    const blindIdx = seq.indexOf('speak_blind_en');
    const hasEnBeforeBlind =
      blindIdx > 0 && seq.slice(0, blindIdx).some(c => c === 'en' || c === 'en_slow');
    const targetEn = stepObj ? stepObj.text : curr.en;

    activeStepTokenRef.current += 1;
    const restartToken = activeStepTokenRef.current;
    fallbackCancelledByUserRef.current = false;
    abortFallbackSpeechRef.current?.();
    abortSpeechCaptureRef.current?.();
    stopUserVoicePlayback();

    isBlindStageActiveRef.current = false;
    setIsBlindStageActive(false);
    blindErrorCountRef.current = 0;
    setBlindErrorCount(0);
    setLastScore(null);
    setWordResults([]);
    setAiCoachFeedback(null);
    setMobileSelectedPanel(prev => (prev === 'all' ? 'all' : 'en'));

    if (wasPlaying) {
      stopAllAudioPlayback();
      manualSpeakStageIdxRef.current = 0;
      setBlindEnglishUnlocked(false);

      if (restartCard === 'speak_blind_en' && !hasEnBeforeBlind) {
        // Preset has no EN listening step prior to speak_blind_en: play/show EN once before retrying blind step
        setBlindEnglishUnlocked(true);
        setActiveSequenceStepIdx(restartSeqIdx);
        setActiveCardHighlight('en');
        setUserTranscript('🔄 Revendo o inglês antes de tentar Sem Ler...');
        setStateBadgeText('🔄 Revendo Inglês antes da etapa Sem Ler');
        setStateBadgeColor('text-brand-300');
        showToast('🔄 Revendo e ouvindo o inglês antes da etapa Sem Ler!');
        await speakText(targetEn, 'en-US', 0.92);
        if (restartToken !== activeStepTokenRef.current || !isPlayingLoopRef.current) return;
        setActiveCardHighlight(null);
        setBlindEnglishUnlocked(false);
      } else {
        setStateBadgeText('🔄 Voltando p/ rever o inglês...');
        setStateBadgeColor('text-brand-300');
        showToast('🔄 Voltando para rever o inglês antes da etapa Sem Ler!');
      }

      runShadowingStep(restartSeqIdx);
    } else {
      stopAllAudio();
      setBlindEnglishUnlocked(!hasEnBeforeBlind);
      const speakStageAtRestart = seq
        .slice(0, restartSeqIdx)
        .filter(c => isSpeakStepCard(c)).length;
      manualSpeakStageIdxRef.current = speakStageAtRestart;
      setActiveSequenceStepIdx(restartSeqIdx);
      setUserTranscript('🔄 Revise o inglês e tente novamente a etapa Sem Ler!');
      showToast('🔄 Voltando para rever o inglês antes da etapa Sem Ler!');
      const audioKey = restartCard === 'en_slow' ? 'en_slow' : 'en';
      const speed = restartCard === 'en_slow' ? 0.72 : 1.0;
      runManualAudioPlayback(audioKey, 'en', targetEn, 'en-US', speed, false, true);
    }
  }, [
    activeSequenceStepIdx,
    runManualAudioPlayback,
    runShadowingStep,
    showToast,
    speakText,
    stopAllAudio,
    stopUserVoicePlayback
  ]);

  // Next sentence button handler: navigates directly to the next sentence
  const handleNextSentenceButton = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx + 1 < sentencesRef.current.length) {
      navigateSentence(1);
    } else {
      setEnginePhase('COMPLETED');
      playChime('success', settingsRef.current.audioBeeps);
      setIsBookCompletedOpen(true);
    }
  }, [navigateSentence]);

  // Skip individual word-by-word reading in Card 03 and jump immediately to the next step
  const handleSkipWordByWord = useCallback(() => {
    const wasReadingWords = isReadingWords;
    const plan = resolveLoopInterruptionPlan({
      isPlayingLoop: isPlayingLoopRef.current,
      isReadingWords,
      isManualWordReview: isManualWordReviewRef.current,
      actionKind: 'skip_word_by_word'
    });

    if (wasReadingWords) {
      skipWordReviewRef.current = true;
      if (abortWordReviewRef.current) {
        const abortFn = abortWordReviewRef.current;
        abortWordReviewRef.current = null;
        abortFn();
      }
      stopAllAudioPlayback();
      setHighlightedWordIdx(null);
      setIsReadingWords(false);
      setIsSpeakingTTS(false);
      showToast('Revisão das palavras pulada! Avançando para a próxima etapa...');

      // Inside an active training loop ('literal' step), resolving early lets runShadowingStep proceed directly to the next step (e.g. Desafios)
      if (plan === 'skip_loop_word_review') {
        return;
      }
    }

    // In step-by-step mode, advance cleanly to the next sub-part (restarting the loop only if it was active)
    if (
      isStepByStepModeRef.current &&
      activeStudyStep &&
      !activeStudyStep.isFull &&
      activeStepIdxRef.current + 1 < studySteps.length
    ) {
      const shouldRestartLoop = plan === 'restart_loop_if_active';
      stopAllAudio();
      const curStepIdx = activeStepIdxRef.current;
      const nextStepIdx = curStepIdx + 1;
      setCompletedStepIndices(prev => (prev.includes(curStepIdx) ? prev : [...prev, curStepIdx]));
      activeStepIdxRef.current = nextStepIdx;
      setActiveStepIdx(nextStepIdx);
      manualSpeakStageIdxRef.current = 0;
      isBlindStageActiveRef.current = false;
      setIsBlindStageActive(false);
      setBlindEnglishUnlocked(false);
      blindErrorCountRef.current = 0;
      setBlindErrorCount(0);
      setChallengeUnlocked(false);
      setActiveSequenceStepIdx(null);
      setLastScore(null);
      setWordResults([]);
      setUserTranscript('Aguardando próxima fala...');
      if (!wasReadingWords) {
        showToast(`Pulando para ${studySteps[nextStepIdx]?.label || 'próxima parte'}...`);
      }
      if (shouldRestartLoop) {
        setEnginePhase('PAUSED');
        setStateBadgeText('Avançando parte...');
        setStateBadgeColor('text-brand-300');
        runShadowingStep();
      } else {
        setEnginePhase('IDLE');
        setStateBadgeText('Pronto');
        setStateBadgeColor('text-slate-300');
      }
      return;
    }

    handleNextSentenceButton();
  }, [
    activeStudyStep,
    handleNextSentenceButton,
    isReadingWords,
    runShadowingStep,
    showToast,
    stopAllAudio,
    studySteps
  ]);

  // Play recorded user voice (single-instance guard prevents overlapping playback on multiple clicks)
  const handlePlayUserRecording = useCallback(() => {
    if (!lastUserAudioUrl) {
      showToast('Grave sua fala no microfone primeiro para poder ouvir sua própria voz!');
      return;
    }
    if (userAudioPlaybackRef.current) {
      stopUserVoicePlayback();
      return;
    }
    stopAllAudioPlayback();
    const audio = new Audio(lastUserAudioUrl);
    userAudioPlaybackRef.current = audio;
    setIsPlayingUserAudio(true);

    const cleanup = () => {
      if (userAudioPlaybackRef.current === audio) {
        userAudioPlaybackRef.current = null;
      }
      setIsPlayingUserAudio(false);
    };

    audio.onended = cleanup;
    audio.onerror = cleanup;
    audio.play().catch(cleanup);
  }, [lastUserAudioUrl, showToast, stopUserVoicePlayback]);

  // Vocabulary & SRS Management
  const handleSaveVocabItem = useCallback(
    (word: string, formattedSentence: string) => {
      if (!word) return;
      const prev = savedVocabRef.current;
      const exists = prev.some(v => v.word.toLowerCase() === word.toLowerCase());
      if (exists) {
        showToast(`"${word}" já está no seu caderno.`);
        return;
      }
      const next: VocabItem[] = [
        {
          word,
          sentence: formattedSentence,
          date: new Date().toLocaleDateString('pt-BR'),
          interval: 0,
          repetition: 0,
          efactor: 2.5,
          nextReviewDate: new Date().toISOString()
        },
        ...prev
      ];
      savedVocabRef.current = next;
      setSavedVocab(next);
      ShadowRepository.vocab.save(next);
      showToast(`Palavra "${word}" salva no caderno com SRS!`);
    },
    [showToast]
  );

  const handleRateSrsItem = useCallback(
    (word: string, quality: 2 | 4 | 5) => {
      const next = savedVocabRef.current.map(item =>
        item.word === word ? calculateSrsNextReview(item, quality) : item
      );
      savedVocabRef.current = next;
      setSavedVocab(next);
      ShadowRepository.vocab.save(next);
      const msgMap: Record<2 | 4 | 5, string> = {
        2: 'Marcado como Difícil: será revisado ainda hoje.',
        4: 'Bom! Próxima revisão agendada no SRS.',
        5: 'Fácil! Intervalo de memória ampliado.'
      };
      showToast(msgMap[quality]);
    },
    [showToast]
  );

  const handleSaveCurrentSentence = useCallback(() => {
    if (!currentSentence) return;
    const nextItem: VocabItem = {
      word: 'Frase Completa',
      sentence: `${currentSentence.en} — (${currentSentence.pt})`,
      date: new Date().toLocaleDateString('pt-BR'),
      interval: 0,
      repetition: 0,
      efactor: 2.5,
      nextReviewDate: new Date().toISOString()
    };
    const next = [nextItem, ...savedVocabRef.current];
    savedVocabRef.current = next;
    setSavedVocab(next);
    ShadowRepository.vocab.save(next);
    showToast('Frase salva com sucesso!');
  }, [currentSentence, showToast]);

  const handleDeleteVocabItem = useCallback((idx: number) => {
    const next = savedVocabRef.current.filter((_, i) => i !== idx);
    savedVocabRef.current = next;
    setSavedVocab(next);
    ShadowRepository.vocab.save(next);
  }, []);

  const handleClearAllVocab = useCallback(() => {
    savedVocabRef.current = [];
    setSavedVocab([]);
    ShadowRepository.vocab.save([]);
    showToast('Caderno de vocabulário limpo.');
  }, [showToast]);

  // Pocket Mode with WakeLock (does not auto-start training; user must click Iniciar Treino)
  const handleEnterPocketMode = useCallback(async () => {
    unlockAudioSession();
    setIsPocketMode(true);
    try {
      if ('wakeLock' in navigator) {
        wakeLockSentinelRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch {
      // ignore
    }
  }, []);

  const handleExitPocketMode = useCallback(() => {
    setIsPocketMode(false);
    if (wakeLockSentinelRef.current) {
      try {
        wakeLockSentinelRef.current.release();
        wakeLockSentinelRef.current = null;
      } catch {
        // ignore
      }
    }
  }, []);

  // Book selection & upload handlers
  const handleSelectBook = useCallback(
    async (book: Book, resumeIndex = 0) => {
      stopLoop(false);
      const validIdx = Math.max(0, Math.min(resumeIndex, book.sentences.length - 1));
      completedChallengeIndicesRef.current.clear();
      sentenceWordMistakeCountsRef.current = {};
      isBlindStageActiveRef.current = false;
      setIsBlindStageActive(false);
      setBlindEnglishUnlocked(false);
      manualSpeakStageIdxRef.current = 0;
      activeStepIdxRef.current = 0;
      setActiveStepIdx(0);
      setCompletedStepIndices([]);
      setCurrentBookId(book.id);
      setCurrentBookTitle(book.title);
      setSentences([...book.sentences]);
      setCurrentIndex(validIdx);
      setSentenceProgress(book.sentenceProgress || {});
      currentIndexRef.current = validIdx;
      sentencesRef.current = [...book.sentences];
      setStreak(0);
      setChallengeUnlocked(false);
      setLastScore(null);
      setWordResults([]);

      try {
        const saved = await ShadowRepository.books.save({
          ...book,
          currentIndex: validIdx
        });
        await refreshSavedBooksList();
        if (!saved) {
          showToast(
            '⚠️ Livro aberto, mas não foi possível salvar no dispositivo (armazenamento cheio).'
          );
          return;
        }
        showToast(`Lendo "${book.title}" na sentença ${validIdx + 1}`);
      } catch {
        showToast('⚠️ Livro aberto, mas ocorreu um erro ao salvar o progresso local.');
      }
    },
    [refreshSavedBooksList, showToast, stopLoop]
  );

  const handleUploadBook = useCallback(
    async (newBook: Book) => {
      stopLoop(false);
      if (!newBook.sentences || newBook.sentences.length === 0) {
        showToast('⚠️ Nenhuma frase encontrada neste arquivo. Verifique o formato e tente novamente.');
        return;
      }

      // Copy-on-write: never mutate the object received from the parser.
      let firstPt = '';
      try {
        firstPt = await fetchSentenceTranslation(newBook.sentences[0].en);
      } catch {
        // Offline/translation failure must not abort the import: the sentence
        // keeps its placeholder and is translated on demand later.
        firstPt = '';
      }
      const preparedBook: Book = {
        ...newBook,
        sentences: newBook.sentences.map((sentence, idx) =>
          idx === 0 ? { ...sentence, pt: firstPt } : { ...sentence }
        )
      };

      completedChallengeIndicesRef.current.clear();
      sentenceWordMistakeCountsRef.current = {};
      isBlindStageActiveRef.current = false;
      setIsBlindStageActive(false);
      setBlindEnglishUnlocked(false);
      manualSpeakStageIdxRef.current = 0;
      activeStepIdxRef.current = 0;
      setActiveStepIdx(0);
      setCompletedStepIndices([]);
      setCurrentBookId(preparedBook.id);
      setCurrentBookTitle(preparedBook.title);
      setSentences([...preparedBook.sentences]);
      setCurrentIndex(0);
      setSentenceProgress({});
      currentIndexRef.current = 0;
      sentencesRef.current = [...preparedBook.sentences];
      setStreak(0);
      setChallengeUnlocked(false);
      setLastScore(null);
      setWordResults([]);

      try {
        const saved = await ShadowRepository.books.save(preparedBook);
        await refreshSavedBooksList();
        if (!saved) {
          showToast(
            `⚠️ Livro "${preparedBook.title}" aberto, mas não foi possível salvar no dispositivo (armazenamento cheio).`
          );
          return;
        }
        showToast(
          `Livro "${preparedBook.title}" salvo na memória! O app lembrará de onde você parou.`
        );
      } catch {
        showToast(`⚠️ Livro "${preparedBook.title}" aberto, mas o salvamento local falhou.`);
      }
    },
    [refreshSavedBooksList, showToast, stopLoop]
  );

  const handleDeleteSavedBook = useCallback(
    async (bookId: string, title: string) => {
      const wasActive = bookId === currentBookId;
      const removed = await ShadowRepository.books.remove(bookId);
      if (!removed) {
        showToast(`⚠️ Não foi possível remover "${title}". Tente novamente.`);
        return;
      }
      try {
        localStorage.removeItem(`sr_bookmark_${bookId}`);
        if (wasActive) localStorage.removeItem('sr_active_book_id');
      } catch {
        // ignore storage errors
      }
      await refreshSavedBooksList();

      if (wasActive) {
        const remaining = await ShadowRepository.books.listAll();
        const nextBook = remaining.find(b => b.id !== bookId);
        await handleSelectBook(nextBook || SAMPLE_BOOKS[0], nextBook?.currentIndex || 0);
      }

      showToast(`Livro "${title}" removido dos salvos.`);
    },
    [currentBookId, handleSelectBook, refreshSavedBooksList, showToast]
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        // Close only the topmost layer: stacked modals (e.g. Dictionary over
        // Stats) used to be dismissed all at once.
        if (fallbackSpeechRequest) {
          fallbackCancelledByUserRef.current = true;
          fallbackSpeechRequest.resolve('');
          setFallbackSpeechRequest(null);
          return;
        }
        if (postSentenceChallengeRequest) {
          postSentenceChallengeRequest.resolve('cancel');
          return;
        }
        if (dictWord !== null) {
          setDictWord(null);
          return;
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          return;
        }
        if (isLibraryOpen) {
          setIsLibraryOpen(false);
          return;
        }
        if (isVocabOpen) {
          setIsVocabOpen(false);
          return;
        }
        if (isStatsOpen) {
          setIsStatsOpen(false);
          return;
        }
        if (isSentenceNavOpen) {
          setIsSentenceNavOpen(false);
          return;
        }
        if (isDriveSyncModalOpen) {
          setIsDriveSyncModalOpen(false);
          return;
        }
        if (isDonateModalOpen) {
          setIsDonateModalOpen(false);
          return;
        }
        if (isBookCompletedOpen) {
          setIsBookCompletedOpen(false);
          return;
        }
        return;
      }

      const anyModalOpen =
        isSettingsOpen ||
        isLibraryOpen ||
        isVocabOpen ||
        isStatsOpen ||
        isSentenceNavOpen ||
        isDonateModalOpen ||
        isDriveSyncModalOpen ||
        dictWord !== null ||
        isBookCompletedOpen ||
        fallbackSpeechRequest !== null ||
        postSentenceChallengeRequest !== null;

      if (anyModalOpen) return;

      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlayingLoopRef.current) {
          stopLoop();
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        navigateSentence(1);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        navigateSentence(-1);
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        if (currentSentence) {
          runManualAudioPlayback(
            'en',
            'en',
            isStepByStepMode && activeStudyStep ? activeStudyStep.text : currentSentence.en,
            'en-US'
          );
        }
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        if (currentSentence) {
          runManualAudioPlayback(
            'pt',
            'pt',
            isStepByStepMode && activeStudyStep && activeStudyStep.ptText
              ? activeStudyStep.ptText
              : currentSentence.pt,
            'pt-BR'
          );
        }
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleManualMic();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeStudyStep,
    currentSentence,
    dictWord,
    fallbackSpeechRequest,
    handleManualMic,
    isBookCompletedOpen,
    isDonateModalOpen,
    isDriveSyncModalOpen,
    isLibraryOpen,
    isSentenceNavOpen,
    isSettingsOpen,
    isStatsOpen,
    isStepByStepMode,
    isVocabOpen,
    navigateSentence,
    postSentenceChallengeRequest,
    runManualAudioPlayback,
    stopLoop
  ]);

  // Global first-gesture audio session unlock for iOS Safari / Android Chrome autoplay policies
  useEffect(() => {
    const onFirstGesture = () => {
      unlockAudioSession();
    };
    window.addEventListener('pointerdown', onFirstGesture, { once: true, passive: true });
    window.addEventListener('touchstart', onFirstGesture, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('touchstart', onFirstGesture);
    };
  }, []);

  // Computed Pedagogical Metadata for Current Sentence
  const progressPct = Math.round(((currentIndex + 1) / Math.max(1, sentences.length)) * 100);
  const isCurrentSubClauseStep = Boolean(
    isStepByStepMode &&
      activeStudyStep &&
      !activeStudyStep.isFull &&
      activeStepIdx + 1 < studySteps.length
  );
  const effectiveCardSequence = useMemo(
    () =>
      buildEffectiveCardSequence(settings, {
        isStepByStepMode,
        isSubClauseStep: isCurrentSubClauseStep
      }),
    [settings, isStepByStepMode, isCurrentSubClauseStep]
  );

  useEffect(() => {
    if (!effectiveCardSequence.includes('speak_blind_en') && isBlindStageActive) {
      isBlindStageActiveRef.current = false;
      setIsBlindStageActive(false);
    }
  }, [effectiveCardSequence, isBlindStageActive]);

  const firstSpeakCardInSeq = useMemo(
    () =>
      effectiveCardSequence.find(
        c => c === 'speak' || c === 'speak_blind_en' || c === 'speak_challenge'
      ),
    [effectiveCardSequence]
  );
  const visualCardsToRender = useMemo<VisualCardType[]>(
    () =>
      Array.isArray(settings.visualCardOrder) && settings.visualCardOrder.length > 0
        ? settings.visualCardOrder
        : ['pt', 'en', 'literal'],
    [settings.visualCardOrder]
  );
  const isChallengeLocked =
    (settings.audioFlow === 'challenge' || firstSpeakCardInSeq === 'speak_challenge') &&
    !challengeUnlocked;
  const firstBlindIdxInSeq = effectiveCardSequence.indexOf('speak_blind_en');
  const hasEnAudioBeforeBlind =
    firstBlindIdxInSeq > 0 &&
    effectiveCardSequence
      .slice(0, firstBlindIdxInSeq)
      .some(c => c === 'en' || c === 'en_slow');
  const isPlayingEnAudioNow =
    activeCardHighlight === 'en' || enginePhase === 'PLAYING_EN';
  const isEnglishTextHidden =
    !isPlayingEnAudioNow &&
    !blindEnglishUnlocked &&
    (isBlindStageActive ||
      (firstSpeakCardInSeq === 'speak_blind_en' && !hasEnAudioBeforeBlind));

  const mobileCardPlan = useMemo(
    () =>
      resolveMobileVisibleCards({
        isPlayingLoop,
        activeSequenceStepIdx,
        effectiveSequence: effectiveCardSequence,
        enginePhase,
        activeCardHighlight,
        isReadingWords,
        isListeningMic,
        isBlindEnglishStage: isBlindStageActive,
        blindEnglishUnlocked,
        isEnglishTextHidden,
        manualSelectedPanel: mobileSelectedPanel
      }),
    [
      isPlayingLoop,
      activeSequenceStepIdx,
      effectiveCardSequence,
      enginePhase,
      activeCardHighlight,
      isReadingWords,
      isListeningMic,
      isBlindStageActive,
      blindEnglishUnlocked,
      isEnglishTextHidden,
      mobileSelectedPanel
    ]
  );

  const isMobileFocusedLayout =
    isMobileViewport && settings.studyViewMode !== 'paragraph' && mobileCardPlan.isFocusedMode;
  const isMobileTrainingCompact = isMobileViewport && isPlayingLoop;

  // Trigger a specific step from the Interactive Sentence Step Order Bar (#sentenceStepOrderBar)
  const handleStepOrderChipClick = useCallback(
    async (stepType: StudyStepCardType, seqIdx: number) => {
      if (!currentSentence) return;

      const decision = resolveStepChipClickBehavior({
        isPlayingLoop: isPlayingLoopRef.current,
        pausedResumeSeqIdx: pausedResumeSeqIdxRef.current,
        clickedSeqIdx: seqIdx
      });

      // INSIDE ACTIVE TRAINING LOOP: jump directly to clicked stage pill and keep training continuously from there!
      if (decision.mode === 'jump_in_active_loop') {
        const meta = STEP_CARD_META[stepType] || STEP_CARD_META.en;
        activeStepTokenRef.current += 1;
        fallbackCancelledByUserRef.current = false;
        abortFallbackSpeechRef.current?.();
        abortSpeechCaptureRef.current?.();
        if (abortWordReviewRef.current) {
          const abortReview = abortWordReviewRef.current;
          abortWordReviewRef.current = null;
          abortReview();
        }
        pendingChallengeResolveRef.current?.('cancel');
        setPostSentenceChallengeRequest(null);
        stopUserVoicePlayback();
        stopAllAudioPlayback();
        setHighlightedWordIdx(null);
        setIsReadingWords(false);
        setIsSpeakingTTS(false);
        pausedResumeSeqIdxRef.current = null;
        setPausedResumeSeqIdx(null);
        manualSpeakStageIdxRef.current = 0;
        isBlindStageActiveRef.current = false;
        setIsBlindStageActive(false);
        setBlindEnglishUnlocked(false);
        blindErrorCountRef.current = 0;
        setBlindErrorCount(0);
        setLastScore(null);
        setWordResults([]);
        setAiCoachFeedback(null);
        activeSequenceStepIdxRef.current = seqIdx;
        setActiveSequenceStepIdx(seqIdx);

        showToast(`🔄 Continuando treino a partir de: ${meta.shortLabel}`);
        runShadowingStep(seqIdx);
        return;
      }

      // OUTSIDE TRAINING LOOP: execute ONLY this single step (if paused mid-training, update resume index for "Continuar Treino")
      if (decision.nextPausedResumeSeqIdx !== null) {
        pausedResumeSeqIdxRef.current = decision.nextPausedResumeSeqIdx;
        setPausedResumeSeqIdx(decision.nextPausedResumeSeqIdx);
      }

      const targetEn =
        isStepByStepMode && activeStudyStep ? activeStudyStep.text : currentSentence.en;
      const targetPt =
        isStepByStepMode && activeStudyStep && activeStudyStep.ptText
          ? activeStudyStep.ptText
          : currentSentence.pt;

      if (stepType === 'pt') {
        setChallengeUnlocked(true);
        activeSequenceStepIdxRef.current = seqIdx;
        setActiveSequenceStepIdx(seqIdx);
        await runManualAudioPlayback('pt', 'pt', targetPt, 'pt-BR', 1.0, false, true);
      } else if (stepType === 'en') {
        activeSequenceStepIdxRef.current = seqIdx;
        setActiveSequenceStepIdx(seqIdx);
        await runManualAudioPlayback('en', 'en', targetEn, 'en-US', 1.0, false, true);
      } else if (stepType === 'en_slow') {
        activeSequenceStepIdxRef.current = seqIdx;
        setActiveSequenceStepIdx(seqIdx);
        await runManualAudioPlayback('en_slow', 'en', targetEn, 'en-US', 0.72, false, true);
      } else if (stepType === 'literal') {
        activeSequenceStepIdxRef.current = seqIdx;
        setActiveSequenceStepIdx(seqIdx);
        activeStepTokenRef.current += 1;
        const manualToken = activeStepTokenRef.current;
        const skipped = await readWordByWordReview(targetEn, manualToken, false, true, 0);
        if (manualToken === activeStepTokenRef.current && !isPlayingLoopRef.current) {
          activeSequenceStepIdxRef.current = null;
          setActiveSequenceStepIdx(null);
          if (!skipped) {
            setEnginePhase('IDLE');
            setStateBadgeText('Pronto');
            setStateBadgeColor('text-slate-300');
          }
        }
      } else if (isChallengeStepCard(stepType)) {
        await handleOpenChallengeManual(
          stepType as 'challenges' | 'challenge_pronunciation' | 'challenge_matching'
        );
      } else if (isSpeakStepCard(stepType)) {
        const speakPositions = effectiveCardSequence
          .map((c, i) => (isSpeakStepCard(c) ? i : -1))
          .filter(i => i >= 0);
        const stageIdx = Math.max(0, speakPositions.indexOf(seqIdx));
        manualSpeakStageIdxRef.current = stageIdx;

        if (stepType === 'speak_blind_en') {
          isBlindStageActiveRef.current = true;
          setIsBlindStageActive(true);
          setBlindEnglishUnlocked(false);
          blindErrorCountRef.current = 0;
          setBlindErrorCount(0);
          setLastScore(null);
          setWordResults([]);
          setUserTranscript('🧠 Modo sem ler o inglês: olhe apenas o português e fale!');
        } else if (stepType === 'speak_challenge') {
          isBlindStageActiveRef.current = false;
          setIsBlindStageActive(false);
          setChallengeUnlocked(false);
        } else {
          isBlindStageActiveRef.current = false;
          setIsBlindStageActive(false);
        }
        handleManualMic();
      }
    },
    [
      activeStudyStep,
      currentSentence,
      effectiveCardSequence,
      handleManualMic,
      handleOpenChallengeManual,
      isStepByStepMode,
      readWordByWordReview,
      runManualAudioPlayback,
      runShadowingStep,
      showToast,
      stopUserVoicePlayback
    ]
  );
  const rawTokens = useMemo(
    () => (currentSentence ? currentSentence.en.split(/\s+/).filter(Boolean) : []),
    [currentSentence]
  );

  const currentCefr = useMemo(
    () =>
      currentSentence
        ? currentSentence.cefrLevel || classifySentenceCefr(currentSentence.en)
        : 'A1',
    [currentSentence]
  );

  const prosodyChunks = useMemo(
    () => (currentSentence ? splitIntoProsodyChunks(currentSentence.en) : []),
    [currentSentence]
  );

  const missedWordsList = useMemo(
    () => wordResults.filter(w => !w.matched).map(w => w.word),
    [wordResults]
  );

  const phoneticTips = useMemo(
    () =>
      currentSentence
        ? getSentencePhoneticTips(
            isStepByStepMode && activeStudyStep ? activeStudyStep.text : currentSentence.en,
            missedWordsList
          )
        : [],
    [activeStudyStep, currentSentence, isStepByStepMode, missedWordsList]
  );

  const dueSrsCount = useMemo(
    () => savedVocab.filter(v => isVocabDueForReview(v)).length,
    [savedVocab]
  );

  // Theme wrapper styles (CSS variables on [data-theme] in index.css adapt all slate/brand surfaces)
  const themeContainerClasses: Record<ThemeMode, string> = {
    dark: 'bg-slate-900 text-slate-100',
    light: 'bg-slate-900 text-slate-100',
    sepia: 'bg-slate-900 text-slate-100',
    forest: 'bg-slate-900 text-slate-100',
    ocean: 'bg-slate-900 text-slate-100',
    amethyst: 'bg-slate-900 text-slate-100'
  };

  return (
    <div
      id="appRoot"
      data-theme={settings.themeMode || 'dark'}
      data-font-scale={settings.fontSizeScale ?? 110}
      data-engine-phase={enginePhase}
      className={`h-full min-h-0 w-full ${
        themeContainerClasses[settings.themeMode || 'dark']
      } font-sans antialiased flex flex-col overflow-hidden overflow-x-hidden transition-colors duration-200`}
    >
      {/* TOP APP BAR */}
      <HeaderBar
        bookTitle={currentBookTitle}
        vocabCount={savedVocab.length}
        dueSrsCount={dueSrsCount}
        themeMode={settings.themeMode || 'dark'}
        driveSyncStatus={driveSyncStatus}
        onCycleTheme={handleCycleTheme}
        onOpenDonateCoffee={() => {
          stopLoop();
          setIsDonateModalOpen(true);
        }}
        onOpenDriveSync={() => {
          stopLoop();
          setIsDriveSyncModalOpen(true);
        }}
        onOpenStats={() => {
          stopLoop();
          setIsStatsOpen(true);
        }}
        onOpenLibrary={() => {
          stopLoop();
          setIsLibraryOpen(true);
        }}
        onOpenVocab={() => {
          stopLoop();
          setIsVocabOpen(true);
        }}
        onOpenSettings={() => {
          stopLoop();
          setSettingsInitialTab('models');
          setIsSettingsOpen(true);
        }}
      />

      {/* PROGRESS BAR */}
      <div className="w-full bg-slate-800 h-1 shrink-0 overflow-hidden">
        <div
          id="progressBar"
          className="bg-gradient-to-r from-brand-500 to-indigo-400 h-full transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* MAIN STUDY ARENA */}
      <main
        className={`no-scrollbar flex-1 min-h-0 ${
          isMobileFocusedLayout || (isMobileTrainingCompact && settings.studyViewMode === 'paragraph')
            ? 'overflow-y-hidden'
            : 'overflow-y-auto'
        } overflow-x-hidden px-3 ${
          isMobileTrainingCompact ? 'py-1.5 gap-1.5' : 'py-2 gap-1.5 sm:gap-2'
        } sm:px-6 lg:px-8 xl:px-10 sm:py-2.5 lg:py-3 flex flex-col lg:gap-2.5 max-w-4xl lg:max-w-5xl xl:max-w-[1380px] 2xl:max-w-[1480px] mx-auto w-full`}
      >
        {/* UPFRONT MICROPHONE PERMISSION BANNER (Hidden during active mobile training to preserve viewport budget) */}
        {!micPermissionGranted && !isMobileTrainingCompact && (
          <div
            id="micPermissionBanner"
            className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-2.5 py-1 sm:px-3 sm:py-2 shrink-0 flex items-center justify-between gap-2 text-xs text-indigo-200"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-[11px] font-medium leading-snug truncate">
                <span className="sm:hidden">Ative o microfone para falar.</span>
                <span className="hidden sm:inline">
                  Ative o microfone antes de iniciar para treinar a pronúncia com fluidez.
                </span>
              </span>
            </div>
            <button
              id="btnAllowMicBanner"
              type="button"
              onClick={() => requestMicrophonePermission(true)}
              className="min-h-[32px] sm:min-h-[38px] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] shadow shadow-indigo-600/30 transition active:scale-95 shrink-0 flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <span className="sm:hidden">Liberar Mic</span>
              <span className="hidden sm:inline">Liberar Microfone</span>
            </button>
          </div>
        )}

        {/* MOBILE BOOK TITLE & SWITCHER BAR (Visible < md in Free Mode; hidden during active training) */}
        {!isPlayingLoop && (
          <button
            id="mobileBookSelectorBar"
            type="button"
            onClick={() => {
              stopLoop();
              setIsLibraryOpen(true);
            }}
            className="md:hidden w-full min-h-[32px] flex items-center justify-between gap-2 px-2.5 py-0.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-[11px] transition cursor-pointer shrink-0"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-brand-400 shrink-0">📖</span>
              <span className="font-semibold text-slate-200 truncate">{currentBookTitle}</span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-bold shrink-0">
                {currentCefr}
              </span>
            </div>
            <span className="text-[10px] font-bold text-brand-300 shrink-0">
              Trocar ›
            </span>
          </button>
        )}

        {/* Status, Mode Switcher & Sentence Navigator Trigger Row */}
        <div
          className={`flex items-center justify-between gap-1.5 sm:gap-2 text-[11px] px-0.5 sm:px-1 shrink-0 ${
            isMobileTrainingCompact ? 'flex-nowrap' : 'flex-wrap'
          }`}
        >
          <div
            className={`flex items-center gap-1.5 sm:gap-2 min-w-0 ${
              isMobileTrainingCompact ? 'flex-nowrap flex-1' : 'flex-nowrap sm:flex-wrap w-full sm:w-auto justify-between sm:justify-start'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1 sm:flex-none">
              <span
                id="studyModeBadge"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold whitespace-nowrap shrink-0 ${
                  isPlayingLoop
                    ? 'bg-brand-600/25 border-brand-400/60 text-brand-200'
                    : 'bg-slate-800/90 border-slate-700/80 text-slate-300'
                }`}
                title={
                  isPlayingLoop
                    ? 'Ciclo Guiado ativo: etapas avançam automaticamente até você pausar ou acionar um controle manual'
                    : 'Modo Livre: ouça e pratique qualquer card ou etapa no seu próprio ritmo'
                }
              >
                {isPlayingLoop ? (
                  isMobileTrainingCompact ? (
                    <>
                      <span className="sm:hidden">🔄 Treino</span>
                      <span className="hidden sm:inline">🔄 Ciclo Guiado</span>
                    </>
                  ) : (
                    '🔄 Ciclo Guiado'
                  )
                ) : (
                  '🧭 Modo Livre'
                )}
              </span>
              <span
                id="stateBadge"
                role="status"
                aria-live="polite"
                className={`font-semibold truncate min-w-0 ${
                  isMobileTrainingCompact ? 'flex-1 max-w-none' : 'max-w-[160px] sm:max-w-none'
                } ${isListeningMic ? 'text-rose-300 font-extrabold' : stateBadgeColor}`}
              >
                {isListeningMic ? '🎙️ MIC ABERTO!' : stateBadgeText}
              </span>
            </div>

            {!isMobileTrainingCompact && (
              <>
                <span aria-hidden="true" className="text-slate-600 hidden md:inline">
                  ·
                </span>
                <span className="hidden md:inline text-indigo-300 font-semibold whitespace-nowrap">
                  Nível {currentCefr}
                </span>
              </>
            )}
            {currentSentence?.actTitle && (
              <>
                <span aria-hidden="true" className="text-slate-600 hidden sm:inline">
                  ·
                </span>
                <span
                  id="actTitleBadge"
                  className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-bold"
                >
                  ⭐ {currentSentence.actTitle}
                </span>
              </>
            )}
            {streak > 1 && !isMobileTrainingCompact && (
              <>
                <span aria-hidden="true" className="text-slate-600 hidden sm:inline">
                  ·
                </span>
                <span id="streakBadge" className="text-amber-400 font-semibold tabular-nums shrink-0">
                  🔥 <span id="streakCount">{streak}</span>
                  <span className="hidden sm:inline"> seguidas</span>
                </span>
              </>
            )}
            {!isMobileTrainingCompact && (
              <button
                type="button"
                onClick={() => setIsSentenceNavOpen(true)}
                className="sm:hidden font-mono text-[11px] font-bold text-slate-300 hover:text-white underline decoration-slate-600 underline-offset-2 shrink-0 cursor-pointer tabular-nums"
                title="Abrir Índice e Navegador de Sentenças"
              >
                {currentIndex + 1}/{sentences.length}
              </button>
            )}
          </div>

          {/* Right Toolbar: Hands-Free Quick Toggle, View Mode (Cards / Página) & Sentence Index Button */}
          <div
            className={`flex items-center gap-1.5 sm:gap-2 text-slate-400 font-mono text-[11px] tabular-nums ${
              isMobileTrainingCompact
                ? 'w-auto shrink-0 flex-nowrap'
                : 'justify-between sm:justify-end flex-nowrap sm:flex-wrap w-full sm:w-auto'
            }`}
          >
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <div
                className={`${
                  isMobileTrainingCompact ? 'hidden md:flex' : 'flex'
                } items-center gap-0.5 bg-slate-800/90 p-0.5 rounded-lg border border-slate-700/70 font-sans`}
              >
                <button
                  id="btnViewCards"
                  type="button"
                  onClick={() => handleUpdateSettings({ studyViewMode: 'cards' })}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition cursor-pointer whitespace-nowrap ${
                    settings.studyViewMode !== 'paragraph'
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="sm:hidden">Cards</span>
                  <span className="hidden sm:inline">Modo Cards</span>
                </button>
                <button
                  id="btnViewParagraph"
                  type="button"
                  onClick={() => handleUpdateSettings({ studyViewMode: 'paragraph' })}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition cursor-pointer whitespace-nowrap ${
                    settings.studyViewMode === 'paragraph'
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="sm:hidden">Página</span>
                  <span className="hidden sm:inline">Modo Página</span>
                </button>
              </div>

              <button
                id="btnQuickCustomizeCards"
                type="button"
                onClick={() => {
                  stopLoop();
                  setSettingsInitialTab('custom_cards');
                  setIsSettingsOpen(true);
                }}
                title="Customizar ordem e repetição de cards em Configurações"
                className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700/70 hover:border-brand-500/50 text-[10px] font-semibold text-brand-300 transition cursor-pointer whitespace-nowrap"
              >
                <span>🎛️</span>
                <span>{formatCardSequenceSummary(buildEffectiveCardSequence(settings))}</span>
              </button>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                id="btnToggleHandsFreeMain"
                type="button"
                onClick={() => {
                  const nextHandsFree = !settings.autoHandsFree;
                  handleUpdateSettings({ autoHandsFree: nextHandsFree });
                  if (nextHandsFree) {
                    showToast(
                      '🙌 Modo Mãos Livres ATIVO! Clique em "Iniciar Treino" quando quiser começar.'
                    );
                  } else {
                    showToast('Modo Mãos Livres desativado.');
                  }
                }}
                title="Ativar ou desativar o Modo Mãos Livres (clique em Iniciar Treino para começar)"
                className={`min-h-[30px] sm:min-h-0 flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold transition cursor-pointer whitespace-nowrap font-sans ${
                  settings.autoHandsFree
                    ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400/50 shadow-xs'
                    : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700/70 text-slate-300 hover:text-white'
                }`}
              >
                <span>🙌</span>
                <span className="hidden sm:inline">
                  Mãos Livres: {settings.autoHandsFree ? 'ON' : 'OFF'}
                </span>
                <span className="sm:hidden">{settings.autoHandsFree ? 'ON' : 'OFF'}</span>
              </button>

              <button
                id="btnOpenVoiceAiHubQuick"
                type="button"
                onClick={() => {
                  stopLoop();
                  setSettingsInitialTab('voice_ai_hub');
                  setIsSettingsOpen(true);
                }}
                title="Abrir Central de Voz & IA (Provedores de TTS, STT e Coach Fonético)"
                className={`${
                  isMobileTrainingCompact ? 'hidden md:flex' : 'flex'
                } min-h-[30px] sm:min-h-0 items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/40 text-[10px] font-bold text-indigo-200 transition cursor-pointer whitespace-nowrap font-sans`}
              >
                <span>🎙️</span>
                <span>Voz & IA</span>
              </button>

              <button
                id="btnPocketModeQuick"
                type="button"
                onClick={handleEnterPocketMode}
                title="Modo Bolso (Bloqueia a tela contra toques acidentais enquanto caminha)"
                className="sm:hidden min-h-[30px] flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700/70 text-[10px] font-bold text-slate-200 transition cursor-pointer whitespace-nowrap font-sans"
              >
                <span>📱</span>
              </button>

              <button
                id="btnDonateCoffeeMobile"
                type="button"
                onClick={() => {
                  stopLoop();
                  setIsDonateModalOpen(true);
                }}
                aria-label="Apoiar o projeto — Pagar um café via Pix ou Cripto"
                title="Pague um café para apoiar o projeto (Pix ou Cripto)"
                className={`${
                  isMobileTrainingCompact ? 'hidden' : 'flex'
                } sm:hidden min-h-[30px] items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FFDD00] hover:bg-[#FFE63B] active:scale-95 border border-amber-300/80 text-[10px] font-extrabold text-[#18181b] transition cursor-pointer whitespace-nowrap font-sans shadow-xs`}
              >
                <CoffeeCupIcon className="w-3 h-3 shrink-0" />
                <span>Café</span>
              </button>

              <button
                id="btnSentenceNavigator"
                type="button"
                onClick={() => setIsSentenceNavOpen(true)}
                title="Abrir Índice e Navegador de Sentenças"
                className={`${
                  isMobileTrainingCompact ? 'inline-flex' : 'hidden sm:inline-flex'
                } hover:text-white underline decoration-slate-600 underline-offset-2 cursor-pointer whitespace-nowrap`}
              >
                <span id="sentenceIndexDisplay">
                  <span className="hidden sm:inline">Sentença </span>
                  {currentIndex + 1}/{sentences.length}
                </span>
              </button>
              {!isMobileTrainingCompact && (
                <>
                  <span aria-hidden="true" className="hidden sm:inline">
                    ·
                  </span>
                  <span
                    id="bookmarkSavedIndicator"
                    className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-400/90 font-sans font-medium"
                    title="Posição de leitura salva automaticamente na memória"
                  >
                    <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {bookmarkSaving ? 'Salvando...' : 'Salvo'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Learning Step Order Bar (Compact 1-row horizontal strip on mobile + high-contrast active highlight) */}
        <div
          id="sentenceStepOrderBar"
          className={`flex items-center justify-between gap-1.5 ${
            isMobileTrainingCompact ? 'px-2 py-1' : 'px-2 py-1 sm:px-2.5 sm:py-1.5'
          } md:flex-wrap rounded-xl bg-slate-900/90 border border-slate-800/90 shrink-0 text-[10px]`}
        >
          <div className="no-scrollbar flex items-center md:flex-wrap gap-1 min-w-0 flex-1 overflow-x-auto md:overflow-visible py-0.5">
            <span className="font-bold text-slate-400 mr-0.5 uppercase tracking-wider text-[9px] hidden sm:inline shrink-0">
              Etapas:
            </span>
            {effectiveCardSequence.map((stepType, seqIdx) => {
              const meta = STEP_CARD_META[stepType] || STEP_CARD_META.en;
              const isCurrentStep = activeSequenceStepIdx === seqIdx;
              const isStepDone =
                activeSequenceStepIdx !== null && seqIdx < activeSequenceStepIdx;
              const isStepUpcoming =
                activeSequenceStepIdx !== null && seqIdx > activeSequenceStepIdx;
              return (
                <React.Fragment key={`${stepType}-${seqIdx}`}>
                  <button
                    id={`btnStepOrderChip_${seqIdx}`}
                    type="button"
                    onClick={() => handleStepOrderChipClick(stepType, seqIdx)}
                    aria-current={isCurrentStep ? 'step' : undefined}
                    title={
                      isPlayingLoop
                        ? `Etapa ${seqIdx + 1}: ${meta.label} (clique para voltar/ir a esta etapa e continuar o treino a partir dela)`
                        : `Etapa ${seqIdx + 1}: ${meta.label} (clique para executar apenas esta etapa)`
                    }
                    className={`px-2 py-0.5 rounded-md border transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      isCurrentStep
                        ? 'bg-gradient-to-r from-brand-500 to-indigo-500 text-white border-brand-200 ring-2 ring-amber-400/90 shadow-md shadow-brand-500/35 font-extrabold'
                        : isStepDone
                          ? `${meta.badgeClass} opacity-55`
                          : isStepUpcoming
                            ? `${meta.badgeClass} opacity-80`
                            : `${meta.badgeClass} font-semibold`
                    }`}
                  >
                    {isCurrentStep && (
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse shrink-0"
                      />
                    )}
                    <span className="font-mono text-[9px] opacity-85">
                      {isStepDone ? '✓' : `${seqIdx + 1}º`}
                    </span>
                    <span>{meta.icon}</span>
                    <span>{meta.shortLabel}</span>
                  </button>
                  {seqIdx < effectiveCardSequence.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="text-slate-600 font-bold text-[9px] shrink-0"
                    >
                      ›
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <button
            id="btnEditStepOrderBar"
            type="button"
            onClick={() => {
              stopLoop();
              setSettingsInitialTab('custom_cards');
              setIsSettingsOpen(true);
            }}
            className={`${
              isMobileTrainingCompact ? 'hidden md:inline-flex' : 'inline-flex'
            } px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-brand-300 hover:text-white font-semibold transition cursor-pointer whitespace-nowrap shrink-0 items-center gap-1`}
            title="Personalizar a ordem das etapas (incluindo Desafios, Falar Sem Inglês e Revisão Automática)"
          >
            <span>⚙️</span>
            <span className="sm:hidden">Editar</span>
            <span className="hidden sm:inline">Editar Etapas</span>
          </button>
        </div>

        {/* MOBILE CARD SWITCHER TABS (Visible < md in Cards Free Mode so all cards fit without scrolling) */}
        {isMobileViewport && settings.studyViewMode !== 'paragraph' && !isPlayingLoop && (
          <div
            id="mobileCardTabsBar"
            role="tablist"
            aria-label="Alternar card de estudo no modo mobile"
            className="md:hidden grid grid-cols-5 gap-1 p-1 rounded-xl bg-slate-900/95 border border-slate-800 shrink-0"
          >
            {(
              [
                { id: 'mobileTabPt', key: 'pt', icon: '🇧🇷', label: '01 PT' },
                { id: 'mobileTabEn', key: 'en', icon: '🇺🇸', label: '02 EN' },
                { id: 'mobileTabLiteral', key: 'literal', icon: '🔤', label: 'Palav.' },
                { id: 'mobileTabSpeak', key: 'speak', icon: '🎤', label: 'Fala' },
                { id: 'mobileTabAll', key: 'all', icon: '☰', label: 'Todos' }
              ] as const
            ).map(tab => {
              const isActive = mobileCardPlan.activePanel === tab.key;
              return (
                <button
                  key={tab.key}
                  id={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setMobileSelectedPanel(tab.key)}
                  className={`min-h-[34px] px-1 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center justify-center gap-0.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* VIEW MODE: STAGED BOOK PAGE FOR LARGE BOOKS (PARAGRAPH VIEW) vs CARDS VIEW */}
        {settings.studyViewMode === 'paragraph' ? (
          (() => {
            const totalPageStages = Math.max(1, Math.ceil(sentences.length / pageStageSize));
            const currentPageStageIdx = Math.floor(currentIndex / pageStageSize);
            const stageStartIdx = currentPageStageIdx * pageStageSize;
            const lastExpandedStageIdx = Math.min(
              totalPageStages - 1,
              currentPageStageIdx + extraLoadedStagesCount
            );
            const stageEndIdx = Math.min(
              sentences.length,
              (lastExpandedStageIdx + 1) * pageStageSize
            );
            const visibleStageSlices: {
              stageNumber: number;
              startIdx: number;
              endIdx: number;
              items: { sentence: Sentence; globalIdx: number }[];
            }[] = [];

            for (let sIdx = currentPageStageIdx; sIdx <= lastExpandedStageIdx; sIdx++) {
              const sliceStart = sIdx * pageStageSize;
              const sliceEnd = Math.min(sentences.length, (sIdx + 1) * pageStageSize);
              const items: { sentence: Sentence; globalIdx: number }[] = [];
              for (let i = sliceStart; i < sliceEnd; i++) {
                if (sentences[i]) {
                  items.push({ sentence: sentences[i], globalIdx: i });
                }
              }
              visibleStageSlices.push({
                stageNumber: sIdx + 1,
                startIdx: sliceStart,
                endIdx: sliceEnd,
                items
              });
            }

            const remainingSentencesAfter = Math.max(0, sentences.length - stageEndIdx);
            const remainingStagesAfter = Math.max(0, totalPageStages - 1 - lastExpandedStageIdx);
            const nextBatchCount = Math.min(pageStageSize, remainingSentencesAfter);
            const completedInVisibleRange = sentences
              .slice(stageStartIdx, stageEndIdx)
              .filter((_, offset) => Boolean(sentenceProgress[stageStartIdx + offset]?.completed))
              .length;

            return (
              <div
                id="paragraphPageView"
                className={`bg-slate-800/75 border border-slate-700/70 rounded-xl ${
                  isMobileTrainingCompact
                    ? 'p-2.5 space-y-1.5 flex-1 min-h-0 flex flex-col'
                    : 'p-3 sm:p-4 space-y-2.5'
                } shadow-xl w-full min-w-0 overflow-hidden`}
              >
                {/* Top Stage Navigation & Control Bar */}
                <div
                  id="pageModeStageBar"
                  className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-700/60 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span
                      id="pageStageIndicator"
                      className="px-2 py-0.5 rounded-lg bg-brand-500/20 border border-brand-500/40 text-brand-200 font-bold text-[11px] whitespace-nowrap"
                    >
                      📖 Etapa{' '}
                      {lastExpandedStageIdx > currentPageStageIdx
                        ? `${currentPageStageIdx + 1}–${lastExpandedStageIdx + 1}`
                        : currentPageStageIdx + 1}{' '}
                      de {totalPageStages}
                    </span>
                    <span
                      id="pageStageSentenceRange"
                      className="text-[11px] text-slate-300 font-mono whitespace-nowrap"
                    >
                      Frases {stageStartIdx + 1}–{stageEndIdx} de {sentences.length}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold whitespace-nowrap">
                      ✓ {completedInVisibleRange}/{stageEndIdx - stageStartIdx} concluídas
                    </span>
                  </div>

                  {/* Stage Size Selector + Stage Jump + Audio Controls */}
                  <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                    <label
                      htmlFor="selectPageStageSize"
                      className="text-[10px] text-slate-400 hidden sm:inline"
                    >
                      Tamanho:
                    </label>
                    <select
                      id="selectPageStageSize"
                      aria-label="Quantidade de frases por etapa no Modo Página"
                      value={pageStageSize}
                      onChange={e => {
                        const nextSize = parseInt(e.target.value, 10) || 8;
                        setPageStageSize(nextSize);
                        setExtraLoadedStagesCount(0);
                      }}
                      className="min-h-[36px] sm:min-h-0 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] sm:text-[10px] font-semibold text-slate-200 cursor-pointer focus:outline-none focus:border-brand-500"
                    >
                      <option value={5}>5 frases / etapa</option>
                      <option value={8}>8 frases / etapa</option>
                      <option value={15}>15 frases / etapa</option>
                      <option value={30}>30 frases / etapa</option>
                      <option value={50}>50 frases / etapa</option>
                    </select>

                    {totalPageStages > 1 && (
                      <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-700/80 max-w-full">
                        <button
                          id="btnPrevPageStage"
                          type="button"
                          disabled={currentPageStageIdx <= 0}
                          onClick={() => {
                            const prevStageStart = Math.max(
                              0,
                              (currentPageStageIdx - 1) * pageStageSize
                            );
                            setExtraLoadedStagesCount(0);
                            jumpToSentence(prevStageStart);
                          }}
                          title="Voltar para a etapa anterior do livro"
                          className="min-h-[34px] sm:min-h-0 px-2 py-1 sm:py-0.5 rounded text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          <span className="sm:hidden">← Ant.</span>
                          <span className="hidden sm:inline">← Etapa Ant.</span>
                        </button>

                        <select
                          id="selectPageStageJump"
                          aria-label="Ir para etapa específica do livro"
                          value={currentPageStageIdx}
                          onChange={e => {
                            const targetStage = parseInt(e.target.value, 10) || 0;
                            setExtraLoadedStagesCount(0);
                            jumpToSentence(targetStage * pageStageSize);
                          }}
                          className="min-h-[34px] sm:min-h-0 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] sm:text-[10px] font-mono font-bold text-brand-300 cursor-pointer focus:outline-none max-w-[130px] sm:max-w-none"
                        >
                          {Array.from({ length: totalPageStages }, (_, sIdx) => {
                            const sStart = sIdx * pageStageSize + 1;
                            const sEnd = Math.min(sentences.length, (sIdx + 1) * pageStageSize);
                            return (
                              <option key={sIdx} value={sIdx}>
                                Etapa {sIdx + 1} ({sStart}–{sEnd})
                              </option>
                            );
                          })}
                        </select>

                        <button
                          id="btnNextPageStage"
                          type="button"
                          disabled={lastExpandedStageIdx >= totalPageStages - 1}
                          onClick={() => {
                            const nextStageStart = Math.min(
                              sentences.length - 1,
                              (lastExpandedStageIdx + 1) * pageStageSize
                            );
                            setExtraLoadedStagesCount(0);
                            jumpToSentence(nextStageStart);
                          }}
                          title="Ir para a próxima etapa do livro"
                          className="min-h-[34px] sm:min-h-0 px-2 py-1 sm:py-0.5 rounded text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          <span className="sm:hidden">Próx. →</span>
                          <span className="hidden sm:inline">Próx. Etapa →</span>
                        </button>
                      </div>
                    )}

                    <CardAudioButton
                      id="btnPlayParagraphSentence"
                      label="Ouvir Frase"
                      stopLabel="Parar"
                      isPlaying={activeManualAudio === 'en'}
                      title="Ouvir a sentença ativa em inglês"
                      onClick={() => {
                        if (!currentSentence) return;
                        runManualAudioPlayback(
                          'en',
                          'en',
                          currentSentence.en,
                          'en-US',
                          1.0,
                          activeManualAudio === 'en'
                        );
                      }}
                    />
                  </div>
                </div>

                {/* Staged Sentences Reading Viewport (Fast & Bounded for Large Books) */}
                <div
                  id="paragraphSentencesContainer"
                  ref={pageSentencesScrollRef}
                  className={`${
                    isMobileTrainingCompact
                      ? 'flex-1 min-h-0'
                      : 'max-h-[38dvh] sm:max-h-[300px] lg:max-h-[360px] xl:max-h-[425px]'
                  } overflow-y-auto pr-1 space-y-3 scroll-smooth`}
                >
                  {visibleStageSlices.map((stageSlice, slicePos) => (
                    <div key={stageSlice.stageNumber} className="space-y-1.5">
                      {visibleStageSlices.length > 1 && (
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-brand-300/90 pt-1">
                          <span>
                            Etapa {stageSlice.stageNumber} · Frases {stageSlice.startIdx + 1} a{' '}
                            {stageSlice.endIdx}
                          </span>
                          <div className="flex-1 border-t border-slate-700/60" />
                          {slicePos > 0 && slicePos === visibleStageSlices.length - 1 && (
                            <button
                              id="btnCollapseExtraStages"
                              type="button"
                              onClick={() => setExtraLoadedStagesCount(0)}
                              className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer normal-case font-normal"
                            >
                              Recolher etapas extras
                            </button>
                          )}
                        </div>
                      )}

                      <div className="text-sm sm:text-base leading-relaxed space-x-1.5">
                        {stageSlice.items.map(({ sentence: s, globalIdx: idx }) => {
                          const isActive = idx === currentIndex;
                          const isDone = Boolean(sentenceProgress[idx]?.completed);
                          return (
                            <span
                              key={idx}
                              data-page-sentence-idx={idx}
                              onClick={() => jumpToSentence(idx)}
                              className={`inline cursor-pointer rounded-md px-1.5 py-0.5 transition ${
                                isActive
                                  ? 'bg-brand-500/25 text-white font-bold ring-1 ring-brand-400/70 shadow-xs'
                                  : isDone
                                    ? 'text-emerald-300/85 hover:text-white bg-emerald-500/5'
                                    : 'text-slate-300/90 hover:text-white hover:bg-slate-700/40'
                              }`}
                            >
                              <span className="text-[10px] font-mono text-slate-400 mr-1 select-none">
                                {isDone ? '✓' : `#${idx + 1}`}
                              </span>
                              {isActive && isEnglishTextHidden
                                ? '🧠 [Texto em inglês oculto — Fale guiando-se pela tradução em português abaixo] '
                                : `${s.en} `}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Incremental Stage Loader Bar for Multi-Stage / Large Books */}
                {remainingSentencesAfter > 0 && !isMobileTrainingCompact && (
                  <div
                    id="pageStageLoadMoreBar"
                    className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/60 text-xs"
                  >
                    <span className="text-[11px] text-slate-400">
                      Restam <strong className="text-slate-200">{remainingSentencesAfter}</strong>{' '}
                      frases em{' '}
                      <strong className="text-brand-300">
                        {remainingStagesAfter}{' '}
                        {remainingStagesAfter === 1 ? 'etapa seguinte' : 'etapas seguintes'}
                      </strong>
                    </span>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <button
                        id="btnExpandNextPageStage"
                        type="button"
                        onClick={() => setExtraLoadedStagesCount(prev => prev + 1)}
                        className="min-h-[38px] sm:min-h-0 flex-1 sm:flex-none px-2.5 py-1.5 sm:py-1 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-brand-300 hover:text-white text-[11px] font-semibold transition cursor-pointer whitespace-normal sm:whitespace-nowrap text-center"
                      >
                        ➕ Abrir Próxima Etapa (+{nextBatchCount} frases)
                      </button>

                      <button
                        id="btnTurnToNextPageStage"
                        type="button"
                        onClick={() => {
                          const nextStageStart = Math.min(
                            sentences.length - 1,
                            (lastExpandedStageIdx + 1) * pageStageSize
                          );
                          setExtraLoadedStagesCount(0);
                          jumpToSentence(nextStageStart);
                        }}
                        className="min-h-[38px] sm:min-h-0 flex-1 sm:flex-none px-2.5 py-1.5 sm:py-1 rounded-lg bg-brand-600/30 hover:bg-brand-600 border border-brand-500/40 text-brand-200 hover:text-white text-[11px] font-semibold transition cursor-pointer whitespace-normal sm:whitespace-nowrap text-center"
                      >
                        Ir para Etapa {lastExpandedStageIdx + 2} →
                      </button>
                    </div>
                  </div>
                )}

                {/* Active Sentence Translation Bar */}
                {!isChallengeLocked && currentSentence?.pt && (
                  <div className="pt-2 border-t border-slate-700/60 flex items-start justify-between gap-2 text-xs sm:text-sm text-indigo-200">
                    <div>
                      <span className="font-semibold text-indigo-400">
                        Tradução da frase ativa (#{currentIndex + 1}):{' '}
                      </span>
                      <span>{currentSentence.pt}</span>
                    </div>
                    <CardAudioButton
                      id="btnPlayParagraphPt"
                      label="Ouvir PT"
                      stopLabel="Parar"
                      isPlaying={activeManualAudio === 'pt'}
                      title="Ouvir a tradução em português da frase ativa"
                      onClick={() => {
                        if (!currentSentence) return;
                        runManualAudioPlayback(
                          'pt',
                          'pt',
                          currentSentence.pt,
                          'pt-BR',
                          1.0,
                          activeManualAudio === 'pt'
                        );
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          /* MAIN SENTENCE CARDS (DYNAMIC CUSTOM ORDER & REPETITION — STAGE-FOCUSED ON MOBILE TO AVOID SCROLLING) */
          <div
            id="visualCardsStackContainer"
            className={
              isMobileFocusedLayout
                ? mobileCardPlan.showSpeechCard
                  ? mobileCardPlan.compactEnReference || mobileCardPlan.compactPtReference
                    ? 'shrink-0 max-h-[38%] flex flex-col gap-1.5 overflow-y-auto'
                    : 'hidden'
                  : 'flex-1 min-h-0 flex flex-col gap-2'
                : 'flex flex-col gap-2.5 shrink-0'
            }
          >
            {(isMobileFocusedLayout
              ? (['pt', 'en', 'literal'] as VisualCardType[])
              : visualCardsToRender
            ).map((vCardType, vIdx) => {
              const stepNumStr = String(vIdx + 1).padStart(2, '0');
              const activeOrderSource = isMobileFocusedLayout
                ? (['pt', 'en', 'literal'] as VisualCardType[])
                : visualCardsToRender;
              const occurrenceNum = activeOrderSource
                .slice(0, vIdx + 1)
                .filter(c => c === vCardType).length;
              const totalOccurrences = activeOrderSource.filter(c => c === vCardType).length;
              const idSuffix = occurrenceNum > 1 ? `_${occurrenceNum}` : '';

              if (isMobileFocusedLayout) {
                if (vCardType === 'pt' && !mobileCardPlan.showPtCard) return null;
                if (vCardType === 'en' && !mobileCardPlan.showEnCard) return null;
                if (vCardType === 'literal' && !mobileCardPlan.showLiteralCard) return null;
              }

              if (vCardType === 'pt') {
                const isCompactPtRef = isMobileFocusedLayout && mobileCardPlan.compactPtReference;
                return (
                  /* Portuguese Translation Card */
                  <div
                    key={`vcard-pt-${vIdx}`}
                    id={`ptCardContainer${idSuffix}`}
                    data-visual-card-type="pt"
                    data-visual-card-index={vIdx}
                    className={`${
                      isMobileFocusedLayout
                        ? isCompactPtRef
                          ? 'h-auto shrink-0 p-2.5 gap-1'
                          : 'flex-1 min-h-0 overflow-y-auto p-3 gap-2'
                        : 'min-h-[86px] lg:min-h-[94px] xl:min-h-[98px] h-auto shrink-0 gap-1.5 overflow-hidden p-2.5 sm:px-4 sm:py-2.5'
                    } flex flex-col justify-between bg-slate-800/60 border border-slate-700/60 rounded-xl shadow-md transition-colors duration-200 ${
                      activeCardHighlight === 'pt' ? 'ring-2 ring-indigo-500/70' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-h-[24px] shrink-0 text-[11px] text-indigo-400 font-semibold tracking-wide">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">
                          {isCompactPtRef
                            ? '🇧🇷 Português (Olhe e fale em inglês)'
                            : isStepByStepMode && activeStudyStep && !activeStudyStep.isFull
                              ? `${stepNumStr}. Português — Tradução da ${activeStudyStep.label}`
                              : `${stepNumStr}. Português (Significado & Contexto)`}
                        </span>
                        {currentSentence?.grammarRule && (
                          <span
                            id={`grammarRuleBadge${idSuffix}`}
                            title={`Regra de Inglês dos EUA nesta frase: ${currentSentence.grammarRule}`}
                            className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-medium truncate max-w-md lg:max-w-xl xl:max-w-3xl"
                          >
                            <span>🇺🇸</span>
                            <span className="truncate">{currentSentence.grammarRule}</span>
                          </span>
                        )}
                        {totalOccurrences > 1 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-bold shrink-0">
                            🔁 {occurrenceNum}ª Passagem
                          </span>
                        )}
                      </div>
                      <CardAudioButton
                        id={`btnPlayPt${idSuffix}`}
                        label="Ouvir"
                        stopLabel="Parar"
                        isPlaying={
                          activeManualAudio === 'pt' ||
                          (isSpeakingTTS && enginePhase === 'PLAYING_PT' && !isReadingWords)
                        }
                        ariaLabel="Ouvir em português"
                        title="Ouvir a tradução em português"
                        onClick={() => {
                          if (!currentSentence) return;
                          const isPlayingPtNow =
                            activeManualAudio === 'pt' ||
                            (isSpeakingTTS && enginePhase === 'PLAYING_PT' && !isReadingWords);
                          const targetPtText =
                            isStepByStepMode && activeStudyStep && activeStudyStep.ptText
                              ? activeStudyStep.ptText
                              : currentSentence.pt;
                          runManualAudioPlayback(
                            'pt',
                            'pt',
                            targetPtText,
                            'pt-BR',
                            1.0,
                            isPlayingPtNow
                          );
                        }}
                      />
                    </div>

                    <div className="flex-1 flex flex-col justify-center gap-1.5">
                      {isChallengeLocked ? (
                        <div
                          id={`ptChallengeLockNotice${idSuffix}`}
                          className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <svg
                              className="w-4 h-4 text-amber-400 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                            <span className="leading-snug">
                              🔒 Modo Desafio: Fale em inglês para desbloquear a tradução!
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setChallengeUnlocked(true)}
                            className="text-[10px] text-amber-200 underline hover:text-white shrink-0 cursor-pointer"
                          >
                            Revelar
                          </button>
                        </div>
                      ) : translatingSentence ? (
                        <p
                          id={`ptSentenceText${idSuffix}`}
                          className="text-xs text-indigo-400 flex items-center gap-1.5"
                        >
                          Traduzindo sentença do livro...
                        </p>
                      ) : isStepByStepMode && activeStudyStep && !activeStudyStep.isFull ? (
                        <div className="space-y-0.5">
                          <p
                            id={`ptSentenceText${idSuffix}`}
                            className="text-sm sm:text-base font-bold text-indigo-100 leading-snug"
                          >
                            "{activeStudyStep.ptText || currentSentence?.pt || '...'}"
                          </p>
                          <p className="text-[11px] text-slate-400 leading-snug">
                            <span className="font-semibold text-slate-300">Frase inteira:</span>{' '}
                            {currentSentence?.pt}
                          </p>
                        </div>
                      ) : (
                        <p
                          id={`ptSentenceText${idSuffix}`}
                          className="text-sm sm:text-base font-medium text-slate-200 leading-snug"
                        >
                          {currentSentence?.pt || '...'}
                        </p>
                      )}
                      {currentSentence?.grammarRule && !isChallengeLocked && (
                        <div
                          id={`grammarRuleMobileBadge${idSuffix}`}
                          className="md:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-medium self-start leading-snug"
                        >
                          <span className="shrink-0">🇺🇸</span>
                          <span>{currentSentence.grammarRule}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (vCardType === 'en') {
                const isCompactEnRef = isMobileFocusedLayout && mobileCardPlan.compactEnReference;
                return (
                  /* English Sentence Card */
                  <div
                    key={`vcard-en-${vIdx}`}
                    id={`enCardContainer${idSuffix}`}
                    data-visual-card-type="en"
                    data-visual-card-index={vIdx}
                    className={`${
                      isMobileFocusedLayout
                        ? isCompactEnRef
                          ? 'h-auto shrink-0 p-2.5 gap-1 justify-between'
                          : 'flex-1 min-h-0 overflow-y-auto p-3 gap-2.5 justify-start'
                        : 'min-h-[132px] lg:min-h-[142px] xl:min-h-[148px] h-auto shrink-0 gap-1.5 overflow-hidden p-2.5 sm:px-4 sm:py-2.5 justify-between'
                    } flex flex-col bg-slate-800/90 backdrop-blur border border-slate-700/80 rounded-xl shadow-xl relative transition-colors duration-200 ${
                      activeCardHighlight === 'en' ? 'ring-2 ring-brand-500/70' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 min-h-[24px] shrink-0 text-[11px] text-brand-400 font-semibold tracking-wide">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">
                          {isCompactEnRef
                            ? isStepByStepMode && activeStudyStep && !activeStudyStep.isFull
                              ? `🇺🇸 Inglês — ${activeStudyStep.label}`
                              : '🇺🇸 Inglês (Fale esta frase)'
                            : `${stepNumStr}. Inglês (Escutar e Pronunciar)`}
                        </span>
                        {totalOccurrences > 1 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-bold shrink-0">
                            🔁 {occurrenceNum}ª Passagem
                          </span>
                        )}
                        {isSpeakingTTS && occurrenceNum === 1 && (
                          <div
                            id="audioWaveIndicator"
                            className="hidden sm:flex items-center gap-1 shrink-0"
                          >
                            <span className="w-1 h-2.5 bg-brand-400 rounded-full animate-bounce" />
                            <span className="w-1 h-3.5 bg-brand-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                            <span className="w-1 h-2 bg-brand-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                            <span className="text-[10px] font-semibold text-brand-300 ml-0.5">
                              {audioWaveLabel}
                            </span>
                          </div>
                        )}
                      </div>
                      <div
                        className={`flex flex-wrap items-center gap-1.5 ${
                          isCompactEnRef ? 'w-auto' : 'w-full sm:w-auto'
                        }`}
                      >
                        {!isCompactEnRef && (
                          <button
                            id={`btnSaveCurrentSentence${idSuffix}`}
                            type="button"
                            onClick={handleSaveCurrentSentence}
                            title="Salvar frase nos favoritos"
                            className="min-h-[36px] sm:min-h-0 px-2 py-1 rounded-md text-[10px] font-medium bg-slate-900/70 border border-slate-700 text-slate-300 hover:text-amber-400 hover:border-amber-400/50 transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                              />
                            </svg>
                            Salvar frase
                          </button>
                        )}
                        {!isCompactEnRef && rawTokens.length >= 6 && (
                          <button
                            id={`btnStepByStepToggle${idSuffix}`}
                            type="button"
                            onClick={() => {
                              const wasPlaying = isPlayingLoopRef.current;
                              stopAllAudio();
                              const next = !isStepByStepMode;
                              isStepByStepModeRef.current = next;
                              activeStepIdxRef.current = 0;
                              setIsStepByStepMode(next);
                              setActiveStepIdx(0);
                              setCompletedStepIndices([]);
                              manualSpeakStageIdxRef.current = 0;
                              isBlindStageActiveRef.current = false;
                              setIsBlindStageActive(false);
                              setBlindEnglishUnlocked(false);
                              blindErrorCountRef.current = 0;
                              setBlindErrorCount(0);
                              setChallengeUnlocked(false);
                              setActiveSequenceStepIdx(null);
                              setLastScore(null);
                              setWordResults([]);
                              setUserTranscript('Aguardando próxima fala...');
                              if (next) {
                                handleUpdateSettings({ showConnectedSpeech: false });
                              }
                              if (wasPlaying) {
                                setEnginePhase('PAUSED');
                                setStateBadgeText('Reiniciando ciclo...');
                                setStateBadgeColor('text-brand-300');
                                runShadowingStep();
                              } else {
                                setEnginePhase('IDLE');
                                setStateBadgeText('Pronto');
                                setStateBadgeColor('text-slate-300');
                              }
                            }}
                            title="Quebrar frase longa em partes menores para treinar passo a passo"
                            className={`min-h-[36px] sm:min-h-0 px-2 py-1 rounded-md text-[10px] font-semibold border transition cursor-pointer whitespace-nowrap ${
                              isStepByStepMode
                                ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                                : rawTokens.length >= 12
                                  ? 'bg-amber-500/15 border-amber-400/60 text-amber-200 hover:bg-amber-500/25'
                                  : 'bg-slate-900/70 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            {isStepByStepMode
                              ? '✂️ Em Partes: ON'
                              : rawTokens.length >= 12
                                ? '✂️ Dividir Frase Longa'
                                : '✂️ Em Partes'}
                          </button>
                        )}
                        {!isCompactEnRef && (
                          <button
                            id={`btnConnectedSpeechToggle${idSuffix}`}
                            type="button"
                            onClick={() => {
                              const wasPlaying = isPlayingLoopRef.current;
                              const next = !settings.showConnectedSpeech;
                              if (next && isStepByStepModeRef.current) {
                                stopAllAudio();
                                isStepByStepModeRef.current = false;
                                setIsStepByStepMode(false);
                                activeStepIdxRef.current = 0;
                                setActiveStepIdx(0);
                                setCompletedStepIndices([]);
                                manualSpeakStageIdxRef.current = 0;
                                isBlindStageActiveRef.current = false;
                                setIsBlindStageActive(false);
                                setBlindEnglishUnlocked(false);
                                blindErrorCountRef.current = 0;
                                setBlindErrorCount(0);
                                setActiveSequenceStepIdx(null);
                                handleUpdateSettings({ showConnectedSpeech: next });
                                if (wasPlaying) {
                                  setEnginePhase('PAUSED');
                                  setStateBadgeText('Reiniciando ciclo...');
                                  setStateBadgeColor('text-brand-300');
                                  runShadowingStep();
                                } else {
                                  setEnginePhase('IDLE');
                                  setStateBadgeText('Pronto');
                                  setStateBadgeColor('text-slate-300');
                                }
                                return;
                              }
                              handleUpdateSettings({
                                showConnectedSpeech: next
                              });
                            }}
                            title="Agrupar frase em blocos de ritmo e mostrar ligações fonéticas (Connected Speech)"
                            className={`min-h-[36px] sm:min-h-0 px-2 py-1 rounded-md text-[10px] font-semibold border transition cursor-pointer whitespace-nowrap ${
                              settings.showConnectedSpeech
                                ? 'bg-brand-600/30 border-brand-400 text-brand-200'
                                : 'bg-slate-900/70 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            {settings.showConnectedSpeech
                              ? '‿ Fluxo Conectado: ON'
                              : '‿ Fluxo Conectado'}
                          </button>
                        )}
                        {!isCompactEnRef && (
                          <CardAudioButton
                            id={`btnPlayEnSlow${idSuffix}`}
                            label="Ouvir 0.7x"
                            stopLabel="Parar"
                            isPlaying={activeManualAudio === 'en_slow'}
                            ariaLabel="Ouvir devagar em inglês"
                            title="Ouvir devagar em inglês (0.7x)"
                            onClick={() => {
                              if (!currentSentence) return;
                              const targetEnText =
                                isStepByStepMode && activeStudyStep
                                  ? activeStudyStep.text
                                  : currentSentence.en;
                              runManualAudioPlayback(
                                'en_slow',
                                'en',
                                targetEnText,
                                'en-US',
                                0.72,
                                activeManualAudio === 'en_slow'
                              );
                            }}
                          />
                        )}
                        <CardAudioButton
                          id={`btnPlayEn${idSuffix}`}
                          label="Ouvir"
                          stopLabel="Parar"
                          isPlaying={
                            activeManualAudio === 'en' ||
                            (isSpeakingTTS &&
                              enginePhase === 'PLAYING_EN' &&
                              !isReadingWords &&
                              activeManualAudio !== 'en_slow' &&
                              activeManualAudio !== 'step')
                          }
                          ariaLabel="Ouvir em inglês"
                          title="Ouvir a frase em inglês"
                          onClick={() => {
                            if (!currentSentence) return;
                            const isPlayingEnNow =
                              activeManualAudio === 'en' ||
                              (isSpeakingTTS &&
                                enginePhase === 'PLAYING_EN' &&
                                !isReadingWords &&
                                activeManualAudio !== 'en_slow' &&
                                activeManualAudio !== 'step');
                            const targetEnText =
                              isStepByStepMode && activeStudyStep
                                ? activeStudyStep.text
                                : currentSentence.en;
                            runManualAudioPlayback(
                              'en',
                              'en',
                              targetEnText,
                              'en-US',
                              1.0,
                              isPlayingEnNow
                            );
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className={
                        isMobileFocusedLayout && !isCompactEnRef
                          ? 'flex flex-col justify-start py-0.5'
                          : 'flex-1 flex flex-col justify-center py-0.5'
                      }
                    >
                      {isStepByStepMode && activeStudyStep ? (
                        <div
                          id={`stepByStepPanel${idSuffix}`}
                          className={`${
                            isCompactEnRef ? 'space-y-1 px-2.5 py-1.5' : 'space-y-1.5 px-3 py-2'
                          } rounded-xl bg-slate-900/85 border border-emerald-500/30`}
                        >
                          {!isCompactEnRef && (
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <div className="flex flex-wrap items-center gap-1">
                                {studySteps.map((st, sIdx) => {
                                  const isCurrent = sIdx === activeStepIdx;
                                  const isDone = completedStepIndices.includes(sIdx);
                                  return (
                                    <button
                                      key={st.index}
                                      type="button"
                                      onClick={() => {
                                        const wasPlaying = isPlayingLoopRef.current;
                                        stopAllAudio();
                                        activeStepIdxRef.current = sIdx;
                                        setActiveStepIdx(sIdx);
                                        manualSpeakStageIdxRef.current = 0;
                                        isBlindStageActiveRef.current = false;
                                        setIsBlindStageActive(false);
                                        setBlindEnglishUnlocked(false);
                                        blindErrorCountRef.current = 0;
                                        setBlindErrorCount(0);
                                        setChallengeUnlocked(false);
                                        setActiveSequenceStepIdx(null);
                                        setLastScore(null);
                                        setWordResults([]);
                                        setUserTranscript('Aguardando próxima fala...');
                                        if (wasPlaying) {
                                          pausedResumeSeqIdxRef.current = null;
                                          setPausedResumeSeqIdx(null);
                                          setEnginePhase('PAUSED');
                                          setStateBadgeText('Reiniciando parte...');
                                          setStateBadgeColor('text-brand-300');
                                          runShadowingStep();
                                        } else {
                                          if (pausedResumeSeqIdxRef.current !== null) {
                                            pausedResumeSeqIdxRef.current = 0;
                                            setPausedResumeSeqIdx(0);
                                          }
                                          setEnginePhase('IDLE');
                                          setStateBadgeText('Pronto');
                                          setStateBadgeColor('text-slate-300');
                                        }
                                      }}
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                                        isCurrent
                                          ? 'bg-emerald-600 text-white border-emerald-400 shadow'
                                          : isDone
                                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/70'
                                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                                      }`}
                                    >
                                      {isDone ? '✓ ' : ''}
                                      {st.label}
                                    </button>
                                  );
                                })}
                              </div>

                              <button
                                id={`btnToggleStepHelp${idSuffix}`}
                                type="button"
                                onClick={() => setShowStepHowItWorks(prev => !prev)}
                                title="Mostrar ou ocultar explicação de como funciona o modo em partes"
                                aria-expanded={showStepHowItWorks}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition cursor-pointer whitespace-nowrap ${
                                  showStepHowItWorks
                                    ? 'bg-brand-600/30 border-brand-400 text-brand-200'
                                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {showStepHowItWorks ? '✕ Ocultar' : '❓ Como funciona'}
                              </button>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
                            {isEnglishTextHidden ? (
                              <div
                                id={`enBlindStepLockNotice${idSuffix}`}
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs font-semibold flex-1 min-w-0"
                              >
                                <span className="leading-snug">
                                  🧠 Sem ler o inglês: olhe o português e fale!
                                  {(settings.blindMaxErrorsBeforeReveal ?? 2) > 0 && (
                                    <span
                                      id={`blindStepErrorCounterBadge${idSuffix}`}
                                      className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-900/80 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 inline-block"
                                    >
                                      Erros: {blindErrorCount}/{settings.blindMaxErrorsBeforeReveal ?? 2} p/ revelar
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    id={`btnRestartBeforeBlindStepNotice${idSuffix}`}
                                    type="button"
                                    onClick={handleRestartBeforeBlindStage}
                                    title="Voltar para antes da etapa Sem Ler o Inglês para rever e ouvir novamente"
                                    className="px-2 py-0.5 rounded-md bg-brand-500/20 hover:bg-brand-500/35 border border-brand-400/40 text-[10px] font-bold text-brand-200 hover:text-white transition cursor-pointer whitespace-nowrap"
                                  >
                                    🔄 Rever EN
                                  </button>
                                  <button
                                    id={`btnRevealBlindStepEn${idSuffix}`}
                                    type="button"
                                    onClick={() => setBlindEnglishUnlocked(true)}
                                    className="text-[10px] text-emerald-300 underline hover:text-white shrink-0 cursor-pointer"
                                  >
                                    Revelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p
                                id={`activeStepTargetText${idSuffix}`}
                                className="text-sm sm:text-lg font-bold text-emerald-200 leading-snug"
                              >
                                "{activeStudyStep.text}"
                              </p>
                            )}
                            {!isCompactEnRef && (
                              <CardAudioButton
                                id={`btnPlayCurrentStep${idSuffix}`}
                                label="Ouvir Parte (PT + EN)"
                                stopLabel="Parar"
                                isPlaying={activeManualAudio === 'step'}
                                title="Ouvir a tradução em português e a pronúncia em inglês desta parte"
                                onClick={() => {
                                  if (activeManualAudio === 'step') {
                                    pauseLoopForManualControl(
                                      isPlayingLoopRef.current ? '⏸️ Treino pausado.' : undefined
                                    );
                                    return;
                                  }
                                  playStepBilingualPreview(
                                    activeStudyStep.text,
                                    activeStudyStep.ptText || currentSentence?.pt || '',
                                    !activeStudyStep.isFull
                                  );
                                }}
                              />
                            )}
                          </div>

                          {!isCompactEnRef && showStepHowItWorks && (
                            <p
                              id={`stepHowItWorksText${idSuffix}`}
                              className="text-[10px] text-slate-300 leading-tight bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800"
                            >
                              🎯 <strong className="text-white">Como funciona:</strong> O app lê o
                              português e o inglês <strong>apenas da parte selecionada</strong>, revisa
                              as palavras ao acertar e avança!
                            </p>
                          )}
                        </div>
                      ) : isEnglishTextHidden ? (
                        <div
                          id={`enBlindLockNotice${idSuffix}`}
                          className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 px-3 sm:px-3.5 py-2.5 sm:py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs sm:text-sm font-semibold"
                        >
                          <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                            <span className="text-base shrink-0">🧠</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-emerald-300 text-xs sm:text-sm leading-snug">
                                  Etapa Sem Ler o Inglês (Apenas Português)
                                </span>
                                {(settings.blindMaxErrorsBeforeReveal ?? 2) > 0 && (
                                  <span
                                    id={`blindErrorCounterBadge${idSuffix}`}
                                    className="px-1.5 py-0.5 rounded bg-slate-900/80 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 shrink-0"
                                  >
                                    Erros: {blindErrorCount}/{settings.blindMaxErrorsBeforeReveal ?? 2} p/ revelar
                                  </span>
                                )}
                              </div>
                              <span className="block text-[11px] text-slate-300 leading-snug mt-0.5">
                                {(settings.blindMaxErrorsBeforeReveal ?? 2) > 0
                                  ? `Leia apenas o português e fale! O inglês reaparece após ${settings.blindMaxErrorsBeforeReveal ?? 2} erro(s).`
                                  : 'Leia apenas a frase em português no card de Português e pronuncie em inglês!'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              id={`btnRestartBeforeBlindNotice${idSuffix}`}
                              type="button"
                              onClick={handleRestartBeforeBlindStage}
                              title="Voltar para antes da etapa Sem Ler o Inglês para rever e ouvir novamente"
                              className="min-h-[36px] sm:min-h-0 px-2.5 py-1 rounded-lg bg-brand-500/20 hover:bg-brand-500/35 border border-brand-400/40 text-[10px] font-bold text-brand-200 hover:text-white shrink-0 cursor-pointer whitespace-nowrap"
                            >
                              🔄 Rever EN
                            </button>
                            <button
                              id={`btnRevealBlindEn${idSuffix}`}
                              type="button"
                              onClick={() => setBlindEnglishUnlocked(true)}
                              className="min-h-[36px] sm:min-h-0 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-[10px] text-emerald-200 hover:text-white shrink-0 cursor-pointer"
                            >
                              Revelar Inglês
                            </button>
                          </div>
                        </div>
                      ) : settings.showConnectedSpeech ? (
                        <div id={`connectedSpeechBlocks${idSuffix}`} className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {prosodyChunks.map((chunk, cIdx) => (
                              <button
                                key={cIdx}
                                type="button"
                                onClick={() =>
                                  runManualAudioPlayback(null, 'en', chunk.text, 'en-US', 0.85)
                                }
                                title="Toque para ouvir este bloco rítmico conectado"
                                className="px-2.5 py-1 rounded-xl bg-slate-900/90 hover:bg-brand-950/80 border border-brand-500/40 text-xs sm:text-sm font-bold text-white transition cursor-pointer"
                              >
                                {chunk.displayWithLinks}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-brand-300 leading-tight">
                            O símbolo <span className="font-mono font-bold">‿</span> indica ligação
                            fonética (Connected Speech). Toque em um bloco para ouvi-lo.
                          </p>
                        </div>
                      ) : (
                        <p
                          id={`enSentenceText${idSuffix}`}
                          className="text-base sm:text-xl md:text-2xl font-bold text-white leading-snug tracking-tight break-words select-text"
                        >
                          {rawTokens.map((w, idx) => {
                            const clean = cleanString(w);
                            return (
                              <React.Fragment key={`${w}-${idx}`}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDictWord({
                                      word: clean || w,
                                      context: currentSentence.en
                                    })
                                  }
                                  className="inline text-left font-bold text-white hover:text-brand-400 hover:underline transition-colors cursor-pointer"
                                  title={`Ver dicionário para "${clean || w}"`}
                                >
                                  {w}
                                </button>{' '}
                              </React.Fragment>
                            );
                          })}
                        </p>
                      )}
                      {isMobileFocusedLayout &&
                        (!isCompactEnRef || blindEnglishUnlocked) &&
                        (!isPlayingLoop || blindEnglishUnlocked) &&
                        !isChallengeLocked &&
                        !isEnglishTextHidden &&
                        currentSentence?.pt && (
                          <div
                            id={`mobileEnInlinePtHint${idSuffix}`}
                            className="mt-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/35 border border-indigo-500/25 text-[11px] text-indigo-200/90 leading-snug"
                          >
                            <span className="font-bold text-indigo-300">🇧🇷 </span>
                            {isStepByStepMode && activeStudyStep && !activeStudyStep.isFull
                              ? activeStudyStep.ptText || currentSentence.pt
                              : currentSentence.pt}
                          </div>
                        )}
                    </div>
                  </div>
                );
              }

              /* Literal Word-by-Word Translation Card */
              return (
                <div
                  key={`vcard-literal-${vIdx}`}
                  id={`literalCardContainer${idSuffix}`}
                  data-visual-card-type="literal"
                  data-visual-card-index={vIdx}
                  className={`${
                    isMobileFocusedLayout
                      ? 'flex-1 min-h-0 overflow-y-auto p-3 gap-2'
                      : 'min-h-[104px] lg:min-h-[112px] xl:min-h-[118px] h-auto shrink-0 gap-1.5 overflow-hidden p-2.5 sm:px-4 sm:py-2.5'
                  } flex flex-col justify-between bg-slate-800/40 border border-slate-700/50 rounded-xl shadow-md transition-colors duration-200 ${
                    isReadingWords ? 'ring-2 ring-amber-500/70' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 min-h-[24px] shrink-0 text-[11px] text-amber-400 font-semibold tracking-wide">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">
                        {isStepByStepMode && activeStudyStep && !activeStudyStep.isFull
                          ? `${stepNumStr}. Tradução Literal — Palavras da ${activeStudyStep.label}`
                          : `${stepNumStr}. Tradução Literal (Palavra por Palavra)`}
                      </span>
                      {totalOccurrences > 1 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-bold shrink-0">
                          🔁 {occurrenceNum}ª Passagem
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                        toque na palavra p/ pular leitura + dicionário
                      </span>
                      {!isChallengeLocked && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <CardAudioButton
                            id={`btnPlayWordByWord${idSuffix}`}
                            label="Ouvir"
                            stopLabel="Parar"
                            isPlaying={isReadingWords}
                            ariaLabel={
                              isReadingWords
                                ? 'Parar leitura palavra por palavra'
                                : 'Ouvir palavra por palavra e tradução'
                            }
                            title={
                              isReadingWords
                                ? 'Parar leitura palavra por palavra'
                                : 'Ouvir cada palavra em inglês seguida da sua tradução em português'
                            }
                            onClick={async () => {
                              if (!currentSentence) return;
                              if (isReadingWords) {
                                skipWordReviewRef.current = true;
                                if (abortWordReviewRef.current) {
                                  const abortFn = abortWordReviewRef.current;
                                  abortWordReviewRef.current = null;
                                  abortFn();
                                }
                                const wasLooping = isPlayingLoopRef.current;
                                pauseLoopForManualControl(
                                  wasLooping ? '⏸️ Treino pausado.' : undefined
                                );
                                return;
                              }
                              const wasLooping = isPlayingLoopRef.current;
                              pauseLoopForManualControl(
                                wasLooping
                                  ? '⏸️ Treino pausado para leitura palavra por palavra.'
                                  : undefined
                              );
                              activeStepTokenRef.current += 1;
                              const manualToken = activeStepTokenRef.current;
                              const targetText =
                                isStepByStepMode && activeStudyStep
                                  ? activeStudyStep.text
                                  : currentSentence.en;
                              const skipped = await readWordByWordReview(
                                targetText,
                                manualToken,
                                false,
                                true,
                                0
                              );
                              if (
                                !skipped &&
                                manualToken === activeStepTokenRef.current &&
                                !isPlayingLoopRef.current
                              ) {
                                setActiveSequenceStepIdx(null);
                                setEnginePhase('IDLE');
                                setStateBadgeText('Pronto');
                                setStateBadgeColor('text-slate-300');
                              }
                            }}
                          />
                          <button
                            id={`btnSkipWordByWord${idSuffix}`}
                            type="button"
                            onClick={handleSkipWordByWord}
                            aria-label="Pular leitura das palavras e avançar para o próximo passo"
                            title="Cancelar a leitura das palavras individualmente e pular imediatamente para o próximo passo"
                            className={`min-h-[36px] sm:min-h-0 text-[10px] font-semibold px-2.5 py-1.5 sm:py-1 rounded-md border transition flex items-center gap-1 whitespace-nowrap shadow-xs cursor-pointer ${
                              isReadingWords
                                ? 'bg-amber-500/25 hover:bg-amber-500/35 border-amber-400 text-amber-200 ring-1 ring-amber-400/40'
                                : 'bg-slate-900/80 hover:bg-slate-700/90 border-slate-700 text-slate-300 hover:text-white'
                            }`}
                          >
                            <span>Pular</span>
                            <svg
                              className="w-3 h-3 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M13 5l7 7-7 7M5 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    id={`literalWordsList${idSuffix}`}
                    className="flex-1 flex flex-wrap content-start items-start gap-1.5 pt-0.5"
                  >
                    {isChallengeLocked ? (
                      <span className="text-[11px] text-amber-400/80 font-medium italic my-auto">
                        🔒 Palavras literais bloqueadas até você acertar a fala.
                      </span>
                    ) : (
                      (isStepByStepMode && activeStudyStep
                        ? activeStudyStep.text.split(/\s+/).filter(Boolean)
                        : rawTokens
                      ).map((token, idx) => {
                        const clean = cleanString(token);
                        if (!clean) return null;
                        const info = getWordInfo(clean);
                        const displayPt =
                          info.pt && info.pt !== '...' ? info.pt.split('/')[0].trim() : '...';
                        const isHighlighted = highlightedWordIdx === idx;

                        return (
                          <button
                            key={`${clean}-${idx}-${vIdx}`}
                            type="button"
                            data-word={clean}
                            data-word-idx={idx}
                            onClick={() => handleLiteralWordClick(clean, idx)}
                            title={
                              isEnglishTextHidden
                                ? `Tradução: "${displayPt}" (Inglês oculto nesta etapa)`
                                : `Pular leitura para "${clean}" e abrir dicionário`
                            }
                            className={`flex flex-col items-center bg-slate-900/90 hover:bg-slate-800 border ${
                              isHighlighted
                                ? 'ring-1 ring-amber-400 bg-amber-500/30 border-amber-400'
                                : 'border-slate-700/80 hover:border-amber-400/80'
                            } px-2.5 py-1.5 rounded-lg cursor-pointer transition group shadow-sm`}
                          >
                            <span className="text-xs font-bold text-white group-hover:text-amber-300 leading-none">
                              {isEnglishTextHidden ? '•••' : token}
                            </span>
                            <span
                              className="literal-pt-sub text-[10px] text-slate-400 group-hover:text-slate-200 mt-1 leading-none"
                              data-word-pt={clean}
                            >
                              {displayPt}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Card 4: Live Speech, Audio Spectrum, Self-Recording & Phonetic Coaching Card */}
        {(!isMobileFocusedLayout || mobileCardPlan.showSpeechCard) && (
          <div
            id="speechFeedbackContainer"
            className={`${
              isMobileFocusedLayout
                ? 'flex-1 min-h-0 overflow-y-auto p-2.5 gap-2'
                : isMobileTrainingCompact && settings.studyViewMode === 'paragraph'
                  ? 'shrink-0 max-h-[38%] overflow-y-auto p-2.5 gap-1.5'
                  : 'min-h-[118px] lg:min-h-[128px] xl:min-h-[136px] h-auto shrink-0 gap-2 overflow-hidden p-3 sm:px-4 sm:py-3'
            } flex flex-col justify-between rounded-xl transition-all duration-150 ${
              isListeningMic || enginePhase === 'LISTENING_USER'
                ? 'bg-rose-950/25 border-2 border-rose-500 ring-2 ring-rose-500/45 shadow-[0_0_24px_rgba(244,63,94,0.22)]'
                : 'bg-slate-950/80 border border-slate-800'
            }`}
          >
            {/* Prominent Live Mic Alert Banner whenever microphone is capturing */}
            {(isListeningMic || enginePhase === 'LISTENING_USER') && (
              <div
                id="micOpenAlertBanner"
                role="status"
                aria-live="assertive"
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-600/25 border border-rose-500/80 shadow-sm shrink-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight leading-tight">
                    🎙️ MICROFONE ABERTO — PODE FALAR!
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <div
                    title="Nível de captação do microfone"
                    className="w-16 sm:w-20 h-2 bg-slate-900 rounded-full overflow-hidden flex items-center border border-rose-500/40"
                  >
                    <div
                      ref={micLevelBarRef}
                      className="h-full bg-emerald-400 transition-all duration-75"
                      style={{ width: '18%' }}
                    />
                  </div>
                  {isListeningMic && (
                    <button
                      id="btnFinishSpeechEarly"
                      type="button"
                      onClick={() => finishSpeechEarlyRef.current?.()}
                      title="Clique para enviar sua fala imediatamente sem esperar a pausa"
                      className="min-h-[32px] px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition shadow cursor-pointer whitespace-nowrap"
                    >
                      ✓ Concluir Fala
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 min-h-[24px] shrink-0 text-[11px]">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  id="feedbackLabel"
                  className={`font-medium truncate ${
                    isListeningMic || enginePhase === 'LISTENING_USER'
                      ? 'text-rose-200 font-bold'
                      : 'text-slate-300'
                  }`}
                >
                  {isListeningMic || enginePhase === 'LISTENING_USER'
                    ? 'Escutando sua voz...'
                    : 'Resultado da Fala'}
                </span>
                {lastScore !== null && (
                  <span
                    id="scoreBadge"
                    role="status"
                    aria-live="polite"
                    className={`text-[11px] font-bold tabular-nums shrink-0 ${
                      lastScore >= settings.threshold ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    · {lastScore}% de precisão
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                <CardAudioButton
                  id="btnPlayUserRecording"
                  label="Ouvir Minha Voz"
                  stopLabel="Parar Minha Voz"
                  isPlaying={isPlayingUserAudio}
                  title={
                    isPlayingUserAudio
                      ? 'Clique para parar a reprodução da sua voz'
                      : lastUserAudioUrl
                        ? 'Ouvir a gravação da sua própria voz'
                        : 'Grave sua fala no microfone para ouvir sua própria voz'
                  }
                  onClick={handlePlayUserRecording}
                />
                <button
                  id="btnOpenChallengeManual"
                  type="button"
                  onClick={() => handleOpenChallengeManual('challenges')}
                  className="min-h-[32px] sm:min-h-0 text-[10px] font-bold px-2.5 py-1 rounded-md border bg-indigo-500/20 hover:bg-indigo-500/35 border-indigo-500/50 text-indigo-200 hover:text-white transition cursor-pointer whitespace-nowrap shadow-xs flex items-center gap-1"
                  title="Abrir os 2 desafios desta frase (Pronúncia de Palavras + Pares Inglês/Português)"
                >
                  🏆 Desafios
                </button>
                {(isEnglishTextHidden ||
                  isBlindStageActive ||
                  effectiveCardSequence[activeSequenceStepIdx ?? -1] === 'speak_blind_en' ||
                  (blindErrorCount > 0 && effectiveCardSequence.includes('speak_blind_en'))) && (
                  <button
                    id="btnRestartBeforeBlindSpeech"
                    type="button"
                    onClick={handleRestartBeforeBlindStage}
                    className="min-h-[32px] sm:min-h-0 text-[10px] font-bold px-2.5 py-1 rounded-md border bg-brand-500/20 hover:bg-brand-500/35 border-brand-400/50 text-brand-200 hover:text-white transition cursor-pointer whitespace-nowrap shadow-xs flex items-center gap-1"
                    title="Voltar para antes da etapa Sem Ler o Inglês para rever e ouvir o texto em inglês novamente"
                  >
                    🔄 Rever EN
                  </button>
                )}
                <button
                  id="btnOpenSpeechSimulator"
                  type="button"
                  onClick={handleOpenSpeechSimulator}
                  className="min-h-[32px] sm:min-h-0 text-[10px] font-semibold px-2.5 py-1 rounded-md border bg-slate-900/80 hover:bg-slate-700/90 border-slate-700 text-slate-300 hover:text-white transition cursor-pointer whitespace-nowrap shadow-xs"
                  title="Digitar ou simular fala sem usar microfone"
                >
                  Simular / Digitar Fala
                </button>
              </div>
            </div>

            <div
              className={`flex-1 flex flex-col ${
                isMobileFocusedLayout ? 'justify-start' : 'justify-center'
              } gap-2`}
            >
              <div className="px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800/90 flex items-center min-h-[36px]">
                <p
                  id="userTranscriptText"
                  className={`text-xs sm:text-sm font-mono break-words leading-snug w-full ${
                    isListeningMic || enginePhase === 'LISTENING_USER'
                      ? 'text-rose-200 font-semibold'
                      : isEnglishTextHidden
                        ? 'text-emerald-300/90 font-semibold'
                        : 'text-slate-300'
                  }`}
                >
                  {isEnglishTextHidden
                    ? isListeningMic || enginePhase === 'LISTENING_USER'
                      ? '🎙️ Ouvindo sua pronúncia em inglês (texto em inglês oculto)...'
                      : lastScore !== null
                        ? '🧠 Tentativa avaliada no modo sem ler o inglês (palavras em inglês ocultas).'
                        : '🧠 Modo sem ler o inglês: olhe apenas o português acima e fale em inglês!'
                    : userTranscript}
                </p>
              </div>

              {(wordResults.length > 0 ||
                Boolean(aiCoachFeedback) ||
                isListeningMic ||
                enginePhase === 'LISTENING_USER' ||
                Boolean(fallbackSpeechRequest)) && (
                <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/80 text-[11px] font-mono">
                  {wordResults.length > 0 && (
                    <div id="wordComparisonRow" className="flex flex-wrap items-center gap-1.5">
                      {wordResults.map((item, idx) => (
                        <button
                          key={`${item.word}-${idx}`}
                          type="button"
                          onClick={() =>
                            runManualAudioPlayback(null, null, item.word, 'en-US', 0.8)
                          }
                          title={
                            isEnglishTextHidden
                              ? 'Palavra em inglês oculta no modo sem leitura (toque para ouvir)'
                              : 'Toque para ouvir a pronúncia desta palavra'
                          }
                          className={`px-2 py-0.5 rounded border cursor-pointer transition ${
                            item.matched
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                              : 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                          }`}
                        >
                          {item.matched ? '✓ ' : '✗ '}
                          {isEnglishTextHidden ? '•••' : item.word}
                        </button>
                      ))}
                    </div>
                  )}

                  {aiCoachFeedback &&
                    (settings.enableAiPronunciationCoach ?? true) &&
                    !isListeningMic &&
                    enginePhase !== 'LISTENING_USER' && (
                      <div
                        id="aiPronunciationCoachBanner"
                        className="text-[11px] text-slate-200 font-sans flex flex-col items-stretch sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-1.5 px-2.5 py-2 rounded-lg bg-emerald-950/35 border border-emerald-500/30"
                      >
                        <p className="text-[11px] sm:text-xs text-slate-200 leading-relaxed min-w-0 sm:flex-1 break-words">
                          <strong className="font-bold text-emerald-300 mr-1">
                            🎯 Coach Fonético:
                          </strong>
                          <span>{aiCoachFeedback.coachTipPt}</span>
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-emerald-500/30 text-emerald-300 whitespace-nowrap">
                            Fluência {aiCoachFeedback.fluencyScore}%
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-indigo-500/30 text-indigo-300 whitespace-nowrap">
                            Ritmo {aiCoachFeedback.prosodyScore}%
                          </span>
                        </div>
                      </div>
                    )}

                  {(isListeningMic ||
                    enginePhase === 'LISTENING_USER' ||
                    Boolean(fallbackSpeechRequest)) && (
                    <div
                      id="phoneticCoachingBox"
                      className="text-[11px] text-slate-300 font-sans px-2.5 py-1.5 rounded-lg bg-indigo-950/35 border border-indigo-500/25 leading-relaxed"
                    >
                      <p className="min-w-0 break-words">
                        <strong className="font-bold text-indigo-300 mr-1">💡 Dica:</strong>
                        {!isEnglishTextHidden && phoneticTips.length > 0 ? (
                          phoneticTips.slice(0, 1).map(t => (
                            <span key={t.word}>
                              <button
                                type="button"
                                onClick={() =>
                                  runManualAudioPlayback(null, null, t.word, 'en-US', 0.75)
                                }
                                className="font-bold text-amber-300 hover:underline mr-1 cursor-pointer"
                              >
                                {t.word} {t.ipaHint ? `(${t.ipaHint})` : ''}:
                              </button>
                              <span>{t.tip}</span>
                            </span>
                          ))
                        ) : (
                          <span>
                            {isEnglishTextHidden
                              ? 'Fale a frase em inglês guiando-se apenas pela tradução em português.'
                              : 'Fale com clareza no seu ritmo; as palavras avaliadas aparecerão ao concluir.'}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* PINNED BOTTOM ACTION DOCK */}
      <footer className="bg-slate-900/95 backdrop-blur border-t border-slate-800 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 xl:px-10 sm:py-3 shrink-0 w-full z-20">
        <div className="max-w-4xl lg:max-w-5xl xl:max-w-[1380px] 2xl:max-w-[1480px] mx-auto flex items-center justify-between gap-2 sm:gap-3 lg:gap-4">
          {/* Prev Sentence */}
          <button
            id="btnPrevSentence"
            type="button"
            onClick={() => navigateSentence(-1)}
            disabled={currentIndex === 0}
            aria-label="Sentença Anterior"
            title="Sentença Anterior"
            className="min-w-[44px] min-h-[44px] p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 active:scale-95 text-slate-300 transition cursor-pointer flex items-center justify-center shrink-0"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Big Center Mic / Start / Resume / Pause */}
          {(() => {
            const loopBtnMode = resolveLoopButtonMode({
              isPlayingLoop,
              pausedResumeSeqIdx
            });
            const loopBtnGradient =
              loopBtnMode === 'pause'
                ? 'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/25'
                : loopBtnMode === 'resume'
                  ? 'from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/25'
                  : 'from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 shadow-brand-500/25';
            const loopBtnLabel =
              loopBtnMode === 'pause'
                ? 'Pausar Treino'
                : loopBtnMode === 'resume'
                  ? 'Continuar Treino'
                  : 'Iniciar Treino';
            return (
              <button
                id="btnToggleLoop"
                type="button"
                onClick={handleToggleLoop}
                title={
                  loopBtnMode === 'resume'
                    ? 'Continuar o treino a partir da etapa pausada ou selecionada'
                    : loopBtnMode === 'pause'
                      ? 'Pausar o treino automático'
                      : 'Iniciar o treino automático'
                }
                className={`min-h-[44px] flex-1 py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r ${loopBtnGradient} active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap`}
              >
                {loopBtnMode === 'pause' ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                  </svg>
                )}
                <span id="textLoopBtn">{loopBtnLabel}</span>
              </button>
            );
          })()}

          {/* Manual Mic Record Toggle */}
          <button
            id="btnManualMic"
            type="button"
            onClick={handleManualMic}
            aria-label={isListeningMic ? 'Microfone aberto — Fale agora' : 'Falar Agora'}
            title={isListeningMic ? 'Microfone aberto — Fale agora!' : 'Falar Agora'}
            className={`min-w-[44px] min-h-[44px] p-2.5 sm:p-3 rounded-xl active:scale-95 transition relative cursor-pointer flex items-center justify-center shrink-0 ${
              isListeningMic
                ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400 shadow-lg shadow-rose-500/40 animate-pulse'
                : micPermissionGranted
                  ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            {isListeningMic && (
              <span
                id="micLiveRing"
                className="absolute inset-0 rounded-xl border-2 border-rose-300 mic-pulse pointer-events-none"
              />
            )}
          </button>

          {/* Next / Skip Sentence */}
          <button
            id="btnNextSentence"
            type="button"
            onClick={handleNextSentenceButton}
            disabled={currentIndex >= sentences.length - 1}
            aria-label="Próxima Sentença"
            title="Concluir / Próxima Sentença"
            className="min-w-[44px] min-h-[44px] p-2.5 sm:p-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 active:scale-95 text-slate-300 transition cursor-pointer flex items-center justify-center shrink-0"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </footer>

      {/* POCKET MODE OVERLAY */}
      <PocketModeOverlay
        isOpen={isPocketMode}
        currentIndex={currentIndex}
        totalSentences={sentences.length}
        isListeningMic={isListeningMic}
        onExit={handleExitPocketMode}
      />

      {/* MODAL: BUY ME A COFFEE / DONATIONS */}
      <DonateCoffeeModal
        isOpen={isDonateModalOpen}
        onClose={() => setIsDonateModalOpen(false)}
        onShowToast={showToast}
      />

      {/* MODAL: GOOGLE DRIVE INVISIBLE AUTO-SYNC */}
      <GoogleDriveSyncModal
        isOpen={isDriveSyncModalOpen}
        user={driveUser}
        hasAccessToken={hasDriveToken}
        status={driveSyncStatus}
        statusError={driveSyncError}
        statusHelpUrl={driveAuthHelpUrl}
        lastSyncedAt={driveLastSyncedAt}
        remoteFileMeta={driveRemoteFileMeta}
        pendingConfirmation={drivePendingConfirmation}
        localSummary={driveLocalSummary}
        onSignIn={handleDriveSignIn}
        onSignOut={handleDriveSignOut}
        onSyncNow={async () => {
          const token = getInMemoryDriveAccessToken();
          if (!token) {
            setHasDriveToken(false);
            setDriveSyncStatus('needs_reauth');
            return;
          }
          await reconcileWithGoogleDrive(token, true);
        }}
        onConfirmInitialUpload={handleConfirmInitialDriveUpload}
        onConfirmMergeSync={handleConfirmMergeDriveSync}
        onRestoreFromDriveOnly={handleRestoreFromDriveOnly}
        onConfirmOverwriteDrive={handleConfirmInitialDriveUpload}
        onCancelPendingConfirmation={() => {
          setDrivePendingConfirmation(null);
          setDriveSyncStatus(hasDriveToken ? 'disconnected' : 'needs_reauth');
        }}
        onDeleteRemoteBackup={handleDeleteRemoteDriveBackup}
        onClose={() => setIsDriveSyncModalOpen(false)}
      />

      {/* MODAL: SENTENCE NAVIGATOR & CEFR FILTER */}
      <SentenceNavigatorModal
        isOpen={isSentenceNavOpen}
        bookTitle={currentBookTitle}
        sentences={sentences}
        currentIndex={currentIndex}
        sentenceProgress={sentenceProgress}
        onSelectSentence={jumpToSentence}
        onClose={() => setIsSentenceNavOpen(false)}
      />

      {/* MODAL: PROGRESS & STUDY STATS */}
      <StatsModal
        isOpen={isStatsOpen}
        stats={studyStats}
        dailyGoal={settings.dailyGoalSentences || 10}
        practiceDaysGoal={settings.practiceDaysGoal || 14}
        onUpdateDailyGoal={goal => handleUpdateSettings({ dailyGoalSentences: goal })}
        onUpdatePracticeDaysGoal={days => handleUpdateSettings({ practiceDaysGoal: days })}
        onSpeakWord={w => speakText(w, 'en-US', 0.8)}
        onOpenDict={w =>
          setDictWord({
            word: w,
            context: currentSentence?.en || ''
          })
        }
        onStartPractice={() => {
          setIsStatsOpen(false);
        }}
        onClose={() => setIsStatsOpen(false)}
      />

      {/* MODAL: SETTINGS */}
      <SettingsModal
        isOpen={isSettingsOpen}
        initialTab={settingsInitialTab}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClose={() => {
          setIsSettingsOpen(false);
        }}
        onShowToast={showToast}
      />

      {/* MODAL: LIBRARY & PDF UPLOAD */}
      <LibraryModal
        isOpen={isLibraryOpen}
        currentBookId={currentBookId}
        savedBooks={savedBooks}
        onClose={() => setIsLibraryOpen(false)}
        onSelectBook={handleSelectBook}
        onDeleteSavedBook={handleDeleteSavedBook}
        onUploadBook={handleUploadBook}
        onShowToast={showToast}
      />

      {/* MODAL: SAVED VOCABULARY & SRS FLASHCARDS */}
      <VocabModal
        isOpen={isVocabOpen}
        savedVocab={savedVocab}
        onClose={() => setIsVocabOpen(false)}
        onDeleteItem={handleDeleteVocabItem}
        onRateSrsItem={handleRateSrsItem}
        onClearAll={handleClearAllVocab}
        onSpeakText={word => speakText(word, 'en-US', 0.85)}
        onShowToast={showToast}
      />

      {/* MODAL: WORD DICTIONARY */}
      <DictionaryModal
        word={dictWord?.word || null}
        contextSentence={dictWord?.context || currentSentence?.en || ''}
        onClose={() => setDictWord(null)}
        onSpeakWord={w => {
          stopAllAudio();
          speakText(w, 'en-US', 0.85);
        }}
        onSaveVocab={handleSaveVocabItem}
      />

      {/* MODAL: BOOK COMPLETED */}
      <BookCompletedModal
        isOpen={isBookCompletedOpen}
        bookTitle={currentBookTitle}
        totalSentences={sentences.length}
        vocabCount={savedVocab.length}
        onRestart={() => {
          setIsBookCompletedOpen(false);
          setCurrentIndex(0);
          currentIndexRef.current = 0;
          setStreak(0);
          ShadowRepository.books.updateBookmark(currentBookId, 0);
          showToast('Livro reiniciado do início!');
        }}
        onChooseAnother={() => {
          setIsBookCompletedOpen(false);
          setIsLibraryOpen(true);
        }}
      />

      {/* MODAL: FALLBACK SPEECH INPUT */}
      <FallbackSpeechModal
        isOpen={Boolean(fallbackSpeechRequest)}
        targetSentence={fallbackSpeechRequest?.target || currentSentence?.en || ''}
        hideEnglishText={isEnglishTextHidden}
        ptHint={
          isStepByStepMode && activeStudyStep && activeStudyStep.ptText
            ? activeStudyStep.ptText
            : currentSentence?.pt || ''
        }
        onSubmitSpeech={val => {
          fallbackCancelledByUserRef.current = false;
          const normalizedVal = normalizeSpokenTranscriptNumbers(
            val,
            fallbackSpeechRequest?.target || currentSentence?.en || ''
          );
          fallbackSpeechRequest?.resolve(normalizedVal);
        }}
        onClose={() => {
          fallbackCancelledByUserRef.current = true;
          fallbackSpeechRequest?.resolve('');
        }}
      />

      {/* MODAL: POST-SENTENCE CHALLENGES (1: Word Pronunciation, 2: Word Matching) */}
      <PostSentenceChallengeModal
        isOpen={Boolean(postSentenceChallengeRequest)}
        sentenceEn={postSentenceChallengeRequest?.sentenceEn || currentSentence?.en || ''}
        sentenceIndex={postSentenceChallengeRequest?.sentenceIndex ?? currentIndex}
        sentenceWordMistakes={postSentenceChallengeRequest?.wordMistakes}
        enablePronunciationChallenge={
          postSentenceChallengeRequest?.enablePronunciation ?? true
        }
        enableMatchingChallenge={postSentenceChallengeRequest?.enableMatching ?? true}
        repeatSentenceOnChallengeFail={settings.repeatSentenceOnChallengeFail}
        audioBeeps={settings.audioBeeps}
        autoHandsFree={settings.autoHandsFree}
        handsFreeMaxAttempts={settings.handsFreeMaxAttempts ?? 2}
        handsFreeChallengeMode={settings.handsFreeChallengeMode ?? 'voice_all'}
        handsFreeVoiceCommands={settings.handsFreeVoiceCommands ?? true}
        onSpeakWord={w => speakText(w, 'en-US', 0.85)}
        onSpeakWordAsync={w => speakText(w, 'en-US', 0.85)}
        onSpeakPtAsync={pt => speakText(pt, 'pt-BR', 1.05)}
        onListenWord={w => listenForSpeech(w, 12500, true)}
        onStopListeningEarly={() => finishSpeechEarlyRef.current?.()}
        onAbortListening={() => abortSpeechCaptureRef.current?.()}
        onFinish={outcome => postSentenceChallengeRequest?.resolve(outcome)}
      />

      {/* TOAST NOTIFICATION (Positioned at top-center below header so it never overlaps the Speech Card) */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-[calc(env(safe-area-inset-top)+3.75rem)] sm:top-16 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md text-center bg-slate-800/95 backdrop-blur border border-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xl z-50 transition-all duration-200 pointer-events-none"
        >
          {toastMessage}
        </div>
      )}

      {/* PERSISTENT GLOBAL AUDIO PLAYER */}
      <audio id="globalAudioPlayer" playsInline preload="auto" className="hidden" />
    </div>
  );
}
