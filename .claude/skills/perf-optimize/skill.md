---
name: perf-optimize
description: "MDView 성능 최적화 스킬. 코드 스플리팅, 가상 스크롤, lazy loading, PWA, 번들 최적화."
---

# Performance Optimize — 성능 최적화 가이드

## 최적화 영역

### 1. 코드 스플리팅

`vite.config.ts` manualChunks:
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'editor-core': ['@tiptap/react', '@tiptap/pm', '@tiptap/starter-kit'],
        'editor-extensions': ['@tiptap/extension-table', '@tiptap/extension-image', ...],
        'syntax': ['shiki'],
        'math': ['katex'],
        'diagrams': ['mermaid'],
        'hwp': ['hwp.js', 'jszip'],
        'search': ['flexsearch'],
        'dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
      }
    }
  }
}
```

React.lazy 래퍼:
```typescript
const Editor = lazy(() => import('./components/features/editor/editor'));
const MathBlock = lazy(() => import('./components/features/editor/math-block'));
const MermaidBlock = lazy(() => import('./components/features/editor/mermaid-block'));
const HwpImport = lazy(() => import('./components/features/import-export/hwp-import'));
const PdfExport = lazy(() => import('./components/features/import-export/pdf-export'));
```

### 2. 가상 스크롤링

문서 리스트 (1000+ 문서):
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
// 각 문서 항목 72px 고정 높이, overscan 5
```

### 3. Lazy Render (뷰포트 기반)

Intersection Observer로 코드/수식/다이어그램 블록 lazy render:
```typescript
function useLazyRender(ref) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return visible;
}
```

### 4. React 최적화

- React.memo: DocumentItem, FolderItem, TaskItem, SidebarNavItem
- useMemo: 문서 리스트 필터링/정렬 결과
- useCallback: 이벤트 핸들러 (에디터 onUpdate, 검색 onChange)
- key 최적화: 안정적인 id 사용 (index 금지)

### 5. 자동저장 최적화

```typescript
function scheduleAutosave(saveFn: () => Promise<void>) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => saveFn(), { timeout: 2000 });
  } else {
    setTimeout(saveFn, 100);
  }
}
```

### 6. 이미지 최적화

- `loading="lazy"` 모든 이미지에 적용
- Base64 이미지: 개당 10MB 제한, 문서당 50MB 경고
- 큰 이미지: canvas로 리사이즈 후 저장 옵션

### 7. PWA 설정

`vite.config.ts`:
```typescript
import { VitePWA } from 'vite-plugin-pwa';
// precache: index.html, JS/CSS 번들, 폰트
// runtime cache: 이미지 (CacheFirst)
// manifest: name, icons, theme_color, background_color
```

### 8. 번들 분석

```bash
npx vite-bundle-visualizer
```
- 목표: 초기 로드 200KB gzip 이내
- 에디터 코어는 lazy load (route-based split)

### 성능 목표 (MDVIEW_SPEC.md 기반)

| 지표 | 목표 |
|------|------|
| 초기 로드 (3G) | < 1.5초 |
| 문서 열기 (10K줄) | < 500ms |
| 키 입력 반응 | < 16ms |
| 슬래시 명령어 팝업 | < 100ms |
| 검색 (1000문서) | < 200ms |
| HWP 임포트 (10MB) | < 5초 |
| Lighthouse | 90+ |
