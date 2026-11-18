import {
  AudioFlow,
  PedagogicalSettings,
  StudyStepCardType,
  VisualCardType
} from '../types/shadowreader';

export type StepCategory = 'audio' | 'speak' | 'review' | 'challenge';

export interface StepCardMeta {
  type: StudyStepCardType;
  shortLabel: string;
  label: string;
  icon: string;
  description: string;
  badgeClass: string;
  chipClass: string;
  category: StepCategory;
  isSpeakStep: boolean;
  isChallengeStep: boolean;
}

export const STEP_CARD_META: Record<StudyStepCardType, StepCardMeta> = {
  pt: {
    type: 'pt',
    shortLabel: 'Ouvir PT',
    label: 'Ouvir / Ler Português (Contexto)',
    icon: '🇧🇷',
    description: 'Destaca e lê a tradução contextual em português.',
    badgeClass: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40',
    chipClass: 'bg-indigo-950/60 border-indigo-500/40 text-indigo-200 hover:border-indigo-400',
    category: 'audio',
    isSpeakStep: false,
    isChallengeStep: false
  },
  en: {
    type: 'en',
    shortLabel: 'Ouvir EN',
    label: 'Ouvir / Ler Inglês (Natural)',
    icon: '🇺🇸',
    description: 'Destaca e lê a sentença em inglês na velocidade natural.',
    badgeClass: 'bg-brand-500/20 text-brand-200 border-brand-500/40',
    chipClass: 'bg-slate-900/90 border-brand-500/40 text-brand-200 hover:border-brand-400',
    category: 'audio',
    isSpeakStep: false,
    isChallengeStep: false
  },
  en_slow: {
    type: 'en_slow',
    shortLabel: 'Ouvir EN 0.6x',
    label: 'Ouvir Inglês Lento (0.6x)',
    icon: '🐢',
    description: 'Lê a sentença em inglês devagar (0.6x) para percepção de cada sílaba.',
    badgeClass: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40',
    chipClass: 'bg-cyan-950/50 border-cyan-500/40 text-cyan-200 hover:border-cyan-400',
    category: 'audio',
    isSpeakStep: false,
    isChallengeStep: false
  },
  speak: {
    type: 'speak',
    shortLabel: 'Falar (Com EN)',
    label: 'Falar Lendo o Inglês',
    icon: '🎤',
    description: 'Você pronuncia a frase em inglês com o texto em inglês visível na tela.',
    badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
    chipClass: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200 hover:border-emerald-400',
    category: 'speak',
    isSpeakStep: true,
    isChallengeStep: false
  },
  speak_blind_en: {
    type: 'speak_blind_en',
    shortLabel: 'Falar Sem Inglês',
    label: 'Falar Sem Ler o Inglês (Apenas PT)',
    icon: '🧠',
    description:
      'Esconde o texto e as pills em inglês para você falar guiando-se apenas pelo português.',
    badgeClass: 'bg-teal-500/25 text-teal-200 border-teal-400/50',
    chipClass: 'bg-teal-950/60 border-teal-500/40 text-teal-200 hover:border-teal-400',
    category: 'speak',
    isSpeakStep: true,
    isChallengeStep: false
  },
  speak_challenge: {
    type: 'speak_challenge',
    shortLabel: 'Falar (Sem PT)',
    label: 'Falar com PT Oculto (Desafio Cego)',
    icon: '🔒',
    description:
      'Bloqueia a tradução em português até você acertar a pronúncia em inglês.',
    badgeClass: 'bg-amber-500/25 text-amber-200 border-amber-400/50',
    chipClass: 'bg-amber-950/60 border-amber-500/40 text-amber-200 hover:border-amber-400',
    category: 'speak',
    isSpeakStep: true,
    isChallengeStep: false
  },
  literal: {
    type: 'literal',
    shortLabel: 'Revisão Automática',
    label: 'Revisão Automática (Palavra + Tradução Literal)',
    icon: '🔤',
    description:
      'Percorre e pronuncia automaticamente cada palavra em inglês seguida da sua tradução literal.',
    badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
    chipClass: 'bg-amber-950/50 border-amber-500/40 text-amber-200 hover:border-amber-400',
    category: 'review',
    isSpeakStep: false,
    isChallengeStep: false
  },
  challenges: {
    type: 'challenges',
    shortLabel: 'Desafios (Ambos)',
    label: 'Desafios da Frase (Pronúncia + Associar Cards)',
    icon: '🏆',
    description:
      'Abre os 2 desafios práticos da frase: 1º Desafio de Pronúncia de Palavras e 2º Associar Pares EN ↔ PT.',
    badgeClass: 'bg-purple-500/25 text-purple-200 border-purple-400/50',
    chipClass: 'bg-purple-950/60 border-purple-500/40 text-purple-200 hover:border-purple-400',
    category: 'challenge',
    isSpeakStep: false,
    isChallengeStep: true
  },
  challenge_pronunciation: {
    type: 'challenge_pronunciation',
    shortLabel: 'Desafio: Pronúncia',
    label: 'Desafio 1: Pronúncia de Palavras',
    icon: '🎯',
    description:
      'Sorteia até 3 palavras da frase para você pronunciar individualmente sem ler o inglês.',
    badgeClass: 'bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400/50',
    chipClass: 'bg-fuchsia-950/60 border-fuchsia-500/40 text-fuchsia-200 hover:border-fuchsia-400',
    category: 'challenge',
    isSpeakStep: false,
    isChallengeStep: true
  },
  challenge_matching: {
    type: 'challenge_matching',
    shortLabel: 'Desafio: Pares',
    label: 'Desafio 2: Associar Cards (EN ↔ PT)',
    icon: '🃏',
    description:
      'Jogo de associação para conectar cada palavra em inglês da frase à sua tradução em português.',
    badgeClass: 'bg-pink-500/25 text-pink-200 border-pink-400/50',
    chipClass: 'bg-pink-950/60 border-pink-500/40 text-pink-200 hover:border-pink-400',
    category: 'challenge',
    isSpeakStep: false,
    isChallengeStep: true
  }
};

