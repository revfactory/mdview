---
name: data-layer
description: "MDView 데이터 레이어 스킬. Dexie.js IndexedDB, Zustand 상태 관리, FlexSearch 검색 구현."
---

# Data Layer — 데이터 저장 및 상태 관리

## 워크플로우

### Step 1: Dexie 데이터베이스

`db/index.ts`:
```typescript
import Dexie, { type EntityTable } from 'dexie';
import type { Document, Folder, AppSettings } from '@/types';

const db = new Dexie('MDViewDB') as Dexie & {
  documents: EntityTable<Document, 'id'>;
  folders: EntityTable<Folder, 'id'>;
  settings: EntityTable<AppSettings, 'id'>;
};

db.version(1).stores({
  documents: 'id, [folderId+sortOrder], updatedAt, isFavorite, *tags',
  folders: 'id, [parentId+sortOrder], name',
  settings: 'id',
});

export { db };
```

### Step 2: CRUD 유틸리티

`db/documents.ts`:
- createDocument(partial): id(nanoid) + defaults + createdAt/updatedAt 자동
- getDocument(id): 단건 조회
- updateDocument(id, changes): updatedAt 자동 갱신, excerpt/wordCount/charCount 재계산
- deleteDocument(id): 완전 삭제
- getDocumentsByFolder(folderId): folderId+sortOrder 인덱스 사용
- getFavorites(): isFavorite 인덱스
- getRecent(limit): updatedAt desc 정렬
- reorderDocuments(folderId, orderedIds): sortOrder 일괄 업데이트
- updateContent(id, content, htmlContent): 내용 변경 시 excerpt, wordCount, charCount, readingTime 자동 계산

`db/folders.ts`:
- createFolder(partial): id + defaults
- updateFolder(id, changes): updatedAt 갱신
- deleteFolder(id): 하위 문서를 parentId로 이동 후 삭제
- getFolderTree(): parentId 기반 트리 구조 조립
- reorderFolders(parentId, orderedIds): sortOrder 업데이트

### Step 3: Zustand 스토어

`stores/ui-store.ts`:
```typescript
interface UIStore {
  sidebarOpen: boolean;
  sidebarWidth: number;
  viewMode: 'wysiwyg' | 'split' | 'source';
  tocOpen: boolean;
  focusMode: boolean;
  theme: 'light' | 'dark' | 'system';
  // actions
  toggleSidebar(): void;
  setSidebarWidth(w: number): void;
  setViewMode(mode): void;
  toggleToc(): void;
  toggleFocusMode(): void;
  setTheme(theme): void;
}
```
- persist: localStorage에 자동 저장 (zustand/middleware)

`stores/editor-store.ts`:
```typescript
interface EditorStore {
  activeDocumentId: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  wordCount: number;
  charCount: number;
  cursorPosition: { line: number; col: number };
  // actions
  setActiveDocument(id: string): void;
  setSaveStatus(status): void;
  updateCounts(word, char): void;
  setCursorPosition(pos): void;
}
```

`stores/search-store.ts`:
```typescript
interface SearchStore {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  // actions
  setQuery(q: string): void;
  setResults(r: SearchResult[]): void;
}
```

### Step 4: React 훅

`hooks/use-documents.ts`:
- useLiveQuery로 문서 리스트 실시간 구독
- useDocument(id): 단건 구독
- useDocumentsByFolder(folderId)
- useFavorites()
- useRecentDocuments(limit)

`hooks/use-folders.ts`:
- useFolderTree(): 트리 구조 실시간 구독

`hooks/use-search.ts`:
- Worker와 postMessage 통신
- debounce 100ms
- 결과: { docId, title, snippet, score }[]

### Step 5: FlexSearch Worker

`workers/search-index.worker.ts`:
- 초기화: 모든 문서의 title + content 인덱싱
- 메시지 프로토콜:
  - { type: 'index', documents: { id, title, content }[] } → 벌크 인덱싱
  - { type: 'update', doc: { id, title, content } } → 단건 업데이트
  - { type: 'remove', id } → 인덱스 제거
  - { type: 'search', query } → 검색 실행
  - { type: 'results', results: { id, score }[] } → 검색 결과

### Step 6: 데이터 백업/복원

`lib/file-utils.ts`:
- exportAllData(): 모든 문서 + 폴더 → JSON 파일 다운로드
- importAllData(file): JSON 파일 → 기존 데이터 병합 또는 교체
- exportDocument(id, format): 단일 문서 MD/HTML 내보내기
