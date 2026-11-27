import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const hook = ts.transpileModule(
  readFileSync(new URL('../src/hooks/use-paginated-chunks.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function fixture() {
  const reads = [];
  const writes = [];
  const exports = {};
  const modules = {
    react: {
      useState: value => [value, () => {}],
      useCallback: fn => fn,
      useRef: current => ({ current }),
      useEffect() {},
    },
    '@/db/chunks': {
      getChunk: async (...args) => {
        reads.push(args);
        return { markdown: '# 다음 페이지\r\n', htmlContent: '<h1>다음 페이지</h1>' };
      },
      updateChunk: async (...args) => { writes.push(args); },
    },
    '@/lib/markdown': {
      htmlToMarkdown: html => html.replace(/^<p>|<\/p>$/g, ''),
    },
  };
  vm.runInNewContext(hook, { exports, require: name => modules[name] });
  return { ...exports.usePaginatedChunks('synthetic', 3), reads, writes };
}

test('read-only page navigation does not serialize or write the departed chunk', async () => {
  const h = fixture();
  let serialized = false;
  h.editorRef.current = { getHTML() { serialized = true; return '<p>normalized</p>'; } };
  await h.handlePageChange(1);
  assert.equal(serialized, false);
  assert.deepEqual(h.reads, [['synthetic', 1]]);
  assert.deepEqual(h.writes, []);
});

test('a visual edit flushes before reading the next page even if debounce never fired', async () => {
  const h = fixture();
  const editor = { getHTML: () => '<p>new text</p>' };
  h.editorRef.current = editor;
  h.markVisualEdit(editor);
  await h.handlePageChange(1);
  assert.deepEqual(h.writes, [['synthetic', 0, 'new text', '<p>new text</p>']]);
  assert.deepEqual(h.reads, [['synthetic', 1]]);
});

test('dirty state from another editor instance never causes the active page to be rewritten', async () => {
  const h = fixture();
  h.markVisualEdit({ getHTML: () => '<p>another page</p>' });
  h.editorRef.current = { getHTML: () => '<p>read-only page</p>' };
  await h.handlePageChange(1);
  assert.deepEqual(h.writes, []);
});
