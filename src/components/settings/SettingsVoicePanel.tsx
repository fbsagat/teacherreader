import React from 'react';
import {
  GeminiVoiceName,
  GeminiVoiceStyle,
  PedagogicalSettings,
  SttProvider,
  SttSilencePauseMode,
  SttStrictnessMode,
  TtsEngine
} from '../../types/shadowreader';
import {
  SystemVoiceOption,
  VoiceHubProviderStatus
} from '../../services/audioAndTranslationService';
import { VoiceCompatibilitySummary } from '../../utils/voiceCompatibility';
import {
  SettingsSection,
  SettingsSegmented,
  SettingsToggle
} from './SettingsPrimitives';

interface SettingsVoicePanelProps {
  settings: PedagogicalSettings;
  voiceCompat: VoiceCompatibilitySummary;
  providerStatus: VoiceHubProviderStatus;
  cachedAudioCount: number;
  enVoices: SystemVoiceOption[];
  ptVoices: SystemVoiceOption[];
  testingSampleLang: 'en' | 'pt' | null;
  onTestVoiceSample: (lang: 'en' | 'pt') => void;
  onEngineChange: (engine: TtsEngine) => void;
  onSttProviderChange: (provider: SttProvider) => void;
  onUpdateSettings: (partial: Partial<PedagogicalSettings>) => void;
  onShowToast: (msg: string) => void;
  onClearCache: () => void;
  onGoToRules: () => void;
}

const TTS_PROVIDER_OPTIONS: {
  id: TtsEngine;
  title: string;
  badge: string;
  subtitle: string;
  icon: string;
}[] = [
  {
    id: 'gemini_tts',
    title: 'Gemini Neural (Estúdio EUA)',
    badge: 'IA Neural',
    subtitle: 'Vozes americanas ultra-naturais: Kore, Puck, Charon, Fenrir e Zephyr.',
    icon: '✨'
  },
  {
    id: 'auto',
    title: 'Híbrido (Nativo + Nuvem)',
    badge: 'Zero latência',
    subtitle: 'Usa a melhor voz do seu aparelho e recorre à nuvem quando necessário.',
    icon: '⚡'
  },
  {
    id: 'browser_custom',
    title: 'Voz do dispositivo',
    badge: 'Offline',
    subtitle: 'Fixa exatamente qual voz instalada no aparelho usar em EN e PT.',
    icon: '🖥️'
  },
  {
    id: 'online',
    title: 'Google Tradutor (GTX)',
    badge: 'Universal',
    subtitle: 'Streaming leve e gratuito, compatível com qualquer navegador ou celular.',
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
    subtitle: 'Reconhecimento em tempo real + diagnóstico fonético da gravação.',
    icon: '🧠'
  },
  {
    id: 'web_speech',
    title: 'Web Speech nativo',
    badge: 'Instantâneo',
    subtitle: 'Transcrição contínua gratuita, com acumulador anti-corte.',
    icon: '⚡'
  },
  {
    id: 'gemini_stt',
    title: 'Gemini Audio Coach',
    badge: 'Multimodal',
    subtitle: 'Ouve o áudio real da sua voz e avalia pronúncia, ritmo e fonemas.',
    icon: '✨'
  }
];

const GEMINI_VOICE_OPTIONS: { id: GeminiVoiceName; label: string }[] = [
  { id: 'Kore', label: 'Kore ♀' },
  { id: 'Puck', label: 'Puck ♂' },
  { id: 'Charon', label: 'Charon ♂' },
  { id: 'Fenrir', label: 'Fenrir ♂' },
  { id: 'Zephyr', label: 'Zephyr ♀' }
];

const GEMINI_STYLE_OPTIONS: { id: GeminiVoiceStyle; label: string }[] = [
  { id: 'clear_teacher', label: '👩‍🏫 Professor claro' },
  { id: 'audiobook', label: '📖 Narrador' },
  { id: 'conversational', label: '💬 Conversa EUA' },
  { id: 'slow_learner', label: '🐢 Articulado calmo' }
];

