# Changelog

이 프로젝트의 모든 주요 변경 사항이 이 파일에 기록됩니다.

이 형식은 [Keep a Changelog 1.1](https://keepachangelog.com/ko/1.1.0/) 을 기반으로 하며,
이 프로젝트는 [Semantic Versioning 2.0.0](https://semver.org/lang/ko/) 을 따릅니다.

> ⚠️ 현재 사전 1.0 (`0.x.y`) 단계입니다. minor 버전 업데이트(`0.1 → 0.2`)에 breaking change 가 포함될 수 있습니다. 1.0 도달 시 strict semver 를 따릅니다.

## [Unreleased]

### Added
- _아직 항목 없음_

### Changed
- _아직 항목 없음_

### Deprecated
- _아직 항목 없음_

### Removed
- _아직 항목 없음_

### Fixed
- _아직 항목 없음_

### Security
- _아직 항목 없음_

---

## [0.1.0] - 2026-05-28

첫 공개 릴리즈. 한글 친화 마크다운 에디터의 핵심 기능을 모두 포함합니다.

### Added

#### 편집 코어
- TipTap 3 기반 블록 기반 WYSIWYG 마크다운 에디터
- 슬래시(`/`) 명령어로 블록 타입 전환·삽입
- 드래그 앤 드롭 블록 재배치
- 버블 메뉴(인라인 서식)
- 헤딩, 리스트, 코드 블록, 인용문, 체크리스트, 테이블, 이미지, 수평선
- 마크다운 ↔ HTML 양방향 변환

#### HWP 브릿지
- HWP/HWPX 파일 임포트 → 마크다운 변환 (Web Worker)
- 마크다운 → HWPX 내보내기
- 테이블 변환 (병합셀, HTML 폴백)
- 이미지 추출·임베딩 (BinData ↔ Base64)

#### 데이터 레이어
- IndexedDB 기반 로컬 저장 (Dexie.js)
- 자동저장
- 폴더·즐겨찾기·태그로 문서 조직화
- FlexSearch 기반 전문 검색 (Web Worker 실행)

#### 사용자 경험
- 다크/라이트 테마 (시스템 설정 연동)
- 키보드 단축키 (서식·네비게이션·블록 조작)
- 빠른 열기 (Cmd+P)
- 파일 드롭 (전체 화면 드롭존)
- 빈 상태 디자인 + 샘플 문서 생성 버튼
- 토스트 알림 (Sonner)
- 반응형 디자인 (데스크톱·태블릿·모바일)

#### 고급 렌더링
- 코드 블록 구문 강조 (Shiki)
- 수식 렌더링 (KaTeX, 블록·인라인)
- 각주 표시
- 목차(TOC) 자동 생성
- Split View / Source View 전환

#### 입출력
- 마크다운(`.md`) 파일 임포트·내보내기
- PDF 내보내기 (인쇄용 스타일)
- HWP/HWPX 파일 임포트·내보내기

#### 성능 최적화
- 대용량 HWP(1000+ 페이지) 임포트 페이지 프리즈 방지
  - Worker 이미지 200KB/30개 제한
  - 2MB 콘텐츠 가드
  - htmlToMarkdown 300ms 디바운스
  - 300KB+ 자동 소스 뷰 전환
- 대규모 문서 WYSIWYG 페이지네이션 (청크 분할 편집)
- Web Worker 기반 파싱·검색

#### PWA / SEO
- PWA 지원 (Service Worker, manifest, offline)
- SEO 메타태그, JSON-LD 구조화 데이터
- sitemap.xml, robots.txt 동적 생성

### Notes
- `private: true` (npm 미공개), 코드만 GitHub 공개
- 라이선스: Apache-2.0

---

[Unreleased]: https://github.com/revfactory/mdview/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/revfactory/mdview/releases/tag/v0.1.0
