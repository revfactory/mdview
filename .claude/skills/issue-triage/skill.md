---
name: issue-triage
description: "MDView 이슈 분석 및 수정 스킬. 코드베이스를 스캔하여 버그/미구현/개선사항을 찾고 수정합니다. 트리거: 이슈 분석, 버그 찾기, 점검, 진단, 헬스체크, 버그 수정, 개선."
---

# Issue Triage — 이슈 분석 및 수정

MDView 코드베이스의 버그, 미구현, 개선사항을 분석하고 수정하는 스킬입니다.

## 워크플로우

### Step 1: 스캔 (issue-analyst)
코드베이스를 탐색하여 이슈를 식별합니다.

**스캔 대상:**
```
src/app/          — 페이지, 글로벌 스타일
src/components/   — UI, 레이아웃, 기능 컴포넌트
src/hooks/        — 커스텀 훅
src/stores/       — Zustand 스토어
src/db/           — Dexie DB 레이어
src/lib/          — 유틸리티
src/styles/       — 에디터 스타일
```

**탐지 체크리스트:**
1. `window.prompt` / `window.confirm` / `window.alert` → 커스텀 다이얼로그로 교체
2. `// TODO` / `// FIXME` 주석 → 미구현 기능
3. `console.log` 잔존 → 디버그 코드 제거
4. 하드코딩 매직넘버 → 상수/디자인토큰 추출
5. `.equals(1)` 같은 boolean 인덱스 쿼리 → 필터 기반으로 수정
6. 에러 핸들링 누락 → try-catch 추가
7. 글로벌 CSS `*` 셀렉터 → Tailwind 레이어 충돌
8. 접근성 누락 → aria-label, 키보드 내비게이션
9. 미사용 import/변수 → 제거
10. 타입 안전성 (`any`, `as` 남용) → 적절한 타입으로 교체

### Step 2: 분류 및 우선순위
식별된 이슈를 분류합니다:

| Severity | 기준 |
|----------|------|
| critical | 앱 크래시, 데이터 손실, 핵심 기능 불능 |
| major | 주요 기능 오작동, UX 심각 저하 |
| minor | 사소한 UI 결함, 코드 품질 |

| Type | 설명 |
|------|------|
| bug | 의도와 다르게 동작 |
| unimplemented | 스펙에 있으나 미구현 |
| improvement | 동작하지만 개선 가능 |

### Step 3: 수정 (issue-fixer)
우선순위 순서대로 수정합니다.

**수정 규칙:**
- critical → 즉시 수정
- major → 배치 수정 (관련 이슈 묶어서)
- minor → 선택적 수정

**수정 후 검증:**
```bash
npx tsc --noEmit  # 타입 체크
```

### Step 4: 보고
수정 결과를 요약합니다.

## 에이전트 호출 패턴

### 전체 스캔 + 수정
```
1. Agent(issue-analyst) → "코드베이스 전체를 스캔하여 이슈 목록을 작성해줘"
2. 사용자에게 이슈 목록 보고 + 우선순위 확인
3. Agent(issue-fixer) → "다음 이슈들을 수정해줘: [이슈 목록]"
```

### 특정 영역 스캔
```
Agent(issue-analyst) → "사이드바 컴포넌트의 이슈를 분석해줘"
Agent(issue-fixer) → "사이드바의 [특정 이슈]를 수정해줘"
```

### 사용자 신고 이슈
```
사용자가 버그/개선 요청 → issue-fixer가 직접 수정
```

## 참조
- **MDVIEW_SPEC.md**: 기능 스펙 (미구현 판단 기준)
- **src/components/ui/**: 기존 UI 컴포넌트 (재사용 우선)
- **src/components/ui/dialog.tsx**: PromptDialog, ConfirmDialog
- **src/app/globals.css**: 디자인 토큰
