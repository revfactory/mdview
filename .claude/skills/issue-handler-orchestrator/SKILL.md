---
name: issue-handler-orchestrator
description: MDView GitHub Issues 처리 총괄 오케스트레이터. 신규 이슈 fetch·분류·라벨링·재현·응답·패치 PR 생성까지의 전체 워크플로우를 4인 팀(curator/reproducer/responder/patcher)으로 자동 수행한다. 단건(`#N 처리`)과 배치(`needs-triage 모두`) 모두 지원. 트리거 - 이슈 처리, 새 이슈 처리, GitHub 이슈 트리아지, 이슈 분류 시작, 이슈 큐 청소, #N 처리해줘, 이슈 패치, 이슈 응답, 이슈 다시 처리, 이슈 재분류, 이슈 우선순위 조정, 이슈 close, 이슈 reopen, 트리아지 다시.
---

# Issue Handler Orchestrator — GitHub Issues 처리 총괄

MDView 저장소(`revfactory/mdview`)에 등록된 이슈를 받아 분류부터 패치 PR까지 전 단계를 자동화하는 오케스트레이터.

## 팀 구성

| 에이전트 | 책임 | 스킬 |
|---------|------|------|
| **issue-curator** (리더) | 이슈 fetch, 분류, 라벨링, 우선순위, 팀 조율 | github-issue-ops, issue-triage-policy |
| **issue-reproducer** | 버그 재현, 환경 확인, 원인 가설 | github-issue-ops |
| **issue-responder** | 사용자 응답 코멘트 작성·게시 | github-issue-ops, issue-response-templates |
| **issue-patcher** | 코드 수정 + PR 생성 + 이슈 연결 | github-issue-ops |

**실행 모드:** 에이전트 팀 (4명, 중규모 작업).
**모델:** 모두 `opus`.

## Phase 0: 컨텍스트 확인

워크플로우 시작 시:
- `_workspace/issues/{N}/` 미존재 → **초기 처리**
- `_workspace/issues/{N}/` 존재 + 사용자가 재처리 요청 → **재처리** (기존 산출물을 `_workspace/issues/{N}_prev/`로 이동)
- `_workspace/issues/{N}/` 존재 + 사용자가 부분 변경 (예: "응답만 다시") → **부분 재실행** (해당 에이전트만)

## 처리 모드

### 단건 모드
사용자: `#42 처리해줘` / `이슈 42번 봐줘` / `42번 답변 작성`

→ 해당 이슈만 Phase 1~4 수행

### 배치 모드
사용자: `새 이슈 모두 분류` / `needs-triage 전부 처리` / `트리아지 큐 청소`

→ `gh issue list --label needs-triage` 로 가져온 모든 이슈를 단건 모드로 순차 처리

## Phase 1: 트리아지 (issue-curator)

1. **이슈 fetch** — `gh issue view {N} --json number,title,body,labels,author,createdAt,comments`
2. **중복 검색** — 본문 키워드로 `gh issue list --search` → 유사 이슈 발견 시 duplicate 후보
3. **분류** — `issue-triage-policy` 스킬의 카테고리/영역/우선순위 결정
4. **라벨 적용** — `bug|enhancement|...` + `area:*` + `priority:*` 추가, `needs-triage` 제거
5. **분기 결정** — 다음 Phase 의 담당자 지명
6. **첫 코멘트(선택)** — 큰 변경 없으면 분류 결과를 알리는 코멘트는 responder 에 위임

산출물: `_workspace/issues/{N}/triage.md`

## Phase 2: 분기 처리 (병렬 가능)

분류 결과에 따라 다른 워크플로우:

### 🐛 bug 경로
1. **reproducer** — 재현 시도, `_workspace/issues/{N}/repro.md` 생성
   - **재현 성공** → patcher 로 진행
   - **재현 실패** → responder 가 추가 정보 요청
2. **patcher** — 코드 수정, PR 생성, `_workspace/issues/{N}/patch.md` 생성
3. **responder** — PR 알림 코멘트 (템플릿 5)

### 💡 enhancement 경로
1. **responder** — 검토 의견 작성 (템플릿 4)
2. (사용자/메인테이너 승인 시) **patcher** — 구현 + PR
3. **responder** — PR 알림 코멘트

### ❓ question 경로
1. **responder** — 답변 작성 (템플릿 3)
2. (필요 시) **curator** — `question` 만 남기고 close

### 🔁 duplicate / 🚫 wontfix 경로
1. **curator** — 직접 사유 코멘트 (템플릿 6a/6b) + close

