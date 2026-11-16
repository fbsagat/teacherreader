import React, { useEffect, useState } from 'react';
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
  ThemeMode,
  TtsEngine,
  VisualCardType
} from '../types/shadowreader';
import {
  RECOMMENDED_CARD_PRESETS,
  STEP_CARD_META,
  VISUAL_CARD_META,
  buildEffectiveCardSequence,
  formatCardSequenceSummary,
  isChallengeStepCard
} from '../utils/cardSequencePresets';
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

export type SettingsTabId = 'models' | 'custom_cards' | 'voice_ai_hub' | 'voice_theme';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: SettingsTabId;
  settings: PedagogicalSettings;
  onUpdateSettings: (partial: Partial<PedagogicalSettings>) => void;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

const THEME_OPTIONS: { id: ThemeMode; label: string; swatch: string }[] = [
  { id: 'dark', label: '🌙 Escuro', swatch: '#0b111e' },
  { id: 'light', label: '☀️ Claro', swatch: '#f1f5f9' },
  { id: 'sepia', label: '📜 Sépia', swatch: '#f4ecd8' },
  { id: 'forest', label: '🌲 Floresta', swatch: '#071712' },
  { id: 'ocean', label: '🌊 Oceano', swatch: '#061524' },
  { id: 'amethyst', label: '🔮 Ametista', swatch: '#130b24' }
];

const AUDIO_AND_REVIEW_STEPS: StudyStepCardType[] = ['pt', 'en', 'en_slow', 'literal'];
const SPEAK_STEPS: StudyStepCardType[] = ['speak', 'speak_blind_en', 'speak_challenge'];
const CHALLENGE_STEPS: StudyStepCardType[] = [
  'challenges',
  'challenge_pronunciation',
  'challenge_matching'
];

const ADDABLE_VISUAL_CARDS: VisualCardType[] = ['pt', 'en', 'literal'];

const BLIND_MAX_ERROR_OPTIONS: { value: number; shortLabel: string; label: string }[] = [
  { value: 1, shortLabel: '1x', label: '1 erro' },
  { value: 2, shortLabel: '2x', label: '2 erros' },
  { value: 3, shortLabel: '3x', label: '3 erros' },
  { value: 4, shortLabel: '4x', label: '4 erros' },
  { value: 5, shortLabel: '5x', label: '5 erros' },
  { value: 0, shortLabel: 'Nunca', label: 'Nunca' }
];

const TTS_PROVIDER_OPTIONS: {
  id: TtsEngine;
  title: string;
  badge: string;
  subtitle: string;
  icon: string;
}[] = [
  {
    id: 'gemini_tts',
    title: 'Gemini Neural TTS (Estúdio EUA)',
    badge: 'Padrão · IA Neural',
    subtitle: 'Vozes neurais americanas ultra-naturais (Kore, Puck, Charon, Fenrir, Zephyr).',
    icon: '✨'
  },
  {
    id: 'auto',
    title: 'Híbrido Inteligente (Nativo + Nuvem)',
    badge: 'Zero Latência',
    subtitle: 'Escolhe automaticamente a melhor voz natural do sistema com fallback em nuvem.',
    icon: '⚡'
  },
  {
    id: 'browser_custom',
    title: 'Voz Manual do Dispositivo',
    badge: 'Sistema Local',
    subtitle: 'Permite fixar exatamente qual voz instalada no seu dispositivo usar em EN e PT.',
    icon: '🖥️'
  },
  {
    id: 'online',
    title: 'Google Cloud Stream (GTX)',
    badge: 'Universal',
    subtitle: 'Streaming leve e gratuito compatível com qualquer navegador ou celular.',
    icon: '☁️'
  }
];

