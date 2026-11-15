import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type { GoogleGenAI } from '@google/genai';
import {
  concatenateMp3Base64,
  concatenateWavBase64,
  splitTextIntoTtsChunks,
  type TtsAudioChunkPayload
} from './src/utils/ttsPlayback.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

let genAiModulePromise: Promise<typeof import('@google/genai')> | null = null;
function loadGenAiModule() {
  if (!genAiModulePromise) {
    genAiModulePromise = import('@google/genai');
  }
  return genAiModulePromise;
}

async function getGeminiClient(): Promise<GoogleGenAI | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const { GoogleGenAI: GenAIClass } = await loadGenAiModule();
  return new GenAIClass({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

const GEMINI_VOICE_STYLE_PROMPTS: Record<string, string> = {
  clear_teacher: 'Clear, articulate American English teacher speaking naturally for language learners',
  audiobook: 'Warm, engaging American audiobook narrator with natural storytelling cadence',
  conversational: 'Friendly, natural everyday American conversation',
  slow_learner: 'Calm, patient, well-enunciated American pronunciation for beginners'
};

const STYLE_RATE_MULTIPLIER: Record<string, number> = {
  clear_teacher: 0.97,
  audiobook: 1.0,
  conversational: 1.06,
  slow_learner: 0.88
};

// Maps each Gemini Neural voice persona to a distinct Cloud Neural voice fallback ID
const NEURAL_CLOUD_PERSONA_EN_MAP: Record<string, string> = {
  Kore: 'en_us_001',
  Puck: 'en_us_006',
  Charon: 'en_male_narration',
  Fenrir: 'en_us_009',
  Zephyr: 'en_female_emotional'
};

const NEURAL_CLOUD_PERSONA_PT_MAP: Record<string, string> = {
  Kore: 'br_001',
  Puck: 'br_005',
  Charon: 'br_005',
  Fenrir: 'br_005',
  Zephyr: 'br_003'
};

interface ServerTtsResult {
  audioBase64: string;
  audioChunks: TtsAudioChunkPayload[];
  mimeType: string;
  providerUsed: string;
}

let geminiTtsCooldownUntil = 0;

function extractAllGeminiAudioParts(response: any): string[] {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return [];
  const audioParts: string[] = [];
  for (const part of parts) {
    const data = part?.inlineData?.data;
    if (typeof data === 'string' && data.length > 0) {
      audioParts.push(data);
    }
  }
  return audioParts;
}

async function synthesizeGeminiSingleChunk(
  ai: GoogleGenAI,
  chunkText: string,
  selectedVoice: string,
  styleInstruction: string
): Promise<string | null> {
  const buildConfig = () => ({
    responseModalities: ['AUDIO'] as string[],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: selectedVoice }
      }
    }
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: chunkText,
              speechMetadata: {
                style: styleInstruction
              }
            } as any
          ]
        }
      ],
      config: buildConfig()
    });
    const audioParts = extractAllGeminiAudioParts(response);
    if (audioParts.length > 0) {
      return concatenateWavBase64(audioParts);
    }
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (err?.status === 429 || msg.includes('429') || msg.includes('Quota exceeded')) {
      geminiTtsCooldownUntil = Date.now() + 90_000;
      return null;
    }
    if (err?.status === 400 || msg.includes('INVALID_ARGUMENT') || msg.includes('speechMetadata')) {
      try {
        const plainResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [{ text: chunkText }]
            }
          ],
          config: buildConfig()
        });
        const audioParts = extractAllGeminiAudioParts(plainResponse);
        if (audioParts.length > 0) {
          return concatenateWavBase64(audioParts);
        }
      } catch (retryErr: any) {
        const retryMsg = String(retryErr?.message || '');
        if (retryErr?.status === 429 || retryMsg.includes('429') || retryMsg.includes('Quota exceeded')) {
          geminiTtsCooldownUntil = Date.now() + 90_000;
        }
      }
    }
  }
  return null;
}

