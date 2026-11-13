<div align="center">

# MDView

> **한글 친화 마크다운 에디터** — HWP·HWPX를 마크다운으로, 마크다운을 HWPX로

[![CI](https://github.com/revfactory/mdview/actions/workflows/ci.yml/badge.svg)](https://github.com/revfactory/mdview/actions/workflows/ci.yml)
[![CodeQL](https://github.com/revfactory/mdview/actions/workflows/codeql.yml/badge.svg)](https://github.com/revfactory/mdview/actions/workflows/codeql.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6)](https://www.typescriptlang.org)

**한국어** | [English](README.en.md)

<br />

<img src="public/banner.png" alt="MDView Banner" width="800" />

</div>

## 🖼 온라인에서 바로 사용하기

설치나 회원가입 없이 [MDView 에디터 열기](https://mdview.kr/). HWP·HWPX를 가져오고, Markdown 또는 HWPX 파일로 내보낼 수 있습니다.

- [HWP·HWPX를 마크다운으로 변환](https://mdview.kr/guides/hwp-to-markdown)
- [마크다운을 한글 HWPX로 내보내기](https://mdview.kr/guides/markdown-to-hwpx)
- [마크다운을 PDF로 저장하기](https://mdview.kr/guides/markdown-to-pdf)
- [에디터 사용법과 로컬 저장 안내](https://mdview.kr/guides/markdown-editor)

문서는 현재 브라우저에 저장됩니다. 중요한 문서는 파일로 백업하고, 복잡한 표·이미지·서식은 변환 후 확인하세요. HWP 바이너리(`.hwp`)로 내보내는 기능은 제공하지 않습니다.

저장한 문서가 보이지 않으면 작성했던 기기·브라우저 프로필에서 [mdview.kr](https://mdview.kr/)과 [www.mdview.kr](https://www.mdview.kr/)을 확인하세요. 두 주소는 문서를 따로 저장하며 자동으로 동기화하지 않습니다. 확인 전에 사이트 데이터를 지우지 말고, 문서를 찾으면 파일로 백업하세요. [문서 찾기와 안전한 백업 안내](https://mdview.kr/guides/markdown-editor#document-storage)를 참고하세요.

## 📖 소개

**MDView**는 마크다운 문법을 전혀 몰라도 워드프로세서처럼 직관적으로 문서를 작성할 수 있는 블록 기반 WYSIWYG 마크다운 에디터입니다. 내부적으로는 순수 마크다운(`.md`)으로 저장되어 어떤 플랫폼에서도 호환됩니다.

세 가지 핵심 차별점:

1. **🇰🇷 HWP 브릿지** — HWP/HWPX(한글 문서)를 마크다운으로 임포트하고, 마크다운을 HWPX로 내보낼 수 있습니다.
2. **⚡ 대용량 처리** — Web Worker 파싱과 페이지네이션으로 긴 문서를 나눠 처리합니다. 처리 시간과 서식 보존은 파일 구조와 기기에 따라 다릅니다.
3. **🧱 블록 기반 편집** — Notion 스타일의 슬래시 명령어, 드래그 앤 드롭으로 직관적으로 편집합니다.

> ⚠️ 현재 0.x 사전 릴리즈 단계입니다. minor 업데이트에 breaking change가 포함될 수 있습니다.

## ✨ 주요 기능

- **블록 기반 WYSIWYG 편집** — 헤딩, 리스트, 코드, 인용문, 체크리스트, 테이블, 이미지
- **슬래시(/) 명령어** — 블록 타입 즉시 전환·삽입
- **드래그 앤 드롭** — 블록 단위 재배치
- **HWP/HWPX 임포트, HWPX 내보내기** — 한글 문서를 마크다운으로, 마크다운을 `.hwpx` 한글 문서로
- **마크다운 파일 임포트·내보내기** — `.md` 직접 열기/저장
- **PDF 열람** — PDF를 원본 레이아웃 그대로 읽기 전용으로 열기(페이지 이동, 확대·축소, 글자 선택·복사, 원본 다운로드). 글꼴이 포함되지 않은 한글 PDF도 표시
- **PDF → 마크다운 변환** — 글자 크기와 줄 간격으로 제목·문단·목록을 추정해 편집 가능한 문서 생성. 스캔한 이미지 PDF는 변환되지 않으며 표·여러 단 배치는 원본과 비교 필요
- **PDF 내보내기** — 일반 WYSIWYG 문서에서 브라우저 인쇄/PDF 저장
- **소스/Split 뷰** — WYSIWYG ↔ 마크다운 원본 전환
- **대용량 문서 페이지네이션** — 300KB 이상 문서는 자동 청크 분할
- **전문 검색** — FlexSearch 기반 (Web Worker 실행)
- **자동저장** — IndexedDB (Dexie.js) 로컬 저장
- **다크/라이트 테마** — 시스템 설정 연동
- **수식 렌더링** — KaTeX
- **코드 구문 강조** — Shiki
- **목차(TOC) 자동 생성**
- **웹 앱 manifest** — 오프라인 재실행은 보장하지 않습니다.
- **반응형 디자인** — 데스크톱·태블릿·모바일

## 🚀 빠른 시작

### 사전 요구사항

- Node.js 20 LTS 이상
- npm (또는 pnpm/yarn)

### 설치 및 실행

```bash
git clone https://github.com/revfactory/mdview.git
cd mdview
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속.

### 프로덕션 빌드

```bash
npm run build
npm run start
```

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| **Framework** | Next.js 16 + React 19 |
| **언어** | TypeScript 6 (strict) |
| **에디터 코어** | TipTap 3 (ProseMirror 기반) |
| **스타일** | Tailwind CSS 4 |
| **로컬 데이터베이스** | Dexie.js 4 (IndexedDB) |
| **상태 관리** | Zustand 5 + dexie-react-hooks |
| **검색** | FlexSearch (Web Worker) |
| **HWP 파싱** | 자체 파서 + cfb (Compound File Binary) |
| **수식** | KaTeX |
| **코드 강조** | Shiki |

## 📐 프로젝트 구조

```
src/
├── app/            # Next.js App Router (페이지, 라우팅)
├── components/     # UI 컴포넌트 (features/, ui/, layout/)
├── db/             # Dexie 스키마, CRUD
├── extensions/     # TipTap 커스텀 확장
├── hooks/          # 공용 React 훅
├── lib/            # 마크다운 변환, HWP 변환 등 유틸
├── stores/         # Zustand 스토어
├── styles/         # 전역/테마 스타일
├── types/          # 공유 타입
└── workers/        # HWP 파서, 검색 인덱서 Worker
```

## 🗺 로드맵

### v0.x (현재)
- [x] 블록 기반 WYSIWYG 에디터
- [x] HWP/HWPX 임포트·내보내기
- [x] 대용량 문서 페이지네이션
- [x] PDF 내보내기
- [x] PDF 열람·마크다운 변환
- [x] 웹 앱 manifest

### v1.0 (예정)
- [ ] DOCX 임포트·내보내기
- [ ] 클라우드 동기화 (Supabase)
- [ ] 실시간 멀티유저 협업 (Yjs)
- [ ] 버전 히스토리/복원

### 그 이후
- [ ] AI 글쓰기 보조
- [ ] 플러그인 시스템
- [ ] 프레젠테이션 모드 (Marp 기반)

초기 구상은 [`MDVIEW_SPEC.md`](MDVIEW_SPEC.md)의 `<future_considerations>`를 참고하세요. 이 설계안에는 미구현 기능과 성능 목표가 포함되어 있으며, 현재 지원 범위는 이 README와 [사용 가이드](https://mdview.kr/guides)를 기준으로 확인하세요.

## 🤝 기여하기

기여는 언제든 환영합니다. 시작하기 전에 다음 문서를 읽어주세요:

- [기여 가이드](CONTRIBUTING.md)
- [행동 규약](CODE_OF_CONDUCT.md)
- [변경 이력](CHANGELOG.md)

## 🔒 보안

보안 취약점은 공개 이슈가 아닌 비공개 채널로 신고해 주세요. [`SECURITY.md`](SECURITY.md) 참조.

## 📜 라이선스

이 프로젝트는 [Apache License 2.0](LICENSE) 으로 배포됩니다.

```
Copyright 2026 revfactory and MDView contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
```

## 🙏 감사의 글

MDView는 다음 오픈소스 프로젝트들의 어깨 위에 서 있습니다:

- [TipTap](https://tiptap.dev) — 헤드리스 에디터 프레임워크
- [ProseMirror](https://prosemirror.net) — 에디터 코어
- [Next.js](https://nextjs.org) — React 프레임워크
- [Dexie.js](https://dexie.org) — IndexedDB 래퍼
- [FlexSearch](https://github.com/nextapps-de/flexsearch) — 전문 검색 엔진
- [KaTeX](https://katex.org) — 수식 렌더링
- [Shiki](https://shiki.style) — 구문 강조

그리고 [Issues](https://github.com/revfactory/mdview/issues) 에 피드백을 남겨주신 모든 분들께 감사드립니다.
