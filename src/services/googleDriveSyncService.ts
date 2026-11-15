import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { describeDriveApiError, shouldFallbackToRedirect } from '../utils/driveApiErrors';
import {
  DRIVE_SYNC_FILENAME,
  DRIVE_SYNC_MIME_TYPE,
  DriveBackupSnapshot,
  parseDriveBackupSnapshot
} from '../utils/driveSync';

export const SCOPES = ['https://www.googleapis.com/auth/drive.appdata'] as const;

const isLocalDevHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local'));

// Em produção o authDomain é servido pelo próprio domínio (rewrite em
// vercel.json). Assim o login vira contexto de primeira parte e sobrevive a
// navegadores que bloqueiam cookies de terceiros — antes disso o retorno do
// redirecionamento chegava vazio e o app caía em "Desconectado".
const runtimeConfig = {
  ...firebaseConfig,
  authDomain:
    isLocalDevHost || typeof window === 'undefined'
      ? firebaseConfig.authDomain
      : window.location.hostname
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(runtimeConfig);
const auth = getAuth(app);

/** Atalho usado quando o Firebase recusa o domínio atual. */
export const FIREBASE_AUTH_SETTINGS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'select_account'
});

let isSigningIn = false;
// Strictly in-memory OAuth access token (never persisted to localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

export class DriveUnauthorizedError extends Error {
  constructor(message = 'A autorização do Google Drive expirou.') {
    super(message);
    this.name = 'DriveUnauthorizedError';
  }
}

/**
 * O pop-up foi bloqueado e o app já iniciou o fluxo por redirecionamento.
 * Não é uma falha: a página será recarregada pelo Google.
 */
export class DriveRedirectStartedError extends Error {
  constructor() {
    super('Redirecionando para a tela de login do Google...');
    this.name = 'DriveRedirectStartedError';
  }
}

export interface DriveRemoteFileMeta {
  id: string;
  name: string;
  modifiedTime?: string;
  sizeBytes?: number;
}

export interface DriveSyncUserInfo {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

export function mapFirebaseUser(user: User): DriveSyncUserInfo {
  return {
    uid: user.uid,
    displayName: user.displayName || user.email || 'Conta Google',
    email: user.email || '',
    photoURL: user.photoURL || ''
  };
}

export function initDriveAuth(
  onAuthReady: (user: DriveSyncUserInfo, accessToken: string) => void,
  onNeedsAuth: (signedInUserWithoutToken: DriveSyncUserInfo | null) => void
): () => void {
  let signedInUser: User | null = null;
  // Espera o getRedirectResult antes de anunciar "precisa reconectar", para o
  // retorno do fluxo por redirecionamento não piscar como sessão expirada.
  let redirectSettled = false;

  const flush = () => {
    if (!redirectSettled) return;
    if (signedInUser) {
      const mapped = mapFirebaseUser(signedInUser);
      if (cachedAccessToken) {
        onAuthReady(mapped, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onNeedsAuth(mapped);
      }
    } else {
      // Não derruba uma conexão recém-estabelecida por um evento nulo atrasado.
      if (cachedAccessToken) return;
      cachedAccessToken = null;
      onNeedsAuth(null);
    }
  };

  getRedirectResult(auth)
    .then(result => {
      if (!result?.user) return;
      signedInUser = result.user;
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) cachedAccessToken = credential.accessToken;
    })
    .catch(() => {
      // Sem resultado pendente ou falha no retorno: segue o fluxo normal.
    })
    .finally(() => {
      redirectSettled = true;
      flush();
    });

  return onAuthStateChanged(auth, (user: User | null) => {
    signedInUser = user;
    if (!user) cachedAccessToken = null;
    flush();
  });
}

export async function signInWithGoogleForDrive(): Promise<{
  user: DriveSyncUserInfo;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter a autorização de acesso ao Google Drive.');
    }
    cachedAccessToken = credential.accessToken;
    return {
      user: mapFirebaseUser(result.user),
      accessToken: cachedAccessToken
    };
  } catch (err) {
    // Navegador bloqueou o pop-up (ou WebView sem suporte): cai para redirect.
    // A página é recarregada pelo Google e o retorno é tratado em initDriveAuth.
    if (shouldFallbackToRedirect(err)) {
      await signInWithRedirect(auth, provider);
      throw new DriveRedirectStartedError();
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
}

export function getInMemoryDriveAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearInMemoryDriveAccessToken(): void {
  cachedAccessToken = null;
}

export async function signOutFromGoogleDrive(): Promise<void> {
  cachedAccessToken = null;
  await auth.signOut();
}

async function driveFetch(
  accessToken: string,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    cachedAccessToken = null;
    throw new DriveUnauthorizedError();
  }
  return res;
}

