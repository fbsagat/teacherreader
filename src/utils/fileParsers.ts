import { Sentence } from '../types/shadowreader';
import { segmentBookText } from './shadowing';

export interface ParsedBookResult {
  title: string;
  author: string;
  formatLabel: string;
  sentences: Sentence[];
}

// Keep the version in sync with index.html (PDF.js is loaded from a CDN there).
export const PDFJS_VERSION = '3.11.174';
export const PDFJS_BASE_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
export const PDFJS_SCRIPT_URL = `${PDFJS_BASE_URL}/pdf.min.js`;
// SRI do pdf.min.js desta versão; se o CDN mudar o arquivo, o navegador recusa.
export const PDFJS_SCRIPT_INTEGRITY =
  'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e';
export const PDFJS_WORKER_URL = `${PDFJS_BASE_URL}/pdf.worker.min.js`;

export const SUPPORTED_FILE_EXTENSIONS = [
  '.pdf',
  '.txt',
  '.md',
  '.markdown',
  '.epub',
  '.docx',
  '.srt',
  '.vtt',
  '.html',
  '.htm',
  '.csv',
  '.tsv',
  '.json',
  '.rtf'
];

export const SUPPORTED_FORMATS_BADGES: Array<{
  ext: string;
  label: string;
  desc: string;
}> = [
  { ext: 'PDF', label: '.pdf', desc: 'Livros e apostilas em PDF' },
  { ext: 'EPUB', label: '.epub', desc: 'E-books digitais' },
  { ext: 'DOCX', label: '.docx', desc: 'Documentos do Word' },
  { ext: 'TXT', label: '.txt', desc: 'Texto puro' },
  { ext: 'MD', label: '.md', desc: 'Notas e artigos Markdown' },
  { ext: 'SRT / VTT', label: '.srt/.vtt', desc: 'Legendas de filmes, séries e YouTube' },
  { ext: 'HTML', label: '.html', desc: 'Artigos e páginas web salvas' },
  { ext: 'CSV / JSON', label: '.csv/.json', desc: 'Listas bilíngues (EN/PT) ou flashcards' },
  { ext: 'RTF', label: '.rtf', desc: 'Rich Text Format' }
];

export const SUPPORTED_FORMATS_MESSAGE =
  'Importe PDF, EPUB, DOCX, TXT, MD, SRT, VTT, HTML, CSV, TSV, JSON ou RTF.';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Clean Markdown syntax into plain readable text for sentence segmentation
 */
export function cleanMarkdownText(md: string): string {
  return (
    md
      // Remove YAML frontmatter
      .replace(/^---[\s\S]*?---\s*/m, '')
      // Remove fenced code blocks
      .replace(/```[\s\S]*?```/g, ' ')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove images ![alt](url)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      // Convert links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // Convert headings to sentences with period if missing punctuation
      .replace(/^#{1,6}\s+(.+)$/gm, (_m, heading) => {
        const trimmed = heading.trim();
        return /[.!?]$/.test(trimmed) ? `${trimmed} ` : `${trimmed}. `;
      })
      // Remove blockquote markers
      .replace(/^\s*>\s?/gm, '')
      // Remove unordered/ordered list markers
      .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
      // Remove bold/italic/strikethrough markers
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      // Remove horizontal rules
      .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Clean SRT and WebVTT subtitle files into continuous dialogue text
 */
export function cleanSubtitleText(raw: string): string {
  const lines = stripBom(raw).replace(/\r\n/g, '\n').split('\n');
  const cleanedLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // Skip WEBVTT headers and metadata
    if (/^(WEBVTT|NOTE|STYLE|REGION|Kind:|Language:)/i.test(line)) continue;
    // Skip numeric cue indices
    if (/^\d+$/.test(line)) continue;
    // Skip timestamp lines (e.g., 00:01:23,456 --> 00:01:25,789 or 01:23.456 --> 01:25.789)
    if (/\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}/.test(line)) {
      continue;
    }

    // Strip HTML/VTT tags like <i>, </b>, <c.color>, <00:01:02.000>
    const withoutTags = line
      .replace(/<[^>]+>/g, '')
      // Remove bracketed sound effects like [music], (applause), ♪
      .replace(/\[[^\]]*\]|\([^)]*\)|♪+/g, '')
      // Remove speaker prefix like "JOHN: "
      .replace(/^[A-Z][A-Z0-9\s]{1,18}:\s+/, '')
      .trim();

    if (withoutTags.length >= 2) {
      cleanedLines.push(withoutTags);
    }
  }

  return cleanedLines.join(' ').replace(/\s+/g, ' ').trim();
}

