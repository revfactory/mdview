/**
 * chunk-document.ts
 *
 * 대규모 마크다운 문서를 안전하게 청크로 분할하고 재조합하는 모듈.
 *
 * 분할 우선순위:
 *   1. `---` 수평선 (HWP 섹션 구분자)
 *   2. 빈 줄 2개 이상 연속
 *   3. 빈 줄 1개
 *
 * 테이블/코드블록 내부에서는 절대 분할하지 않는다.
 */

export interface DocumentChunk {
  index: number;
  markdown: string;
}

/** 목표 청크 크기 (문자 수 기준, ~50 KB UTF-8) */
export const CHUNK_SIZE_TARGET = 50_000;

// ---------------------------------------------------------------------------
// 내부 유틸
// ---------------------------------------------------------------------------

/** 코드블록(``` 또는 ~~~) 경계를 감지하는 정규식 */
const CODE_FENCE_RE = /^(`{3,}|~{3,})/;

/** 수평선 패턴 — 줄 전체가 `---` 이상이어야 함 */
const HR_RE = /^-{3,}\s*$/;

/**
 * 주어진 위치가 코드블록 또는 테이블 내부인지 판별하기 위해
 * 문서를 "보호 영역(protected range)"으로 미리 스캔한다.
 */
interface ProtectedRange {
  start: number; // 문자 offset (inclusive)
  end: number;   // 문자 offset (exclusive)
}

function buildProtectedRanges(text: string): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  const lines = text.split('\n');
  let offset = 0;
  let fenceStart = -1;
  let fencePattern: string | null = null;
  let tableStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // --- 코드블록 처리 ---
    const fenceMatch = trimmed.match(CODE_FENCE_RE);
    if (fenceMatch) {
      if (fenceStart === -1) {
        // 코드블록 시작
        fenceStart = offset;
        fencePattern = fenceMatch[1][0]; // ` 또는 ~
      } else if (trimmed.startsWith(fencePattern!.repeat(3)) && trimmed.replace(/`/g, '').replace(/~/g, '').trim() === '') {
        // 코드블록 종료
        ranges.push({ start: fenceStart, end: offset + line.length });
        fenceStart = -1;
        fencePattern = null;
      }
    }

    // --- 테이블 처리 (코드블록 밖에서만) ---
    if (fenceStart === -1) {
      const isTableLine = line.includes('|');
      if (isTableLine && tableStart === -1) {
        tableStart = offset;
      } else if (!isTableLine && tableStart !== -1) {
        // 테이블 종료 — 직전 줄 끝까지
        ranges.push({ start: tableStart, end: offset - 1 });
        tableStart = -1;
      }
    }

    offset += line.length + 1; // +1 for '\n'
  }

  // 닫히지 않은 코드블록 — 문서 끝까지 보호
  if (fenceStart !== -1) {
    ranges.push({ start: fenceStart, end: text.length });
  }
  // 닫히지 않은 테이블
  if (tableStart !== -1) {
    ranges.push({ start: tableStart, end: text.length });
  }

  return ranges;
}

/** offset 이 보호 영역 내부에 있는지 확인 */
function isProtected(offset: number, ranges: ProtectedRange[]): boolean {
  for (const r of ranges) {
    if (offset >= r.start && offset < r.end) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 분할 후보(split candidate) 수집
// ---------------------------------------------------------------------------

interface SplitCandidate {
  offset: number;  // 분할 지점 (이 offset 직전까지가 앞 청크)
  priority: 1 | 2 | 3;
}

/**
 * 문서 전체를 스캔하여 분할 가능 지점을 우선순위와 함께 수집한다.
 * 보호 영역 내부의 후보는 제외한다.
 */
function collectSplitCandidates(text: string, protectedRanges: ProtectedRange[]): SplitCandidate[] {
  const candidates: SplitCandidate[] = [];
  const lines = text.split('\n');
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = offset;
    const lineEnd = offset + line.length; // '\n' 은 lineEnd 위치

    // 1순위: 수평선 `---`
    if (HR_RE.test(line.trim())) {
      // 수평선 다음 줄부터 새 청크 시작
      const splitAt = lineEnd + 1; // '\n' 다음
      if (splitAt < text.length && !isProtected(lineStart, protectedRanges)) {
        candidates.push({ offset: splitAt, priority: 1 });
      }
    }

    // 빈 줄 연속 감지
    if (line.trim() === '' && i > 0) {
      // 이전 줄도 빈 줄이면 2순위(2개 이상 연속), 아니면 3순위(1개 빈 줄)
      const prevLine = lines[i - 1];
      if (prevLine.trim() === '') {
        // 2순위: 이미 이전 빈 줄에서 3순위 후보가 들어갔을 수 있으므로
        // 현재 빈 줄 다음을 2순위로 등록
        const splitAt = lineEnd + 1;
        if (splitAt < text.length && !isProtected(lineStart, protectedRanges)) {
          candidates.push({ offset: splitAt, priority: 2 });
        }
      } else {
        // 3순위: 빈 줄 1개 — 빈 줄 다음
        const splitAt = lineEnd + 1;
        if (splitAt < text.length && !isProtected(lineStart, protectedRanges)) {
          candidates.push({ offset: splitAt, priority: 3 });
        }
      }
    }

    offset = lineEnd + 1;
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// 메인 API
// ---------------------------------------------------------------------------

/**
 * 마크다운 문서를 `CHUNK_SIZE_TARGET` 이하의 청크들로 분할한다.
 *
 * - 테이블/코드블록 내부에서는 분할하지 않는다.
 * - 분할 우선순위: 수평선 > 빈 줄 2개+ > 빈 줄 1개
 * - 적절한 분할 지점이 없으면 청크가 목표 크기를 초과할 수 있다.
 */
export function chunkDocument(markdown: string): DocumentChunk[] {
  if (markdown.length <= CHUNK_SIZE_TARGET) {
    return [{ index: 0, markdown }];
  }

  const protectedRanges = buildProtectedRanges(markdown);
  const candidates = collectSplitCandidates(markdown, protectedRanges);

  // offset 기준 정렬
  candidates.sort((a, b) => a.offset - b.offset);

  const chunks: DocumentChunk[] = [];
  let chunkStart = 0;

  while (chunkStart < markdown.length) {
    const remaining = markdown.length - chunkStart;

    if (remaining <= CHUNK_SIZE_TARGET) {
      // 남은 부분이 목표 이하 → 마지막 청크
      chunks.push({ index: chunks.length, markdown: markdown.slice(chunkStart) });
      break;
    }

    // chunkStart ~ chunkStart + CHUNK_SIZE_TARGET 범위 내 후보 필터링
    const windowEnd = chunkStart + CHUNK_SIZE_TARGET;
    const windowCandidates = candidates.filter(
      (c) => c.offset > chunkStart && c.offset <= windowEnd,
    );

    if (windowCandidates.length === 0) {
      // 범위 내 분할 후보 없음 → 범위 밖 가장 가까운 후보 탐색
      const nextCandidate = candidates.find((c) => c.offset > chunkStart);
      if (nextCandidate) {
        chunks.push({
          index: chunks.length,
          markdown: markdown.slice(chunkStart, nextCandidate.offset),
        });
        chunkStart = nextCandidate.offset;
      } else {
        // 더 이상 후보가 없음 → 나머지 전부
        chunks.push({ index: chunks.length, markdown: markdown.slice(chunkStart) });
        break;
      }
      continue;
    }

    // 우선순위가 가장 높은(숫자가 낮은) 후보 중 가장 뒤쪽 선택
    const bestPriority = Math.min(...windowCandidates.map((c) => c.priority));
    const bestCandidates = windowCandidates.filter((c) => c.priority === bestPriority);
    const chosen = bestCandidates[bestCandidates.length - 1]; // 가장 뒤쪽

    chunks.push({
      index: chunks.length,
      markdown: markdown.slice(chunkStart, chosen.offset),
    });
    chunkStart = chosen.offset;
  }

  return chunks;
}

/**
 * 분할된 청크들을 원본 마크다운으로 재조합한다.
 * index 순서로 정렬 후 단순 연결한다.
 */
export function mergeChunks(chunks: DocumentChunk[]): string {
  return [...chunks]
    .sort((a, b) => a.index - b.index)
    .map((c) => c.markdown)
    .join('');
}
