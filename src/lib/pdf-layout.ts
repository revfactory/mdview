/** PDF 뷰어의 페이지 배치·배율 계산. DOM·pdf.js에 의존하지 않는다(테스트 대상). */

/** pdf.js 의 100% 배율(실제 크기)은 PDF 1pt 를 CSS 96/72 px 로 그린다. */
export const PDF_TO_CSS_UNITS = 96 / 72;

/** 배율 단계(실제 크기 대비 %) */
export const ZOOM_STEPS = [25, 33, 50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400] as const;
export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];
/** 자동 배율은 폭 맞춤을 따르되 넓은 화면에서 지나치게 커지지 않게 이 값에서 멈춘다. */
export const MAX_AUTO_ZOOM = 125;

/** auto: 폭 맞춤(최대 125%), page-width: 폭 맞춤, number: 지정 배율(%) */
export type ZoomMode = 'auto' | 'page-width' | number;

/** getViewport({ scale: 1 }) 기준 페이지 크기 */
export interface PageSize {
  width: number;
  height: number;
}

export interface PageLayout {
  tops: number[];
  heights: number[];
  widths: number[];
  totalHeight: number;
  maxWidth: number;
}

export function zoomPercentToScale(percent: number): number {
  return (percent / 100) * PDF_TO_CSS_UNITS;
}

export function scaleToZoomPercent(scale: number): number {
  return Math.round((scale / PDF_TO_CSS_UNITS) * 100);
}

/** 가장 넓은 페이지 폭. 폭 맞춤은 이 값을 기준으로 해서 가로 페이지가 섞여도 옆으로 스크롤하지 않게 한다. */
export function widestPageWidth(sizes: PageSize[]): number {
  let widest = 0;
  for (const size of sizes) widest = Math.max(widest, size.width);
  return widest;
}

/** 화면에 그릴 배율. pageWidth 는 기준 페이지 폭(보통 가장 넓은 페이지), availableWidth 는 좌우 여백을 뺀 폭이다. */
export function resolveScale(zoom: ZoomMode, pageWidth: number, availableWidth: number): number {
  if (typeof zoom === 'number') return zoomPercentToScale(clampZoom(zoom));
  if (pageWidth <= 0 || availableWidth <= 0) return zoomPercentToScale(100);
  const fitScale = availableWidth / pageWidth;
  const fitPercent = clampZoom((fitScale / PDF_TO_CSS_UNITS) * 100);
  if (zoom === 'page-width') return zoomPercentToScale(fitPercent);
  return zoomPercentToScale(Math.min(fitPercent, MAX_AUTO_ZOOM));
}

export function clampZoom(percent: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, percent));
}

export function stepZoom(currentPercent: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_STEPS.find((step) => step > currentPercent + 0.5) ?? MAX_ZOOM;
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (ZOOM_STEPS[i] < currentPercent - 0.5) return ZOOM_STEPS[i];
  }
  return MIN_ZOOM;
}

export function computeLayout(sizes: PageSize[], scale: number, padding: number, gap: number): PageLayout {
  const tops: number[] = new Array(sizes.length);
  const heights: number[] = new Array(sizes.length);
  const widths: number[] = new Array(sizes.length);
  let y = padding;
  let maxWidth = 0;
  for (let i = 0; i < sizes.length; i++) {
    const width = Math.max(1, Math.floor(sizes[i].width * scale));
    const height = Math.max(1, Math.floor(sizes[i].height * scale));
    tops[i] = y;
    heights[i] = height;
    widths[i] = width;
    maxWidth = Math.max(maxWidth, width);
    y += height + gap;
  }
  const totalHeight = sizes.length ? y - gap + padding : 0;
  return { tops, heights, widths, totalHeight, maxWidth };
}

/** offset 위치에 걸친 페이지의 0부터 시작하는 번호. 페이지 사이 여백은 앞 페이지로 본다. */
export function pageIndexAt(layout: PageLayout, offset: number): number {
  const { tops } = layout;
  if (!tops.length) return 0;
  let low = 0;
  let high = tops.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (tops[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** 배율이 바뀌어도 보던 위치를 유지하도록 새 배치에서의 스크롤 위치를 구한다. */
export function anchorScrollTop(prev: PageLayout, next: PageLayout, scrollTop: number, gap: number): number {
  if (!prev.tops.length || !next.tops.length) return scrollTop;
  const index = Math.min(pageIndexAt(prev, scrollTop), next.tops.length - 1);
  const span = prev.heights[index] + gap;
  const fraction = span > 0 ? (scrollTop - prev.tops[index]) / span : 0;
  return Math.max(0, next.tops[index] + fraction * (next.heights[index] + gap));
}

export function parsePageInput(value: string, pageCount: number): number | null {
  const page = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(page) || pageCount < 1) return null;
  return Math.min(pageCount, Math.max(1, page));
}
