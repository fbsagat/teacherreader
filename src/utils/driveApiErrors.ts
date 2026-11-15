/**
 * Traduções de erros do Google (Firebase Auth + Drive API) para mensagens
 * acionáveis em pt-BR. Mantido sem DOM para rodar em `node:test`.
 */

export interface DriveAuthErrorGuidance {
  /** Código bruto do Firebase (ex.: `auth/unauthorized-domain`), quando existir. */
  code: string | null;
  /** Mensagem principal em pt-BR, pronta para exibir. */
  message: string;
  /** Próximo passo sugerido, quando houver. */
  action: string | null;
}

function readProperty(err: unknown, key: string): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const value = (err as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readMessage(err: unknown): string | null {
  if (err instanceof Error) return err.message;
  return readProperty(err, 'message');
}

/** Extrai `auth/codigo` de um FirebaseError ou de uma mensagem no formato `Firebase: Error (auth/codigo).` */
export function extractAuthErrorCode(err: unknown): string | null {
  const direct = readProperty(err, 'code');
  if (direct && /^auth\//.test(direct)) return direct;

  const message = readMessage(err);
  if (!message) return null;

  const match = message.match(/\bauth\/[a-z0-9-]+\b/i);
  return match ? match[0].toLowerCase() : null;
}

export function extractHostname(origin: string): string {
  const trimmed = origin.trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).host || trimmed;
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  }
}

/**
 * Erros em que vale trocar `signInWithPopup` por `signInWithRedirect`:
 * o navegador recusou a janela (bloqueio de pop-up, WebView, storage restrito).
 * Não inclui `popup-closed-by-user` — ali o usuário desistiu de propósito.
 */
export function shouldFallbackToRedirect(err: unknown): boolean {
  const code = extractAuthErrorCode(err);
  if (!code) return false;
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/web-storage-unsupported'
  );
}

const LOCAL_HOST_PATTERN = /^(?:localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/i;

/**
 * `redirect_uri` que o cliente OAuth precisa ter cadastrado. Em produção é o
 * próprio domínio do app, porque o `authDomain` do Firebase é servido por ele
 * (rewrite em `vercel.json`); em localhost o Firebase continua usando o handler
 * do `firebaseapp.com`. Retorna `null` quando o host não ajuda (localhost/SSR).
 */
export function driveAuthHandlerUrl(origin: string): string | null {
  const host = extractHostname(origin);
  if (!host) return null;
  const hostname = host.replace(/:\d+$/, '').toLowerCase();
  if (!hostname || LOCAL_HOST_PATTERN.test(hostname)) return null;
  return `https://${host}/__/auth/handler`;
}

/**
 * Converte um erro de `signInWithPopup` em orientação concreta. Quando o erro
 * não é do Firebase, preserva a mensagem original (já em pt-BR).
 */
export function describeDriveAuthError(err: unknown, origin: string): DriveAuthErrorGuidance {
  const code = extractAuthErrorCode(err);
  const host = extractHostname(origin);
  const hostLabel = host || 'este site';

  switch (code) {
    case 'auth/unauthorized-domain':
      return {
        code,
        message: `O Google bloqueou o login porque o domínio "${hostLabel}" não está autorizado no Firebase deste app.`,
        action:
          'Abra o Firebase Console → Authentication → Settings → Authorized domains e adicione esse domínio exato (sem https://). Depois recarregue a página e tente de novo.'
      };
    case 'auth/operation-not-allowed':
      return {
        code,
        message: 'O login com Google está desativado neste projeto Firebase.',
        action:
          'Abra o Firebase Console → Authentication → Sign-in method → Google → Ativar e informe um e-mail de suporte.'
      };
    case 'auth/popup-blocked':
      return {
        code,
        message: 'O navegador bloqueou a janela de login do Google.',
        action:
          'Permita pop-ups para este site (ícone na barra de endereço) e clique em "Entrar com Google" novamente.'
      };
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request': {
      // Os dois bloqueios que o Google mostra dentro da janela de login: falta
      // de `redirect_uri` no cliente OAuth e consent screen em modo de teste.
      const handlerUrl = driveAuthHandlerUrl(origin);
      const redirectUriHint = handlerUrl
        ? `Se a janela mostrou "Acesso bloqueado: a solicitação desse app é inválida", falta cadastrar ${handlerUrl} em Authorized redirect URIs do cliente OAuth (Google Cloud Console → APIs e Serviços → Credenciais).`
        : 'Se a janela mostrou "Acesso bloqueado: a solicitação desse app é inválida", falta cadastrar o redirect_uri do app em Authorized redirect URIs do cliente OAuth (Google Cloud Console → APIs e Serviços → Credenciais).';
      return {
        code,
        message: 'A janela de login do Google foi fechada antes de concluir.',
        action: `${redirectUriHint} Se apareceu "Erro 403: access_denied", a tela de consentimento OAuth está em modo de teste: adicione sua conta Google como usuário de teste (ou publique o app) no Google Cloud Console → APIs e Serviços → Tela de consentimento OAuth.`
      };
    }
    case 'auth/account-exists-with-different-credential':
      return {
        code,
        message: 'Já existe uma conta neste app com esse e-mail usando outro método de login.',
        action: 'Entre com o método já usado anteriormente ou use outra conta Google.'
      };
    case 'auth/network-request-failed':
      return {
        code,
        message: 'Falha de rede ao falar com o Google.',
        action: 'Verifique a conexão (inclusive bloqueadores de anúncio/extensões) e tente novamente.'
      };
    case 'auth/too-many-requests':
      return {
        code,
        message: 'O Google bloqueou temporariamente novas tentativas de login.',
        action: 'Aguarde alguns minutos e tente novamente.'
      };
    case 'auth/internal-error':
      return {
        code,
        message: 'O Google retornou um erro interno durante o login.',
        action: 'Tente novamente em alguns instantes; se persistir, saia da conta e entre de novo.'
      };
    default:
      break;
  }

  const message = readMessage(err);
  const looksLikeFirebase = message ? /firebase/i.test(message) : false;

  if (message && !looksLikeFirebase && !code) {
    return { code: null, message, action: null };
  }

  return {
    code,
    message: 'Não foi possível concluir o login com o Google.',
    action: code
      ? `Detalhe técnico: ${code}. Se persistir, recarregue a página e tente novamente.`
      : 'Recarregue a página e tente novamente.'
  };
}

