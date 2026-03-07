---
name: table-image-pipeline
description: "HWP 테이블/이미지 변환 파이프라인 스킬. HWP↔마크다운 표 변환, 병합셀 처리, 이미지 추출/임베딩. 트리거: HWP 테이블, 표 변환, 이미지 처리, 병합셀, 내보내기 표."
---

# Table & Image Pipeline — HWP 테이블/이미지 변환

HWP 파일의 표와 이미지를 정확하게 변환하는 파이프라인 스킬입니다.

## 현황 진단

| 기능 | 임포트(HWP→MD) | 내보내기(MD→HWP) |
|------|:---:|:---:|
| 단순 테이블 | ✅ | ❌ 미구현 |
| 병합셀 | ❌ 항상 1 | ❌ 미구현 |
| 이미지 추출 | ❌ 미구현 | ❌ 미구현 |
| 셀 스타일 | ❌ 무시 | ❌ 미구현 |

## 에이전트 팀

| 에이전트 | 역할 | 담당 파일 |
|---------|------|----------|
| table-engineer | 테이블 변환 전체 | hwp-parser.worker.ts, hwp-generator.worker.ts, markdown.ts |
| image-engineer | 이미지 추출/임베딩 | hwp-parser.worker.ts, hwp-generator.worker.ts, drop-zone.tsx |
| hwp-engineer | HWP 구조/Worker 프로토콜 | workers/*, lib/hwp-converter.ts |

## 구현 Phase

### Phase 1: 테이블 내보내기 구현 (table-engineer)
**가장 시급** — 현재 테이블이 텍스트로 변환됨

1. `hwp-generator.worker.ts`의 `htmlToHwpParagraphs()`에 테이블 감지 추가
   - `<table>` 태그 파싱 → 행/열/셀 구조 추출
   - HTML 테이블을 `HwpTableData` 객체로 변환

2. `generateSection()`에 `<hp:tbl>` XML 생성 로직 추가
   ```xml
   <hp:tbl>
     <hp:tblPr borderFill="1">
       <hp:tblSize width="42520" widthRelTo="paper"/>
     </hp:tblPr>
     <hp:tr>
       <hp:tc>
         <hp:tcPr>
           <hp:cellSz width="21260" height="1000"/>
         </hp:tcPr>
         <hp:p><hp:run><hp:t>셀 내용</hp:t></hp:run></hp:p>
       </hp:tc>
     </hp:tr>
   </hp:tbl>
   ```

3. 열 너비 자동 계산 (균등 분배 또는 내용 기반)

### Phase 2: 테이블 임포트 개선 (table-engineer)
병합셀 처리 + 복잡한 표 HTML 폴백

1. HWP 바이너리 파서에서 병합 정보 추출
   - TABLE 레코드 추가 파싱 (셀 속성 영역)
   - `cellColSpan`, `cellRowSpan` 실제 값 설정

2. 변환 판단 로직
   ```
   if (hasColspan || hasRowspan || hasCellBlocks) {
     // → HTML 테이블로 보존
     return renderAsHtmlTable(tableNode);
   } else {
     // → GFM 마크다운 테이블
     return renderAsMarkdownTable(tableNode);
   }
   ```

3. HWPX 파서에서도 동일 로직 적용
   - `<hp:tc>` 속성에서 병합 정보 읽기

### Phase 3: 이미지 추출 (image-engineer)
HWP 임포트 시 이미지 복원

1. HWP 바이너리 (OLE2):
   - CFB에서 BinData/ 엔트리 탐색
   - HWPTAG_BIN_DATA 레코드에서 이미지 ID 매핑
   - 이미지 → Base64 데이터 URL 변환
   - 마크다운에 `![](data:image/...)` 삽입

2. HWPX (ZIP):
   - ZIP 내 BinData/ 디렉토리 파일 추출
   - section XML의 `<hp:img>` 참조 매핑
   - 이미지 → Base64 데이터 URL 변환

3. Worker 메시지 프로토콜 확장:
   ```typescript
   // 응답에 이미지 맵 추가
   {
     type: 'complete',
     content: string,        // 마크다운 (이미지 참조 포함)
     images: Map<string, string>, // id → base64 URL
   }
   ```

### Phase 4: 이미지 임베딩 (image-engineer)
에디터 → HWP 내보내기 시 이미지 포함

1. HTML에서 `<img>` 태그 추출
   - `src`가 Base64 → 디코딩하여 BinData에 추가
   - `src`가 URL → fetch 후 BinData에 추가

2. HWPX ZIP 구조에 이미지 추가:
   ```
   BinData/image1.png  ← 실제 이미지 바이트
   [Content_Types].xml ← image/png MIME 추가
   Contents/section0.xml ← <dr:img binaryItemIDRef="image1"/>
   ```

3. section XML에 이미지 삽입:
   ```xml
   <hp:p>
     <hp:run>
       <hp:drawing>
         <dr:pict>
           <dr:img binaryItemIDRef="image1"/>
           <dr:imgRect x="0" y="0" cx="..." cy="..."/>
         </dr:pict>
       </hp:drawing>
     </hp:run>
   </hp:p>
   ```

## 실행 패턴

### 테이블만 수정
```
Agent(table-engineer) → "HWP 내보내기에 테이블 지원을 추가해줘"
```

### 이미지만 수정
```
Agent(image-engineer) → "HWP 임포트에서 이미지를 추출해줘"
```

### 전체 파이프라인 (순차)
```
Phase 1: Agent(table-engineer) → "내보내기 테이블 구현"
Phase 2: Agent(table-engineer) → "임포트 병합셀 + HTML 폴백"
Phase 3: Agent(image-engineer) → "임포트 이미지 추출"
Phase 4: Agent(image-engineer) → "내보내기 이미지 임베딩"
Phase 5: Agent(hwp-engineer)   → "통합 테스트 + Worker 프로토콜 정합"
```

## 검증 체크리스트

### 테이블
- [ ] 3x3 기본 테이블 HWP→MD→HWP 라운드트립
- [ ] 병합셀 표 → HTML로 보존
- [ ] 빈 셀, 특수문자(`|`) 이스케이프
- [ ] 셀 내 줄바꿈 처리
- [ ] 한글 2020에서 생성된 HWP 테이블 임포트

### 이미지
- [ ] HWP 내 PNG/JPEG 이미지 추출
- [ ] HWPX 내 이미지 추출
- [ ] Base64 이미지 → HWPX 임베딩
- [ ] 외부 URL 이미지 → HWPX 임베딩
- [ ] 이미지 크기 보존

## 참조
- HWPX 표준: ODF 기반, `<hp:tbl>` 네임스페이스
- GFM 테이블 스펙: https://github.github.com/gfm/#tables-extension-
- Turndown GFM 플러그인: `turndown-plugin-gfm` tables()
- TipTap Table: `@tiptap/extension-table` (resizable)
