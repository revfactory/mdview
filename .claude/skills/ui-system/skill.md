---
name: ui-system
description: "MDView UI 컴포넌트 시스템 및 디자인 토큰 스킬. 레이아웃, 테마, 반응형, 애니메이션 구현."
---

# UI System — 디자인 시스템 및 컴포넌트 구축

## 워크플로우

### Step 1: 디자인 토큰 (CSS 변수)

`styles/globals.css`에 CSS 변수로 디자인 토큰 정의:

```css
:root {
  /* Colors - Light */
  --color-bg: #FFFFFF;
  --color-sidebar: #FAFBFC;
  --color-surface: #F1F3F4;
  --color-surface-hover: #E8EAED;
  --color-border: #E8EAED;
  --color-text: #202124;
  --color-text-secondary: #5F6368;
  --color-text-muted: #9AA0A6;
  --color-text-placeholder: #BDC1C6;
  --color-accent: #1967D2;
  --color-accent-hover: #1558B0;
  --color-accent-light: #E8F0FE;
  --color-success: #34A853;
  --color-warning: #FBBC04;
  --color-danger: #EA4335;
  --color-info: #4285F4;
  --color-code-bg: #F8F9FA;
  --color-selection: #C2DBFF;

  /* Spacing */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;

  /* Radius */
  --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);

  /* Font */
  --font-sans: "Pretendard Variable", "Pretendard", -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
}

.dark {
  --color-bg: #1E1E20;
  --color-sidebar: #161618;
  --color-surface: #28282C;
  --color-surface-hover: #333338;
  --color-border: #2A2A2E;
  --color-text: #E8EAED;
  --color-text-secondary: #9AA0A6;
  --color-text-muted: #6B7280;
  --color-text-placeholder: #5F6368;
  --color-accent: #8AB4F8;
  --color-accent-hover: #AECBFA;
  --color-accent-light: #1A3A5C;
  --color-success: #81C995;
  --color-warning: #FDD663;
  --color-danger: #F28B82;
  --color-info: #8AB4F8;
  --color-code-bg: #282A36;
  --color-selection: #264F78;
}
```

### Step 2: UI 프리미티브 컴포넌트

`components/ui/` — 각 컴포넌트 파일:

| 컴포넌트 | 크기 | 주요 props |
|---------|------|-----------|
| Button | h-36px, px-16px | variant(primary/secondary/ghost/danger), size(sm/md), disabled, loading |
| Input | h-36px, px-12px | error, placeholder, leftIcon, rightIcon |
| Modal | max-w 440/560/720px | open, onClose, title, size(sm/md/lg) |
| DropdownMenu | w-auto | trigger, items[], align(start/end) |
| ContextMenu | w-auto | items[], onSelect |
| Tooltip | - | content, side(top/bottom/left/right), delay(300ms) |
| Badge | h-20px, px-6px | variant(default/accent/success/warning/danger), size(sm/md) |
| Toggle | w-40px, h-22px | checked, onChange |
| SearchInput | h-36px | value, onChange, placeholder, shortcutHint |
| Skeleton | - | width, height, rounded |
| EmptyState | - | icon, title, subtitle, actions[] |

### Step 3: 레이아웃 컴포넌트

**AppShell** (`components/layout/app-shell.tsx`):
- CSS Grid: `grid-template-columns: var(--sidebar-width) 1fr`
- 사이드바 접기 시: `0px 1fr` + 200ms transition

**Sidebar** (`components/layout/sidebar.tsx`):
- Width: 280px (resizable 200-400px)
- 섹션: Header → Search → SmartViews → Divider → FolderTree → Footer
- Resize: 우측 가장자리 드래그 (4px handle)

**EditorArea** (`components/layout/editor-area.tsx`):
- Flex column: Toolbar(44px) → Content(flex-grow) → StatusBar(28px)

**Toolbar** (`components/layout/toolbar.tsx`):
- Height 44px, sticky top, overflow-x auto on mobile
- 버튼 그룹: 구분선으로 분리

**StatusBar** (`components/layout/status-bar.tsx`):
- Height 28px, 12px font, flex justify-between
- 좌: 글자수 | 단어수 | 읽기 시간
- 우: 저장 상태 | 커서 위치

### Step 4: 테마 시스템

- `<html>` 태그에 `class="dark"` 토글
- localStorage "mdview-theme": "light" | "dark" | "system"
- "system" → `matchMedia('(prefers-color-scheme: dark)')` 감시
- 전환 시 200ms cross-fade (transition on background-color, color)

### Step 5: 반응형 대응

Tailwind 브레이크포인트 + 조건부 렌더링:
- **mobile (< 768px)**: 사이드바 → drawer, 툴바 → 하단 간소화, 버블메뉴 → 하단바
- **tablet (768-1023)**: 사이드바 → overlay (backdrop), TOC 숨김
- **desktop (1024-1439)**: 풀 레이아웃, TOC 토글
- **wide (1440+)**: 사이드바 + 에디터 + TOC 동시

### Step 6: 애니메이션

Tailwind transition 유틸 + CSS @keyframes:
- 사이드바 토글: slide 200ms ease-out
- 모달: backdrop fade 200ms + content scale(0.95→1) 200ms
- 버튼 press: scale(0.97) 100ms
- 토스트: slide-in-right 200ms
- 드래그: scale(1.02) + shadow 150ms

## 접근성 체크리스트
- [ ] 모든 아이콘 버튼에 aria-label
- [ ] 포커스 링: 2px solid accent
- [ ] Tab 순서: sidebar → toolbar → editor → statusbar
- [ ] @media (prefers-reduced-motion: reduce) → 애니메이션 비활성
- [ ] 색상 대비 4.5:1 이상 (텍스트), 3:1 이상 (UI)
