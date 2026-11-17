'use client';

import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  FileCode,
  Loader2,
  Menu,
  MoveHorizontal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { RenderTask, TextLayer } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ToolbarButton, Divider } from '@/components/layout/toolbar';
import { Tooltip } from '@/components/ui/tooltip';
import { useUIStore } from '@/stores/ui-store';
import { useToastStore } from '@/stores/toast-store';
import { getStoredFile } from '@/db/files';
import { formatFileSize } from '@/lib/pdf-file';
import {
  anchorScrollTop,
  computeLayout,
  pageIndexAt,
  parsePageInput,
  resolveScale,
  scaleToZoomPercent,
  stepZoom,
  widestPageWidth,
  type PageLayout,
  type PageSize,
  type ZoomMode,
} from '@/lib/pdf-layout';
import {
  describePdfError,
  extractPdfMarkdown,
  loadPdfJs,
  openPdfDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from '@/lib/pdfjs';

const PAGE_GAP = 16;
/** iOS Safari 캔버스 면적 상한(4096×4096). 넘으면 빈 캔버스가 된다. */
const MAX_CANVAS_PIXELS = 16_777_216;
/** 페이지 크기 보정 시 한 번에 읽는 페이지 수 */
const SIZE_BATCH = 32;

interface PdfViewerProps {
  documentId: string;
  title: string;
  /** 추출한 마크다운으로 새 문서를 만든다. 실패하면 reject. */
  onConvert: (markdown: string) => Promise<void>;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; pdf: PDFDocumentProxy };

interface StoredPdf {
  blob: Blob;
  size: number;
}

interface VisibleRange {
  start: number;
  end: number;
  current: number;
}

function isCancellation(error: unknown): boolean {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
  return name === 'RenderingCancelledException' || name === 'AbortException';
}

/** Safari는 화면에서 뗀 캔버스의 메모리를 늦게 돌려주므로 크기를 0으로 줄여 즉시 반환한다. */
function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

/** 화면에 가장 넓게 보이는 페이지. 같으면 앞 페이지. */
function mostVisiblePage(layout: PageLayout, scrollTop: number, viewportHeight: number): number {
  const bottom = scrollTop + viewportHeight;
  let best = pageIndexAt(layout, scrollTop);
  let bestArea = -1;
  for (let i = best; i < layout.tops.length && layout.tops[i] < bottom; i++) {
    const area = Math.min(bottom, layout.tops[i] + layout.heights[i]) - Math.max(scrollTop, layout.tops[i]);
    if (area > bestArea) {
      bestArea = area;
      best = i;
    }
  }
  return best;
}

export function PdfViewer({ documentId, title, onConvert }: PdfViewerProps) {
  const isMobile = useUIStore((s) => s.isMobile);
  const toggleSidebar = useUIStore((s) => s.actions.toggleSidebar);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [file, setFile] = useState<StoredPdf | null>(null);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [zoom, setZoom] = useState<ZoomMode>('auto');
  const [viewportWidth, setViewportWidth] = useState(0);
  const [range, setRange] = useState<VisibleRange>({ start: 0, end: -1, current: 0 });
  const [pageDraft, setPageDraft] = useState<string | null>(null);
  const [convertProgress, setConvertProgress] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<PageLayout | null>(null);
  const lastScrollRef = useRef({ top: 0, left: 0 });
  const frameRef = useRef(0);
  const convertAbortRef = useRef<AbortController | null>(null);

  const pdf = load.status === 'ready' ? load.pdf : null;
  const pageCount = pageSizes.length;
  const padding = isMobile ? 12 : 24;

  // 원본 PDF를 IndexedDB에서 읽어 연다. 문서가 바뀌면 부모가 key로 새로 마운트한다.
  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;

    (async () => {
      try {
        const stored = await getStoredFile(documentId);
        if (cancelled) return;
        if (!stored) throw new Error('원본 PDF 파일을 찾지 못했습니다. 브라우저 데이터가 삭제되었을 수 있습니다.');
        setFile({ blob: stored.blob, size: stored.size });

        const data = new Uint8Array(await stored.blob.arrayBuffer());
        if (cancelled) return;
        task = await openPdfDocument(data);
        if (cancelled) {
          void task.destroy();
          return;
        }
        const doc = await task.promise;
        const firstPage = await doc.getPage(1);
        if (cancelled) return;

        const base = firstPage.getViewport({ scale: 1 });
        const sizes: PageSize[] = Array.from({ length: doc.numPages }, () => ({ width: base.width, height: base.height }));
        setPageSizes(sizes.slice());
        setLoad({ status: 'ready', pdf: doc });

        // 첫 페이지 크기로 먼저 배치하고, 가로 페이지처럼 크기가 다른 페이지는 뒤에서 보정한다.
        for (let start = 2; start <= doc.numPages; start += SIZE_BATCH) {
          const numbers = Array.from({ length: Math.min(SIZE_BATCH, doc.numPages - start + 1) }, (_, i) => start + i);
          const pages = await Promise.all(numbers.map((n) => doc.getPage(n)));
          if (cancelled) return;
          let changed = false;
          pages.forEach((page, i) => {
            const viewport = page.getViewport({ scale: 1 });
            const index = numbers[i] - 1;
            if (Math.abs(viewport.width - sizes[index].width) > 0.5 || Math.abs(viewport.height - sizes[index].height) > 0.5) {
              sizes[index] = { width: viewport.width, height: viewport.height };
              changed = true;
            }
          });
          if (changed) setPageSizes(sizes.slice());
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to open PDF:', error);
        setLoad({ status: 'error', message: describePdfError(error) });
      }
    })();

    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [documentId]);

  // 폭 맞춤 배율을 위해 보이는 폭을 잰다. 사이드바 애니메이션 중에는 매 프레임 다시 그리지 않도록 늦춘다.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    let timer: number | undefined;
    let first = true;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      const apply = () => setViewportWidth(element.clientWidth);
      if (first) {
        first = false;
        apply();
      } else {
        timer = window.setTimeout(apply, 120);
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const widestWidth = useMemo(() => widestPageWidth(pageSizes), [pageSizes]);
  const scale = resolveScale(zoom, widestWidth, Math.max(0, viewportWidth - padding * 2));
  const zoomPercent = scaleToZoomPercent(scale);
  const layout = useMemo(() => computeLayout(pageSizes, scale, padding, PAGE_GAP), [pageSizes, scale, padding]);
  const contentWidth = Math.max(viewportWidth, layout.maxWidth + padding * 2);

  const updateRange = useCallback(() => {
    const element = scrollRef.current;
    const current = layoutRef.current;
    if (!element || !current || !current.tops.length) return;
    lastScrollRef.current = { top: element.scrollTop, left: element.scrollLeft };
    const height = element.clientHeight;
    const start = pageIndexAt(current, element.scrollTop - height);
    const end = pageIndexAt(current, element.scrollTop + height * 2);
    const visible = mostVisiblePage(current, element.scrollTop, height);
    setRange((prev) => (prev.start === start && prev.end === end && prev.current === visible
      ? prev
      : { start, end, current: visible }));
  }, []);

  const handleScroll = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      updateRange();
    });
  }, [updateRange]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  // 배율·페이지 크기가 바뀌면 보던 위치를 유지한 채 다시 배치한다(그리기 전에 맞춰야 화면이 튀지 않는다).
  useLayoutEffect(() => {
    const element = scrollRef.current;
    const prev = layoutRef.current;
    layoutRef.current = layout;
    if (element && prev && prev !== layout && prev.tops.length && layout.tops.length) {
      const { top, left } = lastScrollRef.current;
      element.scrollTop = anchorScrollTop(prev, layout, top, PAGE_GAP);
      if (prev.maxWidth > 0 && element.scrollWidth > element.clientWidth) {
        const center = left + element.clientWidth / 2;
        element.scrollLeft = Math.max(0, center * (layout.maxWidth / prev.maxWidth) - element.clientWidth / 2);
      }
    }
    updateRange();
  }, [layout, updateRange]);

  const goToPage = useCallback((pageNumber: number) => {
    const element = scrollRef.current;
    const current = layoutRef.current;
    if (!element || !current?.tops.length) return;
    const index = Math.min(current.tops.length - 1, Math.max(0, pageNumber - 1));
    element.scrollTo({ top: Math.max(0, current.tops[index] - padding / 2) });
  }, [padding]);

  const handleDownload = useCallback(() => {
    if (!file) return;
    const safeName = (title || '문서').replace(/[<>:"/\\|?*]/g, '_');
    saveAs(file.blob, `${safeName}.pdf`);
  }, [file, title]);

  const handleConvert = useCallback(async () => {
    if (!pdf || convertAbortRef.current) return;
    const controller = new AbortController();
    convertAbortRef.current = controller;
    setConvertProgress(0);
    const { addToast } = useToastStore.getState().actions;
    try {
      const markdown = await extractPdfMarkdown(pdf, {
        signal: controller.signal,
        onProgress: (done, total) => setConvertProgress(Math.floor((done / total) * 100)),
      });
      if (controller.signal.aborted) return;
      if (!markdown) {
        addToast('PDF에서 글자를 찾지 못했습니다. 스캔한 이미지로 된 PDF는 변환할 수 없습니다.', 'error');
        return;
      }
      await onConvert(markdown);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('PDF to Markdown conversion failed:', error);
      addToast('마크다운으로 변환하지 못했습니다. 다시 시도해 주세요.', 'error');
    } finally {
      if (convertAbortRef.current === controller) convertAbortRef.current = null;
      if (!controller.signal.aborted) setConvertProgress(null);
    }
  }, [pdf, onConvert]);

  useEffect(() => () => convertAbortRef.current?.abort(), []);

  const commitPageDraft = useCallback(() => {
    const page = parsePageInput(pageDraft ?? '', pageCount);
    if (page) goToPage(page);
  }, [pageDraft, pageCount, goToPage]);

  const visiblePages: number[] = [];
  if (pdf && viewportWidth > 0) {
    for (let i = range.start; i <= Math.min(range.end, pageCount - 1); i++) visiblePages.push(i);
  }
  const converting = convertProgress !== null;

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
      <div data-toolbar className="mdview-toolbar flex items-center h-11 px-2 sm:px-3 gap-0.5 border-b border-[var(--color-border)] bg-[var(--color-bg)] shrink-0 relative z-20">
        <button
          onClick={toggleSidebar}
          aria-label="사이드바 토글"
          className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>
        <Divider />

        <div className="flex items-center gap-2 min-w-0 flex-1 px-1">
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
            PDF
          </span>
          {!isMobile && (
            <span className="truncate text-sm font-medium text-[var(--color-text)]" title={title}>
              {title || '제목 없음'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <ToolbarButton
            icon={ChevronUp}
            tooltip="이전 페이지"
            disabled={!pdf || range.current <= 0}
            onClick={() => goToPage(range.current)}
          />
          <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <input
              aria-label="페이지 번호"
              inputMode="numeric"
              disabled={!pdf}
              value={pageDraft ?? (pageCount ? String(range.current + 1) : '')}
              onFocus={(e) => {
                setPageDraft(String(range.current + 1));
                e.currentTarget.select();
              }}
              onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, ''))}
              onBlur={() => setPageDraft(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitPageDraft();
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  e.currentTarget.blur();
                }
              }}
              className="w-10 h-7 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] text-center text-xs text-[var(--color-text)] tabular-nums outline-none focus:border-[var(--color-accent)] disabled:opacity-40"
            />
            <span className="tabular-nums whitespace-nowrap">/ {pageCount || '-'}</span>
          </div>
          <ToolbarButton
            icon={ChevronDown}
            tooltip="다음 페이지"
            disabled={!pdf || range.current >= pageCount - 1}
            onClick={() => goToPage(range.current + 2)}
          />
        </div>

        <Divider />

        <div className="flex items-center gap-0.5 shrink-0">
          <ToolbarButton icon={ZoomOut} tooltip="축소" disabled={!pdf} onClick={() => setZoom(stepZoom(zoomPercent, -1))} />
          {!isMobile && (
            <Tooltip content="자동 배율" side="bottom">
              <button
                onClick={() => setZoom('auto')}
                disabled={!pdf}
                aria-label={`현재 배율 ${zoomPercent}%, 자동 배율로 되돌리기`}
                className="h-8 min-w-[3.25rem] px-1.5 rounded-md text-xs tabular-nums text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {zoomPercent}%
              </button>
            </Tooltip>
          )}
          <ToolbarButton icon={ZoomIn} tooltip="확대" disabled={!pdf} onClick={() => setZoom(stepZoom(zoomPercent, 1))} />
          <ToolbarButton
            icon={MoveHorizontal}
            tooltip="폭 맞춤"
            active={zoom === 'page-width'}
            disabled={!pdf}
            onClick={() => setZoom((current) => (current === 'page-width' ? 'auto' : 'page-width'))}
          />
        </div>

        <Divider />

        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip content="글자를 추출해 편집할 수 있는 마크다운 문서를 새로 만듭니다" side="bottom">
            <button
              onClick={handleConvert}
              disabled={!pdf || converting}
              aria-label={converting ? `마크다운으로 변환 중 ${convertProgress}%` : '마크다운으로 변환'}
              className="flex items-center justify-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-md text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode className="w-4 h-4" />}
              {!isMobile && (
                <span className="whitespace-nowrap tabular-nums">
                  {converting ? `변환 중 ${convertProgress}%` : '마크다운으로 변환'}
                </span>
              )}
            </button>
          </Tooltip>
          <ToolbarButton icon={Download} tooltip="원본 PDF 다운로드" disabled={!file} onClick={handleDownload} />
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        tabIndex={0}
        role="region"
        aria-label={`${title || '제목 없음'} PDF 페이지`}
        aria-busy={load.status === 'loading'}
        className="relative flex-1 min-h-0 overflow-auto overscroll-contain bg-[var(--color-surface)] focus-visible:outline-none"
      >
        {load.status === 'ready' ? (
          <div className="relative" style={{ height: layout.totalHeight, width: contentWidth }}>
            {visiblePages.map((index) => (
              <PdfPageView
                key={index}
                pdf={load.pdf}
                pageNumber={index + 1}
                scale={scale}
                top={layout.tops[index]}
                left={Math.max(padding, Math.floor((contentWidth - layout.widths[index]) / 2))}
                width={layout.widths[index]}
                height={layout.heights[index]}
              />
            ))}
          </div>
        ) : load.status === 'error' ? (
          <div role="alert" className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-danger)]/10">
              <AlertCircle className="w-6 h-6 text-[var(--color-danger)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text)]">PDF를 표시하지 못했습니다</p>
            <p className="max-w-sm text-xs leading-5 text-[var(--color-text-muted)]">{load.message}</p>
            {file && (
              <button
                onClick={handleDownload}
                className="mt-1 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                원본 PDF 다운로드
              </button>
            )}
          </div>
        ) : (
          <div role="status" className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
            <div className="text-sm text-[var(--color-text-muted)]">PDF 여는 중...</div>
          </div>
        )}
      </div>

      <div data-statusbar className="flex items-center justify-between h-7 px-3 sm:px-4 bg-[var(--color-surface)] border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] shrink-0 select-none">
        <div className="flex items-center gap-2 sm:gap-3">
          <span>PDF 원본 · 읽기 전용</span>
          {file && !isMobile && (
            <>
              <span className="w-px h-3 bg-[var(--color-border)]" />
              <span>{formatFileSize(file.size)}</span>
            </>
          )}
        </div>
        {pageCount > 0 && (
          <span className="tabular-nums">
            {range.current + 1} / {pageCount}쪽
          </span>
        )}
      </div>
    </div>
  );
}

