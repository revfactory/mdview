---
name: large-doc-perf
description: "대용량 HWP 문서(1000+페이지) 성능 최적화 스킬. 파서 이미지 제한, 콘텐츠 가드, 에디터 디바운스, 청크 로딩. 트리거: 대용량, 성능, 1000페이지, HWP 느림, 페이지 멈춤, 프리즈."
---

# Large Document Performance — 대용량 문서 성능 최적화

1000+ 페이지 HWP 파일 임포트 시 페이지 프리즈를 방지하는 전체 파이프라인 최적화.

## 병목 지점 분석

```
HWP File (100MB+)
  ↓ [Worker] hwp-parser.worker.ts
  ↓ ❌ 병목1: Base64 이미지 (개당 수 MB, 수십 개 = 수백 MB 문자열)
  ↓ ❌ 병목2: 최종 마크다운 문자열 크기 (수십 MB)
Markdown String
  ↓ [Main Thread] use-editor.ts → markdownToHtml()
  ↓ ❌ 병목3: 동기 마크다운→HTML 변환 (메인 스레드 블로킹)
HTML String
  ↓ [Main Thread] editor.tsx → editor.commands.setContent()
  ↓ ❌ 병목4: TipTap/ProseMirror DOM 파싱 (수만 노드 일괄 생성)
Editor Ready
  ↓ [Main Thread] editor.tsx → onUpdate → htmlToMarkdown()
  ❌ 병목5: 매 키 입력마다 전체 HTML→마크다운 동기 변환
```

## 최적화 전략

### 전략 1: Worker 단 이미지 제한 (hwp-engineer)

**파일**: `src/workers/hwp-parser.worker.ts`

```typescript
// 성능 제한 상수
const MAX_IMAGE_BYTES = 200 * 1024;  // 200KB — 초과 시 임베딩 제외
const MAX_TOTAL_IMAGES = 30;          // 최대 임베딩 이미지 수
```

**적용 위치**:
- `extractBinDataImages()` — HWP 바이너리 이미지 추출
- HWPX `parseHwpx()` — HWPX ZIP 이미지 추출

**로직**:
1. `rawData.length > MAX_IMAGE_BYTES` → 건너뛰기
2. `embeddedCount >= MAX_TOTAL_IMAGES` → 건너뛰기
3. 건너뛴 이미지 수를 `warnings[]`에 추가

### 전략 2: 콘텐츠 크기 가드 (hwp-engineer)

**파일**: `src/workers/hwp-parser.worker.ts`

```typescript
const MAX_CONTENT_LENGTH = 2 * 1024 * 1024; // 2MB 텍스트 제한

// 최종 마크다운이 2MB 초과 시 모든 base64 이미지 제거
if (content.length > MAX_CONTENT_LENGTH) {
  content = content.replace(/!\[([^\]]*)\]\(data:[^)]+\)/g, '![$1](이미지 제외됨)');
  warnings.push('문서가 매우 커서 일부 이미지가 제외되었습니다.');
}
```

**적용 위치**: `parseHwpBinary()` 반환 직전, `parseHwpx()` 반환 직전 (양쪽 모두)

### 전략 3: 에디터 htmlToMarkdown 디바운스 (editor-engineer)

**파일**: `src/components/features/editor/editor.tsx`

```typescript
// onUpdate 내부:
// 문자/단어 수 업데이트는 즉시 (저렴)
const charCount = ed.storage.characterCount?.characters?.() ?? 0;
actions.updateCounts(wordCount, charCount);

// 비용이 큰 htmlToMarkdown은 300ms 디바운스
if (markdownTimerRef.current) clearTimeout(markdownTimerRef.current);
markdownTimerRef.current = setTimeout(() => {
  const markdown = htmlToMarkdown(html);
  onChangeRef.current?.(markdown, html);
}, 300);
```

### 전략 4: 대용량 문서 로딩 최적화 (editor-engineer)

**파일**: `src/hooks/use-editor.ts`

```typescript
// 500KB 이상 마크다운 로딩 시 base64 data URL 제거 후 변환
if (raw.length > 500_000) {
  const stripped = raw.replace(/!\[([^\]]*)\]\(data:[^)]+\)/g, '![$1](이미지)');
  html = markdownToHtml(stripped);
} else {
  html = markdownToHtml(raw);
}
```

