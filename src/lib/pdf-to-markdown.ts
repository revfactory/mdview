/**
 * pdf.js 가 돌려준 페이지별 텍스트 조각을 마크다운으로 조립한다.
 * PDF에는 문단·제목 구조가 없으므로 글자 위치와 크기로 추정한다.
 * - 같은 높이(y)의 조각은 한 줄로 합친다.
 * - 줄 간격이 평소보다 넓거나 글자 크기가 바뀌면 문단을 나눈다.
 * - 본문보다 큰 글자로 된 짧은 줄은 제목(#, ##, ###)으로 만든다.
 * - 글머리 기호(•, ● 등)로 시작하는 줄은 "- " 목록으로 만든다.
 * - 원문 글자가 마크다운 문법으로 해석되지 않도록 특수문자를 이스케이프한다.
 * 이 모듈은 DOM·pdf.js에 의존하지 않는다(테스트 대상).
 */

export interface PdfTextItem {
  str: string;
  /** 기준선 왼쪽 x (PDF 좌표) */
  x: number;
  /** 기준선 y (PDF 좌표, 위로 갈수록 값이 크다) */
  y: number;
  width: number;
  fontSize: number;
  hasEOL: boolean;
}

export interface PdfPageText {
  items: PdfTextItem[];
}

interface Line {
  text: string;
  y: number;
  fontSize: number;
}

type BlockType = 'heading' | 'bullet' | 'paragraph';

interface Block {
  type: BlockType;
  level: number;
  fontSize: number;
  lines: string[];
}

const BULLET_GLYPH = /^([•●○◦▪▫■□◆◇▶▷►‣⁃∙ㆍ])\s*(.*)$/;
const BULLET_ASCII = /^([-–*·])\s+(.*)$/;
const PAGE_NUMBER_PATTERNS = [
  /^[-–—]?\s*\d{1,4}\s*[-–—]?$/,
  /^\d{1,4}\s*\/\s*\d{1,4}$/,
  /^(?:page|p\.)\s*\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$/i,
  /^\d{1,4}\s*(?:쪽|페이지)$/,
];
const MAX_HEADING_LENGTH = 100;

export function pdfPagesToMarkdown(pages: PdfPageText[]): string {
  const pageLines = pages.map((page) => stripPageNumbers(buildLines(page.items)));
  const bodySize = dominantFontSize(pageLines.flat());
  const sections: string[] = [];

  for (const lines of pageLines) {
    const blocks = buildBlocks(lines, bodySize);
    const rendered = renderBlocks(blocks);
    if (rendered) sections.push(rendered);
  }

  return sections.join('\n\n').trim();
}

function normalizeSpaces(text: string): string {
  return text.replace(/[\s ]+/g, ' ').trim();
}

function buildLines(items: PdfTextItem[]): Line[] {
  const lines: Line[] = [];
  let parts: string[] = [];
  let lineY = 0;
  let endX = 0;
  let sizeWeights = new Map<number, number>();
  let maxSize = 0;
  let breakBeforeNext = true;

  const flush = () => {
    const text = normalizeSpaces(parts.join(''));
    if (text) {
      let fontSize = 0;
      let best = -1;
      for (const [size, weight] of sizeWeights) {
        if (weight > best) {
          best = weight;
          fontSize = size;
        }
      }
      lines.push({ text, y: lineY, fontSize: fontSize || maxSize });
    }
    parts = [];
    sizeWeights = new Map();
    maxSize = 0;
  };

  for (const item of items) {
    const str = item.str ?? '';
    if (!str.trim()) {
      // 공백뿐인 조각은 단어 사이 간격으로만 쓴다.
      if (str && parts.length) parts.push(' ');
      if (item.hasEOL) breakBeforeNext = true;
      continue;
    }
    const size = item.fontSize > 0 ? item.fontSize : 10;
    const sameLine = !breakBeforeNext && parts.length > 0
      && Math.abs(item.y - lineY) <= Math.max(maxSize, size) * 0.5;

    if (!sameLine) {
      flush();
      lineY = item.y;
    } else {
      const gap = item.x - endX;
      const prev = parts[parts.length - 1] ?? '';
      if (gap > size * 0.2 && !/\s$/.test(prev) && !/^\s/.test(str)) parts.push(' ');
    }

    parts.push(str);
    const size1 = Math.round(size * 2) / 2;
    sizeWeights.set(size1, (sizeWeights.get(size1) ?? 0) + str.trim().length);
    maxSize = Math.max(maxSize, size);
    endX = item.x + item.width;
    breakBeforeNext = item.hasEOL;
  }
  flush();
  return lines;
}

function isPageNumber(text: string): boolean {
  return PAGE_NUMBER_PATTERNS.some((pattern) => pattern.test(text));
}

/** 페이지 맨 위·맨 아래에 홀로 놓인 쪽 번호를 지운다. */
function stripPageNumbers(lines: Line[]): Line[] {
  const result = [...lines];
  if (result.length && isPageNumber(result[result.length - 1].text)) result.pop();
  if (result.length && isPageNumber(result[0].text)) result.shift();
  return result;
}

