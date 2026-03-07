---
name: mdview-orchestrator
description: "MDView 프로젝트 오케스트레이터. 에이전트 팀을 조율하여 MDView 서비스를 구축합니다. 트리거: MDView 구축, 빌드, 개발 시작, 팀 실행."
---

# MDView Orchestrator — 프로젝트 구축 총괄

MDView 에이전트 팀을 조율하여 서비스를 단계적으로 구축하는 오케스트레이터 스킬입니다.

## 에이전트 팀 구성

| 에이전트 | 역할 | 스킬 | 담당 디렉토리 |
|---------|------|------|-------------|
| architect | 프로젝트 아키텍트 | — | 프로젝트 루트, types/, 설정 파일 |
| editor-engineer | 에디터 코어 | editor-setup | components/features/editor/, extensions/, lib/markdown.ts |
| hwp-engineer | HWP 브릿지 | hwp-bridge | workers/hwp-*, lib/hwp-converter.ts, components/features/import-export/ |
| ui-engineer | UI/UX | ui-system | components/ui/, components/layout/, styles/ |
| data-engineer | 데이터 레이어 | data-layer | db/, stores/, hooks/use-documents.ts, hooks/use-folders.ts, workers/search-* |
| qa-engineer | 품질/성능 | perf-optimize | PWA 설정, print.css, 성능 최적화 |
| design-reviewer | 디자인 검증 | design-filter | 전체 컴포넌트 디자인 감사 + 자동 수정 |
| ux-designer | UX 디자인 개선 | ux-polish | 스크린샷/코드 분석 → 디자인 개선 구현 |

## 구축 Phase

### Phase 1: 기반 구축 (순차)
**담당: architect**

1. 프로젝트 초기화 (`npm create vite@latest . -- --template react-ts`)
2. 의존성 설치 (MDVIEW_SPEC.md technology_stack 기반)
3. 빌드 설정 (vite.config.ts, tsconfig.json, tailwind)
4. 디렉토리 구조 스캐폴딩
5. 공유 타입 정의 (types/index.ts, types/editor.ts, types/hwp.ts)
6. 라우터 설정 (React Router, hash routing)
7. Dexie DB 스키마 초기화

**산출물**: 빌드 가능한 빈 프로젝트 + 타입 + 라우터 + DB

---

### Phase 2: 코어 모듈 병렬 개발 (팬아웃)
4개 에이전트가 독립적으로 병렬 작업:

#### 2A: UI 시스템 — ui-engineer
1. CSS 변수 디자인 토큰 (globals.css)
2. UI 프리미티브 (Button, Input, Modal, Dropdown 등)
3. App Shell 레이아웃 (Sidebar + EditorArea + StatusBar)
4. 테마 전환 시스템
5. EmptyState, Skeleton 컴포넌트

#### 2B: 데이터 레이어 — data-engineer
1. Dexie CRUD 유틸리티 (documents.ts, folders.ts)
2. Zustand 스토어 (ui-store, editor-store, search-store)
3. React 훅 (use-documents, use-folders)
4. FlexSearch Worker

#### 2C: 에디터 코어 — editor-engineer
1. TipTap 기본 설정 + StarterKit
2. 커스텀 확장 (slash-command, block-drag, unique-id, trailing-node)
3. 마크다운 ↔ HTML 변환 유틸리티
4. 버블 메뉴
5. 자동저장 훅

#### 2D: HWP 브릿지 — hwp-engineer
1. HWP 파싱 Worker
2. HWP → 마크다운 변환 로직
3. 마크다운 → HWPX 생성 로직
4. use-hwp 훅

**의존 관계**: 2C는 2B의 저장 함수 인터페이스 필요 (타입만 먼저 정의)

---

### Phase 3: 통합 (순차)
**담당: architect + 각 엔지니어**

1. App Shell + 사이드바 + 에디터 연결
2. 문서 열기/생성 → 에디터 로드 플로우
3. 자동저장 → IndexedDB 연결
4. HWP 임포트 → 에디터 로드 연결
5. 내보내기 메뉴 → HWP/PDF/MD 내보내기 연결
6. 검색 → Worker → 결과 표시 연결
7. 라우팅 → 뷰 전환 연결
8. 키보드 단축키 통합

---

### Phase 4: 고급 기능 (순차)
**담당: editor-engineer + ui-engineer**