**핵심**: 저장된 `htmlContent`가 있으면 `markdownToHtml` 변환 자체를 건너뜀.

### 전략 5 (향후): 가상 렌더링 / 페이지네이션

대용량 문서의 근본적 해결:
- TipTap의 `NodeView`로 뷰포트 밖 노드 lazy render
- 문서를 섹션 단위로 분할하여 순차 로딩
- Intersection Observer로 스크롤 위치 기반 렌더링

## 에이전트별 작업 분배

### hwp-engineer 작업
1. `hwp-parser.worker.ts`에 이미지 크기/개수 제한 상수 추가
2. `extractBinDataImages()` 함수에 제한 로직 적용
3. HWPX 이미지 추출에도 동일 제한 적용
4. 최종 마크다운 콘텐츠 크기 가드 적용 (HWP + HWPX)
5. 건너뛴 이미지 수 경고 메시지 추가

### editor-engineer 작업
1. `editor.tsx` onUpdate의 `htmlToMarkdown()`을 300ms 디바운스
2. `use-editor.ts`에서 500KB+ 마크다운 로딩 시 base64 제거
3. 저장된 htmlContent 우선 사용 (markdownToHtml 건너뜀)

### qa-engineer 작업
1. 대용량 HWP 파일로 임포트 테스트 (목표: 프리즈 없이 로딩)
2. 키 입력 반응성 측정 (목표: 16ms 이내)
3. 메모리 사용량 모니터링 (목표: 500MB 이내)

## 성능 목표

| 시나리오 | Before | After (목표) |
|----------|--------|-------------|
| 1000페이지 HWP 임포트 | 페이지 프리즈 | < 10초, UI 반응 유지 |
| 대용량 문서 편집 키 입력 | 수백ms 지연 | < 16ms |
| 문서 로딩 (저장된 htmlContent) | markdownToHtml 재변환 | 즉시 로딩 |
| 마크다운 문자열 크기 | 수십~수백 MB | 최대 2MB |

### 전략 5: 마크다운 변환 Worker 이관 (구현 완료)

**파일**: `src/workers/markdown.worker.ts` (신규), `src/lib/markdown.ts`

- `markdownToHtmlAsync()` — Worker 기반 비동기 변환
- `htmlToMarkdownAsync()` — Worker 기반 비동기 변환
- 100KB+ 문서는 자동으로 Worker 사용
- 50KB 미만은 기존 동기 API 유지 (Worker 오버헤드 방지)

### 전략 6: 파서 메모리 최적화 (구현 완료)

- `parseRecords()`: `data.slice()` → `data.subarray()` (복사 제거)
- `uint8ArrayToBase64()`: 배열 기반 `String.fromCharCode.apply` 사용
- `renderAsMarkdownTable()`: 200셀 이상 테이블 → HTML 직접 렌더링
- `docTreeToMarkdown()`: 빈 줄 사전 필터링 → regex 제거

### 전략 7: HWP 임포트 시 htmlContent 사전 생성 (구현 완료)

- 임포트 완료 시 `markdownToHtmlAsync()`로 HTML 생성 후 DB 저장
- 재로딩 시 `markdownToHtml` 변환 완전 건너뜀

## 핵심 파일

| 파일 | 역할 |
|------|------|
| `src/workers/hwp-parser.worker.ts` | HWP 파싱 + 이미지 추출 (Worker) |
| `src/workers/markdown.worker.ts` | 마크다운↔HTML 비동기 변환 (Worker) |
| `src/components/features/editor/editor.tsx` | TipTap 에디터 인스턴스 |
| `src/hooks/use-editor.ts` | 문서 로딩 + markdownToHtmlAsync |
| `src/lib/markdown.ts` | 동기/비동기 변환 API |
| `src/db/documents.ts` | 대용량 문서 메타 계산 최적화 |
| `src/hooks/use-autosave.ts` | 자동저장 (requestIdleCallback) |
| `src/hooks/use-hwp.ts` | HWP 임포트/내보내기 훅 |
