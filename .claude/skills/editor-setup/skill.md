---
name: editor-setup
description: "TipTap 에디터 설정 및 확장 개발 스킬. WYSIWYG 블록 편집기, 슬래시 명령어, 버블 메뉴, 마크다운 변환 구현."
---

# Editor Setup — TipTap WYSIWYG 에디터 구축

## 워크플로우

### Step 1: TipTap 기본 설정
1. `components/features/editor/editor.tsx` 생성
2. StarterKit + 필수 확장 구성:
   ```
   StarterKit (history, bold, italic, strike, code, heading, bulletList, orderedList, blockquote, codeBlock, horizontalRule)
   + Table, Image, TaskList, TaskItem, Placeholder, Typography, CharacterCount
   + Color, Highlight, TextAlign, Underline, Superscript, Subscript, Link
   ```
3. 에디터 props: `content`, `onUpdate`, `editable`, `autofocus`

### Step 2: 커스텀 확장 개발
각 확장은 `extensions/` 디렉토리에 독립 파일:

- **slash-command.ts**: '/' 입력 시 팝업 메뉴 (Suggestion plugin 기반)
  - 카테고리: 기본(텍스트, 제목1-3, 리스트, 인용문, 구분선) | 미디어(이미지, 테이블, 코드) | 고급(수식, 다이어그램, 목차)
  - 한글+영문 필터링
  - ↑/↓ 네비게이션, Enter 선택, Escape 닫기

- **block-drag.ts**: 블록 좌측 드래그 핸들 + 메뉴
  - NodeView decoration으로 각 블록에 핸들 추가
  - @dnd-kit 연동 또는 ProseMirror 네이티브 DnD

- **unique-id.ts**: 모든 블록 노드에 고유 ID 자동 부여 (nanoid)

- **trailing-node.ts**: 문서 끝에 항상 빈 문단 유지

- **math-node.ts**: KaTeX 수식 블록 (NodeView)
  - 렌더링: KaTeX로 수식 표시
  - 편집: 클릭 시 LaTeX 소스 편집 모달

- **mermaid-node.ts**: Mermaid 다이어그램 블록 (NodeView)
  - 렌더링: Mermaid로 다이어그램 표시
  - 편집: 클릭 시 소스 편집 모달

### Step 3: 버블 메뉴
`components/features/editor/bubble-menu.tsx`:
- TipTap BubbleMenu 컴포넌트 사용
- 항목: Bold | Italic | Underline | Strikethrough | Code | Link | Highlight | Text Color
- 다크 배경 pill (#292929), 아이콘 16px 흰색
- 선택 영역 상단 8px 위에 표시

### Step 4: 마크다운 변환
`lib/markdown.ts`:
- **tiptapToMarkdown(json)**: TipTap JSON → 마크다운 문자열 (turndown 기반)
- **markdownToTiptap(md)**: 마크다운 → TipTap JSON (marked → HTML → TipTap parser)
- **markdownToHtml(md)**: 마크다운 → HTML (marked)
- **htmlToMarkdown(html)**: HTML → 마크다운 (turndown)
- 커스텀 turndown 규칙: 체크리스트, 수식, 다이어그램, 테이블

### Step 5: Split View / Source View
`components/features/markdown-view/split-editor.tsx`:
- 좌측 WYSIWYG + 우측 마크다운 소스 (50/50, resizable)
- 동기 편집: 한쪽 수정 → 반대쪽 300ms debounce 반영
- 동기 스크롤: 비율 기반 스크롤 동기화

`components/features/markdown-view/markdown-source.tsx`:
- textarea 또는 CodeMirror 6 기반 마크다운 편집
- 마크다운 구문 강조, line numbers, bracket matching

### Step 6: 자동저장
`hooks/use-autosave.ts`:
- TipTap onUpdate → 1초 debounce → IndexedDB 저장
- requestIdleCallback으로 저장 실행 (UI 블로킹 방지)
- 저장 상태 관리: idle | saving | saved | error
- 에디터 상태바에 저장 상태 표시

## 참고사항
- 마크다운 자동 변환은 TipTap InputRule로 구현 (StarterKit에 대부분 포함)
- 코드 블록 구문 강조: @tiptap/extension-code-block-lowlight 대신 Shiki 커스텀 NodeView 사용 시 lazy load 필수
- 이미지: paste 이벤트 + drop 이벤트 처리, Base64로 변환 후 삽입
