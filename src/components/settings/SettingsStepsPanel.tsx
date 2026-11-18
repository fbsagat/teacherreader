import React from 'react';
import {
  PedagogicalSettings,
  StudyStepCardType,
  VisualCardType
} from '../../types/shadowreader';
import {
  STEP_CARD_META,
  VISUAL_CARD_META,
  getAddableStepGroups
} from '../../utils/cardSequencePresets';
import { buildOccurrenceInfo } from '../../utils/cardSequenceEdits';
import {
  BLIND_REVEAL_OPTIONS,
  describeBlindMaxErrors,
  describeBlindSentenceScope,
  resolveBlindSentenceScope
} from '../../utils/settingsUi';
import { OrderedListEditor } from './OrderedListEditor';
import { SettingsSection, SettingsSegmented } from './SettingsPrimitives';

interface SettingsStepsPanelProps {
  settings: PedagogicalSettings;
  activeSequence: StudyStepCardType[];
  activeVisualCards: VisualCardType[];
  onMoveStep: (index: number, delta: -1 | 1) => void;
  onRepeatStep: (index: number) => void;
  onRemoveStep: (index: number) => void;
  onAddStep: (cardType: StudyStepCardType) => void;
  onMoveVisualCard: (index: number, delta: -1 | 1) => void;
  onRepeatVisualCard: (index: number) => void;
  onRemoveVisualCard: (index: number) => void;
  onAddVisualCard: (cardType: VisualCardType) => void;
  onUpdateSettings: (partial: Partial<PedagogicalSettings>) => void;
  onShowToast: (msg: string) => void;
}

/**
 * Tab 2 — the two ordered lists (study steps and visual cards) plus the rules
 * that only make sense next to the "Falar Sem Inglês" step.
 */