interface PdfPageViewProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  top: number;
  left: number;
  width: number;
  height: number;
}

const PdfPageView = memo(function PdfPageView({ pdf, pageNumber, scale, top, left, width, height }: PdfPageViewProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const textHostRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let textLayer: TextLayer | null = null;

    (async () => {
      const [pdfjs, page] = await Promise.all([loadPdfJs(), pdf.getPage(pageNumber)]);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      pageRef.current?.style.setProperty('--user-unit', String(viewport.userUnit || 1));

      // 새 캔버스에 다 그린 뒤 바꿔 끼운다. 배율을 바꾸는 동안에는 이전 캔버스가 늘어난 채로 보인다.
      const canvas = document.createElement('canvas');
      const outputScale = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)));
      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      renderTask = page.render({
        canvas,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      });
      await renderTask.promise;
      if (cancelled) {
        releaseCanvas(canvas);
        return;
      }
      const host = canvasHostRef.current;
      if (host) {
        host.querySelectorAll('canvas').forEach(releaseCanvas);
        host.replaceChildren(canvas);
      }
      setRendered(true);

      const textDiv = document.createElement('div');
      textDiv.className = 'textLayer';
      textLayer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textDiv, viewport });
      await textLayer.render();
      if (cancelled) return;
      textHostRef.current?.replaceChildren(textDiv);
    })().catch((error: unknown) => {
      if (cancelled || isCancellation(error)) return;
      console.error(`PDF ${pageNumber}쪽을 그리지 못했습니다.`, error);
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, pageNumber, scale]);

  useEffect(() => {
    const host = canvasHostRef.current;
    return () => host?.querySelectorAll('canvas').forEach(releaseCanvas);
  }, []);

  return (
    <div
      ref={pageRef}
      className="mdview-pdf-page"
      data-page-number={pageNumber}
      style={{ top, left, width, height, '--scale-factor': scale } as React.CSSProperties}
    >
      <div ref={canvasHostRef} aria-hidden="true" />
      <div ref={textHostRef} />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <Loader2 className="w-5 h-5 animate-spin text-black/20" />
        </div>
      )}
    </div>
  );
});
