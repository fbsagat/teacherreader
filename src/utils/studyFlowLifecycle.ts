export type StudyExecutionMode = 'free' | 'training_loop';

export type ManualActionKind =
  | 'play_pt'
  | 'play_en'
  | 'play_en_slow'
  | 'play_step'
  | 'play_word_by_word'
  | 'skip_word_by_word'
  | 'speak_manual'
  | 'step_chip'
  | 'open_challenge'
  | 'toggle_step_mode'
  | 'toggle_connected_speech'
  | 'select_substep'
  | 'navigate_sentence';

export interface AsyncStepGuardInput {
  token: number;
  activeToken: number;
  sentenceIdx: number;
  currentSentenceIdx: number;
  requireLoop: boolean;
  isPlayingLoop: boolean;
}

/**
 * Checks whether an in-flight async reading/speaking step is still valid to continue.
 */
export function shouldContinueAsyncStep(input: AsyncStepGuardInput): boolean {
  if (input.token !== input.activeToken) return false;
  if (input.sentenceIdx !== input.currentSentenceIdx) return false;
  if (input.requireLoop && !input.isPlayingLoop) return false;
  return true;
}

export interface LoopInterruptionInput {
  isPlayingLoop: boolean;
  isReadingWords: boolean;
  isManualWordReview: boolean;
  actionKind: ManualActionKind;
}

export type LoopInterruptionPlan =
  | 'none'
  | 'pause_loop_for_manual'
  | 'skip_loop_word_review'
  | 'restart_loop_if_active';

/**
 * Determines how clicking any card/toolbar button interacts with an active training loop:
 * - Standalone card audio/mic/chip/challenge actions pause the loop cleanly so Free Mode and Loop never collide.
 * - Clicking "Pular" or "Parar" on Card 03 while the loop itself is running word-by-word review skips only that review step so the loop proceeds cleanly.
 * - Structural toggles (Em Partes, Fluxo Conectado, sub-step tabs, sentence navigation) preserve loop continuity if active.
 */
export function resolveLoopInterruptionPlan(
  input: LoopInterruptionInput
): LoopInterruptionPlan {
  if (!input.isPlayingLoop) return 'none';

  if (
    input.actionKind === 'skip_word_by_word' &&
    input.isReadingWords &&
    !input.isManualWordReview
  ) {
    return 'skip_loop_word_review';
  }

  if (
    input.actionKind === 'toggle_step_mode' ||
    input.actionKind === 'toggle_connected_speech' ||
    input.actionKind === 'select_substep' ||
    input.actionKind === 'navigate_sentence' ||
    input.actionKind === 'skip_word_by_word'
  ) {
    return 'restart_loop_if_active';
  }

  return 'pause_loop_for_manual';
}

export type ChallengeOutcome = 'advance' | 'repeat' | 'cancel';

export interface ChallengeResolution {
  action: 'advance_sentence' | 'repeat_sentence' | 'stay_paused' | 'stay_free';
}

/**
 * Resolves what should happen after PostSentenceChallengeModal closes, distinguishing
 * explicit completion/skip ('advance'), mistake threshold retry ('repeat'), and dismissal/Escape ('cancel').
 */
export function resolveChallengeResolution(
  outcome: ChallengeOutcome,
  wasStartedInLoop: boolean
): ChallengeResolution {
  if (outcome === 'repeat') {
    return { action: 'repeat_sentence' };
  }
  if (outcome === 'cancel') {
    return { action: wasStartedInLoop ? 'stay_paused' : 'stay_free' };
  }
  return { action: 'advance_sentence' };
}

export function getStudyExecutionMode(isPlayingLoop: boolean): StudyExecutionMode {
  return isPlayingLoop ? 'training_loop' : 'free';
}

/** Explicit next action the Free Mode UI must offer after a step is finished. */
export type FreeModeCta = 'none' | 'next_part' | 'next_sentence' | 'finish_book';