/** Bytes 0x80–0x9F que o CP1252 redefine (o resto coincide com Latin-1). */
const CP1252_C1_CODEPOINTS: Record<number, number> = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178
};

function decodeCP1252Byte(byte: number): string {
  const codepoint = CP1252_C1_CODEPOINTS[byte];
  return String.fromCharCode(codepoint ?? byte);
}

/** Destinos RTF que não contêm texto legível (fontes, cores, metadados, imagens). */
const RTF_SKIP_DESTINATIONS = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'info',
  'pict',
  'object',
  'header',
  'headerl',
  'headerr',
  'footer',
  'footerl',
  'footerr',
  'themedata',
  'colorschememapping',
  'datastore',
  'latentstyles',
  'xmlnstbl',
  'listtable',
  'listoverridetable',
  'rsidtbl',
  'generator',
  'filetbl',
  'revtbl',
  'wgrffmtfilter',
  'fldinst',
  'bkmkstart',
  'bkmkend'
]);

/**
 * Clean RTF (Rich Text Format) into plain text.
 *
 * Uses a real state machine instead of regex so that `\'e9` becomes "é"
 * (CP1252), escaped braces/quotes survive, `{\*\...}` destinations are
 * skipped and paragraph breaks are preserved.
 */
export function cleanRtfText(rtf: string): string {
  let out = '';
  let i = 0;
  // Each group inherits the skip state of its parent; `\*` marks an ignorable group.
  const groups: Array<{ skip: boolean; ignorable: boolean }> = [
    { skip: false, ignorable: false }
  ];
  let pendingFallbackSkips = 0;

  const current = () => groups[groups.length - 1];
  const skipping = () => current().skip || current().ignorable;

  while (i < rtf.length) {
    const ch = rtf[i];

    if (ch === '{') {
      groups.push({ skip: current().skip, ignorable: false });
      i += 1;
      continue;
    }

    if (ch === '}') {
      if (groups.length > 1) groups.pop();
      i += 1;
      continue;
    }

    if (ch === '\\') {
      const next = rtf[i + 1];

      // Escaped literals: \\ \{ \}
      if (next === '\\' || next === '{' || next === '}') {
        if (!skipping()) out += next;
        i += 2;
        continue;
      }

      // \'hh → single CP1252 byte
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          if (pendingFallbackSkips > 0) {
            pendingFallbackSkips -= 1;
          } else if (!skipping()) {
            out += decodeCP1252Byte(parseInt(hex, 16));
          }
          i += 4;
          continue;
        }
        i += 2;
        continue;
      }

      // \* marks the current group as an ignorable destination
      if (next === '*') {
        current().ignorable = true;
        i += 2;
        continue;
      }

      // Control symbol (a single non-letter after the backslash)
      if (!/[a-zA-Z]/.test(next || '')) {
        if (!skipping()) {
          if (next === '~') out += ' ';
          else if (next === '_') out += '-';
          else if (next === '\n' || next === '\r') out += '\n';
          else if (next === '\t') out += ' ';
        }
        i += 2;
        continue;
      }

      // Control word: letters, optional sign + number, optional delimiter space
      let j = i + 1;
      while (j < rtf.length && /[a-zA-Z]/.test(rtf[j])) j += 1;
      const word = rtf.slice(i + 1, j).toLowerCase();

      let sign = 1;
      if (rtf[j] === '-') {
        sign = -1;
        j += 1;
      }
      let digits = '';
      while (j < rtf.length && /[0-9]/.test(rtf[j])) {
        digits += rtf[j];
        j += 1;
      }
      const numeric = digits ? sign * Number(digits) : null;
      if (rtf[j] === ' ') j += 1;

      if (RTF_SKIP_DESTINATIONS.has(word)) current().skip = true;

      if (!skipping()) {
        if (word === 'par' || word === 'line' || word === 'sect' || word === 'page') {
          out += '\n';
        } else if (word === 'tab') {
          out += ' ';
        } else if (word === 'emdash') {
          out += '—';
        } else if (word === 'endash') {
          out += '–';
        } else if (word === 'lquote') {
          out += '‘';
        } else if (word === 'rquote') {
          out += '’';
        } else if (word === 'ldblquote') {
          out += '“';
        } else if (word === 'rdblquote') {
          out += '”';
        } else if (word === 'bullet') {
          out += '•';
        } else if (word === 'u' && numeric !== null) {
          const code = numeric < 0 ? numeric + 65536 : numeric;
          out += String.fromCharCode(code);
          // \uN is followed by a fallback representation that must be skipped.
          pendingFallbackSkips = 1;
        }
      }

      i = j;
      continue;
    }

    if (!skipping()) {
      if (ch === '\r') {
        i += 1;
        continue;
      }
      if (pendingFallbackSkips > 0) {
        pendingFallbackSkips -= 1;
        i += 1;
        continue;
      }
      out += ch;
    }
    i += 1;
  }

  return out.replace(/[ \t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract readable text from HTML/XHTML strings
 */
export function extractTextFromHtml(html: string): string {
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc
      .querySelectorAll('script, style, nav, footer, noscript, svg, iframe, header')
      .forEach(el => el.remove());

    const blocks = doc.querySelectorAll('p, h1, h2, h3, h4, li, blockquote, article, section');
    if (blocks.length > 0) {
      const chunks: string[] = [];
      blocks.forEach(b => {
        // Avoid duplicating container text if it has child <p> elements
        if (
          (b.tagName === 'ARTICLE' || b.tagName === 'SECTION') &&
          b.querySelector('p, h1, h2, h3, li')
        ) {
          return;
        }
        const t = (b.textContent || '').replace(/\s+/g, ' ').trim();
        if (t.length >= 10) {
          chunks.push(/[.!?]$/.test(t) ? t : `${t}.`);
        }
      });
      if (chunks.length > 0) {
        return chunks.join(' ');
      }
    }

    return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // Fallback regex strip if DOMParser is unavailable (e.g. Node unit tests)
  return stripBom(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits delimiter-separated content into rows/fields. Handles quoted fields
 * with embedded delimiters/newlines and the CSV `""` escape for a literal quote.
 */
function parseDelimitedRows(raw: string, delimiter: string): string[][] {
  const text = stripBom(raw).replace(/\r\n?/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(field.trim());
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  row.push(field.trim());
  rows.push(row);

  return rows.filter(cells => cells.some(cell => cell.trim().length > 0));
}

/**
 * Parse CSV / TSV content (supports single-column English or 2-column English + Portuguese)
 */
export function parseCsvOrTsvSentences(raw: string, delimiter: ',' | '\t' = ','): Sentence[] {
  const rows = parseDelimitedRows(raw, delimiter);
  const results: Sentence[] = [];

  for (let i = 0; i < rows.length; i++) {
    const col0 = (rows[i][0] || '').trim();
    const col1 = (rows[i][1] || '').trim();

    // Skip header row like "en,pt" or "english,portuguese"
    if (i === 0 && /^(en|english|sentence|frase|text|inglês)$/i.test(col0)) {
      continue;
    }

    if (col0.length >= 6 && /[a-zA-Z]/.test(col0)) {
      results.push({
        en: /[.!?]$/.test(col0) ? col0 : `${col0}.`,
        pt: col1
      });
    }
  }

  if (results.length > 0) return results;
  return segmentBookText(raw);
}

/**
 * Parse JSON file (supports array of strings, array of {en, pt}, or {sentences: [...]})
 */
export function parseJsonSentences(raw: string): Sentence[] {
  let data: any;
  try {
    data = JSON.parse(stripBom(raw));
  } catch {
    throw new Error(
      'JSON inválido: verifique vírgulas, aspas e chaves do arquivo e tente novamente.'
    );
  }

  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.sentences)
      ? data.sentences
      : Array.isArray(data?.items)
        ? data.items
        : [];

  const sentences: Sentence[] = [];
  for (const item of list) {
    if (typeof item === 'string' && item.trim().length >= 6) {
      const clean = item.trim();
      sentences.push({
        en: /[.!?]$/.test(clean) ? clean : `${clean}.`,
        pt: ''
      });
    } else if (item && typeof item === 'object') {
      const en = String(item.en || item.english || item.text || item.sentence || '').trim();
      const pt = String(item.pt || item.portuguese || item.translation || '').trim();
      if (en.length >= 6) {
        sentences.push({
          en: /[.!?]$/.test(en) ? en : `${en}.`,
          pt
        });
      }
    }
  }

  return sentences;
}

/** Erro de descompactação que não deve ser tratado como "entrada corrompida". */
class ZipUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipUnsupportedError';
  }
}

interface ZipArchiveEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const ZIP_LOCAL_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

/**
 * Reads the ZIP central directory. Unlike local headers, it always carries the
 * real compressed size — even when the entry uses a data descriptor (bit 3).
 */
function readZipCentralDirectory(buffer: ArrayBuffer): ZipArchiveEntry[] {
  const view = new DataView(buffer);
  if (view.byteLength < 22) return [];

  let eocdOffset = -1;
  const minOffset = Math.max(0, view.byteLength - 66_000);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) return [];

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  if (totalEntries === 0 || centralOffset >= view.byteLength) return [];

  const decoder = new TextDecoder('utf-8');
  const entries: ZipArchiveEntry[] = [];
  let offset = centralOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > view.byteLength) break;
    if (view.getUint32(offset, true) !== ZIP_CENTRAL_HEADER_SIGNATURE) break;

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    if (offset + 46 + nameLength > view.byteLength) break;
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));
    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function findNextZipLocalHeader(view: DataView, from: number): number {
  for (let offset = Math.max(0, from); offset + 4 <= view.byteLength; offset += 1) {
    if (view.getUint32(offset, true) === ZIP_LOCAL_HEADER_SIGNATURE) return offset;
  }
  return -1;
}

