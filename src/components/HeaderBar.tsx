import React from 'react';
import { ThemeMode } from '../types/shadowreader';
import type { DriveSyncUiStatus } from './GoogleDriveSyncModal';

import { CoffeeCupIcon } from './CoffeeCupIcon';

interface HeaderBarProps {
  bookTitle: string;
  vocabCount: number;
  dueSrsCount: number;
  themeMode: ThemeMode;
  driveSyncStatus?: DriveSyncUiStatus;
  onCycleTheme: () => void;
  onOpenDonateCoffee: () => void;
  onOpenDriveSync: () => void;
  onOpenStats: () => void;
  onOpenLibrary: () => void;
  onOpenVocab: () => void;
  onOpenSettings: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  bookTitle,
  vocabCount,
  dueSrsCount,
  themeMode,
  driveSyncStatus = 'disconnected',
  onCycleTheme,
  onOpenDonateCoffee,
  onOpenDriveSync,
  onOpenStats,
  onOpenLibrary,
  onOpenVocab,
  onOpenSettings
}) => {
  const themeMeta: Record<ThemeMode, { icon: string; name: string; full: string }> = {
    dark: { icon: '🌙', name: 'Escuro', full: '🌙 Escuro' },
    light: { icon: '☀️', name: 'Claro', full: '☀️ Claro' },
    sepia: { icon: '📜', name: 'Sépia', full: '📜 Sépia' },
    forest: { icon: '🌲', name: 'Floresta', full: '🌲 Floresta' },
    ocean: { icon: '🌊', name: 'Oceano', full: '🌊 Oceano' },
    amethyst: { icon: '🔮', name: 'Ametista', full: '🔮 Ametista' }
  };
  const currentTheme = themeMeta[themeMode] || themeMeta.dark;

  return (
    <header className="relative bg-slate-900/95 backdrop-blur border-b border-slate-800 px-2.5 pt-[max(0.45rem,env(safe-area-inset-top))] pb-2 sm:px-6 lg:px-10 xl:px-12 sm:py-2.5 shrink-0 flex items-center justify-between gap-1.5 sm:gap-2 z-20 min-h-13 sm:min-h-14 overflow-x-clip">
      {/* Left: Brand Logo, Title & Desktop Subtitle */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow shadow-brand-500/20 text-white font-bold text-xs sm:text-sm shrink-0">
          TR
        </div>
        <div className="min-w-0">
          <h1
            id="appBrandTitle"
            className="text-xs sm:text-sm font-bold tracking-normal text-white truncate leading-tight"
          >
            Teacher Reader
          </h1>
          <p
            id="appBrandSubtitle"
            className="hidden sm:block text-xs text-slate-400 font-medium truncate leading-tight"
          >
            Learn While You Read
          </p>
        </div>
      </div>

      {/* Center: Book Title Pill on Tablet/Desktop (Mobile renders dedicated book bar in <main>) */}
      {bookTitle && (
        <div className="hidden md:flex flex-1 min-w-0 justify-center px-2">
          <button
            id="bookTitleDisplay"
            type="button"
            onClick={onOpenLibrary}
            title={`Livro atual: ${bookTitle} (Clique para trocar de livro)`}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 hover:border-brand-500/50 text-slate-200 text-xs font-semibold max-w-[300px] lg:max-w-[420px] xl:max-w-[560px] shadow-sm transition cursor-pointer min-w-0"
          >
            <span aria-hidden="true" className="shrink-0">
              📖
            </span>
            <span className="truncate">{bookTitle}</span>
          </button>
        </div>
      )}

      {/* Right Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Buy Me a Coffee Donation Button (Tablet/Desktop header; compact mobile button sits in study toolbar) */}
        <button
          id="btnDonateCoffee"
          type="button"
          onClick={onOpenDonateCoffee}
          aria-label="Apoiar o projeto — Pagar um café via Pix ou Cripto"
          title="Pague um café para apoiar o projeto (Pix ou Criptomoedas)"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FFDD00] hover:bg-[#FFE63B] active:scale-95 text-[11px] font-extrabold text-[#18181b] border border-amber-300/80 shadow-xs transition whitespace-nowrap shrink-0 cursor-pointer"
        >
          <CoffeeCupIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden lg:inline">Pagar um café</span>
          <span className="lg:hidden">Apoiar</span>
        </button>

        {/* Theme Switcher (Icon-only on narrow mobile, full label on sm+) */}
        <button
          id="btnThemeCycle"
          type="button"
          onClick={onCycleTheme}
          aria-label={`Alternar tema de leitura (Atual: ${currentTheme.full})`}
          title={`Tema atual: ${currentTheme.full} (Clique para alternar entre os 6 temas)`}
          className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-1.5 sm:px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-sm sm:text-[11px] font-semibold text-slate-200 border border-slate-700/80 transition whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-1"
        >
          <span aria-hidden="true">{currentTheme.icon}</span>
          <span className="hidden sm:inline">{currentTheme.name}</span>
        </button>

        {/* Google Drive Invisible Auto-Sync */}
        <button
          id="btnDriveSync"
          type="button"
          onClick={onOpenDriveSync}
          aria-label="Backup e Sincronização no Google Drive"
          title={
            driveSyncStatus === 'synced'
              ? 'Google Drive: Sincronização automática ativa'
              : driveSyncStatus === 'syncing' || driveSyncStatus === 'checking'
                ? 'Google Drive: Sincronizando...'
                : driveSyncStatus === 'needs_confirmation' || driveSyncStatus === 'needs_reauth'
                  ? 'Google Drive: Clique para confirmar ou reconectar'
                  : 'Conectar Google Drive para backup automático invisível'
          }
          className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-sky-300 relative transition shrink-0 cursor-pointer flex items-center justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
            />
          </svg>
          {driveSyncStatus !== 'disconnected' && (
            <span
              className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                driveSyncStatus === 'synced'
                  ? 'bg-emerald-400'
                  : driveSyncStatus === 'syncing' || driveSyncStatus === 'checking'
                    ? 'bg-sky-400 animate-pulse'
                    : driveSyncStatus === 'error'
                      ? 'bg-rose-400'
                      : 'bg-amber-400 animate-pulse'
              }`}
            />
          )}
        </button>

        {/* Study Progress & Stats */}
        <button
          id="btnStatsModal"
          type="button"
          onClick={onOpenStats}
          aria-label="Progresso e Estatísticas"
          title="Progresso, Metas Diárias e Domínio Lexical"
          className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 transition shrink-0 cursor-pointer flex items-center justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </button>

        {/* Library / Change Book */}
        <button
          id="btnLibraryModal"
          type="button"
          onClick={onOpenLibrary}
          aria-label="Biblioteca e Importação de Livros"
          title="Biblioteca / Importar Arquivo (PDF, EPUB, DOCX, TXT, MD, SRT, HTML, CSV, JSON)"
          className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 transition shrink-0 cursor-pointer flex items-center justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </button>

        {/* Vocabulary Saved List */}
        <button
          id="btnVocabModal"
          type="button"
          onClick={onOpenVocab}
          aria-label="Caderno de Palavras Salvas"
          title={
            dueSrsCount > 0
              ? `Caderno de Palavras (${dueSrsCount} para revisar hoje no SRS)`
              : 'Caderno de Palavras Salvas'
          }
          className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 relative transition shrink-0 cursor-pointer flex items-center justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
          {vocabCount > 0 && (
            <span
              id="savedVocabBadge"
              className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-[9px] font-bold text-slate-950 rounded-full flex items-center justify-center tabular-nums"
            >
              {vocabCount}
            </span>
          )}
        </button>

        {/* Settings */}
        <button
          id="btnSettingsModal"
          type="button"
          onClick={onOpenSettings}
          aria-label="Configurações Pedagógicas"
          title="Configurações Pedagógicas"
          className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 transition shrink-0 cursor-pointer flex items-center justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  );
};
