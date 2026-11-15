import React, { useRef, useState } from 'react';
import { SAMPLE_BOOKS } from '../data/dictionaryDb';
import { Book, BookLengthCategory, CefrLevel } from '../types/shadowreader';
import {
  parseUploadedStudyFile,
  SUPPORTED_FILE_EXTENSIONS,
  SUPPORTED_FORMATS_BADGES
} from '../utils/fileParsers';
import { segmentBookText } from '../utils/shadowing';

export type LibraryTabId = 'catalog' | 'saved' | 'upload';

interface LibraryModalProps {
  isOpen: boolean;
  currentBookId: string;
  savedBooks: Book[];
  onClose: () => void;
  onSelectBook: (book: Book, resumeIndex?: number) => void;
  onDeleteSavedBook: (bookId: string, title: string) => void;
  onUploadBook: (book: Book) => Promise<void>;
  onShowToast: (msg: string) => void;
}

const LEVEL_FILTERS: { id: 'ALL' | CefrLevel; label: string }[] = [
  { id: 'ALL', label: 'Todos Níveis' },
  { id: 'A1', label: 'A1 · Iniciante' },
  { id: 'A2', label: 'A2 · Básico' },
  { id: 'B1', label: 'B1 · Interm.' },
  { id: 'B2', label: 'B2 · Avançado' },
  { id: 'C1', label: 'C1 · Fluente' }
];

const LENGTH_FILTERS: { id: 'ALL' | BookLengthCategory; label: string }[] = [
  { id: 'ALL', label: 'Todos Tamanhos' },
  { id: 'Pequeno', label: 'Pequeno' },
  { id: 'Médio', label: 'Médio' },
  { id: 'Grande', label: 'Grande' }
];