export function isSpeakStepCard(step: StudyStepCardType): boolean {
  return step === 'speak' || step === 'speak_blind_en' || step === 'speak_challenge';
}

export function isChallengeStepCard(step: StudyStepCardType): boolean {
  return (
    step === 'challenges' ||
    step === 'challenge_pronunciation' ||
    step === 'challenge_matching'
  );
}

export interface StepCategoryMeta {
  id: StepCategory;
  label: string;
  /** Icon used in the "add step" chip group header. */
  icon: string;
}

/** Ordered groups used by the "adicionar etapa" chips in Settings. */
export const STEP_CATEGORY_META: StepCategoryMeta[] = [
  { id: 'audio', label: 'Áudio & revisão', icon: '🔊' },
  { id: 'speak', label: 'Fala', icon: '🎤' },
  { id: 'review', label: 'Revisão', icon: '🔤' },
  { id: 'challenge', label: 'Desafios', icon: '🏆' }
];

export function getStepCardsByCategory(category: StepCategory): StudyStepCardType[] {
  return (Object.keys(STEP_CARD_META) as StudyStepCardType[]).filter(
    type => STEP_CARD_META[type].category === category
  );
}

/**
 * Groups every addable study step by category, in display order. Keeps the
 * Settings chip rows generated from `STEP_CARD_META` instead of hardcoded
 * arrays that drift when a new card type is added.
 */
export function getAddableStepGroups(): {
  category: StepCategoryMeta;
  steps: StepCardMeta[];
}[] {
  return STEP_CATEGORY_META.map(category => ({
    category,
    steps: getStepCardsByCategory(category.id).map(type => STEP_CARD_META[type])
  })).filter(group => group.steps.length > 0);
}

export interface VisualCardMeta {
  type: VisualCardType;
  shortLabel: string;
  label: string;
  icon: string;
  badgeClass: string;
}

export const VISUAL_CARD_META: Record<VisualCardType, VisualCardMeta> = {
  pt: {
    type: 'pt',
    shortLabel: 'Português',
    label: 'Card Português (Significado & Contexto)',
    icon: '🇧🇷',
    badgeClass: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40'
  },
  en: {
    type: 'en',
    shortLabel: 'Inglês',
    label: 'Card Inglês (Escutar e Pronunciar)',
    icon: '🇺🇸',
    badgeClass: 'bg-brand-500/20 text-brand-200 border-brand-500/40'
  },
  literal: {
    type: 'literal',
    shortLabel: 'Tradução Literal',
    label: 'Card Tradução Literal (Palavra por Palavra)',
    icon: '🔤',
    badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-500/40'
  }
};

export interface RecommendedCardPreset {
  id: Exclude<AudioFlow, 'custom'>;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  cardSequence: StudyStepCardType[];
  visualCardOrder: VisualCardType[];
  accentClass: string;
  activeAccentClass: string;
}

