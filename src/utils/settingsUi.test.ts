import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampFontScale,
  describeFontScale,
  describeSpeedEn,
  describeSpeedPt,
  describeThreshold,
  getAdjacentSettingsTabId,
  getSettingsTab,
  isSettingsTabId,
  resolveSettingsTabId,
  describeBlindMaxErrors,
  describeBlindSentenceScope,
  SETTINGS_TABS
} from './settingsUi';

test('settings tabs are unique and resolve unknown ids to a valid tab', () => {
  const ids = SETTINGS_TABS.map(tab => tab.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 5);

  assert.equal(resolveSettingsTabId('voice_ai'), 'voice_ai');
  assert.equal(resolveSettingsTabId('text_theme'), 'presets');
  assert.equal(resolveSettingsTabId(undefined), 'presets');
  assert.equal(resolveSettingsTabId('nope', 'rules'), 'rules');
  assert.equal(isSettingsTabId('appearance'), true);
  assert.equal(isSettingsTabId('presets '), false);
});

test('getSettingsTab always returns metadata for the resolved tab', () => {
  assert.equal(getSettingsTab('steps').label, 'Etapas');
  assert.equal(getSettingsTab('missing-tab').id, 'presets');
});

test('getAdjacentSettingsTabId clamps instead of wrapping around', () => {
  assert.equal(getAdjacentSettingsTabId('presets', 1), 'steps');
  assert.equal(getAdjacentSettingsTabId('presets', -1), 'presets');
  assert.equal(getAdjacentSettingsTabId('appearance', 1), 'appearance');
  assert.equal(getAdjacentSettingsTabId('rules', 5), 'appearance');
  assert.equal(getAdjacentSettingsTabId('voice_ai', Number.NaN), 'voice_ai');
});

test('clampFontScale snaps to 5% steps inside 85–135', () => {
  assert.equal(clampFontScale(110), 110);
  assert.equal(clampFontScale(112), 110);
  assert.equal(clampFontScale(114), 115);
  assert.equal(clampFontScale(10), 85);
  assert.equal(clampFontScale(500), 135);
  assert.equal(clampFontScale(Number.NaN), 110);
  assert.equal(clampFontScale('120'), 120);
});

test('describeFontScale matches the preset labels', () => {
  assert.equal(describeFontScale(95), 'Compacto');
  assert.equal(describeFontScale(110), 'Confortável · Padrão');
  assert.equal(describeFontScale(130), 'Extra grande');
});

test('speed and threshold labels stay inside their expected bands', () => {
  assert.equal(describeSpeedEn(0.65), 'Pausada');
  assert.equal(describeSpeedEn(0.9), 'Cadenciada');
  assert.equal(describeSpeedEn(1.2), 'Natural rápida');
  assert.equal(describeSpeedEn(Number.NaN), 'Pausada');

  assert.equal(describeSpeedPt(0.9), 'Moderada');
  assert.equal(describeSpeedPt(1.2), 'Natural fluida');
  assert.equal(describeSpeedPt(1.4), 'Rápida');

  assert.equal(describeThreshold(50), 'Fácil');
  assert.equal(describeThreshold(75), 'Equilibrado');
  assert.equal(describeThreshold(95), 'Rigoroso');
});

test('blind speaking copy explains reveal rules and sentence scope', () => {
  assert.match(describeBlindMaxErrors(0), /nunca/i);
  assert.match(describeBlindMaxErrors(1), /após 1 erro\./);
  assert.match(describeBlindMaxErrors(3), /após 3 erros\./);
  assert.match(describeBlindMaxErrors(Number.NaN), /nunca/i);

  assert.match(describeBlindSentenceScope(false), /apenas no modo "Em Partes"/);
  assert.match(describeBlindSentenceScope(true), /também no "Desafio Final/);
});
