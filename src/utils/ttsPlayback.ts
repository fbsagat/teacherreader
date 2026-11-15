export interface TtsAudioChunkPayload {
  audioBase64: string;
  mimeType: string;
}

const DEFAULT_MAX_CHUNK_CHARS = 150;

/**
 * Normalizes punctuation and invisible characters before TTS synthesis without removing
 * or altering any spoken words, preventing neural and browser TTS engines from choking
 * or skipping middle clauses on curly quotes, em-dashes, ellipses, or tight commas.
 */
export function prepareSpeechTextForTts(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  let cleaned = rawText
    // Strip zero-width spaces, BOM, soft hyphens
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    // Normalize curly apostrophes to ASCII apostrophe (preserves contractions: don't, I'm, o'clock)
    .replace(/[’‘`]/g, "'")
    // Strip curly/straight double quotes that make cloud TTS endpoints clip quoted clauses
    .replace(/[“”"]/g, ' ')
    // Replace em-dash / en-dash with a comma pause so engines breathe instead of skipping words
    .replace(/\s*[—–]\s*/g, ', ')
    // Normalize ellipsis to comma/period pause
    .replace(/\u2026|\.{3,}/g, ', ')
    // Ensure a space after punctuation when immediately followed by a letter (keep decimals like 9.5 or 9:00 intact)
    .replace(/([,;!?])([A-Za-zÀ-ÖØ-öø-ÿ])/g, '$1 $2')
    // Collapse newlines, tabs, and repeated whitespace
    .replace(/\s+/g, ' ')
    // Clean redundant comma runs like ", ," or ": ,"
    .replace(/([,:;])\s*,+/g, '$1')
    .trim();

  // Remove orphaned leading/trailing commas created by dash/quote cleanup
  cleaned = cleaned.replace(/^[,\s]+|[,\s]+$/g, '').trim();
  return cleaned;
}

function splitLongSegmentByWordBounds(segment: string, maxChars: number): string[] {
  const trimmed = segment.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const words = trimmed.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    const candidate = `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      chunks.push(current);
      current = word;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

const SOFT_BREAK_WORDS = new Set([
  'and',
  'but',
  'or',
  'so',
  'because',
  'while',
  'when',
  'although',
  'though',
  'before',
  'after',
  'until',
  'since',
  'that',
  'which',
  'who',
  'where',
  'mas',
  'porque',
  'porém',
  'contudo',
  'entretanto',
  'enquanto',
  'quando',
  'embora',
  'antes',
  'depois',
  'até',
  'onde'
]);

function splitAtConjunctionOrWord(segment: string, maxChars: number): string[] {
  const trimmed = segment.trim();
  if (trimmed.length <= maxChars) return trimmed ? [trimmed] : [];

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const subParts: string[] = [];
  let currentTokens: string[] = [];

  const currentLen = () => currentTokens.join(' ').length;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const clean = token.toLowerCase().replace(/[^a-zà-öø-ÿ]/g, '');
    const projectedLen = currentTokens.length
      ? currentLen() + 1 + token.length
      : token.length;

    // If adding this token would exceed maxChars, flush currentTokens
    if (projectedLen > maxChars && currentTokens.length > 0) {
      subParts.push(currentTokens.join(' '));
      currentTokens = [token];
      continue;
    }

    // Prefer splitting cleanly right before a natural conjunction once the chunk has enough body
    if (
      currentTokens.length >= 4 &&
      SOFT_BREAK_WORDS.has(clean) &&
      currentLen() >= Math.floor(maxChars * 0.45) &&
      trimmed.length - currentLen() >= 18
    ) {
      subParts.push(currentTokens.join(' '));
      currentTokens = [token];
      continue;
    }

    currentTokens.push(token);
  }

  if (currentTokens.length > 0) {
    subParts.push(currentTokens.join(' '));
  }

  // Rebalance if the final chunk ended up as a tiny 1-2 word tail (< 22 chars)
  if (subParts.length >= 2) {
    const prevWords = subParts[subParts.length - 2].split(/\s+/).filter(Boolean);
    const lastWords = subParts[subParts.length - 1].split(/\s+/).filter(Boolean);
    while (lastWords.length < 3 && prevWords.length >= 5) {
      const candidateWord = prevWords[prevWords.length - 1];
      const candidateTail = `${candidateWord} ${lastWords.join(' ')}`;
      if (candidateTail.length > maxChars) break;
      lastWords.unshift(prevWords.pop()!);
    }
    subParts[subParts.length - 2] = prevWords.join(' ');
    subParts[subParts.length - 1] = lastWords.join(' ');
  }

  // Fallback word-bound guarantee if a chunk is still oversized
  return subParts.flatMap(part => splitLongSegmentByWordBounds(part, maxChars));
}

/**
 * Splits a long sentence or paragraph into ordered speech-safe chunks <= maxChunkChars
 * at natural sentence/clause boundaries so neither cloud TTS (TikTok / Google GTX / Gemini)
 * nor browser SpeechSynthesis ever truncates or swallows words in the middle of long sentences.
 *
 * Guarantees that 100% of spoken tokens appear in exact original order across the returned chunks.
 */
export function splitTextIntoTtsChunks(
  rawText: string,
  maxChunkChars = DEFAULT_MAX_CHUNK_CHARS
): string[] {
  const prepared = prepareSpeechTextForTts(rawText);
  if (!prepared) return [];

  const limit = Math.max(40, Math.floor(maxChunkChars));
  if (prepared.length <= limit) return [prepared];

  // Step 1: Split on sentence boundaries (. ! ? ; :) keeping punctuation with preceding unit
  const primaryUnits = prepared
    .split(/(?<=[.!?;:])\s+/)
    .map(u => u.trim())
    .filter(Boolean);

  // Step 2: Break oversized units at commas, then conjunctions/word boundaries
  const fineUnits: string[] = [];
  for (const unit of primaryUnits) {
    if (unit.length <= limit) {
      fineUnits.push(unit);
      continue;
    }
    const commaUnits = unit
      .split(/(?<=,)\s+/)
      .map(c => c.trim())
      .filter(Boolean);

    for (const cUnit of commaUnits) {
      if (cUnit.length <= limit) {
        fineUnits.push(cUnit);
      } else {
        fineUnits.push(...splitAtConjunctionOrWord(cUnit, limit));
      }
    }
  }

  // Step 3: Greedily re-pack adjacent small units up to limit so we minimize round-trips
  const packed: string[] = [];
  let buffer = '';

  for (const unit of fineUnits) {
    if (!buffer) {
      buffer = unit;
      continue;
    }
    const merged = `${buffer} ${unit}`;
    if (merged.length <= limit) {
      buffer = merged;
    } else {
      packed.push(buffer);
      buffer = unit;
    }
  }
  if (buffer) {
    packed.push(buffer);
  }

  return packed;
}

/**
 * Strips leading ID3v2 tag header from an MP3 buffer so concatenated chunks
 * do not embed ID3 headers in the middle of an audio stream.
 */
export function stripId3v2Header(mp3Buffer: Uint8Array): Uint8Array {
  if (mp3Buffer.length < 10) return mp3Buffer;
  if (mp3Buffer[0] === 0x49 && mp3Buffer[1] === 0x44 && mp3Buffer[2] === 0x33) {
    const tagSize =
      ((mp3Buffer[6] & 0x7f) << 21) |
      ((mp3Buffer[7] & 0x7f) << 14) |
      ((mp3Buffer[8] & 0x7f) << 7) |
      (mp3Buffer[9] & 0x7f);
    const totalHeaderBytes = 10 + tagSize;
    if (totalHeaderBytes > 0 && totalHeaderBytes < mp3Buffer.length) {
      return mp3Buffer.subarray(totalHeaderBytes);
    }
  }
  return mp3Buffer;
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Concatenates multiple MP3 base64 segments into a single base64 buffer,
 * stripping ID3v2 headers from chunks >= 1.
 */
export function concatenateMp3Base64(base64Chunks: string[]): string {
  const valid = base64Chunks.filter(c => typeof c === 'string' && c.length > 0);
  if (valid.length === 0) return '';
  if (valid.length === 1) return valid[0];

  const byteParts = valid.map((b64, idx) => {
    const raw = decodeBase64ToBytes(b64);
    return idx === 0 ? raw : stripId3v2Header(raw);
  });

  const totalLength = byteParts.reduce((acc, part) => acc + part.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of byteParts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return encodeBytesToBase64(merged);
}

function findWavDataChunkBounds(wavBytes: Uint8Array): { dataStart: number; dataLength: number } | null {
  if (wavBytes.length < 44) return null;
  if (
    wavBytes[0] !== 0x52 ||
    wavBytes[1] !== 0x49 ||
    wavBytes[2] !== 0x46 ||
    wavBytes[3] !== 0x46
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= wavBytes.length) {
    const id0 = wavBytes[offset];
    const id1 = wavBytes[offset + 1];
    const id2 = wavBytes[offset + 2];
    const id3 = wavBytes[offset + 3];
    const chunkSize =
      wavBytes[offset + 4] |
      (wavBytes[offset + 5] << 8) |
      (wavBytes[offset + 6] << 16) |
      (wavBytes[offset + 7] << 24);

    if (id0 === 0x64 && id1 === 0x61 && id2 === 0x74 && id3 === 0x61) {
      const dataStart = offset + 8;
      const available = Math.max(0, wavBytes.length - dataStart);
      const dataLength = chunkSize > 0 ? Math.min(chunkSize >>> 0, available) : available;
      return { dataStart, dataLength };
    }

    const paddedSize = (chunkSize >>> 0) + ((chunkSize & 1) === 1 ? 1 : 0);
    offset += 8 + Math.max(0, paddedSize);
  }
  return null;
}

/**
 * Concatenates multiple PCM WAV base64 clips (e.g., Gemini 3.8 TTS unary output)
 * into a single valid RIFF/WAV file with updated ChunkSize and Subchunk2Size headers.
 */
export function concatenateWavBase64(base64Chunks: string[]): string {
  const valid = base64Chunks.filter(c => typeof c === 'string' && c.length > 0);
  if (valid.length === 0) return '';
  if (valid.length === 1) return valid[0];

  const decoded = valid.map(decodeBase64ToBytes);
  const firstBounds = findWavDataChunkBounds(decoded[0]);
  if (!firstBounds) {
    return valid[0];
  }

  const header = new Uint8Array(decoded[0].subarray(0, firstBounds.dataStart));
  const pcmParts: Uint8Array[] = [
    decoded[0].subarray(firstBounds.dataStart, firstBounds.dataStart + firstBounds.dataLength)
  ];

  for (let i = 1; i < decoded.length; i++) {
    const bounds = findWavDataChunkBounds(decoded[i]);
    if (bounds) {
      pcmParts.push(decoded[i].subarray(bounds.dataStart, bounds.dataStart + bounds.dataLength));
    } else if (decoded[i].length > 44) {
      pcmParts.push(decoded[i].subarray(44));
    }
  }

  const totalPcmBytes = pcmParts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(header.length + totalPcmBytes);
  result.set(header, 0);

  let writePos = header.length;
  for (const pcm of pcmParts) {
    result.set(pcm, writePos);
    writePos += pcm.length;
  }

  const riffSize = result.length - 8;
  result[4] = riffSize & 0xff;
  result[5] = (riffSize >> 8) & 0xff;
  result[6] = (riffSize >> 16) & 0xff;
  result[7] = (riffSize >> 24) & 0xff;

  const dataSizeOffset = header.length - 4;
  result[dataSizeOffset] = totalPcmBytes & 0xff;
  result[dataSizeOffset + 1] = (totalPcmBytes >> 8) & 0xff;
  result[dataSizeOffset + 2] = (totalPcmBytes >> 16) & 0xff;
  result[dataSizeOffset + 3] = (totalPcmBytes >> 24) & 0xff;

  return encodeBytesToBase64(result);
}

export interface BrowserIdleCompletionInput {
  sawSpeaking: boolean;
  idleTicksAfterStart: number;
  elapsedSinceStartMs: number;
  spokenText: string;
  rate: number;
}

/**
 * Prevents browser SpeechSynthesis polling from declaring a multi-word chunk finished during brief
 * inter-clause network buffering pauses (< ~800ms or before minimum natural reading time).
 */
export function shouldTreatBrowserUtteranceAsFinished({
  sawSpeaking,
  idleTicksAfterStart,
  elapsedSinceStartMs,
  spokenText,
  rate
}: BrowserIdleCompletionInput): boolean {
  if (!sawSpeaking) return false;
  if (idleTicksAfterStart < 5) return false;
  const safeRate = Math.max(0.6, Number.isFinite(rate) ? rate : 1.0);
  const words = (spokenText || '').trim().split(/\s+/).filter(Boolean).length;
  const minExpectedMs =
    words <= 1
      ? 260
      : Math.min(2400, Math.round(((spokenText || '').trim().length * 32) / safeRate));
  return elapsedSinceStartMs >= minExpectedMs;
}
