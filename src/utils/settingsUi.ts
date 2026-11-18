/**
 * Pure presentation/metadata helpers for the Settings modal.
 *
 * The modal itself stays dumb: it renders labels, ranges and tab metadata that
 * come from here, so the copy and the numeric bounds have a single source that
 * can be unit-tested without a DOM.
 */

export type SettingsTabId = 'presets' | 'steps' | 'voice_ai' | 'rules' | 'appearance';

export interface SettingsTabMeta {
  id: SettingsTabId;
  /** Short label rendered inside the tab button. */
  label: string;
  icon: string;
  /** Full title of the panel, used as the panel heading. */
  title: string;
  /** One-line explanation of what the tab is for. */
  description: string;
  /** `id` of the tab button (kept stable for a11y/tests). */
  domId: string;
  /** `id` of the panel controlled by the tab. */
  panelId: string;
}

/**
 * Ordered list of settings sections. One subject per tab: a user should be able
 * to guess where a setting lives from the tab label alone.
 */
export const SETTINGS_TABS: SettingsTabMeta[] = [
  {
    id: 'presets',
    label: 'Fluxo',
    icon: '★',
    title: 'Fluxo de estudo',
    description: 'Modelos prontos que definem as etapas de cada frase.',
    domId: 'tabSettingsPresets',
    panelId: 'tabPanelPresets'
  },
  {
    id: 'steps',
    label: 'Etapas',
    icon: '🎛️',
    title: 'Etapas e cards da tela',
    description: 'Monte a ordem das etapas da frase e o layout dos cards.',
    domId: 'tabSettingsSteps',
    panelId: 'tabPanelSteps'
  },
  {
    id: 'voice_ai',
    label: 'Voz & IA',
    icon: '🎙️',
    title: 'Voz & IA',
    description: 'Escolha como o app lê para você e como ouve a sua fala.',
    domId: 'tabSettingsVoiceAi',
    panelId: 'tabPanelVoiceAi'
  },
  {
    id: 'rules',
    label: 'Regras',
    icon: '🎯',
    title: 'Regras do treino',
    description: 'Velocidades, tolerância, ajuda ao errar e modo mãos livres.',
    domId: 'tabSettingsRules',
    panelId: 'tabPanelRules'
  },
  {
    id: 'appearance',
    label: 'Aparência',
    icon: '🎨',
    title: 'Aparência',
    description: 'Tema de leitura e tamanho do texto em todo o app.',
    domId: 'tabSettingsAppearance',
    panelId: 'tabPanelAppearance'
  }
];

export const SETTINGS_TAB_IDS: SettingsTabId[] = SETTINGS_TABS.map(tab => tab.id);

export const DEFAULT_SETTINGS_TAB: SettingsTabId = 'presets';

export function isSettingsTabId(value: unknown): value is SettingsTabId {
  return typeof value === 'string' && (SETTINGS_TAB_IDS as string[]).includes(value);
}

/**
 * Coerces an arbitrary value (deep link, stale persisted tab, `undefined`) into
 * a valid tab id, falling back to the first tab instead of rendering nothing.
 */
export function resolveSettingsTabId(
  value: unknown,
  fallback: SettingsTabId = DEFAULT_SETTINGS_TAB
): SettingsTabId {
  if (isSettingsTabId(value)) return value;
  return fallback;
}

export function getSettingsTab(id: unknown): SettingsTabMeta {
  const tabId = resolveSettingsTabId(id);
  return SETTINGS_TABS.find(tab => tab.id === tabId) ?? SETTINGS_TABS[0];
}

/**
 * Next/previous tab for keyboard navigation (←/→/Home/End in the tablist).
 * Clamps at both ends instead of wrapping, matching native tab behavior.
 */
export function getAdjacentSettingsTabId(
  current: SettingsTabId,
  delta: number
): SettingsTabId {
  const currentIdx = SETTINGS_TAB_IDS.indexOf(current);
  const safeIdx = currentIdx < 0 ? 0 : currentIdx;
  const baseDelta = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  const nextIdx = Math.min(SETTINGS_TAB_IDS.length - 1, Math.max(0, safeIdx + baseDelta));
  return SETTINGS_TAB_IDS[nextIdx];
}

/* ------------------------------------------------------------------ *
 * Text size
 * ------------------------------------------------------------------ */

export const FONT_SCALE_MIN = 85;
export const FONT_SCALE_MAX = 135;
export const FONT_SCALE_STEP = 5;
export const FONT_SCALE_DEFAULT = 110;

/** Rounds to the nearest valid step and clamps to the slider range. */
export function clampFontScale(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return FONT_SCALE_DEFAULT;
  const snapped = Math.round(numeric / FONT_SCALE_STEP) * FONT_SCALE_STEP;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, snapped));
}