const STT_PROVIDER_OPTIONS: {
  id: SttProvider;
  title: string;
  badge: string;
  subtitle: string;
  icon: string;
}[] = [
  {
    id: 'hybrid_ai',
    title: 'Híbrido + Coach IA',
    badge: 'Recomendado',
    subtitle: 'Reconhecimento em tempo real + diagnóstico fonético da gravação via Gemini.',
    icon: '🧠'
  },
  {
    id: 'web_speech',
    title: 'Web Speech Nativo',
    badge: 'Instantâneo',
    subtitle: 'Transcrição contínua gratuita com acumulador anti-corte e múltiplas alternativas.',
    icon: '⚡'
  },
  {
    id: 'gemini_stt',
    title: 'Gemini Audio Coach',
    badge: 'Multimodal',
    subtitle: 'Escuta o áudio real da sua voz e avalia pronúncia, ritmo, fluência e fonemas.',
    icon: '✨'
  }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  initialTab = 'models',
  settings,
  onUpdateSettings,
  onClose,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [enVoices, setEnVoices] = useState<SystemVoiceOption[]>([]);
  const [ptVoices, setPtVoices] = useState<SystemVoiceOption[]>([]);
  const [providerStatus, setProviderStatus] = useState<VoiceHubProviderStatus>({
    gemini: true,
    googleStream: true
  });
  const [cachedAudioCount, setCachedAudioCount] = useState<number>(0);
  const [testingSampleLang, setTestingSampleLang] = useState<'en' | 'pt' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setEnVoices(getAvailableSystemVoices('en'));
      setPtVoices(getAvailableSystemVoices('pt'));
      setCachedAudioCount(getCachedTtsAudioCount());
      fetchVoiceHubServerStatus().then(status => setProviderStatus(status));
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const activeSequence: StudyStepCardType[] = buildEffectiveCardSequence(settings);

  const activeVisualCards: VisualCardType[] =
    Array.isArray(settings.visualCardOrder) && settings.visualCardOrder.length > 0
      ? settings.visualCardOrder
      : ['pt', 'en', 'literal'];

  const thresholdLabel =
    settings.threshold <= 60 ? 'Fácil' : settings.threshold >= 85 ? 'Rigoroso' : 'Equilibrado';

  const speedEnLabel =
    settings.ttsSpeedEn <= 0.8
      ? 'Pausada'
      : settings.ttsSpeedEn <= 0.95
        ? 'Cadenciada'
        : 'Rápida';

  const speedPtLabel =
    settings.ttsSpeedPt <= 1.0
      ? 'Moderada'
      : settings.ttsSpeedPt <= 1.25
        ? 'Natural fluida'
        : 'Rápida';

  const syncLegacyFlagsFromSequence = (
    seq: StudyStepCardType[],
    flow: AudioFlow
  ): Partial<PedagogicalSettings> => {
    const hasBlindStep = seq.includes('speak_blind_en');
    const hasLiteralStep = seq.includes('literal');
    const hasBothChallenges = seq.includes('challenges');
    const hasPronChallenge = hasBothChallenges || seq.includes('challenge_pronunciation');
    const hasMatchChallenge = hasBothChallenges || seq.includes('challenge_matching');
    const hasAnyChallenge = hasPronChallenge || hasMatchChallenge;

    return {
      audioFlow: flow,
      cardSequence: seq,
      enableBlindSpeakingStage: hasBlindStep,
      readWordsOnSuccess: hasLiteralStep,
      enablePostSentenceChallenges: hasAnyChallenge,
      enableWordPronunciationChallenge: hasPronChallenge,
      enableWordMatchingChallenge: hasMatchChallenge
    };
  };

  const handleSelectRecommendedPreset = (presetId: Exclude<AudioFlow, 'custom'>) => {
    const preset = RECOMMENDED_CARD_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    onUpdateSettings({
      ...syncLegacyFlagsFromSequence([...preset.cardSequence], preset.id),
      visualCardOrder: [...preset.visualCardOrder]
    });
    onShowToast(`Fluxo aplicado: ${preset.title}`);
  };

  // Custom Step Sequence Handlers
  const updateCustomSequence = (nextSeq: StudyStepCardType[], toastMsg?: string) => {
    if (nextSeq.length === 0) return;
    onUpdateSettings(syncLegacyFlagsFromSequence(nextSeq, 'custom'));
    if (toastMsg) onShowToast(toastMsg);
  };

  const handleMoveStepCard = (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= activeSequence.length) return;
    const next = [...activeSequence];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    updateCustomSequence(next, `Ordem atualizada: ${formatCardSequenceSummary(next)}`);
  };

  const handleRepeatStepCard = (index: number) => {
    const next = [...activeSequence];
    const cardToRepeat = next[index];
    next.splice(index + 1, 0, cardToRepeat);
    const meta = STEP_CARD_META[cardToRepeat];
    updateCustomSequence(next, `🔁 Etapa "${meta.shortLabel}" repetida na posição #${index + 2}!`);
  };

  const handleRemoveStepCard = (index: number) => {
    if (activeSequence.length <= 1) {
      onShowToast('A sequência precisa ter pelo menos 1 etapa.');
      return;
    }
    const next = activeSequence.filter((_, idx) => idx !== index);
    updateCustomSequence(next, 'Etapa removida da sequência.');
  };

  const handleAddStepCard = (cardType: StudyStepCardType) => {
    const next = [...activeSequence, cardType];
    const meta = STEP_CARD_META[cardType];
    const count = next.filter(c => c === cardType).length;
    updateCustomSequence(
      next,
      count > 1
        ? `🔁 Etapa "${meta.shortLabel}" adicionada (${count}ª vez na sequência)!`
        : `➕ Etapa "${meta.shortLabel}" adicionada ao fluxo!`
    );
  };

  // Custom Visual Card Order Handlers (Main Screen Layout)
  const updateVisualCardOrder = (nextOrder: VisualCardType[], toastMsg?: string) => {
    if (nextOrder.length === 0) return;
    onUpdateSettings({
      visualCardOrder: nextOrder
    });
    if (toastMsg) onShowToast(toastMsg);
  };

  const handleMoveVisualCard = (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= activeVisualCards.length) return;
    const next = [...activeVisualCards];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    updateVisualCardOrder(
      next,
      `Ordem dos cards na tela: ${next.map(c => VISUAL_CARD_META[c].shortLabel).join(' → ')}`
    );
  };

  const handleRepeatVisualCard = (index: number) => {
    const next = [...activeVisualCards];
    const cardToRepeat = next[index];
    next.splice(index + 1, 0, cardToRepeat);
    const meta = VISUAL_CARD_META[cardToRepeat];
    updateVisualCardOrder(
      next,
      `🔁 Card "${meta.shortLabel}" duplicado na tela (Card 0${index + 2})!`
    );
  };

  const handleRemoveVisualCard = (index: number) => {
    if (activeVisualCards.length <= 1) {
      onShowToast('Mantenha pelo menos 1 card visível na tela.');
      return;
    }
    const next = activeVisualCards.filter((_, idx) => idx !== index);
    updateVisualCardOrder(next, 'Card removido da visualização.');
  };

  const handleAddVisualCard = (cardType: VisualCardType) => {
    const next = [...activeVisualCards, cardType];
    const meta = VISUAL_CARD_META[cardType];
    const count = next.filter(c => c === cardType).length;
    updateVisualCardOrder(
      next,
      count > 1
        ? `🔁 Card "${meta.shortLabel}" repetido na tela (${count}ª passagem)!`
        : `➕ Card "${meta.shortLabel}" adicionado à tela!`
    );
  };

  const handleEngineChange = (engine: TtsEngine) => {
    const found = TTS_PROVIDER_OPTIONS.find(p => p.id === engine);
    onUpdateSettings({ ttsEngine: engine });
    onShowToast(`🔊 Motor TTS alterado para: ${found ? found.title : engine}`);
  };

  const handleSttProviderChange = (provider: SttProvider) => {
    const found = STT_PROVIDER_OPTIONS.find(p => p.id === provider);
    onUpdateSettings({ sttProvider: provider });
    onShowToast(`🎙️ Reconhecimento de voz alterado para: ${found ? found.title : provider}`);
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

  const handleThemeSelect = (themeMode: ThemeMode, label: string) => {
    onUpdateSettings({ themeMode });
    onShowToast(`Tema alterado para: ${label}`);
  };

  const presetIdMap: Record<Exclude<AudioFlow, 'custom'>, string> = {
    pt_first: 'cfgFlowPtFirstCard',
    sandwich: 'cfgFlowSandwichCard',
    en_first: 'cfgFlowEnFirstCard',
    blind_en: 'cfgFlowBlindEnCard',
    challenge: 'cfgFlowChallengeCard'
  };

  // Count occurrences for repetition badges
  const stepTotalCounts: Record<string, number> = {};
  activeSequence.forEach(c => {
    stepTotalCounts[c] = (stepTotalCounts[c] || 0) + 1;
  });
  const stepSeenCounts: Record<string, number> = {};

  const visualTotalCounts: Record<string, number> = {};
  activeVisualCards.forEach(c => {
    visualTotalCounts[c] = (visualTotalCounts[c] || 0) + 1;
  });
  const visualSeenCounts: Record<string, number> = {};

  const hasChallengeStepInSeq = activeSequence.some(c => isChallengeStepCard(c));
  const voiceCompat = getVoiceCompatibilitySummary(settings);

  const TABS: {
    id: SettingsTabId;
    domId: string;
    label: string;
    icon: string;
    badge?: string;
  }[] = [
    {
      id: 'models',
      domId: 'tabSettingsModels',
      label: 'Modelos',
      icon: '★',
      badge: settings.audioFlow !== 'custom' ? 'Ativo' : undefined
    },
    {
      id: 'custom_cards',
      domId: 'tabSettingsCustomCards',
      label: 'Etapas',
      icon: '🎛️',
      badge: `${activeSequence.length}`
    },
    {
      id: 'voice_ai_hub',
      domId: 'tabSettingsVoiceAiHub',
      label: 'Voz & IA',
      icon: '🎙️',
      badge: 'Novo'
    },
    {
      id: 'voice_theme',
      domId: 'tabSettingsVoice',
      label: 'Texto, Tema & Regras',
      icon: '🎨'
    }
  ];

  const activeFontScale = settings.fontSizeScale ?? 110;
  const fontScaleLabel =
    activeFontScale <= 95
      ? 'Compacto'
      : activeFontScale === 100
        ? 'Original'
        : activeFontScale === 110
          ? 'Confortável · Padrão'
          : activeFontScale <= 120
            ? 'Grande'
            : 'Extra Grande';

  const handleFontScaleChange = (nextScale: number, silentToast: boolean = false) => {
    const clamped = Math.min(135, Math.max(85, Math.round(nextScale / 5) * 5));
    onUpdateSettings({ fontSizeScale: clamped });
    if (!silentToast) {
      onShowToast(`🔤 Tamanho do texto ajustado para ${clamped}%`);
    }
  };

  return (
    <div
      id="modalSettings"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settingsModalTitle"
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl lg:max-w-3xl xl:max-w-[880px] w-full p-4 sm:p-5 max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800 shrink-0">
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
              <span>Configurações & Ordem de Aprendizado</span>
            </h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span
                id="activeSequenceSummaryBadge"
                className="px-2 py-0.5 rounded bg-brand-500/15 border border-brand-500/35 text-brand-200 font-mono text-[10px] font-bold"
              >
                Ordem Ativa: {formatCardSequenceSummary(activeSequence)}
              </span>
              {settings.audioFlow === 'custom' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-200 font-bold">
                  ✨ Customizado
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div
          id="settingsTabsNav"
          role="tablist"
          aria-label="Abas de Configurações"
          className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800/90 mt-2.5 shrink-0"
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={tab.domId}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.id === 'voice_theme' ? (
                  <>
                    <span className="sm:hidden truncate">Texto &amp; Tema</span>
                    <span className="hidden sm:inline truncate">{tab.label}</span>
                  </>
                ) : (
                  <span className="truncate">{tab.label}</span>
                )}
                {tab.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Panel */}
        <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-0.5 text-xs">
          {/* TAB 1: RECOMMENDED MODELS */}
          {activeTab === 'models' && (
            <div id="tabPanelModels" className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2">
                <div className="text-[10px] text-slate-300 leading-snug">
                  <strong className="text-amber-300">Como funciona:</strong> cada frase segue a{' '}
                  <strong>sequência exata de etapas</strong> abaixo (incluindo{' '}
                  <span className="text-teal-300 font-semibold">🧠 Falar Sem Inglês</span>,{' '}
                  <span className="text-amber-300 font-semibold">🔤 Revisão Automática</span> e{' '}
                  <span className="text-purple-300 font-semibold">🏆 Desafios</span> como etapas da
                  frase).
                </div>
                <button
                  id="btnGoToCustomBuilderTab"
                  type="button"
                  onClick={() => setActiveTab('custom_cards')}
                  className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-brand-600/25 hover:bg-brand-600 border border-brand-500/40 text-brand-200 hover:text-white transition cursor-pointer shrink-0 whitespace-nowrap"
                >
                  🎛️ Montar Minha Ordem →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RECOMMENDED_CARD_PRESETS.map((preset, idx) => {
                  const isSelected = settings.audioFlow === preset.id;
                  const domId = presetIdMap[preset.id];
                  const isFullSpan = idx === RECOMMENDED_CARD_PRESETS.length - 1;
                  return (
                    <label
                      key={preset.id}
                      id={domId}
                      className={`relative flex flex-col justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                        isFullSpan ? 'sm:col-span-2' : ''
                      } ${isSelected ? preset.activeAccentClass : preset.accentClass}`}
                    >
                      <input
                        type="radio"
                        name="audioFlow"
                        value={preset.id}
                        checked={isSelected}
                        onChange={() => handleSelectRecommendedPreset(preset.id)}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <div>
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className="font-bold text-slate-100 text-[11px] leading-snug">
                            {preset.title}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30 font-bold shrink-0">
                            {preset.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 mt-1 leading-snug">
                          {preset.description}
                        </p>
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center gap-1 flex-wrap">
                        {preset.cardSequence.map((step, sIdx) => {
                          const meta = STEP_CARD_META[step];
                          return (
                            <React.Fragment key={`${preset.id}-${step}-${sIdx}`}>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${meta.badgeClass}`}
                              >
                                {sIdx + 1}º {meta.icon} {meta.shortLabel}
                              </span>
                              {sIdx < preset.cardSequence.length - 1 && (
                                <span className="text-[9px] text-slate-500">→</span>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOM STEP ORDER & VISUAL CARDS BUILDER */}
          {activeTab === 'custom_cards' && (
            <div id="customCardOrderBuilder" className="space-y-3">
              {/* Sub-panel A: Step Execution Sequence (Order + Repeat + Add Any Step) */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-100 text-[11px] block">
                      1. Ordem das Etapas de Aprendizado da Frase
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Coloque na ordem que preferir: Áudio, Falar (Com ou Sem Inglês), Revisão
                      Automática e Desafios. Use <strong className="text-amber-300">🔁 Repetir</strong>{' '}
                      para duplicar qualquer etapa.
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                    {activeSequence.length} etapas
                  </span>
                </div>

                <div
                  id="customCardSequenceList"
                  className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5"
                >
                  {activeSequence.map((stepType, idx) => {
                    const meta = STEP_CARD_META[stepType] || STEP_CARD_META.en;
                    stepSeenCounts[stepType] = (stepSeenCounts[stepType] || 0) + 1;
                    const occurrenceNum = stepSeenCounts[stepType];
                    const isRepeated = (stepTotalCounts[stepType] || 0) > 1;

                    return (
                      <div
                        key={`${stepType}-${idx}`}
                        data-step-card={stepType}
                        data-step-idx={idx}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}º
                          </span>
                          <span className="text-sm shrink-0">{meta.icon}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-[11px] text-slate-100 truncate">
                                {meta.label}
                              </span>
                              {isRepeated && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 font-bold">
                                  🔁 {occurrenceNum}ª vez
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            id={`btnMoveStepUp_${idx}`}
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveStepCard(idx, -1)}
                            title="Mover esta etapa para antes"
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 text-[10px] font-bold cursor-pointer disabled:cursor-not-allowed"
                          >
                            ↑
                          </button>
                          <button
                            id={`btnMoveStepDown_${idx}`}
                            type="button"
                            disabled={idx === activeSequence.length - 1}
                            onClick={() => handleMoveStepCard(idx, 1)}
                            title="Mover esta etapa para depois"
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 text-[10px] font-bold cursor-pointer disabled:cursor-not-allowed"
                          >
                            ↓
                          </button>
                          <button
                            id={`btnRepeatStepCard_${idx}`}
                            type="button"
                            onClick={() => handleRepeatStepCard(idx)}
                            title="Repetir / duplicar esta etapa logo em seguida"
                            className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[10px] font-bold cursor-pointer flex items-center gap-1"
                          >
                            <span>🔁</span>
                            <span className="hidden sm:inline">Repetir</span>
                          </button>
                          <button
                            id={`btnRemoveStepCard_${idx}`}
                            type="button"
                            disabled={activeSequence.length <= 1}
                            onClick={() => handleRemoveStepCard(idx)}
                            title="Remover esta etapa da sequência"
                            className="px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 disabled:opacity-30 text-rose-300 text-[10px] font-bold cursor-pointer disabled:cursor-not-allowed"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Categorized Add Step Buttons */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 w-full sm:w-28 shrink-0">
                      ➕ Áudio & Revisão:
                    </span>
                    {AUDIO_AND_REVIEW_STEPS.map(cardType => {
                      const meta = STEP_CARD_META[cardType];
                      return (
                        <button
                          key={cardType}
                          id={`btnAddStepCard_${cardType}`}
                          type="button"
                          onClick={() => handleAddStepCard(cardType)}
                          className={`px-2 py-1 sm:py-0.5 rounded-lg border text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 ${meta.chipClass}`}
                          title={meta.description}
                        >
                          <span>+ {meta.icon}</span>
                          <span>{meta.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-emerald-400/90 w-full sm:w-28 shrink-0">
                      ➕ Etapas de Fala:
                    </span>
                    {SPEAK_STEPS.map(cardType => {
                      const meta = STEP_CARD_META[cardType];
                      return (
                        <button
                          key={cardType}
                          id={`btnAddStepCard_${cardType}`}
                          type="button"
                          onClick={() => handleAddStepCard(cardType)}
                          className={`px-2 py-1 sm:py-0.5 rounded-lg border text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 ${meta.chipClass}`}
                          title={meta.description}
                        >
                          <span>+ {meta.icon}</span>
                          <span>{meta.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-purple-300 w-full sm:w-28 shrink-0">
                      ➕ Desafios:
                    </span>
                    {CHALLENGE_STEPS.map(cardType => {
                      const meta = STEP_CARD_META[cardType];
                      return (
                        <button
                          key={cardType}
                          id={`btnAddStepCard_${cardType}`}
                          type="button"
                          onClick={() => handleAddStepCard(cardType)}
                          className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 ${meta.chipClass}`}
                          title={meta.description}
                        >
                          <span>+ {meta.icon}</span>
                          <span>{meta.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Rules for Blind Speaking Step */}
                  <div className="pt-1.5 border-t border-slate-800/70 bg-teal-950/20 border-teal-500/20 rounded-lg px-2.5 py-2 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-teal-300 block">
                          🧠 Falar Sem Ler o Inglês — Revelar texto após quantos erros?
                        </span>
                        <span className="text-[9px] text-slate-400 block">
                          Mostra o texto em inglês automaticamente se você esquecer a frase e errar:
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {BLIND_MAX_ERROR_OPTIONS.map(opt => {
                          const currentVal = settings.blindMaxErrorsBeforeReveal ?? 2;
                          const isSelected = currentVal === opt.value;
                          return (
                            <button
                              key={`custom-blind-err-${opt.value}`}
                              id={`btnCustomBlindMaxErrors_${opt.value}`}
                              type="button"
                              onClick={() => {
                                onUpdateSettings({ blindMaxErrorsBeforeReveal: opt.value });
                                onShowToast(
                                  opt.value === 0
                                    ? '🧠 Falar Sem Inglês: texto nunca será revelado automaticamente.'
                                    : `🧠 Falar Sem Inglês: texto será revelado após ${opt.label}.`
                                );
                              }}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                                isSelected
                                  ? 'bg-teal-600 text-white border-teal-400 shadow-xs'
                                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-teal-500/50 hover:text-white'
                              }`}
                            >
                              {opt.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div
                      id="cfgCustomBlindFullSentenceBox"
                      className="pt-1.5 border-t border-teal-500/20 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-teal-300 block">
                          🧠 Falar Sem Ler na Sentença Completa ("Desafio Final: Frase Inteira")
                        </span>
                        <span className="text-[9px] text-slate-400 block">
                          {(settings.blindSpeakingOnFullSentence ?? true)
                            ? 'Ativado: esta etapa aparece no modo "Em Partes" e também no "Desafio Final: Frase Inteira".'
                            : 'Desativado: esta etapa aparece apenas no modo "Em Partes" (nas partes divididas).'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          id="btnCustomBlindFullSentence_false"
                          type="button"
                          onClick={() => {
                            onUpdateSettings({ blindSpeakingOnFullSentence: false });
                            onShowToast(
                              '🧠 Falar Sem Inglês: aparecerá apenas no modo "Em Partes" (desativado na frase inteira).'
                            );
                          }}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                            (settings.blindSpeakingOnFullSentence ?? true) === false
                              ? 'bg-teal-600 text-white border-teal-400 shadow-xs'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-teal-500/50 hover:text-white'
                          }`}
                        >
                          ✂️ Só Em Partes
                        </button>
                        <button
                          id="btnCustomBlindFullSentence_true"
                          type="button"
                          onClick={() => {
                            onUpdateSettings({ blindSpeakingOnFullSentence: true });
                            onShowToast(
                              '🧠 Falar Sem Inglês: ativado também no "Desafio Final: Frase Inteira"!'
                            );
                          }}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                            (settings.blindSpeakingOnFullSentence ?? true) === true
                              ? 'bg-teal-600 text-white border-teal-400 shadow-xs'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-teal-500/50 hover:text-white'
                          }`}
                        >
                          🏁 Também na Frase Inteira
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-panel B: Visual Cards Order & Repetition on Main Study Screen */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-100 text-[11px] block">
                      2. Ordem dos Cards Visuais na Tela Principal
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Defina a posição visual dos cards (Português, Inglês e Tradução Literal).
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                    {activeVisualCards.length} cards
                  </span>
                </div>

                <div
                  id="customVisualCardsList"
                  className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5"
                >
                  {activeVisualCards.map((vCard, idx) => {
                    const meta = VISUAL_CARD_META[vCard] || VISUAL_CARD_META.en;
                    visualSeenCounts[vCard] = (visualSeenCounts[vCard] || 0) + 1;
                    const occ = visualSeenCounts[vCard];
                    const isRepeated = (visualTotalCounts[vCard] || 0) > 1;

                    return (
                      <div
                        key={`visual-${vCard}-${idx}`}
                        data-visual-card={vCard}
                        data-visual-idx={idx}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold shrink-0">
                            0{idx + 1}
                          </span>
                          <span className="text-sm shrink-0">{meta.icon}</span>
                          <span className="font-bold text-[11px] text-slate-100 truncate">
                            {meta.label}
                          </span>
                          {isRepeated && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 font-bold shrink-0">
                              🔁 {occ}ª Passagem
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            id={`btnMoveVisualCardUp_${idx}`}
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveVisualCard(idx, -1)}
                            title="Subir posição deste card na tela"
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 text-[10px] font-bold cursor-pointer disabled:cursor-not-allowed"
                          >
                            ↑
                          </button>
                          <button
                            id={`btnMoveVisualCardDown_${idx}`}
                            type="button"
                            disabled={idx === activeVisualCards.length - 1}
                            onClick={() => handleMoveVisualCard(idx, 1)}
                            title="Descer posição deste card na tela"
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 text-[10px] font-bold cursor-pointer disabled:cursor-not-allowed"
                          >
                            ↓
                          </button>
                          <button
                            id={`btnRepeatVisualCard_${idx}`}
                            type="button"
                            onClick={() => handleRepeatVisualCard(idx)}
                            title="Repetir / duplicar este card visual na tela"
                            className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[10px] font-bold cursor-pointer flex items-center gap-1"
                          >
                            <span>🔁</span>
                            <span className="hidden sm:inline">Repetir</span>
                          </button>
                          <button
                            id={`btnRemoveVisualCard_${idx}`}
                            type="button"
                            disabled={activeVisualCards.length <= 1}
                            onClick={() => handleRemoveVisualCard(idx)}
                            title="Remover este card da tela"
                            className="px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 disabled:opacity-30 text-rose-300 text-[10px] font-bold cursor-pointer disabled:cursor-not-allowed"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add / Repeat Visual Card */}
                <div className="pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 mr-1">
                    ➕ Adicionar na tela:
                  </span>
                  {ADDABLE_VISUAL_CARDS.map(vType => {
                    const meta = VISUAL_CARD_META[vType];
                    return (
                      <button
                        key={vType}
                        id={`btnAddVisualCard_${vType}`}
                        type="button"
                        onClick={() => handleAddVisualCard(vType)}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 ${meta.badgeClass}`}
                      >
                        <span>+ {meta.icon}</span>
                        <span>Card {meta.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MULTI-PROVIDER VOICE & AI HUB */}
          {activeTab === 'voice_ai_hub' && (
            <div id="tabPanelVoiceAiHub" className="space-y-3">
              {/* Top Status & Cache Bar */}
              <div
                id="voiceHubStatusBanner"
                className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1 overflow-hidden"
              >
                <span className="text-[10px] font-bold text-slate-300 shrink-0">
                  Motores Ativos:
                </span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar whitespace-nowrap">
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                      providerStatus.gemini
                        ? 'bg-brand-500/15 border-brand-500/40 text-brand-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    ✨ Gemini Neural & Coach {providerStatus.gemini ? '· Ativo' : ''}
                  </span>
                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-bold">
                    ✓ Vozes do Sistema ({enVoices.length} EN · {ptVoices.length} PT)
                  </span>
                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/35 text-sky-200 text-[10px] font-semibold">
                    ☁️ Google Cloud Stream · Gratuito
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-300 cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      id="cfgTtsCacheEnabled"
                      checked={settings.ttsCacheEnabled ?? true}
                      onChange={e => {
                        onUpdateSettings({ ttsCacheEnabled: e.target.checked });
                        onShowToast(
                          e.target.checked
                            ? '⚡ Cache de áudio neural ativado (repetição em 0ms)!'
                            : 'Cache de áudio neural desativado.'
                        );
                      }}
                      className="rounded border-slate-700 bg-slate-800 text-brand-500"
                    />
                    <span>⚡ Cache ({cachedAudioCount})</span>
                  </label>
                  <button
                    id="btnClearTtsCache"
                    type="button"
                    onClick={() => {
                      clearTtsAudioCache();
                      setCachedAudioCount(0);
                      onShowToast('🧹 Cache de áudio limpo com sucesso!');
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-300 hover:text-white transition cursor-pointer whitespace-nowrap"
                  >
                    🧹 Limpar
                  </button>
                </div>
              </div>

              {/* SECTION 1: MULTI-PROVIDER TTS */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-100 text-[11px] uppercase tracking-wider block">
                      1. Provedor de Síntese de Voz (TTS — Text-to-Speech)
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Escolha o motor de voz para ler as frases em inglês dos EUA e português:
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      id="btnTestVoiceSampleEn"
                      type="button"
                      onClick={() => handleTestVoiceSample('en')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                        testingSampleLang === 'en'
                          ? 'bg-rose-600 text-white border-rose-400'
                          : 'bg-brand-600/25 hover:bg-brand-600/40 text-brand-200 border-brand-500/40'
                      }`}
                    >
                      <span>{testingSampleLang === 'en' ? '⏹' : '🔊'}</span>
                      <span>{testingSampleLang === 'en' ? 'Parar EN' : 'Ouvir Amostra EN'}</span>
                    </button>
                    <button
                      id="btnTestVoiceSamplePt"
                      type="button"
                      onClick={() => handleTestVoiceSample('pt')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                        testingSampleLang === 'pt'
                          ? 'bg-rose-600 text-white border-rose-400'
                          : 'bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border-indigo-500/40'
                      }`}
                    >
                      <span>{testingSampleLang === 'pt' ? '⏹' : '🔊'}</span>
                      <span>{testingSampleLang === 'pt' ? 'Parar PT' : 'Ouvir Amostra PT'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TTS_PROVIDER_OPTIONS.map(opt => {
                    const isSelected = settings.ttsEngine === opt.id;
                    return (
                      <button
                        key={opt.id}
                        id={`btnTtsProvider_${opt.id}`}
                        type="button"
                        onClick={() => handleEngineChange(opt.id)}
                        className={`text-left p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-1 ${
                          isSelected
                            ? 'bg-brand-600/20 border-brand-400 ring-1 ring-brand-400/50 shadow-sm'
                            : 'bg-slate-900/80 border-slate-800 hover:border-brand-500/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-bold text-slate-100 text-[11px] flex items-center gap-1.5 whitespace-normal leading-snug text-left">
                            <span className="shrink-0">{opt.icon}</span>
                            <span>{opt.title}</span>
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-200 border border-brand-400/30 font-bold shrink-0">
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">{opt.subtitle}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Voice Persona & System Voice Pickers */}
                <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Left: Gemini Neural Voice Persona */}
                  <div
                    id="voiceHubGeminiPanel"
                    className={`p-2.5 rounded-xl border space-y-2 transition ${
                      voiceCompat.usesGeminiTts
                        ? 'bg-slate-900/85 border-brand-500/45'
                        : 'bg-slate-900/50 border-slate-800/80 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[10px] font-bold text-brand-300 uppercase tracking-wider">
                        ✨ Timbre & Estilo Neural (Gemini)
                      </span>
                      {voiceCompat.usesGeminiTts ? (
                        <span className="px-1.5 py-0.5 rounded bg-brand-500/20 border border-brand-400/40 text-brand-200 text-[9px] font-bold">
                          ★ Ativo agora
                        </span>
                      ) : (
                        <button
                          id="btnQuickUseGeminiTts"
                          type="button"
                          onClick={() => handleEngineChange('gemini_tts')}
                          className="px-1.5 py-0.5 rounded bg-brand-500/15 hover:bg-brand-500/30 border border-brand-400/35 text-brand-200 text-[9px] font-bold cursor-pointer transition"
                        >
                          Ativar Gemini Neural
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-300 block">
                          Voz Neural Gemini (EN-US & PT-BR):
                        </span>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-1">
                          {(
                            [
                              { id: 'Kore', label: 'Kore ♀' },
                              { id: 'Puck', label: 'Puck ♂' },
                              { id: 'Charon', label: 'Charon ♂' },
                              { id: 'Fenrir', label: 'Fenrir ♂' },
                              { id: 'Zephyr', label: 'Zephyr ♀' }
                            ] as { id: GeminiVoiceName; label: string }[]
                          ).map(v => {
                            const active = (settings.geminiVoiceName ?? 'Kore') === v.id;
                            return (
                              <button
                                key={v.id}
                                id={`btnGeminiVoice_${v.id}`}
                                type="button"
                                onClick={() => {
                                  onUpdateSettings({ geminiVoiceName: v.id });
                                  onShowToast(
                                    voiceCompat.usesGeminiTts
                                      ? `✨ Voz Gemini selecionada: ${v.id}`
                                      : `✨ Voz Gemini salva (${v.id}) — clique em "Gemini Neural TTS" acima para usar.`
                                  );
                                }}
                                className={`min-h-[38px] sm:min-h-0 py-1.5 sm:py-1 px-1.5 rounded-md text-[10px] font-bold border cursor-pointer transition truncate ${
                                  active
                                    ? 'bg-brand-600 text-white border-brand-400'
                                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-brand-500/40'
                                }`}
                              >
                                {v.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-300 block">
                          Estilo de Locução nos EUA (sincroniza com Velocidade EN):
                        </span>
                        <div className="grid grid-cols-2 gap-1">
                          {(
                            [
                              { id: 'clear_teacher', label: '👩‍🏫 Professor Claro' },
                              { id: 'audiobook', label: '📖 Narrador Audiobook' },
                              { id: 'conversational', label: '💬 Conversa EUA' },
                              { id: 'slow_learner', label: '🐢 Articulado Calmo' }
                            ] as { id: GeminiVoiceStyle; label: string }[]
                          ).map(st => {
                            const active = (settings.geminiVoiceStyle ?? 'clear_teacher') === st.id;
                            return (
                              <button
                                key={st.id}
                                id={`btnGeminiStyle_${st.id}`}
                                type="button"
                                onClick={() => {
                                  onUpdateSettings({ geminiVoiceStyle: st.id });
                                  onShowToast(`✨ Estilo de voz: ${st.label}`);
                                }}
                                className={`py-1 px-2 rounded-md text-[10px] font-bold border cursor-pointer transition truncate ${
                                  active
                                    ? 'bg-indigo-600 text-white border-indigo-400'
                                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-indigo-500/40'
                                }`}
                              >
                                {st.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: System / Browser Voice Selectors (EN-US & PT-BR) */}
                  <div
                    id="voiceHubSystemPanel"
                    className={`p-2.5 rounded-xl border space-y-2 transition ${
                      voiceCompat.usesSystemVoicePicker
                        ? 'bg-slate-900/85 border-emerald-500/45'
                        : 'bg-slate-900/50 border-slate-800/80 opacity-85'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                        🖥️ Voz Nativa do Dispositivo
                      </span>
                      {voiceCompat.usesSystemVoicePicker ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[9px] font-bold">
                          ★ Ativo agora
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[9px] font-semibold">
                          🛡️ Fallback local
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="selectSystemVoiceEn"
                        className="text-[10px] text-slate-300 block"
                      >
                        🇺🇸 Voz Preferida em Inglês:
                      </label>
                      <select
                        id="selectSystemVoiceEn"
                        value={settings.preferredVoiceEnUri || ''}
                        onChange={e => {
                          onUpdateSettings({ preferredVoiceEnUri: e.target.value });
                          onShowToast(
                            e.target.value
                              ? `🇺🇸 Voz em inglês fixada: ${e.target.value}`
                              : '🇺🇸 Seleção automática da melhor voz em inglês.'
                          );
                        }}
                        className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 sm:py-1 text-base sm:text-[10px] text-slate-100 focus:border-brand-500 focus:outline-none"
                      >
                        <option value="">⚡ Automática (Melhor voz Natural/Google disponível)</option>
                        {enVoices.map(v => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.isNaturalOrNeural ? '★ ' : ''}
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="selectSystemVoicePt"
                        className="text-[10px] text-slate-300 block"
                      >
                        🇧🇷 Voz Preferida em Português:
                      </label>
                      <select
                        id="selectSystemVoicePt"
                        value={settings.preferredVoicePtUri || ''}
                        onChange={e => {
                          onUpdateSettings({ preferredVoicePtUri: e.target.value });
                          onShowToast(
                            e.target.value
                              ? `🇧🇷 Voz em português fixada: ${e.target.value}`
                              : '🇧🇷 Seleção automática da melhor voz em português.'
                          );
                        }}
                        className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 sm:py-1 text-base sm:text-[10px] text-slate-100 focus:border-brand-500 focus:outline-none"
                      >
                        <option value="">⚡ Automática (Melhor voz Natural/Luciana disponível)</option>
                        {ptVoices.map(v => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.isNaturalOrNeural ? '★ ' : ''}
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: MULTI-PROVIDER STT & PRONUNCIATION ASSESSMENT */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div>
                  <span className="font-bold text-slate-100 text-[11px] uppercase tracking-wider block">
                    2. Motor de Reconhecimento de Voz & Avaliação Fonética (STT + Coach IA)
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Escolha como sua fala é capturada, transcrita e avaliada:
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {STT_PROVIDER_OPTIONS.map(opt => {
                    const currentStt = settings.sttProvider ?? 'hybrid_ai';
                    const isSelected = currentStt === opt.id;
                    return (
                      <button
                        key={opt.id}
                        id={`btnSttProvider_${opt.id}`}
                        type="button"
                        onClick={() => handleSttProviderChange(opt.id)}
                        className={`text-left p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-1 ${
                          isSelected
                            ? 'bg-emerald-600/20 border-emerald-400 ring-1 ring-emerald-400/50 shadow-sm'
                            : 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-bold text-slate-100 text-[11px] flex items-center gap-1.5 whitespace-normal leading-snug text-left">
                            <span className="shrink-0">{opt.icon}</span>
                            <span>{opt.title}</span>
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-bold shrink-0">
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">{opt.subtitle}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Microphone Calibration: Pause Timeout, Phonetic Strictness, AI Coach & Noise Suppression */}
                <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-slate-900/75 border border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                      ⏱️ Tempo de Pausa para Respirar & Pensar
                    </span>
                    <p className="text-[9px] text-slate-400 leading-tight">
                      Evita que o microfone encerre sua fala cedo demais quando você fizer uma pausa na vírgula:
                    </p>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: 'short', label: '⚡ Rápido (1.6s+)' },
                          { id: 'normal', label: '⚖️ Normal (2.5s+)' },
                          { id: 'long', label: '🧘 Calmo (4.0s+)' }
                        ] as { id: SttSilencePauseMode; label: string }[]
                      ).map(mode => {
                        const active = (settings.sttSilencePauseMode ?? 'normal') === mode.id;
                        return (
                          <button
                            key={mode.id}
                            id={`btnSttPause_${mode.id}`}
                            type="button"
                            onClick={() => {
                              onUpdateSettings({ sttSilencePauseMode: mode.id });
                              onShowToast(`⏱️ Tempo de pausa do microfone: ${mode.label}`);
                            }}
                            className={`min-h-[38px] sm:min-h-0 py-1.5 px-2 rounded-md text-[10px] font-bold border cursor-pointer transition ${
                              active
                                ? 'bg-amber-600 text-white border-amber-400'
                                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-amber-500/40'
                            }`}
                          >
                            {mode.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/75 border border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block">
                      🎯 Rigor Fonético & Coach de Sotaque
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: 'forgiving', label: '🌱 Tolerante' },
                          { id: 'balanced', label: '🎯 Equilibrado' },
                          { id: 'strict', label: '🦅 Rigoroso' }
                        ] as { id: SttStrictnessMode; label: string }[]
                      ).map(st => {
                        const active = (settings.sttStrictness ?? 'balanced') === st.id;
                        return (
                          <button
                            key={st.id}
                            id={`btnSttStrictness_${st.id}`}
                            type="button"
                            onClick={() => {
                              onUpdateSettings({ sttStrictness: st.id });
                              onShowToast(`🎯 Rigor fonético: ${st.label}`);
                            }}
                            className={`min-h-[38px] sm:min-h-0 py-1.5 px-2 rounded-md text-[10px] font-bold border cursor-pointer transition ${
                              active
                                ? 'bg-purple-600 text-white border-purple-400'
                                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-purple-500/40'
                            }`}
                          >
                            {st.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <label className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          id="cfgEnableAiPronunciationCoach"
                          checked={settings.enableAiPronunciationCoach ?? true}
                          onChange={e => {
                            onUpdateSettings({ enableAiPronunciationCoach: e.target.checked });
                            onShowToast(
                              e.target.checked
                                ? '🎯 Coach Fonético de IA ativado após cada fala!'
                                : 'Coach Fonético de IA desativado.'
                            );
                          }}
                          className="rounded border-slate-700 bg-slate-800 text-emerald-500 shrink-0"
                        />
                        <span className="truncate">🎯 Coach Fonético IA</span>
                      </label>
                      <label className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          id="cfgMicNoiseSuppression"
                          checked={settings.micNoiseSuppression ?? true}
                          onChange={e => {
                            onUpdateSettings({ micNoiseSuppression: e.target.checked });
                            onShowToast(
                              e.target.checked
                                ? '🎙️ Filtro de ruído e eco ativado no microfone!'
                                : 'Filtro de ruído desativado.'
                            );
                          }}
                          className="rounded border-slate-700 bg-slate-800 text-brand-500 shrink-0"
                        />
                        <span className="truncate">🎙️ Anti-Ruído & Eco</span>
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-0.5 text-[9px] text-slate-400">
                      <span>
                        Nota mínima ativa: <strong className="text-emerald-300">{settings.threshold}%</strong>
                      </span>
                      <button
                        id="btnGoToRulesFromSttHub"
                        type="button"
                        onClick={() => setActiveTab('voice_theme')}
                        className="text-indigo-300 hover:text-indigo-200 font-semibold underline cursor-pointer"
                      >
                        Ajustar Velocidade & Tolerância →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VOICE, RULES & THEME */}
          {activeTab === 'voice_theme' && (
            <div id="tabPanelVoiceTheme" className="space-y-3">
              {/* Synced Banner with Central de Voz e IA */}
              <div
                id="voiceRulesSyncBanner"
                className="flex items-center gap-2 bg-slate-950/85 border border-indigo-500/30 rounded-xl px-2.5 py-1 overflow-hidden"
              >
                <span className="font-bold text-indigo-200 text-[10px] shrink-0">
                  🎙️ Conectado à Central:
                </span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar whitespace-nowrap text-[10px]">
                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-brand-500/15 border border-brand-500/35 text-brand-200 font-semibold">
                    🔊 {voiceCompat.ttsEngineLabel} · {voiceCompat.ttsVoiceDetail}
                  </span>
                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 font-semibold">
                    🎤 {voiceCompat.sttProviderLabel} · Rigor {voiceCompat.sttStrictnessLabel}
                  </span>
                </div>
                <button
                  id="btnGoToVoiceAiHubFromRules"
                  type="button"
                  onClick={() => setActiveTab('voice_ai_hub')}
                  className="px-2 py-0.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 border border-indigo-400/40 text-indigo-100 text-[10px] font-bold cursor-pointer transition shrink-0 whitespace-nowrap"
                >
                  🎙️ Central de Voz & IA →
                </button>
              </div>

              {/* Rules & Speeds side-by-side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Error/Challenge Rules */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2 flex flex-col justify-between">
                  {/* Error & Challenge Rules */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="block font-bold text-slate-200 text-[11px] uppercase tracking-wider">
                        1. Regras de Ajuda & Desafios
                      </span>
                    </div>

                    <div
                      id="cfgBlindMaxErrorsBox"
                      className="p-2 rounded-lg bg-teal-950/25 border border-teal-500/30 space-y-2"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold text-teal-200 leading-tight">
                            🧠 Falar Sem Inglês: revelar texto após errar
                          </span>
                          <span
                            id="cfgBlindMaxErrorsDisplay"
                            className="text-[10px] font-mono font-bold text-teal-300 bg-teal-500/15 px-1.5 py-0.5 rounded border border-teal-500/30 shrink-0"
                          >
                            {(settings.blindMaxErrorsBeforeReveal ?? 2) === 0
                              ? 'Nunca'
                              : `${settings.blindMaxErrorsBeforeReveal ?? 2} ${(settings.blindMaxErrorsBeforeReveal ?? 2) === 1 ? 'erro' : 'erros'}`}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Se você esquecer a frase na etapa sem ler, o inglês volta a aparecer após:
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-1">
                          {BLIND_MAX_ERROR_OPTIONS.map(opt => {
                            const currentVal = settings.blindMaxErrorsBeforeReveal ?? 2;
                            const isSelected = currentVal === opt.value;
                            return (
                              <button
                                key={`voice-blind-err-${opt.value}`}
                                id={`btnBlindMaxErrors_${opt.value}`}
                                type="button"
                                onClick={() => {
                                  onUpdateSettings({ blindMaxErrorsBeforeReveal: opt.value });
                                  onShowToast(
                                    opt.value === 0
                                      ? '🧠 Falar Sem Inglês: texto nunca será revelado automaticamente.'
                                      : `🧠 Falar Sem Inglês: texto será revelado após ${opt.label}.`
                                  );
                                }}
                                className={`min-h-[38px] sm:min-h-0 py-1.5 sm:py-1 rounded-md text-[10px] font-bold border transition cursor-pointer text-center ${
                                  isSelected
                                    ? 'bg-teal-600 text-white border-teal-400 shadow-xs'
                                    : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-teal-500/50 hover:text-white'
                                }`}
                              >
                                {opt.shortLabel}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div
                        id="cfgBlindSpeakingOnFullSentenceBox"
                        className="pt-2 border-t border-teal-500/25 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold text-teal-200 leading-tight">
                            🧠 Falar Sem Inglês na Sentença Completa
                          </span>
                          <span
                            id="cfgBlindFullSentenceDisplay"
                            className="text-[10px] font-mono font-bold text-teal-300 bg-teal-500/15 px-1.5 py-0.5 rounded border border-teal-500/30 shrink-0"
                          >
                            {(settings.blindSpeakingOnFullSentence ?? true)
                              ? 'Ativado'
                              : 'Só Em Partes'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          {(settings.blindSpeakingOnFullSentence ?? true)
                            ? 'Aparece no modo "Em Partes" e também no "Desafio Final: Frase Inteira".'
                            : 'Aparece apenas no modo "Em Partes" (nas partes divididas da frase).'}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            id="btnBlindFullSentence_false"
                            type="button"
                            onClick={() => {
                              onUpdateSettings({ blindSpeakingOnFullSentence: false });
                              onShowToast(
                                '🧠 Falar Sem Inglês: aparecerá apenas no modo "Em Partes" (desativado na frase inteira).'
                              );
                            }}
                            className={`py-1.5 px-2 rounded-md text-[10px] font-bold border transition cursor-pointer text-center ${
                              (settings.blindSpeakingOnFullSentence ?? true) === false
                                ? 'bg-teal-600 text-white border-teal-400 shadow-xs'
                                : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-teal-500/50 hover:text-white'
                            }`}
                          >
                            ✂️ Apenas "Em Partes"
                          </button>
                          <button
                            id="btnBlindFullSentence_true"
                            type="button"
                            onClick={() => {
                              onUpdateSettings({ blindSpeakingOnFullSentence: true });
                              onShowToast(
                                '🧠 Falar Sem Inglês: ativado também no "Desafio Final: Frase Inteira"!'
                              );
                            }}
                            className={`py-1.5 px-2 rounded-md text-[10px] font-bold border transition cursor-pointer text-center ${
                              (settings.blindSpeakingOnFullSentence ?? true) === true
                                ? 'bg-teal-600 text-white border-teal-400 shadow-xs'
                                : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-teal-500/50 hover:text-white'
                            }`}
                          >
                            🏁 Também na Frase Inteira
                          </button>
                        </div>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        id="cfgRepeatSentenceOnChallengeFail"
                        checked={settings.repeatSentenceOnChallengeFail}
                        onChange={e =>
                          onUpdateSettings({ repeatSentenceOnChallengeFail: e.target.checked })
                        }
                        className="rounded border-slate-700 bg-slate-800 text-amber-500 shrink-0"
                      />
                      <span className="text-[11px] leading-tight">
                        Repetir frase se errar 3+ vezes na etapa de Desafio
                        {!hasChallengeStepInSeq ? ' (quando incluída)' : ''}
                      </span>
                    </label>
                    <label className="flex items-start gap-2 p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        id="cfgRepeatOnError"
                        checked={settings.repeatOnError}
                        onChange={e => onUpdateSettings({ repeatOnError: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-800 text-brand-600 shrink-0 mt-0.5"
                      />
                      <span className="text-[11px] leading-tight">
                        Repetir áudio de apoio ao errar a pronúncia
                        <span className="block text-[9px] text-slate-400 mt-0.5">
                          No modo "Falar Sem Inglês", toca PT enquanto oculto e a voz EN conectada ao revelar.
                        </span>
                      </span>
                    </label>
                    <label
                      className={`flex items-start gap-2 p-1.5 rounded-lg border transition ${
                        voiceCompat.isSlowdownRelevant
                          ? 'bg-slate-900/70 border-slate-800 text-slate-300 cursor-pointer'
                          : 'bg-slate-900/35 border-slate-800/50 text-slate-500 opacity-65 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        id="cfgSlowdownOnError"
                        disabled={!voiceCompat.isSlowdownRelevant}
                        checked={settings.slowdownOnError}
                        onChange={e => onUpdateSettings({ slowdownOnError: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-800 text-brand-600 shrink-0 mt-0.5 disabled:cursor-not-allowed"
                      />
                      <span className="text-[11px] leading-tight">
                        Reduzir velocidade em -15% na repetição de erro
                        <span
                          id="cfgSlowdownEffectiveHint"
                          className="block text-[9px] text-slate-400 mt-0.5"
                        >
                          {voiceCompat.isSlowdownRelevant
                            ? `Velocidade no erro com ${voiceCompat.ttsEngine === 'gemini_tts' ? 'Gemini Neural' : 'voz ativa'}: ${voiceCompat.effectiveErrorRetryEnRate}x`
                            : 'Ative "Repetir áudio de apoio" acima para usar redução no erro.'}
                        </span>
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <label className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          id="cfgAudioBeeps"
                          checked={settings.audioBeeps}
                          onChange={e => onUpdateSettings({ audioBeeps: e.target.checked })}
                          className="rounded border-slate-700 bg-slate-800 text-brand-600 shrink-0"
                        />
                        <span className="text-[10px] leading-tight">Bips sonoros</span>
                      </label>
                      <label
                        className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition ${
                          settings.autoHandsFree
                            ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200 font-semibold'
                            : 'bg-slate-900/70 border-slate-800 text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          id="cfgAutoHandsFree"
                          checked={settings.autoHandsFree}
                          onChange={e => {
                            const nextVal = e.target.checked;
                            onUpdateSettings({ autoHandsFree: nextVal });
                            onShowToast(
                              nextVal
                                ? '🙌 Modo Mãos Livres ativado! Todo o ciclo (incluindo desafios) rodará sem precisar tocar na tela.'
                                : 'Modo Mãos Livres desativado.'
                            );
                          }}
                          className="rounded border-slate-700 bg-slate-800 text-emerald-500 shrink-0"
                        />
                        <span className="text-[10px] leading-tight">🙌 Mãos Livres (100%)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Speeds & Threshold Sliders */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-3">
                  <label className="block font-bold text-slate-200 text-[11px] uppercase tracking-wider">
                    2. Velocidades, Rigor & Mãos Livres
                  </label>

                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <label
                        htmlFor="cfgSpeedEnSlider"
                        className="text-[11px] font-medium text-slate-300"
                      >
                        Velocidade do Inglês
                      </label>
                      <span
                        id="cfgSpeedEnDisplay"
                        className="font-mono text-[11px] text-brand-400 font-bold tabular-nums"
                      >
                        {settings.ttsSpeedEn}x ({speedEnLabel})
                      </span>
                    </div>
                    <input
                      type="range"
                      id="cfgSpeedEnSlider"
                      min="0.65"
                      max="1.20"
                      step="0.05"
                      value={settings.ttsSpeedEn}
                      onChange={e => onUpdateSettings({ ttsSpeedEn: parseFloat(e.target.value) })}
                      className="w-full h-1.5 accent-brand-500 cursor-pointer"
                    />
                    {voiceCompat.usesGeminiTts && (
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Com estilo Gemini atual ({voiceCompat.ttsVoiceDetail.split('·')[1]?.trim() || 'Neural'}): ritmo efetivo de <span className="text-brand-300 font-mono font-semibold">{voiceCompat.effectiveNormalEnRate}x</span>.
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <label
                        htmlFor="cfgSpeedPtSlider"
                        className="text-[11px] font-medium text-slate-300"
                      >
                        Velocidade do Português
                      </label>
                      <span
                        id="cfgSpeedPtDisplay"
                        className="font-mono text-[11px] text-indigo-400 font-bold tabular-nums"
                      >
                        {settings.ttsSpeedPt}x ({speedPtLabel})
                      </span>
                    </div>
                    <input
                      type="range"
                      id="cfgSpeedPtSlider"
                      min="0.80"
                      max="1.40"
                      step="0.05"
                      value={settings.ttsSpeedPt}
                      onChange={e => onUpdateSettings({ ttsSpeedPt: parseFloat(e.target.value) })}
                      className="w-full h-1.5 accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  <div className="pt-1.5 border-t border-slate-800/70">
                    <div className="flex justify-between items-center mb-0.5">
                      <label
                        htmlFor="cfgThresholdSlider"
                        className="text-[11px] font-medium text-slate-300"
                      >
                        Tolerância de Precisão
                      </label>
                      <span
                        id="cfgThresholdDisplay"
                        className="font-mono text-[11px] text-emerald-400 font-bold tabular-nums"
                      >
                        {settings.threshold}% ({thresholdLabel})
                      </span>
                    </div>
                    <input
                      type="range"
                      id="cfgThresholdSlider"
                      min="50"
                      max="95"
                      step="5"
                      value={settings.threshold}
                      onChange={e =>
                        onUpdateSettings({ threshold: parseInt(e.target.value, 10) })
                      }
                      className="w-full h-1.5 accent-emerald-500 cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      Motor STT: <span className="text-emerald-300 font-semibold">{voiceCompat.sttProviderLabel}</span> · Rigor Fonético: <span className="text-purple-300 font-semibold">{voiceCompat.sttStrictnessLabel}</span>.
                    </p>
                  </div>

                  {/* Expanded Hands-Free Automation Panel */}
                  <div
                    id="cfgHandsFreeExpandedBox"
                    className={`p-2 rounded-lg border transition space-y-1.5 ${
                      settings.autoHandsFree
                        ? 'bg-emerald-950/35 border-emerald-500/45'
                        : 'bg-slate-900/60 border-slate-800/80 opacity-85'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                        🙌 Automação Mãos Livres (Ciclo Completo)
                      </span>
                      <button
                        id="btnToggleHandsFreeInPanel"
                        type="button"
                        onClick={() => {
                          const nextVal = !settings.autoHandsFree;
                          onUpdateSettings({ autoHandsFree: nextVal });
                          onShowToast(
                            nextVal
                              ? '🙌 Modo Mãos Livres ativado! Ciclo 100% automático por voz.'
                              : 'Modo Mãos Livres desativado.'
                          );
                        }}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold border cursor-pointer transition ${
                          settings.autoHandsFree
                            ? 'bg-emerald-600 text-white border-emerald-400'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        {settings.autoHandsFree ? 'ATIVO' : 'ATIVAR'}
                      </button>
                    </div>

                    <p className="text-[9px] text-slate-400 leading-tight">
                      Executa escuta, fala, partes, desafios pós-sentença e avanço de frases sem tocar na tela.
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[10px] text-slate-300 font-medium">
                        Tentativas antes de avançar:
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4].map(att => {
                          const curAtt = settings.handsFreeMaxAttempts ?? 2;
                          const active = curAtt === att;
                          return (
                            <button
                              key={`hf-att-${att}`}
                              id={`btnHandsFreeAttempts_${att}`}
                              type="button"
                              onClick={() => {
                                onUpdateSettings({
                                  autoHandsFree: true,
                                  handsFreeMaxAttempts: att
                                });
                                onShowToast(
                                  `🙌 Mãos Livres: avança automaticamente após ${att} tentativa(s).`
                                );
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition ${
                                active
                                  ? 'bg-emerald-600 text-white border-emerald-400'
                                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-500/40'
                              }`}
                            >
                              {att}x
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1 pt-0.5">
                      <span className="text-[10px] text-slate-300 font-medium block">
                        Desafios Pós-Sentença no Mãos Livres:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-1">
                        {(
                          [
                            { id: 'voice_all', label: '🎤 Tudo por Voz', desc: 'Pronúncia + Associação falada' },
                            { id: 'pronunciation_only', label: '🎙️ Só Pronúncia', desc: 'Apenas pronúncia das palavras' },
                            { id: 'auto_review', label: '🔊 Revisão Áudio', desc: 'Ouve os pares e avança' }
                          ] as { id: HandsFreeChallengeMode; label: string; desc: string }[]
                        ).map(modeOpt => {
                          const curMode = settings.handsFreeChallengeMode ?? 'voice_all';
                          const isSel = curMode === modeOpt.id;
                          return (
                            <button
                              key={modeOpt.id}
                              id={`btnHandsFreeChallenge_${modeOpt.id}`}
                              type="button"
                              title={modeOpt.desc}
                              onClick={() => {
                                onUpdateSettings({
                                  autoHandsFree: true,
                                  handsFreeChallengeMode: modeOpt.id
                                });
                                onShowToast(`🙌 Desafios no Mãos Livres: ${modeOpt.label}`);
                              }}
                              className={`min-h-[38px] sm:min-h-0 py-1.5 sm:py-1 px-2 sm:px-1.5 rounded text-[10px] sm:text-[9px] font-bold border cursor-pointer transition text-center leading-tight ${
                                isSel
                                  ? 'bg-emerald-600 text-white border-emerald-400'
                                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-500/40'
                              }`}
                            >
                              {modeOpt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1 pt-0.5">
                      <label
                        className="flex items-center gap-1.5 text-[9px] text-slate-300 cursor-pointer"
                        title='Diga "pular", "repetir" ou "pausar treino" durante a escuta do microfone'
                      >
                        <input
                          type="checkbox"
                          id="cfgHandsFreeVoiceCommands"
                          checked={settings.handsFreeVoiceCommands ?? true}
                          onChange={e =>
                            onUpdateSettings({
                              autoHandsFree: true,
                              handsFreeVoiceCommands: e.target.checked
                            })
                          }
                          className="rounded border-slate-700 bg-slate-800 text-emerald-500 shrink-0"
                        />
                        <span className="truncate">🗣️ Voz ("pular", "repetir")</span>
                      </label>
                      <span
                        className="flex items-center gap-1 text-[9px] text-emerald-300/90 font-medium"
                        title="O treino só começa quando você clica no botão Iniciar Treino"
                      >
                        ▶️ Inicia apenas no botão "Iniciar Treino"
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Theme Selector */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                <label className="block font-bold text-slate-200 text-[11px] uppercase tracking-wider">
                  3. Tema Visual de Leitura
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {THEME_OPTIONS.map(opt => {
                    const active = settings.themeMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        id={`cfgTheme_${opt.id}`}
                        onClick={() => handleThemeSelect(opt.id, opt.label)}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold border transition cursor-pointer ${
                          active
                            ? 'bg-brand-500/20 border-brand-500 text-brand-300 ring-1 ring-brand-500/50'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-brand-400/50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Global App Text Size Customizer */}
              <div
                id="cfgGlobalFontSizeBox"
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label
                      htmlFor="cfgFontSizeSlider"
                      className="block font-bold text-slate-200 text-[11px] uppercase tracking-wider"
                    >
                      4. Tamanho do Texto de Todo o App
                    </label>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      Escala imediatamente frases, traduções, botões, dicionário e menus em todo o
                      aplicativo.
                    </p>
                  </div>
                  <span
                    id="cfgFontScaleDisplay"
                    className="font-mono text-[11px] font-bold text-brand-300 bg-brand-500/15 px-2 py-0.5 rounded-md border border-brand-500/30 tabular-nums shrink-0"
                  >
                    {activeFontScale}% ({fontScaleLabel})
                  </span>
                </div>

                {/* Preset Size Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {[
                    { value: 95, label: '95% Compacto' },
                    { value: 100, label: '100% Original' },
                    { value: 110, label: '110% Padrão' },
                    { value: 120, label: '120% Grande' },
                    { value: 130, label: '130% Extra' }
                  ].map((preset, idx) => {
                    const isActive = activeFontScale === preset.value;
                    return (
                      <button
                        key={preset.value}
                        id={`btnFontScale_${preset.value}`}
                        type="button"
                        onClick={() => handleFontScaleChange(preset.value)}
                        className={`min-h-[40px] sm:min-h-0 px-2 py-1.5 rounded-lg text-[10px] font-semibold border transition cursor-pointer whitespace-nowrap ${
                          idx === 4 ? 'col-span-2 sm:col-span-1' : ''
                        } ${
                          isActive
                            ? 'bg-brand-600 text-white border-brand-400 shadow-xs'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-brand-400/50 hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Fine Slider + Step Buttons */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    id="btnFontScaleMinus"
                    type="button"
                    disabled={activeFontScale <= 85}
                    onClick={() => handleFontScaleChange(activeFontScale - 5)}
                    title="Diminuir tamanho do texto em 5%"
                    aria-label="Diminuir tamanho do texto"
                    className="min-w-[44px] min-h-[40px] sm:min-h-0 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-35 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer disabled:cursor-not-allowed shrink-0 flex items-center justify-center"
                  >
                    A-
                  </button>
                  <input
                    type="range"
                    id="cfgFontSizeSlider"
                    min="85"
                    max="135"
                    step="5"
                    value={activeFontScale}
                    onChange={e => handleFontScaleChange(parseInt(e.target.value, 10), true)}
                    className="flex-1 h-2 accent-brand-500 cursor-pointer"
                  />
                  <button
                    id="btnFontScalePlus"
                    type="button"
                    disabled={activeFontScale >= 135}
                    onClick={() => handleFontScaleChange(activeFontScale + 5)}
                    title="Aumentar tamanho do texto em 5%"
                    aria-label="Aumentar tamanho do texto"
                    className="min-w-[44px] min-h-[40px] sm:min-h-0 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-35 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer disabled:cursor-not-allowed shrink-0 flex items-center justify-center"
                  >
                    A+
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              id="btnResetDefaultSettings"
              type="button"
              onClick={() => {
                onUpdateSettings({
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
                  fontSizeScale: 110
                });
                onShowToast(
                  'Configurações e ordem das etapas restauradas para o padrão recomendado!'
                );
              }}
              className="min-h-[42px] sm:min-h-0 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition cursor-pointer"
            >
              Restaurar Padrões
            </button>
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              Atalhos: Espaço (Treino) · R (EN) · T (PT) · M (Falar)
            </span>
          </div>

          <button
            id="btnSaveAndCloseSettings"
            type="button"
            onClick={onClose}
            className="min-h-[42px] sm:min-h-0 px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs cursor-pointer whitespace-nowrap shadow-md shadow-brand-500/20"
          >
            Salvar e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
