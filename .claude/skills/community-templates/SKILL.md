---
name: community-templates
description: 오픈소스 커뮤니티 표준 문서·템플릿 작성 스킬. CONTRIBUTING.md, CODE_OF_CONDUCT.md(Contributor Covenant 2.1), SECURITY.md, GitHub 이슈 템플릿(bug/feature/question), PR 템플릿을 프로젝트 컨텍스트에 맞춰 생성한다. 트리거 - 기여 가이드 작성, 행동 규약, 이슈 템플릿, PR 템플릿, 보안 정책, 커뮤니티 표준 문서, .github 폴더 구성.
---

# Community Templates

오픈소스 커뮤니티가 안전·명확·일관되게 운영되도록 표준 문서들을 만든다.

## 산출물 목록

| 파일 | 채택 표준 | 핵심 내용 |
|------|----------|----------|
| CONTRIBUTING.md | Conventional Commits, GitHub Flow | 개발 셋업, PR 절차, 커밋 컨벤션, 코드 스타일 |
| CODE_OF_CONDUCT.md | Contributor Covenant 2.1 | 기대 행동, 신고 경로, 집행 가이드 |
| SECURITY.md | GitHub Private Vulnerability Reporting | 신고 채널, 응답 SLA, 지원 버전 |
| .github/ISSUE_TEMPLATE/bug_report.md | GitHub Issue Forms 호환 마크다운 | 재현 절차, 환경, 기대/실제 동작 |
| .github/ISSUE_TEMPLATE/feature_request.md | 동일 | 동기, 제안, 대안, 참고 자료 |
| .github/ISSUE_TEMPLATE/question.md | 동일 | 사용자 질문 분리 채널 |
| .github/ISSUE_TEMPLATE/config.yml | GitHub 표준 | blank_issues_enabled, contact_links |
| .github/PULL_REQUEST_TEMPLATE.md | — | 변경 요약, 관련 이슈, 체크리스트 |

## 작성 원칙

- **표준을 가공하지 말고 채택하라** — CoC는 Contributor Covenant 원문 번역을 사용, 임의 작성 금지.
- **기여 마찰 최소화** — 처음 PR을 여는 사람도 5분 안에 셋업 가능하도록.
- **체크리스트는 강제가 아닌 가이드** — PR 템플릿의 체크박스는 "필수 확인"이 아닌 "확인하면 좋은 것".
- **신고 채널은 분리** — 보안은 공개 이슈가 아닌 비공개 채널(GitHub Security Advisories 또는 이메일).

## CONTRIBUTING.md 표준 구조

```markdown
# {프로젝트명}에 기여하기

## 개발 환경 셋업
1. Node.js {버전} 설치
2. `git clone ... && cd ...`
3. `npm install`
4. `npm run dev`

## 브랜치 전략
- main: 안정 브랜치, 보호됨
- feat/*: 기능 추가
- fix/*: 버그 수정
- docs/*: 문서 변경

## 커밋 컨벤션 (Conventional Commits)
- `feat: 새 기능`
- `fix: 버그 수정`
- `docs: 문서 변경`
- `refactor: 리팩터링`
- `chore: 빌드/도구`

## PR 절차
1. 이슈 먼저 (큰 변경은 이슈에서 설계 합의)
2. fork → branch → commit → push → PR
3. CI 통과 확인 (lint, typecheck, build)
4. 리뷰 반영 후 merge (squash merge 권장)

## 코드 스타일
- ESLint 규칙 준수 (`npm run lint`)
- TypeScript strict 모드
- 함수형 React 컴포넌트
- {프로젝트 특화 규칙}

## 테스트
- {테스트 도구 / 명령}

## CHANGELOG
- 사용자 영향 변경은 CHANGELOG.md의 `[Unreleased]` 섹션에 항목 추가
```

## CODE_OF_CONDUCT.md

Contributor Covenant 2.1 한국어 공식 번역을 사용한다. 출처: https://www.contributor-covenant.org/ko/version/2/1/code_of_conduct/

- 임의 수정 금지
- 신고 채널(Enforcement) 부분만 프로젝트별로 교체

## SECURITY.md 표준 구조

```markdown
# 보안 정책

## 지원 버전
| 버전 | 보안 패치 |
|------|----------|
| 0.x  | ✅ (현재) |

## 취약점 신고
공개 이슈로 보고하지 마세요. 다음 채널 사용:

1. **GitHub Security Advisories (권장)**: [신고 링크](https://github.com/{owner}/{repo}/security/advisories/new)
2. **이메일**: {security email}

## 응답 SLA
- 접수 확인: 영업일 기준 3일 이내
- 영향 평가: 14일 이내
- 패치 릴리즈: 영향도에 따라 30~90일

## 책임 있는 공개
패치 릴리즈 전까지 비공개 유지를 부탁드립니다. 공개 시 신고자를 credit합니다.
```

## 이슈 템플릿

YAML frontmatter 표준:
```markdown
---
name: 버그 신고
about: 재현 가능한 버그를 신고합니다
title: "[Bug] "
labels: ["bug", "needs-triage"]
assignees: []
---
```

## config.yml

```yaml
blank_issues_enabled: false
contact_links:
  - name: 🔒 보안 취약점
    url: https://github.com/{owner}/{repo}/security/advisories/new
    about: 비공개 보안 신고 채널입니다.
  - name: 📖 문서 (README)
    url: https://github.com/{owner}/{repo}#readme
    about: 설치·사용법은 먼저 README 를 확인해 주세요.
```

> 프로젝트가 GitHub Discussions 를 사용하지 않는다면 contact_links 에서 제거하고, 질문은 Issues `question` 템플릿으로 통일한다.

## PR 템플릿 표준 구조

```markdown
## 변경 요약
{무엇을 바꿨는지 한 문단}

## 관련 이슈
Closes #...

## 변경 유형
- [ ] 버그 수정
- [ ] 새 기능
- [ ] 리팩터링
- [ ] 문서
- [ ] 기타

## 체크리스트
- [ ] `npm run lint` 통과
- [ ] `npm run build` 통과
- [ ] 관련 문서 업데이트
- [ ] CHANGELOG 항목 추가 (사용자 영향 변경 시)

## 스크린샷 (UI 변경 시)
```

## 작성 워크플로우

1. `_workspace/oss/01_architect_decisions.md` 에서 보안 채널·repo URL 읽기
2. `package.json` 에서 dev/build/lint 스크립트 추출 → CONTRIBUTING.md에 주입
3. Contributor Covenant 2.1 한국어 번역 본문을 CODE_OF_CONDUCT.md로 작성
4. `.github/` 하위 6개 파일 작성
5. `_workspace/oss/03_community_engineer_report.md` 에 작성 결과 + anchor 목록 정리

## 자주 하는 실수

- CoC를 임의로 작성 → Covenant 표준 채택 필수
- 보안 채널이 공개 이슈 → 비공개 채널 필수
- 이슈 템플릿에 너무 많은 필수 필드 → 마찰 증가, 핵심만 남길 것
- PR 템플릿에 강제 체크박스 → "권장"으로 표현
