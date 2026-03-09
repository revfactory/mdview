---
name: seo-optimize
description: "MDView SEO 최적화 스킬. 메타태그, JSON-LD, sitemap, 크롤링 최적화. 트리거: SEO, 검색 최적화, 구글 등록, 메타태그."
---

# SEO Optimize — 검색 엔진 최적화

## 체크리스트

### 1. 메타데이터 (src/app/layout.tsx)
- title: 브랜드 + 핵심 키워드 (60자 이내)
- description: 가치 제안 + 키워드 (160자 이내)
- keywords: 타겟 키워드 배열
- canonical: 정규 URL
- alternates: 언어별 대체 URL
- openGraph: 이미지, 타이틀, 설명
- twitter: 카드 타입, 이미지

### 2. 구조화 데이터 (JSON-LD)
- WebApplication schema
- SoftwareApplication schema
- Organization/Person schema

### 3. 기술적 SEO
- sitemap.xml (src/app/sitemap.ts)
- robots.txt (src/app/robots.ts)
- canonical URL 설정
- lang 속성 확인
- viewport 메타태그

### 4. 콘텐츠 SEO
- 의미있는 heading 구조 (h1 > h2 > h3)
- 이미지 alt 텍스트
- 내부 링크 구조

## 파일 위치
- 메타데이터: `src/app/layout.tsx`
- Sitemap: `src/app/sitemap.ts`
- Robots: `src/app/robots.ts`
- 구조화 데이터: `src/app/layout.tsx` 내 <script type="application/ld+json">