async function synthesizeWithGeminiTts(
  text: string,
  lang: string,
  voiceName = 'Kore',
  voiceStyle = 'clear_teacher'
): Promise<ServerTtsResult | null> {
  if (Date.now() < geminiTtsCooldownUntil) {
    return null;
  }
  const ai = await getGeminiClient();
  if (!ai) return null;

  const validVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
  const selectedVoice = validVoices.includes(voiceName) ? voiceName : 'Kore';
  const styleInstruction = lang.startsWith('pt')
    ? 'Clear, natural Brazilian Portuguese narrator'
    : GEMINI_VOICE_STYLE_PROMPTS[voiceStyle] || GEMINI_VOICE_STYLE_PROMPTS.clear_teacher;

  const chunks = splitTextIntoTtsChunks(text, 240);
  if (chunks.length === 0) return null;

  const wavBase64Parts: string[] = [];
  for (const chunk of chunks) {
    const wavPart = await synthesizeGeminiSingleChunk(ai, chunk, selectedVoice, styleInstruction);
    if (!wavPart) {
      return null;
    }
    wavBase64Parts.push(wavPart);
  }

  return {
    audioBase64: concatenateWavBase64(wavBase64Parts),
    audioChunks: wavBase64Parts.map(audioBase64 => ({
      audioBase64,
      mimeType: 'audio/wav'
    })),
    mimeType: 'audio/wav',
    providerUsed: 'gemini_tts'
  };
}

async function fetchNeuralCloudSingleChunk(
  chunkText: string,
  neuralVoiceId: string,
  attempts = 2
): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5200);
      const resp = await fetch('https://tiktok-tts.weilnet.workers.dev/api/generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chunkText,
          voice: neuralVoiceId
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (resp.ok) {
        const json: any = await resp.json();
        if (json?.success && typeof json.data === 'string' && json.data.length > 100) {
          return json.data;
        }
      }
    } catch {
      // retry once if transient
    }
  }
  return null;
}

async function synthesizeWithNeuralCloudPersona(
  text: string,
  lang: string,
  voiceName = 'Kore',
  _voiceStyle = 'clear_teacher',
  providerLabel = 'neural_cloud'
): Promise<ServerTtsResult | null> {
  const isPt = lang.toLowerCase().startsWith('pt');
  const neuralVoiceId = isPt
    ? NEURAL_CLOUD_PERSONA_PT_MAP[voiceName] || 'br_001'
    : NEURAL_CLOUD_PERSONA_EN_MAP[voiceName] || 'en_us_001';

  // Keep each request <= 150 chars so upstream Cloud TTS never truncates or silently drops middle segments
  const chunks = splitTextIntoTtsChunks(text, 150);
  if (chunks.length === 0) return null;

  const orderedParts: (string | null)[] = Array(chunks.length).fill(null);
  const concurrency = 2;
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(chunk => fetchNeuralCloudSingleChunk(chunk, neuralVoiceId))
    );
    for (let j = 0; j < batchResults.length; j++) {
      orderedParts[i + j] = batchResults[j];
    }
  }

  // Never serve partial audio if any chunk failed — fall back cleanly so every word is spoken
  if (orderedParts.some(p => !p)) {
    return null;
  }

  const validParts = orderedParts as string[];
  return {
    audioBase64: concatenateMp3Base64(validParts),
    audioChunks: validParts.map(audioBase64 => ({
      audioBase64,
      mimeType: 'audio/mpeg'
    })),
    mimeType: 'audio/mpeg',
    providerUsed: `${providerLabel}:${neuralVoiceId}`
  };
}

