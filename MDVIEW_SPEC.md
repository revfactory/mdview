```xml
<project_specification>

<project_name>MDView - Next-Generation Markdown Editor with HWP Bridge</project_name>

<overview>
MDView는 마크다운 문법을 전혀 몰라도 워드프로세서처럼 직관적으로 문서를 작성하고 편집할 수 있는 차세대 마크다운 에디터 서비스입니다. 블록 기반 WYSIWYG 편집, 슬래시 명령어, 드래그앤드롭 블록 재배치, 실시간 협업을 제공하며, 내부적으로는 순수 마크다운(.md)으로 저장되어 어떤 플랫폼에서든 호환됩니다.

핵심 차별점은 세 가지입니다. 첫째, HWP/HWPX 파일을 완벽하게 임포트하여 마크다운으로 변환하고, 반대로 마크다운을 HWP 형식으로 내보낼 수 있습니다. 둘째, Web Worker 기반 파싱과 가상 스크롤링으로 10만 줄 이상의 대용량 문서도 지연 없이 렌더링합니다. 셋째, 블록 단위 편집 시스템으로 Notion의 직관성과 VS Code의 퍼포먼스를 결합합니다.

CRITICAL: 프론트엔드는 React + Vite 기반 SPA로 구축합니다. 에디터 코어는 TipTap(ProseMirror 기반)을 사용합니다. HWP 파싱은 Web Worker에서 처리하여 메인 스레드를 블로킹하지 않습니다. 문서 데이터는 IndexedDB(로컬)에 저장하며, 선택적으로 Supabase를 통한 클라우드 동기화를 지원합니다.
</overview>

<scope_boundaries>
  <in_scope>
    - 블록 기반 WYSIWYG 마크다운 편집 (헤딩, 리스트, 코드, 테이블, 이미지, 인용문, 수평선, 체크리스트)
    - 슬래시(/) 명령어로 블록 타입 전환 및 삽입
    - 드래그앤드롭 블록 재배치
    - HWP/HWPX 파일 임포트 → 마크다운 변환
    - 마크다운 → HWP/HWPX 내보내기
    - 마크다운 원본 보기/편집 모드 (Split View)
    - 문서 관리 (폴더, 즐겨찾기, 태그, 검색)
    - 대용량 문서 처리 (가상 스크롤링, Web Worker 파싱)
    - 실시간 자동저장 (IndexedDB)
    - 다크/라이트 테마
    - PDF 내보내기
    - 마크다운 파일(.md) 임포트/내보내기
    - 키보드 단축키 (서식, 네비게이션, 블록 조작)
    - 반응형 디자인 (데스크톱/태블릿/모바일)
    - 목차(TOC) 자동 생성
    - 코드 블록 구문 강조 (Shiki)
    - 수식 지원 (KaTeX)
    - Mermaid 다이어그램 렌더링
  </in_scope>
  <out_of_scope>
    - 사용자 계정/인증 시스템 (Phase 1에서는 로컬 전용)
    - 실시간 멀티유저 협업 (Phase 2)
    - 클라우드 동기화 (Phase 2)
    - 모바일 네이티브 앱
    - 댓글/코멘트 시스템
    - 버전 관리/히스토리 (Phase 2)
    - 플러그인 시스템
    - AI 기반 글쓰기 보조
    - 프레젠테이션 모드
  </out_of_scope>
  <future_considerations>
    - Supabase 기반 클라우드 동기화 및 사용자 계정 (Phase 2)
    - 실시간 협업 편집 with Yjs (Phase 2)
    - 문서 버전 히스토리 및 복원 (Phase 2)
    - AI 글쓰기 보조 (Phase 3)
    - 플러그인/확장 시스템 (Phase 3)
    - DOCX 임포트/내보내기 (Phase 2)
    - PDF 임포트 — 텍스트 + 기본 구조화(제목/문단/목록)만 (Phase 2)
    - 프레젠테이션 모드 - Marp 기반 (Phase 3)
  </future_considerations>
</scope_boundaries>

<technology_stack>
  <frontend_application>
    <framework>React 19 with TypeScript 5.7</framework>
    <build_tool>Vite 6.1</build_tool>
    <styling>Tailwind CSS v4.0</styling>
    <routing>React Router v7.2</routing>
    <state_management>Zustand v5.0 for UI state, Dexie.js liveQuery for document data</state_management>
  </frontend_application>
  <data_layer>
    <database>IndexedDB via Dexie.js v4.0</database>
    <reactive_queries>dexie-react-hooks for live-updating document lists</reactive_queries>
    <search>FlexSearch v0.7 for full-text document search (runs in Web Worker)</search>
    <note>CRITICAL: Phase 1은 완전 로컬 앱. 네트워크 요청 없음. 모든 데이터는 IndexedDB에 저장.</note>
  </data_layer>
  <libraries>
    <editor>@tiptap/react v2.11 + @tiptap/pm for WYSIWYG block editor</editor>
    <tiptap_extensions>
      @tiptap/starter-kit v2.11 (basic marks/nodes),
      @tiptap/extension-table v2.11,
      @tiptap/extension-image v2.11,
      @tiptap/extension-code-block-lowlight v2.11,
      @tiptap/extension-task-list v2.11,
      @tiptap/extension-task-item v2.11,
      @tiptap/extension-placeholder v2.11,
      @tiptap/extension-typography v2.11,
      @tiptap/extension-character-count v2.11,
      @tiptap/extension-color v2.11,
      @tiptap/extension-highlight v2.11,
      @tiptap/extension-text-align v2.11,
      @tiptap/extension-underline v2.11,
      @tiptap/extension-superscript v2.11,
      @tiptap/extension-subscript v2.11,
      @tiptap/extension-link v2.11
    </tiptap_extensions>
    <markdown_conversion>
      turndown v7.2 (HTML → Markdown),
      marked v15.0 (Markdown → HTML),
      markdown-it v14.1 (alternative parser with plugin ecosystem)
    </markdown_conversion>
    <hwp>hwp.js v0.18 for HWP file parsing (Web Worker)</hwp>
    <syntax_highlight>shiki v1.29 for code block syntax highlighting</syntax_highlight>
    <math>katex v0.16 for mathematical formula rendering</math>
    <diagrams>mermaid v11.4 for diagram rendering</diagrams>
    <pdf>@react-pdf/renderer v4.1 for PDF export</pdf>
    <virtual_scroll>@tanstack/react-virtual v3.11 for large document virtualization</virtual_scroll>
    <dnd>@dnd-kit/core v6.3 + @dnd-kit/sortable v9.0 for block drag-and-drop</dnd>
    <icons>Lucide React v0.468 for icons</icons>
    <dates>date-fns v4.1 for date formatting</dates>
    <ids>nanoid v5.1 for unique IDs</ids>
    <file_handling>file-saver v2.0 for file downloads, jszip v3.10 for HWP container handling</file_handling>
    <toast>sonner v1.7 for toast notifications</toast>
  </libraries>
</technology_stack>

<prerequisites>
  <environment_setup>
    - Node.js v20+ and npm v10+ (or pnpm v9+)
    - Modern browser with IndexedDB support (Chrome 90+, Firefox 90+, Safari 15+)
    - Web Worker support required
  </environment_setup>
  <build_configuration>
    - Vite with React plugin + SWC for fast compilation
    - TypeScript strict mode enabled
    - Tailwind CSS v4 with @tailwindcss/vite plugin
    - Path alias: @ → src/
    - Web Worker inline support via Vite worker plugin
    - Chunk splitting: editor core / hwp worker / syntax highlighting → separate chunks
  </build_configuration>
</prerequisites>

<environment_variables>
  <note>Phase 1은 완전 클라이언트사이드 앱. .env 파일 불필요. 모든 설정은 vite.config.ts에서 컴파일 타임 처리.</note>
</environment_variables>

<file_structure>
src/
├── main.tsx                          # Entry point
├── app.tsx                           # Root component with router
├── db/
│   ├── index.ts                      # Dexie database instance + schema
│   ├── documents.ts                  # Document CRUD operations
│   ├── folders.ts                    # Folder CRUD operations
│   └── seed.ts                       # Development seed data
├── components/
│   ├── ui/                           # Reusable primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── modal.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── context-menu.tsx
│   │   ├── tooltip.tsx
│   │   ├── badge.tsx
│   │   ├── toggle.tsx
│   │   ├── empty-state.tsx
│   │   ├── search-input.tsx
│   │   └── skeleton.tsx
│   ├── layout/
│   │   ├── app-shell.tsx             # Sidebar + editor layout
│   │   ├── sidebar.tsx               # Document list + folders
│   │   ├── editor-area.tsx           # Main editor container
│   │   ├── status-bar.tsx            # Bottom status bar (word count, cursor pos)
│   │   └── toolbar.tsx               # Floating formatting toolbar
│   └── features/
│       ├── editor/
│       │   ├── editor.tsx            # TipTap editor wrapper
│       │   ├── bubble-menu.tsx       # Floating format menu on text selection
│       │   ├── slash-command.tsx      # Slash command popup
│       │   ├── block-handle.tsx      # Drag handle for blocks
│       │   ├── table-menu.tsx        # Table row/col controls
│       │   ├── image-upload.tsx      # Image block with paste/drag support
│       │   ├── code-block.tsx        # Code block with Shiki highlighting
│       │   ├── math-block.tsx        # KaTeX math block
│       │   ├── mermaid-block.tsx     # Mermaid diagram block
│       │   └── toc-panel.tsx         # Table of contents sidebar
│       ├── document/
│       │   ├── document-list.tsx     # Sidebar document list
│       │   ├── document-item.tsx     # Single document entry
│       │   ├── folder-item.tsx       # Folder entry in sidebar
│       │   ├── document-search.tsx   # Full-text search
│       │   └── document-info.tsx     # Document metadata modal
│       ├── import-export/
│       │   ├── hwp-import.tsx        # HWP import dialog
│       │   ├── hwp-export.tsx        # HWP export dialog
│       │   ├── md-import.tsx         # Markdown import
│       │   ├── pdf-export.tsx        # PDF export dialog
│       │   └── export-menu.tsx       # Export format selector
│       └── markdown-view/
│           ├── split-editor.tsx      # WYSIWYG + Markdown split view
│           ├── markdown-source.tsx   # Raw markdown editor (CodeMirror)
│           └── markdown-preview.tsx  # Rendered markdown preview
├── extensions/
│   ├── slash-command.ts              # TipTap slash command extension
│   ├── block-drag.ts                 # Block drag-and-drop extension
│   ├── trailing-node.ts             # Always keep empty line at end
│   ├── math-node.ts                  # KaTeX node extension
│   ├── mermaid-node.ts              # Mermaid diagram node
│   └── unique-id.ts                  # Unique block ID extension
├── workers/
│   ├── hwp-parser.worker.ts          # HWP file parsing in Web Worker
│   ├── hwp-generator.worker.ts       # HWP file generation in Web Worker
│   ├── search-index.worker.ts        # FlexSearch indexing worker
│   └── markdown-parser.worker.ts     # Heavy markdown parsing worker
├── stores/
│   ├── ui-store.ts                   # Sidebar state, theme, view mode
│   ├── editor-store.ts              # Active document, cursor position, selection
│   └── search-store.ts              # Search query, results
├── hooks/
│   ├── use-documents.ts              # Dexie liveQuery for documents
│   ├── use-folders.ts                # Dexie liveQuery for folders
│   ├── use-editor.ts                 # Editor instance management
│   ├── use-keyboard-shortcuts.ts     # Global keyboard shortcuts
│   ├── use-autosave.ts              # Debounced auto-save logic
│   ├── use-hwp.ts                    # HWP import/export hooks
│   └── use-search.ts                # Full-text search hook
├── lib/
│   ├── utils.ts                      # cn() helper, general utilities
│   ├── markdown.ts                   # Markdown ↔ HTML conversion utilities
│   ├── hwp-converter.ts             # HWP ↔ Markdown conversion logic
│   ├── pdf-generator.ts             # PDF generation from document
│   ├── file-utils.ts                # File read/write/download helpers
│   └── constants.ts                  # Colors, keyboard mappings, block types
├── types/
│   ├── index.ts                      # Document, Folder, Block types
│   ├── editor.ts                     # Editor-specific types
│   └── hwp.ts                        # HWP format types
└── styles/
    ├── globals.css                   # Tailwind imports + custom CSS
    ├── editor.css                    # TipTap editor styles
    └── print.css                     # Print/PDF styles

public/
├── fonts/
│   ├── pretendard-variable.woff2     # Korean-optimized variable font
│   └── jetbrains-mono.woff2         # Monospace font for code
└── workers/                          # Compiled worker scripts
</file_structure>

<core_data_entities>
  <document>
    - id: string (nanoid, 21 chars)
    - title: string (required, max 200 chars, default "제목 없음")
    - content: string (마크다운 원본 텍스트, max 10MB)
    - htmlContent: string (TipTap JSON → serialized HTML cache)
    - excerpt: string (첫 200자 자동 추출, 목록 표시용)
    - folderId: string | null (FK to folder.id, null = root)
    - tags: string[] (태그 배열, 각 태그 max 30 chars)
    - isFavorite: boolean (default false)
    - isPinned: boolean (default false)
    - wordCount: number (자동 계산)
    - charCount: number (자동 계산)
    - readingTime: number (분 단위, wordCount / 200)
    - sortOrder: number (폴더 내 정렬 순서)
    - createdAt: Date
    - updatedAt: Date
    - lastOpenedAt: Date
    Indexes: [folderId+sortOrder], [updatedAt], [isFavorite], [tags]
  </document>

  <folder>
    - id: string (nanoid, 21 chars)
    - name: string (required, max 100 chars)
    - parentId: string | null (FK to folder.id, null = root, 최대 3단계)
    - color: string (hex code, default #6B7280)
    - icon: string (emoji or Lucide icon name, default "folder")
    - isExpanded: boolean (default true, 사이드바 펼침 상태)
    - sortOrder: number
    - createdAt: Date
    - updatedAt: Date
    Indexes: [parentId+sortOrder], [name]
  </folder>

  <app_settings>
    - id: string (always "settings" — singleton)
    - theme: enum (light, dark, system) — default: system
    - editorFontSize: number (12-24, default 16)
    - editorFontFamily: enum (pretendard, system, serif) — default: pretendard
    - editorLineHeight: number (1.4-2.2, default 1.75)
    - editorMaxWidth: number (600-1200px, default 800)
    - showLineNumbers: boolean (default false, 마크다운 소스 뷰)
    - autosaveInterval: number (ms, default 1000)
    - defaultViewMode: enum (wysiwyg, split, source) — default: wysiwyg
    - sidebarWidth: number (200-400px, default 280)
    - spellCheck: boolean (default true)
    - lastOpenDocumentId: string | null
  </app_settings>
</core_data_entities>

<route_definitions>
  <routes>
    <route path="/" redirect="/documents" />
    <route path="/documents" page="DocumentListView" />
    <route path="/documents/:id" page="EditorView" />
    <route path="/documents/:id/preview" page="PreviewView" />
    <route path="/favorites" page="FavoritesView" />
    <route path="/tags/:tag" page="TagFilterView" />
    <route path="/search" page="SearchView" />
    <route path="/settings" page="SettingsView" />
  </routes>
  <note>Hash-based routing for static hosting compatibility.</note>
</route_definitions>

<component_hierarchy>
  <app>
    <theme_provider>
      <router>
        <app_shell>
          <sidebar width="280px" collapsible>
            <sidebar_header>
              <app_logo />              <!-- "MDView" + 로고 아이콘 -->
              <new_document_button />    <!-- + 버튼 -->
            </sidebar_header>
            <search_input />             <!-- Cmd+K 검색 -->
            <smart_views>               <!-- 고정 네비게이션 -->
              <nav_item label="모든 문서" icon="files" />
              <nav_item label="즐겨찾기" icon="star" />
              <nav_item label="최근 문서" icon="clock" />
            </smart_views>
            <divider />
            <folder_tree>               <!-- 폴더 + 문서 트리 -->
              <folder_item>             <!-- 접기/펼치기, 컨텍스트 메뉴 -->
                <document_item />       <!-- 문서명, 수정일, 미리보기 -->
              </folder_item>
              <add_folder_button />
            </folder_tree>
            <sidebar_footer>
              <import_button />         <!-- HWP/MD 임포트 -->
              <settings_button />
              <theme_toggle />
            </sidebar_footer>
          </sidebar>

          <editor_area>
            <editor_toolbar>            <!-- 서식 도구 모음 -->
              <block_type_selector />   <!-- 문단/제목1-6/인용문 -->
              <format_buttons />        <!-- 볼드/이탤릭/밑줄/취소선/코드 -->
              <list_buttons />          <!-- 순서/비순서/체크리스트 -->
              <insert_buttons />        <!-- 테이블/이미지/코드블록/수식/다이어그램 -->
              <align_buttons />         <!-- 좌/중/우 정렬 -->
              <view_mode_toggle />      <!-- WYSIWYG / Split / Source -->
              <export_menu />           <!-- HWP/PDF/MD 내보내기 -->
              <toc_toggle />            <!-- 목차 패널 토글 -->
            </editor_toolbar>

            <editor_content>
              <tiptap_editor />         <!-- WYSIWYG 편집 영역 -->
              <bubble_menu />           <!-- 텍스트 선택 시 플로팅 메뉴 -->
              <slash_command_popup />   <!-- / 입력 시 명령어 목록 -->
              <block_drag_handle />     <!-- 블록 좌측 드래그 핸들 -->
            </editor_content>

            <toc_panel width="240px">  <!-- 목차 사이드 패널 -->
              <toc_item />
            </toc_panel>

            <status_bar>               <!-- 하단 상태바 -->
              <word_count />
              <char_count />
              <reading_time />
              <cursor_position />
              <save_status />           <!-- 저장됨 / 저장 중... -->
            </status_bar>
          </editor_area>
        </app_shell>
      </router>
    </theme_provider>
  </app>

  <shared>
    <modal />
    <confirm_dialog />
    <dropdown_menu />
    <context_menu />
    <tooltip />
    <toast_container />               <!-- sonner toast -->
    <empty_state />
    <loading_skeleton />
    <file_drop_zone />                <!-- 전체 화면 파일 드롭 오버레이 -->
  </shared>
</component_hierarchy>

<pages_and_interfaces>
  <global_layout>
    <sidebar>
      - Fixed left panel, 280px width (resizable 200-400px), full height
      - Background: #FAFBFC (light) / #161618 (dark)
      - Border-right: 1px solid #E8EAED (light) / #2A2A2E (dark)
      - Header: 56px height, "MDView" 로고 16px semibold + 새 문서(+) 버튼 28px
      - 검색 입력: 36px height, 12px horizontal margin, placeholder "검색 (⌘K)"
      - Smart views: 각 항목 36px height, 12px padding, icon 18px + label 14px
      - Active item: background #E8F0FE (light) / #1A3A5C (dark), text #1967D2
      - 폴더 트리: indent 16px per level, 폴더 아이콘 + 이름 + 문서 수 badge
      - 문서 항목: 제목 14px 500weight, 수정일 12px #9AA0A6, 첫 줄 미리보기 12px #6B7280
      - Hover: background #F1F3F4 (light) / #28282C (dark)
      - Right-click context menu: 이름변경, 이동, 복제, 즐겨찾기, 삭제
      - Footer: 48px height, 임포트/설정/테마 토글 아이콘 24px
    </sidebar>

    <editor_area>
      - Flex-grow, min-width 500px
      - Background: #FFFFFF (light) / #1E1E20 (dark)
    </editor_area>
  </global_layout>

  <editor_toolbar>
    - Height: 44px, sticky top, border-bottom 1px solid #E8EAED (light) / #2A2A2E (dark)
    - Background: #FFFFFF (light) / #1E1E20 (dark)
    - 버튼 그룹: 구분선(1px #E8EAED, 16px height)으로 그룹 분리
    - 각 버튼: 32px square, border-radius 6px, icon 18px
    - Hover: background #F1F3F4 (light) / #28282C (dark)
    - Active (현재 적용된 서식): background #E8F0FE (light) / #1A3A5C (dark), icon color #1967D2
    - 블록 타입 셀렉터: 드롭다운 120px width, 현재 타입 표시 (본문/제목1-6/인용문/코드)
    - 뷰 모드 토글: 3-segment control (WYSIWYG | 분할 | 소스), 각 세그먼트 60px
    - 내보내기 메뉴: 드롭다운 (HWP/PDF/마크다운/HTML)
    - Overflow on mobile: horizontal scroll with fade indicator
  </editor_toolbar>

  <wysiwyg_editor>
    <editor_content>
      - Max width: 800px (설정에서 600-1200px 조절 가능), centered horizontally
      - Padding: 48px horizontal, 32px top, 120px bottom (스크롤 여유)
      - Font: Pretendard, 16px (설정에서 12-24px), line-height 1.75
      - 제목 입력 영역: 첫 줄, 36px / 700weight, placeholder "제목을 입력하세요" #BDC1C6
      - 본문 영역: placeholder "내용을 입력하세요. '/'를 눌러 블록을 추가하세요." #BDC1C6
      - 커서 위치: smooth caret animation (blink 530ms)
    </editor_content>

    <block_types>
      - 문단(Paragraph): 16px, line-height 1.75, margin-bottom 4px
      - 제목1(H1): 32px / 700, margin-top 40px, margin-bottom 16px, border-bottom 1px #E8EAED
      - 제목2(H2): 26px / 700, margin-top 32px, margin-bottom 12px
      - 제목3(H3): 22px / 600, margin-top 24px, margin-bottom 8px
      - 제목4(H4): 18px / 600, margin-top 20px, margin-bottom 6px
      - 제목5(H5): 16px / 600, margin-top 16px, margin-bottom 4px
      - 제목6(H6): 14px / 600 uppercase tracking-wide, margin-top 16px, margin-bottom 4px
      - 인용문(Blockquote): left border 3px #1967D2, padding-left 16px, italic, #5F6368
      - 순서 리스트(OL): decimal numbering, indent 24px per level, max 4 levels
      - 비순서 리스트(UL): disc/circle/square markers by level, indent 24px per level
      - 체크리스트: 18px checkbox + label, checked: strikethrough #9AA0A6
      - 코드 블록: background #F8F9FA (light) / #282A36 (dark), border-radius 8px, padding 16px, Shiki syntax highlighting, 언어 셀렉터 우상단, 복사 버튼
      - 테이블: bordered cells, header row bold #F1F3F4 bg, resize handles, add row/col buttons
      - 이미지: center aligned, max-width 100%, caption below 13px #6B7280, resize handles on corners
      - 수평선(HR): 1px #E8EAED, margin 24px vertical
      - 수식 블록: KaTeX rendered, click to edit LaTeX source in modal
      - 다이어그램: Mermaid rendered, click to edit source in modal, 400px min-height
    </block_types>

    <block_interactions>
      - Hover on block: 좌측에 드래그 핸들(6-dot grip) + +(추가) 버튼 표시, 24px left offset
      - 드래그 핸들 클릭: 블록 조작 메뉴 (복제/삭제/위로이동/아래로이동/블록타입변환)
      - + 버튼 클릭: 슬래시 명령어 메뉴 표시
      - 드래그: 블록 이동, drop indicator line 2px #1967D2
      - 선택: 블록 클릭 시 파란색 외곽선 2px #1967D2 (편집 모드 아닐 때)
      - 멀티 선택: Shift+Click 또는 Shift+Arrow로 여러 블록 선택, 선택된 블록 background #E8F0FE
    </block_interactions>

    <bubble_menu>
      - 텍스트 드래그 선택 시 나타남, 선택 영역 상단 8px 위
      - Background: #292929 (dark pill), border-radius 8px, padding 4px 8px
      - 버튼: 28px square, icon 16px white, divider 1px #4A4A4A
      - 항목: Bold | Italic | Underline | Strikethrough | Code | Link | Highlight color | Text color
      - Animation: fade-in 100ms, scale 0.95→1.0
    </bubble_menu>

    <slash_command>
      - '/' 입력 시 커서 아래 표시, 320px width, max-height 360px
      - Background: #FFFFFF (light) / #292929 (dark), shadow-lg, border-radius 12px
      - 카테고리별 그룹: 기본 | 미디어 | 고급
      - 기본: 텍스트, 제목1-3, 순서리스트, 비순서리스트, 체크리스트, 인용문, 구분선
      - 미디어: 이미지, 테이블, 코드 블록
      - 고급: 수식, 다이어그램, 목차
      - 각 항목: 40px height, icon 20px + name 14px + description 12px #9AA0A6
      - 검색 필터: 타이핑하면 실시간 필터링 (한글/영문 모두 지원)
      - Hover: background #F1F3F4 (light) / #333333 (dark)
      - 키보드: ↑/↓ 네비게이션, Enter 선택, Escape 닫기
    </slash_command>
  </wysiwyg_editor>

  <split_view>
    - 좌측: WYSIWYG 에디터 (50%)
    - 우측: 마크다운 소스 코드 (50%, CodeMirror 또는 textarea)
    - 가운데: resizable divider 4px, hover시 #1967D2
    - 동기 스크롤: 한쪽 스크롤 시 반대쪽 동기화
    - 동기 편집: 한쪽 수정 시 반대쪽 실시간 반영 (debounce 300ms)
    - 마크다운 소스: monospace font (JetBrains Mono), 14px, line numbers optional
  </split_view>

  <source_view>
    - Full-width 마크다운 소스 편집기
    - CodeMirror 6 기반, 마크다운 구문 강조
    - Line numbers, bracket matching, auto-indent
    - Max width: 900px, centered
    - Font: JetBrains Mono 14px, line-height 1.6
  </source_view>

  <document_list_view>
    <header>
      - Title: "모든 문서" / "즐겨찾기" / 폴더명, 24px / 700weight
      - 정렬: 드롭다운 (최근 수정 | 생성일 | 이름순 | 수동 정렬)
      - 보기 모드: 리스트 / 그리드 토글
    </header>
    <list_mode>
      - 각 항목: 72px height, padding 12px 16px
      - 제목: 15px / 500, 1줄 truncate
      - 미리보기: 13px #6B7280, 2줄 truncate
      - 수정일: 12px #9AA0A6, 우측
      - 태그 badge: 12px, rounded pill, 해당 폴더 색상 background
      - 즐겨찾기 아이콘: 별, 우측, 노란색 #FBBC04 (활성)
      - Hover: background #F1F3F4, 우측에 더보기(...) 메뉴 표시
    </list_mode>
    <grid_mode>
      - 카드: 240px width, 200px height, border-radius 12px
      - 상단 120px: 마크다운 미리보기 (overflow hidden, 12px font, #6B7280)
      - 하단 80px: 제목 14px / 500, 수정일 12px, 폴더 badge
      - Gap: 16px
      - Hover: shadow-md, translateY(-2px), 200ms ease
    </grid_mode>
    <empty_state>
      - Icon: file-plus (64px, #BDC1C6)
      - Title: "아직 문서가 없습니다" 18px / 600
      - Subtitle: "새 문서를 만들거나, 기존 마크다운 또는 HWP 파일을 임포트하세요" 14px #9AA0A6
      - CTA buttons: "새 문서 만들기" (primary) + "파일 임포트" (secondary)
    </empty_state>
  </document_list_view>

  <hwp_import_dialog>
    - 모달 500px width, border-radius 16px
    - Drop zone: 200px height, dashed border 2px #BDC1C6, "HWP 파일을 끌어다 놓으세요"
    - Browse button: "파일 선택" secondary button
    - 진행 표시: progress bar #1967D2, 퍼센트 표시, 현재 상태 메시지
    - 변환 옵션:
      - 이미지 처리: 포함(base64) / 별도 파일
      - 테이블 변환: 마크다운 테이블 / HTML 테이블
      - 스타일 유지: 글꼴 크기 → 제목 자동 매핑
    - 완료: "변환 완료! 문서를 열까요?" 확인/취소 버튼
    - 에러: 빨간 테두리, "지원하지 않는 HWP 형식입니다" 메시지 + 상세 에러 접기
  </hwp_import_dialog>

  <export_dialog>
    - 모달 440px width
    - Format selector: 큰 카드 버튼 (HWP | PDF | 마크다운 | HTML)
    - HWP 내보내기 옵션:
      - 용지 크기: A4 / Letter / B5
      - 여백: 기본 / 좁게 / 넓게
      - 글꼴: 맑은 고딕 / 바탕 / 돋움
    - PDF 내보내기 옵션:
      - 용지 크기, 여백
      - 헤더/푸터 포함 여부
      - 목차 포함 여부
    - 마크다운: 즉시 .md 파일 다운로드
    - HTML: 스타일 포함/미포함 선택
    - 진행 표시: spinner + "내보내는 중..."
    - 완료: 자동 다운로드 시작, "다운로드 완료" 토스트
  </export_dialog>

  <settings_view>
    - 모달 또는 별도 페이지 (600px max-width)
    - 섹션: 에디터 / 외관 / 파일
    - 에디터:
      - 글꼴 크기: 슬라이더 12-24px, 미리보기
      - 글꼴: Pretendard / 시스템 기본 / 서체 선택
      - 줄 높이: 슬라이더 1.4-2.2
      - 최대 너비: 슬라이더 600-1200px
      - 맞춤법 검사: 토글
      - 자동 저장 간격: 1초 / 3초 / 5초
    - 외관:
      - 테마: 라이트 / 다크 / 시스템
      - 사이드바 너비: 슬라이더
    - 파일:
      - 데이터 내보내기 (전체 JSON 백업)
      - 데이터 가져오기
      - 모든 데이터 삭제 (위험, 이중 확인)
  </settings_view>

  <toc_panel>
    - Right panel, 240px width, slide-in 200ms
    - 제목: "목차" 14px / 600
    - 각 항목: indent by heading level (H1: 0, H2: 16px, H3: 32px)
    - 텍스트: 13px, truncate 1줄
    - Active heading: #1967D2 text, left border 2px #1967D2
    - Click: 해당 위치로 smooth scroll
    - 현재 스크롤 위치에 따라 활성 항목 하이라이트 (Intersection Observer)
  </toc_panel>

  <keyboard_shortcuts_reference>
    <!-- 서식 -->
    - Cmd+B: 볼드
    - Cmd+I: 이탤릭
    - Cmd+U: 밑줄
    - Cmd+Shift+S: 취소선
    - Cmd+E: 인라인 코드
    - Cmd+K: 링크 삽입
    - Cmd+Shift+H: 하이라이트

    <!-- 블록 -->
    - Cmd+Shift+1~6: 제목 1-6
    - Cmd+Shift+7: 순서 리스트
    - Cmd+Shift+8: 비순서 리스트
    - Cmd+Shift+9: 체크리스트
    - Cmd+Shift+B: 인용문
    - Cmd+Alt+C: 코드 블록

    <!-- 네비게이션 -->
    - Cmd+K: 전체 검색 (사이드바 포커스가 아닐 때 링크)
    - Cmd+\: 사이드바 토글
    - Cmd+Shift+E: 뷰 모드 전환 (WYSIWYG → Split → Source)
    - Cmd+S: 강제 저장 (자동저장이지만 시각적 확인)
    - Cmd+N: 새 문서
    - Cmd+Shift+N: 새 폴더
    - Cmd+P: 빠른 문서 열기 (fuzzy search 팝업)

    <!-- 블록 조작 -->
    - Cmd+Shift+↑: 블록 위로 이동
    - Cmd+Shift+↓: 블록 아래로 이동
    - Cmd+D: 블록 복제
    - Cmd+Shift+Delete: 블록 삭제
    - Tab: 들여쓰기 (리스트 내)
    - Shift+Tab: 내어쓰기

    <!-- 임포트/내보내기 -->
    - Cmd+Shift+I: HWP/파일 임포트
    - Cmd+Shift+X: 내보내기 메뉴
  </keyboard_shortcuts_reference>
</pages_and_interfaces>

<core_functionality>
  <document_management>
    - 새 문서 생성: Cmd+N 또는 + 버튼, 즉시 편집 모드 진입
    - 문서 열기: 사이드바 클릭 또는 Cmd+P 빠른 열기
    - 문서 삭제: 컨텍스트 메뉴, 확인 다이얼로그 필수
    - 문서 복제: 컨텍스트 메뉴, "[원본 제목] 복사본"으로 생성
    - 문서 이동: 드래그앤드롭으로 폴더 간 이동
    - 즐겨찾기: 별 아이콘 토글, 즐겨찾기 뷰에서 모아보기
    - 태그: 문서 정보 모달에서 태그 추가/제거, 태그별 필터링
    - 정렬: 최근 수정 / 생성일 / 이름순 / 수동(드래그)
  </document_management>

  <folder_management>
    - 폴더 생성: Cmd+Shift+N 또는 사이드바 "폴더 추가" 버튼
    - 폴더 이름 변경: 더블클릭 인라인 편집
    - 폴더 삭제: 하위 문서를 상위 폴더 또는 루트로 이동 후 삭제
    - 폴더 중첩: 최대 3단계 깊이
    - 폴더 색상: 8가지 프리셋 색상 선택
    - 폴더 접기/펼치기: 화살표 클릭 또는 더블클릭
  </folder_management>

  <editing>
    - WYSIWYG 블록 편집: TipTap 기반, 마크다운 문법 자동 변환
    - 마크다운 단축키 자동 변환:
      - '# ' → H1, '## ' → H2, ... '######' → H6
      - '- ' 또는 '* ' → 비순서 리스트
      - '1. ' → 순서 리스트
      - '[] ' 또는 '[ ] ' → 체크리스트
      - '> ' → 인용문
      - '```' → 코드 블록
      - '---' → 수평선
      - '$$' → 수식 블록
    - 슬래시 명령어: '/' 입력으로 모든 블록 타입 빠르게 삽입
    - 이미지 삽입: 클립보드 붙여넣기, 드래그앤드롭, 파일 선택
    - 이미지 저장: Base64로 IndexedDB에 인라인 저장
    - 테이블: 행/열 추가삭제, 셀 병합(Phase 2), 헤더 행 토글
    - 실시간 자동 저장: 편집 후 1초(설정 가능) debounce로 IndexedDB 저장
    - Undo/Redo: Cmd+Z / Cmd+Shift+Z, TipTap history extension
  </editing>

  <hwp_import>
    - 지원 포맷: .hwp (한글 97 이상), .hwpx (OOXML 기반 한글)
    - 파싱: Web Worker에서 hwp.js로 HWP 파일 구조 분석
    - 변환 매핑:
      - HWP 문단 → 마크다운 문단
      - HWP 제목 스타일 → H1-H6 (글꼴 크기 기반 자동 매핑: 20pt+ → H1, 16pt+ → H2, 14pt+ → H3)
      - HWP 표 → 마크다운 테이블 (복잡한 병합 셀은 HTML 테이블로 fallback)
      - HWP 이미지 → Base64 인라인 이미지
      - HWP 글머리 기호 → 마크다운 리스트
      - HWP 번호 매기기 → 마크다운 순서 리스트
      - HWP 볼드/이탤릭/밑줄 → 마크다운 인라인 서식
      - HWP 하이퍼링크 → 마크다운 링크
    - 진행률 표시: Worker에서 progress 메시지 전송, UI에서 프로그레스바 표시
    - 에러 처리: 파싱 실패 시 상세 에러 메시지, 부분 성공 시 변환된 부분만 표시 + 경고
  </hwp_import>

  <hwp_export>
    - 마크다운 → HWP 변환 파이프라인:
      1. 마크다운 → HTML (marked)
      2. HTML → HWP 문서 구조 (커스텀 변환 로직)
      3. HWP 문서 구조 → HWP 바이너리 (Web Worker)
    - 변환 매핑:
      - H1-H6 → HWP 제목 스타일 (개요 번호 자동 매핑)
      - 문단 → HWP 본문 문단 (맑은 고딕 10pt 기본)
      - 테이블 → HWP 표 (테두리, 배경색 유지)
      - 이미지 → HWP 인라인 이미지 (크기 자동 조절)
      - 코드 블록 → HWP 박스 (회색 배경, 고정폭 글꼴)
      - 리스트 → HWP 글머리 기호/번호 매기기
    - 용지 설정: A4 기본, 여백 (상하좌우 20mm 기본)
    - 출력: .hwp 파일 다운로드 (file-saver)
  </hwp_export>

  <search>
    - 전체 검색 (Cmd+K): 문서 제목 + 내용 full-text 검색
    - FlexSearch 기반, Web Worker에서 인덱싱
    - 결과: 문서 제목, 매칭 텍스트 스니펫 (키워드 하이라이트), 수정일
    - 인스턴트 결과: 타이핑 즉시 결과 표시 (debounce 100ms)
    - 최대 50건 표시, 관련도 순 정렬
    - 한글 형태소 분석: 기본 토크나이저 (조사 분리는 Phase 2)
  </search>

  <data_persistence>
    - 모든 변경사항 IndexedDB에 자동 저장 (debounce 1초)
    - Dexie.js liveQuery로 사이드바 실시간 업데이트
    - 문서 내용: 마크다운 원본 + TipTap JSON 캐시 동시 저장
    - 상태바에 저장 상태 표시: "저장됨" / "저장 중..." / "저장 실패"
    - 데이터 백업: JSON 내보내기/가져오기 (설정에서)
  </data_persistence>
