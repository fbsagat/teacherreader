import test from 'node:test';
import assert from 'node:assert/strict';
import {
  concatenateMp3Base64,
  concatenateWavBase64,
  prepareSpeechTextForTts,
  shouldTreatBrowserUtteranceAsFinished,
  splitTextIntoTtsChunks,
  stripId3v2Header
} from './ttsPlayback';

function extractWordsForComparison(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"“”‘’()—–\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

test('prepareSpeechTextForTts preserves every spoken word while cleaning problematic TTS punctuation', () => {
  const sampleEn =
    'In the book it said: “Boa constrictors swallow their prey whole—without chewing it.”';
  const preparedEn = prepareSpeechTextForTts(sampleEn);
  assert.deepEqual(extractWordsForComparison(preparedEn), extractWordsForComparison(sampleEn));
  assert.equal(preparedEn.includes('“'), false);
  assert.equal(preparedEn.includes('—'), false);

  const samplePt =
    'No livro dizia:\n“As jiboias engolem suas presas inteiras — sem mastigar — durante seis meses.”';
  const preparedPt = prepareSpeechTextForTts(samplePt);
  assert.deepEqual(extractWordsForComparison(preparedPt), extractWordsForComparison(samplePt));
  assert.equal(preparedPt.includes('\n'), false);
});

test('splitTextIntoTtsChunks preserves 100% of words in exact order for long EN and PT sentences', () => {
  const longEn =
    'Even though we tried to finish everything before midnight, the heavy rain knocked out the power across the whole neighborhood, so we had to wait until morning to send the final report to the team and confirm the delivery schedule.';
  const enChunks = splitTextIntoTtsChunks(longEn, 140);
  assert.ok(enChunks.length >= 2);
  for (const chunk of enChunks) {
    assert.ok(chunk.length <= 140, `Expected chunk <= 140 chars, got ${chunk.length}: ${chunk}`);
  }
  assert.deepEqual(
    extractWordsForComparison(enChunks.join(' ')),
    extractWordsForComparison(longEn)
  );

  const longPt =
    'Quando a tempestade finalmente passou sobre as montanhas, arrumamos nossas malas, agradecemos aos nossos anfitriões pela gentileza, conferimos os mapas antigos na mesa da cozinha e voltamos para a tranquila cidade costeira antes do pôr do sol.';
  const ptChunks = splitTextIntoTtsChunks(longPt, 140);
  assert.ok(ptChunks.length >= 2);
  for (const chunk of ptChunks) {
    assert.ok(chunk.length <= 140, `Expected chunk <= 140 chars, got ${chunk.length}: ${chunk}`);
  }
  assert.deepEqual(
    extractWordsForComparison(ptChunks.join(' ')),
    extractWordsForComparison(longPt)
  );
});

test('splitTextIntoTtsChunks handles unpunctuated long text at conjunctions and word boundaries without dropping words', () => {
  const noPunctEn =
    'When the express train arrived at the quiet station in Kyoto everyone stepped onto the platform and noticed how clean the morning air felt after the summer rain';
  const chunks = splitTextIntoTtsChunks(noPunctEn, 75);
  assert.ok(chunks.length >= 3);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 75);
  }
  assert.deepEqual(
    extractWordsForComparison(chunks.join(' ')),
    extractWordsForComparison(noPunctEn)
  );
});

test('stripId3v2Header and concatenateMp3Base64 strip mid-stream ID3 headers while keeping frame payloads intact', () => {
  // Construct fake MP3 chunk with 10-byte ID3 header claiming size=4 ("Lavf") + 4 frame bytes
  const chunk1 = Buffer.from([
    0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04,
    0x4c, 0x61, 0x76, 0x66,
    0xff, 0xfb, 0x90, 0x00
  ]);
  const chunk2 = Buffer.from([
    0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04,
    0x4c, 0x61, 0x76, 0x66,
    0xff, 0xfb, 0x90, 0x01
  ]);

  const stripped2 = stripId3v2Header(chunk2);
  assert.deepEqual(Array.from(stripped2), [0xff, 0xfb, 0x90, 0x01]);

  const mergedB64 = concatenateMp3Base64([
    chunk1.toString('base64'),
    chunk2.toString('base64')
  ]);
  const merged = Buffer.from(mergedB64, 'base64');
  // Chunk 1 keeps ID3, chunk 2 ID3 header is stripped cleanly
  assert.equal(merged.length, chunk1.length + 4);
  assert.deepEqual(Array.from(merged.subarray(chunk1.length)), [0xff, 0xfb, 0x90, 0x01]);
});

test('concatenateWavBase64 merges PCM payloads cleanly with updated RIFF and data chunk sizes', () => {
  const makeWav = (pcmBytes: number[]) => {
    const buf = Buffer.alloc(44 + pcmBytes.length);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + pcmBytes.length, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(24000, 24);
    buf.writeUInt32LE(48000, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(pcmBytes.length, 40);
    Buffer.from(pcmBytes).copy(buf, 44);
    return buf.toString('base64');
  };

  const wav1 = makeWav([1, 2, 3, 4]);
  const wav2 = makeWav([5, 6, 7, 8, 9, 10]);
  const merged = Buffer.from(concatenateWavBase64([wav1, wav2]), 'base64');

  assert.equal(merged.toString('ascii', 0, 4), 'RIFF');
  assert.equal(merged.readUInt32LE(4), 36 + 10);
  assert.equal(merged.readUInt32LE(40), 10);
  assert.deepEqual(Array.from(merged.subarray(44)), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('shouldTreatBrowserUtteranceAsFinished ignores brief mid-sentence pauses and requires sustained idle after minimum reading duration', () => {
  const sentence = 'Boa constrictors swallow their prey whole, without chewing it.';
  // Brief 2-tick (320ms) pause during clause transition should NOT finish prematurely
  assert.equal(
    shouldTreatBrowserUtteranceAsFinished({
      sawSpeaking: true,
      idleTicksAfterStart: 2,
      elapsedSinceStartMs: 2500,
      spokenText: sentence,
      rate: 0.9
    }),
    false
  );

  // Sustained idle (>= 5 ticks) before minimum reading duration elapsed should NOT finish
  assert.equal(
    shouldTreatBrowserUtteranceAsFinished({
      sawSpeaking: true,
      idleTicksAfterStart: 5,
      elapsedSinceStartMs: 900,
      spokenText: sentence,
      rate: 0.9
    }),
    false
  );

  // Sustained idle after realistic elapsed duration succeeds
  assert.equal(
    shouldTreatBrowserUtteranceAsFinished({
      sawSpeaking: true,
      idleTicksAfterStart: 5,
      elapsedSinceStartMs: 2600,
      spokenText: sentence,
      rate: 0.9
    }),
    true
  );
});

test('splitTextIntoTtsChunks rebalances single-word trailing tails on slightly oversized clauses', () => {
  const ptClause =
    'Os documentos provavam que o incêndio no armazém havia sido iniciado intencionalmente para destruir registros financeiros.';
  const chunks = splitTextIntoTtsChunks(ptClause, 120);
  assert.equal(chunks.length, 2);
  const lastWords = chunks[1].split(/\s+/).filter(Boolean);
  assert.ok(lastWords.length >= 3, `Expected balanced tail >= 3 words, got: "${chunks[1]}"`);
  assert.deepEqual(
    extractWordsForComparison(chunks.join(' ')),
    extractWordsForComparison(ptClause)
  );
});
