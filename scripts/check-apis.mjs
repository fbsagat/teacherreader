#!/usr/bin/env node
/**
 * Diagnóstico das integrações do Teacher Reader.
 *
 * Uso (Node 22+):
 *   node scripts/check-apis.mjs                       # só checks gratuitos
 *   node scripts/check-apis.mjs --with-tts            # + TTS (gasta cota do Gemini/TikTok)
 *   node scripts/check-apis.mjs --stt-file=fala.webm  # + STT real (gasta cota do Gemini)
 *   node scripts/check-apis.mjs --base-url=http://localhost:3000
 *
 * `--base-url` aponta para a API (dev = http://localhost:3000, produção = a URL
 * do Funnel da VPS). `--site` aponta para o app publicado (Vercel).
 *
 * Nada de chave/secrets aqui: o script só conversa com endpoints públicos.
 * Sai com código 1 se algum check obrigatório falhar.
 */

const args = process.argv.slice(2);

function readArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = args.find(arg => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const BASE_URL = readArg(
  'base-url',
  process.env.API_BASE_URL || 'https://instance-20260808-1016.tail4096b.ts.net'
).replace(/\/+$/, '');
const SITE_URL = readArg('site', process.env.SITE_URL || 'https://teacherreader.vercel.app').replace(
  /\/+$/,
  ''
);
const ALLOWED_ORIGIN = readArg('origin', 'https://teacherreader.vercel.app');
const WITH_TTS = args.includes('--with-tts');
const STT_FILE = readArg('stt-file', '');
const TIMEOUT_MS = Number(readArg('timeout', '30000')) || 30_000;

if (args.includes('--help') || args.includes('-h')) {
  console.log(
    [
      'check-apis.mjs — diagnóstico das APIs do Teacher Reader',
      '',
      '  --base-url=<url>   API (padrão: Funnel da VPS)',
      '  --site=<url>       app publicado (padrão: teacherreader.vercel.app)',
      '  --origin=<url>     origem usada no teste de CORS',
      '  --with-tts         testa POST /api/voice-hub/tts (gasta cota)',
      '  --stt-file=<path>  testa POST /api/voice-hub/stt com um áudio real',
      '  --timeout=<ms>     timeout por requisição (padrão: 30000)',
      '',
      'Sem flags, só rodam os checks gratuitos (status, CORS, tradução, dicionário).'
    ].join('\n')
  );
  process.exit(0);
}

const results = [];

function record(ok, name, detail) {
  results.push({ ok, name, detail });
  const label = ok === true ? '\x1b[32mPASS\x1b[0m' : ok === 'warn' ? '\x1b[33mWARN\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`${label}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function timedFetch(url, init = {}) {
  const started = Date.now();
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  return { res, ms: Date.now() - started };
}

async function bodySnippet(res, limit = 160) {
  try {
    const text = await res.text();
    return text.replace(/\s+/g, ' ').trim().slice(0, limit);
  } catch {
    return '';
  }
}

async function checkApiStatus() {
  try {
    const { res, ms } = await timedFetch(`${BASE_URL}/api/voice-hub/status`);
    if (!res.ok) {
      record(false, 'API /status', `HTTP ${res.status} (${ms}ms)`);
      return;
    }
    const data = await res.json().catch(() => null);
    const gemini = Boolean(data?.providers?.gemini);
    const cooldown = data?.cooldowns?.geminiTtsUntil;
    record(
      true,
      'API /status',
      `200 em ${ms}ms · gemini=${gemini ? 'ligado' : 'sem chave'}` +
        (cooldown ? ` · TTS em cooldown até ${new Date(cooldown).toLocaleTimeString('pt-BR')}` : '') +
        (data?.stt?.lastOutcome ? ` · STT=${data.stt.lastOutcome}` : '')
    );
  } catch (error) {
    record(false, 'API /status', error?.message || String(error));
  }
}

async function checkCors() {
  const isLocalApi = /localhost|127\.0\.0\.1/.test(BASE_URL);
  try {
    const { res } = await timedFetch(`${BASE_URL}/api/voice-hub/status`, {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'GET'
      }
    });
    const allow = res.headers.get('access-control-allow-origin');
    record(
      allow ? true : isLocalApi ? 'warn' : false,
      `CORS origem permitida (${ALLOWED_ORIGIN})`,
      allow
        ? `allow-origin=${allow}`
        : `sem header (HTTP ${res.status})${
            isLocalApi ? ' — normal no dev sem CORS_ORIGINS no .env' : ' — revise CORS_ORIGINS'
          }`
    );
  } catch (error) {
    record(false, 'CORS origem permitida', error?.message || String(error));
  }

  try {
    const { res } = await timedFetch(`${BASE_URL}/api/voice-hub/status`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' }
    });
    const allow = res.headers.get('access-control-allow-origin');
    record(
      !allow,
      'CORS origem estranha bloqueada',
      allow ? `liberou ${allow} (revisar CORS_ORIGINS)` : 'sem header de liberação'
    );
  } catch (error) {
    record(false, 'CORS origem estranha bloqueada', error?.message || String(error));
  }
}

async function checkGtxTranslate() {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=good%20morning';
  try {
    const { res, ms } = await timedFetch(url);
    const data = await res.json().catch(() => null);
    const text = Array.isArray(data) && Array.isArray(data[0]) ? String(data[0][0]?.[0] || '') : '';
    record(Boolean(res.ok && text), 'Google Translate GTX (texto)', `"${text}" em ${ms}ms`);
  } catch (error) {
    record(false, 'Google Translate GTX (texto)', error?.message || String(error));
  }
}

