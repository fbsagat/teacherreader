import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getStudyExecutionMode,
  resolveChallengeResolution,
  resolveFreeModeCompletion,
  resolveLoopButtonMode,
  resolveLoopInterruptionPlan,
  resolveStepChipClickBehavior,
  shouldContinueAsyncStep
} from './studyFlowLifecycle';

test('shouldContinueAsyncStep rejects stale tokens, sentence mismatches, and stopped loops', () => {
  assert.equal(
    shouldContinueAsyncStep({
      token: 3,
      activeToken: 3,
      sentenceIdx: 1,
      currentSentenceIdx: 1,
      requireLoop: true,
      isPlayingLoop: true
    }),
    true
  );

  // Token invalidated by stopAllAudio or manual button
  assert.equal(
    shouldContinueAsyncStep({
      token: 3,
      activeToken: 4,
      sentenceIdx: 1,
      currentSentenceIdx: 1,
      requireLoop: false,
      isPlayingLoop: false
    }),
    false
  );

  // Sentence jumped while async step awaited
  assert.equal(
    shouldContinueAsyncStep({
      token: 3,
      activeToken: 3,
      sentenceIdx: 1,
      currentSentenceIdx: 2,
      requireLoop: false,
      isPlayingLoop: false
    }),
    false
  );

  // Loop required, but user paused or switched to free mode
  assert.equal(
    shouldContinueAsyncStep({
      token: 3,
      activeToken: 3,
      sentenceIdx: 1,
      currentSentenceIdx: 1,
      requireLoop: true,
      isPlayingLoop: false
    }),
    false
  );

  // Sentence advance regression: after updating currentSentenceIdx to nextIdx (idx + 1),
  // validation must pass for nextIdx and reject stale idx
  assert.equal(
    shouldContinueAsyncStep({
      token: 3,
      activeToken: 3,
      sentenceIdx: 2,
      currentSentenceIdx: 2,
      requireLoop: true,
      isPlayingLoop: true
    }),
    true
  );
  assert.equal(
    shouldContinueAsyncStep({
      token: 3,
      activeToken: 3,
      sentenceIdx: 1,
      currentSentenceIdx: 2,
      requireLoop: true,
      isPlayingLoop: true
    }),
    false
  );
});

test('resolveLoopInterruptionPlan distinguishes manual overrides, in-loop skip, and structural restarts', () => {
  assert.equal(getStudyExecutionMode(false), 'free');
  assert.equal(getStudyExecutionMode(true), 'training_loop');

  // Outside loop: always 'none'
  assert.equal(
    resolveLoopInterruptionPlan({
      isPlayingLoop: false,
      isReadingWords: false,
      isManualWordReview: false,
      actionKind: 'play_en'
    }),
    'none'
  );

  // Manual audio/mic/chips while loop is active pause the loop cleanly
  for (const actionKind of [
    'play_pt',
    'play_en',
    'play_en_slow',
    'play_step',
    'play_word_by_word',
    'speak_manual',
    'step_chip',
    'open_challenge'
  ] as const) {
    assert.equal(
      resolveLoopInterruptionPlan({
        isPlayingLoop: true,
        isReadingWords: false,
        isManualWordReview: false,
        actionKind
      }),
      'pause_loop_for_manual'
    );
  }

  // Skipping word-by-word review inside the loop advances to next step without killing the loop
  assert.equal(
    resolveLoopInterruptionPlan({
      isPlayingLoop: true,
      isReadingWords: true,
      isManualWordReview: false,
      actionKind: 'skip_word_by_word'
    }),
    'skip_loop_word_review'
  );

  // Structural controls restart the active loop cleanly on the new target/view
  for (const actionKind of [
    'toggle_step_mode',
    'toggle_connected_speech',
    'select_substep',
    'navigate_sentence'
  ] as const) {
    assert.equal(
      resolveLoopInterruptionPlan({
        isPlayingLoop: true,
        isReadingWords: false,
        isManualWordReview: false,
        actionKind
      }),
      'restart_loop_if_active'
    );
  }
});

test('resolveChallengeResolution separates cancel/Escape from advance and repeat', () => {
  assert.deepEqual(resolveChallengeResolution('advance', false), { action: 'advance_sentence' });
  assert.deepEqual(resolveChallengeResolution('advance', true), { action: 'advance_sentence' });
  assert.deepEqual(resolveChallengeResolution('repeat', false), { action: 'repeat_sentence' });
  assert.deepEqual(resolveChallengeResolution('cancel', false), { action: 'stay_free' });
  assert.deepEqual(resolveChallengeResolution('cancel', true), { action: 'stay_paused' });
});