export const RECOMMENDED_CARD_PRESETS: RecommendedCardPreset[] = [
  {
    id: 'pt_first',
    title: '🌟 Ciclo Essencial com Desafios',
    subtitle: 'Ouvir PT → Ouvir EN → Falar → Desafios',
    badge: '★ Recomendado · Padrão',
    description:
      'Fluxo equilibrado: entenda o contexto em português, ouça o inglês, pratique a fala e conclua a frase com a etapa de Desafios.',
    cardSequence: ['pt', 'en', 'speak', 'challenges'],
    visualCardOrder: ['pt', 'en', 'literal'],
    accentClass: 'border-slate-800 bg-slate-900/70 hover:border-brand-500/40',
    activeAccentClass: 'border-brand-500 bg-brand-500/15 ring-1 ring-brand-500/50'
  },
  {
    id: 'blind_en',
    title: '🧠 Domínio Sem Ler Inglês + Desafios',
    subtitle: 'PT → EN → Falar (Com EN) → Falar Sem Inglês → Desafios',
    badge: '★ Recomendado · Memória Ativa',
    description:
      'Treino em 2 etapas de fala: primeiro fale lendo o inglês e, logo em seguida, repita na etapa "Falar Sem Inglês" (olhando apenas o PT) antes dos Desafios!',
    cardSequence: ['pt', 'en', 'speak', 'speak_blind_en', 'challenges'],
    visualCardOrder: ['pt', 'en', 'literal'],
    accentClass: 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-400/60',
    activeAccentClass: 'border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-400/60'
  },
  {
    id: 'sandwich',
    title: '🔤 Revisão Automática & Desafios',
    subtitle: 'PT → EN → Falar → Revisão Automática → Desafios',
    badge: '★ Recomendado · Vocabulário',
    description:
      'Após acertar a fala, entra na etapa de Revisão Automática (lendo cada palavra + tradução literal) para preparar você antes da etapa de Desafios.',
    cardSequence: ['pt', 'en', 'speak', 'literal', 'challenges'],
    visualCardOrder: ['pt', 'en', 'literal'],
    accentClass: 'border-slate-800 bg-slate-900/70 hover:border-indigo-500/40',
    activeAccentClass: 'border-indigo-400 bg-indigo-500/15 ring-1 ring-indigo-400/50'
  },
  {
    id: 'en_first',
    title: '🎧 Imersão Auditiva & Sílaba',
    subtitle: 'EN → EN 0.6x → PT → Falar → Desafios',
    badge: '★ Recomendado · Auditivo',
    description:
      'Prioriza o Card de Inglês no topo da tela, seguido da etapa em câmera lenta (0.6x), tradução em português, fala e etapa de Desafios.',
    cardSequence: ['en', 'en_slow', 'pt', 'speak', 'challenges'],
    visualCardOrder: ['en', 'literal', 'pt'],
    accentClass: 'border-slate-800 bg-slate-900/70 hover:border-cyan-500/40',
    activeAccentClass: 'border-cyan-400 bg-cyan-500/15 ring-1 ring-cyan-400/50'
  },
  {
    id: 'challenge',
    title: '🏆 Imersão Total (Fala Cega + Sem Inglês + Revisão + Desafios)',
    subtitle: 'EN → Falar s/ PT → PT → Falar Sem Inglês → Revisão → Desafios',
    badge: '★ Recomendado · Intensivo',
    description:
      'O ciclo mais completo: fale primeiro sem ver o PT, ouça o significado, fale novamente sem ler o inglês, passe pela Revisão Automática e feche nos Desafios!',
    cardSequence: ['en', 'speak_challenge', 'pt', 'speak_blind_en', 'literal', 'challenges'],
    visualCardOrder: ['en', 'pt', 'literal'],
    accentClass: 'border-amber-500/30 bg-amber-500/5 hover:border-amber-400/60',
    activeAccentClass: 'border-amber-400 bg-amber-500/15 ring-1 ring-amber-400/60'
  }
];

export function getPresetById(flow: AudioFlow): RecommendedCardPreset | undefined {
  if (flow === 'custom') return undefined;
  return RECOMMENDED_CARD_PRESETS.find(p => p.id === flow);
}

export interface SequenceStepContext {
  isStepByStepMode?: boolean;
  isSubClauseStep?: boolean;
}

/**
 * Returns the explicit ordered list of learning steps (StudyStepCardType[]) configured by the user.
 * When `context` is provided and `settings.blindSpeakingOnFullSentence === false`, the 'speak_blind_en'
 * step appears only on sub-parts in 'Em Partes' mode (`isStepByStepMode && isSubClauseStep`) and is
 * omitted on the full sentence ('Desafio Final: Frase Inteira').
 */
