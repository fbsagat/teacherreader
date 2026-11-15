import React, { useEffect, useState } from 'react';

interface PocketModeOverlayProps {
  isOpen: boolean;
  currentIndex: number;
  totalSentences: number;
  isListeningMic: boolean;
  onExit: () => void;
}

export const PocketModeOverlay: React.FC<PocketModeOverlayProps> = ({
  isOpen,
  currentIndex,
  totalSentences,
  isListeningMic,
  onExit
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="pocketModeOverlay"
      className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-between px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center select-none"
    >
      <div className="pt-2">
        <span className="inline-flex items-center gap-2 text-slate-400 text-xs font-mono">
          Modo Bolso Ativo (WakeLock Ligado)
        </span>
      </div>

      <div className="flex flex-col items-center gap-4 my-auto">
        <div className="w-16 h-16 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <div>
          <p id="pocketStatusText" className="text-sm font-semibold text-slate-300">
            {isListeningMic
              ? 'Sua vez: fale nos fones de ouvido...'
              : 'Ouvindo leitura do livro...'}
          </p>
          <p id="pocketSentenceIndex" className="text-xs text-slate-500 font-mono mt-1 tabular-nums">
            Sentença {currentIndex + 1} / {totalSentences}
          </p>
        </div>
        <p className="text-[11px] text-slate-500 max-w-xs mt-2 leading-relaxed">
          Tela bloqueada contra toques acidentais no bolso enquanto você estuda pelos fones. Use o botão abaixo para sair.
        </p>
      </div>

      <div className="pb-2 w-full max-w-xs">
        <button
          id="btnExitPocketMode"
          type="button"
          onClick={onExit}
          className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer"
        >
          Sair do Modo Bolso (Tela Normal)
        </button>
      </div>
    </div>
  );
};

interface BookCompletedModalProps {
  isOpen: boolean;
  bookTitle: string;
  totalSentences: number;
  vocabCount: number;
  onRestart: () => void;
  onChooseAnother: () => void;
}

export const BookCompletedModal: React.FC<BookCompletedModalProps> = ({
  isOpen,
  bookTitle,
  totalSentences,
  vocabCount,
  onRestart,
  onChooseAnother
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="modalBookCompleted"
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm sm:max-w-md lg:max-w-lg w-full p-5 max-h-[92dvh] overflow-y-auto shadow-2xl text-center relative"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg shadow-amber-500/20 mb-3">
          🏆
        </div>
        <h3 className="text-lg font-extrabold text-white">Livro Concluído!</h3>
        <p id="completionBookTitle" className="text-xs text-brand-300 font-semibold mt-0.5">
          {bookTitle}
        </p>
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          Parabéns! Você completou todas as sentenças e treinou ativamente sua compreensão e
          pronúncia em inglês.
        </p>

        <div className="grid grid-cols-2 gap-2 my-4 text-left tabular-nums">
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-semibold">
              Total de Sentenças
            </span>
            <span id="completionTotalSentences" className="text-sm font-bold text-white">
              {totalSentences} sentenças
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-semibold">
              Vocabulário Salvo
            </span>
            <span id="completionVocabCount" className="text-sm font-bold text-amber-400">
              {vocabCount} palavras
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800 text-xs">
          <button
            id="btnRestartBookFromZero"
            type="button"
            onClick={onRestart}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold transition shadow cursor-pointer"
          >
            Reler Este Livro do Início
          </button>
          <button
            id="btnChooseAnotherBook"
            type="button"
            onClick={onChooseAnother}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 transition cursor-pointer"
          >
            Escolher Outro Livro
          </button>
        </div>
      </div>
    </div>
  );
};

interface FallbackSpeechModalProps {
  isOpen: boolean;
  targetSentence: string;
  hideEnglishText?: boolean;
  ptHint?: string;
  autoHandsFree?: boolean;
  onSubmitSpeech: (spokenText: string) => void;
  onClose: () => void;
}

export const FallbackSpeechModal: React.FC<FallbackSpeechModalProps> = ({
  isOpen,
  targetSentence,
  hideEnglishText = false,
  ptHint,
  autoHandsFree = false,
  onSubmitSpeech,
  onClose
}) => {
  const [inputVal, setInputVal] = useState('');

  useEffect(() => {
    if (!isOpen || !autoHandsFree || inputVal.trim().length > 0) return;
    const timer = window.setTimeout(() => {
      onSubmitSpeech(targetSentence);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [isOpen, autoHandsFree, inputVal, targetSentence, onSubmitSpeech]);

  if (!isOpen) return null;

  return (
    <div
      id="modalFallbackSpeech"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fallbackSpeechTitle"
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md lg:max-w-xl w-full p-4 sm:p-5 max-h-[92dvh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <h3 id="fallbackSpeechTitle" className="text-sm font-bold text-white flex items-center gap-2 min-w-0">
            <svg className="w-4 h-4 text-brand-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            <span className="truncate">Entrada de Fala / Simulação de Microfone</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar entrada de fala"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
        {autoHandsFree && (
          <div
            id="fallbackHandsFreeNotice"
            className="mt-2 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold animate-pulse"
          >
            🙌 Mãos Livres Ativo: validando e avançando automaticamente...
          </div>
        )}
        <p className="text-xs text-slate-400 mt-2">
          {hideEnglishText
            ? '🧠 Etapa Sem Ler o Inglês: produza a fala em inglês guiando-se apenas pela tradução em português abaixo:'
            : 'O navegador ou ambiente atual não possui permissão de gravação direta. Digite ou use a simulação abaixo:'}
        </p>
        <p
          id="fallbackTargetText"
          className={`text-xs font-mono p-2.5 rounded-xl border mt-2 select-text break-words ${
            hideEnglishText
              ? 'text-emerald-300 bg-emerald-950/40 border-emerald-500/40'
              : 'text-brand-300 bg-slate-800/80 border-slate-700/60'
          }`}
        >
          {hideEnglishText
            ? `🇧🇷 Apenas Português: "${ptHint || '...'}" (Texto em inglês oculto)`
            : targetSentence}
        </p>
        <label htmlFor="fallbackSpokenInput" className="sr-only">
          Digite o que você falou em inglês
        </label>
        <input
          type="text"
          id="fallbackSpokenInput"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const val = inputVal.trim() || targetSentence;
              setInputVal('');
              onSubmitSpeech(val);
            }
          }}
          placeholder="Digite o que você falou em inglês..."
          className="w-full mt-3 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-base sm:text-xs text-white focus:outline-none focus:border-brand-500"
        />
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            id="btnFallbackExact"
            type="button"
            onClick={() => {
              setInputVal('');
              onSubmitSpeech(targetSentence);
            }}
            className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 cursor-pointer whitespace-nowrap"
          >
            Simular Acerto (100%)
          </button>
          <button
            id="btnFallbackSubmit"
            type="button"
            onClick={() => {
              const val = inputVal.trim() || targetSentence;
              setInputVal('');
              onSubmitSpeech(val);
            }}
            className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
          >
            Validar
          </button>
        </div>
      </div>
    </div>
  );
};
