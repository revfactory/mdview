---
name: sample-document
description: "MDView 샘플 문서 생성 스킬. 서비스 소개 + 마크다운 포맷 쇼케이스 문서를 만드는 기능. 트리거: 샘플 문서, 예제 문서, 데모 문서, 온보딩."
---

# Sample Document — MDView 샘플 문서 생성

빈 상태(Empty State)에서 "샘플 문서 만들기" 버튼을 제공하여 MDView 서비스 소개와 다양한 마크다운 포맷 쇼케이스 문서를 자동 생성하는 기능.

## 구조

```
src/
  lib/sample-document.ts    — 샘플 마크다운 콘텐츠 상수 + 생성 함수
  app/page.tsx               — EmptyState에 샘플 문서 버튼 추가
```

## 워크플로우

### 1. 샘플 콘텐츠 정의 (`src/lib/sample-document.ts`)
- MDView 소개 (제목, 기능 설명)
- 마크다운 포맷 쇼케이스:
  - 제목 (h1~h6)
  - 텍스트 서식 (굵게, 기울임, 취소선, 인라인코드)
  - 목록 (순서, 비순서, 체크리스트)
  - 인용문, 코드블록 (여러 언어)
  - 표 (테이블)
  - 링크, 이미지
  - 수평선, 각주
  - 수식 (LaTeX)
- `createSampleDocument()` 함수: `createDocument()`를 호출하여 DB에 저장

### 2. UI 연결 (`src/app/page.tsx`)
- `handleSampleDocument` 콜백 추가
- EmptyState의 `actions` 배열에 두 번째 버튼 추가:
  ```typescript
  actions={[
    { label: '새 문서 만들기', onClick: handleNewDocument, variant: 'primary' },
    { label: '샘플 문서 보기', onClick: handleSampleDocument, variant: 'secondary' },
  ]}
  ```

### 3. 버튼 스타일
- "새 문서 만들기": primary (기존)
- "샘플 문서 보기": secondary (신규) — BookOpen 아이콘 고려

## 담당 에이전트
- **ui-engineer**: 버튼 추가, EmptyState 수정
- **data-engineer**: 문서 생성 로직
- **editor-engineer**: 마크다운 콘텐츠 품질 검증
