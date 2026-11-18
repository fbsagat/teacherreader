import React from 'react';
import { AudioFlow, PedagogicalSettings, StudyStepCardType } from '../../types/shadowreader';
import { RECOMMENDED_CARD_PRESETS, STEP_CARD_META } from '../../utils/cardSequencePresets';

interface SettingsPresetsPanelProps {
  settings: PedagogicalSettings;
  activeSequence: StudyStepCardType[];
  onSelectPreset: (id: Exclude<AudioFlow, 'custom'>) => void;
  onGoToSteps: () => void;
}

const PRESET_DOM_IDS: Record<Exclude<AudioFlow, 'custom'>, string> = {
  pt_first: 'cfgFlowPtFirstCard',
  sandwich: 'cfgFlowSandwichCard',
  en_first: 'cfgFlowEnFirstCard',
  blind_en: 'cfgFlowBlindEnCard',
  challenge: 'cfgFlowChallengeCard'
};

/**
 * Tab 1 — ready-made study flows. Only place where a full flow is chosen, so
 * the user has a single decision to make before customizing anything.
 */
export const SettingsPresetsPanel: React.FC<SettingsPresetsPanelProps> = ({
  settings,
  activeSequence,
  onSelectPreset,
  onGoToSteps
}) => {
  const activePreset = RECOMMENDED_CARD_PRESETS.find(preset => preset.id === settings.audioFlow);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2">
        <div className="text-[10px] text-slate-300 leading-snug min-w-0">
          <strong className="text-amber-300">Como funciona:</strong> cada frase percorre a{' '}
          <strong>sequência de etapas</strong> do fluxo escolhido — incluindo{' '}
          <span className="text-teal-300 font-semibold">🧠 Falar Sem Inglês</span>,{' '}
          <span className="text-amber-300 font-semibold">🔤 Revisão Automática</span> e{' '}
          <span className="text-purple-300 font-semibold">🏆 Desafios</span>.
        </div>
        <button
          id="btnGoToCustomBuilderTab"
          type="button"
          onClick={onGoToSteps}
          className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-brand-600/25 hover:bg-brand-600 border border-brand-500/40 text-brand-200 hover:text-white transition cursor-pointer shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          🎛️ Personalizar etapas →
        </button>
      </div>

      <div
        role="radiogroup"
        aria-label="Fluxos de estudo recomendados"
        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
      >
        {RECOMMENDED_CARD_PRESETS.map((preset, idx) => {
          const isSelected = settings.audioFlow === preset.id;
          const isFullSpan = idx === RECOMMENDED_CARD_PRESETS.length - 1;
          return (
            <label
              key={preset.id}
              id={PRESET_DOM_IDS[preset.id]}
              className={`relative flex flex-col justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                isFullSpan ? 'sm:col-span-2' : ''
              } ${isSelected ? preset.activeAccentClass : preset.accentClass}`}
            >
              <input
                type="radio"
                name="settingsAudioFlow"
                value={preset.id}
                checked={isSelected}
                onChange={() => onSelectPreset(preset.id)}
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
                  {isSelected && (
                    <span className="px-1.5 py-0.5 rounded bg-brand-600 text-white text-[9px] font-bold border border-brand-300">
                      ✓ Em uso
                    </span>
                  )}
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
                        <span className="text-[9px] text-slate-400" aria-hidden="true">
                          →
                        </span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2">
        <span className="text-slate-400">
          {activePreset ? (
            <>
              Fluxo ativo: <strong className="text-slate-200">{activePreset.title}</strong>
            </>
          ) : (
            <>
              Fluxo <strong className="text-purple-200">customizado</strong> — a sequência atual não
              corresponde a nenhum modelo pronto.
            </>
          )}
        </span>
        <span className="font-mono text-slate-300">
          {activeSequence.length} etapa{activeSequence.length > 1 ? 's' : ''} por frase
        </span>
      </div>
    </div>
  );
};