async function fetchGoogleCloudGtxSingleChunk(
  chunkText: string,
  tl: string,
  attempts = 2
): Promise<string | null> {
  const clean = chunkText.replace(/["]/g, '').trim();
  if (!clean) return null;
  const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${tl}&q=${encodeURIComponent(clean)}`;

  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const gtxRes = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (gtxRes.ok) {
        const arrayBuf = await gtxRes.arrayBuffer();
        if (arrayBuf.byteLength > 100) {
          return Buffer.from(arrayBuf).toString('base64');
        }
      }
    } catch {
      // retry once if transient
    }
  }
  return null;
}

async function synthesizeWithGoogleCloudGtx(
  text: string,
  lang: string
): Promise<ServerTtsResult | null> {
  const isPt = lang.toLowerCase().startsWith('pt');
  const tl = isPt ? 'pt-BR' : 'en-US';

  // Split long sentences cleanly <= 145 chars so Google GTX never clips >200-char sentences
  const chunks = splitTextIntoTtsChunks(text, 145);
  if (chunks.length === 0) return null;

  const orderedParts: (string | null)[] = Array(chunks.length).fill(null);
  const concurrency = 2;
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(chunk => fetchGoogleCloudGtxSingleChunk(chunk, tl))
    );
    for (let j = 0; j < batchResults.length; j++) {
      orderedParts[i + j] = batchResults[j];
    }
  }

  if (orderedParts.some(p => !p)) {
    return null;
  }

  const validParts = orderedParts as string[];
  return {
    audioBase64: concatenateMp3Base64(validParts),
    audioChunks: validParts.map(audioBase64 => ({
      audioBase64,
      mimeType: 'audio/mpeg'
    })),
    mimeType: 'audio/mpeg',
    providerUsed: `google_gtx:${tl}`
  };
}

function createRateLimiter(maxRequests: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();

    // Keep the in-memory map bounded when the API is exposed to the internet.
    if (hits.size > 5000) {
      for (const [key, entry] of hits) {
        if (now >= entry.resetAt) hits.delete(key);
      }
    }

    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = hits.get(key);

    if (!current || now >= current.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;
    if (current.count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Muitas requisições. Aguarde alguns segundos e tente novamente.'
      });
      return;
    }

    next();
  };
}

async function startServer() {
  const app = express();
  const apiOnly = process.env.API_ONLY === 'true';
  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  app.set('trust proxy', true);
  app.use(express.json({ limit: '15mb' }));

  // The frontend can live on Vercel while this Express app runs on the VPS.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  const ttsRateLimit = createRateLimiter(30, 60_000);
  const sttRateLimit = createRateLimiter(20, 60_000);

  // 1. Provider Status Endpoint
  app.get('/api/voice-hub/status', (_req, res) => {
    res.json({
      providers: {
        gemini: Boolean(process.env.GEMINI_API_KEY),
        googleStream: true
      }
    });
  });

  // 2. Multi-Provider Neural TTS Endpoint
  app.post('/api/voice-hub/tts', ttsRateLimit, async (req, res) => {
    try {
      const {
        text,
        lang = 'en-US',
        provider = 'gemini_tts',
        voiceName = 'Kore',
        voiceStyle = 'clear_teacher'
      } = req.body || {};

      if (!text || typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Texto ausente para síntese de voz.' });
        return;
      }

      const cleanText = text.trim().slice(0, 1500);
      const styleMultiplier = STYLE_RATE_MULTIPLIER[voiceStyle] || 1.0;

      // Option 0: Direct Google Cloud Stream (GTX) via Server Proxy (avoids browser CORS/Referer blocks)
      if (provider === 'online') {
        const gtxAudio = await synthesizeWithGoogleCloudGtx(cleanText, lang);
        if (gtxAudio) {
          res.json({ ...gtxAudio, styleMultiplier: 1.0 });
          return;
        }
      }

      // Option A: Gemini Neural TTS (when provider === 'gemini_tts' and quota available)
      if (provider === 'gemini_tts') {
        const geminiAudio = await synthesizeWithGeminiTts(cleanText, lang, voiceName, voiceStyle);
        if (geminiAudio) {
          res.json({ ...geminiAudio, styleMultiplier });
          return;
        }
      }

      // Option B: Cloud Neural Multi-Persona Stream (distinct voices for Kore, Puck, Charon, Fenrir, Zephyr)
      const neuralPersonaAudio = await synthesizeWithNeuralCloudPersona(
        cleanText,
        lang,
        voiceName,
        voiceStyle,
        provider
      );
      if (neuralPersonaAudio) {
        res.json({ ...neuralPersonaAudio, styleMultiplier });
        return;
      }

      // Option C: Server-side Google Cloud GTX Stream Fallback
      const gtxFallback = await synthesizeWithGoogleCloudGtx(cleanText, lang);
      if (gtxFallback) {
        res.json({ ...gtxFallback, styleMultiplier });
        return;
      }

      res.status(503).json({
        error: 'Provedor neural indisponível no momento; usando voz local/nativa como fallback.'
      });
    } catch (error: any) {
      res.status(500).json({
        error: error?.message || 'Erro ao sintetizar áudio neural.'
      });
    }
  });

  // 3. Multi-Provider Speech Recognition (STT) & Multimodal Pronunciation Assessment
  app.post('/api/voice-hub/stt', sttRateLimit, async (req, res) => {
    try {
      const {
        audioBase64,
        mimeType = 'audio/webm',
        targetSentence = '',
        provider = 'gemini_stt',
        evaluatePronunciation = true
      } = req.body || {};

      if (!audioBase64 || typeof audioBase64 !== 'string') {
        res.status(400).json({ error: 'Áudio não fornecido para transcrição.' });
        return;
      }

      const ai = await getGeminiClient();
      if (!ai) {
        res.status(503).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
        return;
      }
      const { ThinkingLevel, Type } = await loadGenAiModule();

      const cleanMime = mimeType.split(';')[0].trim() || 'audio/webm';

      // Fast transcription only via gemini-3.5-transcribe
      if (!evaluatePronunciation) {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: audioBase64
                }
              },
              {
                text: targetSentence
                  ? `Transcribe the English speech in this audio accurately. Expected target phrase context: "${targetSentence}". Always write spoken numbers, times, dates, and ordinals as full English words (e.g., "nine o'clock", "twenty-five", "first"), NEVER as digits or clock notation (never "9:00", "25", "1st"). Output ONLY the exact words spoken by the user.`
                  : 'Transcribe the English speech in this audio accurately. Always write spoken numbers, times, dates, and ordinals as full English words (e.g., "nine o\'clock", "twenty-five", "first"), NEVER as digits or clock notation (never "9:00", "25", "1st"). Output ONLY the exact words spoken.'
              }
            ]
          }
        });

        res.json({
          transcript: (response.text ?? '').trim(),
          providerUsed: 'gemini_3_5_transcribe'
        });
        return;
      }

      // Multimodal Pronunciation Coach + Transcription via gemini-4-hydrogen
      const coachResponse = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: cleanMime,
                data: audioBase64
              }
            },
            {
              text: `You are an American English pronunciation coach for a Brazilian Portuguese speaker.
Listen carefully to the user's audio recording attempting to say the target sentence: "${targetSentence}".
1. Transcribe what the user actually said in English ("transcript"). IMPORTANT: Always write all spoken numbers, times, dates, and ordinals as full English words (e.g., "nine o'clock", "twenty-five", "first"), NEVER as digits or clock notation (never "9:00", "25", "1st").
2. Evaluate overall pronunciation accuracy (0-100), fluency/rhythm (0-100), and connected speech prosody (0-100).
3. Write a concise, encouraging 1-sentence phonetic tip in Brazilian Portuguese ("coachTipPt") focusing on the most important American English sound in this sentence (e.g., TH sound, silent letters, -ED ending, vowel reduction, or consonant-vowel linking).
4. List any specific words from the target sentence where pronunciation sounded hesitant or accented ("focusWords").`
            }
          ]
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcript: {
                type: Type.STRING,
                description:
                  'Exact English words spoken by the user, with all numbers and times spelled out as words (never digits like 9:00).'
              },
              pronunciationScore: {
                type: Type.INTEGER,
                description: 'Overall phonetic accuracy score from 0 to 100.'
              },
              fluencyScore: {
                type: Type.INTEGER,
                description: 'Rhythm and smoothness score from 0 to 100.'
              },
              prosodyScore: {
                type: Type.INTEGER,
                description: 'American intonation and linking score from 0 to 100.'
              },
              coachTipPt: {
                type: Type.STRING,
                description: 'Short, actionable phonetic tip in Brazilian Portuguese.'
              },
              focusWords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Words to pay special attention to.'
              }
            },
            required: [
              'transcript',
              'pronunciationScore',
              'fluencyScore',
              'prosodyScore',
              'coachTipPt',
              'focusWords'
            ]
          }
        }
      });

      const parsed = JSON.parse((coachResponse.text ?? '{}').trim());
      res.json({
        transcript: String(parsed.transcript || '').trim(),
        pronunciationScore: Number(parsed.pronunciationScore ?? 85),
        fluencyScore: Number(parsed.fluencyScore ?? 85),
        prosodyScore: Number(parsed.prosodyScore ?? 85),
        coachTipPt: String(parsed.coachTipPt || '').trim(),
        focusWords: Array.isArray(parsed.focusWords) ? parsed.focusWords : [],
        providerUsed: 'gemini_coach'
      });
    } catch (error: any) {
      res.status(500).json({
        error: error?.message || 'Erro ao avaliar pronúncia por áudio.'
      });
    }
  });

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // API-only mode: the Vite/static frontend is hosted by Vercel instead.
  if (apiOnly) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    const viteServerPromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer }
        },
        appType: 'spa'
      })
    );
    viteServerPromise.catch(err => {
      console.error('Vite middleware initialization failed:', err);
    });
    app.use(async (req, res, next) => {
      try {
        const vite = await viteServerPromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer();
