---
name: issue-triage-policy
description: GitHub Issues 분류·라벨·우선순위 결정 정책 스킬. 이슈를 bug/feature/question/duplicate/needs-info/wontfix 로 분류하고, 영역·우선순위 라벨을 적용하며, 응답 SLA·에스컬레이션 기준을 정의한다. 트리거 - 이슈 분류 기준, 라벨 정책, 트리아지 정책, 우선순위 결정, 이슈 분류 가이드, severity 결정.
---

# Issue Triage Policy — 분류·라벨·우선순위 결정 기준

이슈를 일관되게 분류하기 위한 의사결정 규칙. issue-curator 가 본문을 읽고 이 정책에 따라 라벨을 부여한다.

## 1차 분류: 카테고리

본문을 읽고 가장 적합한 카테고리 하나를 고른다. 모호하면 reproducer 에게 사전 검토 요청.

### 🐛 bug
- 의도된 동작과 실제가 다름
- 에러/크래시/잘못된 결과
- 재현 가능한 경우만 `bug` 단독, 정보 부족이면 `bug` + `needs-info`

**시그널:** "재현 절차", "에러", "동작 안 함", "결과가 다름", 스크린샷, 로그

### 💡 enhancement (= feature request)
- 새 기능 / 기존 기능 개선
- 동작 변경 요청

**시그널:** "추가해주세요", "지원했으면", "~ 기능", "옵션 필요"

### ❓ question
- 사용법, 동작 원리, 디자인 결정에 대한 질문
- 코드 변경 불필요

**시그널:** "어떻게 ~", "왜 ~", "~ 가능한가요?"

### 🔁 duplicate
- 이미 등록된 이슈와 동일한 문제/요청

**확인 절차:** 분류 전 `gh issue list --search` 로 키워드 검색 필수

### 🚫 wontfix
- 스펙 범위 외 (MDVIEW_SPEC.md `<out_of_scope>` 또는 `<future_considerations>` 의 Phase 2/3 이후)
- 의도된 동작 (사용자 오해)
- 기술적/철학적 이유로 채택 불가

### 📋 needs-info
- 재현 절차 부족 / 환경 정보 누락 / 첨부 파일 부재
- 단독 또는 다른 라벨과 병행 (예: `bug` + `needs-info`)

### 📝 documentation
- 문서 오류·누락
- README/CONTRIBUTING/CHANGELOG 변경 요청

## 2차 분류: 영역(area)

코드베이스 위치 기준. 이슈가 여러 영역에 걸치면 여러 라벨 적용.

| 라벨 | 대상 |
|------|------|
| `area:editor` | TipTap, 슬래시 명령어, 블록 편집, 확장 (`src/extensions/`, `src/components/features/editor/`) |
| `area:hwp` | HWP/HWPX 임포트·내보내기 (`src/workers/hwp-*`, `src/lib/hwp-converter.ts`) |
| `area:ui` | UI 컴포넌트, 레이아웃, 테마, 반응형 (`src/components/ui/`, `src/components/layout/`, `src/styles/`) |
| `area:data` | IndexedDB, Zustand, 검색 (`src/db/`, `src/stores/`, `src/hooks/use-documents.ts`) |
| `area:perf` | 성능, 대용량 문서, Worker (`src/workers/`, lazy loading) |
| `area:docs` | README, CONTRIBUTING, 코드 주석 |
| `area:build` | next.config, eslint, CI 워크플로우 |
| `area:i18n` | 다국어 (현재는 영어/한국어만, 추가 언어 요청 시) |

## 3차 분류: 우선순위 (severity + impact)

`priority:{critical|high|medium|low}` 라벨을 **반드시 하나** 부여.

### priority:critical
- 데이터 손실 가능성 (IndexedDB 손상, 자동저장 실패)
- 보안 취약점 (XSS, 인증 우회, 의존성 critical CVE)
- 핵심 워크플로우 완전 차단 (앱 로드 불가, 에디터 열기 불가)
- 영향 범위: 모든 사용자
- 대응 SLA: 24시간 내 응답, 7일 내 패치

### priority:high
- 자주 사용하는 기능의 명백한 버그 (HWP 임포트 실패, 검색 안 됨)
- 큰 데이터셋(1000+ 페이지)에서 페이지 프리즈
- 영향 범위: 많은 사용자
- 대응 SLA: 영업일 3일 내 응답, 30일 내 패치

### priority:medium (기본)
- 특정 조건에서만 발생하는 버그
- 유용한 기능 요청 (스펙 부합)
- 영향 범위: 일부 사용자
- 대응 SLA: 영업일 7일 내 응답, 정해진 일정 없이 백로그

### priority:low
- 사소한 UI 어긋남
- nice-to-have 기능
- 영향 범위: 소수
- 대응 SLA: 응답만 보장, 패치는 기여 받음 (`good first issue`/`help wanted` 검토)

## 응답 SLA

| 라벨 | 첫 응답 | 패치 또는 결정 |
|------|--------|---------------|
| priority:critical | 24시간 | 7일 |
| priority:high | 3 영업일 | 30일 |
| priority:medium | 7 영업일 | 정해진 일정 없음 |
| priority:low | 7 영업일 | 기여 받음 |

응답이란 사람이 읽고 다음 단계를 알려주는 코멘트(분류 결과, 추가 정보 요청 등). 패치까지 가지 않아도 OK.

## 자동 close 조건

- `needs-info` + 30일 이상 사용자 응답 없음 → `stale` 라벨 → 7일 더 대기 후 close
- 명확한 duplicate → 즉시 close (원본 링크 코멘트 후)
- 명확한 wontfix → 즉시 close (사유 코멘트 후)

## 에스컬레이션 기준

curator 가 단독 판단 어려울 때:
- 스펙 부합 불명확 → architect 에 검토 요청
- HWP 변환 깊은 이슈 → hwp-engineer 위임 검토
- 보안 취약점 → SECURITY.md 채널로 이전 안내, 공개 이슈 close
- 라이선스/거버넌스 → opensource-architect 위임

## `good first issue` / `help wanted` 부여 기준

**`good first issue`:**
- 변경 범위 1~2 파일
- 명확한 재현/해결 방향
- 외부 도메인 지식 불필요

**`help wanted`:**
- 메인테이너 우선순위 낮으나 가치 있음
- 외부 기여 환영 신호

## 자주 하는 실수

- 우선순위 라벨 누락 → 백로그에서 우선순위 비교 불가
- duplicate 검색 생략 → 같은 일 두 번
- needs-info 단독 사용 → 어떤 카테고리 후보인지 모름. `bug` + `needs-info` 처럼 병행 권장
- 영역 라벨 과부여 → 핵심 1~2 개만, 모두 붙이면 의미 없음
