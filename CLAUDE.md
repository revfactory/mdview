# MDView — Claude Code Project Pointer

이 파일은 새 세션마다 로드되어, 어떤 하네스가 활성화되어 있는지 Claude에게 알립니다. 에이전트·스킬의 상세는 `.claude/` 디렉토리에서 관리됩니다.

---

## 하네스: MDView 개발

**목표:** TipTap WYSIWYG + HWP 브릿지 + 대용량 문서 처리 기반의 한글 친화 마크다운 에디터를 단계적으로 구축·유지보수한다.

**트리거:** 프로젝트 빌드/구축, 기능 구현, 이슈 분석/수정, 성능 최적화, UI/UX 폴리싱 관련 작업 요청 시 `mdview-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**핵심 참조:**
- 프로젝트 스펙: `MDVIEW_SPEC.md` (Single Source of Truth)
- 에이전트 정의: `.claude/agents/{architect,editor-engineer,hwp-engineer,ui-engineer,data-engineer,qa-engineer,design-reviewer,ux-designer,image-engineer,table-engineer,seo-engineer,issue-analyst,issue-fixer}.md`
- 스킬 정의: `.claude/skills/{mdview-orchestrator,data-layer,editor-setup,hwp-bridge,ui-system,perf-optimize,design-filter,ux-polish,table-image-pipeline,large-doc-perf,paginated-editor,issue-triage,seo-optimize,sample-document}/`

---

## 하네스: OSS 공개 준비

**목표:** MDView를 GitHub 오픈소스로 안전·완전하게 공개하기 위한 거버넌스·문서·CI·릴리즈 인프라를 자동 구축한다.

**트리거:** "오픈소스 공개", "OSS 준비", "README/CONTRIBUTING/CHANGELOG/SECURITY 작성", "GitHub Actions 워크플로우", "Dependabot", "릴리즈 정책" 관련 작업 요청 시 `oss-orchestrator` 스킬을 사용하라.

**핵심 참조:**
- 결정 사항: `_workspace/oss/01_architect_decisions.md` (프로젝트명·tagline·repo URL·라이선스·badge 전략)
- 에이전트 정의: `.claude/agents/{opensource-architect,docs-writer,community-engineer,ci-engineer,release-manager}.md`
- 스킬 정의: `.claude/skills/{oss-orchestrator,readme-craft,community-templates,github-workflows,release-policy}/`

**산출물 위치:**
- `README.md`, `README.en.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CHANGELOG.md`
- `.github/` (workflows/, ISSUE_TEMPLATE/, PULL_REQUEST_TEMPLATE.md, CODEOWNERS, dependabot.yml)
- `docs/screenshots/`

---

## 프로젝트 컨벤션

- **커밋 메시지:** 한국어 OK (사용자 기존 스타일 존중), Conventional Commits 권장
- **브랜치 전략:** GitHub Flow (`main` + feature branches)
- **언어:** TypeScript strict, React 19 함수형 컴포넌트
- **라이선스:** Apache-2.0

---

## 변경 이력

| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-05-28 | OSS 공개 하네스 신규 구축 (에이전트 5, 스킬 5, 오케스트레이터) | `.claude/agents/{opensource-architect,docs-writer,community-engineer,ci-engineer,release-manager}.md` + `.claude/skills/{oss-orchestrator,readme-craft,community-templates,github-workflows,release-policy}/` | 프로젝트 오픈소스 공개 자동화 요청 |
| 2026-05-28 | OSS 산출물 1차 생성 (README 이중언어, CONTRIBUTING, CoC, SECURITY, CHANGELOG, .github/* 전체) | 프로젝트 루트 + `.github/` + `docs/screenshots/` | oss-orchestrator 초기 실행 |
| 2026-05-28 | package.json 메타데이터 정비 (name `mdview-temp`→`mdview`, description/keywords/repository/homepage/bugs/author 추가, typecheck 스크립트 추가) | `package.json` | OSS 공개 표준화 |
| 2026-05-28 | CLAUDE.md 초기 작성 (MDView 개발 + OSS 공개 두 하네스 포인터 등록) | `CLAUDE.md` | 신규 세션에 하네스 가시화 |
| 2026-05-28 | GitHub Discussions 미사용으로 정책 변경 (질문·신고 채널 Issues + Security Advisories로 통합) | README/CONTRIBUTING/CoC/.github/ISSUE_TEMPLATE + community-engineer 에이전트 + community-templates 스킬 | 사용자 피드백: "토론기능은 쓰지 않을 예정" |
