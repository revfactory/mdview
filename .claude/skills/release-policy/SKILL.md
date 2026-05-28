---
name: release-policy
description: 오픈소스 버전 관리 정책·CHANGELOG 작성 스킬. Keep a Changelog 1.1 포맷, Semantic Versioning 2.0.0 정책, 사전 1.0 단계 가이드, 릴리즈 절차 문서를 작성한다. 트리거 - 릴리즈 정책, 버전 관리, CHANGELOG 작성, semver, 릴리즈 노트, 태그 전략, version bump.
---

# Release Policy

오픈소스 프로젝트의 버전·변경 이력·릴리즈 절차를 표준에 맞춰 정립한다.

## 채택 표준

| 영역 | 표준 |
|------|------|
| 버전 체계 | [Semantic Versioning 2.0.0](https://semver.org/lang/ko/) |
| 변경 이력 | [Keep a Changelog 1.1.0](https://keepachangelog.com/ko/1.1.0/) |
| 커밋 메시지 | [Conventional Commits 1.0](https://www.conventionalcommits.org/ko/v1.0.0/) |

## CHANGELOG.md 표준 구조

```markdown
# Changelog

이 프로젝트의 모든 주요 변경 사항이 이 파일에 기록됩니다.

이 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 기반으로 하며,
이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

## [Unreleased]
### Added
- (예정 항목)

### Changed
### Deprecated
### Removed
### Fixed
### Security

## [0.1.0] - YYYY-MM-DD
### Added
- 블록 기반 WYSIWYG 마크다운 에디터 (TipTap 기반)
- HWP/HWPX 임포트·내보내기
- IndexedDB 기반 로컬 저장 (Dexie.js)
- FlexSearch 기반 전문 검색
- 다크/라이트 테마
- KaTeX 수식 렌더링
- 코드 블록 구문 강조 (Shiki)

[Unreleased]: https://github.com/{owner}/{repo}/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/{owner}/{repo}/releases/tag/v0.1.0
```

**카테고리 의미:**
- **Added**: 새 기능
- **Changed**: 기존 기능의 변경 (호환성 유지)
- **Deprecated**: 곧 제거될 기능 예고
- **Removed**: 제거된 기능
- **Fixed**: 버그 수정
- **Security**: 보안 패치

## Semver 적용 가이드

| 변경 유형 | 0.x.y (사전 1.0) | 1.x.y (안정) |
|----------|-----------------|-------------|
| breaking change | minor (0.1 → 0.2) | major (1.0 → 2.0) |
| 새 기능 (호환) | minor | minor |
| 버그 수정 | patch | patch |

**사전 1.0 단계 공지문(README에 명시):**
> 현재 0.x 버전이므로 minor 버전 업데이트(0.1 → 0.2)에 breaking change가 포함될 수 있습니다. 1.0 도달 시 strict semver를 따릅니다.

## 릴리즈 절차 (수동)

```markdown
# RELEASE.md

## 릴리즈 절차

### 1. 사전 점검
- [ ] CI 모든 잡 green (main 브랜치)
- [ ] CHANGELOG.md `[Unreleased]` 섹션이 비어있지 않음
- [ ] 의존성에 알려진 보안 이슈 없음 (`npm audit`)

### 2. 버전 결정
- breaking change 있음 → minor 증가 (사전 1.0) / major 증가 (1.0+)
- 새 기능만 → minor
- 버그 수정만 → patch

### 3. CHANGELOG 정리
- [ ] `[Unreleased]` 의 모든 항목을 새 버전 섹션으로 이동
- [ ] 버전 헤더와 날짜 추가: `## [0.2.0] - 2026-06-15`
- [ ] 비교 링크 추가

### 4. 버전 번호 갱신
```bash
npm version {patch|minor|major}  # package.json + git tag 자동 생성
```

### 5. 푸시
```bash
git push origin main --follow-tags
```

### 6. GitHub Release
- 태그 푸시 시 release.yml 워크플로우가 자동 생성 (선택)
- 또는 수동: GitHub UI → Releases → "Draft a new release" → 태그 선택 → 노트 작성
```

## 커밋 메시지 가이드 (CONTRIBUTING과 연동)

```
<type>[optional scope]: <subject>

[optional body]

[optional footer]
```

**type 목록:**
- `feat`: 새 기능 → minor bump 후보
- `fix`: 버그 수정 → patch bump 후보
- `docs`: 문서만 변경
- `style`: 포맷팅, 세미콜론 누락 등
- `refactor`: 동작 변경 없는 리팩터링
- `perf`: 성능 개선
- `test`: 테스트 추가/수정
- `build`: 빌드 시스템/의존성
- `ci`: CI 설정
- `chore`: 기타
- `revert`: 이전 커밋 되돌림

**breaking change:** body에 `BREAKING CHANGE: ...` 또는 type에 `!` 추가 (`feat!:`)

## 초기 CHANGELOG 작성 절차

1. git log 최근 N개 확인 (`git log --oneline -50`)
2. 의미 있는 변경 그룹으로 묶어 0.1.0 섹션에 정리
3. 사소한 chore/style 커밋은 제외 (사용자 영향 없음)
4. 한국어로 작성, 영어 미러는 추후 고려

## 작성 워크플로우

1. `_workspace/oss/01_architect_decisions.md` 에서 초기 버전, repo URL 확인
2. `package.json` version 확인 (0.1.0 유지 권장)
3. git log 로 0.1.0 초기 항목 추출
4. `CHANGELOG.md` 작성 (Unreleased + 0.1.0)
5. (선택) `docs/RELEASE.md` 작성
6. `_workspace/oss/05_release_manager_report.md` 에 결과 정리

## 자주 하는 실수

- 비교 링크 누락 → CHANGELOG 하단에 `[Unreleased]: ...`, `[0.1.0]: ...` 필수
- 카테고리를 영어로 → 한국어 표준 번역 사용 (Added=추가됨이 아닌 "Added" 영문 유지가 표준)
- 사소한 chore까지 모두 기록 → 사용자 영향 변경만
- 사전 1.0 정책 누락 → README에 명시 필수
