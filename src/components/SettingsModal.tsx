import React, { useEffect, useState } from 'react';
import {
  AudioFlow,
  PedagogicalSettings,
  StudyStepCardType,
  TtsEngine,
  VisualCardType
} from '../types/shadowreader';
import { DEFAULT_SETTINGS } from '../utils/settingsNormalizer';
import {
  STEP_CARD_META,
  VISUAL_CARD_META,
  buildEffectiveCardSequence,
  formatCardSequenceSummary,
  getPresetById,
  isChallengeStepCard
} from '../utils/cardSequencePresets';
import {
  appendOrderItem,
  buildLegacyFlagsForSequence,
  duplicateOrderItem,
  moveOrderItem,
  removeOrderItem
} from '../utils/cardSequenceEdits';
import {
  DEFAULT_SETTINGS_TAB,
  SETTINGS_TABS,
  SettingsTabId,
  getSettingsTab,
  resolveSettingsTabId
} from '../utils/settingsUi';
import {
  SystemVoiceOption,
  VoiceHubProviderStatus,
  clearTtsAudioCache,
  fetchVoiceHubServerStatus,
  getAvailableSystemVoices,
  getCachedTtsAudioCount,
  speakTextUniversal,
  stopAllAudioPlayback
} from '../services/audioAndTranslationService';
import { getVoiceCompatibilitySummary } from '../utils/voiceCompatibility';
import { SettingsTabsNav } from './settings/SettingsTabsNav';
import { SettingsPresetsPanel } from './settings/SettingsPresetsPanel';
import { SettingsStepsPanel } from './settings/SettingsStepsPanel';
import { SettingsVoicePanel } from './settings/SettingsVoicePanel';
import { SettingsRulesPanel } from './settings/SettingsRulesPanel';
import { SettingsAppearancePanel } from './settings/SettingsAppearancePanel';

export type { SettingsTabId } from '../utils/settingsUi';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: SettingsTabId;
  settings: PedagogicalSettings;
  onUpdateSettings: (partial: Partial<PedagogicalSettings>) => void;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

