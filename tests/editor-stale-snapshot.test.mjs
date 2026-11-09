import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function harness() {
  const source = readFileSync(new URL('../src/components/features/editor/editor.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const slots = [], timers = new Map(), calls = [], conversions = [], editableCalls = [];
  let cursor = 0, effects = [], options, nextTimer = 0, html = '<p>old</p>';
  const effect = (fn, deps) => {
    const index = cursor++, old = slots[index];
    if (!old || deps.some((dep, i) => dep !== old.deps[i])) {
      effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
    }
  };
  const editor = { isEditable: true, getHTML: () => html, storage: {}, commands: { setContent() {} },
    setEditable(value, emitUpdate = true) { editableCalls.push([value, emitUpdate]); editor.isEditable = value; if (emitUpdate) options.onUpdate({ editor }); },
  };
  const extension = { configure: () => ({}) };
  const actions = { updateCounts() {} };
  const exports = {};
  vm.runInNewContext(js, { exports, setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout(id) { timers.delete(id); }, require(name) {
    if (name === 'react') return { useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useState: x => [x, () => {}], useEffect: effect, useLayoutEffect: effect };
    if (name === 'react/jsx-runtime') return { jsx: () => ({}), jsxs: () => ({}) };
    if (name === '@tiptap/react') return { useEditor(value) { options ??= value; return editor; } };
    if (name === '@/stores/editor-store') return { useEditorStore: () => ({ actions }) };
    if (name.endsWith('/drop-zone')) return { useImageDrop: () => ({ isDragging: false, dropZoneProps: {} }) };
    if (name === '@/lib/markdown') return { htmlToMarkdown: h => h, htmlToMarkdownAsync: () => new Promise(resolve => conversions.push(resolve)) };
    return new Proxy({ default: extension }, { get: (obj, key) => key === '__esModule' ? true : obj[key] ?? extension });
  } });
  return {
    calls, timers, conversions, editableCalls,
    render(content = '<p>old</p>', editable = true) { cursor = 0; effects = []; exports.Editor({ content, editable, onChange: (...args) => calls.push(args) }); effects.forEach(fn => fn()); },
    edit(value) { html = value; options.onUpdate({ editor }); },
    flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('source replacement cancels an older visual-editor debounce', () => {
  const h = harness(); h.render(); h.edit('<p>old visual edit</p>');
  assert.equal(h.timers.size, 1);
  h.render('<p>new source edit</p>'); h.flush();
  assert.deepEqual(h.calls, []);
});

test('read-only changes never manufacture visual edits and invalidate pending snapshots', () => {
  const h = harness(); h.render(); h.edit('<p>old visual edit</p>');
  h.render('<p>old</p>', false); h.flush(); h.render('<p>new source</p>', true); h.flush();
  assert.deepEqual(h.calls, []);
  assert.equal(h.editableCalls.every(([, emit]) => emit === false), true);
});

test('already-started conversion cannot publish after external content or unmount', async () => {
  for (const unmount of [false, true]) {
    const h = harness(); h.render(); h.edit('x'.repeat(50001)); h.flush();
    if (unmount) h.unmount(); else h.render('<p>new source</p>');
    h.conversions[0]('stale'); await Promise.resolve();
    assert.deepEqual(h.calls, []);
  }
});

test('latest ordinary visual edit still publishes', () => {
  const h = harness(); h.render(); h.edit('<p>one</p>'); h.edit('<p>two</p>'); h.flush();
  assert.deepEqual(h.calls, [['<p>two</p>', '<p>two</p>']]);
});
