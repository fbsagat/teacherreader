import React, { useState } from 'react';
import {
  DriveRemoteFileMeta,
  DriveSyncUserInfo
} from '../services/googleDriveSyncService';
import { DRIVE_SYNC_FILENAME, SnapshotSummary } from '../utils/driveSync';

export type DriveSyncUiStatus =
  | 'disconnected'
  | 'needs_reauth'
  | 'checking'
  | 'syncing'
  | 'synced'
  | 'needs_confirmation'
  | 'error';

export type DrivePendingConfirmation =
  | {
      kind: 'initial_upload';
      localSummary: SnapshotSummary;
    }
  | {
      kind: 'merge_or_overwrite';
      localSummary: SnapshotSummary;
      remoteSummary: SnapshotSummary;
    };

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  user: DriveSyncUserInfo | null;
  hasAccessToken: boolean;
  status: DriveSyncUiStatus;
  statusError: string | null;
  /** Link de ajuda exibido sob o erro (ex.: configurações de login do Firebase). */
  statusHelpUrl?: string | null;
  lastSyncedAt: string | null;
  remoteFileMeta: DriveRemoteFileMeta | null;
  pendingConfirmation: DrivePendingConfirmation | null;
  localSummary: SnapshotSummary | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onConfirmInitialUpload: () => Promise<void>;
  onConfirmMergeSync: () => Promise<void>;
  onRestoreFromDriveOnly: () => Promise<void>;
  onConfirmOverwriteDrive: () => Promise<void>;
  onCancelPendingConfirmation: () => void;
  onDeleteRemoteBackup: () => Promise<void>;
  onClose: () => void;
}

