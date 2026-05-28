/**
 * PDF import types.
 *
 * Phase 2 scope (Branch B): 텍스트 추출 + 기본 구조화(제목/문단/목록)만.
 * 표·이미지·OCR은 본 PR 범위에 포함되지 않으며 후속 작업에서 다룬다.
 */

// ---------- Intermediate per-page line representation ----------

/** Single visual line extracted from a PDF page. */
export interface PdfPageLine {
  text: string;
  /** Largest font size encountered on the line (px). */
  fontSize: number;
}

/** Parsed page produced by the worker before heuristic conversion. */
export interface PdfParsedPage {
  pageNumber: number;
  lines: PdfPageLine[];
}

// ---------- Block types extracted from a PDF ----------

export type PdfBlockType = 'heading' | 'paragraph' | 'list-item';

export interface PdfBlock {
  type: PdfBlockType;
  /** Plain text content of the block (HTML/markdown not pre-formatted). */
  text: string;
  /** Heading level 1..3 when type === 'heading'. */
  headingLevel?: 1 | 2 | 3;
  /** Ordered list marker presence — '1.' / '①' etc. */
  ordered?: boolean;
  /** Source page (1-indexed). */
  page: number;
}

// ---------- Worker contract ----------

export interface PdfImportOptions {
  /**
   * Maximum number of pages to parse. 0 = no limit.
   * Used to short-circuit very large PDFs.
   */
  maxPages?: number;
}

export interface PdfParseMessage {
  type: 'parse';
  /** Raw PDF file bytes. */
  file: ArrayBuffer;
  options?: PdfImportOptions;
}

export interface PdfProgressResponse {
  type: 'progress';
  percent: number;
  message: string;
}

export interface PdfCompleteResponse {
  type: 'complete';
  result: PdfParseResult;
}

export interface PdfErrorResponse {
  type: 'error';
  error: string;
}

export type PdfWorkerResponse =
  | PdfProgressResponse
  | PdfCompleteResponse
  | PdfErrorResponse;

// ---------- Result returned to the UI ----------

export interface PdfParseResult {
  /** Final markdown text assembled from blocks. */
  markdown: string;
  /** Raw blocks for callers that want to post-process. */
  blocks: PdfBlock[];
  /** Soft warnings (e.g. scanned page detected, page skipped). */
  warnings: string[];
  metadata: PdfDocumentMetadata;
}

export interface PdfDocumentMetadata {
  pageCount: number;
  parsedPageCount: number;
  title?: string;
  author?: string;
  /** True if at least one page returned almost no text — likely scanned/image PDF. */
  likelyScanned: boolean;
}
