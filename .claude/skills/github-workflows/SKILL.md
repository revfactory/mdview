---
name: github-workflows
description: GitHub Actions CI/CD 워크플로우 작성 스킬. CI(lint/typecheck/build), CodeQL 보안 스캔, Dependabot 자동 업데이트, 릴리즈 자동화 워크플로우를 작성한다. Next.js + TypeScript + npm 프로젝트에 최적화. 트리거 - GitHub Actions, CI 워크플로우, codeql, dependabot, 빌드 자동화, 깃허브 워크플로우, .github/workflows.
---

# GitHub Workflows

OSS 프로젝트의 자동 품질 게이트를 GitHub Actions로 구성한다.

## 작성 원칙

1. **빠른 피드백**: PR이 열렸을 때 5분 이내 결과. npm cache, Next.js cache 적극 활용.
2. **재현 가능성**: Node 버전 고정, `npm ci`로 lockfile 기반 설치.
3. **최소 권한**: 워크플로우의 `permissions:` 를 명시적으로 좁힌다.
4. **잡 이름 안정**: 잡 이름은 브랜치 보호 규칙에서 참조되므로 함부로 바꾸지 않는다.

## CI 워크플로우 (ci.yml)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          NEXT_TELEMETRY_DISABLED: 1
```

**설계 포인트:**
- `lint`, `typecheck`, `build` 3개 잡으로 분리하여 병렬 실행 + 어떤 단계에서 실패했는지 한눈에.
- `concurrency` 로 같은 PR에 새 푸시가 오면 이전 실행 취소.
- `npm ci` 는 `package-lock.json` 강제 사용.
- Next.js telemetry 비활성화.

## CodeQL 보안 스캔 (codeql.yml)

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 6 * * 1"  # 매주 월요일 06:00 UTC

permissions:
  actions: read
  contents: read
  security-events: write

jobs:
  analyze:
    name: Analyze (${{ matrix.language }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        language: [javascript-typescript]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: security-extended
      - uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

## Dependabot 설정 (dependabot.yml)

`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: "09:00"
      timezone: Asia/Seoul
    open-pull-requests-limit: 10
    groups:
      tiptap:
        patterns: ["@tiptap/*"]
      react:
        patterns: ["react", "react-dom", "@types/react", "@types/react-dom"]
      types:
        patterns: ["@types/*"]
      dev-dependencies:
        dependency-type: development
    labels:
      - dependencies
    commit-message:
      prefix: chore
      include: scope

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
    labels:
      - dependencies
      - github-actions
    commit-message:
      prefix: chore(actions)
```

**설계 포인트:**
- TipTap 확장이 16개라 묶어서 받지 않으면 PR이 너무 많아짐 → `groups` 사용.
- React 19 + types도 묶어야 한 번에 메이저 업데이트 가능.
- 매주 월요일 한국 시간 오전 9시(주간 회고/리뷰 적절).

## 릴리즈 워크플로우 (release.yml, 선택)

```yaml
name: Release

on:
  push:
    tags:
      - "v*.*.*"

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          draft: false
          prerelease: ${{ contains(github.ref_name, '-') }}
```

**설계 포인트:**
- 태그 `v0.1.0` 푸시 → 자동 릴리즈 노트 + GitHub Release 생성.
- 프리릴리즈 태그(`v0.1.0-rc.1`)는 자동으로 prerelease로 마킹.

## Badge URL 출력

CI 워크플로우 완성 후 docs-writer에게 다음 badge URL 전달:

```markdown
[![CI](https://github.com/{owner}/{repo}/actions/workflows/ci.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/ci.yml)
[![CodeQL](https://github.com/{owner}/{repo}/actions/workflows/codeql.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/codeql.yml)
```

## 작성 워크플로우

1. `_workspace/oss/01_architect_decisions.md` 에서 repo URL, Node 버전 확인
2. `package.json` 에서 lint/build 스크립트 검증
3. `.github/workflows/ci.yml` 작성
4. `.github/workflows/codeql.yml` 작성
5. `.github/dependabot.yml` 작성
6. (선택) `.github/workflows/release.yml` 작성
7. YAML 문법 검증 (들여쓰기, anchor, key 중복 없음)
8. `_workspace/oss/04_ci_engineer_report.md` 에 badge URL과 잡 이름 목록 기록

## 자주 하는 실수

- `npm install` 사용 → lockfile 무시. `npm ci` 사용 필수.
- `permissions:` 누락 → 기본값이 너무 넓음.
- 잡 이름 변경 → 브랜치 보호 규칙 깨짐.
- Dependabot 그룹 미설정 → PR 폭증 (TipTap 확장이 한 번에 16개씩 옴).