</core_functionality>

<error_handling>
  <user_facing>
    <toast_notifications>
      - Success: #22C55E bg, 3초 auto-dismiss, bottom-right
      - Error: #EF4444 bg, persistent until dismissed, bottom-right
      - Warning: #F59E0B bg, 5초 auto-dismiss, bottom-right
      - Info: #3B82F6 bg, 3초 auto-dismiss, bottom-right
      - Max 3 toasts 동시 표시, FIFO
    </toast_notifications>
    <form_validation>
      - 문서 제목: 비어있으면 "제목 없음"으로 자동 설정 (에러 아님)
      - 폴더 이름: 필수, 빈칸 제출 시 빨간 테두리 + "폴더 이름을 입력하세요"
      - 태그: 최대 10개, 각 30자, 초과 시 경고 토스트
    </form_validation>
    <error_states>
      - IndexedDB 접근 불가 (시크릿 모드): 전체 화면 안내 메시지 + 일반 모드 전환 안내
      - 저장 실패: status bar에 빨간 "저장 실패" + 재시도 버튼
      - HWP 파싱 실패: 모달에 에러 상세 + "다른 파일 선택" CTA
      - HWP 내보내기 실패: 에러 토스트 + 마크다운으로 대체 내보내기 제안
      - 이미지 로드 실패: broken image placeholder + "이미지를 불러올 수 없습니다" 텍스트
      - 브라우저 저장 공간 부족: 경고 배너 "저장 공간이 부족합니다. 불필요한 문서를 삭제해주세요."
    </error_states>
  </user_facing>
  <error_boundaries>
    - 에디터 영역 Error Boundary: 에러 시 마크다운 소스 모드로 fallback
    - 각 블록(코드/수식/다이어그램)에 개별 Error Boundary: 렌더링 실패 시 원본 소스 표시
    - 사이드바 Error Boundary: 에러 시 기본 문서 리스트 표시
  </error_boundaries>
