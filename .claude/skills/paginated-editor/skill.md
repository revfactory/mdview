---
name: paginated-editor
description: "대규모 문서 WYSIWYG 페이지네이션 스킬. 문서를 청크 분할하여 TipTap에서 한 페이지씩 편집. 트리거: 대용량 WYSIWYG, 페이지네이션, 청크 편집, 가상 문서."
---

# Paginated Editor — 대규모 문서 WYSIWYG 페이지네이션

TipTap/ProseMirror는 전체 문서를 DOM으로 렌더링하므로 수만 노드에서 프리즈.
**해법: 문서를 청크(페이지)로 분할하고, 한 번에 1청크만 TipTap에 로드.**

## 아키텍처 개요

```
┌─────────────────────────────────────────┐
│           대규모 마크다운 문서            │
│  (300KB+ = ~1000페이지 이상)             │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│         문서 청크 분할 (Chunker)         │
│  마크다운을 N개 청크로 분할              │
│  각 청크 ≤ 50KB (약 15~20페이지)         │
│  분할 기준: --- 구분자 > 빈 줄 2개 > 고정│
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│     IndexedDB 청크 저장 (ChunkStore)     │
│  documents_chunks 테이블                 │
│  { docId, chunkIndex, markdown, html }   │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│     페이지네이션 에디터 (PaginatedEditor) │
│  현재 청크만 TipTap에 로드               │
│  이전/다음 전환 시 현재 청크 저장 → 다음 로드│
│  페이지 네비게이터 UI 표시               │
└─────────────────────────────────────────┘
```

## 구현 전략

### 전략 1: 마크다운 청크 분할기

**파일**: `src/lib/chunk-document.ts`

```typescript
interface DocumentChunk {
  index: number;
  markdown: string;
  startLine: number;
  endLine: number;
}

const CHUNK_SIZE_TARGET = 50_000; // 50KB per chunk

function chunkDocument(markdown: string): DocumentChunk[] {
  // 1순위: --- (수평선) 기준 분할 (HWP 섹션 구분자)
  // 2순위: 빈 줄 2개 연속 기준 분할
  // 3순위: 고정 크기 분할 (줄 단위)
  // 각 청크가 CHUNK_SIZE_TARGET 이하가 되도록 재분할
}

function mergeChunks(chunks: DocumentChunk[]): string {
  // 청크 배열을 원본 마크다운으로 재조합
  return chunks.map(c => c.markdown).join('\n\n---\n\n');
}
```

**분할 알고리즘**:
1. `---` 구분자로 1차 분할
2. 각 섹션이 CHUNK_SIZE_TARGET 초과 시, 빈 줄(`\n\n`) 기준 재분할
3. 여전히 초과 시, 줄 단위로 고정 분할
4. 각 청크에 `startLine`, `endLine` 메타데이터 부여

### 전략 2: 청크 저장소

**파일**: `src/db/chunks.ts`

```typescript
// Dexie 테이블 추가
interface DocumentChunkRecord {
  id: string;          // `${docId}_chunk_${index}`
  docId: string;
  chunkIndex: number;
  markdown: string;
  htmlContent: string; // 사전 변환된 HTML
  updatedAt: Date;
}

// db.ts에 추가:
// chunks: '++id, docId, [docId+chunkIndex]'

async function saveChunks(docId: string, chunks: DocumentChunk[]): Promise<void>
async function getChunk(docId: string, index: number): Promise<DocumentChunkRecord>
async function getChunkCount(docId: string): Promise<number>
async function updateChunk(docId: string, index: number, markdown: string, html: string): Promise<void>
async function getAllChunksAsMarkdown(docId: string): Promise<string>  // 내보내기용
```

### 전략 3: 페이지네이션 에디터 컴포넌트

**파일**: `src/components/features/editor/paginated-editor.tsx`

```typescript
interface PaginatedEditorProps {
  documentId: string;
  totalChunks: number;
  onEditorReady?: (editor: TipTapEditor | null) => void;
}

function PaginatedEditor({ documentId, totalChunks, onEditorReady }: PaginatedEditorProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [chunkHtml, setChunkHtml] = useState('');

  // 페이지 전환 시:
  // 1. 현재 청크의 변경사항 저장 (autosave)
  // 2. 다음 청크 로드
  // 3. editor.commands.setContent(nextChunkHtml)

  // 페이지 네비게이터:
  // [◀ 이전] [3 / 47 페이지] [다음 ▶]
  // + 페이지 점프 입력 (직접 숫자 입력)
}
```

**핵심 로직**:
```typescript
const handlePageChange = async (newPage: number) => {
  if (newPage === currentPage) return;

  // 1. 현재 페이지 저장
  if (editor) {
    const html = editor.getHTML();
    const md = htmlToMarkdown(html);
    await updateChunk(documentId, currentPage, md, html);
  }

  // 2. 새 페이지 로드
  const chunk = await getChunk(documentId, newPage);
  const html = chunk.htmlContent || markdownToHtml(chunk.markdown);

  // 3. 에디터 업데이트
  editor.commands.setContent(html, { emitUpdate: false });
  setCurrentPage(newPage);
};
```

### 전략 4: 페이지 네비게이터 UI

**파일**: `src/components/features/editor/page-navigator.tsx`