/**
 * Settings shell: header (state summary), tab bar, one panel per subject and a
 * fixed footer. Every panel is a separate component under `components/settings`
 * so each subject can be reviewed/changed on its own; all the "move / repeat /
 * remove" rules live in `utils/cardSequenceEdits` and the labels in
 * `utils/settingsUi`.
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  initialTab = DEFAULT_SETTINGS_TAB,
  settings,
  onUpdateSettings,
  onClose,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(() =>
    resolveSettingsTabId(initialTab)
  );
  const [enVoices, setEnVoices] = useState<SystemVoiceOption[]>([]);
  const [ptVoices, setPtVoices] = useState<SystemVoiceOption[]>([]);
  const [providerStatus, setProviderStatus] = useState<VoiceHubProviderStatus>({
    gemini: true,
    googleStream: true
  });
  const [cachedAudioCount, setCachedAudioCount] = useState<number>(0);
  const [testingSampleLang, setTestingSampleLang] = useState<'en' | 'pt' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(resolveSettingsTabId(initialTab));
    setEnVoices(getAvailableSystemVoices('en'));
    setPtVoices(getAvailableSystemVoices('pt'));
    setCachedAudioCount(getCachedTtsAudioCount());
    fetchVoiceHubServerStatus().then(status => setProviderStatus(status));
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const activeSequence: StudyStepCardType[] = buildEffectiveCardSequence(settings);
  const activeVisualCards: VisualCardType[] =
    Array.isArray(settings.visualCardOrder) && settings.visualCardOrder.length > 0
      ? settings.visualCardOrder
      : ['pt', 'en', 'literal'];

  const voiceCompat = getVoiceCompatibilitySummary(settings);
  const activeTabMeta = getSettingsTab(activeTab);
  const hasChallengeStepInSeq = activeSequence.some(card => isChallengeStepCard(card));

  /* ---------------------------------------------------------------- *
   * Study step sequence
   * ---------------------------------------------------------------- */

  const applyStepSequence = (next: StudyStepCardType[] | null, toastMsg?: string) => {
    if (!next || next.length === 0) return;
    onUpdateSettings(buildLegacyFlagsForSequence(next, 'custom'));
    if (toastMsg) onShowToast(toastMsg);
  };

  const handleMoveStepCard = (index: number, delta: -1 | 1) => {
    const next = moveOrderItem(activeSequence, index, delta);
    applyStepSequence(
      next,
      next ? `Ordem atualizada: ${formatCardSequenceSummary(next)}` : undefined
    );
  };

  const handleRepeatStepCard = (index: number) => {
    const next = duplicateOrderItem(activeSequence, index);
    if (!next) return;
    const meta = STEP_CARD_META[activeSequence[index]];
    applyStepSequence(next, `🔁 Etapa "${meta.shortLabel}" repetida na posição #${index + 2}!`);
  };

  const handleRemoveStepCard = (index: number) => {
    const next = removeOrderItem(activeSequence, index, 1);
    if (!next) {
      onShowToast('A sequência precisa ter pelo menos 1 etapa.');
      return;
    }
    applyStepSequence(next, 'Etapa removida da sequência.');
  };

  const handleAddStepCard = (cardType: StudyStepCardType) => {
    const next = appendOrderItem(activeSequence, cardType);
    const meta = STEP_CARD_META[cardType];
    const count = next.filter(card => card === cardType).length;
    applyStepSequence(
      next,
      count > 1
        ? `🔁 Etapa "${meta.shortLabel}" adicionada (${count}ª vez na sequência)!`
        : `➕ Etapa "${meta.shortLabel}" adicionada ao fluxo!`
    );
  };

  /* ---------------------------------------------------------------- *
   * Visual cards on the main screen
   * ---------------------------------------------------------------- */

  const applyVisualOrder = (next: VisualCardType[] | null, toastMsg?: string) => {
    if (!next || next.length === 0) return;
    onUpdateSettings({ visualCardOrder: next });
    if (toastMsg) onShowToast(toastMsg);
  };

  const handleMoveVisualCard = (index: number, delta: -1 | 1) => {
    const next = moveOrderItem(activeVisualCards, index, delta);
    if (!next) return;
    applyVisualOrder(
      next,
      `Ordem dos cards na tela: ${next.map(card => VISUAL_CARD_META[card].shortLabel).join(' → ')}`
    );
  };

  const handleRepeatVisualCard = (index: number) => {
    const next = duplicateOrderItem(activeVisualCards, index);
    if (!next) return;
    const meta = VISUAL_CARD_META[activeVisualCards[index]];
    applyVisualOrder(next, `🔁 Card "${meta.shortLabel}" duplicado na tela!`);
  };

  const handleRemoveVisualCard = (index: number) => {
    const next = removeOrderItem(activeVisualCards, index, 1);
    if (!next) {
      onShowToast('Mantenha pelo menos 1 card visível na tela.');
      return;
    }
    applyVisualOrder(next, 'Card removido da visualização.');
  };

  const handleAddVisualCard = (cardType: VisualCardType) => {
    const next = appendOrderItem(activeVisualCards, cardType);
    const meta = VISUAL_CARD_META[cardType];
    const count = next.filter(card => card === cardType).length;
    applyVisualOrder(
      next,
      count > 1
        ? `🔁 Card "${meta.shortLabel}" repetido na tela (${count}ª passagem)!`
        : `➕ Card "${meta.shortLabel}" adicionado à tela!`
    );
  };

  /* ---------------------------------------------------------------- *
   * Presets, engines and voice samples
   * ---------------------------------------------------------------- */

  const handleSelectRecommendedPreset = (presetId: Exclude<AudioFlow, 'custom'>) => {
    const preset = getPresetById(presetId);
    if (!preset) return;
    onUpdateSettings({
      ...buildLegacyFlagsForSequence([...preset.cardSequence], preset.id),
      visualCardOrder: [...preset.visualCardOrder]
    });
    onShowToast(`Fluxo aplicado: ${preset.title}`);
  };

  const handleEngineChange = (engine: TtsEngine) => {
    onUpdateSettings({ ttsEngine: engine });
  };

  const handleTestVoiceSample = async (lang: 'en' | 'pt') => {
    if (testingSampleLang === lang) {
      stopAllAudioPlayback();
      setTestingSampleLang(null);
      return;
    }
    setTestingSampleLang(lang);
    const sampleText =
      lang === 'en'
        ? 'Every morning I walk through Beacon Hill to practice my American pronunciation.'
        : 'Toda manhã eu pratico minha pronúncia com clareza e ritmo natural.';
    await speakTextUniversal(
      sampleText,
      lang === 'en' ? 'en-US' : 'pt-BR',
      settings.ttsEngine,
      settings.ttsSpeedEn,
      settings.ttsSpeedPt,
      1.0,
      {
        preferredVoiceEnUri: settings.preferredVoiceEnUri,
        preferredVoicePtUri: settings.preferredVoicePtUri,
        geminiVoiceName: settings.geminiVoiceName,
        geminiVoiceStyle: settings.geminiVoiceStyle,
        ttsCacheEnabled: settings.ttsCacheEnabled
      }
    );
    setCachedAudioCount(getCachedTtsAudioCount());
    setTestingSampleLang(null);
  };

  const handleClearCache = () => {
    clearTtsAudioCache();
    setCachedAudioCount(0);
    onShowToast('🧹 Cache de áudio limpo com sucesso!');
  };

  const isCustomFlow = settings.audioFlow === 'custom';

  return (
    <div
      id="modalSettings"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settingsModalTitle"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-[min(1120px,95vw)] h-[min(820px,92dvh)] p-4 sm:p-5 flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header: title + live state summary */}
        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <h3
              id="settingsModalTitle"
              className="text-sm sm:text-base font-bold text-white flex items-center gap-2"
            >
              <svg
                className="w-4 h-4 text-brand-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>Configurações</span>
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                id="activeSequenceSummaryBadge"
                className="px-2 py-0.5 rounded bg-brand-500/15 border border-brand-500/35 text-brand-200 font-mono text-[10px] font-bold"
                title="Etapas que cada frase percorre, na ordem"
              >
                Ordem ativa: {formatCardSequenceSummary(activeSequence)}
              </span>
              {isCustomFlow && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-200 font-bold">
                  ✨ Customizado
                </span>
              )}
              <span className="text-[10px] text-slate-400">
                Alterações são aplicadas na hora — não precisa salvar.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações"
            className="min-w-[40px] min-h-[40px] text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            ✕
          </button>
        </div>

        <SettingsTabsNav
          tabs={SETTINGS_TABS}
          activeTab={activeTab}
          onSelect={setActiveTab}
          badges={{
            presets: isCustomFlow ? 'próprio' : 'pronto',
            steps: `${activeSequence.length}`,
            rules: settings.autoHandsFree ? 'ON' : undefined
          }}
        />

        {/* Panel */}
        <div
          id={activeTabMeta.panelId}
          role="tabpanel"
          aria-labelledby={activeTabMeta.domId}
          className="mt-3 flex-1 min-h-0 overflow-y-auto pr-0.5 text-xs"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
            <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
              {activeTabMeta.icon} {activeTabMeta.title}
            </h4>
            <p className="text-[10px] text-slate-400">{activeTabMeta.description}</p>
          </div>

          {activeTab === 'presets' && (
            <SettingsPresetsPanel
              settings={settings}
              activeSequence={activeSequence}
              onSelectPreset={handleSelectRecommendedPreset}
              onGoToSteps={() => setActiveTab('steps')}
            />
          )}

          {activeTab === 'steps' && (
            <SettingsStepsPanel
              settings={settings}
              activeSequence={activeSequence}
              activeVisualCards={activeVisualCards}
              onMoveStep={handleMoveStepCard}
              onRepeatStep={handleRepeatStepCard}
              onRemoveStep={handleRemoveStepCard}
              onAddStep={handleAddStepCard}
              onMoveVisualCard={handleMoveVisualCard}
              onRepeatVisualCard={handleRepeatVisualCard}
              onRemoveVisualCard={handleRemoveVisualCard}
              onAddVisualCard={handleAddVisualCard}
              onUpdateSettings={onUpdateSettings}
              onShowToast={onShowToast}
            />
          )}

          {activeTab === 'voice_ai' && (
            <SettingsVoicePanel
              settings={settings}
              voiceCompat={voiceCompat}
              providerStatus={providerStatus}
              cachedAudioCount={cachedAudioCount}
              enVoices={enVoices}
              ptVoices={ptVoices}
              testingSampleLang={testingSampleLang}
              onTestVoiceSample={handleTestVoiceSample}
              onEngineChange={handleEngineChange}
              onSttProviderChange={provider => {
                onUpdateSettings({ sttProvider: provider });
              }}
              onUpdateSettings={onUpdateSettings}
              onShowToast={onShowToast}
              onClearCache={handleClearCache}
              onGoToRules={() => setActiveTab('rules')}
            />
          )}

          {activeTab === 'rules' && (
            <SettingsRulesPanel
              settings={settings}
              voiceCompat={voiceCompat}
              hasChallengeStepInSeq={hasChallengeStepInSeq}
              onUpdateSettings={onUpdateSettings}
              onShowToast={onShowToast}
              onGoToSteps={() => setActiveTab('steps')}
              onGoToVoice={() => setActiveTab('voice_ai')}
            />
          )}

          {activeTab === 'appearance' && (
            <SettingsAppearancePanel
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              onShowToast={onShowToast}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              id="btnResetDefaultSettings"
              type="button"
              onClick={() => {
                onUpdateSettings({ ...DEFAULT_SETTINGS });
                onShowToast(
                  'Configurações e ordem das etapas restauradas para o padrão recomendado!'
                );
              }}
              className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              ↺ Restaurar padrões
            </button>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              Restaura fluxo, etapas, voz, regras e aparência.
            </span>
          </div>

          <button
            id="btnSaveAndCloseSettings"
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs cursor-pointer whitespace-nowrap shadow-md shadow-brand-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
