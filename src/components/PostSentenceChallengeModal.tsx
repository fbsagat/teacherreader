import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DICT_DB } from '../data/dictionaryDb';
import {
  hasCachedLiteralWord,
  playChime,
  resolveLiteralWordWithAlternatives,
  stopAllAudioPlayback
} from '../services/audioAndTranslationService';
import {
  detectHandsFreeVoiceCommand,
  getBrazilianPhoneticTip
} from '../utils/shadowing';
import {
  evaluateWordPronunciation,
  resolvePronounceButtonAction
} from '../utils/challengeFlow';
import {
  buildInitialMatchingItems,
  buildPronunciationChallengeWords,
  deduplicateMatchingTranslations,
  EXTRA_DISTRACTOR_POOL
} from '../utils/matchingPairs';
import { HandsFreeChallengeMode } from '../types/shadowreader';

export interface ChallengeWordItem {
  id: string;
  en: string;
  pt: string;
  ipa: string;
  mistakeCount?: number;
}

interface PostSentenceChallengeModalProps {
  isOpen: boolean;
  sentenceEn: string;
  sentenceIndex: number;
  enablePronunciationChallenge: boolean;
  enableMatchingChallenge: boolean;
  repeatSentenceOnChallengeFail: boolean;
  audioBeeps: boolean;
  autoHandsFree?: boolean;
  handsFreeMaxAttempts?: number;
  handsFreeChallengeMode?: HandsFreeChallengeMode;
  handsFreeVoiceCommands?: boolean;
  sentenceWordMistakes?: Record<string, number>;
  onSpeakWord: (word: string) => void;
  onSpeakWordAsync?: (word: string) => Promise<boolean>;
  onSpeakPtAsync?: (ptWord: string) => Promise<boolean>;
  onListenWord: (targetWord: string) => Promise<string>;
  onStopListeningEarly?: () => void;
  onAbortListening?: () => void;
  onFinish: (outcome: 'advance' | 'repeat' | 'cancel', mistakesCount: number) => void;
}

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed + 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