export function describeFontScale(scale: number): string {
  const safe = clampFontScale(scale);
  if (safe <= 95) return 'Compacto';
  if (safe < FONT_SCALE_DEFAULT) return 'Discreto';
  if (safe === FONT_SCALE_DEFAULT) return 'Confortável · Padrão';
  if (safe <= 125) return 'Grande';
  return 'Extra grande';
}

export interface FontScalePreset {
  value: number;
  label: string;
  shortLabel: string;
}

export const FONT_SCALE_PRESETS: FontScalePreset[] = [
  { value: 95, label: '95% Compacto', shortLabel: 'A-' },
  { value: 100, label: '100% Original', shortLabel: '100%' },
  { value: 110, label: '110% Padrão', shortLabel: '110%' },
  { value: 120, label: '120% Grande', shortLabel: '120%' },
  { value: 130, label: '130% Extra', shortLabel: '130%' }
];

/* ------------------------------------------------------------------ *
 * Speech speeds & accuracy threshold
 * ------------------------------------------------------------------ */

export const SPEED_EN_MIN = 0.65;
export const SPEED_EN_MAX = 1.2;
export const SPEED_PT_MIN = 0.8;
export const SPEED_PT_MAX = 1.4;

export const THRESHOLD_MIN = 50;
export const THRESHOLD_MAX = 95;
export const THRESHOLD_STEP = 5;

export function formatSpeedValue(speed: number): string {
  const safe = Number.isFinite(speed) ? speed : 1;
  // 0.7 -> "0.7x", 1 -> "1x", 1.35 -> "1.35x"
  return `${Number(safe.toFixed(2))}x`;
}

export function describeSpeedEn(speedEn: number): string {
  const safe = Number.isFinite(speedEn) ? speedEn : SPEED_EN_MIN;
  if (safe <= 0.75) return 'Pausada';
  if (safe <= 0.95) return 'Cadenciada';
  return 'Natural rápida';
}

export function describeSpeedPt(speedPt: number): string {
  const safe = Number.isFinite(speedPt) ? speedPt : 1;
  if (safe <= 1) return 'Moderada';
  if (safe <= 1.25) return 'Natural fluida';
  return 'Rápida';
}

export function describeThreshold(threshold: number): string {
  const safe = Number.isFinite(threshold) ? threshold : THRESHOLD_MIN;
  if (safe <= 60) return 'Fácil';
  if (safe >= 85) return 'Rigoroso';
  return 'Equilibrado';
}

/** Explains what the threshold means in plain pt-BR (used as `title`). */
export function describeThresholdEffect(threshold: number): string {
  const safe = Number.isFinite(threshold) ? threshold : THRESHOLD_MIN;
  if (safe <= 60) {
    return 'Aprova a fala mesmo com trocas de palavras; bom para os primeiros dias.';
  }
  if (safe >= 85) {
    return 'Exige quase todas as palavras corretas; bom para polir a pronúncia.';
  }
  return 'Equilíbrio entre fluidez e precisão: aceita pequenos desvios.';
}

/* ------------------------------------------------------------------ *
 * Blind speaking ("Falar Sem Inglês")
 * ------------------------------------------------------------------ */

export interface BlindRevealOption {
  value: number;
  shortLabel: string;
  label: string;
}

export const BLIND_REVEAL_OPTIONS: BlindRevealOption[] = [
  { value: 1, shortLabel: '1x', label: '1 erro' },
  { value: 2, shortLabel: '2x', label: '2 erros' },
  { value: 3, shortLabel: '3x', label: '3 erros' },
  { value: 4, shortLabel: '4x', label: '4 erros' },
  { value: 5, shortLabel: '5x', label: '5 erros' },
  { value: 0, shortLabel: 'Nunca', label: 'Nunca' }
];

export function describeBlindMaxErrors(value: unknown): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 'O texto em inglês nunca é revelado automaticamente.';
  }
  const safe = Math.trunc(numeric);
  return `O texto em inglês é revelado após ${safe} erro${safe > 1 ? 's' : ''}.`;
}

export type BlindSentenceScope = 'parts_only' | 'full_sentence';

export function resolveBlindSentenceScope(value: unknown): BlindSentenceScope {
  return value === false || value === 'parts_only' ? 'parts_only' : 'full_sentence';
}

export function describeBlindSentenceScope(value: unknown): string {
  return resolveBlindSentenceScope(value) === 'parts_only'
    ? 'A etapa aparece apenas no modo "Em Partes", não no "Desafio Final: Frase Inteira".'
    : 'A etapa aparece no modo "Em Partes" e também no "Desafio Final: Frase Inteira".';
}

/* ------------------------------------------------------------------ *
 * Hands-free
 * ------------------------------------------------------------------ */

export const HANDS_FREE_ATTEMPT_OPTIONS = [1, 2, 3, 4] as const;

export function describeHandsFreeAttempts(attempts: number): string {
  const safe = Number.isFinite(attempts) ? Math.max(1, Math.trunc(attempts)) : 2;
  return `Avança sozinho após ${safe} tentativa${safe > 1 ? 's' : ''} sem acerto.`;
}
