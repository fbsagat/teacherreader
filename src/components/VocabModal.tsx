import React, { useEffect, useMemo, useState } from 'react';
import { VocabItem } from '../types/shadowreader';
import { isVocabDueForReview } from '../utils/shadowing';
import { localDayKey } from '../utils/localTime';

interface VocabModalProps {
  isOpen: boolean;
  savedVocab: VocabItem[];
  onClose: () => void;
  onDeleteItem: (index: number) => void;
  onRateSrsItem: (word: string, quality: 2 | 4 | 5) => void;
  onClearAll: () => void;
  onSpeakText: (text: string) => void;
  onShowToast: (msg: string) => void;
}

export const VocabModal: React.FC<VocabModalProps> = ({
  isOpen,
  savedVocab,
  onClose,
  onDeleteItem,
  onRateSrsItem,
  onClearAll,
  onSpeakText,
  onShowToast
}) => {
  const [practiceMode, setPracticeMode] = useState(false);
  const [onlyDueSrs, setOnlyDueSrs] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Reset the deck/flip state every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setPracticeMode(false);
    setOnlyDueSrs(false);
    setCardIndex(0);
    setFlipped(false);
  }, [isOpen]);

  const dueCards = useMemo(() => {
    const now = new Date();
    return savedVocab.filter(item => isVocabDueForReview(item, now));
  }, [savedVocab]);

  const activeDeck = onlyDueSrs && dueCards.length > 0 ? dueCards : savedVocab;
  const safeIndex = activeDeck.length > 0 ? cardIndex % activeDeck.length : 0;
  const currentCard = activeDeck[safeIndex];

  if (!isOpen) return null;

  const handleExport = () => {
    if (savedVocab.length === 0) {
      onShowToast('Nenhuma palavra salva para exportar.');
      return;
    }
    const text = savedVocab
      .map(
        v =>
          `${v.word}\t${v.sentence}\t${v.date}\tIntervalo SRS: ${v.interval || 0}d`
      )
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shadowreader_vocab_${localDayKey()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRateCard = (quality: 2 | 4 | 5) => {
    if (!currentCard) return;
    onRateSrsItem(currentCard.word, quality);
    setFlipped(false);
    setCardIndex(i => (i + 1) % Math.max(1, activeDeck.length));
  };

  return (
    <div
      id="modalVocab"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vocabModalTitle"
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg lg:max-w-2xl xl:max-w-[760px] w-full p-4 sm:p-5 max-h-[92dvh] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div>
            <h3
              id="vocabModalTitle"
              className="text-base font-bold text-white flex items-center gap-2"
            >
              <svg
                className="w-4 h-4 text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              Caderno & Repetição Espaçada (SRS)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
              {savedVocab.length} termos salvos ·{' '}
              <span className="text-amber-300 font-semibold">
                {dueCards.length} para revisar hoje
              </span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {savedVocab.length > 0 && (
              <button
                id="btnToggleFlashcards"
                type="button"
                onClick={() => {
                  setPracticeMode(prev => !prev);
                  setCardIndex(0);
                  setFlipped(false);
                }}
                className="min-h-[38px] sm:min-h-0 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              >
                <span className="sm:hidden">{practiceMode ? 'Lista' : 'Flashcards'}</span>
                <span className="hidden sm:inline">{practiceMode ? 'Ver Lista' : 'Treinar Flashcards (SRS)'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar caderno de vocabulário"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {practiceMode && currentCard ? (
          <div className="my-4 p-4 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col items-center text-center min-h-[230px] justify-between overflow-y-auto flex-1">
            <div className="w-full flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <span>Repetição Espaçada (SM-2)</span>
                {dueCards.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOnlyDueSrs(prev => !prev);
                      setCardIndex(0);
                      setFlipped(false);
                    }}
                    className="text-[10px] text-brand-300 underline cursor-pointer"
                  >
                    {onlyDueSrs ? 'Mostrando apenas pendentes hoje' : 'Filtrar pendentes hoje'}
                  </button>
                )}
              </div>
              <span className="font-mono tabular-nums">
                {safeIndex + 1} / {activeDeck.length}
              </span>
            </div>

            <div className="my-4 space-y-2.5">
              <div className="flex items-center justify-center gap-2">
                <h4 className="text-xl font-extrabold text-amber-300">{currentCard.word}</h4>
                <button
                  type="button"
                  onClick={() => onSpeakText(currentCard.word)}
                  aria-label={`Ouvir ${currentCard.word}`}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                </button>
              </div>

              {flipped ? (
                <div className="space-y-3">
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-md mx-auto">
                    {currentCard.sentence}
                  </p>
                  <div className="pt-2">
                    <p className="text-[10px] text-slate-400 mb-1.5">
                      Como foi lembrar o significado e a pronúncia?
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        id="btnSrsHard"
                        type="button"
                        onClick={() => handleRateCard(2)}
                        className="min-h-[42px] sm:min-h-0 py-2 sm:py-1.5 px-2.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Difícil (Hoje)
                      </button>
                      <button
                        id="btnSrsGood"
                        type="button"
                        onClick={() => handleRateCard(4)}
                        className="min-h-[42px] sm:min-h-0 py-2 sm:py-1.5 px-2.5 rounded-lg bg-brand-950/80 hover:bg-brand-900 border border-brand-600/60 text-brand-200 text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Bom (1–3d)
                      </button>
                      <button
                        id="btnSrsEasy"
                        type="button"
                        onClick={() => handleRateCard(5)}
                        className="min-h-[42px] sm:min-h-0 py-2 sm:py-1.5 px-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-200 text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Fácil (4d+)
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  id="btnFlipFlashcard"
                  type="button"
                  onClick={() => setFlipped(true)}
                  className="min-h-[44px] sm:min-h-0 px-4 py-2.5 sm:py-2 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Revelar Resposta e Avaliar Memória
                </button>
              )}
            </div>

            <div className="w-full flex items-center justify-between pt-2 border-t border-slate-700/60 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFlipped(false);
                  setCardIndex(i => (i > 0 ? i - 1 : activeDeck.length - 1));
                }}
                className="min-h-[38px] sm:min-h-0 px-3 py-1.5 sm:py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                ← Anterior
              </button>
              <span className="text-[10px] text-slate-400 tabular-nums text-center">
                Intervalo: {currentCard.interval ? `${currentCard.interval}d` : 'Novo'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setFlipped(false);
                  setCardIndex(i => (i + 1) % activeDeck.length);
                }}
                className="min-h-[38px] sm:min-h-0 px-3 py-1.5 sm:py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Próximo →
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex-1 overflow-y-auto space-y-2" id="savedVocabList">
            {savedVocab.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Nenhuma frase salva ainda. Clique em "Salvar frase" ou toque em palavras para
                adicioná-las aqui.
              </p>
            ) : (
              savedVocab.map((item, idx) => {
                const isDue = isVocabDueForReview(item);
                return (
                  <div
                    key={`${item.word}-${idx}`}
                    className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-brand-300 text-xs">{item.word}</span>
                        <button
                          type="button"
                          onClick={() => onSpeakText(item.word.replace(/['"]/g, ''))}
                          aria-label={`Ouvir pronúncia de ${item.word}`}
                          title="Ouvir pronúncia"
                          className="p-0.5 rounded text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                            />
                          </svg>
                        </button>
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          ·{' '}
                          {isDue ? (
                            <span className="text-amber-400 font-semibold">Revisar hoje</span>
                          ) : (
                            <span className="text-emerald-400">
                              Próxima em {item.interval}d
                            </span>
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed break-words">
                        {item.sentence}
                      </p>
                      <span className="text-[10px] text-slate-400">Salvo em {item.date}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteItem(idx)}
                      aria-label={`Remover termo ${item.word}`}
                      title="Remover termo"
                      className="text-slate-400 hover:text-rose-400 p-1 shrink-0 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs shrink-0">
          <button
            id="btnClearVocab"
            type="button"
            onClick={onClearAll}
            className="text-rose-400 hover:text-rose-300 cursor-pointer whitespace-nowrap"
          >
            Limpar Tudo
          </button>
          <button
            id="btnExportVocab"
            type="button"
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 cursor-pointer whitespace-nowrap"
          >
            Exportar (TXT)
          </button>
        </div>
      </div>
    </div>
  );
};
