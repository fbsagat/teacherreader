import { Sentence } from '../types/shadowreader';
import { segmentBookText } from './shadowing';

export interface ParsedBookResult {
  title: string;
  author: string;
  formatLabel: string;
  sentences: Sentence[];
}

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
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
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

/**
 * Clean RTF (Rich Text Format) into plain text
 */
export function cleanRtfText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\{\\fonttbl[\s\S]*?\}/g, '')
    .replace(/\{\\colortbl[\s\S]*?\}/g, '')
    .replace(/\{\\stylesheet[\s\S]*?\}/g, '')
    .replace(/\{\\\*\\[^}]+\}/g, '')
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\[a-zA-Z]+\d*\s?/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse CSV / TSV content (supports single-column English or 2-column English + Portuguese)
 */
export function parseCsvOrTsvSentences(raw: string, delimiter: ',' | '\t' = ','): Sentence[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
  const results: Sentence[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Parse simple CSV row respecting quotes
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());

    const col0 = (cols[0] || '').replace(/^["']|["']$/g, '').trim();
    const col1 = (cols[1] || '').replace(/^["']|["']$/g, '').trim();

    // Skip header row like "en,pt" or "english,portuguese"
    if (
      i === 0 &&
      /^(en|english|sentence|frase|text|inglês)$/i.test(col0)
    ) {
      continue;
    }

    if (col0.length >= 6 && /[a-zA-Z]/.test(col0)) {
      results.push({
        en: /[.!?]$/.test(col0) ? col0 : `${col0}.`,
        pt: col1 || ''
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
  const data = JSON.parse(raw);
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

/**
 * Lightweight browser-native ZIP extractor using DataView + DecompressionStream('deflate-raw')
 * Used to extract XML/XHTML text from .epub and .docx archives without external libraries.
 */
async function extractZipTextEntries(
  buffer: ArrayBuffer,
  fileFilter: (fileName: string) => boolean
): Promise<Array<{ name: string; content: string }>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const entries: Array<{ name: string; content: string }> = [];
  const decoder = new TextDecoder('utf-8');

  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    // Local file header signature = 0x04034b50
    if (signature !== 0x04034b50) {
      break;
    }

    const generalPurposeFlag = view.getUint16(offset + 6, true);
    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraFieldLength = view.getUint16(offset + 28, true);

    const nameBytes = bytes.subarray(offset + 30, offset + 30 + fileNameLength);
    const fileName = decoder.decode(nameBytes);
    const dataStart = offset + 30 + fileNameLength + extraFieldLength;

    // If bit 3 of generalPurposeFlag is set and compressedSize is 0, we cannot rely on local header size alone
    if ((generalPurposeFlag & 0x08) !== 0 && compressedSize === 0) {
      break;
    }

    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) break;

    if (fileFilter(fileName) && compressedSize > 0) {
      const compressedData = bytes.subarray(dataStart, dataEnd);
      try {
        if (compressionMethod === 0) {
          // Stored (uncompressed)
          entries.push({
            name: fileName,
            content: decoder.decode(compressedData)
          });
        } else if (compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
          // Deflate-raw
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(compressedData);
          writer.close();
          const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
          entries.push({
            name: fileName,
            content: decoder.decode(decompressedBuffer)
          });
        }
      } catch {
        // Ignore individual corrupt entry and continue
      }
    }

    offset = dataEnd;
  }

  return entries;
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
    .split('\n')
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length >= 5)
    .map(p => (/[.!?]$/.test(p) ? p : `${p}.`));

  return paragraphs.join(' ');
}

/**
 * Extract readable text from an .epub E-Book ArrayBuffer
 */
async function extractEpubText(buffer: ArrayBuffer): Promise<string> {
  const entries = await extractZipTextEntries(buffer, name =>
    /\.(xhtml|html|htm)$/i.test(name) && !/(nav|toc|cover)\.(xhtml|html|htm)$/i.test(name)
  );

  if (entries.length === 0) {
    throw new Error('Nenhum capítulo legível encontrado no arquivo EPUB.');
  }

  // Sort chapters alphabetically so chapter1, chapter2 stay in order
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const chapterTexts = entries.map(entry => extractTextFromHtml(entry.content));
  return chapterTexts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract text from a PDF file using window.pdfjsLib
 */
async function extractPdfText(
  file: File,
  onProgress?: (status: string) => void
): Promise<string> {
  const win = window as unknown as {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (params: { data: ArrayBuffer }) => {
        promise: Promise<{
          numPages: number;
          getPage: (n: number) => Promise<{
            getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
          }>;
        }>;
      };
    };
  };

  if (!win.pdfjsLib) {
    throw new Error('Biblioteca PDF.js não disponível.');
  }

  win.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await win.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

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
 * Universal file parser supporting PDF, EPUB, DOCX, TXT, MD, SRT, VTT, HTML, CSV, TSV, JSON, RTF
 */
export async function parseUploadedStudyFile(
  file: File,
  onProgress?: (status: string) => void
): Promise<ParsedBookResult> {
  const fileName = file.name || 'Documento Importado';
  const extMatch = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : 'txt';
  const baseTitle = fileName.replace(/\.[^/.]+$/, '');

  onProgress?.(`Lendo arquivo .${ext.toUpperCase()}...`);

  let sentences: Sentence[] = [];
  let formatLabel = ext.toUpperCase();

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
    const raw = await file.text();
    onProgress?.('Limpando timestamps e tags da legenda...');
    const text = cleanSubtitleText(raw);
    sentences = segmentBookText(text);
  } else if (ext === 'md' || ext === 'markdown') {
    formatLabel = 'Artigo Markdown';
    const raw = await file.text();
    onProgress?.('Processando formatação Markdown...');
    const text = cleanMarkdownText(raw);
    sentences = segmentBookText(text);
  } else if (ext === 'html' || ext === 'htm') {
    formatLabel = 'Página / Artigo HTML';
    const raw = await file.text();
    onProgress?.('Extraindo artigo do HTML...');
    const text = extractTextFromHtml(raw);
    sentences = segmentBookText(text);
  } else if (ext === 'csv' || ext === 'tsv') {
    formatLabel = `Lista (${ext.toUpperCase()})`;
    const raw = await file.text();
    onProgress?.('Importando sentenças da planilha...');
    sentences = parseCsvOrTsvSentences(raw, ext === 'tsv' ? '\t' : ',');
  } else if (ext === 'json') {
    formatLabel = 'Arquivo JSON';
    const raw = await file.text();
    onProgress?.('Importando sentenças do JSON...');
    sentences = parseJsonSentences(raw);
  } else if (ext === 'rtf') {
    formatLabel = 'Documento RTF';
    const raw = await file.text();
    const text = cleanRtfText(raw);
    sentences = segmentBookText(text);
  } else {
    // Default: .txt or any plain text format
    formatLabel = 'Texto (.TXT)';
    const raw = await file.text();
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
