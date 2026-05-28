---
name: github-issue-ops
description: GitHub Issues 및 PR 을 `gh` CLI 로 다루는 운영 스킬. 이슈 조회/검색/필터, 라벨·assignee·milestone 편집, 코멘트 작성, 이슈 close/reopen, PR 생성·연결·머지, 라벨 정의·생성, 사용자/팀 알림까지 모든 GitHub 조작을 안전·재현 가능하게 수행한다. 트리거 - `gh issue`, `gh pr`, 이슈 조회, 이슈 코멘트, 이슈 라벨, PR 생성, GitHub 운영, 이슈 close, 이슈 reopen.
---

# GitHub Issue Ops — `gh` CLI 운영 패턴

GitHub Issues/PR 을 코드로 안전하게 다루는 표준 명령 모음. 모든 운영 에이전트가 공유한다.

## 핵심 원칙

1. **JSON 출력 우선** — `--json` 플래그로 구조화 출력 → 파싱 안전
2. **idempotent** — 같은 작업을 두 번 해도 부작용 최소 (라벨 추가는 중복 없음)
3. **dry-run 우선** — 처음 보는 이슈에는 먼저 view, 그다음 edit
4. **에러 코드 확인** — `gh` 명령은 실패 시 non-zero exit, 무조건 결과 체크
5. **저장소 명시** — 다른 저장소와 혼동 방지: `--repo revfactory/mdview` 권장

## 자주 쓰는 명령

### 조회

```bash
# 트리아지 대기 이슈 목록
gh issue list --repo revfactory/mdview \
  --label "needs-triage" --state open \
  --json number,title,labels,createdAt,author

# 특정 이슈 본문 + 코멘트 + 라벨
gh issue view 42 --repo revfactory/mdview \
  --json number,title,body,labels,state,comments,author,createdAt

# 검색 (중복 탐지)
gh issue list --repo revfactory/mdview \
  --search "HWP import 깨짐 in:title,body" --state all \
  --json number,title,state
```

### 라벨

```bash
# 라벨 추가/제거 (idempotent)
gh issue edit 42 --repo revfactory/mdview \
  --add-label "bug,priority:high,area:hwp" \
  --remove-label "needs-triage"

# 라벨 정의 (한 번만 실행, 이미 있으면 실패하므로 || true)
gh label create "priority:critical" --repo revfactory/mdview \
  --color B60205 --description "최우선 처리" 2>/dev/null || true
gh label create "area:hwp" --repo revfactory/mdview \
  --color 0E8A16 --description "HWP/HWPX 관련" 2>/dev/null || true
```

### 코멘트

```bash
# 코멘트 게시 (긴 본문은 파일로)
gh issue comment 42 --repo revfactory/mdview --body-file /tmp/response.md

# 짧은 코멘트
gh issue comment 42 --repo revfactory/mdview --body "보고 감사합니다. 재현 시도 중입니다."
```

### close/reopen

```bash
# duplicate close
gh issue close 42 --repo revfactory/mdview --reason "not planned" \
  --comment "#10 의 중복입니다. 해당 이슈에서 추적합니다."

# 일반 close (해결됨)
gh issue close 42 --repo revfactory/mdview --reason completed

# reopen
gh issue reopen 42 --repo revfactory/mdview --comment "재현됨, 재오픈합니다."
```

### Assignee / Milestone

```bash
gh issue edit 42 --repo revfactory/mdview --add-assignee revfactory
gh issue edit 42 --repo revfactory/mdview --milestone "v0.2.0"
```

### PR 생성·연결

```bash
# 브랜치 푸시 후 PR 생성
git push origin fix/issue-42-hwp-rotation
gh pr create --repo revfactory/mdview \
  --base main --head fix/issue-42-hwp-rotation \
  --title "fix(hwp): 이미지 90도 회전 수정" \
  --body-file /tmp/pr_body.md

# 이슈 자동 close 키워드: Closes #42, Fixes #42, Resolves #42
# (PR 본문에 포함 필수)
```

### PR 리뷰·머지

```bash
gh pr edit {N} --repo revfactory/mdview --add-reviewer revfactory
gh pr merge {N} --repo revfactory/mdview --squash --delete-branch
```

## JSON 파싱 패턴

```bash
# 이슈 번호만 추출
gh issue list --label "needs-triage" --json number --jq '.[].number'

# 본문에서 키워드 매칭
gh issue view 42 --json body --jq '.body | contains("HWP")'

# 코멘트 작성자/시각 목록
gh issue view 42 --json comments --jq '.comments[] | {author: .author.login, createdAt}'
```

## 라벨 표준 (MDView)

기본 (생성됨):
- 종류: `bug`, `enhancement`, `question`, `documentation`, `duplicate`, `wontfix`
- 상태: `needs-triage`, `needs-info`
- 메타: `dependencies`, `good first issue`, `help wanted`

추가 (필요 시 생성):
- 우선순위: `priority:critical` (#B60205), `priority:high` (#D93F0B), `priority:medium` (#FBCA04), `priority:low` (#0E8A16)
- 영역: `area:editor`, `area:hwp`, `area:ui`, `area:data`, `area:perf`, `area:docs`

색상 권장: GitHub 표준 팔레트 (https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels)

## 에러 패턴

| 증상 | 원인 | 대응 |
|------|------|------|
| `gh: command not found` | gh 미설치 | `brew install gh` 또는 사용자에게 안내 |
| `authentication required` | gh 인증 만료 | `gh auth login` 안내 |
| `Could not resolve to a Label` | 라벨 미존재 | `gh label create` 로 먼저 생성 |
| `pull request created from a fork` | fork 권한 | base/head 명시 확인 |
| rate limit | API 한도 | 1분 대기 후 재시도, 또는 작업 batch |

## 보안 / 위험 작업

다음은 **사용자 확인 후 실행**:
- `gh issue close` 다수 일괄 (실수 시 복구 어려움)
- `gh pr merge` (push 권한, 머지 후 revert 가능하지만 비용)
- `gh label delete` (다른 이슈의 라벨 잃음)
- `gh repo edit --visibility private` (절대 금지)

## 인용 시점

- issue-curator: 라벨·코멘트·close
- issue-reproducer: 본문/첨부 조회
- issue-responder: 코멘트 게시
- issue-patcher: PR 생성·머지

## 자주 하는 실수

- `--repo` 누락 → 다른 저장소에 잘못 실행될 위험 (특히 `gh repo set-default` 안 했을 때)
- 라벨 미존재 상태에서 add → 실패. 먼저 `gh label list` 로 확인
- close reason 누락 → "completed" vs "not planned" 구분 명시 권장
- PR 본문에 `Closes #N` 누락 → 머지해도 이슈 안 닫힘
