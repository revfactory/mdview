---
name: oss-orchestrator
description: MDView 오픈소스 공개 준비 총괄 오케스트레이터. README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG, GitHub 이슈/PR 템플릿, CI/CD 워크플로우, Dependabot, 배지를 한꺼번에 구축한다. 트리거 - 오픈소스 공개, OSS 공개 준비, 깃허브 공개, 오픈소스 셋업, OSS 빌드, 오픈소스 구성 자동화, 공개 체크리스트, README 만들어, .github 폴더 만들어, 기여 가이드, 라이선스 셋업, 오픈소스 다시 실행, OSS 업데이트, 공개 보완, OSS 부분 재실행, 오픈소스 수정, 공개 자료 갱신.
---

# OSS Orchestrator — 오픈소스 공개 자동화 총괄

MDView를 GitHub 오픈소스로 공개하기 위한 모든 거버넌스·문서·CI·릴리즈 인프라를 5인 전문가 팀으로 자동 구축한다.

## 팀 구성

| 에이전트 | 책임 | 스킬 |
|---------|------|------|
| **opensource-architect** | 총괄, 네이밍, package.json 메타, badge 전략, 거버넌스 | — |
| **docs-writer** | README.md (한국어 + 영어) | readme-craft |
| **community-engineer** | CONTRIBUTING, CoC, SECURITY, 이슈/PR 템플릿 | community-templates |
| **ci-engineer** | GitHub Actions (CI/CodeQL/Release), Dependabot | github-workflows |
| **release-manager** | CHANGELOG, semver 정책, 릴리즈 절차 | release-policy |

**실행 모드:** 에이전트 팀 (TeamCreate + SendMessage + TaskCreate). 5명, 중규모 작업 적합.

## 사용 모델

모든 Agent 호출 시 `model: "opus"` 명시.

## Phase 0: 컨텍스트 확인

워크플로우 시작 시 다음을 확인하여 실행 모드 결정:

- `_workspace/oss/` 미존재 → **초기 실행**
- `_workspace/oss/` 존재 + 사용자가 부분 수정 요청 (예: "README만 다시") → **부분 재실행** (해당 에이전트만 호출)
- `_workspace/oss/` 존재 + 사용자가 새 입력/큰 변경 → **새 실행** (기존 _workspace를 `_workspace_prev/`로 이동)

## Phase 1: 아키텍처 결정 (순차)

**실행 모드:** 단일 에이전트 (opensource-architect)

opensource-architect가 다음을 결정·기록:

1. **프로젝트 정체성**
   - 공식명, tagline (한·영)
   - GitHub repo URL (`{owner}/{repo}`)
   - 카테고리 키워드 (markdown editor, hwp, korean, wysiwyg, ...)

2. **메타데이터 정비** (package.json 직접 수정)
   - `name`: `mdview-temp` → `mdview` (또는 결정된 이름)
   - `description`, `keywords`, `repository`, `homepage`, `bugs`, `author`, `license`
   - `private: true` 제거 (oss 공개 의도이므로) — 단 npm publish 의도 없으면 유지 가능

3. **거버넌스 결정**
   - 라이선스: Apache-2.0 (기존 유지 확인)
   - CODEOWNERS: 메인테이너 GitHub 핸들 지정
   - 보안 신고 채널: GitHub Security Advisories (권장) + 이메일 백업

4. **사전 감사**
   - 비밀키/토큰 잔존 여부 (`grep -r "sk-" src/`, `.env*` 파일 확인)
   - 의존성 라이선스 호환성 (Apache-2.0와 호환)
   - 내부 식별자/개인정보 점검 (kakaocorp 도메인 노출 등)

5. 산출물: `_workspace/oss/01_architect_decisions.md`

## Phase 2: 분산 작업 (팬아웃 병렬)

**실행 모드:** 4명 팀 병렬

`TeamCreate` 로 4명 팀 구성. 각자 `_workspace/oss/01_architect_decisions.md` 를 입력으로 사용.

| 작업 | 담당 | 출력 |
|------|------|------|
| README.md + README.en.md 작성 | docs-writer | `프로젝트/README.md`, `README.en.md`, `docs/screenshots/.gitkeep` |
| CONTRIBUTING, CoC, SECURITY, 이슈/PR 템플릿 | community-engineer | `프로젝트/CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md` |
| CI/CodeQL/Dependabot 워크플로우 | ci-engineer | `.github/workflows/ci.yml`, `codeql.yml`, `.github/dependabot.yml` |
| CHANGELOG + 릴리즈 정책 | release-manager | `프로젝트/CHANGELOG.md`, (선택) `docs/RELEASE.md`, `.github/workflows/release.yml` |