async function readZipEntryContent(
  buffer: ArrayBuffer,
  entry: ZipArchiveEntry
): Promise<string> {
  const view = new DataView(buffer);
  const localOffset = entry.localHeaderOffset;

  if (localOffset + 30 > view.byteLength) {
    throw new Error(`Entrada ZIP inválida: ${entry.name}`);
  }
  if (view.getUint32(localOffset, true) !== ZIP_LOCAL_HEADER_SIGNATURE) {
    throw new Error(`Cabeçalho ZIP inválido: ${entry.name}`);
  }

  const nameLength = view.getUint16(localOffset + 26, true);
  const extraLength = view.getUint16(localOffset + 28, true);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > view.byteLength) {
    throw new Error(`Entrada ZIP truncada: ${entry.name}`);
  }

  const decoder = new TextDecoder('utf-8');
  const payload = new Uint8Array(buffer, dataStart, entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return decoder.decode(payload);
  }

  if (entry.compressionMethod === 8) {
    if (typeof DecompressionStream === 'undefined') {
      throw new ZipUnsupportedError(
        'Este navegador não consegue descompactar arquivos EPUB/DOCX. Atualize o navegador ou importe o texto como .TXT.'
      );
    }
    const stream = new DecompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    await writer.write(payload);
    await writer.close();
    const decompressed = await new Response(stream.readable).arrayBuffer();
    return decoder.decode(decompressed);
  }

  throw new ZipUnsupportedError(
    `Compressão ZIP não suportada (método ${entry.compressionMethod}) em "${entry.name}".`
  );
}

