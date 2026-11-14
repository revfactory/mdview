# MDView에 기여하기

MDView 프로젝트에 관심을 가져주셔서 감사합니다! 모든 형태의 기여를 환영합니다 — 버그 리포트, 기능 제안, 문서 개선, 코드 PR 모두.

이 문서는 처음 PR을 여시는 분에게 5분 안에 셋업을 마치고 코드를 기여할 수 있도록 안내합니다.

## 목차

- [행동 규약](#행동-규약)
- [기여 종류별 가이드](#기여-종류별-가이드)
- [개발 환경 셋업](#개발-환경-셋업)
- [브랜치 전략](#브랜치-전략)
- [커밋 메시지 규칙](#커밋-메시지-규칙)
- [PR 절차](#pr-절차)
- [코드 스타일](#코드-스타일)
- [테스트](#테스트)
- [변경 이력](#변경-이력)
- [질문하기](#질문하기)

## 행동 규약

이 프로젝트는 [Contributor Covenant 2.1](CODE_OF_CONDUCT.md)을 채택합니다. 기여자는 행동 규약을 준수해야 합니다. 위반 사항은 메인테이너(@revfactory)에게 직접 신고해 주세요.

## 기여 종류별 가이드

| 종류 | 채널 | 가이드 |
|------|------|--------|
| 🐛 버그 신고 | [이슈](https://github.com/revfactory/mdview/issues/new?template=bug_report.md) | 재현 절차와 환경 정보 포함 |
| 💡 기능 제안 | [이슈](https://github.com/revfactory/mdview/issues/new?template=feature_request.md) | 사용 사례·동기 명확히 |
| ❓ 질문 | [이슈](https://github.com/revfactory/mdview/issues/new?template=question.md) | 사용법·동작·디자인 질문 |
| 🔒 보안 취약점 | [Security Advisories](https://github.com/revfactory/mdview/security/advisories/new) | **공개 이슈 금지** |
| 📝 문서 개선 | PR | 작은 변경은 이슈 없이 바로 PR OK |
| 🎨 코드 기여 | PR | 큰 변경은 먼저 이슈에서 합의 |

## 개발 환경 셋업

### 사전 요구사항

- **Node.js 20 LTS** 이상 ([설치 가이드](https://nodejs.org))
- **npm** (Node.js와 함께 설치됨)
- **git**

### 셋업 절차

```bash
# 1. 저장소 fork 후 clone
git clone https://github.com/{YOUR_USERNAME}/mdview.git
cd mdview

# 2. upstream 추가 (PR 동기화용)
git remote add upstream https://github.com/revfactory/mdview.git

# 3. 잠금 파일 기준 의존성 설치
npm ci

# 4. 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속 시 에디터가 보이면 성공입니다.

### 사용 가능한 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 (hot reload) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 |
| `npm run lint` | ESLint 검사 |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm test` | Node.js 테스트 러너로 자동 회귀 테스트 실행 |

## 브랜치 전략

[GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow) 를 따릅니다.

- `main` — 안정 브랜치. 직접 푸시 대신 PR과 리뷰를 통해 변경합니다. 브랜치 보호 설정 여부와 별개로 아래 검증 절차를 지켜 주세요.
- `feat/{설명}` — 새 기능
- `fix/{설명}` — 버그 수정
- `docs/{설명}` — 문서 변경
- `chore/{설명}` — 빌드/도구
- `refactor/{설명}` — 리팩터링

예시: `feat/markdown-export-zip`, `fix/hwp-image-rotation`.

## 커밋 메시지 규칙

[Conventional Commits 1.0](https://www.conventionalcommits.org/ko/v1.0.0/) 을 따릅니다. 메시지는 한국어 또는 영어 모두 가능합니다.

```
<type>[scope]: <subject>

[optional body]

[optional footer]
```

### type 목록

| type | 설명 | 버전 영향 |
|------|------|----------|
| `feat` | 새 기능 | minor |
| `fix` | 버그 수정 | patch |
| `docs` | 문서만 변경 | — |
| `style` | 포맷·세미콜론 등 (동작 무변경) | — |
| `refactor` | 리팩터링 | — |
| `perf` | 성능 개선 | patch |
| `test` | 테스트 추가/수정 | — |
| `build` | 빌드 시스템·의존성 | — |
| `ci` | CI 설정 | — |
| `chore` | 기타 | — |

### Breaking Change 표기

```
feat!: 자동저장 기본값을 disabled로 변경

BREAKING CHANGE: useEditor 훅의 autosave 옵션이 기본값 false로 변경됨.
이전 동작을 유지하려면 autosave: true를 명시해야 함.
```

### 좋은 예시

```
feat(editor): 슬래시 명령어에 mermaid 다이어그램 추가
fix(hwp): 이미지가 90도 회전되는 문제 수정
docs: README에 PDF 내보내기 단축키 표기
chore(deps): @tiptap/* 의존성을 3.20.2로 업데이트
```

## PR 절차

### 1. 이슈 먼저

- **작은 변경(타이포, 문서 한 줄)**: 이슈 없이 바로 PR OK
- **버그 수정**: 기존 이슈 확인, 없으면 새 이슈 생성
- **새 기능 / 큰 변경**: 반드시 이슈에서 먼저 설계 합의

### 2. 브랜치 작업

```bash
# upstream 동기화
git fetch upstream
git checkout main
git merge upstream/main

# 작업 브랜치
git checkout -b feat/awesome-feature
```

### 3. 변경 사항 작성

- 코드 변경
- 필요 시 `CHANGELOG.md` 의 `[Unreleased]` 섹션에 항목 추가
- 사용자 영향 변경이 아니면 CHANGELOG 갱신 불필요 (내부 리팩터링 등)

### 4. 로컬 검증

PR을 열기 전 다음을 확인해 주세요:

```bash
npm run lint       # ESLint 통과
npm run typecheck  # 타입 오류 없음
npm test          # 자동 회귀 테스트 통과
npm run build      # 빌드 성공
```

### 5. PR 생성

```bash
git push origin feat/awesome-feature
```

GitHub에서 PR을 엽니다. PR 템플릿이 자동 적용됩니다.

### 6. 리뷰 반영

- 리뷰어의 코멘트는 새 커밋으로 반영 (rebase 권장하지 않음, 리뷰 추적이 쉽도록)
- CI 잡(`lint`, `typecheck`, `build`)이 모두 green 이어야 머지 가능

### 7. 머지

- **Squash merge** 권장 — main 히스토리를 간결하게 유지
- 머지 후 브랜치 삭제

## 코드 스타일

### TypeScript

- **strict 모드** 유지 (`tsconfig.json`)
- `any` 사용 최소화. 불가피하면 주석으로 사유 명시.
- 타입은 `src/types/` 에 모으거나 모듈 내부에 co-locate

### React

- **함수형 컴포넌트** 만 사용
- **커스텀 훅** 으로 로직 추출 (네이밍: `useFoo`)
- Props는 인터페이스로 정의 (`interface FooProps`)
- 가능하면 `React.memo` 적용 (특히 큰 리스트 아이템)

### 파일 명명

- 컴포넌트: `kebab-case.tsx` (e.g., `block-list.tsx`) 또는 프로젝트 기존 패턴 따름
- 훅: `use-foo.ts`
- 유틸: `foo-converter.ts`

### ESLint

`npm run lint` 가 통과해야 합니다. 수정 어려운 경우 `eslint-disable` 주석에 사유 명시.

### 디렉토리 컨벤션

새 기능 추가 시 적절한 위치:

- 에디터 확장 → `src/extensions/`
- UI 프리미티브 → `src/components/ui/`
- 기능 단위 컴포넌트 → `src/components/features/{feature}/`
- DB 스키마/CRUD → `src/db/`
- Web Worker → `src/workers/`
- 마크다운/HWP 변환 → `src/lib/`

## 테스트

자동 회귀 테스트는 `tests/*.test.mjs`에 있으며 Node.js 내장 테스트 러너로 실행합니다.

```bash
npm ci
npm test
```

버그 수정에는 재현 테스트를, 새 기능에는 정상·실패·취소 등 관련 회귀 테스트를 함께 추가해 주세요. CI의 `Type Check` 잡은 타입 검사에 이어 `npm test`를 실행합니다. 테스트 개수보다 변경한 동작의 검증 범위가 중요합니다.

자동 테스트 통과가 실제 브라우저나 한글 앱에서의 동작을 모두 보장하지는 않습니다. 변경에 영향을 받는 아래 시나리오를 수동 검증하고, 수행하지 못한 검증은 PR 본문에 명시해 주세요:

### 핵심 시나리오 (수동 QA)

- [ ] 신규 문서 생성 → 텍스트 입력 → 자동저장 확인
- [ ] HWP 파일 임포트 → 마크다운 변환 확인
- [ ] 마크다운 작성 → HWPX 내보내기 → 한글에서 열기
- [ ] PDF 내보내기
- [ ] 다크/라이트 테마 전환
- [ ] 대용량 문서(>300KB) 페이지네이션 동작

### 저장·가져오기 변경의 추가 검증

- [ ] 합성 테스트 문서로 가져오기 → 편집 → 저장 완료 확인 → 새로고침 → 재열기 후 내용 확인
- [ ] 대용량 문서의 첫·중간·마지막 페이지를 이동하고 재열어 누락 여부 확인
- [ ] PDF 변환 중 닫기/취소 → 다시 열기 → 다른 파일 변환 시 이전 작업이 새 결과를 덮어쓰지 않는지 확인
- [ ] 저장 실패를 재현한 경우 불완전 문서가 남지 않고, 재시도 및 기존 문서·원본 파일이 보존되는지 확인

실패 주입과 저장소 삭제는 **개인 문서가 없는 별도 테스트 프로필/환경**에서만 수행합니다. 실제 사용자 데이터나 운영 저장소를 지우지 마세요. `mdview.kr`과 `www.mdview.kr`은 서로 다른 origin이므로 한쪽에서 저장한 문서가 다른 쪽에서도 보인다고 가정하지 마세요.

PR 본문에는 검증한 **commit SHA, 브라우저·OS, URL/origin, 시나리오, 기대 결과와 실제 결과**를 기록합니다. 통과·실패·미수행을 구분하고, 접근 제한이나 로그인으로 막힌 항목은 그대로 남깁니다. 모의 IndexedDB 테스트는 실제 브라우저의 저장·재시작 검증을 대체하지 않습니다. IME 변경은 자동 문자열 입력뿐 아니라 실제 OS 한글 조합 입력도 별도로 확인합니다.

UI 변경은 PR 본문에 스크린샷 또는 GIF 첨부 권장. 개인 문서 내용과 계정 정보는 첨부하지 마세요.

### 릴리즈 검증

버전 태그로 실행되는 릴리즈 워크플로도 의존성 설치 후 lint, 타입 검사, 자동 테스트, 빌드를 모두 통과해야 GitHub Release를 게시합니다. 검증 목적으로 릴리즈 태그를 만들지 말고, PR의 CI에서 먼저 검증해 주세요.

## 변경 이력

[Keep a Changelog 1.1](https://keepachangelog.com/ko/1.1.0/) 형식을 따릅니다.

사용자에게 영향이 있는 변경(기능, 변경, 제거, 수정, 보안)은 `CHANGELOG.md` 의 `[Unreleased]` 섹션에 항목을 추가해 주세요. 카테고리:

- `Added` — 새 기능
- `Changed` — 기존 기능 변경 (호환)
- `Deprecated` — 곧 제거될 기능 예고
- `Removed` — 제거된 기능
- `Fixed` — 버그 수정
- `Security` — 보안 패치

예시:
```markdown
## [Unreleased]
### Added
- HWP 임포트 시 머리글/바닥글 추출 지원
```

## 질문하기

- 사용법 / 버그 / 기능 / 질문 → [GitHub Issues](https://github.com/revfactory/mdview/issues)
- 보안 취약점 → [Security Advisories](https://github.com/revfactory/mdview/security/advisories/new) (비공개)

기여해 주셔서 감사합니다! 🎉