### 📋 needs-info 경로
1. **responder** — 추가 정보 요청 (템플릿 2)
2. (사용자 응답 대기, 30일 후 stale → close 자동화 별도)

## Phase 3: 결과 종합 (issue-curator)

1. 모든 산출물 확인
2. 이슈 상태 최종 확인 (라벨/assignee/milestone)
3. `_workspace/issues/{N}/summary.md` 작성 (감사 추적용)
4. 사용자에게 처리 결과 보고

## 데이터 전달 프로토콜

- **태스크 기반**: `TaskCreate` 로 Phase 2 분기마다 작업 등록 (예: "이슈 #42 재현 → 패치 → 알림")
- **파일 기반**: `_workspace/issues/{N}/` 하위에 `triage.md` → `repro.md` → `patch.md` → `response.md` → `summary.md` 순서로 누적
- **메시지 기반**: 팀원 간 `SendMessage` 로 실시간 조율

## 에러 핸들링

| 에러 | 전략 |
|------|------|
| `gh` 인증 만료 | 사용자에게 `gh auth login` 안내, 작업 중단 |
| 이슈 번호 잘못됨 / 삭제됨 | 보고 후 다음 이슈 (배치 모드) 또는 종료 (단건) |
| 재현 환경 구축 불가 | reproducer 한계 명시, patcher 가 코드 분석만으로 진행 시도, 실패 시 needs-info 로 전환 |
| 패치 빌드 실패 (3회 재시도 후) | curator/architect 에 에스컬레이트, PR 생성 보류 |
| 분류 모호 | reproducer 사전 검토 요청, 그래도 모호 시 사용자에게 질문 |
| 신고자 비활성 (30일) | responder 가 `stale` 라벨 추가 검토, 7일 후 close |

## 산출물 체크리스트 (이슈 1건당)

- [ ] `_workspace/issues/{N}/triage.md` (분류 결과)
- [ ] GitHub 라벨 적용 (`bug|enhancement|...` + `area:*` + `priority:*`, `needs-triage` 제거)
- [ ] (bug) `_workspace/issues/{N}/repro.md`
- [ ] (bug/enhancement) `_workspace/issues/{N}/patch.md` + PR URL
- [ ] `_workspace/issues/{N}/response.md` (사용자 코멘트 본문)
- [ ] GitHub Issue 에 최소 1회 코멘트 게시
- [ ] `_workspace/issues/{N}/summary.md` (전체 흐름 요약)

## 테스트 시나리오

### 정상 흐름 (버그 + 재현 성공)
1. 사용자: `#42 처리해줘`
2. curator: fetch → `bug` + `area:hwp` + `priority:high` 라벨, needs-triage 제거
3. reproducer: dev 서버에서 절차 따라가 재현 성공, 원인 가설 `src/lib/hwp-converter.ts:142`
4. patcher: `fix/issue-42-hwp-rotation` 브랜치 → 수정 → lint/typecheck/build 통과 → PR #43 (`Closes #42`)
5. responder: 이슈 #42 에 "PR #43 생성됨, 다음 릴리즈 포함 예정" 코멘트
6. curator: summary.md 작성, 사용자에 보고

### 에러 흐름 (재현 실패 → needs-info)
1. 사용자: `#50 처리해줘`
2. curator: `bug` 분류
3. reproducer: 환경 변경하며 시도했으나 재현 불가
4. curator → responder: "추가 정보 요청 필요"
5. responder: 템플릿 2로 환경·재현절차·콘솔로그 요청 코멘트, `needs-info` 라벨 추가
6. curator: summary.md 작성, "신고자 응답 대기" 상태로 종료

## 후속 작업 지원

- **사용자 응답 도착 후 재처리**: `#42 신고자 응답 확인 후 다시 처리` → 기존 `_workspace/issues/42/` 보존하고 새 응답 반영
- **PR 리뷰 반영**: `PR #43 에 리뷰 반영` → patcher 만 재호출, 같은 브랜치에 추가 커밋
- **분류 변경**: `#50 우선순위 high로 올려` → curator 만 재호출, 라벨 변경 + 사유 코멘트
- **응답만 다시**: `#42 응답 톤 더 친절하게 다시` → responder 만 재호출, 이전 응답 위에 후속 코멘트

## 참조

- `MDVIEW_SPEC.md` — 기능 범위 / out_of_scope / future_considerations
- `CONTRIBUTING.md` — 커밋·브랜치·PR 규칙
- `SECURITY.md` — 보안 신고는 이 워크플로우 밖, Security Advisories 채널로 안내
- 기존 도메인 에이전트(ui-engineer/editor-engineer/hwp-engineer 등) — patcher 가 복잡 영역 위임 시
