import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  cleanRtfText,
  cleanSubtitleText,
  extractTextFromHtml,
  parseCsvOrTsvSentences,
  parseJsonSentences,
  parseUploadedStudyFile
} from './fileParsers';

interface ZipFixtureEntry {
  name: string;
  content: string;
  deflate?: boolean;
  dataDescriptor?: boolean;
}

/** Builds a real (CRC-less) ZIP: local headers + central directory + EOCD. */
function buildZip(entries: ZipFixtureEntry[]): ArrayBuffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const data = Buffer.from(entry.content, 'utf8');
    const payload = entry.deflate ? zlib.deflateRawSync(data) : data;
    const method = entry.deflate ? 8 : 0;
    const flags = entry.dataDescriptor ? 0x08 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    if (entry.dataDescriptor) {
      // Data descriptor mode leaves the local sizes empty (bit 3 set).
      local.writeUInt32LE(0, 18);
      local.writeUInt32LE(0, 22);
    } else {
      local.writeUInt32LE(payload.length, 18);
      local.writeUInt32LE(data.length, 22);
    }
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);

    const parts: Buffer[] = [local, nameBytes, payload];
    if (entry.dataDescriptor) {
      const descriptor = Buffer.alloc(16);
      descriptor.writeUInt32LE(0x08074b50, 0);
      descriptor.writeUInt32LE(payload.length, 8);
      descriptor.writeUInt32LE(data.length, 12);
      parts.push(descriptor);
    }

    const localBlock = Buffer.concat(parts);
    localChunks.push(localBlock);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centralChunks.push(Buffer.concat([central, nameBytes]));

    offset += localBlock.length;
  }

  const centralBuffer = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);

  const output = Buffer.concat([...localChunks, centralBuffer, eocd]);
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}

function makeDocxZip(): ArrayBuffer {
  return buildZip([
    {
      name: 'word/document.xml',
      deflate: true,
      content:
        '<?xml version="1.0"?><w:document><w:body>' +
        '<w:p><w:r><w:t>Hello brave new world.</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t>Second paragraph here.</w:t></w:r></w:p>' +
        '</w:body></w:document>'
    }
  ]);
}

function makeEpubZip(options: { deflate?: boolean; descriptor?: boolean } = {}): ArrayBuffer {
  return buildZip([
    {
      name: 'META-INF/container.xml',
      deflate: options.deflate,
      dataDescriptor: options.descriptor,
      content:
        '<?xml version="1.0"?><container><rootfiles>' +
        '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>' +
        '</rootfiles></container>'
    },
    {
      name: 'OEBPS/content.opf',
      deflate: options.deflate,
      dataDescriptor: options.descriptor,
      content:
        '<?xml version="1.0"?><package><manifest>' +
        '<item id="c1" href="Text/zzz.xhtml" media-type="application/xhtml+xml"/>' +
        '<item id="c2" href="Text/aaa.xhtml" media-type="application/xhtml+xml"/>' +
        '</manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>'
    },
    {
      name: 'OEBPS/Text/zzz.xhtml',
      deflate: options.deflate,
      dataDescriptor: options.descriptor,
      content:
        '<html><body><p>The zebra chapter comes first in the spine order.</p></body></html>'
    },
    {
      name: 'OEBPS/Text/aaa.xhtml',
      deflate: options.deflate,
      dataDescriptor: options.descriptor,
      content:
        '<html><body><p>The alpha chapter comes second despite the file name.</p></body></html>'
    }
  ]);
}

test('cleanRtfText decodes CP1252 escapes, skips destinations and keeps paragraph breaks', () => {
  const rtf = String.raw`{\rtf1\ansi\ansicpg1252{\fonttbl{\f0 Times New Roman;}}{\*\generator Msftedit;}\f0 Caf\'e9 com leite!\par Nova linha com \u233? teste.}`;
  assert.equal(cleanRtfText(rtf), 'Café com leite! Nova linha com é teste.');
});

test('cleanRtfText keeps escaped braces and quotes instead of dropping them', () => {
  const rtf = String.raw`{\rtf1 He said \{hi\} and \{bye\}.}`;
  assert.equal(cleanRtfText(rtf), 'He said {hi} and {bye}.');
});

test('parseCsvOrTsvSentences handles CRLF, quoted commas and the "" escape', () => {
  const csv =
    'en,pt\r\n' +
    '"Hello, world","Olá, mundo"\r\n' +
    '"He said ""hi"" today.",Ele disse "oi" hoje.\r\n';

  const sentences = parseCsvOrTsvSentences(csv);
  assert.equal(sentences.length, 2);
  assert.equal(sentences[0].en, 'Hello, world.');
  assert.equal(sentences[0].pt, 'Olá, mundo');
  assert.equal(sentences[1].en, 'He said "hi" today.');
});

