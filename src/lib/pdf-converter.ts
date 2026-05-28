/**
 * PDF → Markdown converter (Branch B: 텍스트 + 기본 구조화만).
 *
 * Heuristics:
 *   - 제목 추정: 페이지 평균 글자 크기 대비 1.2배 이상인 줄을 `#` ~ `###` 으로 매핑
 *     (최대 3단계). 가장 큰 비율 → H1, 그 다음 → H2, 그 외 → H3.
 *   - 목록 추정: 줄 앞의 `•`, `·`, `-`, `*`, `1.`, `1)`, `①` 등 마커를 인식해
 *     마크다운 리스트로 변환.
 *   - 문단: 그 외 일반 텍스트는 단락으로 묶고, 페이지 사이에 빈 줄 삽입.
 *
 * 본 PR 범위에 포함되지 않은 항목:
 *   - 페이지 번호 / 머리말 / 꼬리말 자동 제거 (TODO)
 *   - 줄 끝 하이픈 (word-break) 복원 (TODO)
 *   - 다단(컬럼) 레이아웃 인식, 표 추출, OCR
 *
 * 위 TODO는 후속 PR에서 다룬다.
 */

import type { PdfBlock, PdfPageLine, PdfParsedPage } from '@/types/pdf';

// Backwards-compatible local aliases (kept short for readability below).
type PageLine = PdfPageLine;
type ParsedPage = PdfParsedPage;

// ---------- List-marker detection ----------

const UNORDERED_MARKERS = ['•', '·', '◦', '▪', '▫', '■', '●', '○', '※', '–', '—'];

/** Regex for ordered list markers at the start of a line. */
const ORDERED_RE = /^(\(?\d{1,3}[.)]|[①-⑳㉑-㉟㊱-㊿]|[ⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹ]+[.)]?|[IVX]+\.)\s+/;

interface ListDetection {
  matched: boolean;
  ordered: boolean;
  /** Text with the leading marker stripped. */
  body: string;
}

function detectListMarker(rawText: string): ListDetection {
  const text = rawText.trimStart();

  // Unordered: leading bullet glyph
  for (const m of UNORDERED_MARKERS) {
    if (text.startsWith(m)) {
      const body = text.slice(m.length).trim();
      if (body.length > 0) {
        return { matched: true, ordered: false, body };
      }
    }
  }

  // Hyphen / asterisk bullets (require a following space)
  if (/^[-*]\s+/.test(text)) {
    return {
      matched: true,
      ordered: false,
      body: text.replace(/^[-*]\s+/, '').trim(),
    };
  }

  // Ordered
  const m = text.match(ORDERED_RE);
  if (m) {
    return {
      matched: true,
      ordered: true,
      body: text.slice(m[0].length).trim(),
    };
  }

  return { matched: false, ordered: false, body: text };
}

// ---------- Heading detection ----------

interface HeadingThresholds {
  pageAverage: number;
  /** Distinct "large" sizes in descending order — first three become H1/H2/H3. */
  largeSizes: number[];
}

function computeHeadingThresholds(lines: PageLine[]): HeadingThresholds {
  if (lines.length === 0) {
    return { pageAverage: 0, largeSizes: [] };
  }

  const totalChars = lines.reduce((sum, l) => sum + Math.max(l.text.length, 1), 0);
  const weightedSum = lines.reduce(
    (sum, l) => sum + l.fontSize * Math.max(l.text.length, 1),
    0
  );
  const pageAverage = totalChars > 0 ? weightedSum / totalChars : 0;

  // Collect candidate heading sizes — round to 1 decimal to group "near-equal" sizes
  const cutoff = pageAverage * 1.2;
  const sizeSet = new Set<number>();
  for (const line of lines) {
    if (line.fontSize >= cutoff) {
      sizeSet.add(Math.round(line.fontSize * 10) / 10);
    }
  }

  const largeSizes = Array.from(sizeSet).sort((a, b) => b - a).slice(0, 3);
  return { pageAverage, largeSizes };
}