**팀 통신 흐름:**
- ci-engineer → docs-writer: CI badge URL 전달 (README 상단에 노출)
- release-manager → docs-writer: CHANGELOG anchor (README 링크용)
- community-engineer → docs-writer: CONTRIBUTING anchor
- community-engineer ↔ ci-engineer: PR 통과 기준 정합성 교차 확인

## Phase 3: 통합 검증 (순차)

**실행 모드:** 단일 에이전트 (opensource-architect)

1. **파일 존재 검증** — 모든 산출물 경로에 파일이 실재하는지 확인
2. **링크 검증** — README의 CONTRIBUTING/CHANGELOG/LICENSE 링크가 실재 파일 가리킴
3. **Badge 검증** — CI workflow 이름과 README badge URL의 워크플로우 이름이 일치
4. **이중언어 정합** — README.md ↔ README.en.md 섹션 구조 일치
5. **CLAUDE.md 변경 이력 갱신** — OSS 공개 준비 완료 기록
6. **최종 보고** — 사용자에게 공개 체크리스트와 다음 액션(`git remote add`, `git push`, GitHub 저장소 생성) 안내

## 데이터 전달 프로토콜

- **태스크 기반**: `TaskCreate` 로 Phase 2 작업 4개 등록, 의존 관계는 모두 Phase 1 산출물에 의존
- **파일 기반**: `_workspace/oss/` 하위에 중간 산출물, 프로젝트 루트에 최종 산출물
- **메시지 기반**: 팀원 간 교차 확인은 `SendMessage`

## 에러 핸들링

| 에러 | 전략 |
|------|------|
| Phase 1 architect 결정 누락 | 사용자에게 즉시 질문, 다른 Phase 진행 보류 |
| 비밀키/토큰 발견 | 작업 중단, 사용자 확인 필수 |
| Phase 2 에이전트 1명 실패 | 1회 재시도, 재실패 시 해당 산출물 없이 진행 (보고서에 누락 명시) |
| 외부 링크 검증 실패 (badge) | 1회 재시도, 실패 시 임시 placeholder + 사용자에게 알림 |
| 라이선스 충돌 | 사용자에게 보고, 결정 요청 |

## 산출물 체크리스트

Phase 3 종료 시 다음을 확인:

- [ ] `README.md` (한국어, 배지·기능·Quickstart·Tech Stack)
- [ ] `README.en.md` (영어, 동일 골격)
- [ ] `LICENSE` (Apache-2.0, 이미 존재)
- [ ] `CONTRIBUTING.md`
- [ ] `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1)
- [ ] `SECURITY.md`
- [ ] `CHANGELOG.md` (Keep a Changelog 1.1)
- [ ] `.github/ISSUE_TEMPLATE/bug_report.md`
- [ ] `.github/ISSUE_TEMPLATE/feature_request.md`
- [ ] `.github/ISSUE_TEMPLATE/question.md`
- [ ] `.github/ISSUE_TEMPLATE/config.yml`
- [ ] `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] `.github/workflows/ci.yml`
- [ ] `.github/workflows/codeql.yml`
- [ ] `.github/dependabot.yml`
- [ ] `.github/CODEOWNERS` (선택)
- [ ] `docs/screenshots/.gitkeep`
- [ ] `package.json` 메타 정비 (name, description, repository, keywords, ...)

## 테스트 시나리오

**정상 흐름:**
1. 사용자: "오픈소스로 공개할 준비 해줘"
2. Phase 1: architect가 `mdview` 이름, `revfactory/mdview` repo URL 결정 + 사전 감사 통과
3. Phase 2: 4개 팀원 병렬 작업, 모두 성공
4. Phase 3: 통합 검증 통과, 체크리스트 완료
5. 사용자에게 "GitHub repo 생성 → `git remote add origin ...` → `git push -u origin main`" 안내

**에러 흐름:**
1. 사용자: "오픈소스 공개 준비"
2. Phase 1: architect가 src/에서 토큰처럼 보이는 문자열 발견
3. Orchestrator: Phase 2 진행 보류, 사용자에게 확인 요청
4. 사용자: "그건 예시 토큰일 뿐 안전해" → 작업 계속
5. (또는) 사용자: "맞아, 제거할게" → 사용자가 제거 후 재시도

## 후속 작업 지원

- **부분 재실행**: "README만 다시 작성해줘" → docs-writer만 호출, 다른 산출물 보존
- **신규 보강**: "이슈 템플릿에 'docs' 카테고리 추가해줘" → community-engineer만 호출
- **검증 재실행**: "공개 전 마지막 점검" → opensource-architect Phase 3만 실행

각 에이전트는 자기 산출물이 이미 존재하면 읽고 개선점만 반영한다 (전체 재작성 X).

## 참조

- `_workspace/oss/` — 중간 산출물 (감사 추적용 보존)
- `MDVIEW_SPEC.md` — 기능 추출 원본
- `package.json` — 의존성·스크립트 진실
- `LICENSE` — Apache-2.0 (이미 적용됨)