/** Fallback for archives without a readable central directory. */
async function extractZipTextEntriesFromLocalHeaders(
  buffer: ArrayBuffer,
  fileFilter: (fileName: string) => boolean
): Promise<Array<{ name: string; content: string }>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder('utf-8');
  const entries: Array<{ name: string; content: string }> = [];

  let offset = 0;
  while (offset + 30 <= bytes.length) {
    if (view.getUint32(offset, true) !== ZIP_LOCAL_HEADER_SIGNATURE) {
      offset += 1;
      continue;
    }

    const flags = view.getUint16(offset + 6, true);
    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const dataStart = offset + 30 + nameLength + extraLength;
    if (dataStart > bytes.length) break;

    const fileName = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));

    // Data descriptor (bit 3) or unknown size: skip just this entry instead of
    // aborting the whole archive.
    if ((flags & 0x08) !== 0 || compressedSize === 0) {
      const nextOffset = findNextZipLocalHeader(view, dataStart);
      if (nextOffset < 0) break;
      offset = nextOffset;
      continue;
    }

    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) {
      const nextOffset = findNextZipLocalHeader(view, dataStart);
      if (nextOffset < 0) break;
      offset = nextOffset;
      continue;
    }

    if (fileFilter(fileName)) {
      try {
        entries.push({
          name: fileName,
          content: await readZipEntryContent(buffer, {
            name: fileName,
            compressionMethod,
            compressedSize,
            localHeaderOffset: offset
          })
        });
      } catch (error) {
        if (error instanceof ZipUnsupportedError) throw error;
        // Ignore a corrupt entry and keep reading the archive.
      }
    }

    offset = dataEnd;
  }

  return entries;
}