function dominantFontSize(lines: Line[]): number {
  const weights = new Map<number, number>();
  for (const line of lines) {
    weights.set(line.fontSize, (weights.get(line.fontSize) ?? 0) + line.text.length);
  }
  let size = 0;
  let best = -1;
  for (const [candidate, weight] of weights) {
    if (weight > best || (weight === best && candidate < size)) {
      best = weight;
      size = candidate;
    }
  }
  return size || 10;
}

function headingLevel(line: Line, bodySize: number): number {
  if (line.text.length > MAX_HEADING_LENGTH) return 0;
  const ratio = line.fontSize / bodySize;
  if (ratio >= 1.6) return 1;
  if (ratio >= 1.3) return 2;
  if (ratio >= 1.15) return 3;
  return 0;
}

/** 가장 자주 나오는 줄 간격(0.5pt 단위). 문단 간격이 섞여도 평소 줄 간격을 고르도록 동률이면 작은 값. */
function typicalGap(gaps: number[]): number {
  const counts = new Map<number, number>();
  for (const gap of gaps) {
    const rounded = Math.round(gap * 2) / 2;
    counts.set(rounded, (counts.get(rounded) ?? 0) + 1);
  }
  let result = 0;
  let best = 0;
  for (const [gap, count] of counts) {
    if (count > best || (count === best && gap < result)) {
      best = count;
      result = gap;
    }
  }
  return result;
}

function parseBullet(text: string): string | null {
  const match = text.match(BULLET_GLYPH) ?? text.match(BULLET_ASCII);
  return match ? match[2].trim() : null;
}

function buildBlocks(lines: Line[], bodySize: number): Block[] {
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1].y - lines[i].y;
    if (gap > 0 && gap < lines[i].fontSize * 3) gaps.push(gap);
  }
  const lineGap = typicalGap(gaps) || bodySize * 1.2;

  const blocks: Block[] = [];
  let current: Block | null = null;
  let prev: Line | null = null;

  for (const line of lines) {
    const bulletText = parseBullet(line.text);
    const level = bulletText === null ? headingLevel(line, bodySize) : 0;
    const type: BlockType = bulletText !== null ? 'bullet' : level ? 'heading' : 'paragraph';
    const text = bulletText ?? line.text;

    let startNew = !current || !prev || type === 'bullet';
    if (!startNew && current && prev) {
      const gap = prev.y - line.y;
      const sizeChanged = Math.abs(line.fontSize - current.fontSize) > bodySize * 0.15;
      // 단 바뀜처럼 위로 올라가는 경우와 문단 간격보다 넓게 떨어진 경우 새 블록으로 본다.
      const separated = gap <= 0 || gap > lineGap * 1.4;
      if (current.type === 'heading') {
        startNew = type !== 'heading' || current.level !== level || separated;
      } else if (current.type === 'bullet') {
        // 글머리 항목 다음의 일반 줄은 같은 항목이 이어지는 줄로 본다.
        startNew = type === 'heading' || separated || sizeChanged;
      } else {
        startNew = type === 'heading' || separated || sizeChanged;
      }
    }

    if (startNew || !current) {
      current = { type, level, fontSize: line.fontSize, lines: [text] };
      blocks.push(current);
    } else {
      current.lines.push(text);
    }
    prev = line;
  }
  return blocks;
}

function joinLines(lines: string[]): string {
  let result = '';
  for (const line of lines) {
    if (!result) {
      result = line;
    } else if (/[A-Za-z]-$/.test(result) && /^[a-z]/.test(line)) {
      // 영문 단어가 하이픈으로 줄을 넘긴 경우 하이픈을 지우고 붙인다.
      result = result.slice(0, -1) + line;
    } else {
      result += ` ${line}`;
    }
  }
  return result;
}

/** 원문 글자가 강조·코드·링크·수식·HTML로 해석되지 않게 한다. */
export function escapeMarkdownInline(text: string): string {
  return text.replace(/[\\`*_[\]<>~$]/g, (char) => `\\${char}`);
}

/** 줄 첫머리에서만 의미가 생기는 문법(제목, 인용, 목록, 구분선)을 막는다. */
export function escapeMarkdownBlockStart(text: string): string {
  return text
    .replace(/^(#{1,6})(?=\s|$)/, '\\$1')
    .replace(/^([+\-=])/, '\\$1')
    .replace(/^(\d{1,9})([.)])(?=\s|$)/, '$1\\$2');
}

function renderBlock(block: Block): string {
  const text = escapeMarkdownInline(joinLines(block.lines));
  if (block.type === 'heading') return `${'#'.repeat(block.level)} ${text}`;
  if (block.type === 'bullet') return `- ${escapeMarkdownBlockStart(text)}`;
  return escapeMarkdownBlockStart(text);
}

function renderBlocks(blocks: Block[]): string {
  let output = '';
  let prevType: BlockType | null = null;
  for (const block of blocks) {
    const rendered = renderBlock(block);
    if (!rendered.replace(/^[-#]+\s*/, '').trim()) continue;
    if (output) output += prevType === 'bullet' && block.type === 'bullet' ? '\n' : '\n\n';
    output += rendered;
    prevType = block.type;
  }
  return output;
}
