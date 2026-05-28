/// <reference lib="webworker" />

/**
 * PDF parser Web Worker.
 *
 * Loads pdfjs-dist dynamically and extracts text + per-line font size from each
 * page so the converter can apply heading/list heuristics. Runs pdfjs-dist in
 * "fake worker" mode (no nested worker) since we're already inside a worker
 * context — this avoids needing a separate worker file and keeps the bundle
 * graph predictable.
 *
 * Branch B scope (issue #5): 텍스트 + 기본 구조화만. 표/이미지/OCR 제외.
 */

import type {
  PdfBlock,
  PdfImportOptions,
  PdfPageLine,
  PdfParsedPage,
  PdfParseMessage,
  PdfParseResult,
  PdfWorkerResponse,
} from '@/types/pdf';
import { convertPagesToBlocks, blocksToMarkdown } from '@/lib/pdf-converter';

declare const self: DedicatedWorkerGlobalScope;

function postProgress(percent: number, message: string) {
  self.postMessage({ type: 'progress', percent, message } as PdfWorkerResponse);
}

function postComplete(result: PdfParseResult) {
  self.postMessage({ type: 'complete', result } as PdfWorkerResponse);
}

function postError(error: string) {
  self.postMessage({ type: 'error', error } as PdfWorkerResponse);
}

// ---------- pdfjs-dist text-item shape (subset we use) ----------

interface PdfTextItem {
  str: string;
  transform: number[]; // [a, b, c, d, e, f] — height ≈ |d|
  height?: number;
  width?: number;
  hasEOL?: boolean;
}

type PageLine = PdfPageLine;
type ParsedPage = PdfParsedPage;

// ---------- Per-page extraction ----------

/**
 * Convert raw pdfjs text items into "lines" by grouping items whose vertical
 * position is similar. Returns the lines and an average font size for the page.
 */
function groupItemsIntoLines(items: PdfTextItem[]): PageLine[] {
  if (items.length === 0) return [];

  interface LineBucket {
    y: number;
    items: PdfTextItem[];
  }

  const buckets: LineBucket[] = [];
  const Y_TOLERANCE = 2; // px tolerance when grouping into the same line

  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    const tr = item.transform;
    if (!Array.isArray(tr) || tr.length < 6) continue;
    const y = tr[5];

    let bucket = buckets.find((b) => Math.abs(b.y - y) <= Y_TOLERANCE);
    if (!bucket) {
      bucket = { y, items: [] };
      buckets.push(bucket);
    }
    bucket.items.push(item);
  }

  // Sort buckets top-to-bottom (higher y first in PDF coordinate space)
  buckets.sort((a, b) => b.y - a.y);

  const lines: PageLine[] = [];
  for (const bucket of buckets) {
    // Sort items within the bucket by x position
    bucket.items.sort((a, b) => a.transform[4] - b.transform[4]);

    let lineText = '';
    let lastX = -Infinity;
    let lastWidth = 0;
    let maxFontSize = 0;

    for (const item of bucket.items) {
      const tr = item.transform;
      const x = tr[4];
      const fontSize = Math.abs(tr[3]) || item.height || 0;
      if (fontSize > maxFontSize) maxFontSize = fontSize;

      // Insert a space if there's a visual gap between items
      if (lineText.length > 0) {
        const expectedX = lastX + lastWidth;
        const gap = x - expectedX;
        if (gap > fontSize * 0.25 && !lineText.endsWith(' ') && !item.str.startsWith(' ')) {
          lineText += ' ';
        }
      }

      lineText += item.str;
      lastX = x;
      lastWidth = item.width ?? 0;
    }

    // Collapse runs of whitespace
    lineText = lineText.replace(/[ \t]+/g, ' ').trim();

    if (lineText.length > 0) {
      lines.push({ text: lineText, fontSize: maxFontSize });
    }
  }

  return lines;
}

// ---------- Main parsing pipeline ----------