1. Split View / Source View
2. 코드 블록 Shiki 구문 강조
3. KaTeX 수식 블록
4. Mermaid 다이어그램 블록
5. TOC 패널
6. 포커스 모드
7. 빠른 열기 (Cmd+P)
8. 파일 드롭 (전체 화면 드롭존)
9. PDF 내보내기

---

### Phase 5: 품질 및 최적화 (생성-검증)
**담당: qa-engineer**

1. 코드 스플리팅 적용 (React.lazy, manualChunks)
2. 가상 스크롤링 (문서 리스트)
3. Lazy render (코드/수식/다이어그램)
4. React.memo 최적화
5. PWA 설정 (Service Worker, manifest)
6. 인쇄 스타일 (print.css)
7. 반응형 테스트 (4단계 브레이크포인트)
8. 접근성 검증
9. Lighthouse 성능 측정
10. 번들 사이즈 분석

---

### Phase 6: 폴리시 (전체 팀)

1. 빈 상태 디자인 적용
2. 에러 바운더리 적용
3. 토스트 알림 통합
4. 애니메이션 미세 조정
5. 최종 통합 테스트 (MDVIEW_SPEC.md test_scenario 1-7)
6. 버그 수정

---

## 에이전트 호출 예시

```
Phase 1:
  Agent(architect) → "MDVIEW_SPEC.md 기반으로 프로젝트 초기화하고 스캐폴딩해줘"

Phase 2 (병렬):
  Agent(ui-engineer) → "디자인 토큰과 UI 프리미티브 컴포넌트를 만들어줘"
  Agent(data-engineer) → "Dexie DB와 Zustand 스토어를 구현해줘"
  Agent(editor-engineer) → "TipTap 에디터를 설정하고 커스텀 확장을 만들어줘"
  Agent(hwp-engineer) → "HWP 파싱 Worker와 변환 로직을 구현해줘"

Phase 3:
  Agent(architect) → "모든 모듈을 통합해줘"

Phase 5:
  Agent(qa-engineer) → "성능 최적화와 PWA를 적용해줘"
```

---

## 유지보수 모드: 이슈 분석 및 수정

구축 완료 후 버그/미구현/개선사항 처리 워크플로우.

### 에이전트 추가 구성

| 에이전트 | 역할 | 스킬 |
|---------|------|------|
| issue-analyst | 이슈 탐지/분류 | issue-triage |
| issue-fixer | 이슈 수정 | issue-triage |

### 워크플로우

```
1. 전체 스캔:
   Agent(issue-analyst) → "코드베이스 전체 이슈를 분석해줘"

2. 사용자 확인:
   이슈 목록 보고 → 수정 대상 선택

3. 수정 (병렬 가능):
   Agent(issue-fixer) → "critical/major 이슈를 수정해줘"
   Agent(ui-engineer) → "UI/UX 관련 이슈를 수정해줘" (필요시)
   Agent(editor-engineer) → "에디터 관련 이슈를 수정해줘" (필요시)

4. 검증:
   Agent(qa-engineer) → "수정 결과를 검증해줘"
```

### 사용자 직접 신고
사용자가 버그/개선을 직접 요청하면:
- 단순 이슈 → issue-fixer가 직접 수정
- 복합 이슈 → issue-analyst 분석 후 적절한 에이전트에 분배

---

## 테이블/이미지 파이프라인 모드

HWP ↔ 마크다운 간 테이블/이미지 변환 품질 개선.

### 에이전트 추가 구성

| 에이전트 | 역할 | 스킬 |
|---------|------|------|
| table-engineer | 테이블 변환 (병합셀, HTML 폴백) | table-image-pipeline |
| image-engineer | 이미지 추출/임베딩 | table-image-pipeline |

### 워크플로우 (순차)

```
Phase 1: Agent(table-engineer) → "HWP 내보내기에 테이블 지원 추가"
Phase 2: Agent(table-engineer) → "HWP 임포트 병합셀 + 복잡한 표 HTML 폴백"
Phase 3: Agent(image-engineer) → "HWP 임포트에서 이미지 추출"
Phase 4: Agent(image-engineer) → "HWP 내보내기에 이미지 임베딩"
Phase 5: Agent(hwp-engineer)   → "통합 검증 + Worker 프로토콜 정합"
```

## 참조 문서
- **MDVIEW_SPEC.md**: 프로젝트 스펙 (Single Source of Truth)
- 각 에이전트 정의: `.claude/agents/`
- 각 스킬: `.claude/skills/`
