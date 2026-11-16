import React, { useEffect, useMemo, useState } from 'react';
import { CefrLevel, Sentence, SentenceProgress } from '../types/shadowreader';
import { classifySentenceCefr } from '../utils/shadowing';

interface SentenceNavigatorModalProps {
  isOpen: boolean;
  bookTitle: string;
  sentences: Sentence[];
  currentIndex: number;
  sentenceProgress: Record<number, SentenceProgress>;
  onSelectSentence: (index: number) => void;
  onClose: () => void;
}

const NAV_BATCH_SIZE = 40;

export const SentenceNavigatorModal: React.FC<SentenceNavigatorModalProps> = ({
  isOpen,
  bookTitle,
  sentences,
  currentIndex,
  sentenceProgress,
  onSelectSentence,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [cefrFilter, setCefrFilter] = useState<'all' | 'A1-A2' | 'B1-B2' | 'C1'>('all');
  const [visibleLimit, setVisibleLimit] = useState<number>(NAV_BATCH_SIZE);

  // Fresh search/filters on every open (stale values made sentences look missing).
  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setStatusFilter('all');
    setCefrFilter('all');
  }, [isOpen]);

  // Ensure current sentence is within the initial visible window when modal opens
  useEffect(() => {
    if (isOpen) {
      const requiredLimit = Math.max(
        NAV_BATCH_SIZE,
        Math.ceil((currentIndex + 10) / NAV_BATCH_SIZE) * NAV_BATCH_SIZE
      );
      setVisibleLimit(requiredLimit);
    }
  }, [isOpen, currentIndex]);

  // Memoize CEFR levels strictly on `sentences` so large books don't re-classify on progress updates
  const sentenceCefrLevels = useMemo<CefrLevel[]>(() => {
    return sentences.map(s => s.cefrLevel || classifySentenceCefr(s.en));
  }, [sentences]);

  const enrichedSentences = useMemo(() => {
    return sentences.map((s, idx) => {
      const cefr: CefrLevel = sentenceCefrLevels[idx] || 'A1';
      const prog = sentenceProgress[idx];
      return {
        index: idx,
        en: s.en,
        pt: s.pt,
        cefr,
        actTitle: s.actTitle,
        grammarRule: s.grammarRule,
        completed: Boolean(prog?.completed),
        bestScore: prog?.bestScore ?? null
      };
    });
  }, [sentences, sentenceCefrLevels, sentenceProgress]);

  const filteredSentences = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedSentences.filter(item => {
      if (statusFilter === 'completed' && !item.completed) return false;
      if (statusFilter === 'pending' && item.completed) return false;

      if (cefrFilter === 'A1-A2' && item.cefr !== 'A1' && item.cefr !== 'A2') return false;
      if (cefrFilter === 'B1-B2' && item.cefr !== 'B1' && item.cefr !== 'B2') return false;
      if (cefrFilter === 'C1' && item.cefr !== 'C1') return false;

      if (q) {
        const matchEn = item.en.toLowerCase().includes(q);
        const matchPt = (item.pt || '').toLowerCase().includes(q);
        const matchNum = `${item.index + 1}` === q;
        return matchEn || matchPt || matchNum;
      }
      return true;
    });
  }, [enrichedSentences, searchQuery, statusFilter, cefrFilter]);

  if (!isOpen) return null;

  const completedCount = enrichedSentences.filter(s => s.completed).length;
  const visibleSentences = filteredSentences.slice(0, visibleLimit);
  const remainingFilteredCount = Math.max(0, filteredSentences.length - visibleSentences.length);

  return (
    <div
      id="modalSentenceNavigator"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-40 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sentenceNavTitle"
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl lg:max-w-3xl xl:max-w-[880px] w-full p-4 sm:p-5 max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div>
            <h3
              id="sentenceNavTitle"
              className="text-base font-bold text-white flex items-center gap-2"
            >
              <svg
                className="w-4 h-4 text-brand-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h10"
                />
              </svg>
              Índice & Navegador de Sentenças
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {bookTitle} · {completedCount} de {sentences.length} concluídas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar navegador de sentenças"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Search & Filters */}
        <div className="mt-3 space-y-2.5 shrink-0">
          <div>
            <label htmlFor="sentenceSearchInput" className="sr-only">
              Buscar palavra ou número da sentença
            </label>
            <input
              id="sentenceSearchInput"
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setVisibleLimit(NAV_BATCH_SIZE);
              }}
              placeholder="Buscar palavra em inglês, tradução ou número da frase..."
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-base sm:text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Status segmented control */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-800/80 rounded-lg border border-slate-700/60 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`flex-1 sm:flex-none px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todas ({sentences.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`flex-1 sm:flex-none px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Concluídas ({completedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`flex-1 sm:flex-none px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                  statusFilter === 'pending'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pendentes ({sentences.length - completedCount})
              </button>
            </div>

            {/* CEFR Level segmented control */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-800/80 rounded-lg border border-slate-700/60 w-full sm:w-auto">
              {(['all', 'A1-A2', 'B1-B2', 'C1'] as const).map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setCefrFilter(lvl)}
                  className={`flex-1 sm:flex-none px-2 py-1.5 sm:py-1 rounded-md text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                    cefrFilter === lvl
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl === 'all' ? 'Todos' : lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sentence List (Staged / Batched for Large Books) */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1" id="sentenceNavigatorList">
          {filteredSentences.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              Nenhuma sentença encontrada para o filtro selecionado.
            </p>
          ) : (
            <>
              {visibleSentences.map(item => {
                const isCurrent = item.index === currentIndex;
                return (
                  <button
                    key={item.index}
                    type="button"
                    onClick={() => {
                      onSelectSentence(item.index);
                      onClose();
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition flex items-start justify-between gap-3 cursor-pointer ${
                      isCurrent
                        ? 'border-brand-500 bg-brand-500/15'
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 tabular-nums mb-1">
                        <span className="font-mono font-bold text-brand-300">
                          #{item.index + 1}
                        </span>
                        <span>·</span>
                        <span className="text-indigo-300 font-semibold">Nível {item.cefr}</span>
                        {item.actTitle && (
                          <>
                            <span>·</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-semibold">
                              {item.actTitle}
                            </span>
                          </>
                        )}
                        {item.completed && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-400 font-semibold">
                              ✓ Concluída ({item.bestScore}%)
                            </span>
                          </>
                        )}
                        {isCurrent && (
                          <>
                            <span>·</span>
                            <span className="text-amber-300 font-semibold">Sentença Atual</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                        {item.en}
                      </p>
                      {item.pt && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.pt}</p>
                      )}
                      {item.grammarRule && (
                        <p className="text-[11px] text-emerald-300/90 mt-1 font-medium">
                          🇺🇸 Regra: {item.grammarRule}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-brand-400 font-semibold shrink-0 self-center whitespace-nowrap">
                      Ir →
                    </span>
                  </button>
                );
              })}

              {remainingFilteredCount > 0 && (
                <div className="pt-2 pb-1 text-center">
                  <button
                    id="btnLoadMoreNavSentences"
                    type="button"
                    onClick={() => setVisibleLimit(prev => prev + NAV_BATCH_SIZE)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-brand-300 hover:text-white text-xs font-bold transition cursor-pointer"
                  >
                    ➕ Carregar mais frases ({remainingFilteredCount} restantes)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
