import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeDriveApiError,
  describeDriveAuthError,
  driveAuthHandlerUrl,
  extractAuthErrorCode,
  extractHostname,
  shouldFallbackToRedirect
} from './driveApiErrors';

test('extractAuthErrorCode reads the code property and the Firebase message format', () => {
  const withCode = Object.assign(new Error('qualquer'), { code: 'auth/unauthorized-domain' });
  assert.equal(extractAuthErrorCode(withCode), 'auth/unauthorized-domain');
  assert.equal(
    extractAuthErrorCode(new Error('Firebase: Error (auth/popup-blocked).')),
    'auth/popup-blocked'
  );
  assert.equal(extractAuthErrorCode(new Error('erro qualquer')), null);
  assert.equal(extractAuthErrorCode(null), null);
});

test('extractHostname normalizes origins and bare hosts', () => {
  assert.equal(extractHostname('https://teacherreader.vercel.app'), 'teacherreader.vercel.app');
  assert.equal(extractHostname('http://localhost:3000/'), 'localhost:3000');
  assert.equal(extractHostname('teacherreader.vercel.app'), 'teacherreader.vercel.app');
  assert.equal(extractHostname('   '), '');
});

test('describeDriveAuthError names the blocked domain for auth/unauthorized-domain', () => {
  const err = Object.assign(new Error('Firebase: Error (auth/unauthorized-domain).'), {
    code: 'auth/unauthorized-domain'
  });
  const guidance = describeDriveAuthError(err, 'https://teacherreader.vercel.app');

  assert.equal(guidance.code, 'auth/unauthorized-domain');
  assert.match(guidance.message, /teacherreader\.vercel\.app/);
  assert.match(String(guidance.action), /Authorized domains/);
});

test('describeDriveAuthError explains consent-screen test users when the popup closes', () => {
  const err = Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), {
    code: 'auth/popup-closed-by-user'
  });
  const guidance = describeDriveAuthError(err, 'https://teacherreader.vercel.app');

  assert.match(String(guidance.action), /consentimento OAuth/);
});

test('driveAuthHandlerUrl points at the first-party authDomain used in production', () => {
  assert.equal(
    driveAuthHandlerUrl('https://teacherreader.vercel.app'),
    'https://teacherreader.vercel.app/__/auth/handler'
  );
  assert.equal(
    driveAuthHandlerUrl('https://teacherreader-git-main-fbsagat.vercel.app/'),
    'https://teacherreader-git-main-fbsagat.vercel.app/__/auth/handler'
  );
  assert.equal(driveAuthHandlerUrl('http://localhost:3000'), null);
  assert.equal(driveAuthHandlerUrl('http://127.0.0.1:3000'), null);
  assert.equal(driveAuthHandlerUrl('http://minha-maquina.local'), null);
  assert.equal(driveAuthHandlerUrl('   '), null);
});

test('describeDriveAuthError mentions the missing redirect URI when the popup closes', () => {
  const err = Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), {
    code: 'auth/popup-closed-by-user'
  });
  const guidance = describeDriveAuthError(err, 'https://teacherreader.vercel.app');
  assert.match(
    String(guidance.action),
    /https:\/\/teacherreader\.vercel\.app\/__\/auth\/handler/
  );
  assert.match(String(guidance.action), /Authorized redirect URIs/);

  const local = describeDriveAuthError(err, 'http://localhost:3000');
  assert.doesNotMatch(String(local.action), /localhost\/__\/auth\/handler/);
});

test('describeDriveAuthError preserves pt-BR messages that do not come from Firebase', () => {
  const guidance = describeDriveAuthError(
    new Error('Não foi possível obter a autorização de acesso ao Google Drive.'),
    'https://teacherreader.vercel.app'
  );

  assert.equal(guidance.message, 'Não foi possível obter a autorização de acesso ao Google Drive.');
  assert.equal(guidance.action, null);
});