export const SettingsStepsPanel: React.FC<SettingsStepsPanelProps> = ({
  settings,
  activeSequence,
  activeVisualCards,
  onMoveStep,
  onRepeatStep,
  onRemoveStep,
  onAddStep,
  onMoveVisualCard,
  onRepeatVisualCard,
  onRemoveVisualCard,
  onAddVisualCard,
  onUpdateSettings,
  onShowToast
}) => {
  const stepOccurrences = buildOccurrenceInfo(activeSequence);
  const visualOccurrences = buildOccurrenceInfo(activeVisualCards);

  const stepItems = activeSequence.map((stepType, idx) => {
    const meta = STEP_CARD_META[stepType] || STEP_CARD_META.en;
    return {
      type: stepType,
      icon: meta.icon,
      label: meta.label,
      occurrence: stepOccurrences[idx]
    };
  });

  const visualItems = activeVisualCards.map((cardType, idx) => {
    const meta = VISUAL_CARD_META[cardType] || VISUAL_CARD_META.en;
    return {
      type: cardType,
      icon: meta.icon,
      label: meta.label,
      occurrence: visualOccurrences[idx]
    };
  });

  const blindStepInUse = activeSequence.includes('speak_blind_en');
  const blindMaxErrors = settings.blindMaxErrorsBeforeReveal ?? 2;
  const blindScope = resolveBlindSentenceScope(settings.blindSpeakingOnFullSentence);
  const addableStepGroups = getAddableStepGroups();

  return (
    <div className="space-y-3">
      {/* 1. Study step sequence */}
      <SettingsSection
        title="Etapas de cada frase"
        icon="🎬"
        hint="A frase passa por estas etapas, de cima para baixo. Use 🔁 para repetir uma etapa."
        badge={`${activeSequence.length} etapa${activeSequence.length > 1 ? 's' : ''}`}
      >
        <OrderedListEditor
          containerId="customCardSequenceList"
          items={stepItems}
          dataAttr="data-step-card"
          indexAttr="data-step-idx"
          minItems={1}
          itemNoun="etapa"
          occurrenceUnit="vez"
          formatOrdinal={index => `${index + 1}º`}
          buttonIds={{
            up: 'btnMoveStepUp',
            down: 'btnMoveStepDown',
            repeat: 'btnRepeatStepCard',
            remove: 'btnRemoveStepCard'
          }}
          onMove={onMoveStep}
          onDuplicate={onRepeatStep}
          onRemove={onRemoveStep}
        />

        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 block">
            ➕ Adicionar etapa ao final:
          </span>
          {addableStepGroups.map(group => (
            <div key={group.category.id} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 w-full sm:w-28 shrink-0">
                {group.category.icon} {group.category.label}:
              </span>
              {group.steps.map(meta => (
                <button
                  key={meta.type}
                  id={`btnAddStepCard_${meta.type}`}
                  type="button"
                  onClick={() => onAddStep(meta.type)}
                  className={`min-h-[32px] px-2 py-1 rounded-lg border text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${meta.chipClass}`}
                  title={meta.description}
                >
                  <span aria-hidden="true">+ {meta.icon}</span>
                  <span>{meta.shortLabel}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* 2. Visual cards on the main screen */}
      <SettingsSection
        title="Cards visíveis na tela"
        icon="🃏"
        hint="Define a ordem em que os cards aparecem durante o treino (Português, Inglês e Tradução Literal)."
        badge={`${activeVisualCards.length} card${activeVisualCards.length > 1 ? 's' : ''}`}
      >
        <OrderedListEditor
          containerId="customVisualCardsList"
          items={visualItems}
          dataAttr="data-visual-card"
          indexAttr="data-visual-idx"
          minItems={1}
          itemNoun="card"
          occurrenceUnit="passagem"
          formatOrdinal={index => `0${index + 1}`}
          maxHeightClass="max-h-32"
          buttonIds={{
            up: 'btnMoveVisualCardUp',
            down: 'btnMoveVisualCardDown',
            repeat: 'btnRepeatVisualCard',
            remove: 'btnRemoveVisualCard'
          }}
          onMove={onMoveVisualCard}
          onDuplicate={onRepeatVisualCard}
          onRemove={onRemoveVisualCard}
        />

        <div className="pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 mr-1">
            ➕ Adicionar na tela:
          </span>
          {(Object.keys(VISUAL_CARD_META) as VisualCardType[]).map(vType => {
            const meta = VISUAL_CARD_META[vType];
            return (
              <button
                key={vType}
                id={`btnAddVisualCard_${vType}`}
                type="button"
                onClick={() => onAddVisualCard(vType)}
                className={`min-h-[32px] px-2 py-1 rounded-lg border text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${meta.badgeClass}`}
              >
                <span aria-hidden="true">+ {meta.icon}</span>
                <span>Card {meta.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* 3. Blind speaking rules (single source of truth) */}
      <SettingsSection
        id="cfgBlindSpeakingSection"
        title="Falar sem ler o inglês"
        icon="🧠"
        hint="Regras da etapa 🧠 Falar Sem Inglês: quando revelar o texto e em quais modos a etapa aparece."
        badge={blindStepInUse ? 'Em uso' : 'Etapa não usada'}
      >
        <div className={blindStepInUse ? '' : 'opacity-70'}>
          <span className="text-[10px] font-bold text-teal-300 block">
            Revelar o inglês após quantos erros?
          </span>
          <p className="text-[9px] text-slate-400 mb-1">
            {describeBlindMaxErrors(blindMaxErrors)}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
            {BLIND_REVEAL_OPTIONS.map(option => {
              const isSelected = blindMaxErrors === option.value;
              return (
                <button
                  key={`custom-blind-err-${option.value}`}
                  id={`btnCustomBlindMaxErrors_${option.value}`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    onUpdateSettings({ blindMaxErrorsBeforeReveal: option.value });
                    onShowToast(
                      option.value === 0
                        ? '🧠 Falar Sem Inglês: texto nunca será revelado automaticamente.'
                        : `🧠 Falar Sem Inglês: texto será revelado após ${option.label}.`
                    );
                  }}
                  className={`min-h-[34px] px-2 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-400 shadow-xs'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-teal-500/50 hover:text-white'
                  }`}
                >
                  {option.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div
          id="cfgCustomBlindFullSentenceBox"
          className="pt-2 border-t border-slate-800/80"
        >
          <span className="text-[10px] font-bold text-teal-300 block">
            Onde a etapa aparece
          </span>
          <p className="text-[9px] text-slate-400 mb-1">
            {describeBlindSentenceScope(settings.blindSpeakingOnFullSentence ?? true)}
          </p>
          <SettingsSegmented
            idPrefix="btnCustomBlindFullSentence"
            value={blindScope}
            columns={2}
            tone="teal"
            onChange={next => {
              const onFullSentence = next === 'full_sentence';
              onUpdateSettings({ blindSpeakingOnFullSentence: onFullSentence });
              onShowToast(
                onFullSentence
                  ? '🧠 Falar Sem Inglês: ativado também no "Desafio Final: Frase Inteira"!'
                  : '🧠 Falar Sem Inglês: aparecerá apenas no modo "Em Partes".'
              );
            }}
            options={[
              { id: 'parts_only', label: '✂️ Só em partes' },
              { id: 'full_sentence', label: '🏁 Também na frase inteira' }
            ]}
          />
          {!blindStepInUse && (
            <p className="text-[9px] text-amber-300/90 mt-1.5">
              A etapa 🧠 Falar Sem Inglês não está na sequência. Adicione-a acima para usar estas
              regras.
            </p>
          )}
        </div>
      </SettingsSection>
    </div>
  );
};