function findMarker(bodyText: string, markers: string[]): string | null {
  const haystack = bodyText.toLowerCase();
  for (const marker of markers) {
    if (haystack.includes(marker.toLowerCase())) return marker;
  }
  return null;
}

/**
 * Converte uma resposta de erro da Drive API em uma explicação acionável.
 * `action` descreve o que o app tentava fazer (ex.: "consultar backups").
 * `projectId` (opcional) gera o link direto da API no Cloud Console.
 */
export function describeDriveApiError(
  status: number,
  bodyText: string,
  action: string,
  projectId?: string
): string {
  const prefix = `Falha ao ${action} (HTTP ${status}).`;
  const body = (bodyText || '').slice(0, 4000);
  const enableUrl = projectId
    ? `https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${projectId}`
    : null;

  // Marcadores fortes de API desativada. "drive.googleapis.com" sozinho aparece
  // em metadados de qualquer erro do Drive, então não pode ser usado aqui.
  const apiDisabled =
    findMarker(body, ['service_disabled', 'accessnotconfigured', 'has not been used in project']) !==
      null ||
    (body.toLowerCase().includes('requests to this api') &&
      body.toLowerCase().includes('are blocked'));

  if (apiDisabled) {
    const link = enableUrl ? ` Ative em ${enableUrl} e aguarde alguns minutos.` : '';
    return `${prefix} A Google Drive API está desativada (ou bloqueada) no projeto do Google Cloud deste app.${link}`;
  }

  if (findMarker(body, ['insufficientfilepermissions'])) {
    return `${prefix} O app não tem permissão sobre o arquivo de backup no Drive. Reconecte a conta Google e tente novamente.`;
  }

  if (findMarker(body, ['insufficientpermissions', 'insufficient authentication scopes'])) {
    return `${prefix} A conta Google autorizou permissões insuficientes. Saia da conta no app e entre novamente aceitando o acesso ao Google Drive.`;
  }

  if (
    findMarker(body, [
      'userratelimitexceeded',
      'ratelimitexceeded',
      'quotaexceeded',
      'storagequotaexceeded'
    ])
  ) {
    return `${prefix} Limite de uso ou espaço da conta Google atingido. Aguarde alguns minutos e tente novamente.`;
  }

  if (status === 401) {
    return `${prefix} A sessão do Google expirou. Clique em "Reconectar com Google".`;
  }

  if (status === 403) {
    return `${prefix} O Google recusou a operação. Verifique se a Google Drive API está ativada no projeto e reconecte a conta.`;
  }

  if (status === 429) {
    return `${prefix} Muitas requisições ao Google Drive. Aguarde alguns segundos e tente novamente.`;
  }

  if (status >= 500) {
    return `${prefix} O Google Drive está instável no momento. Tente novamente em instantes.`;
  }

  return `${prefix} Tente novamente; se persistir, reconecte a conta Google.`;
}
