---
name: hwp-bridge
description: "HWP/HWPX 파일 임포트·내보내기 스킬. hwp.js 파싱, HWPX 생성, Web Worker 통신, 마크다운 변환 매핑."
---

# HWP Bridge — HWP 파일 변환 시스템

## 워크플로우

### Step 1: Web Worker 설정

**hwp-parser.worker.ts** (임포트용):
```typescript
// 메시지 프로토콜
interface WorkerMessage {
  type: 'parse';
  file: ArrayBuffer;
  options: { imageMode: 'base64' | 'blob'; tableMode: 'markdown' | 'html' };
}
interface WorkerResponse {
  type: 'progress' | 'complete' | 'partial' | 'error';
  percent?: number;
  message?: string;
  content?: string;        // 변환된 마크다운
  warnings?: string[];     // 변환 경고
  error?: string;
}
```

**hwp-generator.worker.ts** (내보내기용):
```typescript
interface GenerateMessage {
  type: 'generate';
  markdown: string;
  options: { paperSize: 'A4' | 'Letter' | 'B5'; margins: object; fontFamily: string };
}
interface GenerateResponse {
  type: 'progress' | 'complete' | 'error';
  percent?: number;
  message?: string;
  blob?: Blob;             // 생성된 HWP/HWPX 파일
  error?: string;
}
```

### Step 2: HWP 임포트 (파싱)

`lib/hwp-converter.ts` — hwpToMarkdown():
1. FileReader로 ArrayBuffer 읽기
2. Worker에 전송
3. Worker 내부:
   a. hwp.js로 HWP 구조 파싱
   b. 문서 트리 순회하며 마크다운 변환:
      - **문단**: 텍스트 추출 + 인라인 서식 (볼드, 이탤릭, 밑줄)
      - **제목 매핑**: 글꼴 크기 기반 (20pt+ → H1, 16pt+ → H2, 14pt+ → H3, 나머지 → 본문)
        또는 HWP 스타일명 기반 ("제목 1" → H1 등)
      - **리스트**: 글머리 기호 → `- `, 번호 매기기 → `1. `
      - **표**: 단순 표 → 마크다운 테이블, 병합 셀 → HTML `<table>` fallback
      - **이미지**: 바이너리 추출 → Base64 → `![alt](data:image/...)`
      - **하이퍼링크**: `[텍스트](URL)`
      - **수평선**: `---`
   c. progress 메시지 전송 (10%, 30%, 60%, 90%, 100%)
4. 메인 스레드에서 결과 수신 → 에디터에 로드

### Step 3: HWP 내보내기 (생성)

마크다운 → HWPX 파이프라인:
1. 마크다운 → HTML (marked)
2. HTML → HWPX 문서 구조:
   a. section.xml: 본문 콘텐츠
   b. header.xml / footer.xml: 머리글/바닥글
   c. content_types.xml: MIME 타입 정의
   d. META-INF/manifest.xml: 파일 목록
3. JSZip으로 HWPX 패키징 (ZIP 컨테이너)
4. Blob 생성 → file-saver로 다운로드

**HWPX XML 구조 요약**:
```
document.hwpx (ZIP)
├── META-INF/
│   └── manifest.xml
├── Contents/
│   ├── content.hpf        # 패키지 정보
│   ├── header.xml          # 문서 헤더
│   ├── section0.xml        # 본문 섹션
│   └── BinData/            # 이미지 등 바이너리
└── settings.xml            # 문서 설정
```

### Step 4: React 훅

`hooks/use-hwp.ts`:
```typescript
export function useHwpImport() {
  // returns: { importFile, progress, isImporting, error, result }
}
export function useHwpExport() {
  // returns: { exportDocument, progress, isExporting, error }
}
```

### Step 5: UI 컴포넌트

- `components/features/import-export/hwp-import.tsx`: 드롭존 + 진행바 + 옵션 + 에러
- `components/features/import-export/hwp-export.tsx`: 포맷 선택 + 옵션 + 진행
- `components/features/import-export/export-menu.tsx`: 드롭다운 (HWP/PDF/MD/HTML)

## 제한사항 및 fallback
- 암호화된 HWP → "암호화된 문서는 지원하지 않습니다" 에러
- 수식 (HWP 수식 에디터) → 텍스트 추출만 가능, LaTeX 변환은 불완전
- 그리기 개체 → 무시 + 경고 메시지
- 매크로 → 완전 무시 (보안)
- OLE 개체 → 무시 + 경고
- 변환 불가 요소가 있으면 partial 결과 반환 + warnings 배열