async function checkMyMemory() {
  const url =
    'https://api.mymemory.translated.net/get?q=good%20morning&langpair=en|pt-BR';
  try {
    const { res, ms } = await timedFetch(url);
    const data = await res.json().catch(() => null);
    const status = Number(data?.responseStatus);
    const translated = String(data?.responseData?.translatedText || '');
    record(
      res.ok && status === 200 && Boolean(translated),
      'MyMemory (tradução)',
      `HTTP ${res.status} · responseStatus=${status || 'n/d'} · "${translated.slice(0, 60)}" em ${ms}ms`
    );
  } catch (error) {
    record(false, 'MyMemory (tradução)', error?.message || String(error));
  }
}

async function checkDictionary() {
  try {
    const { res, ms } = await timedFetch('https://api.dictionaryapi.dev/api/v2/entries/en/hello');
    const data = await res.json().catch(() => null);
    const phonetic = Array.isArray(data) ? String(data[0]?.phonetic || '') : '';
    record(res.ok && Array.isArray(data), 'dictionaryapi.dev', `HTTP ${res.status} · ${phonetic || 'sem fonética'} em ${ms}ms`);
  } catch (error) {
    record(false, 'dictionaryapi.dev', error?.message || String(error));
  }
}

async function checkSiteAuthProxy() {
  const isLocal = /localhost|127\.0\.0\.1/.test(SITE_URL);
  try {
    const { res } = await timedFetch(`${SITE_URL}/__/auth/iframe`, {
      headers: { Accept: 'text/html' }
    });
    record(
      res.ok ? true : isLocal ? 'warn' : false,
      'Proxy /__/auth/iframe (login first-party)',
      `HTTP ${res.status}${res.ok ? '' : isLocal ? ' (esperado no dev: só a Vercel tem o rewrite)' : ''}`
    );
  } catch (error) {
    record(false, 'Proxy /__/auth/iframe (login first-party)', error?.message || String(error));
  }
}

async function checkTts() {
  const payload = {
    text: 'Good morning, this is a connectivity check.',
    lang: 'en-US',
    provider: 'gemini_tts',
    voiceName: 'Kore',
    voiceStyle: 'clear_teacher'
  };
  try {
    const { res, ms } = await timedFetch(`${BASE_URL}/api/voice-hub/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const snippet = await bodySnippet(res);
      record(res.status === 503 ? 'warn' : false, 'TTS', `HTTP ${res.status} em ${ms}ms · ${snippet}`);
      return;
    }
    const data = await res.json().catch(() => null);
    const hasAudio = Boolean(data?.audioBase64 || data?.audioChunks?.length);
    record(
      hasAudio,
      'TTS',
      hasAudio ? `${data.providerUsed} · ${ms}ms` : 'resposta sem áudio'
    );
  } catch (error) {
    record(false, 'TTS', error?.message || String(error));
  }
}

async function checkSttValidation() {
  // Áudio inválido tem que ser recusado com 400: garante que o validador está
  // ativo sem gastar cota do Gemini.
  const bogus = Buffer.alloc(256, 7).toString('base64');
  try {
    const { res } = await timedFetch(`${BASE_URL}/api/voice-hub/stt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN },
      body: JSON.stringify({ audioBase64: bogus, mimeType: 'audio/webm', evaluatePronunciation: false })
    });
    const snippet = await bodySnippet(res, 120);
    record(res.status === 400, 'STT valida áudio inválido', `HTTP ${res.status} · ${snippet}`);
  } catch (error) {
    record(false, 'STT valida áudio inválido', error?.message || String(error));
  }
}

async function checkSttFile(filePath) {
  try {
    const { readFile } = await import('node:fs/promises');
    const bytes = await readFile(filePath);
    const ext = filePath.toLowerCase().split('.').pop() || '';
    const mimeByExt = {
      wav: 'audio/wav',
      webm: 'audio/webm',
      ogg: 'audio/ogg',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      mp4: 'audio/mp4'
    };
    const { res, ms } = await timedFetch(`${BASE_URL}/api/voice-hub/stt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN },
      body: JSON.stringify({
        audioBase64: bytes.toString('base64'),
        mimeType: mimeByExt[ext] || 'audio/webm',
        targetSentence: '',
        evaluatePronunciation: false
      })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      record(false, 'STT transcrição real', `HTTP ${res.status} em ${ms}ms · ${data?.error || ''}`);
      return;
    }
    const transcript = String(data?.transcript || '').trim();
    record(Boolean(transcript), 'STT transcrição real', transcript ? `"${transcript.slice(0, 60)}" em ${ms}ms` : 'transcript vazio');
  } catch (error) {
    record(false, 'STT transcrição real', error?.message || String(error));
  }
}

console.log(`API:  ${BASE_URL}`);
console.log(`Site: ${SITE_URL}`);
console.log(
  `Modo: ${WITH_TTS ? 'com TTS' : 'sem TTS'}${STT_FILE ? ' · com STT real' : ''}` +
    `${args.includes('--quiet') ? '' : ''}\n`
);

await checkApiStatus();
await checkCors();
await checkGtxTranslate();
await checkMyMemory();
await checkDictionary();
await checkSiteAuthProxy();
await checkSttValidation();
if (WITH_TTS) await checkTts();
if (STT_FILE) await checkSttFile(STT_FILE);

const failures = results.filter(r => r.ok === false);
const warnings = results.filter(r => r.ok === 'warn');
console.log(
  `\n${results.length} checks · ${results.length - failures.length - warnings.length} ok · ${warnings.length} warn · ${failures.length} falha(s)`
);

process.exit(failures.length > 0 ? 1 : 0);
