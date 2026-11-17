import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pdfPagesToMarkdown, type PdfPageText, type PdfTextItem } from './pdf-to-markdown';

export type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy };
type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

/** scripts/copy-pdfjs-assets.mjs 가 복사해 두는 위치 */
const ASSET_BASE = '/pdfjs/';

let loader: Promise<PdfJsModule> | null = null;

/**
 * 최신 브라우저 API(Map.getOrInsertComputed 등)를 폴리필해 둔 legacy 빌드를 쓴다.
 * 문서를 처음 열 때만 내려받도록 동적 import 한다.
 */
export function loadPdfJs(): Promise<PdfJsModule> {
  if (!loader) {
    loader = import('pdfjs-dist/legacy/build/pdf.mjs')
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = `${ASSET_BASE}pdf.worker.min.mjs?v=${pdfjs.version}`;
        return pdfjs;
      })
      .catch((error) => {
        loader = null;
        throw error;
      });
  }
  return loader;
}

function assetUrl(path: string): string {
  return new URL(`${ASSET_BASE}${path}`, window.location.origin).href;
}

/** data 는 Worker로 넘어가면서 분리(detach)되므로 호출할 때마다 새로 읽은 버퍼를 넘긴다. */
export async function openPdfDocument(data: Uint8Array): Promise<PDFDocumentLoadingTask> {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({
    data,
    cMapUrl: assetUrl('cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: assetUrl('standard_fonts/'),
    wasmUrl: assetUrl('wasm/'),
    iccUrl: assetUrl('iccs/'),
    enableXfa: false,
  });
}

export function describePdfError(error: unknown): string {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
  if (name === 'PasswordException') return '암호로 보호된 PDF는 아직 열 수 없습니다.';
  if (name === 'InvalidPDFException') return '손상되었거나 올바르지 않은 PDF 파일입니다.';
  if (error instanceof Error && error.message && !name.endsWith('Exception')) return error.message;
  return 'PDF를 열지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요.';
}

export async function readPageText(page: PDFPageProxy): Promise<PdfPageText> {
  const content = await page.getTextContent();
  const items: PdfTextItem[] = [];
  for (const item of content.items) {
    if (!('str' in item)) continue;
    const [, , c, d, x, y] = item.transform as number[];
    items.push({
      str: item.str,
      x,
      y,
      width: item.width,
      fontSize: Math.hypot(c, d) || item.height,
      hasEOL: item.hasEOL,
    });
  }
  return { items };
}

/** 첫 페이지 글자로 문서 목록에 보일 미리보기 문구를 만든다. 스캔본이면 빈 문자열. */
export async function readPdfExcerpt(doc: PDFDocumentProxy, maxLength = 160): Promise<string> {
  const page = await doc.getPage(1);
  const { items } = await readPageText(page);
  page.cleanup();
  const text = items
    .map((item) => item.str + (item.hasEOL ? ' ' : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text;
}

export interface ExtractOptions {
  onProgress?: (donePages: number, totalPages: number) => void;
  signal?: AbortSignal;
}

export async function extractPdfMarkdown(doc: PDFDocumentProxy, { onProgress, signal }: ExtractOptions = {}): Promise<string> {
  const pages: PdfPageText[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    if (signal?.aborted) throw new DOMException('변환이 취소되었습니다.', 'AbortError');
    const page = await doc.getPage(pageNumber);
    pages.push(await readPageText(page));
    page.cleanup();
    onProgress?.(pageNumber, doc.numPages);
  }
  return pdfPagesToMarkdown(pages);
}