test('parseCsvOrTsvSentences keeps quoted cells that span multiple lines', () => {
  const csv = 'en,pt\n"First line\nstill the same sentence","Primeira"\nSecond sentence,Segunda\n';
  const sentences = parseCsvOrTsvSentences(csv);

  assert.equal(sentences.length, 2);
  assert.match(sentences[0].en, /First line\s+still the same sentence/);
  assert.equal(sentences[1].en, 'Second sentence.');
});

test('parseJsonSentences reports malformed JSON in pt-BR instead of leaking SyntaxError', () => {
  assert.throws(() => parseJsonSentences('{ "sentences": [ }'), /JSON inválido/);
  assert.throws(() => parseJsonSentences('{"sentences": [1,]}'), /JSON inválido/);
});

test('parseJsonSentences accepts arrays, {sentences} and bilingual objects', () => {
  const fromStrings = parseJsonSentences('["Hello there friend", "Another sentence here"]');
  assert.equal(fromStrings.length, 2);
  assert.equal(fromStrings[0].en, 'Hello there friend.');

  const fromObjects = parseJsonSentences(
    '{"items":[{"en":"Good morning","pt":"Bom dia"},{"text":"See you later"}]}'
  );
  assert.equal(fromObjects.length, 2);
  assert.equal(fromObjects[0].pt, 'Bom dia');
  assert.equal(fromObjects[1].en, 'See you later.');
});

test('extractTextFromHtml strips scripts, styles and tags (regex fallback)', () => {
  const html =
    '<html><head><style>p{color:red}</style><script>alert(1)</script></head>' +
    '<body><p>Hello world from HTML.</p></body></html>';
  assert.equal(extractTextFromHtml(html), 'Hello world from HTML.');
});

test('cleanSubtitleText drops CRLF timestamps and cue indices', () => {
  const srt = '1\r\n00:00:01,000 --> 00:00:03,000\r\nHello there.\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\nGeneral Kenobi.\r\n';
  assert.equal(cleanSubtitleText(srt), 'Hello there. General Kenobi.');
});

test('parseUploadedStudyFile extracts a deflated DOCX through the central directory', async () => {
  const file = new File([makeDocxZip()], 'sample.docx');
  const result = await parseUploadedStudyFile(file);

  assert.equal(result.formatLabel, 'Documento Word (DOCX)');
  assert.equal(result.sentences.length, 2);
  assert.equal(result.sentences[0].en, 'Hello brave new world.');
  assert.equal(result.sentences[1].en, 'Second paragraph here.');
});

test('parseUploadedStudyFile orders EPUB chapters by the OPF spine', async () => {
  const file = new File([makeEpubZip({ deflate: true })], 'book.epub');
  const result = await parseUploadedStudyFile(file);

  assert.equal(result.formatLabel, 'E-Book EPUB');
  assert.match(result.sentences[0].en, /zebra chapter comes first/i);
  assert.match(result.sentences[result.sentences.length - 1].en, /alpha chapter/i);
});

test('parseUploadedStudyFile reads ZIP entries that use a data descriptor', async () => {
  const file = new File([makeEpubZip({ deflate: true, descriptor: true })], 'descriptor.epub');
  const result = await parseUploadedStudyFile(file);

  assert.match(result.sentences[0].en, /zebra chapter comes first/i);
});

test('parseUploadedStudyFile explains missing DecompressionStream in pt-BR', async () => {
  const originalDecompressionStream = (globalThis as any).DecompressionStream;
  (globalThis as any).DecompressionStream = undefined;

  try {
    const file = new File([makeDocxZip()], 'sample.docx');
    await assert.rejects(parseUploadedStudyFile(file), /navegador não consegue descompactar/i);
  } finally {
    (globalThis as any).DecompressionStream = originalDecompressionStream;
  }
});

test('parseUploadedStudyFile rejects unsupported binary formats in pt-BR', async () => {
  const binary = Buffer.alloc(512);
  binary.write('BOOKMOBI', 60, 'latin1');
  const file = new File([binary], 'livro.mobi');

  await assert.rejects(parseUploadedStudyFile(file), /não suportado/i);
  await assert.rejects(parseUploadedStudyFile(file), /\.mobi/);
});

test('parseUploadedStudyFile decodes UTF-16 text files with a BOM', async () => {
  const utf16 = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from('Hello UTF-16 world.', 'utf16le')
  ]);
  const file = new File([utf16], 'utf16.txt');

  const result = await parseUploadedStudyFile(file);
  assert.equal(result.sentences.length, 1);
  assert.equal(result.sentences[0].en, 'Hello UTF-16 world.');
});