test('describeDriveAuthError falls back to a generic message for unknown Firebase codes', () => {
  const err = Object.assign(new Error('Firebase: Error (auth/something-new).'), {
    code: 'auth/something-new'
  });
  const guidance = describeDriveAuthError(err, 'https://teacherreader.vercel.app');

  assert.equal(guidance.code, 'auth/something-new');
  assert.match(guidance.message, /Não foi possível concluir o login/);
  assert.match(String(guidance.action), /auth\/something-new/);
});

test('shouldFallbackToRedirect only triggers on blocked/unsupported popups', () => {
  const blocked = Object.assign(new Error('Firebase: Error (auth/popup-blocked).'), {
    code: 'auth/popup-blocked'
  });
  const webview = Object.assign(
    new Error('Firebase: Error (auth/operation-not-supported-in-this-environment).'),
    { code: 'auth/operation-not-supported-in-this-environment' }
  );
  const closedByUser = Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), {
    code: 'auth/popup-closed-by-user'
  });

  assert.equal(shouldFallbackToRedirect(blocked), true);
  assert.equal(shouldFallbackToRedirect(webview), true);
  assert.equal(shouldFallbackToRedirect(closedByUser), false);
  assert.equal(shouldFallbackToRedirect(new Error('erro sem código')), false);
});

test('describeDriveApiError flags a disabled Google Drive API', () => {
  const body = JSON.stringify({
    error: {
      code: 403,
      message:
        'Google Drive API has not been used in project 781206693622 before or it is disabled.',
      errors: [{ reason: 'accessNotConfigured', domain: 'usageLimits' }],
      status: 'PERMISSION_DENIED'
    }
  });

  const message = describeDriveApiError(403, body, 'consultar backups no Google Drive');
  assert.match(message, /HTTP 403/);
  assert.match(message, /desativada/);
});

test('describeDriveApiError does not call it "disabled" just because the body mentions the service', () => {
  const metadataOnly = JSON.stringify({
    error: {
      code: 403,
      message: 'Permission denied on the service.',
      status: 'PERMISSION_DENIED',
      details: [
        { reason: 'ACCESS_DENIED', domain: 'googleapis.com', metadata: { service: 'drive.googleapis.com' } }
      ]
    }
  });

  const message = describeDriveApiError(403, metadataOnly, 'consultar backups');
  assert.doesNotMatch(message, /desativada/);
  assert.match(message, /Google recusou a operação/);
});

test('describeDriveApiError treats "Requests to this API ... are blocked" as API disabled', () => {
  const blocked =
    '{"error":{"code":403,"message":"Requests to this API drive method google.apps.drive.v3.DriveFiles.List are blocked.","status":"PERMISSION_DENIED"}}';
  const message = describeDriveApiError(403, blocked, 'consultar backups', 'gen-lang-client-0186216759');
  assert.match(message, /desativada/);
  assert.match(message, /drive\.googleapis\.com\?project=gen-lang-client-0186216759/);
});

test('describeDriveApiError explains insufficient scopes and quota problems', () => {
  const scopes = describeDriveApiError(
    403,
    '{"error":{"errors":[{"reason":"insufficientPermissions"}],"status":"PERMISSION_DENIED"}}',
    'enviar o backup'
  );
  assert.match(scopes, /permissões insuficientes/);

  const quota = describeDriveApiError(
    403,
    '{"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}',
    'enviar o backup'
  );
  assert.match(quota, /Limite de uso ou espaço/);
});

test('describeDriveApiError handles auth expiry, rate limit, server errors and generic 403', () => {
  assert.match(describeDriveApiError(401, '', 'baixar o backup'), /sessão do Google expirou/);
  assert.match(describeDriveApiError(429, '', 'baixar o backup'), /Muitas requisições/);
  assert.match(describeDriveApiError(503, '', 'baixar o backup'), /instável/);
  assert.match(describeDriveApiError(403, '', 'baixar o backup'), /Google recusou a operação/);
  assert.match(describeDriveApiError(400, '', 'baixar o backup'), /Tente novamente/);
});
