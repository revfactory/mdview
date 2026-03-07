---
name: ux-polish
description: "MDView UI 폴리싱 스킬. 스크린샷 또는 코드 기반으로 디자인 문제를 진단하고 수정합니다. 트리거: UI 폴리싱, 디자인 개선, UX 수정, 레이아웃 고치기."
---

# UX Polish — UI 디자인 개선 워크플로우

## 실행 모드

### 모드 A: 스크린샷 기반 개선
사용자가 스크린샷을 제공한 경우:

1. **스크린샷 분석** — 픽셀 단위로 문제 식별
2. **문제 리스트 작성** — 카테고리별 분류
3. **관련 파일 읽기** — 문제 원인 코드 확인
4. **수정 적용** — Edit 도구로 직접 수정
5. **빌드 검증** — `npm run build`

### 모드 B: 전체 폴리싱 스캔
스크린샷 없이 전체 UI 품질 향상:

1. **핵심 파일 순회** (아래 순서):
   - `globals.css` → 디자인 토큰 완전성
   - `app-shell.tsx` → 레이아웃 구조
   - `sidebar.tsx` → 사이드바 디자인
   - `toolbar.tsx` → 툴바 디자인
   - `status-bar.tsx` → 상태바 디자인
   - `editor.tsx` → 에디터 영역
   - `document-item.tsx` → 문서 리스트 아이템
   - `search-input.tsx` → 검색 입력
   - `modal.tsx`, `button.tsx`, `tooltip.tsx` → UI 프리미티브

2. **카테고리별 점검**:

#### Layout 점검
- [ ] 사이드바-컨텐츠 비율 적절한가
- [ ] 에디터 영역 최대 너비와 중앙 정렬
- [ ] 콘텐츠 오버플로우 처리 (min-w-0, overflow-hidden/auto)
- [ ] flex/grid 자식 요소 shrink/grow 적절한가

#### Spacing 점검
- [ ] 컨테이너 내부 패딩 일관성 (px-3, px-4 등)
- [ ] 요소 간 gap 일관성 (gap-1, gap-2 등)
- [ ] 섹션 간 구분 (divider 또는 여백)
- [ ] 첫 요소/마지막 요소 여백 처리

#### Color 점검
- [ ] 하드코딩된 색상 없음 (모두 CSS 변수)
- [ ] hover 상태 색상이 자연스러운가
- [ ] active/selected 상태 구분 명확한가
- [ ] 다크 모드에서 대비 충분한가

#### Typography 점검
- [ ] 제목-본문-보조텍스트 크기 단계 명확
- [ ] line-height가 텍스트 양에 적합한가
- [ ] truncate 처리 (긴 제목, 긴 경로)
- [ ] 숫자/날짜 폰트 크기 적절한가

#### Interaction 점검
- [ ] 모든 버튼 hover 상태 있음
- [ ] cursor-pointer 적용됨
- [ ] 포커스 링 visible
- [ ] 전환 애니메이션 transition-colors/all duration 적용

#### Responsiveness 점검
- [ ] 사이드바 접기/펼치기 동작
- [ ] 좁은 화면에서 콘텐츠 잘림 없음
- [ ] 모바일에서 터치 대상 44px 이상

3. **수정 적용** — 발견된 문제 즉시 수정
4. **빌드 검증**

## 공통 수정 패턴

### 패턴 1: 하드코딩 색상 → CSS 변수
```
before: text-gray-500, #666, rgb(100,100,100)
after:  text-[var(--color-text-muted)]
```

### 패턴 2: 오버플로우 수정
```
Grid/flex 자식: min-w-0 추가
텍스트 잘림: truncate 또는 overflow-hidden + text-ellipsis
스크롤 영역: overflow-y-auto + min-h-0 (flex 자식)
```

### 패턴 3: 여백 일관성
```
사이드바 내부: px-2 ~ px-3
툴바 내부: px-3, gap-0.5
에디터 래퍼: px-8 md:px-16
모달 내부: p-6
```

### 패턴 4: 인터랙션 추가
```
버튼: hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer
입력: focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20
액티브: bg-[var(--color-accent-light)] text-[var(--color-accent)]
```

## 품질 기준

수정 완료 후 다음을 만족해야 함:
- `npm run build` 성공
- 하드코딩 색상 0개
- 모든 버튼에 hover + cursor-pointer
- 모든 입력에 focus 스타일
- 오버플로우로 인한 레이아웃 깨짐 0건
- 라이트/다크 모드 모두 정상