/**
 * Lightweight browser-native ZIP extractor using DataView + DecompressionStream('deflate-raw')
 * Used to extract XML/XHTML text from .epub and .docx archives without external libraries.
 */
async function extractZipTextEntries(
  buffer: ArrayBuffer,
  fileFilter: (fileName: string) => boolean
): Promise<Array<{ name: string; content: string }>> {
  const centralDirectory = readZipCentralDirectory(buffer);
  if (centralDirectory.length === 0) {
    return extractZipTextEntriesFromLocalHeaders(buffer, fileFilter);
  }

  const entries: Array<{ name: string; content: string }> = [];
  for (const entry of centralDirectory) {
    if (!fileFilter(entry.name)) continue;
    try {
      entries.push({ name: entry.name, content: await readZipEntryContent(buffer, entry) });
    } catch (error) {
      if (error instanceof ZipUnsupportedError) throw error;
      // Ignore a corrupt entry and keep reading the archive.
    }
  }
  return entries;
}

function normalizeZipPath(path: string): string {
  let normalized = String(path || '').trim().replace(/\\/g, '/');
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep the raw href when it is not valid percent-encoding.
  }
  return normalized
    .replace(/^\.\//, '')
    .replace(/\/{2,}/g, '/')
    .toLowerCase();
}

function resolveZipHref(basePath: string, href: string): string {
  const cleanHref = String(href || '').split('#')[0];
  const baseDir = basePath.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/') + 1) : '';
  const combined = cleanHref.startsWith('/') ? cleanHref.slice(1) : `${baseDir}${cleanHref}`;

  const parts: string[] = [];
  for (const segment of combined.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}

function extractXmlAttribute(tag: string, attribute: string): string | null {
  const match = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  if (!match) return null;
  return match[2] ?? match[3] ?? null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));
}

/** Reads the EPUB spine (OPF) so chapters keep the book order, not the file name order. */
function parseOpfSpineHrefs(opfXml: string, opfPath: string): string[] {
  const manifest = new Map<string, string>();

  const itemTagRegex = /<item\b[^>]*>/gi;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = itemTagRegex.exec(opfXml)) !== null) {
    const id = extractXmlAttribute(tagMatch[0], 'id');
    const href = extractXmlAttribute(tagMatch[0], 'href');
    if (id && href) {
      manifest.set(id, resolveZipHref(opfPath, decodeXmlEntities(href)));
    }
  }

  const spine: string[] = [];
  const itemrefRegex = /<itemref\b[^>]*>/gi;
  while ((tagMatch = itemrefRegex.exec(opfXml)) !== null) {
    const idref = extractXmlAttribute(tagMatch[0], 'idref');
    const href = idref ? manifest.get(idref) : undefined;
    if (href) spine.push(normalizeZipPath(href));
  }

  return spine;
}

function zipEntryNames(buffer: ArrayBuffer): string[] {
  return readZipCentralDirectory(buffer).map(entry => entry.name);
}

async function readZipTextFile(buffer: ArrayBuffer, targetName: string): Promise<string | null> {
  const normalizedTarget = normalizeZipPath(targetName);
  const centralDirectory = readZipCentralDirectory(buffer);

  if (centralDirectory.length > 0) {
    const entry = centralDirectory.find(
      candidate => normalizeZipPath(candidate.name) === normalizedTarget
    );
    return entry ? readZipEntryContent(buffer, entry) : null;
  }

  const entries = await extractZipTextEntriesFromLocalHeaders(
    buffer,
    name => normalizeZipPath(name) === normalizedTarget
  );
  return entries[0]?.content ?? null;
}

/**
 * Extract readable text from an .epub E-Book ArrayBuffer
 */