```
┌─────────────────────────────────────────────┐
│ ◀  │  3 / 47 페이지  │  ▶  │  [이동]       │
└─────────────────────────────────────────────┘
```

- 이전/다음 버튼 + 키보드 단축키 (Ctrl+PageUp/PageDown)
- 페이지 번호 직접 입력으로 점프
- 현재 페이지 / 전체 페이지 표시
- 에디터 하단 또는 상단에 고정 배치

### 전략 5: HWP 임포트 → 청크 저장 연동

**파일**: `src/app/page.tsx` (handleImportComplete 수정)

```typescript
const handleImportComplete = async (content: string, title: string) => {
  const id = await createDocument({ title, content: '' }); // 빈 content로 생성

  if (content.length > LARGE_DOC_THRESHOLD) {
    // 청크 분할 + 저장
    const chunks = chunkDocument(content);
    await saveChunks(id, chunks);
    // 원본은 content 필드에도 저장 (내보내기용)
    await updateDocument(id, { content, isChunked: true, chunkCount: chunks.length });
  } else {
    // 일반 문서: 기존 로직
    const html = await markdownToHtmlAsync(content);
    await updateContent(id, content, html);
  }

  actions.setActiveDocument(id);
};
```

### 전략 6: useEditorManager 분기

```typescript
function useEditorManager(documentId: string | null) {
  // ...
  const [isChunked, setIsChunked] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);

  // 문서 로드 시:
  if (doc.isChunked) {
    setIsChunked(true);
    setChunkCount(doc.chunkCount);
    // 첫 번째 청크만 로드
    const firstChunk = await getChunk(documentId, 0);
    setHtmlContent(firstChunk.htmlContent || markdownToHtml(firstChunk.markdown));
  }

  return { ..., isChunked, chunkCount };
}
```

### 전략 7: 내보내기 시 청크 병합

```typescript
// 내보내기(HWP/MD/PDF) 시 모든 청크를 병합하여 전체 마크다운 재구성
const fullMarkdown = await getAllChunksAsMarkdown(documentId);
```

## 에이전트별 작업 분배

### Phase 1: 기반 (순차)

| 에이전트 | 작업 |
|---------|------|
| data-engineer | Dexie chunks 테이블 스키마 + CRUD 함수 |
| editor-engineer | `chunkDocument()` 분할 알고리즘 구현 |

### Phase 2: 코어 (병렬)

| 에이전트 | 작업 |
|---------|------|
| editor-engineer | `PaginatedEditor` 컴포넌트 + 페이지 전환 로직 |
| ui-engineer | `PageNavigator` UI 컴포넌트 |

### Phase 3: 통합 (순차)

| 에이전트 | 작업 |
|---------|------|
| editor-engineer | `useEditorManager` 청크 모드 분기, 임포트/내보내기 연동 |
| hwp-engineer | HWP 파서에서 섹션 단위 청크 힌트 추가 |

### Phase 4: 검증

| 에이전트 | 작업 |
|---------|------|
| qa-engineer | 1000+페이지 HWP 임포트 → 페이지네이션 편집 → 내보내기 검증 |

## 핵심 파일 (신규/수정)

| 파일 | 상태 | 설명 |
|------|------|------|
| `src/lib/chunk-document.ts` | 신규 | 마크다운 청크 분할/병합 |
| `src/db/chunks.ts` | 신규 | 청크 IndexedDB CRUD |
| `src/db/index.ts` | 수정 | chunks 테이블 스키마 추가 |
| `src/components/features/editor/paginated-editor.tsx` | 신규 | 페이지네이션 에디터 |
| `src/components/features/editor/page-navigator.tsx` | 신규 | 페이지 네비게이터 UI |
| `src/hooks/use-editor.ts` | 수정 | 청크 모드 분기 |
| `src/app/page.tsx` | 수정 | PaginatedEditor 렌더링 분기 |
| `src/types/index.ts` | 수정 | Document에 isChunked, chunkCount 추가 |

## 제약 사항

- 청크 간 경계에 걸치는 요소 (테이블, 코드블록)는 분할하지 않음
- 검색(Ctrl+F)은 현재 청크 내에서만 동작, 전체 검색은 별도 구현 필요
- Undo/Redo는 현재 청크 범위 내에서만 동작
- 페이지 전환 시 에디터 포커스 위치 초기화

## TipTap 한계와 대안 비교

| 접근법 | 장점 | 단점 | 실현성 |
|--------|------|------|--------|
| **페이지네이션 (이 스킬)** | TipTap 그대로 사용, 구현 단순 | 페이지 경계 편집 불편 | ✅ 높음 |
| ProseMirror 가상화 | 전체 문서 편집 가능 | ProseMirror 코어 수정 필요, 난이도 극높 | ❌ 비현실적 |
| iframe 분할 렌더링 | 각 페이지 독립 에디터 | iframe 간 통신 복잡, 메모리 증가 | ⚠ 중간 |
| Canvas 기반 렌더링 | 무한 스크롤 가능 | 텍스트 선택/편집 불가 | ❌ 뷰어 전용 |
| 읽기 전용 HTML + 편집 모달 | 전체 미리보기 가능 | 편집 경험 분리 | ⚠ 타협안 |
