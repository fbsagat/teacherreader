import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateWordPronunciation,
  resolvePronounceButtonAction
} from './challengeFlow';

test('resolvePronounceButtonAction fast-forwards Hands-Free without stopping or duplicating when mic is not open yet', () => {
  const action = resolvePronounceButtonAction({
    isOpen: true,
    hasActiveWord: true,
    isListening: false,
    isAdvancingWord: false,
    pronStatus: 'idle',
    autoHandsFree: true,
    handsFreeChallengeMode: 'voice_all'
  });
  assert.equal(action, 'fast_forward_hands_free');
});

test('resolvePronounceButtonAction stops listening early when mic is already open', () => {
  const action = resolvePronounceButtonAction({
    isOpen: true,
    hasActiveWord: true,
    isListening: true,
    isAdvancingWord: false,
    pronStatus: 'idle',
    autoHandsFree: true,
    handsFreeChallengeMode: 'voice_all'
  });
  assert.equal(action, 'stop_listening_early');
});

test('resolvePronounceButtonAction uses manual_listen in manual mode or auto_review mode', () => {
  assert.equal(
    resolvePronounceButtonAction({
      isOpen: true,
      hasActiveWord: true,
      isListening: false,
      isAdvancingWord: false,
      pronStatus: 'error',
      autoHandsFree: false,
      handsFreeChallengeMode: 'voice_all'
    }),
    'manual_listen'
  );

  assert.equal(
    resolvePronounceButtonAction({
      isOpen: true,
      hasActiveWord: true,
      isListening: false,
      isAdvancingWord: false,
      pronStatus: 'idle',
      autoHandsFree: true,
      handsFreeChallengeMode: 'auto_review'
    }),
    'manual_listen'
  );
});

test('resolvePronounceButtonAction ignores clicks while advancing or after success', () => {
  assert.equal(
    resolvePronounceButtonAction({
      isOpen: true,
      hasActiveWord: true,
      isListening: false,
      isAdvancingWord: true,
      pronStatus: 'idle',
      autoHandsFree: true,
      handsFreeChallengeMode: 'voice_all'
    }),
    'ignore'
  );

  assert.equal(
    resolvePronounceButtonAction({
      isOpen: true,
      hasActiveWord: true,
      isListening: false,
      isAdvancingWord: false,
      pronStatus: 'success',
      autoHandsFree: true,
      handsFreeChallengeMode: 'voice_all'
    }),
    'ignore'
  );
});

test('evaluateWordPronunciation validates exact, phonetic, and empty speech inputs cleanly', () => {
  const emptyRes = evaluateWordPronunciation('secret', '   ');
  assert.equal(emptyRes.passed, false);
  assert.equal(emptyRes.score, 0);

  const exactRes = evaluateWordPronunciation('secret', 'Secret!');
  assert.equal(exactRes.passed, true);
  assert.ok(exactRes.score >= 92);

  const wrongRes = evaluateWordPronunciation('secret', 'banana');
  assert.equal(wrongRes.passed, false);

  const digitRes = evaluateWordPronunciation('nine', '9');
  assert.equal(digitRes.passed, true);
  assert.equal(digitRes.trimmedRaw, 'nine');

  const ordinalRes = evaluateWordPronunciation('first', '1st');
  assert.equal(ordinalRes.passed, true);
  assert.equal(ordinalRes.trimmedRaw, 'first');
});

test('evaluateWordPronunciation never approves minimal pairs or substrings', () => {
  for (const [target, spoken] of [
    ['right', 'nine'],
    ['do', 'so'],
    ['in', 'point'],
    ['art', 'part'],
    ['he', 'the'],
    ['know', 'show'],
    ['thought', 'taught']
  ]) {
    const result = evaluateWordPronunciation(target, spoken);
    assert.equal(result.passed, false, `${target} must not pass as ${spoken}`);
    assert.ok(result.score < 92, `${target}/${spoken} must not score >= 92`);
  }

  // Real homophones must still be accepted.
  const homophone = evaluateWordPronunciation('through', 'threw');
  assert.equal(homophone.passed, true);
});
