import React from 'react';
import { HandsFreeChallengeMode, PedagogicalSettings } from '../../types/shadowreader';
import { VoiceCompatibilitySummary } from '../../utils/voiceCompatibility';
import {
  HANDS_FREE_ATTEMPT_OPTIONS,
  SPEED_EN_MAX,
  SPEED_EN_MIN,
  SPEED_PT_MAX,
  SPEED_PT_MIN,
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  THRESHOLD_STEP,
  describeHandsFreeAttempts,
  describeSpeedEn,
  describeSpeedPt,
  describeThreshold,
  describeThresholdEffect,
  formatSpeedValue
} from '../../utils/settingsUi';
import {
  SettingsSection,
  SettingsSlider,
  SettingsToggle
} from './SettingsPrimitives';

interface SettingsRulesPanelProps {
  settings: PedagogicalSettings;
  voiceCompat: VoiceCompatibilitySummary;
  hasChallengeStepInSeq: boolean;
  onUpdateSettings: (partial: Partial<PedagogicalSettings>) => void;
  onShowToast: (msg: string) => void;
  onGoToSteps: () => void;
  onGoToVoice: () => void;
}

const HANDS_FREE_CHALLENGE_OPTIONS: {
  id: HandsFreeChallengeMode;
  label: string;
  desc: string;
}[] = [
  { id: 'voice_all', label: '🎤 Tudo por voz', desc: 'Pronúncia + associação falada' },
  { id: 'pronunciation_only', label: '🎙️ Só pronúncia', desc: 'Apenas a pronúncia das palavras' },
  { id: 'auto_review', label: '🔊 Revisão por áudio', desc: 'Ouve os pares e avança' }
];

/**
 * Tab 4 — everything that changes *how strict* the training is and *what
 * happens when the learner stumbles*. Themes/text size moved to "Aparência"
 * and voice engines to "Voz & IA", so this tab has one subject.
 */