test('resolveStepChipClickBehavior continues training loop when clicked during active training, and runs single step outside training', () => {
  // During active training: clicking a step pill keeps training running from that clicked step
  assert.deepEqual(
    resolveStepChipClickBehavior({
      isPlayingLoop: true,
      pausedResumeSeqIdx: null,
      clickedSeqIdx: 1
    }),
    { mode: 'jump_in_active_loop', nextPausedResumeSeqIdx: null }
  );

  // Outside training (fresh Free Mode): executes only that single step without enabling resume mode
  assert.deepEqual(
    resolveStepChipClickBehavior({
      isPlayingLoop: false,
      pausedResumeSeqIdx: null,
      clickedSeqIdx: 1
    }),
    { mode: 'execute_single_step', nextPausedResumeSeqIdx: null }
  );

  // Outside training (paused mid-training): executes single step and updates resume point for "Continuar Treino"
  assert.deepEqual(
    resolveStepChipClickBehavior({
      isPlayingLoop: false,
      pausedResumeSeqIdx: 3,
      clickedSeqIdx: 1
    }),
    { mode: 'execute_single_step', nextPausedResumeSeqIdx: 1 }
  );
});

test('resolveStepChipClickBehavior guards NaN clicked indexes instead of storing NaN in resume state', () => {
  assert.deepEqual(
    resolveStepChipClickBehavior({
      isPlayingLoop: false,
      pausedResumeSeqIdx: 2,
      clickedSeqIdx: Number.NaN
    }),
    { mode: 'execute_single_step', nextPausedResumeSeqIdx: 0 }
  );
  assert.deepEqual(
    resolveStepChipClickBehavior({
      isPlayingLoop: false,
      pausedResumeSeqIdx: 2,
      clickedSeqIdx: -4
    }),
    { mode: 'execute_single_step', nextPausedResumeSeqIdx: 0 }
  );
});

test('resolveLoopButtonMode transitions between Iniciar Treino, Pausar Treino, and Continuar Treino', () => {
  assert.equal(resolveLoopButtonMode({ isPlayingLoop: false, pausedResumeSeqIdx: null }), 'start');
  assert.equal(resolveLoopButtonMode({ isPlayingLoop: true, pausedResumeSeqIdx: null }), 'pause');
  assert.equal(resolveLoopButtonMode({ isPlayingLoop: false, pausedResumeSeqIdx: 2 }), 'resume');
  assert.equal(resolveLoopButtonMode({ isPlayingLoop: false, pausedResumeSeqIdx: 0 }), 'resume');
});

test('resolveFreeModeCompletion never auto-advances outside the training loop', () => {
  const freeBase = {
    isPlayingLoop: false,
    isStepByStepMode: true,
    isIntermediateSubClause: true,
    subPartCompleted: false,
    sentenceCompleted: false,
    hasNextSentence: true
  };

  // Nothing finished yet: stay exactly where the user is, no CTA.
  assert.deepEqual(resolveFreeModeCompletion(freeBase), {
    autoAdvance: false,
    cta: 'none'
  });

  // Finished a sub-part: the app must ask before moving to the next part.
  assert.deepEqual(resolveFreeModeCompletion({ ...freeBase, subPartCompleted: true }), {
    autoAdvance: false,
    cta: 'next_part'
  });

  // Finished the full sentence of a book that still has more sentences.
  assert.deepEqual(
    resolveFreeModeCompletion({
      ...freeBase,
      isIntermediateSubClause: false,
      sentenceCompleted: true
    }),
    { autoAdvance: false, cta: 'next_sentence' }
  );

  // Last sentence of the book.
  assert.deepEqual(
    resolveFreeModeCompletion({
      ...freeBase,
      isIntermediateSubClause: false,
      sentenceCompleted: true,
      hasNextSentence: false
    }),
    { autoAdvance: false, cta: 'finish_book' }
  );

  // Sentence mode (not 'Em Partes'): a sub-part flag alone never produces a CTA.
  assert.deepEqual(
    resolveFreeModeCompletion({ ...freeBase, isStepByStepMode: false, subPartCompleted: true }),
    { autoAdvance: false, cta: 'none' }
  );
});

test('resolveFreeModeCompletion leaves the training loop untouched', () => {
  assert.deepEqual(
    resolveFreeModeCompletion({
      isPlayingLoop: true,
      isStepByStepMode: true,
      isIntermediateSubClause: true,
      subPartCompleted: true,
      sentenceCompleted: true,
      hasNextSentence: true
    }),
    { autoAdvance: true, cta: 'none' }
  );
});

