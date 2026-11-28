import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import JSZip from 'jszip';

const require = createRequire(import.meta.url);
async function exportSection(markdown) {
  const source = readFileSync(new URL('../src/workers/hwp-generator.worker.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  const messages = [];
  const self = { postMessage(message) { messages.push(message); } };
  vm.runInNewContext(js, { exports: {}, require, self, console, TextEncoder, TextDecoder, ArrayBuffer, Uint8Array, Blob, setTimeout, clearTimeout });
  await self.onmessage({ data: { type: 'generate', markdown, options: { paperSize: 'A4', orientation: 'portrait', marginTop: 20, marginBottom: 20, marginLeft: 20, marginRight: 20, fontSize: 10, fontFamily: '맑은 고딕', lineHeight: 1.6 } } });
  assert.equal(messages.find((message) => message.type === 'error'), undefined);
  const complete = messages.find((message) => message.type === 'complete'); assert.ok(complete);
  const zip = await JSZip.loadAsync(complete.buffer, { checkCRC32: true });
  assert.equal(await zip.file('mimetype').async('text'), 'application/hwp+zip');
  const section = zip.file('Contents/section0.xml'); assert.ok(section);
  return section.async('text');
}

function checkTable(xml, rows, cols, anchors) {
  assert.match(xml, new RegExp(`<hp:tbl ha:rowCnt="${rows}" ha:colCnt="${cols}"`));
  const cells = [...xml.matchAll(/<hp:tc\b[^>]*>\s*<hp:cellAddr ha:colAddr="(\d+)" ha:rowAddr="(\d+)"\/>\s*<hp:cellSpan ha:colSpan="(\d+)" ha:rowSpan="(\d+)"\/>[\s\S]*?<hp:t>([^<]*)<\/hp:t>/g)]
    .map(([, col, row, width, height, text]) => [Number(row), Number(col), Number(height), Number(width), text]);
  assert.deepEqual(cells, anchors);
  const occupied = new Set();
  for (const [row, col, height, width] of cells) {
    assert.ok(height > 0 && width > 0 && row + height <= rows && col + width <= cols);
    for (let y = row; y < row + height; y++) {
      for (let x = col; x < col + width; x++) {
        const slot = `${y},${x}`;
        assert.equal(occupied.has(slot), false, `overlap at ${slot}`);
        occupied.add(slot);
      }
    }
  }
}

test('HWPX generator preserves Korean heading, distinct table cells and final paragraph in a valid ZIP', async () => {
  const xml = await exportSection('# 회의록\n\n- 첫 항목\n\n| 작업 | 담당 |\n| --- | --- |\n| 검토 | 사용자 |\n\n마지막 문장.');
  assert.match(xml, /회의록/);
  assert.match(xml, /마지막 문장/);
  checkTable(xml, 2, 2, [[0, 0, 1, 1, '작업'], [0, 1, 1, 1, '담당'], [1, 0, 1, 1, '검토'], [1, 1, 1, 1, '사용자']]);
});

test('HWPX table layout skips occupied cells and counts columns carried from earlier rows', async () => {
  const xml = await exportSection('<table><tr><td rowspan="2">왼쪽</td><td>가운데</td></tr><tr><td colspan="2">아래</td></tr><tr><td>하단</td></tr></table>');
  checkTable(xml, 3, 3, [[0, 0, 2, 1, '왼쪽'], [0, 1, 1, 1, '가운데'], [1, 1, 1, 2, '아래'], [2, 0, 1, 1, '하단']]);
});

test('HWPX table layout finds room for a whole colspan beside a carried middle cell', async () => {
  const xml = await exportSection('<table><tr><td>윗줄</td><td rowspan="2">가운데</td></tr><tr><td colspan="2">아랫줄</td></tr></table>');
  checkTable(xml, 2, 4, [[0, 0, 1, 1, '윗줄'], [0, 1, 2, 1, '가운데'], [1, 2, 1, 2, '아랫줄']]);
});

test('HWPX table layout expands zero rowspan within its group, including an empty covered row', async () => {
  const xml = await exportSection('<table><thead><tr><th rowspan="99999999999">제목</th></tr></thead><tbody><tr><td rowspan="0" data-colspan="9" title="> colspan=5">왼쪽</td><td>윗줄</td></tr><tr></tr><tr><td>아랫줄</td></tr></tbody><tbody><tr><td colspan="0" rowspan="-3">다음</td></tr></tbody></table>');
  checkTable(xml, 5, 2, [[0, 0, 1, 1, '제목'], [1, 0, 3, 1, '왼쪽'], [1, 1, 1, 1, '윗줄'], [3, 1, 1, 1, '아랫줄'], [4, 0, 1, 1, '다음']]);
});