async function extractEpubText(buffer: ArrayBuffer): Promise<string> {
  let opfPath: string | null = null;

  try {
    const containerXml = await readZipTextFile(buffer, 'META-INF/container.xml');
    if (containerXml) {
      const rootfileTag = containerXml.match(/<rootfile\b[^>]*>/i);
      const fullPath = rootfileTag ? extractXmlAttribute(rootfileTag[0], 'full-path') : null;
      if (fullPath) opfPath = normalizeZipPath(fullPath);
    }
  } catch (error) {
    if (error instanceof ZipUnsupportedError) throw error;
  }

  if (!opfPath) {
    opfPath = zipEntryNames(buffer).find(name => /\.opf$/i.test(name)) ?? null;
  }

  let spineHrefs: string[] = [];
  if (opfPath) {
    try {
      const opfXml = await readZipTextFile(buffer, opfPath);
      if (opfXml) spineHrefs = parseOpfSpineHrefs(opfXml, opfPath);
    } catch (error) {
      if (error instanceof ZipUnsupportedError) throw error;
    }
  }

  const chapters = await extractZipTextEntries(
    buffer,
    name => /\.(xhtml|html|htm)$/i.test(name) && !/(nav|toc|cover)\.(xhtml|html|htm)$/i.test(name)
  );

  if (chapters.length === 0) {
    throw new Error('Nenhum capítulo legível encontrado no arquivo EPUB.');
  }

  const byPath = new Map<string, { name: string; content: string }>();
  for (const chapter of chapters) {
    byPath.set(normalizeZipPath(chapter.name), chapter);
  }

  const ordered: Array<{ name: string; content: string }> = [];
  for (const href of spineHrefs) {
    const chapter = byPath.get(href);
    if (chapter) {
      ordered.push(chapter);
      byPath.delete(href);
    }
  }

  // Chapters missing from the spine keep a stable, numeric-aware order.
  const leftovers = Array.from(byPath.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
  ordered.push(...leftovers);

  const chapterTexts = ordered
    .map(entry => extractTextFromHtml(entry.content))
    .filter(text => text.length > 0);

  return chapterTexts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract readable text from a .docx (Word) ArrayBuffer
 */
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const entries = await extractZipTextEntries(buffer, name =>
    /^word\/document\.xml$/i.test(name)
  );

  if (entries.length === 0) {
    throw new Error('Não foi possível localizar o conteúdo de texto no arquivo DOCX.');
  }

  const xml = entries[0].content;
  // Convert Word paragraph breaks </w:p> into sentence spaces/newlines and strip XML tags
  const paragraphs = xml
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<w:tab\/>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length >= 5)
    .map(p => (/[.!?]$/.test(p) ? p : `${p}.`));

  return paragraphs.join(' ');
}

interface PdfjsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: { data: ArrayBuffer }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
      }>;
    }>;
  };
}

let pdfjsLoadPromise: Promise<PdfjsLib> | null = null;

/**
 * PDF.js is ~1 MB and only matters when the user imports a PDF, so it is loaded
 * on demand (with SRI) instead of blocking every page load from the CDN.
 */
function loadPdfjs(): Promise<PdfjsLib> {
  const win = window as unknown as { pdfjsLib?: PdfjsLib };
  if (win.pdfjsLib) return Promise.resolve(win.pdfjsLib);
  if (pdfjsLoadPromise) return pdfjsLoadPromise;

  pdfjsLoadPromise = new Promise<PdfjsLib>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_SCRIPT_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.integrity = PDFJS_SCRIPT_INTEGRITY;
    script.onload = () => {
      if (win.pdfjsLib) {
        resolve(win.pdfjsLib);
      } else {
        reject(
          new Error('O leitor de PDF carregou, mas a biblioteca não ficou disponível. Tente novamente.')
        );
      }
    };
    script.onerror = () => {
      pdfjsLoadPromise = null;
      reject(
        new Error(
          'Não foi possível carregar o leitor de PDF. Verifique sua conexão com a internet e tente novamente.'
        )
      );
    };
    document.head.appendChild(script);
  });

  return pdfjsLoadPromise;
}

/**
 * Extract text from a PDF file using PDF.js loaded on demand.
 */
async function extractPdfText(
  file: File,
  onProgress?: (status: string) => void
): Promise<string> {
  const pdfjsLib = await loadPdfjs();

  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  onProgress?.(`Extraindo texto de ${pdf.numPages} páginas do PDF...`);
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(' ') + ' ';

    if (i % 4 === 0 || i === pdf.numPages) {
      onProgress?.(
        `Processando PDF: página ${i} de ${pdf.numPages} (${Math.round((i / pdf.numPages) * 100)}%)...`
      );
      await new Promise(r => setTimeout(r, 0));
    }
  }

  return fullText;
}

/**
 * Decodes a file as text. Returns null when the bytes look binary so an
 * unsupported format (.doc, .mobi, .xls…) never becomes a garbage book.
 */