/** Lê o corpo do erro do Google para transformar em orientação acionável em pt-BR. */
async function throwDriveApiError(res: Response, action: string): Promise<never> {
  let bodyText = '';
  try {
    bodyText = await res.text();
  } catch {
    bodyText = '';
  }
  throw new Error(
    describeDriveApiError(res.status, bodyText, action, firebaseConfig.projectId)
  );
}

export async function findAppDataBackupFile(
  accessToken: string
): Promise<DriveRemoteFileMeta | null> {
  const query = encodeURIComponent(`name='${DRIVE_SYNC_FILENAME}' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime%20desc&pageSize=5`;

  const res = await driveFetch(accessToken, url);
  if (!res.ok) {
    await throwDriveApiError(res, 'consultar backups no Google Drive');
  }
  const json = await res.json();
  const files = Array.isArray(json?.files) ? json.files : [];
  if (files.length === 0) return null;

  const first = files[0];
  return {
    id: String(first.id),
    name: String(first.name || DRIVE_SYNC_FILENAME),
    modifiedTime: typeof first.modifiedTime === 'string' ? first.modifiedTime : undefined,
    sizeBytes: first.size ? Number(first.size) : undefined
  };
}

export async function downloadAppDataBackup(
  accessToken: string,
  fileId: string
): Promise<DriveBackupSnapshot | null> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const res = await driveFetch(accessToken, url);
  if (res.status === 404) return null;
  if (!res.ok) {
    await throwDriveApiError(res, 'baixar o backup do Google Drive');
  }
  const raw = await res.json();
  return parseDriveBackupSnapshot(raw);
}

export async function upsertAppDataBackup(
  accessToken: string,
  snapshot: DriveBackupSnapshot,
  existingFileId?: string | null
): Promise<DriveRemoteFileMeta> {
  const jsonBody = JSON.stringify(snapshot);

  if (existingFileId) {
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=media&fields=id,name,modifiedTime,size`;
    const res = await driveFetch(accessToken, updateUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': DRIVE_SYNC_MIME_TYPE
      },
      body: jsonBody
    });
    if (res.status === 404) {
      return upsertAppDataBackup(accessToken, snapshot, null);
    }
    if (!res.ok) {
      await throwDriveApiError(res, 'atualizar o backup no Google Drive');
    }
    const updated = await res.json();
    return {
      id: String(updated.id),
      name: String(updated.name || DRIVE_SYNC_FILENAME),
      modifiedTime: updated.modifiedTime,
      sizeBytes: updated.size ? Number(updated.size) : jsonBody.length
    };
  }

  const boundary = `-------TeacherReaderDriveSync${Date.now()}`;
  const metadata = {
    name: DRIVE_SYNC_FILENAME,
    parents: ['appDataFolder'],
    mimeType: DRIVE_SYNC_MIME_TYPE
  };

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${DRIVE_SYNC_MIME_TYPE}\r\n\r\n` +
    `${jsonBody}\r\n` +
    `--${boundary}--`;

  const createUrl =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size';
  const res = await driveFetch(accessToken, createUrl, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary="${boundary}"`
    },
    body: multipartBody
  });

  if (!res.ok) {
    await throwDriveApiError(res, 'criar o backup no Google Drive');
  }
  const created = await res.json();
  return {
    id: String(created.id),
    name: String(created.name || DRIVE_SYNC_FILENAME),
    modifiedTime: created.modifiedTime,
    sizeBytes: created.size ? Number(created.size) : jsonBody.length
  };
}

export async function deleteAppDataBackup(
  accessToken: string,
  fileId: string
): Promise<boolean> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
  const res = await driveFetch(accessToken, url, { method: 'DELETE' });
  if (res.status === 404) return true;
  if (!res.ok) {
    await throwDriveApiError(res, 'remover o backup do Google Drive');
  }
  return true;
}