</error_handling>

<aesthetic_guidelines>
  <design_philosophy>
    미니멀하고 콘텐츠 중심의 디자인. Google Docs의 깔끔함 + Notion의 블록 편집 직관성 + iA Writer의 집중 모드를 결합합니다. 작성하는 콘텐츠가 UI보다 돋보여야 합니다. 과도한 장식을 배제하고, 타이포그래피와 여백으로 시각적 계층을 만듭니다. 한글 타이포그래피에 최적화된 폰트와 행간을 사용합니다.
  </design_philosophy>

  <color_palette>
    <light_theme>
      - Background: #FFFFFF
      - Sidebar bg: #FAFBFC
      - Surface: #F1F3F4
      - Surface hover: #E8EAED
      - Border: #E8EAED
      - Text primary: #202124
      - Text secondary: #5F6368
      - Text muted: #9AA0A6
      - Text placeholder: #BDC1C6
      - Accent primary: #1967D2
      - Accent hover: #1558B0
      - Accent light: #E8F0FE
      - Success: #34A853
      - Warning: #FBBC04
      - Danger: #EA4335
      - Info: #4285F4
      - Code bg: #F8F9FA
      - Selection: #C2DBFF
    </light_theme>
    <dark_theme>
      - Background: #1E1E20
      - Sidebar bg: #161618
      - Surface: #28282C
      - Surface hover: #333338
      - Border: #2A2A2E
      - Text primary: #E8EAED
      - Text secondary: #9AA0A6
      - Text muted: #6B7280
      - Text placeholder: #5F6368
      - Accent primary: #8AB4F8
      - Accent hover: #AECBFA
      - Accent light: #1A3A5C
      - Success: #81C995
      - Warning: #FDD663
      - Danger: #F28B82
      - Info: #8AB4F8
      - Code bg: #282A36
      - Selection: #264F78
    </dark_theme>
  </color_palette>

  <typography>
    <font_families>
      - Primary: "Pretendard Variable", "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
      - Monospace: "JetBrains Mono", "Fira Code", "Consolas", monospace
      - Serif (optional): "Noto Serif KR", "Batang", Georgia, serif
    </font_families>
    <font_sizes>
      - App title/logo: 18px / 700
      - Document title (editor): 36px / 700
      - H1: 32px / 700
      - H2: 26px / 700
      - H3: 22px / 600
      - H4: 18px / 600
      - H5: 16px / 600
      - H6: 14px / 600 uppercase
      - Body: 16px / 400 (설정에서 12-24 조절)
      - Sidebar nav: 14px / 500
      - Sidebar doc preview: 13px / 400
      - Caption/badge: 12px / 500
      - Status bar: 12px / 400
      - Code: 14px / 400 monospace
    </font_sizes>
    <line_heights>
      - Headings: 1.3
      - Body: 1.75 (설정에서 1.4-2.2 조절)
      - Code: 1.5
      - UI elements: 1.4
    </line_heights>
  </typography>

  <spacing>
    - Base unit: 4px
    - Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 120
  </spacing>

  <borders_and_shadows>
    <borders>
      - Default: 1px solid #E8EAED (light) / #2A2A2E (dark)
      - Focus ring: 2px solid #1967D2 (light) / #8AB4F8 (dark)
      - Border radius small: 6px (buttons, inputs)
      - Border radius medium: 8px (cards, code blocks)
      - Border radius large: 12px (modals, dropdowns)
      - Border radius xl: 16px (dialogs)
    </borders>
    <shadows>
      - sm: 0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.1)
      - md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)
      - lg: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)
      - xl: 0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.04)
      - Dark mode shadows: use rgba(0,0,0,0.3) base
    </shadows>
  </borders_and_shadows>

  <component_styling>
    <buttons>
      - Primary: bg #1967D2, text white, hover #1558B0, height 36px, px 16px, radius 6px
      - Secondary: bg transparent, border 1px #E8EAED, text #5F6368, hover bg #F1F3F4, height 36px
      - Ghost: bg transparent, text #5F6368, hover bg #F1F3F4, height 36px
      - Danger: bg #EA4335, text white, hover #D33828
      - Disabled: opacity 0.5, cursor not-allowed
      - Icon button: 32px square, radius 6px, hover bg #F1F3F4
    </buttons>
    <inputs>
      - Height: 36px, padding 8px 12px, border 1px #E8EAED, radius 6px
      - Focus: border #1967D2, ring 2px #E8F0FE
      - Placeholder: #BDC1C6
      - Error: border #EA4335
    </inputs>
    <modals>
      - Backdrop: rgba(0,0,0,0.5), blur 4px
      - Content: bg white (light) / #28282C (dark), radius 16px, padding 24px
      - Max width varies: 440px (small), 560px (medium), 720px (large)
      - Animation: backdrop fade 200ms, content scale 0.95→1.0 + fade 200ms
    </modals>
  </component_styling>

  <animations>
    <micro_interactions>
      - Button press: scale 0.97, 100ms ease
      - Toggle switch: slide 200ms ease-out
      - Checkbox: scale bounce 0.8→1.1→1.0, 200ms
      - Save indicator: fade in/out 300ms
    </micro_interactions>
    <page_transitions>
      - Document switch: content cross-fade 150ms
      - View mode switch: cross-fade 200ms
    </page_transitions>
    <panel_animations>
      - Sidebar toggle: slide 200ms ease-out
      - TOC panel: slide 200ms ease-out
      - Detail panel: slide 200ms ease-out
    </panel_animations>
    <drag_and_drop>
      - Pickup: scale 1.02, shadow-lg, 150ms ease
      - Drop indicator: 2px line #1967D2, fade-in 100ms
      - Drop: scale 1.0, shadow-none, 200ms ease
    </drag_and_drop>
    <loading_states>
      - Skeleton: shimmer gradient animation 1.5s infinite
      - Spinner: rotate 1s linear infinite, #1967D2
      - Progress bar: smooth width transition 300ms
    </loading_states>
  </animations>

  <responsive_design>
    <breakpoints>
      - mobile: 0–767px (사이드바 숨김, 하단 탭 바, 전체 너비 에디터)
      - tablet: 768–1023px (접을 수 있는 사이드바 오버레이, 에디터만 표시)
      - desktop: 1024–1439px (사이드바 + 에디터, TOC는 토글)
      - wide: 1440px+ (사이드바 + 에디터 + TOC 동시 표시)
    </breakpoints>
    <mobile_adaptations>
      - 사이드바 → slide-in drawer (280px, 좌측에서, backdrop overlay)
      - 툴바 → 하단 고정 간소화 툴바 (주요 서식만, 좌우 스크롤)
      - 슬래시 명령어 → bottom sheet (하단에서 슬라이드 업)
      - 버블 메뉴 → 하단 고정 포맷 바
      - TOC → full-screen modal
      - 내보내기 → full-screen modal
      - 드래그앤드롭 → 비활성, 위/아래 이동 버튼으로 대체
      - 최소 터치 대상: 44x44px
    </mobile_adaptations>
    <touch_interactions>
      - 문서 항목 스와이프 좌: 삭제 (빨강 80px)
      - 문서 항목 스와이프 우: 즐겨찾기 (노랑 80px)
      - Pull-to-refresh: 문서 리스트에서 (로컬이므로 시각적 피드백만)
      - Long-press (500ms): 컨텍스트 메뉴
    </touch_interactions>
  </responsive_design>

  <icons>
    - Library: Lucide React
    - Default size: 18px (toolbar), 20px (sidebar), 24px (empty states)
    - Stroke width: 1.75px
    - Color: inherit from text color
  </icons>

  <accessibility>
    - WCAG 2.1 Level AA contrast ratios
    - All interactive elements: visible focus ring (2px #1967D2)
    - Tab navigation: sidebar → toolbar → editor → status bar
    - Screen reader: ARIA labels on all icon-only buttons
    - Reduced motion: @media (prefers-reduced-motion: reduce) → 모든 애니메이션 비활성
    - Editor: semantic HTML tags (h1-h6, ul, ol, blockquote, table)
  </accessibility>
</aesthetic_guidelines>

<security_considerations>
  <data_protection>
    - 모든 데이터는 로컬 IndexedDB에 저장 — 브라우저 외부로 데이터 전송 없음
    - 외부 네트워크 요청 없음 (Phase 1)
    - 이미지: Base64 인라인 저장, 외부 URL 참조 없음
    - CRITICAL: 데이터 삭제 시 IndexedDB에서 완전 삭제 (soft delete 없음, Phase 1)
  </data_protection>
  <input_validation>
    - 문서 제목: max 200자, HTML 태그 스트립
    - 문서 내용: max 10MB
    - 폴더 이름: max 100자, HTML 태그 스트립
    - 태그: max 30자, 특수문자 제한 (영문, 한글, 숫자, 하이픈, 언더스코어)
    - 파일 업로드: HWP/HWPX/MD 파일만 허용, max 50MB
    - 이미지: image/png, image/jpeg, image/gif, image/webp, image/svg+xml만 허용, max 10MB 개당
    - CRITICAL: 임포트된 HWP 내 스크립트/매크로 실행 차단
  </input_validation>
  <client_security>
    - TipTap 에디터: XSS 방지 위해 HTML 렌더링 시 DOMPurify 적용
    - CSP 헤더: script-src 'self' (외부 스크립트 차단)
    - 마크다운 렌더링: sanitize HTML output from marked/markdown-it
  </client_security>
</security_considerations>

<advanced_functionality>
  <theme_switching>
    - 라이트 / 다크 / 시스템 3가지 모드
    - 시스템 모드: prefers-color-scheme 미디어 쿼리 추적
    - localStorage key "mdview-theme"에 저장
    - 전환 애니메이션: cross-fade 200ms
  </theme_switching>

  <focus_mode>
    - 사이드바 + 툴바 + 상태바 숨기고 에디터만 전체 화면
    - Cmd+Shift+F로 토글
    - 마우스를 상단 가장자리로 이동 시 툴바 일시 표시
    - Escape로 해제
  </focus_mode>

  <quick_open>
    - Cmd+P: 문서 빠른 열기 팝업
    - fuzzy search로 문서 제목 매칭
    - 최근 열었던 문서 우선 표시
    - 360px width, 최대 8개 결과, ↑/↓ 네비게이션
  </quick_open>

  <file_drop>
    - 앱 어디서든 파일을 드래그앤드롭으로 임포트
    - 드롭 시 전체 화면 오버레이 표시 ("여기에 놓으세요")
    - .md → 바로 문서 생성
    - .hwp/.hwpx → HWP 임포트 다이얼로그 표시
    - 이미지 파일 → 현재 커서 위치에 이미지 삽입
  </file_drop>

  <performance_optimizations>
    CRITICAL: 다음 최적화를 반드시 구현
    - Web Worker에서 HWP 파싱/생성 (메인 스레드 블로킹 방지)
    - Web Worker에서 FlexSearch 인덱싱
    - Shiki 구문 강조: lazy load (코드 블록 진입 시)
    - Mermaid 다이어그램: lazy render (뷰포트 진입 시)
    - KaTeX 수식: lazy render (뷰포트 진입 시)
    - 문서 리스트: 가상 스크롤 (@tanstack/react-virtual) — 1000+ 문서 대응
    - 대용량 문서 (5000줄+): 블록 단위 가상 렌더링
    - 이미지: lazy loading (loading="lazy")
    - 코드 스플리팅: 에디터 core / HWP worker / syntax highlighting / math / diagrams 분리
    - React.memo: 모든 리스트 아이템, 사이드바 항목
    - 자동저장: requestIdleCallback 활용
  </performance_optimizations>

  <print_support>
    - Cmd+P (브라우저 기본 인쇄) 시 깨끗한 인쇄 레이아웃
    - print.css: 사이드바/툴바/상태바 숨김, 본문만 표시
    - 페이지 나눔 최적화: 제목 앞에 page-break-before, 코드 블록 중간 나눔 방지
  </print_support>
</advanced_functionality>

<final_integration_test>
  <test_scenario_1>
    <description>문서 생성 및 WYSIWYG 편집</description>
    <steps>
      1. 앱 열기 — "모든 문서" 빈 상태 화면 확인
      2. Cmd+N으로 새 문서 생성 — 에디터 진입 확인
      3. 제목 "테스트 문서" 입력 — 사이드바에 실시간 반영 확인
      4. 본문에 '# 첫 번째 장' 입력 후 Enter — H1으로 자동 변환 확인
      5. 일반 텍스트 입력 → 텍스트 드래그 선택 → 버블 메뉴에서 볼드 클릭 → 볼드 적용 확인
      6. '/' 입력 → 슬래시 명령어 메뉴 표시 → "코드 블록" 선택 → 코드 블록 삽입 확인
      7. 코드 블록에 JavaScript 코드 입력 → 구문 강조 확인
      8. '/' → "테이블" 선택 → 3x3 테이블 삽입 → 셀에 텍스트 입력 확인
      9. 상태바에서 글자수/단어수 확인
      10. 1초 대기 후 상태바 "저장됨" 확인
      11. 브라우저 새로고침 → 문서 내용 유지 확인
    </steps>
  </test_scenario_1>

  <test_scenario_2>
    <description>HWP 파일 임포트 및 편집</description>
    <steps>
      1. 사이드바 하단 "임포트" 버튼 클릭 — 임포트 다이얼로그 표시
      2. 샘플 .hwp 파일 드래그앤드롭 — 파일명 표시 + 변환 시작
      3. 프로그레스바 진행 확인 — "변환 중..." 메시지 표시
      4. 변환 완료 — "문서를 열까요?" 확인 버튼 클릭
      5. 에디터에 변환된 문서 표시 — 제목, 본문, 서식 확인
      6. HWP의 표가 마크다운 테이블로 변환되었는지 확인
      7. HWP의 이미지가 인라인 이미지로 표시되는지 확인
      8. 변환된 문서 수정 — 제목 변경, 문단 추가
      9. Cmd+Shift+E로 Split View 전환 — 마크다운 소스 확인
      10. 마크다운이 올바르게 생성되었는지 확인
    </steps>
  </test_scenario_2>

  <test_scenario_3>
    <description>HWP 내보내기</description>
    <steps>
      1. 문서 편집 상태에서 내보내기 메뉴 클릭
      2. "HWP" 포맷 선택
      3. 용지 A4, 글꼴 "맑은 고딕" 선택
      4. "내보내기" 버튼 클릭 — 진행 표시
      5. 파일 다운로드 시작 확인 — 파일명 "[문서제목].hwp"
      6. "다운로드 완료" 토스트 표시 확인
      7. 다운로드된 HWP 파일을 한글 프로그램에서 열기 — 내용 확인
      8. 제목, 본문, 표, 이미지가 올바르게 표시되는지 확인
    </steps>
  </test_scenario_3>

  <test_scenario_4>
    <description>폴더 관리 및 문서 정리</description>
    <steps>
      1. Cmd+Shift+N으로 "프로젝트" 폴더 생성 확인
      2. 폴더 색상 변경 (파란색 → 초록색) 확인
      3. 문서를 폴더로 드래그앤드롭 이동 확인
      4. 폴더 접기/펼치기 동작 확인
      5. 문서에 "중요" 태그 추가 → 태그 badge 표시 확인
      6. 별 아이콘 클릭 → 즐겨찾기 추가 확인
      7. "즐겨찾기" 뷰로 이동 → 해당 문서 표시 확인
      8. Cmd+K로 검색 → 문서 제목/내용 검색 결과 확인
      9. 하위 폴더 생성 (최대 3단계) 확인
      10. 폴더 삭제 → 하위 문서 상위 폴더로 이동 확인
    </steps>
  </test_scenario_4>

  <test_scenario_5>
    <description>키보드 단축키 및 뷰 모드 전환</description>
    <steps>
      1. Cmd+B → 볼드 토글 확인
      2. Cmd+I → 이탤릭 토글 확인
      3. Cmd+Shift+1 → H1 변환 확인
      4. Cmd+Shift+7 → 순서 리스트 변환 확인
      5. Tab → 리스트 들여쓰기 확인
      6. Cmd+\ → 사이드바 토글 확인
      7. Cmd+Shift+E → WYSIWYG → Split → Source 순환 전환 확인
      8. Split View에서 좌측 WYSIWYG 편집 → 우측 마크다운 동기화 확인
      9. Source View에서 마크다운 직접 편집 → WYSIWYG로 전환 시 반영 확인
      10. Cmd+P → 빠른 열기 팝업 → fuzzy search 동작 확인
    </steps>
  </test_scenario_5>

  <test_scenario_6>
    <description>대용량 문서 성능 테스트</description>
    <steps>
      1. 10,000줄 마크다운 파일 임포트
      2. 에디터 로딩 시간 2초 이내 확인
      3. 스크롤 시 60fps 유지 확인 (Chrome DevTools Performance)
      4. 텍스트 입력 시 지연 없이 즉시 반영 확인 (< 16ms)
      5. 슬래시 명령어 팝업 즉시 표시 확인
      6. 전체 검색 결과 500ms 이내 반환 확인
      7. 자동 저장 시 UI 프리즈 없음 확인
      8. HWP 내보내기 시 프로그레스바 표시 + UI 반응성 유지 확인
    </steps>
  </test_scenario_6>

  <test_scenario_7>
    <description>모바일 반응형 테스트</description>
    <steps>
      1. 375px 너비에서 앱 로드 — 사이드바 숨김 + 하단 간소화 툴바 확인
      2. 햄버거 메뉴 탭 → 사이드바 드로어 슬라이드 확인
      3. 문서 선택 → 에디터 진입 + 사이드바 자동 닫힘 확인
      4. 텍스트 선택 → 하단 포맷 바 표시 확인
      5. 문서 항목 좌 스와이프 → 삭제 액션 표시 확인
      6. 문서 항목 우 스와이프 → 즐겨찾기 액션 표시 확인
      7. 터치 대상 44x44px 최소 크기 확인
    </steps>
  </test_scenario_7>
</final_integration_test>

<success_criteria>
  <functionality>
    - 마크다운 WYSIWYG 편집이 모든 블록 타입에서 정상 동작
    - 마크다운 자동 변환 단축키 (# , - , 1. , ``` 등) 100% 동작
    - 슬래시 명령어로 모든 블록 타입 삽입 가능
    - HWP 파일 임포트 시 텍스트, 서식, 표, 이미지 90% 이상 정확도로 변환
    - HWP 내보내기 시 한글 프로그램에서 정상 렌더링
    - 문서 CRUD + 폴더 관리 + 검색 정상 동작
    - 3가지 뷰 모드 (WYSIWYG/Split/Source) 전환 및 동기화
    - 모든 키보드 단축키 정상 동작
    - 자동 저장 + 수동 저장 정상 동작
  </functionality>
  <user_experience>
    - 초기 로드: 1.5초 이내 (3G throttling)
    - 문서 열기: 500ms 이내 (10,000줄 문서)
    - 키 입력 반응: 16ms 이내 (60fps)
    - 슬래시 명령어 팝업: 100ms 이내
    - 검색 결과: 200ms 이내 (1000개 문서)
    - HWP 임포트: 10MB 파일 기준 5초 이내
    - 스크롤 성능: 대용량 문서에서 60fps 유지
    - Lighthouse Performance 점수 90+
  </user_experience>
  <technical_quality>
    - TypeScript strict mode 에러 0건
    - 모든 컴포넌트 명시적 prop 인터페이스
    - 프로덕션 빌드 console.error 0건
    - 번들 사이즈: 초기 로드 200KB gzip 이내 (에디터 코어 lazy load)
    - Web Worker 분리: HWP 파싱, 검색 인덱싱, 마크다운 파싱
  </technical_quality>
  <visual_design>
    - 라이트/다크 테마 일관된 컬러 시스템
    - Pretendard 폰트 한글 렌더링 최적화
    - 모든 인터랙티브 요소 hover/focus/active 상태 정의
    - 반응형 레이아웃 4단계 브레이크포인트 대응
    - 모든 빈 상태(empty state) 디자인 적용
  </visual_design>
  <build>
    - npm run build 성공, 정적 파일 생성
    - Chrome 90+, Firefox 90+, Safari 15+ 호환
    - Netlify/Vercel/GitHub Pages 배포 가능
    - 오프라인 동작 (Service Worker 캐싱 — PWA)
  </build>
</success_criteria>

<build_output>
  <build_command>npm run build</build_command>
  <output_directory>dist/</output_directory>
  <contents>index.html + JS/CSS 번들 + Web Worker 스크립트 + 폰트, 정적 호스팅 배포 가능</contents>
  <pwa>vite-plugin-pwa로 Service Worker 생성, 오프라인 캐싱</pwa>
</build_output>

<key_implementation_notes>
  <critical_paths>
    1. TipTap 에디터 설정 + 마크다운 ↔ HTML 변환 — 전체 앱의 핵심
    2. HWP 파싱/생성 Web Worker — 가장 복잡한 기능, hwp.js 한계 이해 필요
    3. 블록 드래그앤드롭 + 슬래시 명령어 — 사용성의 핵심 차별점
    4. 대용량 문서 성능 — 가상 스크롤링과 Worker 기반 처리
  </critical_paths>

  <recommended_implementation_order>
    1. 프로젝트 셋업 (Vite + React + TypeScript + Tailwind + Path alias)
    2. Dexie.js 데이터베이스 스키마 + CRUD 유틸리티
    3. App Shell 레이아웃 (사이드바 + 에디터 영역 + 상태바)
    4. TipTap 에디터 기본 설정 (기본 노드/마크, placeholder)
    5. 마크다운 ↔ TipTap JSON 변환 (turndown + marked)
    6. 문서 CRUD + 사이드바 네비게이션
    7. 에디터 툴바 (서식 버튼, 블록 타입 셀렉터)
    8. 버블 메뉴 (텍스트 선택 시)
    9. 슬래시 명령어 시스템
    10. 블록 드래그앤드롭 (@dnd-kit)
    11. 코드 블록 + Shiki 구문 강조
    12. 테이블 편집 기능
    13. 이미지 삽입 (paste, drag, file picker)
    14. 폴더 관리 + 문서 정리
    15. HWP 임포트 (Web Worker + hwp.js)
    16. HWP 내보내기 (Web Worker)
    17. Split View + Source View
    18. 검색 (FlexSearch Worker)
    19. 수식 (KaTeX) + 다이어그램 (Mermaid) 블록
    20. 목차(TOC) 패널
    21. PDF 내보내기
    22. 키보드 단축키 통합
    23. 다크 모드 + 테마 전환
    24. 설정 페이지
    25. 반응형 디자인 + 모바일 대응
    26. 포커스 모드 + 빠른 열기
    27. PWA + Service Worker
    28. 성능 최적화 + 코드 스플리팅
    29. 인쇄 스타일
    30. 테스트 + 버그 수정 + 폴리시
  </recommended_implementation_order>

  <database_schema>
    ```typescript
    import Dexie, { type EntityTable } from 'dexie';
    import type { Document, Folder, AppSettings } from '@/types';

    const db = new Dexie('MDViewDB') as Dexie & {
      documents: EntityTable<Document, 'id'>;
      folders: EntityTable<Folder, 'id'>;
      settings: EntityTable<AppSettings, 'id'>;
    };

    db.version(1).stores({
      documents: 'id, [folderId+sortOrder], updatedAt, isFavorite, *tags',
      folders: 'id, [parentId+sortOrder], name',
      settings: 'id',
    });

    export { db };
    ```
  </database_schema>

  <performance_considerations>
    - CRITICAL: HWP 파싱은 반드시 Web Worker에서 실행. 메인 스레드에서 절대 실행 금지.
    - CRITICAL: Shiki, KaTeX, Mermaid는 해당 블록이 뷰포트에 진입할 때만 lazy render.
    - TipTap 에디터는 React.memo로 불필요한 리렌더링 방지.
    - 문서 리스트 1000개 이상 시 @tanstack/react-virtual 가상 스크롤링 필수.
    - 이미지 Base64: 개당 최대 10MB 제한, 문서당 총 50MB 경고.
    - 자동저장: requestIdleCallback + debounce 조합으로 UI 블로킹 최소화.
    - 코드 스플리팅: React.lazy로 에디터, HWP 모듈, 다이어그램 모듈 분리 로드.
  </performance_considerations>

  <hwp_implementation_notes>
    - hwp.js는 HWP 파일 읽기(파싱)를 지원하지만, HWP 쓰기(생성)는 제한적입니다.
    - HWP 내보내기는 HWPX(Open XML 기반) 포맷을 우선 지원하고, 레거시 HWP 바이너리는 가능한 범위에서 지원합니다.
    - HWPX 생성: JSZip으로 OOXML 구조 생성 → 각 섹션별 XML 생성 → ZIP 패키징
    - 복잡한 HWP 기능 (수식, 그리기 개체, 매크로 등)은 임포트 시 텍스트로 fallback하거나 무시합니다.
    - HWP 암호화된 문서는 지원하지 않습니다 — 에러 메시지로 안내.
  </hwp_implementation_notes>
</key_implementation_notes>

</project_specification>
```
