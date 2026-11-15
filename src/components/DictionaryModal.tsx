import React, { useEffect, useState } from 'react';
import { DICT_DB } from '../data/dictionaryDb';
import {
  fetchOnlineDictionaryDetails,
  getWordInfo,
  resolveWordTranslation
} from '../services/audioAndTranslationService';
import { cleanString, getBrazilianPhoneticTip } from '../utils/shadowing';

interface DictionaryModalProps {
  word: string | null;
  contextSentence: string;
  onClose: () => void;
  onSpeakWord: (word: string) => void;
  onSaveVocab: (word: string, formattedSentence: string) => void;
}

export const DictionaryModal: React.FC<DictionaryModalProps> = ({
  word,
  contextSentence,
  onClose,
  onSpeakWord,
  onSaveVocab
}) => {
  const [phonetic, setPhonetic] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('Vocabulário');
  const [translation, setTranslation] = useState('');
  const [definition, setDefinition] = useState('');

  useEffect(() => {
    if (!word) return;
    const clean = cleanString(word);
    const info = getWordInfo(clean);

    setPhonetic(info.ipa || `/${clean}/`);
    setPartOfSpeech(info.pos || 'Vocabulário');
    setTranslation(info.pt === '...' ? 'Buscando tradução...' : info.pt);
    setDefinition(info.def);

    let cancelled = false;

    if (!DICT_DB[clean] || info.pt === '...') {
      resolveWordTranslation(clean).then(realPt => {
        if (!cancelled && realPt) {
          setTranslation(realPt);
          setDefinition(prev =>
            prev.startsWith('Consultando')
              ? `Significado em português: "${realPt}". Palavra presente na frase em estudo.`
              : prev
          );
        }
      });

      fetchOnlineDictionaryDetails(clean).then(details => {
        if (cancelled) return;
        if (details.phonetic) setPhonetic(details.phonetic);
        if (details.partOfSpeech) setPartOfSpeech(details.partOfSpeech);
        if (details.enDefinition) {
          setDefinition(prev => {
            const ptClean = prev.includes('Significado em português') ? prev + ' ' : '';
            return `${ptClean}Definição em inglês: ${details.enDefinition}`;
          });
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [word]);

  if (!word) return null;
  const clean = cleanString(word);
  const phoneticTip = getBrazilianPhoneticTip(clean);

  return (
    <div
      id="modalDictionary"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dictWordTitle"
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm sm:max-w-md lg:max-w-lg w-full p-4 sm:p-5 max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl relative"
      >
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 id="dictWordTitle" className="text-lg sm:text-xl font-extrabold text-white">
                {word}
              </h3>
              <button
                id="btnDictSpeakWord"
                type="button"
                onClick={() => onSpeakWord(clean)}
                aria-label="Ouvir pronúncia da palavra"
                title="Ouvir pronúncia"
                className="p-1.5 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
              </button>
            </div>
            <p id="dictPhonetic" className="text-xs font-mono text-slate-400 mt-0.5">
              {phonetic}
            </p>
          </div>
          <button
            id="btnCloseDictModal"
            type="button"
            onClick={onClose}
            aria-label="Fechar dicionário"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="py-3 space-y-2.5 text-xs flex-1 min-h-0 overflow-y-auto pr-0.5">
          <div>
            <span
              id="dictPartOfSpeech"
              className="inline-block text-brand-300 font-semibold text-[11px] tracking-wide"
            >
              {partOfSpeech}
            </span>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-amber-400 tracking-wide">Tradução Direta</h4>
            <p id="dictTranslation" className="text-sm font-semibold text-slate-100 mt-0.5">
              {translation}
            </p>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-slate-400 tracking-wide">Significado & Uso</h4>
            <p id="dictDefinition" className="text-slate-300 leading-relaxed mt-0.5">
              {definition}
            </p>
          </div>

          {phoneticTip && (
            <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/30">
              <span className="text-[10px] text-indigo-300 font-bold block mb-0.5">
                💡 Dica Fonética ({phoneticTip.category}):
              </span>
              <p className="text-slate-200 text-[11px] leading-relaxed">{phoneticTip.tip}</p>
            </div>
          )}

          <div
            id="dictExampleContainer"
            className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60"
          >
            <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">
              Exemplo no Livro:
            </span>
            <p id="dictExample" className="italic text-slate-300 text-xs">
              "{contextSentence}"
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <button
            id="btnDictSaveVocab"
            type="button"
            onClick={() => {
              onSaveVocab(clean, `${clean} (${translation}) — Ex: "${contextSentence}"`);
              onClose();
            }}
            className="flex-1 min-h-[44px] sm:min-h-0 py-2.5 sm:py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            Salvar no Caderno
          </button>
          <button
            id="btnDictCloseBottom"
            type="button"
            onClick={onClose}
            className="min-h-[44px] sm:min-h-0 px-3.5 py-2.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