export const SettingsRulesPanel: React.FC<SettingsRulesPanelProps> = ({
  settings,
  voiceCompat,
  hasChallengeStepInSeq,
  onUpdateSettings,
  onShowToast,
  onGoToSteps,
  onGoToVoice
}) => {
  const handsFreeAttempts = settings.handsFreeMaxAttempts ?? 2;
  const handsFreeChallengeMode = settings.handsFreeChallengeMode ?? 'voice_all';

  return (
    <div className="space-y-3">
      {/* Cross-tab summary so the user sees what was chosen elsewhere */}
      <div
        id="voiceRulesSyncBanner"
        className="flex flex-wrap items-center gap-2 bg-slate-950/85 border border-indigo-500/30 rounded-xl px-2.5 py-1.5"
      >
        <span className="font-bold text-indigo-200 text-[10px] shrink-0">
          🎙️ Voz em uso:
        </span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar whitespace-nowrap text-[10px]">
          <span className="shrink-0 px-2 py-0.5 rounded-md bg-brand-500/15 border border-brand-500/35 text-brand-200 font-semibold">
            🔊 {voiceCompat.ttsEngineLabel} · {voiceCompat.ttsVoiceDetail}
          </span>
          <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 font-semibold">
            🎤 {voiceCompat.sttProviderLabel} · rigor {voiceCompat.sttStrictnessLabel}
          </span>
        </div>
        <button
          id="btnGoToVoiceAiHubFromRules"
          type="button"
          onClick={onGoToVoice}
          className="px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 border border-indigo-400/40 text-indigo-100 text-[10px] font-bold cursor-pointer transition shrink-0 whitespace-nowrap"
        >
          🎙️ Trocar voz →
        </button>
      </div>

      {/* Speeds */}
      <SettingsSection
        title="Velocidade da leitura"
        icon="⏩"
        hint="Quanto mais devagar, mais fácil de imitar. O áudio continua natural, sem distorcer."
      >
        <SettingsSlider
          id="cfgSpeedEnSlider"
          valueId="cfgSpeedEnDisplay"
          label="Inglês"
          value={settings.ttsSpeedEn}
          valueLabel={formatSpeedValue(settings.ttsSpeedEn)}
          valueHint={describeSpeedEn(settings.ttsSpeedEn)}
          valueClass="text-brand-300"
          min={SPEED_EN_MIN}
          max={SPEED_EN_MAX}
          step={0.05}
          onChange={next => onUpdateSettings({ ttsSpeedEn: next })}
          hint={
            voiceCompat.usesGeminiTts
              ? `Com o estilo Gemini atual, o ritmo efetivo fica em ${voiceCompat.effectiveNormalEnRate}x.`
              : undefined
          }
        />
        <SettingsSlider
          id="cfgSpeedPtSlider"
          valueId="cfgSpeedPtDisplay"
          label="Português"
          value={settings.ttsSpeedPt}
          valueLabel={formatSpeedValue(settings.ttsSpeedPt)}
          valueHint={describeSpeedPt(settings.ttsSpeedPt)}
          valueClass="text-indigo-300"
          accentClass="accent-indigo-500"
          min={SPEED_PT_MIN}
          max={SPEED_PT_MAX}
          step={0.05}
          onChange={next => onUpdateSettings({ ttsSpeedPt: next })}
        />
      </SettingsSection>

      {/* Accuracy */}
      <SettingsSection
        title="Rigor da avaliação"
        icon="🎯"
        hint="Nota mínima para considerar a sua fala correta."
      >
        <SettingsSlider
          id="cfgThresholdSlider"
          valueId="cfgThresholdDisplay"
          label="Tolerância de precisão"
          value={settings.threshold}
          valueLabel={`${settings.threshold}%`}
          valueHint={describeThreshold(settings.threshold)}
          valueClass="text-emerald-300"
          accentClass="accent-emerald-500"
          min={THRESHOLD_MIN}
          max={THRESHOLD_MAX}
          step={THRESHOLD_STEP}
          onChange={next =>
            onUpdateSettings({ threshold: Math.round(next) })
          }
          hint={describeThresholdEffect(settings.threshold)}
        />
        <p className="text-[9px] text-slate-400">
          Motor de escuta:{' '}
          <span className="text-emerald-300 font-semibold">
            {voiceCompat.sttProviderLabel}
          </span>{' '}
          · Rigor fonético:{' '}
          <span className="text-purple-300 font-semibold">
            {voiceCompat.sttStrictnessLabel}
          </span>
          .
        </p>
      </SettingsSection>

      {/* Help when the learner stumbles */}
      <SettingsSection
        title="Ajuda ao errar"
        icon="🩹"
        hint="O que o app faz quando a pronúncia não passa na primeira tentativa."
      >
        <SettingsToggle
          id="cfgRepeatOnError"
          checked={settings.repeatOnError}
          label="Repetir o áudio de apoio ao errar"
          hint='No modo "Falar Sem Inglês", toca o português enquanto o inglês está oculto.'
          onChange={next => onUpdateSettings({ repeatOnError: next })}
        />
        <SettingsToggle
          id="cfgSlowdownOnError"
          checked={settings.slowdownOnError}
          disabled={!voiceCompat.isSlowdownRelevant}
          disabledHint='Ative "Repetir o áudio de apoio" para poder reduzir a velocidade no erro.'
          label="Reduzir a velocidade em 15% na repetição"
          hint={`Ritmo da repetição de erro: ${voiceCompat.effectiveErrorRetryEnRate}x.`}
          onChange={next => onUpdateSettings({ slowdownOnError: next })}
        />
        <SettingsToggle
          id="cfgRepeatSentenceOnChallengeFail"
          checked={settings.repeatSentenceOnChallengeFail}
          label="Repetir a frase ao errar 3 vezes em um desafio"
          hint={
            hasChallengeStepInSeq
              ? 'Vale para a etapa 🏆 Desafios.'
              : 'Só vale quando a etapa 🏆 Desafios estiver na sequência.'
          }
          onChange={next => onUpdateSettings({ repeatSentenceOnChallengeFail: next })}
        />
        <SettingsToggle
          id="cfgAudioBeeps"
          checked={settings.audioBeeps}
          label="Bips sonoros"
          hint="Sinal sonoro ao acertar e ao precisar repetir."
          onChange={next => onUpdateSettings({ audioBeeps: next })}
        />
        <button
          type="button"
          onClick={onGoToSteps}
          className="w-full text-left p-2 rounded-lg bg-slate-900/70 border border-slate-800 hover:border-teal-500/50 text-[10px] text-slate-300 leading-snug transition cursor-pointer"
        >
          🧠 <span className="font-bold text-teal-200">Falar Sem Inglês</span>: quando revelar o
          texto e em quais modos a etapa aparece ficam na aba{' '}
          <span className="font-bold text-white">Etapas</span> →
        </button>
      </SettingsSection>

      {/* Hands-free */}
      <SettingsSection
        id="cfgHandsFreeExpandedBox"
        title="Modo mãos livres"
        icon="🙌"
        hint="Roda o ciclo inteiro sozinho, sem tocar na tela — bom para treinar caminhando."
        badge={settings.autoHandsFree ? 'ATIVO' : 'DESATIVADO'}
      >
        <SettingsToggle
          id="cfgAutoHandsFree"
          checked={settings.autoHandsFree}
          tone="emerald"
          label="🙌 Ativar mãos livres"
          hint="Escuta, fala, revisa e avança de frase automaticamente."
          onChange={next => {
            onUpdateSettings({ autoHandsFree: next });
            onShowToast(
              next
                ? '🙌 Modo Mãos Livres ativado! Todo o ciclo (incluindo desafios) roda sem tocar na tela.'
                : 'Modo Mãos Livres desativado.'
            );
          }}
        />

        <div className={settings.autoHandsFree ? '' : 'opacity-70'}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] text-slate-300 font-semibold">
              Tentativas antes de avançar
            </span>
            <div className="flex items-center gap-1">
              {HANDS_FREE_ATTEMPT_OPTIONS.map(attempts => {
                const active = handsFreeAttempts === attempts;
                return (
                  <button
                    key={`hf-att-${attempts}`}
                    id={`btnHandsFreeAttempts_${attempts}`}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onUpdateSettings({
                        autoHandsFree: true,
                        handsFreeMaxAttempts: attempts
                      });
                      onShowToast(
                        `🙌 Mãos Livres: avança automaticamente após ${attempts} tentativa(s).`
                      );
                    }}
                    className={`min-h-[32px] px-2 py-1 rounded text-[10px] font-bold border cursor-pointer transition ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-500/40'
                    }`}
                  >
                    {attempts}x
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-0.5">
            {describeHandsFreeAttempts(handsFreeAttempts)}
          </p>

          <div className="mt-2">
            <span className="text-[10px] text-slate-300 font-semibold block mb-1">
              Desafios pós-sentença no mãos livres
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {HANDS_FREE_CHALLENGE_OPTIONS.map(option => {
                const isSel = handsFreeChallengeMode === option.id;
                return (
                  <button
                    key={option.id}
                    id={`btnHandsFreeChallenge_${option.id}`}
                    type="button"
                    aria-pressed={isSel}
                    title={option.desc}
                    onClick={() => {
                      onUpdateSettings({
                        autoHandsFree: true,
                        handsFreeChallengeMode: option.id
                      });
                      onShowToast(`🙌 Desafios no Mãos Livres: ${option.label}`);
                    }}
                    className={`min-h-[36px] py-1 px-2 rounded text-[10px] font-bold border cursor-pointer transition text-center leading-tight ${
                      isSel
                        ? 'bg-emerald-600 text-white border-emerald-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-500/40'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <SettingsToggle
              id="cfgHandsFreeVoiceCommands"
              checked={settings.handsFreeVoiceCommands ?? true}
              tone="emerald"
              label='🗣️ Comandos de voz ("pular", "repetir")'
              hint="Funcionam enquanto o microfone está escutando."
              onChange={next =>
                onUpdateSettings({
                  autoHandsFree: true,
                  handsFreeVoiceCommands: next
                })
              }
            />
          </div>
        </div>

        <p className="text-[9px] text-emerald-300/90 flex items-center gap-1">
          ▶️ O treino só começa quando você clica em &quot;Iniciar Treino&quot;.
        </p>
      </SettingsSection>
    </div>
  );
};