export const PostSentenceChallengeModal: React.FC<PostSentenceChallengeModalProps> = ({
  isOpen,
  sentenceEn,
  sentenceIndex,
  enablePronunciationChallenge,
  enableMatchingChallenge,
  repeatSentenceOnChallengeFail,
  audioBeeps,
  autoHandsFree = false,
  handsFreeMaxAttempts = 2,
  handsFreeChallengeMode = 'voice_all',
  handsFreeVoiceCommands = true,
  sentenceWordMistakes,
  onSpeakWord,
  onSpeakWordAsync,
  onSpeakPtAsync,
  onListenWord,
  onStopListeningEarly,
  onAbortListening,
  onFinish
}) => {
  const [challengeWords, setChallengeWords] = useState<ChallengeWordItem[]>([]);
  const [matchingPool, setMatchingPool] = useState<ChallengeWordItem[]>([]);
  const [stage, setStage] = useState<'pronunciation' | 'matching' | 'result'>('pronunciation');

  // Stage 1: Pronunciation state
  const [pronIndex, setPronIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [pronFeedback, setPronFeedback] = useState<{
    status: 'idle' | 'success' | 'error' | 'no_speech';
    spoken: string;
    score?: number;
  }>({ status: 'idle', spoken: '' });
  const [wordFailures, setWordFailures] = useState(0);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInputVal, setManualInputVal] = useState('');

  // Stage 2: Card matching state
  const [selectedEnId, setSelectedEnId] = useState<string | null>(null);
  const [selectedPtId, setSelectedPtId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<{ enId: string; ptId: string } | null>(null);
  const [handsFreeMatchStatus, setHandsFreeMatchStatus] = useState<string>('');
  const [isResolvingTranslations, setIsResolvingTranslations] = useState<boolean>(false);

  // Shared error counter across both challenges
  const [mistakesCount, setMistakesCount] = useState(0);
  const pronAdvanceTimerRef = useRef<number | null>(null);
  const matchTimerRef = useRef<number | null>(null);
  const resultAutoFinishTimerRef = useRef<number | null>(null);
  const pendingWaitCancelsRef = useRef<Set<() => void>>(new Set());
  const pronHandsFreeTokenRef = useRef(0);
  const matchHandsFreeTokenRef = useRef(0);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const isListeningRef = useRef(false);
  const isAdvancingWordRef = useRef(false);
  const wordFailuresRef = useRef(0);
  const mistakesCountRef = useRef(0);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const updateIsListening = (listening: boolean) => {
    isListeningRef.current = listening;
    setIsListening(listening);
  };

  const waitManagedMs = (ms: number) =>
    new Promise<void>(resolve => {
      let settled = false;
      const cleanupAndResolve = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timerId);
        pendingWaitCancelsRef.current.delete(cleanupAndResolve);
        resolve();
      };
      const timerId = window.setTimeout(cleanupAndResolve, ms);
      pendingWaitCancelsRef.current.add(cleanupAndResolve);
    });

  const cancelChallengeAudioAndTimers = () => {
    pronHandsFreeTokenRef.current += 1;
    matchHandsFreeTokenRef.current += 1;
    if (pronAdvanceTimerRef.current) {
      window.clearTimeout(pronAdvanceTimerRef.current);
      pronAdvanceTimerRef.current = null;
    }
    if (matchTimerRef.current) {
      window.clearTimeout(matchTimerRef.current);
      matchTimerRef.current = null;
    }
    if (resultAutoFinishTimerRef.current) {
      window.clearTimeout(resultAutoFinishTimerRef.current);
      resultAutoFinishTimerRef.current = null;
    }
    const cancels = Array.from(pendingWaitCancelsRef.current);
    pendingWaitCancelsRef.current.clear();
    cancels.forEach(cancel => cancel());
    stopAllAudioPlayback();
  };

  const handleFinishChallenge = (
    outcome: 'advance' | 'repeat' | 'cancel',
    finalMistakes = mistakesCountRef.current
  ) => {
    cancelChallengeAudioAndTimers();
    if (isListeningRef.current || isListening) {
      if (onAbortListening) {
        onAbortListening();
      } else {
        onStopListeningEarly?.();
      }
      updateIsListening(false);
    }
    isAdvancingWordRef.current = false;
    onFinishRef.current(outcome, finalMistakes);
  };

  useEffect(() => {
    if (!isOpen) {
      cancelChallengeAudioAndTimers();
      updateIsListening(false);
      isAdvancingWordRef.current = false;
    }
    return () => {
      cancelChallengeAudioAndTimers();
    };
  }, [isOpen]);

  // Build words from the completed sentence synchronously on open, then refine translations asynchronously
  useEffect(() => {
    if (!isOpen || !sentenceEn) return;

    let cancelled = false;

    const initialCandidates = buildInitialMatchingItems(
      sentenceEn,
      DICT_DB,
      5,
      sentenceWordMistakes
    );
    const pronCandidates = buildPronunciationChallengeWords(
      sentenceEn,
      DICT_DB,
      sentenceWordMistakes,
      5
    );
    const initialAltsMap: Record<string, string[]> = {};
    for (const c of initialCandidates) {
      initialAltsMap[c.id] = c.localAlternatives;
    }

    const baseItems: ChallengeWordItem[] = deduplicateMatchingTranslations(
      initialCandidates.map(c => ({
        id: c.id,
        en: c.en,
        pt: c.pt,
        ipa: c.ipa,
        mistakeCount: c.mistakeCount
      })),
      initialAltsMap
    );

    const pronList: ChallengeWordItem[] = pronCandidates.map(c => ({
      id: c.id,
      en: c.en,
      pt: c.pt,
      ipa: c.ipa,
      mistakeCount: c.mistakeCount
    }));
    setChallengeWords(pronList);
    setMatchingPool(baseItems);

    // Reset states immediately
    isAdvancingWordRef.current = false;
    wordFailuresRef.current = 0;
    mistakesCountRef.current = 0;
    updateIsListening(false);
    setPronIndex(0);
    setPronFeedback({ status: 'idle', spoken: '' });
    setWordFailures(0);
    setShowManualInput(false);
    setManualInputVal('');
    setSelectedEnId(null);
    setSelectedPtId(null);
    setMatchedIds([]);
    setWrongPair(null);
    setMistakesCount(0);

    if (enablePronunciationChallenge && pronList.length > 0) {
      setStage('pronunciation');
    } else if (enableMatchingChallenge && baseItems.length > 0) {
      setStage('matching');
    } else {
      setStage('pronunciation');
    }

    const hasPendingLiteral = initialCandidates.some(
      c => c.fromSentence && !hasCachedLiteralWord(c.en)
    );
    setIsResolvingTranslations(hasPendingLiteral);

    // Resolve isolated literal translations in parallel via Google GTX (word-by-word literal priority)
    const enrichTranslations = async () => {
      try {
        const resolvedResults = await Promise.all(
          initialCandidates.map(async cand => {
            if (!cand.fromSentence) {
              return {
                id: cand.id,
                primaryPt: cand.pt,
                alternatives: cand.localAlternatives
              };
            }
            const res = await resolveLiteralWordWithAlternatives(cand.en);
            const fallbackAlts = cand.localAlternatives;
            const mergedAlts = Array.from(new Set([...res.alternatives, ...fallbackAlts]));
            const chosenPrimary =
              res.primaryPt && res.primaryPt.toLowerCase() !== cand.en.toLowerCase()
                ? res.primaryPt
                : cand.pt;
            return {
              id: cand.id,
              primaryPt: chosenPrimary,
              alternatives: mergedAlts
            };
          })
        );

        if (cancelled) return;

        const updatedAltsMap: Record<string, string[]> = {};
        const byId = new Map<string, string>();
        for (const r of resolvedResults) {
          updatedAltsMap[r.id] = r.alternatives;
          if (r.primaryPt) {
            byId.set(r.id, r.primaryPt);
          }
        }

        const byEn = new Map<string, string>();
        for (const cand of initialCandidates) {
          const val = byId.get(cand.id);
          if (val) byEn.set(cand.en.toLowerCase(), val);
        }

        // Also resolve any Stage-1-only pronunciation word not already fetched in initialCandidates
        const missingPronCands = pronCandidates.filter(
          pc => !byEn.has(pc.en.toLowerCase()) && pc.fromSentence
        );
        if (missingPronCands.length > 0) {
          const extraResolved = await Promise.all(
            missingPronCands.map(async pc => {
              const res = await resolveLiteralWordWithAlternatives(pc.en);
              return {
                en: pc.en.toLowerCase(),
                primaryPt:
                  res.primaryPt && res.primaryPt.toLowerCase() !== pc.en.toLowerCase()
                    ? res.primaryPt
                    : pc.pt
              };
            })
          );
          if (!cancelled) {
            for (const er of extraResolved) {
              if (er.primaryPt) byEn.set(er.en, er.primaryPt);
            }
          }
        }
        if (cancelled) return;

        const dedupedMatchList = deduplicateMatchingTranslations(
          baseItems.map(item => ({
            ...item,
            pt: byId.get(item.id) || item.pt
          })),
          updatedAltsMap
        );

        const dedupedByEn = new Map(dedupedMatchList.map(m => [m.en.toLowerCase(), m.pt]));
        setMatchingPool(dedupedMatchList);
        setChallengeWords(prev =>
          prev.map(cw => ({
            ...cw,
            pt: dedupedByEn.get(cw.en.toLowerCase()) || byEn.get(cw.en.toLowerCase()) || cw.pt
          }))
        );
      } finally {
        if (!cancelled) {
          setIsResolvingTranslations(false);
        }
      }
    };
    enrichTranslations();

    return () => {
      cancelled = true;
    };
  }, [
    enableMatchingChallenge,
    enablePronunciationChallenge,
    isOpen,
    sentenceEn,
    sentenceWordMistakes
  ]);

  const shuffledEnCards = useMemo(
    () => deterministicShuffle(matchingPool, sentenceIndex * 13 + 7),
    [matchingPool, sentenceIndex]
  );

  const shuffledPtCards = useMemo(
    () => deterministicShuffle(matchingPool, sentenceIndex * 29 + 3),
    [matchingPool, sentenceIndex]
  );

  const activePronWord = challengeWords[pronIndex] || null;
  const maxAllowedMistakes = 2; // 3 or more errors triggers sentence repetition if enabled
  const shouldRepeatSentence =
    repeatSentenceOnChallengeFail && mistakesCount > maxAllowedMistakes;

  const shouldRunMatchingStage =
    enableMatchingChallenge &&
    matchingPool.length > 0 &&
    (!autoHandsFree || handsFreeChallengeMode === 'voice_all');

  const advanceFromPronunciationWord = (nextMistakesCount = mistakesCountRef.current) => {
    cancelChallengeAudioAndTimers();
    updateIsListening(false);
    isAdvancingWordRef.current = false;
    wordFailuresRef.current = 0;
    setPronFeedback({ status: 'idle', spoken: '' });
    setWordFailures(0);
    setShowManualInput(false);
    setManualInputVal('');

    if (pronIndex + 1 < challengeWords.length) {
      setPronIndex(prev => prev + 1);
    } else if (shouldRunMatchingStage) {
      setStage('matching');
    } else {
      setStage('result');
      if (nextMistakesCount >= 0) {
        playChime('success', audioBeeps);
      }
    }
  };

  useEffect(() => {
    isAdvancingWordRef.current = false;
  }, [isOpen, stage, pronIndex]);

  const runPronunciationHandsFreeFlow = async (
    wordItem: ChallengeWordItem,
    token: number,
    options: { skipIntro?: boolean; startAttempt?: number } = {}
  ) => {
    const isAlive = () =>
      isOpenRef.current &&
      autoHandsFree &&
      pronHandsFreeTokenRef.current === token &&
      !isAdvancingWordRef.current;

    const speakEnHelper = async (word: string) => {
      if (onSpeakWordAsync) {
        await onSpeakWordAsync(word);
      } else {
        onSpeakWord(word);
        await waitManagedMs(650);
      }
    };

    const speakPtHelper = async (ptWord: string) => {
      if (onSpeakPtAsync) {
        await onSpeakPtAsync(ptWord);
      } else {
        await waitManagedMs(450);
      }
    };

    if (!options.skipIntro) {
      await waitManagedMs(260);
      if (!isAlive()) return;

      // Mode 'auto_review': hands-free audio vocabulary review without requiring mic input
      if (handsFreeChallengeMode === 'auto_review') {
        await speakEnHelper(wordItem.en);
        if (!isAlive()) return;
        await speakPtHelper(wordItem.pt);
        if (!isAlive()) return;
        isAdvancingWordRef.current = true;
        setPronFeedback({
          status: 'success',
          spoken: wordItem.en,
          score: 100
        });
        await waitManagedMs(380);
        if (
          pronHandsFreeTokenRef.current !== token ||
          !isOpenRef.current ||
          !isAdvancingWordRef.current
        )
          return;
        advanceFromPronunciationWord(mistakesCountRef.current);
        return;
      }

      // Modes 'voice_all' and 'pronunciation_only': speak target word, then open mic
      await speakEnHelper(wordItem.en);
      if (!isAlive()) return;
      await waitManagedMs(180);
      if (!isAlive()) return;
    }

    const maxAtt = Math.max(1, handsFreeMaxAttempts || 2);
    let attempt = Math.max(0, Math.min(options.startAttempt ?? 0, maxAtt - 1));

    while (attempt < maxAtt && isAlive()) {
      attempt++;
      updateIsListening(true);
      let spokenRaw = '';
      try {
        spokenRaw = await onListenWord(wordItem.en);
      } catch {
        spokenRaw = '';
      }
      if (!isAlive()) {
        // Only clear listening indicator if no newer capture took ownership
        if (pronHandsFreeTokenRef.current === token) {
          updateIsListening(false);
        }
        return;
      }
      updateIsListening(false);

      const trimmed = (spokenRaw || '').trim();
      if (handsFreeVoiceCommands && trimmed) {
        const cmd = detectHandsFreeVoiceCommand(trimmed, wordItem.en);
        if (cmd === 'skip') {
          isAdvancingWordRef.current = true;
          advanceFromPronunciationWord(mistakesCountRef.current);
          return;
        }
        if (cmd === 'repeat') {
          attempt = Math.max(0, attempt - 1);
          await speakEnHelper(wordItem.en);
          continue;
        }
      }

      const evalResult = evaluateWordPronunciation(wordItem.en, trimmed);
      if (evalResult.passed) {
        isAdvancingWordRef.current = true;
        playChime('success', audioBeeps);
        setPronFeedback({
          status: 'success',
          spoken: evalResult.trimmedRaw || wordItem.en,
          score: evalResult.score
        });
        await waitManagedMs(520);
        if (
          pronHandsFreeTokenRef.current !== token ||
          !isOpenRef.current ||
          !isAdvancingWordRef.current
        )
          return;
        advanceFromPronunciationWord(mistakesCountRef.current);
        return;
      }

      // Failed or no speech captured
      playChime('retry', audioBeeps);
      if (evalResult.trimmedRaw) {
        mistakesCountRef.current += 1;
        setMistakesCount(mistakesCountRef.current);
        setPronFeedback({
          status: 'error',
          spoken: evalResult.trimmedRaw,
          score: evalResult.score
        });
      } else {
        setPronFeedback({ status: 'no_speech', spoken: '', score: 0 });
      }
      wordFailuresRef.current = attempt;
      setWordFailures(attempt);

      if (attempt < maxAtt && isAlive()) {
        await waitManagedMs(280);
        if (!isAlive()) return;
        await speakEnHelper(wordItem.en);
        if (!isAlive()) return;
        await waitManagedMs(180);
      }
    }

    // Max attempts reached in Hands-Free: play reference pronunciation and advance automatically!
    if (isAlive()) {
      await speakEnHelper(wordItem.en);
      if (!isAlive()) return;
      await waitManagedMs(320);
      if (!isAlive()) return;
      isAdvancingWordRef.current = true;
      advanceFromPronunciationWord(mistakesCountRef.current);
    }
  };

  // HANDS-FREE AUTOMATION: Stage 1 (Pronunciation) & Auto-Review Mode
  useEffect(() => {
    if (!isOpen || !autoHandsFree || stage !== 'pronunciation' || !activePronWord) return;

    cancelChallengeAudioAndTimers();
    const token = pronHandsFreeTokenRef.current;
    runPronunciationHandsFreeFlow(activePronWord, token, { skipIntro: false, startAttempt: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    autoHandsFree,
    stage,
    pronIndex,
    activePronWord?.id,
    handsFreeChallengeMode,
    handsFreeMaxAttempts
  ]);

  // HANDS-FREE AUTOMATION: Stage 2 (Voice-Driven Card Association)
  useEffect(() => {
    if (!isOpen || !autoHandsFree || stage !== 'matching' || isResolvingTranslations) return;

    if (handsFreeChallengeMode !== 'voice_all') {
      setStage('result');
      return;
    }

    const nextUnmatchedPt = shuffledPtCards.find(item => !matchedIds.includes(item.id));
    if (!nextUnmatchedPt) {
      if (matchingPool.length > 0 && matchedIds.length >= matchingPool.length) {
        const t = window.setTimeout(() => setStage('result'), 450);
        return () => window.clearTimeout(t);
      }
      return;
    }

    matchHandsFreeTokenRef.current += 1;
    const token = matchHandsFreeTokenRef.current;
    const isAlive = () => isOpen && autoHandsFree && matchHandsFreeTokenRef.current === token;

    const waitMs = (ms: number) =>
      new Promise<void>(r => {
        window.setTimeout(r, ms);
      });

    const speakEnHelper = async (word: string) => {
      if (onSpeakWordAsync) {
        await onSpeakWordAsync(word);
      } else {
        onSpeakWord(word);
        await waitMs(600);
      }
    };

    const speakPtHelper = async (ptWord: string) => {
      if (onSpeakPtAsync) {
        await onSpeakPtAsync(ptWord);
      } else {
        await waitMs(450);
      }
    };

    (async () => {
      setSelectedPtId(nextUnmatchedPt.id);
      setSelectedEnId(null);
      setHandsFreeMatchStatus(
        `🙌 Ouça "${nextUnmatchedPt.pt}" e diga a palavra correspondente em inglês...`
      );
      await waitMs(240);
      if (!isAlive()) return;

      await speakPtHelper(nextUnmatchedPt.pt);
      if (!isAlive()) return;

      const maxAtt = Math.max(1, handsFreeMaxAttempts || 2);
      let attempt = 0;
      let pairResolved = false;

      while (attempt < maxAtt && !pairResolved && isAlive()) {
        attempt++;
        updateIsListening(true);
        let spokenRaw = '';
        try {
          spokenRaw = await onListenWord(nextUnmatchedPt.en);
        } catch {
          spokenRaw = '';
        }
        if (matchHandsFreeTokenRef.current === token) {
          updateIsListening(false);
        }
        if (!isAlive()) return;

        const trimmed = (spokenRaw || '').trim();
        if (handsFreeVoiceCommands && trimmed) {
          const cmd = detectHandsFreeVoiceCommand(trimmed, nextUnmatchedPt.en);
          if (cmd === 'skip') {
            pairResolved = true;
            break;
          }
          if (cmd === 'repeat') {
            attempt = Math.max(0, attempt - 1);
            await speakPtHelper(nextUnmatchedPt.pt);
            continue;
          }
        }

        const evalPair = evaluateWordPronunciation(nextUnmatchedPt.en, trimmed);
        const matchedTarget = evalPair.passed;

        if (matchedTarget) {
          pairResolved = true;
          playChime('success', audioBeeps);
          setSelectedEnId(nextUnmatchedPt.id);
          setHandsFreeMatchStatus(
            `✓ Associado por voz: "${nextUnmatchedPt.pt}" ↔ "${nextUnmatchedPt.en}"!`
          );
          await speakEnHelper(nextUnmatchedPt.en);
          if (!isAlive()) return;
          setMatchedIds(prev =>
            prev.includes(nextUnmatchedPt.id) ? prev : [...prev, nextUnmatchedPt.id]
          );
          setSelectedPtId(null);
          setSelectedEnId(null);
          return;
        }

        playChime('retry', audioBeeps);
        if (evalPair.trimmedRaw) {
          mistakesCountRef.current += 1;
          setMistakesCount(mistakesCountRef.current);
        }
        if (attempt < maxAtt && isAlive()) {
          setHandsFreeMatchStatus(
            `Tente mais uma vez (${attempt}/${maxAtt}): como se diz "${nextUnmatchedPt.pt}" em inglês?`
          );
          await waitManagedMs(250);
          if (!isAlive()) return;
          await speakPtHelper(nextUnmatchedPt.pt);
        }
      }

      // Auto-complete pair after maxAttempts so Hands-Free never stalls on the matching board
      if (isAlive()) {
        setSelectedEnId(nextUnmatchedPt.id);
        setHandsFreeMatchStatus(
          `🙌 Mãos Livres: "${nextUnmatchedPt.pt}" = "${nextUnmatchedPt.en}" (avançando...)`
        );
        await speakEnHelper(nextUnmatchedPt.en);
        if (!isAlive()) return;
        setMatchedIds(prev =>
          prev.includes(nextUnmatchedPt.id) ? prev : [...prev, nextUnmatchedPt.id]
        );
        setSelectedPtId(null);
        setSelectedEnId(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    autoHandsFree,
    stage,
    matchedIds.length,
    matchingPool.length,
    handsFreeChallengeMode,
    handsFreeMaxAttempts,
    isResolvingTranslations
  ]);

  // HANDS-FREE AUTOMATION: Stage 3 (Result Auto-Advance / Repeat)
  useEffect(() => {
    if (!isOpen || !autoHandsFree || stage !== 'result') return;

    if (resultAutoFinishTimerRef.current) {
      window.clearTimeout(resultAutoFinishTimerRef.current);
    }
    resultAutoFinishTimerRef.current = window.setTimeout(() => {
      resultAutoFinishTimerRef.current = null;
      handleFinishChallenge(shouldRepeatSentence ? 'repeat' : 'advance', mistakesCount);
    }, 950);

    return () => {
      if (resultAutoFinishTimerRef.current) {
        window.clearTimeout(resultAutoFinishTimerRef.current);
        resultAutoFinishTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoHandsFree, stage, shouldRepeatSentence, mistakesCount]);

  if (!isOpen) return null;

  const evaluateSpokenChallengeWord = (spokenRaw: string) => {
    if (!activePronWord || isAdvancingWordRef.current || pronFeedback.status === 'success') return;

    cancelChallengeAudioAndTimers();
    if (isListeningRef.current) {
      onAbortListening?.();
      updateIsListening(false);
    }

    const evalResult = evaluateWordPronunciation(activePronWord.en, spokenRaw);

    // If browser microphone captured no sound at all (common on short 1-syllable words like "through"),
    // do NOT penalize mistakesCount; prompt user with short-word tips and 1-click confirmation
    if (!evalResult.trimmedRaw) {
      playChime('retry', audioBeeps);
      wordFailuresRef.current += 1;
      setWordFailures(wordFailuresRef.current);
      setPronFeedback({
        status: 'no_speech',
        spoken: '',
        score: 0
      });
      return;
    }

    if (evalResult.passed) {
      isAdvancingWordRef.current = true;
      playChime('success', audioBeeps);
      setPronFeedback({
        status: 'success',
        spoken: evalResult.trimmedRaw || activePronWord.en,
        score: evalResult.score
      });
      if (pronAdvanceTimerRef.current) window.clearTimeout(pronAdvanceTimerRef.current);
      pronAdvanceTimerRef.current = window.setTimeout(() => {
        pronAdvanceTimerRef.current = null;
        advanceFromPronunciationWord(mistakesCountRef.current);
      }, 650);
    } else {
      playChime('retry', audioBeeps);
      mistakesCountRef.current += 1;
      setMistakesCount(mistakesCountRef.current);
      wordFailuresRef.current += 1;
      setWordFailures(wordFailuresRef.current);
      setPronFeedback({
        status: 'error',
        spoken: evalResult.trimmedRaw,
        score: evalResult.score
      });
    }
  };

  const handleRecordPronunciationWord = async () => {
    const action = resolvePronounceButtonAction({
      isOpen: isOpenRef.current,
      hasActiveWord: Boolean(activePronWord),
      isListening: isListeningRef.current,
      isAdvancingWord: isAdvancingWordRef.current,
      pronStatus: pronFeedback.status,
      autoHandsFree,
      handsFreeChallengeMode
    });

    if (action === 'ignore' || !activePronWord) return;

    if (action === 'stop_listening_early') {
      onStopListeningEarly?.();
      return;
    }

    if (action === 'fast_forward_hands_free') {
      // Cancel intro TTS/timers immediately and take over cleanly with a single new token
      cancelChallengeAudioAndTimers();
      const token = pronHandsFreeTokenRef.current;
      setPronFeedback({ status: 'idle', spoken: '' });
      const maxAtt = Math.max(1, handsFreeMaxAttempts || 2);
      await runPronunciationHandsFreeFlow(activePronWord, token, {
        skipIntro: true,
        startAttempt: Math.min(wordFailuresRef.current, maxAtt - 1)
      });
      return;
    }

    // Standard Manual / Auto-Review override capture
    cancelChallengeAudioAndTimers();
    const manualToken = pronHandsFreeTokenRef.current;
    updateIsListening(true);
    setPronFeedback({ status: 'idle', spoken: '' });
    try {
      const spoken = await onListenWord(activePronWord.en);
      if (pronHandsFreeTokenRef.current !== manualToken || !isOpenRef.current) {
        return;
      }
      updateIsListening(false);
      evaluateSpokenChallengeWord(spoken);
    } catch {
      if (pronHandsFreeTokenRef.current === manualToken) {
        updateIsListening(false);
      }
    }
  };

  const handlePairAttempt = (enId: string, ptId: string) => {
    if (enId === ptId) {
      // Correct association!
      playChime('success', audioBeeps);
      const matchedItem = matchingPool.find(item => item.id === enId);
      if (matchedItem) {
        onSpeakWord(matchedItem.en);
      }
      const nextMatched = [...matchedIds, enId];
      setMatchedIds(nextMatched);
      setSelectedEnId(null);
      setSelectedPtId(null);
      setWrongPair(null);

      if (nextMatched.length >= matchingPool.length) {
        if (matchTimerRef.current) window.clearTimeout(matchTimerRef.current);
        matchTimerRef.current = window.setTimeout(() => {
          matchTimerRef.current = null;
          setStage('result');
        }, 550);
      }
    } else {
      // Wrong association!
      playChime('retry', audioBeeps);
      setMistakesCount(prev => prev + 1);
      setWrongPair({ enId, ptId });
      if (matchTimerRef.current) window.clearTimeout(matchTimerRef.current);
      matchTimerRef.current = window.setTimeout(() => {
        matchTimerRef.current = null;
        setSelectedEnId(null);
        setSelectedPtId(null);
        setWrongPair(null);
      }, 480);
    }
  };

  const handleSelectEnCard = (id: string) => {
    if (matchedIds.includes(id) || wrongPair) return;
    setSelectedEnId(id);
    if (selectedPtId) {
      handlePairAttempt(id, selectedPtId);
    }
  };

  const handleSelectPtCard = (id: string) => {
    if (matchedIds.includes(id) || wrongPair) return;
    setSelectedPtId(id);
    if (selectedEnId) {
      handlePairAttempt(selectedEnId, id);
    }
  };

  return (
    <div
      id="modalPostSentenceChallenge"
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="challengeModalTitle"
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl lg:max-w-2xl xl:max-w-[760px] w-full p-4 sm:p-5 max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                Desafio Pós-Sentença #{sentenceIndex + 1}
              </span>
              <span
                id="challengeMistakesBadge"
                className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                  mistakesCount > maxAllowedMistakes
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                Erros: {mistakesCount}
              </span>
              {autoHandsFree && (
                <span
                  id="challengeHandsFreeBadge"
                  className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold"
                >
                  🙌 Mãos Livres
                </span>
              )}
            </div>
            <h3 id="challengeModalTitle" className="text-sm sm:text-base font-bold text-white mt-1 leading-snug">
              {stage === 'pronunciation'
                ? '1. Desafio de Pronúncia das Palavras-Chave'
                : stage === 'matching'
                  ? '2. Desafio de Memória: Associe Inglês ↔ Português'
                  : 'Resultado do Desafio da Sentença'}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id="btnSkipChallenge"
              type="button"
              onClick={() => handleFinishChallenge('advance', mistakesCount)}
              className="px-2.5 py-1.5 min-h-[38px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition cursor-pointer shrink-0 flex items-center"
              title="Pular desafio e ir para a próxima sentença"
            >
              Pular →
            </button>
            <button
              id="btnCloseChallenge"
              type="button"
              onClick={() => handleFinishChallenge('cancel', mistakesCount)}
              aria-label="Fechar desafio e permanecer na frase atual"
              title="Fechar desafio sem avançar de frase (Esc)"
              className="min-w-[38px] min-h-[38px] p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer shrink-0 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Stage Selector Tabs (Challenge 1 & Challenge 2) */}
        <div className="flex items-center gap-2 mt-3 shrink-0">
          {enablePronunciationChallenge && (
            <button
              id="tabChallengePronunciation"
              type="button"
              onClick={() => {
                cancelChallengeAudioAndTimers();
                if (isListeningRef.current) {
                  onAbortListening?.();
                  updateIsListening(false);
                }
                isAdvancingWordRef.current = false;
                setStage('pronunciation');
              }}
              className={`flex-1 min-h-[40px] py-1.5 px-2.5 sm:px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                stage === 'pronunciation'
                  ? 'bg-brand-600/25 border-brand-400 text-white shadow-xs'
                  : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="sm:hidden">🎤 Pronúncia</span>
              <span className="hidden sm:inline">🎤 1. Desafio de Pronúncia</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900/80 text-brand-300">
                {pronIndex}/{challengeWords.length}
              </span>
            </button>
          )}
          {enableMatchingChallenge && (
            <button
              id="tabChallengeMatching"
              type="button"
              onClick={() => {
                cancelChallengeAudioAndTimers();
                if (isListeningRef.current) {
                  onAbortListening?.();
                  updateIsListening(false);
                }
                isAdvancingWordRef.current = false;
                setStage('matching');
              }}
              className={`flex-1 min-h-[40px] py-1.5 px-2.5 sm:px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                stage === 'matching'
                  ? 'bg-amber-500/25 border-amber-400 text-white shadow-xs'
                  : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="sm:hidden">🧩 Pares</span>
              <span className="hidden sm:inline">🧩 2. Associar Inglês ↔ Português</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900/80 text-amber-300">
                {matchedIds.length}/{matchingPool.length}
              </span>
            </button>
          )}
        </div>

        {/* Scrollable Stage Body */}
        <div className="no-scrollbar mt-2.5 sm:mt-3 flex-1 min-h-0 overflow-y-auto">

        {/* STAGE 1: WORD PRONUNCIATION CHALLENGE */}
        {stage === 'pronunciation' && activePronWord && (
          <div id="challengeStagePronunciation" className="space-y-3">
            {/* Word pills progress */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-400">
                Pronuncie cada palavra destacada da frase ({pronIndex + 1} de{' '}
                {challengeWords.length}):
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {challengeWords.map((cw, idx) => {
                  const done = idx < pronIndex;
                  const current = idx === pronIndex;
                  return (
                    <span
                      key={cw.id}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold border inline-flex items-center gap-1 ${
                        done
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : current
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                            : cw.mistakeCount && cw.mistakeCount > 0
                              ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {done ? '✓ ' : cw.mistakeCount && cw.mistakeCount > 0 ? '⚠ ' : ''}
                      {cw.en}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Active Target Word Card */}
            <div
              className={`p-3.5 sm:p-4 rounded-xl text-center space-y-2 transition-colors duration-150 ${
                isListening
                  ? 'bg-rose-950/25 border-2 border-rose-500 ring-2 ring-rose-500/40 shadow-lg shadow-rose-500/15'
                  : 'bg-slate-950/70 border border-slate-800'
              }`}
            >
              {activePronWord.mistakeCount && activePronWord.mistakeCount > 0 ? (
                <div className="flex justify-center">
                  <span
                    id="challengePriorityMistakeTag"
                    className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/40 text-rose-200 text-[10px] font-bold"
                  >
                    🎯 Prioridade — errou {activePronWord.mistakeCount}x na frase
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-center gap-2">
                <span
                  id="challengeTargetWord"
                  className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight"
                >
                  {activePronWord.en}
                </span>
                <button
                  id="btnChallengeListenWord"
                  type="button"
                  onClick={() => onSpeakWord(activePronWord.en)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Ouvir pronúncia desta palavra"
                >
                  🔊 Ouvir
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                <span className="font-mono text-slate-400">{activePronWord.ipa}</span>
                <span className="text-slate-600">·</span>
                <span className="font-semibold text-amber-300">
                  Tradução: "{activePronWord.pt}"
                </span>
              </div>

              {/* Phonetic tip for tricky / short words like "through" */}
              {(() => {
                const tip = getBrazilianPhoneticTip(activePronWord.en);
                if (!tip) return null;
                return (
                  <div className="mt-1 py-1 px-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-[11px] text-indigo-200">
                    💡 <strong>{tip.category}:</strong> {tip.tip}
                  </div>
                );
              })()}

              {/* Reserved status slot so activating the mic NEVER shifts height or triggers a scrollbar */}
              <div className="min-h-[48px] flex items-center justify-center">
                {isListening ? (
                  <div
                    id="challengeListeningHint"
                    className="w-full py-2 px-3 rounded-lg bg-rose-600/25 border border-rose-500/70 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 animate-pulse"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" />
                    <span>
                      🎙️ MICROFONE ABERTO — Fale "{activePronWord.en}"!
                    </span>
                  </div>
                ) : pronFeedback.status === 'success' ? (
                  <div
                    id="challengePronSuccess"
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold"
                  >
                    ✓ Excelente pronúncia de "{activePronWord.en}"!
                  </div>
                ) : pronFeedback.status === 'no_speech' ? (
                  <div
                    id="challengePronNoSpeech"
                    className="w-full py-2 px-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs space-y-1.5 text-left"
                  >
                    <div className="font-bold text-amber-300">
                      🎙️ Áudio não captado para "{activePronWord.en}" (sem penalidade)
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Para palavras curtas de 1 sílaba, fale 2x (<em>"{activePronWord.en}, {activePronWord.en}"</em>) ou confirme abaixo:
                    </p>
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      <button
                        id="btnChallengeConfirmSpokenShortWord"
                        type="button"
                        onClick={() => evaluateSpokenChallengeWord(activePronWord.en)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                      >
                        ✓ Já pronunciei "{activePronWord.en}"
                      </button>
                      <button
                        type="button"
                        onClick={handleRecordPronunciationWord}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                      >
                        🎤 Tentar Novamente
                      </button>
                    </div>
                  </div>
                ) : pronFeedback.status === 'error' ? (
                  <div
                    id="challengePronError"
                    className="w-full py-1.5 px-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold"
                  >
                    ✕ Ouvimos "{pronFeedback.spoken}". Tente pronunciar{' '}
                    <strong>"{activePronWord.en}"</strong> novamente!
                  </div>
                ) : (
                  <div className="w-full py-1.5 px-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-slate-400 text-[11px]">
                    Toque em <strong>Pronunciar "{activePronWord.en}"</strong> abaixo para ativar o microfone.
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btnChallengeToggleManual"
                  type="button"
                  onClick={() => {
                    setShowManualInput(prev => !prev);
                    setManualInputVal(activePronWord.en);
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 cursor-pointer flex-1 sm:flex-none"
                >
                  ⌨️ Simular / Digitar Fala
                </button>

                {wordFailures >= 1 && (
                  <button
                    id="btnChallengeNextWord"
                    type="button"
                    onClick={() => {
                      if (isListeningRef.current) {
                        onAbortListening?.();
                        updateIsListening(false);
                      }
                      advanceFromPronunciationWord(mistakesCountRef.current);
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-amber-500/30 cursor-pointer flex-1 sm:flex-none"
                  >
                    Próxima Palavra →
                  </button>
                )}
              </div>

              <button
                id="btnChallengeSpeakNow"
                type="button"
                onClick={handleRecordPronunciationWord}
                className={`min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs text-white shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-500 animate-pulse'
                    : 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/25'
                }`}
              >
                🎤{' '}
                {isListening
                  ? 'Ouvindo... (Clique p/ Concluir)'
                  : `Pronunciar "${activePronWord.en}"`}
              </button>
            </div>

            {/* Optional inline speech simulator for testing or silent study */}
            {showManualInput && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  evaluateSpokenChallengeWord(manualInputVal);
                }}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800"
              >
                <input
                  id="challengeManualInput"
                  type="text"
                  value={manualInputVal}
                  onChange={e => setManualInputVal(e.target.value)}
                  placeholder={`Digite "${activePronWord.en}" para validar...`}
                  className="flex-1 px-3 py-2 sm:py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-base sm:text-xs text-white focus:outline-none focus:border-brand-500"
                />
                <button
                  id="btnChallengeSubmitManual"
                  type="submit"
                  className="min-h-[44px] sm:min-h-0 px-3 py-2 sm:py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  Validar Pronúncia
                </button>
              </form>
            )}
          </div>
        )}

        {/* STAGE 2: WORD TRANSLATION MATCHING CHALLENGE */}
        {stage === 'matching' && (
          <div id="challengeStageMatching" className="space-y-2.5">
            {autoHandsFree && (
              <div
                id="handsFreeMatchingBanner"
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 min-h-[40px] transition-colors ${
                  isListening
                    ? 'bg-rose-950/60 border-rose-500/80 text-white ring-1 ring-rose-500/60'
                    : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                }`}
              >
                <span className="truncate min-w-0 flex-1 text-[11px] sm:text-xs">
                  {handsFreeMatchStatus ||
                    '🙌 Ouça o português e diga a palavra em inglês!'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 whitespace-nowrap ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-slate-900/80 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isListening ? '🎙️ MIC ABERTO' : '🙌 Mãos Livres'}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-1.5 text-[11px] sm:text-xs text-slate-300">
              <span className="truncate min-w-0">
                {autoHandsFree
                  ? 'Associação por voz ou toque nos cards:'
                  : 'Associe cada palavra em Inglês à tradução em Português:'}
              </span>
              <span className="font-mono font-bold text-emerald-400 shrink-0">
                {matchedIds.length} / {matchingPool.length} pares
              </span>
            </div>

            {/* Paired 2-column grid guarantees exact horizontal row alignment between English & Portuguese cards */}
            <div
              id="challengeMatchingGrid"
              className="grid grid-cols-2 gap-1.5 sm:gap-2.5 items-stretch"
            >
              {/* Row 0: Aligned Column Headers */}
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 px-1 flex items-center min-h-[20px] whitespace-nowrap">
                🇺🇸 Inglês
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 px-1 flex items-center justify-between gap-1 min-h-[20px] whitespace-nowrap">
                <span>🇧🇷 Português</span>
                {isResolvingTranslations && (
                  <span className="text-[9px] font-medium text-slate-400 normal-case animate-pulse">
                    Traduzindo...
                  </span>
                )}
              </div>

              {/* Rows 1..N: Paired EN & PT Cards sharing identical grid row heights */}
              {shuffledEnCards.map((enItem, rowIdx) => {
                const ptItem = shuffledPtCards[rowIdx];
                const isEnMatched = matchedIds.includes(enItem.id);
                const isEnSelected = selectedEnId === enItem.id;
                const isEnWrong = wrongPair?.enId === enItem.id;

                const isPtMatched = ptItem ? matchedIds.includes(ptItem.id) : false;
                const isPtSelected = ptItem ? selectedPtId === ptItem.id : false;
                const isPtWrong = ptItem ? wrongPair?.ptId === ptItem.id : false;
                const isPendingLiteral = Boolean(
                  ptItem &&
                    isResolvingTranslations &&
                    ptItem.pt.toLowerCase() === ptItem.en.toLowerCase()
                );

                return (
                  <React.Fragment key={`match-row-${rowIdx}-${enItem.id}`}>
                    <button
                      type="button"
                      data-match-en={enItem.en}
                      disabled={isEnMatched}
                      onClick={() => handleSelectEnCard(enItem.id)}
                      className={`w-full h-full min-h-[42px] sm:min-h-[46px] py-2 px-2.5 sm:px-3 rounded-xl border text-left font-bold text-xs sm:text-sm flex items-center justify-between gap-1.5 break-words transition cursor-pointer ${
                        isEnMatched
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 opacity-65 cursor-default'
                          : isEnWrong
                            ? 'bg-rose-500/25 border-rose-500 text-rose-200 ring-1 ring-rose-500'
                            : isEnSelected
                              ? 'bg-brand-500/25 border-brand-400 text-white ring-2 ring-brand-400'
                              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-white'
                      }`}
                    >
                      <span className="break-words min-w-0 leading-snug">{enItem.en}</span>
                      {isEnMatched && <span className="text-xs shrink-0">✓</span>}
                    </button>

                    {ptItem ? (
                      <button
                        type="button"
                        data-match-pt={ptItem.pt}
                        disabled={isPtMatched || isPendingLiteral}
                        onClick={() => handleSelectPtCard(ptItem.id)}
                        className={`w-full h-full min-h-[42px] sm:min-h-[46px] py-2 px-2.5 sm:px-3 rounded-xl border text-left font-bold text-xs sm:text-sm flex items-center justify-between gap-1.5 break-words transition cursor-pointer ${
                          isPtMatched
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 opacity-65 cursor-default'
                            : isPendingLiteral
                              ? 'bg-slate-800/50 border-slate-700/70 text-slate-400 animate-pulse cursor-wait'
                              : isPtWrong
                                ? 'bg-rose-500/25 border-rose-500 text-rose-200 ring-1 ring-rose-500'
                                : isPtSelected
                                  ? 'bg-amber-500/25 border-amber-400 text-white ring-2 ring-amber-400'
                                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
                        }`}
                      >
                        <span className="break-words min-w-0 leading-snug">
                          {isPendingLiteral ? 'Traduzindo...' : ptItem.pt}
                        </span>
                        {isPtMatched && <span className="text-xs shrink-0">✓</span>}
                      </button>
                    ) : (
                      <div />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* STAGE 3: FINAL RESULT & REPEAT-OR-ADVANCE DECISION */}
        {stage === 'result' && (
          <div id="challengeStageResult" className="space-y-4 text-center">
            {shouldRepeatSentence ? (
              <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 space-y-2">
                <div className="text-lg font-extrabold text-amber-300">
                  🔄 Vamos Reforçar Esta Sentença!
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Você teve <strong>{mistakesCount} erros</strong> durante os desafios desta frase.
                  Como a opção <em>"Repetir sentença caso erre muito o desafio"</em> está ativa,
                  vamos praticar a frase mais uma vez para consolidar a pronúncia e o vocabulário!
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 space-y-2">
                <div className="text-lg font-extrabold text-emerald-300">
                  🎉 Desafios Concluídos com Sucesso!
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Excelente domínio da pronúncia e da tradução das palavras desta sentença (
                  {mistakesCount === 0
                    ? 'nenhum erro!'
                    : `${mistakesCount} ${mistakesCount === 1 ? 'erro' : 'erros'}`}
                  ).
                </p>
              </div>
            )}

            {autoHandsFree && (
              <div
                id="handsFreeResultAutoAdvanceBanner"
                className="px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold animate-pulse"
              >
                🙌 Mãos Livres:{' '}
                {shouldRepeatSentence
                  ? 'Repetindo a sentença automaticamente...'
                  : 'Avançando automaticamente para a próxima sentença...'}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
              {shouldRepeatSentence ? (
                <>
                  <button
                    id="btnChallengeConfirmRepeat"
                    type="button"
                    onClick={() => handleFinishChallenge('repeat', mistakesCount)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg cursor-pointer"
                  >
                    🔄 Repetir Sentença Agora
                  </button>
                  <button
                    id="btnChallengeForceAdvance"
                    type="button"
                    onClick={() => handleFinishChallenge('advance', mistakesCount)}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Avançar Mesmo Assim →
                  </button>
                </>
              ) : (
                <button
                  id="btnChallengeContinueNext"
                  type="button"
                  onClick={() => handleFinishChallenge('advance', mistakesCount)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg cursor-pointer"
                >
                  Continuar para a Próxima Sentença →
                </button>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