export interface FreeModeCompletionInput {
  /** True while the guided Training Loop runs — it owns its own sequencing. */
  isPlayingLoop: boolean;
  /** Step-by-step ('Em Partes') mode with more than one step for the sentence. */
  isStepByStepMode: boolean;
  /** The current study step is a sub-part (not the final full sentence). */
  isIntermediateSubClause: boolean;
  /** The current sub-part already passed its final speaking stage. */
  subPartCompleted: boolean;
  /** `sentenceProgress[currentIndex].completed` — final full-sentence pass approved. */
  sentenceCompleted: boolean;
  hasNextSentence: boolean;
}

export interface FreeModeCompletionDecision {
  /**
   * Only the Training Loop may chain steps by itself. Outside it (Modo Livre) the
   * user must always ask for the next part/sentence, so nothing moves on its own.
   */
  autoAdvance: boolean;
  /** Explicit call to action the UI has to render next to the state badge. */
  cta: FreeModeCta;
}

/**
 * Decides what happens right after a step finishes.
 *
 * Training Loop → `autoAdvance` (unchanged behaviour, handled by `runShadowingStep`).
 * Free Mode → never advance automatically: finish the sub-part with a "Próxima
 * parte" CTA, or the sentence with "Próxima sentença"/"Concluir livro".
 */
export function resolveFreeModeCompletion(
  input: FreeModeCompletionInput
): FreeModeCompletionDecision {
  if (input.isPlayingLoop) {
    return { autoAdvance: true, cta: 'none' };
  }

  if (
    input.isStepByStepMode &&
    input.isIntermediateSubClause &&
    input.subPartCompleted
  ) {
    return { autoAdvance: false, cta: 'next_part' };
  }

  if (input.sentenceCompleted) {
    return {
      autoAdvance: false,
      cta: input.hasNextSentence ? 'next_sentence' : 'finish_book'
    };
  }

  return { autoAdvance: false, cta: 'none' };
}

export interface StepChipClickDecision {
  /** 'jump_in_active_loop' keeps training running from clickedSeqIdx; 'execute_single_step' runs only that step outside training */
  mode: 'jump_in_active_loop' | 'execute_single_step';
  /** Updated resume sequence index for "Continuar Treino" when paused mid-training, or null in fresh Free Mode / active loop */
  nextPausedResumeSeqIdx: number | null;
}

/**
 * Determines what happens when the user clicks an individual stage pill (#btnStepOrderChip_N):
 * - During an active training loop: keeps training active and continues from clickedSeqIdx.
 * - Outside an active training loop: runs only that single stage; if training was paused, updates the resume index.
 */
export function resolveStepChipClickBehavior(input: {
  isPlayingLoop: boolean;
  pausedResumeSeqIdx: number | null;
  clickedSeqIdx: number;
}): StepChipClickDecision {
  const rawSeqIdx = Number(input.clickedSeqIdx);
  const safeSeqIdx = Number.isFinite(rawSeqIdx) ? Math.max(0, Math.floor(rawSeqIdx)) : 0;
  if (input.isPlayingLoop) {
    return {
      mode: 'jump_in_active_loop',
      nextPausedResumeSeqIdx: null
    };
  }
  return {
    mode: 'execute_single_step',
    nextPausedResumeSeqIdx: input.pausedResumeSeqIdx !== null ? safeSeqIdx : null
  };
}

export type LoopButtonMode = 'start' | 'pause' | 'resume';

/**
 * Determines the footer loop toggle button label and action:
 * - 'pause' ("Pausar Treino") while the training loop is running
 * - 'resume' ("Continuar Treino") when paused mid-training (either where stopped or at a selected stage pill)
 * - 'start' ("Iniciar Treino") in fresh Free Mode
 */
export function resolveLoopButtonMode(input: {
  isPlayingLoop: boolean;
  pausedResumeSeqIdx: number | null;
}): LoopButtonMode {
  if (input.isPlayingLoop) return 'pause';
  if (input.pausedResumeSeqIdx !== null && input.pausedResumeSeqIdx >= 0) return 'resume';
  return 'start';
}

