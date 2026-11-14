import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const dirty = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/editor-dirty-snapshot.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: dirty });
function harness() {
  const source = readFileSync(new URL('../src/components/features/editor/editor.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const slots = [], timers = new Map(), calls = [], conversions = [], editableCalls = [], counts = [];
  const listeners = new Map();
  let cursor = 0, effects = [], options, nextTimer = 0, html = '<p>old</p>';
  const effect = (fn, deps) => {
    const index = cursor++, old = slots[index];
    if (!old || deps.some((dep, i) => dep !== old.deps[i])) {
      effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
    }
  };
  const transaction = (docChanged) => listeners.get('transaction')?.({ editor, transaction: { docChanged } });
  const text = () => html.replace(/<[^>]+>/g, '');
  const editor = { isEditable: true, getHTML: () => html,
    // Match CharacterCount's default UTF-16 character and space-separated word counters.
    storage: { characterCount: { characters: () => text().length, words: () => text().split(' ').filter(word => word !== '').length } },
    on(name, handler) { listeners.set(name, handler); },
    off(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); },
    commands: { setContent(value) { html = value; transaction(true); } },
    setEditable(value, emitUpdate = true) { editableCalls.push([value, emitUpdate]); editor.isEditable = value; if (emitUpdate) options.onUpdate({ editor }); },
  };
  const extension = { configure: () => ({}) };
  const actions = { updateCounts(words, characters) { counts.push({ words, characters }); } };
  const exports = {};
  vm.runInNewContext(js, { exports, setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout(id) { timers.delete(id); }, require(name) {
    if (name === '@/lib/editor-dirty-snapshot') return dirty;
    if (name === 'react') return { useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useState: x => [x, () => {}], useEffect: effect, useLayoutEffect: effect };
    if (name === 'react/jsx-runtime') return { jsx: () => ({}), jsxs: () => ({}) };
    if (name === '@tiptap/react') return { useEditor(value) { options ??= value; return editor; } };
    if (name === '@/stores/editor-store') return { useEditorStore: () => ({ actions }) };
    if (name.endsWith('/drop-zone')) return { useImageDrop: () => ({ isDragging: false, dropZoneProps: {} }) };
    if (name === '@/lib/markdown') return { htmlToMarkdown: h => h, htmlToMarkdownAsync: () => new Promise(resolve => conversions.push(resolve)) };
    return new Proxy({ default: extension }, { get: (obj, key) => key === '__esModule' ? true : obj[key] ?? extension });
  } });
  return {
    snapshot: () => dirty.getDirtyEditorSnapshot(editor),
    calls, timers, conversions, editableCalls, counts, listeners,
    render(content = '<p>old</p>', editable = true) { cursor = 0; effects = []; exports.Editor({ content, editable, onChange: (...args) => calls.push(args) }); effects.forEach(fn => fn()); },
    edit(value) { html = value; transaction(true); options.onUpdate({ editor }); },
    select() { transaction(false); },
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

test('visual counts initialize before an edit and follow silent document replacements including empty content', () => {
  const h = harness(); h.render();
  assert.deepEqual(h.counts.at(-1), { words: 1, characters: 3 });
  h.render('<p>안녕 world 😀</p>');
  assert.deepEqual(h.counts.at(-1), { words: 3, characters: 11 });
  h.render('');
  assert.deepEqual(h.counts.at(-1), { words: 0, characters: 0 });
  h.render('<p>restored</p>', false);
  assert.deepEqual(h.counts.at(-1), { words: 1, characters: 8 });
  h.flush();
  assert.deepEqual(h.calls, [], 'count synchronization must not manufacture edits or saves');
});

test('visual counts update on edits, skip selection-only transactions and unsubscribe on unmount', () => {
  const h = harness(); h.render();
  h.edit('<p>two words</p>');
  assert.deepEqual(h.counts.at(-1), { words: 2, characters: 9 });
  const length = h.counts.length;
  h.select();
  assert.equal(h.counts.length, length);
  h.unmount();
  assert.equal(h.listeners.size, 0);
  h.edit('<p>detached</p>');
  assert.equal(h.counts.length, length);
});


test('snapshot flush sees immediate input before debounce but not untouched or replaced previews', () => {
  const h = harness(); h.render(); assert.equal(h.snapshot(), null);
  h.edit('<p>new input</p>'); assert.equal(h.snapshot(), '<p>new input</p>');
  assert.deepEqual(h.calls, []);
  h.render('<p>source replacement</p>'); assert.equal(h.snapshot(), null);
});


test('temporarily blocking edits retains the dirty snapshot after a failed page transition', () => {
  const h = harness(); h.render(); h.edit('<p>unsaved input</p>');
  h.render('<p>old</p>', false);
  assert.equal(h.snapshot(), null);
  h.render('<p>old</p>', true);
  assert.equal(h.snapshot(), '<p>unsaved input</p>');
});