async function parsePdf(
  buffer: ArrayBuffer,
  options?: PdfImportOptions
): Promise<PdfParseResult> {
  postProgress(5, 'PDF 라이브러리 로드 중...');

  // Dynamic import keeps pdfjs-dist out of the main bundle
  const pdfjs = await import('pdfjs-dist');

  // We're already in a Web Worker — disable pdfjs's nested worker spawning.
  // Without this, pdfjs would try to create another Worker which is unreliable
  // inside a worker context across browsers.
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = '';
  } catch {
    // Ignored — falls back to fake worker mode
  }

  postProgress(10, 'PDF 파일 분석 중...');

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    // Disable optional fancy features we don't need for text extraction
    disableFontFace: true,
    useSystemFonts: false,
  });

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const maxPages =
    options?.maxPages && options.maxPages > 0
      ? Math.min(options.maxPages, totalPages)
      : totalPages;

  postProgress(
    15,
    `총 ${totalPages}페이지${
      maxPages < totalPages ? ` (처음 ${maxPages}페이지만 처리)` : ''
    }`
  );

  // Extract metadata (best-effort)
  let title: string | undefined;
  let author: string | undefined;
  try {
    const meta = await pdf.getMetadata();
    const info = (meta?.info ?? {}) as Record<string, unknown>;
    if (typeof info.Title === 'string' && info.Title.trim()) {
      title = info.Title.trim();
    }
    if (typeof info.Author === 'string' && info.Author.trim()) {
      author = info.Author.trim();
    }
  } catch {
    // metadata is optional — ignore
  }

  const warnings: string[] = [];
  const pages: ParsedPage[] = [];
  let likelyScannedCount = 0;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    // Progress range 15 → 90
    const pct = 15 + Math.round((pageNumber / maxPages) * 75);
    postProgress(pct, `페이지 ${pageNumber}/${maxPages} 처리 중...`);

    try {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent({
        includeMarkedContent: false,
      });
      const items = (textContent.items as PdfTextItem[]).filter(
        (it) => it && typeof (it as PdfTextItem).str === 'string'
      );

      const lines = groupItemsIntoLines(items);
      const totalChars = lines.reduce((sum, l) => sum + l.text.length, 0);
      if (totalChars < 10) {
        likelyScannedCount++;
      }

      pages.push({ pageNumber, lines });

      // Release page resources eagerly
      page.cleanup();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`페이지 ${pageNumber} 처리 실패: ${msg}`);
      pages.push({ pageNumber, lines: [] });
    }
  }

  postProgress(92, '마크다운 변환 중...');

  const likelyScanned =
    likelyScannedCount > 0 && likelyScannedCount >= Math.ceil(maxPages * 0.5);
  if (likelyScanned) {
    warnings.push(
      '대부분의 페이지에서 텍스트를 거의 추출하지 못했습니다. 스캔본 PDF일 수 있으며, OCR은 지원하지 않습니다.'
    );
  } else if (likelyScannedCount > 0) {
    warnings.push(
      `${likelyScannedCount}개 페이지에서 텍스트를 거의 추출하지 못했습니다 (이미지/스캔본 가능성).`
    );
  }

  const blocks: PdfBlock[] = convertPagesToBlocks(pages);
  const markdown = blocksToMarkdown(blocks);

  postProgress(100, '변환 완료');

  // Release pdf document
  try {
    await pdf.cleanup();
    await pdf.destroy();
  } catch {
    // ignore
  }

  return {
    markdown,
    blocks,
    warnings,
    metadata: {
      pageCount: totalPages,
      parsedPageCount: maxPages,
      title,
      author,
      likelyScanned,
    },
  };
}

// ---------- Message handler ----------

self.onmessage = async (e: MessageEvent<PdfParseMessage>) => {
  const msg = e.data;

  if (!msg || msg.type !== 'parse') {
    postError(`알 수 없는 메시지 타입: ${(msg as { type?: string } | undefined)?.type ?? ''}`);
    return;
  }

  try {
    // Quick sanity check on the buffer prefix — "%PDF"
    const view = new Uint8Array(msg.file);
    if (
      view.length < 5 ||
      view[0] !== 0x25 || // %
      view[1] !== 0x50 || // P
      view[2] !== 0x44 || // D
      view[3] !== 0x46    // F
    ) {
      throw new Error('PDF 파일이 아닙니다. 올바른 .pdf 파일을 선택해주세요.');
    }

    const result = await parsePdf(msg.file, msg.options);
    postComplete(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
    postError(message);
  }
};

export {};