function decodePlainTextBuffer(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);

  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    }
  }

  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  let controlBytes = 0;
  for (const byte of sample) {
    if (byte === 0) return null;
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20) || byte === 0x7f) controlBytes += 1;
  }
  if (sample.length > 0 && controlBytes / sample.length > 0.02) return null;

  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Universal file parser supporting PDF, EPUB, DOCX, TXT, MD, SRT, VTT, HTML, CSV, TSV, JSON, RTF
 */
export async function parseUploadedStudyFile(
  file: File,
  onProgress?: (status: string) => void
): Promise<ParsedBookResult> {
  const fileName = file.name || 'Documento Importado';
  const extMatch = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : '';
  const baseTitle = fileName.replace(/\.[^/.]+$/, '');

  onProgress?.(`Lendo arquivo .${(ext || 'txt').toUpperCase()}...`);

  let sentences: Sentence[] = [];
  let formatLabel = (ext || 'txt').toUpperCase();

  if (ext === 'pdf') {
    formatLabel = 'PDF Importado';
    const text = await extractPdfText(file, onProgress);
    onProgress?.('Segmentando sentenças do PDF...');
    sentences = segmentBookText(text);
  } else if (ext === 'epub') {
    formatLabel = 'E-Book EPUB';
    const buffer = await file.arrayBuffer();
    onProgress?.('Extraindo capítulos do EPUB...');
    const text = await extractEpubText(buffer);
    sentences = segmentBookText(text);
  } else if (ext === 'docx') {
    formatLabel = 'Documento Word (DOCX)';
    const buffer = await file.arrayBuffer();
    onProgress?.('Extraindo parágrafos do DOCX...');
    const text = await extractDocxText(buffer);
    sentences = segmentBookText(text);
  } else if (ext === 'srt' || ext === 'vtt') {
    formatLabel = `Legenda (${ext.toUpperCase()})`;
    const raw = stripBom(await file.text());
    onProgress?.('Limpando timestamps e tags da legenda...');
    const text = cleanSubtitleText(raw);
    sentences = segmentBookText(text);
  } else if (ext === 'md' || ext === 'markdown') {
    formatLabel = 'Artigo Markdown';
    const raw = stripBom(await file.text());
    onProgress?.('Processando formatação Markdown...');
    const text = cleanMarkdownText(raw);
    sentences = segmentBookText(text);
  } else if (ext === 'html' || ext === 'htm') {
    formatLabel = 'Página / Artigo HTML';
    const raw = stripBom(await file.text());
    onProgress?.('Extraindo artigo do HTML...');
    const text = extractTextFromHtml(raw);
    sentences = segmentBookText(text);
  } else if (ext === 'csv' || ext === 'tsv') {
    formatLabel = `Lista (${ext.toUpperCase()})`;
    const raw = stripBom(await file.text());
    onProgress?.('Importando sentenças da planilha...');
    sentences = parseCsvOrTsvSentences(raw, ext === 'tsv' ? '\t' : ',');
  } else if (ext === 'json') {
    formatLabel = 'Arquivo JSON';
    const raw = stripBom(await file.text());
    onProgress?.('Importando sentenças do JSON...');
    sentences = parseJsonSentences(raw);
  } else if (ext === 'rtf') {
    formatLabel = 'Documento RTF';
    // RTF escapes are ASCII, but raw CP1252 bytes still appear in older files.
    const buffer = await file.arrayBuffer();
    const raw = new TextDecoder('windows-1252').decode(buffer);
    const text = cleanRtfText(raw);
    sentences = segmentBookText(text);
  } else {
    formatLabel = ext === '' ? 'Texto (.TXT)' : `Texto (.${ext.toUpperCase()})`;
    const buffer = await file.arrayBuffer();
    const raw = decodePlainTextBuffer(buffer);
    if (raw === null) {
      throw new Error(
        `Formato ".${ext}" não suportado. ${SUPPORTED_FORMATS_MESSAGE}`
      );
    }
    onProgress?.('Segmentando sentenças do texto...');
    sentences = segmentBookText(raw);
  }

  if (sentences.length === 0) {
    throw new Error(
      `Nenhuma sentença legível em inglês foi encontrada no arquivo "${file.name}".`
    );
  }

  return {
    title: baseTitle,
    author: formatLabel,
    formatLabel,
    sentences
  };
}