function formatDateTimePt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatBytesKb(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Mantém as mensagens em pt-BR com URLs clicáveis (ex.: ativar a Drive API). */
function renderTextWithLinks(text: string): React.ReactNode {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={`link-${index}`}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="underline text-sky-300 break-all hover:text-sky-200"
      >
        {part}
      </a>
    ) : (
      <React.Fragment key={`text-${index}`}>{part}</React.Fragment>
    )
  );
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  user,
  hasAccessToken,
  status,
  statusError,
  statusHelpUrl,
  lastSyncedAt,
  remoteFileMeta,
  pendingConfirmation,
  localSummary,
  onSignIn,
  onSignOut,
  onSyncNow,
  onConfirmInitialUpload,
  onConfirmMergeSync,
  onRestoreFromDriveOnly,
  onConfirmOverwriteDrive,
  onCancelPendingConfirmation,
  onDeleteRemoteBackup,
  onClose
}) => {
  const [isBusy, setIsBusy] = useState(false);
  const [confirmOverwriteWarning, setConfirmOverwriteWarning] = useState(false);
  const [confirmDeleteBackup, setConfirmDeleteBackup] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [copiedDiagnostics, setCopiedDiagnostics] = useState(false);

  const currentHost = typeof window !== 'undefined' ? window.location.host : '';

  const handleCopyOrigin = async () => {
    if (!currentHost || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(currentHost);
      setCopiedOrigin(true);
      window.setTimeout(() => setCopiedOrigin(false), 2000);
    } catch {
      setCopiedOrigin(false);
    }
  };

  const buildDiagnostics = () =>
    [
      'Teacher Reader — diagnóstico do Google Drive',
      `origem: ${typeof window !== 'undefined' ? window.location.origin : '?'}`,
      `conta: ${user?.email || (user ? user.displayName : 'nenhuma')}`,
      `uid: ${user?.uid || '-'}`,
      `tokenDrive: ${hasAccessToken ? 'presente' : 'ausente'}`,
      `status: ${status}`,
      `erro: ${statusError || '-'}`,
      `arquivoRemoto: ${remoteFileMeta?.id || '-'}`,
      `userAgent: ${typeof navigator !== 'undefined' ? navigator.userAgent : '?'}`
    ].join('\n');

  const handleCopyDiagnostics = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(buildDiagnostics());
      setCopiedDiagnostics(true);
      window.setTimeout(() => setCopiedDiagnostics(false), 2000);
    } catch {
      setCopiedDiagnostics(false);
    }
  };

  if (!isOpen) return null;

  const handleAction = async (fn: () => Promise<void>) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await fn();
    } finally {
      setIsBusy(false);
    }
  };

  const statusBadge = (() => {
    switch (status) {
      case 'synced':
        return {
          text: 'Sincronização Automática Ativa',
          cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
        };
      case 'syncing':
      case 'checking':
        return {
          text: status === 'checking' ? 'Verificando Google Drive...' : 'Sincronizando na nuvem...',
          cls: 'bg-sky-500/15 text-sky-300 border-sky-500/35'
        };
      case 'needs_confirmation':
        return {
          text: 'Aguardando sua confirmação',
          cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35'
        };
      case 'needs_reauth':
        return {
          text: 'Sessão expirada — reconecte abaixo',
          cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35'
        };
      case 'error':
        return {
          text: 'Erro ao sincronizar',
          cls: 'bg-rose-500/15 text-rose-300 border-rose-500/35'
        };
      default:
        return {
          text: 'Desconectado (somente local)',
          cls: 'bg-slate-800 text-slate-300 border-slate-700'
        };
    }
  })();

  return (
    <div
      id="modalDriveSync"
      onClick={e => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="driveSyncModalTitle"
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-5 max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <h3
              id="driveSyncModalTitle"
              className="text-sm sm:text-base font-bold text-white flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.71 3.5L1.15 15l3.43 6 6.56-11.5L7.71 3.5zm8.58 0H9.42l6.56 11.5h6.87L16.29 3.5zM8.85 16l-3.43 6h13.16l3.43-6H8.85z" />
              </svg>
              <span>Backup Invisível no Google Drive</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Seus livros, marcadores, vocabulário e estatísticas salvos na sua própria conta Google.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Fechar sincronização Google Drive"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto space-y-3.5 py-3.5 pr-0.5">
          {/* Status Pill & Account Info */}
          <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusBadge.cls}`}
              >
                {statusBadge.text}
              </span>
              {lastSyncedAt && (
                <span className="text-[11px] text-slate-400 tabular-nums">
                  Última sinc.: {formatDateTimePt(lastSyncedAt)}
                </span>
              )}
            </div>

            {user && (
              <div className="flex items-center gap-2.5 pt-1 border-t border-slate-800/80">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="w-8 h-8 rounded-full border border-slate-700 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-xs font-bold text-brand-300 shrink-0">
                    {user.displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{user.displayName}</p>
                  {user.email && (
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                  )}
                </div>
                {remoteFileMeta?.sizeBytes ? (
                  <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md shrink-0">
                    {formatBytesKb(remoteFileMeta.sizeBytes)}
                  </span>
                ) : null}
              </div>
            )}

            {statusError && (
              <div className="space-y-1.5">
                <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2.5 py-2">
                  {renderTextWithLinks(statusError)}
                </p>
                {!hasAccessToken && currentHost && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-400">
                      Domínio deste site: <strong className="text-slate-300">{currentHost}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyOrigin()}
                      className="text-[10px] font-semibold px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer"
                    >
                      {copiedOrigin ? 'Copiado!' : 'Copiar domínio'}
                    </button>
                    {statusHelpUrl && (
                      <a
                        href={statusHelpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-semibold px-2 py-1 rounded-md bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-200 transition"
                      >
                        Abrir Firebase ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Official Sign in with Google Button when signed out or token expired */}
          {!hasAccessToken && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                {status === 'needs_reauth'
                  ? 'Para retomar a sincronização automática neste navegador, confirme novamente sua conta Google.'
                  : 'Conecte sua conta Google para salvar automaticamente seus livros, progresso e palavras na pasta oculta privada do aplicativo no seu Google Drive.'}
              </p>

              <div className="flex justify-center">
                <button
                  id="btnGoogleDriveSignIn"
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleAction(onSignIn)}
                  className="gsi-material-button inline-flex items-center justify-center gap-3 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-900 font-medium text-sm px-5 py-2.5 rounded-full border border-slate-300 shadow-sm transition cursor-pointer disabled:opacity-60"
                >
                  <div className="gsi-material-button-icon w-5 h-5 shrink-0">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents font-semibold">
                    {isBusy
                      ? 'Conectando...'
                      : status === 'needs_reauth'
                        ? 'Reconectar com Google'
                        : 'Entrar com Google'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Explicit Confirmation Dialog: Initial Backup Creation */}
          {hasAccessToken && pendingConfirmation?.kind === 'initial_upload' && (
            <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3.5 space-y-3">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-200">
                  Confirmar criação do backup oculto no Google Drive?
                </h4>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  Será criado o arquivo privado <strong>{DRIVE_SYNC_FILENAME}</strong> na área
                  oculta do aplicativo no seu Google Drive com:
                </p>
                <ul className="text-[11px] text-slate-300 list-disc pl-4 space-y-0.5">
                  <li>
                    {pendingConfirmation.localSummary.booksCount} livro(s) salvo(s) (
                    {pendingConfirmation.localSummary.customBooksCount} importado(s))
                  </li>
                  <li>{pendingConfirmation.localSummary.vocabCount} palavra(s) no caderno</li>
                  <li>
                    {pendingConfirmation.localSummary.totalSentencesCompleted} frase(s) concluída(s)
                  </li>
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  id="btnConfirmInitialDriveUpload"
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleAction(onConfirmInitialUpload)}
                  className="flex-1 min-w-[160px] px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  Confirmar e Ativar Sync Automático
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={onCancelPendingConfirmation}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Explicit Confirmation Dialog: Conflict / First Merge Between Devices */}
          {hasAccessToken && pendingConfirmation?.kind === 'merge_or_overwrite' && (
            <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3.5 space-y-3">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-200">
                  Backup encontrado no Google Drive — escolha como sincronizar
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Os dados neste dispositivo são diferentes do backup salvo no seu Google Drive.
                  Escolha como deseja atualizar:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 space-y-1">
                  <p className="font-bold text-slate-200">📱 Este Dispositivo</p>
                  <p className="text-slate-400">
                    Livros: {pendingConfirmation.localSummary.booksCount} (
                    {pendingConfirmation.localSummary.customBooksCount} import.)
                  </p>
                  <p className="text-slate-400">
                    Palavras: {pendingConfirmation.localSummary.vocabCount} · Frases:{' '}
                    {pendingConfirmation.localSummary.totalSentencesCompleted}
                  </p>
                </div>
                <div className="bg-slate-950/80 border border-sky-500/30 rounded-lg p-2.5 space-y-1">
                  <p className="font-bold text-sky-300">☁️ Google Drive</p>
                  <p className="text-slate-400">
                    Livros: {pendingConfirmation.remoteSummary.booksCount} (
                    {pendingConfirmation.remoteSummary.customBooksCount} import.)
                  </p>
                  <p className="text-slate-400">
                    Palavras: {pendingConfirmation.remoteSummary.vocabCount} · Frases:{' '}
                    {pendingConfirmation.remoteSummary.totalSentencesCompleted}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Atualizado: {formatDateTimePt(pendingConfirmation.remoteSummary.updatedAt)}
                  </p>
                </div>
              </div>

              {!confirmOverwriteWarning ? (
                <div className="flex flex-col gap-2">
                  <button
                    id="btnConfirmMergeDriveSync"
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleAction(onConfirmMergeSync)}
                    className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    Mesclar Tudo e Sincronizar Automaticamente (Recomendado)
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAction(onRestoreFromDriveOnly)}
                      className="px-3 py-2 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      Restaurar apenas do Drive
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmOverwriteWarning(true)}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      Substituir Drive por este aparelho
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={onCancelPendingConfirmation}
                    className="w-full px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-medium transition cursor-pointer"
                  >
                    Cancelar por enquanto
                  </button>
                </div>
              ) : (
                <div className="bg-rose-500/10 border border-rose-500/40 rounded-lg p-3 space-y-2">
                  <p className="text-[11px] text-rose-200 font-semibold">
                    Confirmar substituição? O arquivo de backup atual no seu Google Drive será
                    sobrescrito pelos dados deste dispositivo.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        handleAction(async () => {
                          await onConfirmOverwriteDrive();
                          setConfirmOverwriteWarning(false);
                        })
                      }
                      className="flex-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      Confirmar Substituição no Drive
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmOverwriteWarning(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Local Snapshot Summary + Connected Controls */}
          {localSummary && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
              <p className="text-[11px] font-semibold text-slate-300">
                Resumo salvo neste dispositivo
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2">
                  <p className="text-sm font-bold text-white tabular-nums">
                    {localSummary.booksCount}
                  </p>
                  <p className="text-[10px] text-slate-400">Livros</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2">
                  <p className="text-sm font-bold text-white tabular-nums">
                    {localSummary.vocabCount}
                  </p>
                  <p className="text-[10px] text-slate-400">Palavras</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2">
                  <p className="text-sm font-bold text-white tabular-nums">
                    {localSummary.totalSentencesCompleted}
                  </p>
                  <p className="text-[10px] text-slate-400">Frases</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                O backup é guardado na pasta oculta privada do aplicativo no seu Google Drive, sem
                misturar arquivos no seu &ldquo;Meu Drive&rdquo;.
              </p>
            </div>
          )}

          {/* Delete Backup Confirmation */}
          {confirmDeleteBackup && hasAccessToken && remoteFileMeta && (
            <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-3 space-y-2.5">
              <p className="text-xs font-semibold text-rose-200">
                Excluir o backup &ldquo;{DRIVE_SYNC_FILENAME}&rdquo; do seu Google Drive?
              </p>
              <p className="text-[11px] text-slate-300">
                Esta ação apaga apenas a cópia salva no Google Drive. Seus livros e progresso neste
                navegador serão mantidos.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    handleAction(async () => {
                      await onDeleteRemoteBackup();
                      setConfirmDeleteBackup(false);
                    })
                  }
                  className="flex-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  Sim, Excluir Backup do Drive
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setConfirmDeleteBackup(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Footer Action Buttons when Connected */}
          {(hasAccessToken || user) && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {hasAccessToken && !pendingConfirmation && (
                <button
                  id="btnDriveSyncNow"
                  type="button"
                  disabled={isBusy || status === 'syncing' || status === 'checking'}
                  onClick={() => handleAction(onSyncNow)}
                  className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {status === 'syncing' ? 'Sincronizando...' : 'Sincronizar Agora'}
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                {hasAccessToken && remoteFileMeta && !confirmDeleteBackup && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setConfirmDeleteBackup(true)}
                    className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-200 text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
                  >
                    Apagar backup na nuvem
                  </button>
                )}

                {user && (
                  <button
                    id="btnGoogleDriveSignOut"
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleAction(onSignOut)}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                  >
                    Sair da Conta Google
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Diagnóstico do login (útil quando o Google devolve o usuário sem token) */}
          <details className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-400">
            <summary className="cursor-pointer select-none font-semibold text-slate-300">
              Diagnóstico da conexão
            </summary>
            <div className="mt-2 space-y-1 font-mono text-[10px] leading-relaxed break-all">
              <p>conta: {user ? `${user.email || user.displayName} (${user.uid})` : 'nenhuma'}</p>
              <p>token do Drive: {hasAccessToken ? 'presente' : 'ausente'}</p>
              <p>status: {status}</p>
              <p>erro: {statusError || '—'}</p>
              <p>arquivo remoto: {remoteFileMeta?.id || '—'}</p>
              <p>origem: {currentHost || '—'}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleCopyDiagnostics()}
              className="mt-2 text-[10px] font-semibold px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer"
            >
              {copiedDiagnostics ? 'Diagnóstico copiado!' : 'Copiar diagnóstico'}
            </button>
          </details>
        </div>
      </div>
    </div>
  );
};
