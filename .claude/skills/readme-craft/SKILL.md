---
name: readme-craft
description: 오픈소스 프로젝트용 README.md 작성 스킬. Hero 섹션, Features, 스크린샷, Quickstart, Tech Stack, Roadmap, Contributing/License 링크, 배지(badge) 구조를 한국어·영어 이중 언어로 생성한다. 트리거 - README 작성, 프로젝트 소개, 첫 화면, 깃허브 readme, OSS 문서, 영문 README, 이중언어 문서, 데모 추가, 스크린샷 README.
---

# README Craft

오픈소스 사용자가 깃허브 첫 화면에서 만나는 README를 만든다. README는 마케팅·문서·온보딩·기여 가이드를 한 화면에 압축한 단일 진입점이다.

## 작성 원칙

1. **3초 룰** — 상단 3줄로 "무엇/누구를 위해/시작 방법"이 보여야 한다.
2. **시각 우선** — Hero 영역에 스크린샷/GIF/로고를 둔다. 자리가 없으면 placeholder.
3. **선형 흐름** — 사용자의 의문 순서를 따른다: 이게 뭐? → 어떻게 생겼어? → 어떻게 써? → 기여하려면?
4. **이중 언어 골격 일치** — 한국어 README.md ↔ 영어 README.en.md, 같은 섹션·같은 anchor.
5. **링크는 실재해야 한다** — 작성 후 모든 링크가 실재 파일을 가리키는지 자체 검증.

## README 표준 구조

```markdown
<div align="center">

# {프로젝트명}

> {Tagline — 한 줄 가치 제안}

[![CI](badge-url)](workflow-url)
[![License](badge-url)](LICENSE)
[![Version](badge-url)](CHANGELOG.md)

[한국어](README.md) | [English](README.en.md)

![Hero Screenshot](docs/screenshots/hero.png)

</div>

## 📖 소개
{2~3문장 프로젝트 설명. 핵심 차별점.}

## ✨ 주요 기능
- 기능 1 - 짧은 설명
- 기능 2 - 짧은 설명
- ...

## 🖼 데모
{스크린샷/GIF — docs/screenshots/ 참조}

## 🚀 빠른 시작

```bash
git clone https://github.com/{owner}/{repo}.git
cd {repo}
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속.

## 🛠 기술 스택
- Framework: ...
- ...

## 📐 프로젝트 구조
{디렉토리 트리 5~10줄}

## 🗺 로드맵
- [x] {완료된 항목}
- [ ] {예정 항목}

## 🤝 기여하기
{CONTRIBUTING.md 링크}

## 📜 라이선스
{LICENSE 링크 + SPDX}

## 🙏 감사의 글
{사용한 OSS 라이브러리 / 기여자 / 영감을 받은 프로젝트}
```

## 한국어 vs 영어 톤

| 한국어 README.md | 영어 README.en.md |
|------------------|-------------------|
| "~합니다" 정중체 | concise, declarative |
| 이모지 적극 사용 | 이모지 절제, sub-heading 명확 |
| 한국어 사용자 사례 | global use cases |
| HWP 등 한국 특화 기능 강조 | "compatible with Korean HWP format" 강조 |

## 배지(Badge) 표준

빌드/품질/메타 정보 배지는 README 상단 한 줄로:

```markdown
[![CI](https://github.com/{owner}/{repo}/actions/workflows/ci.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)](https://www.typescriptlang.org)
```

## 작성 워크플로우

1. `_workspace/oss/01_architect_decisions.md` 에서 프로젝트명·tagline·repo URL 읽기
2. `MDVIEW_SPEC.md` 의 `<in_scope>` 섹션을 추려 주요 기능 6~10개로 압축
3. `package.json` 에서 기술 스택 추출
4. 위 표준 구조에 컨텍스트 주입
5. `프로젝트/README.md` (한국어) 작성
6. 영어 변형 → `프로젝트/README.en.md` 작성
7. 모든 링크가 실재하는 파일을 가리키는지 검증 (CONTRIBUTING.md, CHANGELOG.md 등은 미존재여도 곧 생성되므로 OK)
8. `_workspace/oss/02_docs_writer_report.md` 에 작성 결과 정리

## 자주 하는 실수

- 스크린샷 자리에 placeholder 누락 → 시각 영역 비어 보임
- 한·영 anchor 불일치 → 언어 토글 시 깨짐
- badge URL에 owner/repo 미주입 → 깨진 배지
- Roadmap을 약속처럼 작성 → "예정"임을 명시
