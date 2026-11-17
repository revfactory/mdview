import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

async function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

const layout = await load('../src/lib/pdf-layout.ts');
const file = await load('../src/lib/pdf-file.ts');
const A4 = { width: 595, height: 842 };

test('auto zoom fits the page width but stops at 125% on wide screens', () => {
  assert.equal(layout.scaleToZoomPercent(layout.resolveScale('auto', A4.width, 400)), 50);
  assert.equal(layout.scaleToZoomPercent(layout.resolveScale('auto', A4.width, 3000)), 125);
  assert.equal(layout.scaleToZoomPercent(layout.resolveScale('page-width', A4.width, 1190)), 150);
  assert.equal(layout.scaleToZoomPercent(layout.resolveScale(175, A4.width, 400)), 175);
  // 폭을 아직 재지 못했으면 실제 크기로 둔다.
  assert.equal(layout.scaleToZoomPercent(layout.resolveScale('auto', A4.width, 0)), 100);
});

test('fit modes use the widest page so mixed portrait and landscape pages never scroll sideways', () => {
  const sizes = [A4, { width: 842, height: 595 }, A4];
  const widest = layout.widestPageWidth(sizes);
  assert.equal(widest, 842);
  const scale = layout.resolveScale('page-width', widest, 1000);
  assert.ok(layout.computeLayout(sizes, scale, 24, 16).maxWidth <= 1000);
  assert.equal(layout.widestPageWidth([]), 0);
});

test('zoom steps move to the next defined level and clamp at the ends', () => {
  assert.equal(layout.stepZoom(100, 1), 110);
  assert.equal(layout.stepZoom(100, -1), 90);
  assert.equal(layout.stepZoom(117, 1), 125);
  assert.equal(layout.stepZoom(117, -1), 110);
  assert.equal(layout.stepZoom(400, 1), 400);
  assert.equal(layout.stepZoom(25, -1), 25);
  assert.equal(layout.resolveScale(9999, A4.width, 0), layout.zoomPercentToScale(400));
});

test('layout stacks mixed page sizes with padding and gaps', () => {
  const result = layout.computeLayout([A4, { width: 842, height: 595 }, A4], 1, 24, 16);
  assert.deepEqual(result.tops, [24, 24 + 842 + 16, 24 + 842 + 16 + 595 + 16]);
  assert.deepEqual(result.widths, [595, 842, 595]);
  assert.equal(result.maxWidth, 842);
  assert.equal(result.totalHeight, 24 + 842 + 16 + 595 + 16 + 842 + 24);
  assert.equal(layout.computeLayout([], 1, 24, 16).totalHeight, 0);
});

test('page lookup assigns gaps to the previous page and clamps outside the document', () => {
  const result = layout.computeLayout([A4, A4, A4], 1, 24, 16);
  assert.equal(layout.pageIndexAt(result, -500), 0);
  assert.equal(layout.pageIndexAt(result, 24), 0);
  assert.equal(layout.pageIndexAt(result, 24 + 842 + 8), 0);
  assert.equal(layout.pageIndexAt(result, 24 + 842 + 16), 1);
  assert.equal(layout.pageIndexAt(result, 1e9), 2);
});

test('zooming keeps the same point of the same page at the top of the viewport', () => {
  const sizes = Array.from({ length: 50 }, () => A4);
  const before = layout.computeLayout(sizes, 1, 24, 16);
  const after = layout.computeLayout(sizes, 2, 24, 16);
  const halfwayThroughPage10 = before.tops[9] + before.heights[9] / 2;
  const anchored = layout.anchorScrollTop(before, after, halfwayThroughPage10, 16);
  assert.equal(layout.pageIndexAt(after, anchored), 9);
  assert.ok(Math.abs(anchored - (after.tops[9] + after.heights[9] / 2)) < 16);
});

test('page input accepts digits only and clamps to the document', () => {
  assert.equal(layout.parsePageInput('3', 10), 3);
  assert.equal(layout.parsePageInput(' 0 ', 10), 1);
  assert.equal(layout.parsePageInput('99', 10), 10);
  assert.equal(layout.parsePageInput('', 10), null);
  assert.equal(layout.parsePageInput('abc', 10), null);
});

test('PDF file checks use the signature, not only the extension', () => {
  const pdf = new TextEncoder().encode('%PDF-1.7\n...');
  const prefixed = new Uint8Array([0xef, 0xbb, 0xbf, ...pdf]);
  const fake = new TextEncoder().encode('<html>not a pdf</html>');
  assert.equal(file.hasPdfHeader(pdf), true);
  assert.equal(file.hasPdfHeader(prefixed), true);
  assert.equal(file.hasPdfHeader(fake), false);
  assert.equal(file.hasPdfHeader(new Uint8Array()), false);
});

test('PDF file metadata validation explains the rejection in Korean', () => {
  assert.equal(file.validatePdfFileMeta({ name: '보고서.PDF', size: 10 }), null);
  assert.equal(file.validatePdfFileMeta({ name: 'download', size: 10, type: 'application/pdf' }), null);
  assert.match(file.validatePdfFileMeta({ name: '문서.hwp', size: 10 }), /PDF 파일/);
  assert.match(file.validatePdfFileMeta({ name: '빈.pdf', size: 0 }), /빈 파일/);
  assert.match(file.validatePdfFileMeta({ name: '큰.pdf', size: file.PDF_MAX_FILE_SIZE + 1 }), /100\.0 MB 이하/);
  assert.equal(file.pdfTitleFromFileName('2026 사업계획.pdf'), '2026 사업계획');
  assert.equal(file.pdfTitleFromFileName('.pdf'), '제목 없음');
});