const STT_PAUSE_OPTIONS: { id: SttSilencePauseMode; label: string; hint: string }[] = [
  { id: 'short', label: '⚡ Rápido', hint: 'Encerra a fala após ~1,6s de silêncio.' },
  { id: 'normal', label: '⚖️ Normal', hint: 'Encerra a fala após ~2,5s de silêncio.' },
  { id: 'long', label: '🧘 Calmo', hint: 'Encerra a fala após ~4,0s de silêncio.' }
];

const STT_STRICTNESS_OPTIONS: { id: SttStrictnessMode; label: string }[] = [
  { id: 'forgiving', label: '🌱 Tolerante' },
  { id: 'balanced', label: '🎯 Equilibrado' },
  { id: 'strict', label: '🦅 Rigoroso' }
];

/**
 * Tab 3 — engines that read for the user (TTS) and that listen to the user
 * (STT). Calibration controls live behind "Avançado" so the common task
 * (pick a voice and hear it) stays on top.
 */
export const SettingsVoicePanel: React.FC<SettingsVoicePanelProps> = ({
  settings,
  voiceCompat,
  providerStatus,
  cachedAudioCount,
  enVoices,
  ptVoices,
  testingSampleLang,
  onTestVoiceSample,
  onEngineChange,
  onSttProviderChange,
  onUpdateSettings,
  onShowToast,
  onClearCache,
  onGoToRules
}) => {
  const cooldowns = providerStatus.cooldowns;
  const geminiTtsCooldownEndsAt =
    cooldowns?.geminiTtsUntil && cooldowns.geminiTtsUntil > (cooldowns.serverNow ?? 0)
      ? cooldowns.geminiTtsUntil
      : null;
  const geminiTtsCooldownLabel = geminiTtsCooldownEndsAt
    ? new Date(geminiTtsCooldownEndsAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  const currentStt = settings.sttProvider ?? 'hybrid_ai';

  return (
    <div className="space-y-3">
      {/* Status + cache bar */}
      <div
        id="voiceHubStatusBanner"
        className="flex flex-wrap items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5"
      >
        <span className="text-[10px] font-bold text-slate-300 shrink-0">Motores:</span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar whitespace-nowrap">
          <span
            className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-bold ${
              !providerStatus.gemini
                ? 'bg-slate-900 border-slate-800 text-slate-400'
                : geminiTtsCooldownLabel
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-brand-500/15 border-brand-500/40 text-brand-200'
            }`}
            title={
              geminiTtsCooldownLabel
                ? 'Cota gratuita do Gemini esgotada; o app usa a voz neural do TikTok e o Google Tradutor até a cota renovar.'
                : 'Gemini disponível para TTS e Coach Fonético'
            }
          >
            ✨ Gemini {!providerStatus.gemini ? '· sem chave' : geminiTtsCooldownLabel ? '· em pausa' : '· ativo'}
          </span>
          {geminiTtsCooldownLabel && (
            <span
              id="geminiTtsCooldownBadge"
              className="shrink-0 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-[10px] font-semibold"
            >
              ⏸️ TTS do Gemini em pausa até {geminiTtsCooldownLabel}
            </span>
          )}
          <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-bold">
            ✓ Vozes do sistema ({enVoices.length} EN · {ptVoices.length} PT)
          </span>
          <span className="shrink-0 px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/35 text-sky-200 text-[10px] font-semibold">
            ☁️ Google Tradutor · grátis
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-300 cursor-pointer whitespace-nowrap min-h-[30px]">
            <input
              type="checkbox"
              id="cfgTtsCacheEnabled"
              checked={settings.ttsCacheEnabled ?? true}
              onChange={event => {
                onUpdateSettings({ ttsCacheEnabled: event.target.checked });
                onShowToast(
                  event.target.checked
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
            onClick={onClearCache}
            className="min-h-[30px] px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-300 hover:text-white transition cursor-pointer whitespace-nowrap"
          >
            🧹 Limpar
          </button>
        </div>
      </div>

      {/* TTS */}
      <SettingsSection
        title="Voz que lê para você"
        icon="🔊"
        hint="Motor usado para ler as frases em inglês (EUA) e em português."
        aside={
          <div className="flex items-center gap-1.5">
            <button
              id="btnTestVoiceSampleEn"
              type="button"
              onClick={() => onTestVoiceSample('en')}
              className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                testingSampleLang === 'en'
                  ? 'bg-rose-600 text-white border-rose-400'
                  : 'bg-brand-600/25 hover:bg-brand-600/40 text-brand-200 border-brand-500/40'
              }`}
            >
              <span aria-hidden="true">{testingSampleLang === 'en' ? '⏹' : '🔊'}</span>
              <span>{testingSampleLang === 'en' ? 'Parar EN' : 'Ouvir EN'}</span>
            </button>
            <button
              id="btnTestVoiceSamplePt"
              type="button"
              onClick={() => onTestVoiceSample('pt')}
              className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                testingSampleLang === 'pt'
                  ? 'bg-rose-600 text-white border-rose-400'
                  : 'bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border-indigo-500/40'
              }`}
            >
              <span aria-hidden="true">{testingSampleLang === 'pt' ? '⏹' : '🔊'}</span>
              <span>{testingSampleLang === 'pt' ? 'Parar PT' : 'Ouvir PT'}</span>
            </button>
          </div>
        }
      >
        <div role="radiogroup" aria-label="Motores de voz (TTS)" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TTS_PROVIDER_OPTIONS.map(option => {
            const isSelected = settings.ttsEngine === option.id;
            return (
              <button
                key={option.id}
                id={`btnTtsProvider_${option.id}`}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => {
                  onEngineChange(option.id);
                  onShowToast(`🔊 Motor de voz alterado para: ${option.title}`);
                }}
                className={`text-left p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                  isSelected
                    ? 'bg-brand-600/20 border-brand-400 ring-1 ring-brand-400/50 shadow-sm'
                    : 'bg-slate-900/80 border-slate-800 hover:border-brand-500/40'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className="font-bold text-slate-100 text-[11px] flex items-center gap-1.5 leading-snug text-left">
                    <span aria-hidden="true" className="shrink-0">
                      {option.icon}
                    </span>
                    <span>{option.title}</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-200 border border-brand-400/30 font-bold shrink-0">
                    {isSelected ? '✓ ' : ''}
                    {option.badge}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">{option.subtitle}</p>
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Gemini persona */}
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
                ✨ Timbre & estilo (Gemini)
              </span>
              {voiceCompat.usesGeminiTts ? (
                <span className="px-1.5 py-0.5 rounded bg-brand-500/20 border border-brand-400/40 text-brand-200 text-[9px] font-bold">
                  ★ Ativo agora
                </span>
              ) : (
                <button
                  id="btnQuickUseGeminiTts"
                  type="button"
                  onClick={() => {
                    onEngineChange('gemini_tts');
                    onShowToast('🔊 Motor de voz: Gemini Neural (Estúdio EUA)');
                  }}
                  className="px-1.5 py-0.5 rounded bg-brand-500/15 hover:bg-brand-500/30 border border-brand-400/35 text-brand-200 text-[9px] font-bold cursor-pointer transition"
                >
                  Ativar Gemini
                </button>
              )}
            </div>

            <span className="text-[10px] text-slate-300 block">Voz neural (EN-US & PT-BR):</span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
              {GEMINI_VOICE_OPTIONS.map(voice => {
                const active = (settings.geminiVoiceName ?? 'Kore') === voice.id;
                return (
                  <button
                    key={voice.id}
                    id={`btnGeminiVoice_${voice.id}`}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onUpdateSettings({ geminiVoiceName: voice.id });
                      onShowToast(
                        voiceCompat.usesGeminiTts
                          ? `✨ Voz Gemini selecionada: ${voice.id}`
                          : `✨ Voz Gemini salva (${voice.id}) — ative o Gemini para usá-la.`
                      );
                    }}
                    className={`min-h-[34px] px-1.5 rounded-md text-[10px] font-bold border cursor-pointer transition truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                      active
                        ? 'bg-brand-600 text-white border-brand-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-brand-500/40'
                    }`}
                  >
                    {voice.label}
                  </button>
                );
              })}
            </div>

            <span className="text-[10px] text-slate-300 block pt-0.5">
              Estilo de locução (nos EUA):
            </span>
            <SettingsSegmented
              idPrefix="btnGeminiStyle"
              value={settings.geminiVoiceStyle ?? 'clear_teacher'}
              columns={2}
              tone="indigo"
              onChange={next => {
                onUpdateSettings({ geminiVoiceStyle: next });
                const found = GEMINI_STYLE_OPTIONS.find(option => option.id === next);
                onShowToast(`✨ Estilo de voz: ${found ? found.label : next}`);
              }}
              options={GEMINI_STYLE_OPTIONS}
            />
          </div>

          {/* System voices */}
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
                🖥️ Voz nativa do aparelho
              </span>
              {voiceCompat.usesSystemVoicePicker ? (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[9px] font-bold">
                  ★ Ativo agora
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[9px] font-semibold">
                  🛡️ Reserva local
                </span>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="selectSystemVoiceEn" className="text-[10px] text-slate-300 block">
                🇺🇸 Voz preferida em inglês:
              </label>
              <select
                id="selectSystemVoiceEn"
                value={settings.preferredVoiceEnUri || ''}
                onChange={event => {
                  onUpdateSettings({ preferredVoiceEnUri: event.target.value });
                  const picked = enVoices.find(voice => voice.voiceURI === event.target.value);
                  onShowToast(
                    picked
                      ? `🇺🇸 Voz em inglês fixada: ${picked.name} (${picked.lang})`
                      : '🇺🇸 Seleção automática da melhor voz em inglês.'
                  );
                }}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 sm:py-1 text-base sm:text-[10px] text-slate-100 focus:border-brand-500 focus:outline-none"
              >
                <option value="">⚡ Automática (melhor voz disponível)</option>
                {enVoices.map(voice => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.isNaturalOrNeural ? '★ ' : ''}
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="selectSystemVoicePt" className="text-[10px] text-slate-300 block">
                🇧🇷 Voz preferida em português:
              </label>
              <select
                id="selectSystemVoicePt"
                value={settings.preferredVoicePtUri || ''}
                onChange={event => {
                  onUpdateSettings({ preferredVoicePtUri: event.target.value });
                  const picked = ptVoices.find(voice => voice.voiceURI === event.target.value);
                  onShowToast(
                    picked
                      ? `🇧🇷 Voz em português fixada: ${picked.name} (${picked.lang})`
                      : '🇧🇷 Seleção automática da melhor voz em português.'
                  );
                }}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 sm:py-1 text-base sm:text-[10px] text-slate-100 focus:border-brand-500 focus:outline-none"
              >
                <option value="">⚡ Automática (melhor voz disponível)</option>
                {ptVoices.map(voice => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.isNaturalOrNeural ? '★ ' : ''}
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* STT */}
      <SettingsSection
        title="Escuta e avaliação da sua fala"
        icon="🎤"
        hint="Como o microfone captura, transcreve e corrige a sua pronúncia."
      >
        <div role="radiogroup" aria-label="Motores de reconhecimento de voz (STT)" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {STT_PROVIDER_OPTIONS.map(option => {
            const isSelected = currentStt === option.id;
            return (
              <button
                key={option.id}
                id={`btnSttProvider_${option.id}`}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => {
                  onSttProviderChange(option.id);
                  onShowToast(`🎙️ Reconhecimento de voz: ${option.title}`);
                }}
                className={`text-left p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  isSelected
                    ? 'bg-emerald-600/20 border-emerald-400 ring-1 ring-emerald-400/50 shadow-sm'
                    : 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/40'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className="font-bold text-slate-100 text-[11px] flex items-center gap-1.5 leading-snug text-left">
                    <span aria-hidden="true" className="shrink-0">
                      {option.icon}
                    </span>
                    <span>{option.title}</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-bold shrink-0">
                    {isSelected ? '✓ ' : ''}
                    {option.badge}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">{option.subtitle}</p>
              </button>
            );
          })}
        </div>

        <details className="rounded-lg bg-slate-900/60 border border-slate-800">
          <summary className="cursor-pointer select-none px-2.5 py-2 text-[10px] font-bold text-slate-300 hover:text-white">
            ⚙️ Avançado: calibração do microfone
          </summary>
          <div className="px-2.5 pb-2.5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                ⏱️ Tempo de pausa
              </span>
              <p className="text-[9px] text-slate-400 leading-tight">
                Evita que o microfone encerre a fala cedo quando você respira na vírgula.
              </p>
              <SettingsSegmented
                idPrefix="btnSttPause"
                value={settings.sttSilencePauseMode ?? 'normal'}
                columns={3}
                tone="amber"
                size="md"
                onChange={next => {
                  onUpdateSettings({ sttSilencePauseMode: next });
                  const found = STT_PAUSE_OPTIONS.find(option => option.id === next);
                  onShowToast(
                    `⏱️ Tempo de pausa do microfone: ${found ? found.label : next}`
                  );
                }}
                options={STT_PAUSE_OPTIONS}
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block">
                🎯 Rigor fonético
              </span>
              <p className="text-[9px] text-slate-400 leading-tight">
                Quanto o corretor exige de precisão ao comparar sua fala com a frase.
              </p>
              <SettingsSegmented
                idPrefix="btnSttStrictness"
                value={settings.sttStrictness ?? 'balanced'}
                columns={3}
                tone="purple"
                size="md"
                onChange={next => {
                  onUpdateSettings({ sttStrictness: next });
                  const found = STT_STRICTNESS_OPTIONS.find(option => option.id === next);
                  onShowToast(`🎯 Rigor fonético: ${found ? found.label : next}`);
                }}
                options={STT_STRICTNESS_OPTIONS}
              />
            </div>

            <SettingsToggle
              id="cfgEnableAiPronunciationCoach"
              checked={settings.enableAiPronunciationCoach ?? true}
              tone="emerald"
              label="🎯 Coach fonético de IA"
              hint="Analisa sua gravação e sugere a correção depois de cada fala."
              onChange={next => {
                onUpdateSettings({ enableAiPronunciationCoach: next });
                onShowToast(
                  next
                    ? '🎯 Coach Fonético de IA ativado após cada fala!'
                    : 'Coach Fonético de IA desativado.'
                );
              }}
            />

            <SettingsToggle
              id="cfgMicNoiseSuppression"
              checked={settings.micNoiseSuppression ?? true}
              label="🎙️ Anti-ruído & eco"
              hint="Filtra barulho de fundo e eco do alto-falante ao gravar."
              onChange={next => {
                onUpdateSettings({ micNoiseSuppression: next });
                onShowToast(
                  next
                    ? '🎙️ Filtro de ruído e eco ativado no microfone!'
                    : 'Filtro de ruído desativado.'
                );
              }}
            />
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-400">
          <span>
            Nota mínima para aprovar:{' '}
            <strong className="text-emerald-300">{settings.threshold}%</strong>
          </span>
          <button
            id="btnGoToRulesFromSttHub"
            type="button"
            onClick={onGoToRules}
            className="text-indigo-300 hover:text-indigo-200 font-semibold underline cursor-pointer"
          >
            Ajustar velocidade & tolerância →
          </button>
        </div>
      </SettingsSection>
    </div>
  );
};