const LEVEL_BADGE_STYLES: Record<CefrLevel, string> = {
  A1: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  A2: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  B1: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  B2: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  C1: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
};

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  currentBookId,
  savedBooks,
  onClose,
  onSelectBook,
  onDeleteSavedBook,
  onUploadBook,
  onShowToast
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<LibraryTabId>('catalog');
  const [pdfLoadingText, setPdfLoadingText] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customText, setCustomText] = useState('');
  const [customError, setCustomError] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<'ALL' | CefrLevel>('ALL');
  const [selectedLength, setSelectedLength] = useState<'ALL' | BookLengthCategory>('ALL');

  if (!isOpen) return null;

  const filteredSampleBooks = SAMPLE_BOOKS.filter(b => {
    const matchLevel =
      selectedLevel === 'ALL' ||
      b.cefrLevel === selectedLevel ||
      Boolean(b.isProgressiveMasterpiece);
    const matchLength = selectedLength === 'ALL' || b.lengthCategory === selectedLength;
    return matchLevel && matchLength;
  });

  const activeBookObj =
    savedBooks.find(b => b.id === currentBookId) ||
    SAMPLE_BOOKS.find(b => b.id === currentBookId);

  const handleStudyFileUpload = async (file: File) => {
    setPdfLoadingText(`Carregando "${file.name}"...`);
    try {
      const parsedResult = await parseUploadedStudyFile(file, status => {
        setPdfLoadingText(status);
      });

      const newBook: Book = {
        id: 'book_' + Date.now(),
        title: parsedResult.title,
        author: parsedResult.author,
        sentences: parsedResult.sentences,
        currentIndex: 0
      };

      setPdfLoadingText('Traduzindo primeira sentença...');
      await onUploadBook(newBook);
      setPdfLoadingText(null);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao ler arquivo';
      onShowToast('Erro ao importar arquivo: ' + msg);
      setPdfLoadingText(null);
    }
  };

  const handleCreateFromCustomText = async (e: React.FormEvent) => {
    e.preventDefault();
    const titleTrim = customTitle.trim();
    const textTrim = customText.trim();
    if (!titleTrim) {
      setCustomError('Informe um título para o texto.');
      return;
    }
    const parsed = segmentBookText(textTrim);
    if (parsed.length === 0) {
      setCustomError('Insira ao menos uma frase completa em inglês (mínimo 15 caracteres).');
      return;
    }
    setCustomError('');
    const newBook: Book = {
      id: 'custom_' + Date.now(),
      title: titleTrim,
      author: 'Texto Personalizado',
      sentences: parsed,
      currentIndex: 0
    };
    await onUploadBook(newBook);
    setCustomTitle('');
    setCustomText('');
    onClose();
  };

  const TABS: {
    id: LibraryTabId;
    domId: string;
    shortLabel: string;
    label: string;
    icon: string;
    badge?: string;
    hideBadgeOnMobile?: boolean;
  }[] = [
    {
      id: 'catalog',
      domId: 'tabLibraryCatalog',
      shortLabel: 'Catálogo',
      label: 'Catálogo de Histórias',
      icon: '📚',
      badge: `${SAMPLE_BOOKS.length}`
    },
    {
      id: 'saved',
      domId: 'tabLibrarySaved',
      shortLabel: 'Salvos',
      label: 'Meus Livros Salvos',
      icon: '🔖',
      badge: `${savedBooks.length}`
    },
    {
      id: 'upload',
      domId: 'tabLibraryUpload',
      shortLabel: 'Importar',
      label: 'Importar & Colar Texto',
      icon: '📤',
      badge: '10 formatos',
      hideBadgeOnMobile: true
    }
  ];

  return (
    <div
      id="modalLibrary"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="libraryModalTitle"
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl lg:max-w-4xl xl:max-w-[980px] w-full p-4 sm:p-5 max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <h3
              id="libraryModalTitle"
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <span>Biblioteca de Livros & Upload</span>
            </h3>
            {activeBookObj && (
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                Lendo agora:{' '}
                <strong className="text-brand-300 font-semibold">{activeBookObj.title}</strong>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar biblioteca"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div
          id="libraryTabsNav"
          role="tablist"
          aria-label="Abas da Biblioteca"
          className="grid grid-cols-3 gap-1 sm:gap-1.5 bg-slate-950/90 p-1 sm:p-1.5 rounded-xl border border-slate-800/90 mt-2.5 shrink-0"
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
                className={`min-h-[40px] sm:min-h-0 px-1.5 sm:px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap overflow-hidden ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span className="truncate">
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
                {tab.badge && (
                  <span
                    className={`${tab.hideBadgeOnMobile ? 'hidden sm:inline-block' : ''} text-[9px] px-1.5 py-0.2 rounded font-mono font-bold shrink-0 ${
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
          {/* TAB 1: SAMPLE BOOKS CATALOG WITH FILTERS */}
          {activeTab === 'catalog' && (
            <div id="tabPanelCatalog" className="space-y-2.5">
              {/* Compact Filters Box */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-[11px] font-bold text-slate-300">
                    Exibindo {filteredSampleBooks.length} de {SAMPLE_BOOKS.length} histórias
                  </span>

                  {/* Length Filter Pills */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {LENGTH_FILTERS.map(lf => (
                      <button
                        key={lf.id}
                        type="button"
                        id={`filterLength_${lf.id}`}
                        onClick={() => setSelectedLength(lf.id)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition cursor-pointer ${
                          selectedLength === lf.id
                            ? 'bg-brand-600 text-white border-brand-500'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {lf.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty / CEFR Level Filter Pills */}
                <div className="flex items-center gap-1 flex-wrap pt-1.5 border-t border-slate-800/80">
                  {LEVEL_FILTERS.map(lv => (
                    <button
                      key={lv.id}
                      type="button"
                      id={`filterLevel_${lv.id}`}
                      onClick={() => setSelectedLevel(lv.id)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                        selectedLevel === lv.id
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                          : 'bg-slate-900 text-slate-300 border-slate-700/80 hover:border-indigo-400/50'
                      }`}
                    >
                      {lv.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Books Grid */}
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
                id="sampleBooksList"
              >
                {filteredSampleBooks.map(b => {
                  const isActive = b.id === currentBookId;
                  const isMasterpiece = Boolean(b.isProgressiveMasterpiece);
                  const levelStyle = isMasterpiece
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                    : b.cefrLevel
                      ? LEVEL_BADGE_STYLES[b.cefrLevel]
                      : 'bg-slate-800 text-slate-300 border-slate-700';

                  return (
                    <div
                      key={b.id}
                      data-book-id={b.id}
                      onClick={() => {
                        const savedIdxStr = localStorage.getItem(`sr_bookmark_${b.id}`);
                        const savedIdx = savedIdxStr ? parseInt(savedIdxStr, 10) : 0;
                        const validIdx = isNaN(savedIdx)
                          ? 0
                          : Math.min(savedIdx, b.sentences.length - 1);
                        onSelectBook(b, validIdx);
                        onClose();
                      }}
                      className={`p-3 rounded-xl border ${
                        isMasterpiece ? 'sm:col-span-2 lg:col-span-3' : ''
                      } ${
                        isActive
                          ? 'border-brand-500/70 bg-brand-500/10 ring-1 ring-brand-500/40'
                          : isMasterpiece
                            ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-slate-950/80 hover:border-amber-400'
                            : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/70 hover:border-slate-700'
                      } cursor-pointer transition flex flex-col justify-between gap-2`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isMasterpiece && (
                              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-amber-500 text-slate-950 uppercase tracking-wider">
                                ⭐ Obra-Prima Autoral
                              </span>
                            )}
                            {b.cefrLevel && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${levelStyle}`}
                              >
                                {isMasterpiece
                                  ? 'A1 → A2 → B1 → B2 → C1 · Progressivo'
                                  : `${b.cefrLevel} · ${b.difficultyLabel}`}
                              </span>
                            )}
                          </div>
                          {b.lengthCategory && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                              {b.lengthCategory} ({b.sentences.length} frases)
                            </span>
                          )}
                        </div>

                        <h5 className="text-xs sm:text-sm font-bold text-white leading-snug">
                          {b.title}
                        </h5>
                        <p className="text-[10px] sm:text-[11px] text-slate-300 mt-0.5">
                          {b.author}
                        </p>
                        {isMasterpiece && (
                          <p className="text-[10px] text-amber-200/90 mt-1 leading-relaxed">
                            Romance, mistério e drama em Boston (EUA) dividido em 5 Atos (do A1 ao C1):
                            começa com as palavras e frases mais fáceis e usadas no dia a dia americano
                            e avança progressivamente até estruturas avançadas, com nota gramatical em
                            cada frase.
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
                        <span className="text-[10px] text-brand-300 font-medium truncate">
                          {b.contextTag || 'Leitura Geral'}
                        </span>
                        <button
                          type="button"
                          className={`px-2.5 py-1 rounded-lg ${
                            isMasterpiece
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                              : 'bg-brand-600/30 hover:bg-brand-600 text-brand-300 hover:text-white font-semibold'
                          } text-[10px] transition shrink-0 whitespace-nowrap cursor-pointer`}
                        >
                          {isActive ? 'Lendo Agora' : isMasterpiece ? 'Estudar Obra-Prima' : 'Estudar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SAVED & IMPORTED BOOKS (CONTINUE READING) */}
          {activeTab === 'saved' && (
            <div id="savedBooksSection" className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold tracking-wide text-emerald-400 flex items-center gap-1.5">
                  <span>🔖 Meus Livros em Andamento & Importados</span>
                </h4>
                <span
                  id="savedBooksCountBadge"
                  className="text-[10px] text-slate-400 font-mono tabular-nums"
                >
                  {savedBooks.length} {savedBooks.length === 1 ? 'livro salvo' : 'livros salvos'}
                </span>
              </div>

              {savedBooks.length === 0 ? (
                <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/60 text-center space-y-3">
                  <p className="text-xs text-slate-300 font-medium">
                    Você ainda não tem livros salvos ou importados na sua estante.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Ao estudar qualquer livro ou importar um arquivo, seu progresso de leitura fica
                    salvo automaticamente aqui!
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('catalog')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                    >
                      📚 Explorar Catálogo
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      📤 Importar Arquivo / Texto
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2" id="savedBooksList">
                  {savedBooks.map(b => {
                    const isCurrent = b.id === currentBookId;
                    const curIdx = b.currentIndex || 0;
                    const total = b.totalSentences || b.sentences.length || 1;
                    const pct = b.progressPercent || Math.round(((curIdx + 1) / total) * 100);
                    const lastDate = b.lastRead
                      ? new Date(b.lastRead).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Recente';

                    return (
                      <div
                        key={b.id}
                        className={`p-3 rounded-xl border ${
                          isCurrent
                            ? 'border-brand-500/60 bg-brand-500/10'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        } flex items-center justify-between gap-2 transition`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs sm:text-sm font-bold text-white truncate">
                              {b.title}
                            </h5>
                            {isCurrent && (
                              <span className="text-[10px] text-brand-300 font-semibold shrink-0">
                                · Lendo agora
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 tabular-nums">
                            <span className="text-emerald-400 font-medium">
                              Sentença {curIdx + 1} de {total} ({pct}%)
                            </span>
                            <span>·</span>
                            <span>Lido em {lastDate}</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1 mt-1.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-emerald-500 to-brand-500 h-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectBook(b, curIdx);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition cursor-pointer whitespace-nowrap"
                          >
                            Continuar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSavedBook(b.id, b.title)}
                            aria-label={`Excluir livro salvo ${b.title}`}
                            title="Excluir livro salvo"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: IMPORT FILE & PASTE CUSTOM TEXT */}
          {activeTab === 'upload' && (
            <div id="tabPanelUpload" className="space-y-3">
              {/* 1. Multi-Format File Dropzone */}
              <div
                id="pdfDropZone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files.length > 0) {
                    handleStudyFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className={`border-2 border-dashed ${
                  isDragging
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-slate-700 hover:border-brand-500'
                } rounded-xl p-3.5 text-center cursor-pointer transition bg-slate-950/60 group`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="pdfFileInput"
                  accept={`${SUPPORTED_FILE_EXTENSIONS.join(',')},application/pdf,text/plain,text/markdown,text/csv,application/json,text/html,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document`}
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleStudyFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <div className="flex items-center justify-center gap-2 text-slate-200 font-bold text-xs sm:text-sm">
                  <svg
                    className="w-5 h-5 text-brand-400 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span>1. Importar Livro, E-Book, Artigo ou Legenda</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Arraste seu arquivo aqui ou clique para selecionar do seu dispositivo
                </p>

                {/* Supported Format Badges */}
                <div
                  id="supportedFormatsRow"
                  className="flex flex-wrap items-center justify-center gap-1 mt-2.5"
                >
                  {SUPPORTED_FORMATS_BADGES.map(fmt => (
                    <span
                      key={fmt.ext}
                      title={`${fmt.desc} (${fmt.label})`}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-[10px] font-mono font-bold text-brand-300 group-hover:border-brand-500/40 transition"
                    >
                      {fmt.ext}
                    </span>
                  ))}
                </div>

                {pdfLoadingText && (
                  <p id="pdfLoadingStatus" className="text-xs text-brand-400 font-medium mt-2">
                    {pdfLoadingText}
                  </p>
                )}
              </div>

              {/* 2. Paste Text / Article Form (Directly visible in this tab) */}
              <form
                onSubmit={handleCreateFromCustomText}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    2. Ou Cole um Texto, Artigo ou Capítulo em Inglês
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Divisão automática em frases
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="customTitleInput"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Título do Estudo / Artigo
                  </label>
                  <input
                    id="customTitleInput"
                    type="text"
                    value={customTitle}
                    onChange={e => setCustomTitle(e.target.value)}
                    placeholder="Ex: Artigo da BBC, Diálogo ou Capítulo 1..."
                    className="w-full px-3 py-2 sm:py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-base sm:text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="customBodyInput"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Texto em Inglês
                  </label>
                  <textarea
                    id="customBodyInput"
                    rows={4}
                    value={customText}
                    onChange={e => setCustomText(e.target.value)}
                    placeholder="Cole os parágrafos em inglês aqui..."
                    className="w-full px-3 py-2 sm:py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-base sm:text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                {customError && <p className="text-[11px] text-rose-400">{customError}</p>}

                <div className="flex justify-end">
                  <button
                    id="btnCreateCustomBook"
                    type="submit"
                    className="w-full sm:w-auto min-h-[42px] sm:min-h-0 px-3.5 py-2 sm:py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shadow-sm"
                  >
                    Criar e Estudar Agora
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[10px] text-slate-400 leading-tight">
            Dica: O progresso de cada livro é salvo automaticamente na frase atual.
          </span>
          <button
            id="btnCloseLibraryFooter"
            type="button"
            onClick={onClose}
            className="min-h-[40px] sm:min-h-0 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs cursor-pointer transition shrink-0"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
