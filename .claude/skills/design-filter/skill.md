---
name: design-filter
description: "MDView 디자인 필터링 스킬. UI 코드를 MDVIEW_SPEC.md 기준으로 검증하고, 편차를 자동 수정합니다. 트리거: 디자인 필터, UI 검수, 스타일 점검, 비주얼 QA."
---

# Design Filter — UI 디자인 검증 및 자동 수정

## 워크플로우

### Step 1: 기준 수립
1. `MDVIEW_SPEC.md`의 `<aesthetic_guidelines>` 섹션 읽기
2. `src/app/globals.css`의 CSS 변수 디자인 토큰 읽기
3. 검증 기준 테이블 생성

### Step 2: 파일별 감사
대상 파일을 순서대로 읽으며 체크리스트 적용:

**감사 순서** (의존도 높은 순):
1. `src/app/globals.css` — 디자인 토큰 완전성
2. `src/app/layout.tsx` — 폰트, 테마 초기화
3. `src/components/ui/*` — 프리미티브 컴포넌트 (8개)
4. `src/components/layout/*` — 레이아웃 컴포넌트 (4개)
5. `src/components/features/editor/*` — 에디터 UI (3개)
6. `src/components/features/document/*` — 문서 리스트 (2개)
7. `src/components/features/import-export/*` — 임포트/내보내기 (3개)
8. `src/styles/editor.css` — 에디터 내부 스타일
9. `src/app/page.tsx` — 메인 페이지 통합

### Step 3: 검증 규칙

#### 색상 규칙
```
PASS: var(--color-*)로 참조
FAIL: 하드코딩된 hex (#FFFFFF 등) — CSS 변수로 교체 필요
EXCEPTION: Tailwind 유틸 (bg-white, text-black 등) — CSS 변수로 교체 권장
EXCEPTION: 인라인 SVG fill/stroke — 허용
```

#### 크기 규칙
```
버튼: h-9 (36px) 또는 h-8 (32px for icon-only)
입력: h-9 (36px)
사이드바: w-[280px] (기본)
툴바: h-11 (44px)
상태바: h-7 (28px)
아이콘: w-4 h-4 (16px) 또는 w-[18px] h-[18px] (toolbar)
border-radius: rounded-[6px] | rounded-lg(8px) | rounded-xl(12px) | rounded-2xl(16px)
```

#### 상태 규칙
```
버튼: hover:bg-[var(--color-surface-hover)] (최소)
입력: focus:border-[var(--color-accent)] focus:ring-2
활성 탭/메뉴: bg-[var(--color-accent-light)] text-[var(--color-accent)]
disabled: opacity-40 또는 opacity-50 + cursor-not-allowed
```

#### 타이포 규칙
```
font-sans (Pretendard): 모든 UI 텍스트
font-mono: 코드 블록, 인라인 코드만
제목: text-2xl(H1) ~ text-sm(H6) + font-semibold 이상
본문: text-base(16px) font-normal
캡션/뱃지: text-xs(12px)
사이드바 네비: text-sm(14px) font-medium
```

### Step 4: 자동 수정
발견된 문제를 심각도별로 분류:

- **CRITICAL**: 즉시 자동 수정 (하드코딩 색상 → CSS 변수, 누락된 상태)
- **WARNING**: 수정 제안 후 사용자 확인
- **INFO**: 리포트에만 기록

수정 시 Edit 도구 사용, 파일별로 순차 수정.

### Step 5: 재검증
수정 후 `npm run build`로 빌드 확인, 주요 수정 사항 요약 리포트 생성.

## 빠른 실행 명령

design-reviewer 에이전트에게 다음과 같이 요청:

```
"MDVIEW_SPEC.md의 aesthetic_guidelines 기준으로 현재 UI 코드를 전수 검사하고
디자인 필터 리포트를 생성해주세요. CRITICAL 이슈는 즉시 수정하세요."
```

## 검증 우선순위 매트릭스

| 영역 | 영향도 | 빈도 | 우선순위 |
|------|--------|------|---------|
| 하드코딩 색상 | 높음 | 높음 | P0 |
| 누락된 다크모드 | 높음 | 중간 | P0 |
| 접근성 위반 | 높음 | 중간 | P1 |
| 크기/간격 불일치 | 중간 | 높음 | P1 |
| 누락된 상태(hover/focus) | 중간 | 중간 | P2 |
| 애니메이션 누락 | 낮음 | 높음 | P2 |
| 반응형 미대응 | 높음 | 낮음 | P2 |
| 타이포 불일치 | 낮음 | 중간 | P3 |