function headingLevelFor(fontSize: number, thresholds: HeadingThresholds): 1 | 2 | 3 | null {
  if (thresholds.pageAverage <= 0) return null;
  if (fontSize < thresholds.pageAverage * 1.2) return null;

  const rounded = Math.round(fontSize * 10) / 10;
  const idx = thresholds.largeSizes.indexOf(rounded);
  if (idx === 0) return 1;
  if (idx === 1) return 2;
  if (idx === 2) return 3;
  // Larger than cutoff but not in top-3 distinct sizes → H3
  return 3;
}

// ---------- Page → Blocks ----------

export function convertPagesToBlocks(pages: ParsedPage[]): PdfBlock[] {
  const blocks: PdfBlock[] = [];

  for (const page of pages) {
    if (page.lines.length === 0) continue;

    const thresholds = computeHeadingThresholds(page.lines);

    // Buffer for consecutive paragraph lines so we can merge them into a single block
    let paragraphBuffer: string[] = [];

    const flushParagraph = () => {
      if (paragraphBuffer.length === 0) return;
      const text = paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim();
      if (text.length > 0) {
        blocks.push({ type: 'paragraph', text, page: page.pageNumber });
      }
      paragraphBuffer = [];
    };

    for (const line of page.lines) {
      const list = detectListMarker(line.text);
      if (list.matched) {
        flushParagraph();
        blocks.push({
          type: 'list-item',
          text: list.body,
          ordered: list.ordered,
          page: page.pageNumber,
        });
        continue;
      }

      const headingLevel = headingLevelFor(line.fontSize, thresholds);
      if (headingLevel !== null) {
        flushParagraph();
        blocks.push({
          type: 'heading',
          text: line.text.trim(),
          headingLevel,
          page: page.pageNumber,
        });
        continue;
      }

      // Regular text line — accumulate into the current paragraph buffer
      paragraphBuffer.push(line.text);
    }

    flushParagraph();
  }

  return blocks;
}

// ---------- Blocks → Markdown ----------

/**
 * Escape characters with special meaning in markdown. Keep this minimal so that
 * common punctuation stays readable.
 */
function escapeMarkdownInline(text: string): string {
  return text
    // Escape leading characters that would be parsed as block syntax
    .replace(/^(\s*)([#>|])/, '$1\\$2')
    // Escape backticks to avoid accidental inline code spans
    .replace(/`/g, '\\`');
}

export function blocksToMarkdown(blocks: PdfBlock[]): string {
  const lines: string[] = [];
  let lastPage = -1;
  let orderedCounter = 0;
  let lastBlockWasOrderedList = false;

  for (const block of blocks) {
    // Insert a blank line between pages (page break = blank line only — page
    // number / header / footer normalization is out of scope, see file header).
    if (lastPage !== -1 && block.page !== lastPage) {
      if (lines[lines.length - 1] !== '') lines.push('');
      orderedCounter = 0;
      lastBlockWasOrderedList = false;
    }

    if (block.type === 'heading') {
      if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
      const hashes = '#'.repeat(block.headingLevel ?? 3);
      lines.push(`${hashes} ${escapeMarkdownInline(block.text)}`);
      lines.push('');
      orderedCounter = 0;
      lastBlockWasOrderedList = false;
    } else if (block.type === 'list-item') {
      if (block.ordered) {
        if (!lastBlockWasOrderedList) orderedCounter = 0;
        orderedCounter += 1;
        lines.push(`${orderedCounter}. ${escapeMarkdownInline(block.text)}`);
        lastBlockWasOrderedList = true;
      } else {
        lines.push(`- ${escapeMarkdownInline(block.text)}`);
        lastBlockWasOrderedList = false;
        orderedCounter = 0;
      }
    } else {
      // paragraph
      if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
      lines.push(escapeMarkdownInline(block.text));
      lines.push('');
      orderedCounter = 0;
      lastBlockWasOrderedList = false;
    }

    lastPage = block.page;
  }

  // Collapse 3+ trailing blank lines down to a single trailing newline
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