export function buildEffectiveCardSequence(
  settings: PedagogicalSettings,
  context?: SequenceStepContext
): StudyStepCardType[] {
  const validTypes = new Set<string>(Object.keys(STEP_CARD_META));
  const DEFAULT_SEQUENCE: StudyStepCardType[] = [
    'pt',
    'en',
    'speak',
    'speak_blind_en',
    'challenges'
  ];
  const raw: StudyStepCardType[] =
    Array.isArray(settings.cardSequence) && settings.cardSequence.length > 0
      ? settings.cardSequence.filter((c): c is StudyStepCardType => validTypes.has(c))
      : [...DEFAULT_SEQUENCE];

  let seq: StudyStepCardType[] = raw.length > 0 ? [...raw] : [...DEFAULT_SEQUENCE];

  if (context) {
    const isSubPartInStepMode = Boolean(
      context.isStepByStepMode && context.isSubClauseStep
    );

    // 1. Post-sentence challenges belong to the full sentence ('Desafio Final: Frase Inteira'), not intermediate sub-clauses ('Parte 1/2', 'Parte 2/2')
    if (isSubPartInStepMode && seq.some(c => isChallengeStepCard(c))) {
      const withoutChallenges = seq.filter(c => !isChallengeStepCard(c));
      seq = withoutChallenges.length > 0 ? withoutChallenges : ['pt', 'en', 'speak'];
    }

    // 2. When blindSpeakingOnFullSentence is false, 'speak_blind_en' runs only on sub-parts in 'Em Partes' mode
    if (!isSubPartInStepMode && (settings.blindSpeakingOnFullSentence ?? true) === false) {
      if (seq.includes('speak_blind_en')) {
        const hasOtherSpeakStep = seq.some(
          c => c === 'speak' || c === 'speak_challenge'
        );
        if (hasOtherSpeakStep) {
          seq = seq.filter(c => c !== 'speak_blind_en');
        } else {
          // If 'speak_blind_en' was the only speak step in the sequence, convert the first occurrence to 'speak'
          let replacedFirst = false;
          seq = seq.reduce<StudyStepCardType[]>((acc, item) => {
            if (item === 'speak_blind_en') {
              if (!replacedFirst) {
                replacedFirst = true;
                acc.push('speak');
              }
            } else {
              acc.push(item);
            }
            return acc;
          }, []);
        }
      }
    }
  }

  return seq;
}

/**
 * Formats a short summary of the learning step sequence (e.g., "PT → EN → Falar → Desafios")
 */
export function formatCardSequenceSummary(sequence: StudyStepCardType[]): string {
  if (!sequence || sequence.length === 0) return 'PT → EN → Falar → Sem Inglês → Desafios';
  return sequence
    .map(step => {
      switch (step) {
        case 'pt':
          return 'PT';
        case 'en':
          return 'EN';
        case 'en_slow':
          return 'EN 0.6x';
        case 'literal':
          return 'Revisão';
        case 'speak':
          return 'Falar';
        case 'speak_blind_en':
          return 'Sem Inglês';
        case 'speak_challenge':
          return 'Falar s/ PT';
        case 'challenges':
          return 'Desafios';
        case 'challenge_pronunciation':
          return 'Desafio Pron.';
        case 'challenge_matching':
          return 'Desafio Pares';
        default:
          return step;
      }
    })
    .join(' → ');
}

/**
 * Finds the best step index BEFORE 'speak_blind_en' so users who forget the English text
 * can replay/review the English step and retry 'speak_blind_en' until they pass.
 */
export function findRestartSeqIdxBeforeBlind(
  sequence: StudyStepCardType[],
  activeSeqIdx?: number | null
): number {
  if (!sequence || sequence.length === 0) return 0;

  let blindIdx = -1;
  if (
    typeof activeSeqIdx === 'number' &&
    activeSeqIdx >= 0 &&
    activeSeqIdx < sequence.length &&
    sequence[activeSeqIdx] === 'speak_blind_en'
  ) {
    blindIdx = activeSeqIdx;
  } else {
    blindIdx = sequence.indexOf('speak_blind_en');
  }

  if (blindIdx <= 0) return 0;

  // Prefer restarting right on the nearest English listening step preceding 'speak_blind_en'
  for (let i = blindIdx - 1; i >= 0; i--) {
    if (sequence[i] === 'en' || sequence[i] === 'en_slow') {
      return i;
    }
  }

  // Fallback to the earliest preparation step before 'speak_blind_en'
  return 0;
}

