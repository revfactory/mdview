import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function load(path, require = () => ({})) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require });
  return exports;
}
const helpers = load('../src/lib/source-indentation.ts');
const components = [['source-editor', 'SourceEditor'], ['split-view', 'SplitView'], ['paginated-split-view', 'PaginatedSplitView']];
function harness(file, name) {
  const changes = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useRef: current => ({ current }), useCallback: fn => fn, useId: () => 'fixture-keyboard-help',
    useEffect() {}, useLayoutEffect: fn => fn(), useState: initial => [initial, () => {}],
  };
  const modules = {
    react: { ...react, default: react }, '@/lib/source-indentation': helpers,
    '@/hooks/use-paginated-chunks': { usePaginatedChunks: () => ({
      getCurrentChunkId: () => 101, currentPage: 0, chunkHtml: '', chunkMarkdown: '', editorRef: { current: null },
      handleChange: markdown => changes.push(markdown),
      handleSourceInput: async markdown => { changes.push(markdown); }, publishSourcePreview() {},
    }) }, '@/lib/markdown': { markdownToHtml: value => value },
  };
  const Component = load(`../src/components/features/editor/${file}.tsx`, name => modules[name] ?? {})[name];
  const tree = Component({ content: '', htmlContent: '', documentId: 'fixture', totalChunks: 1, onSourceChange: markdown => changes.push(markdown) });
  const find = (node, predicate) => !node || typeof node !== 'object' ? undefined : predicate(node) ? node : node.children?.flat().map(child => find(child, predicate)).find(Boolean);
  const field = find(tree, node => node.type === 'textarea');
  const target = { value: '한글\nsecond', selectionStart: 1, selectionEnd: 8, selectionDirection: 'backward', scrollTop: 90, scrollLeft: 5,
    setSelectionRange(start, end, direction) { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; },
  };
  const snapshot = () => JSON.parse(JSON.stringify(target));
  const key = async (key, options = {}) => {
    let prevented = false;
    field.props.onKeyDown({ key, currentTarget: target, shiftKey: false, nativeEvent: {}, preventDefault() { prevented = true; }, ...options });
    await new Promise(resolve => setImmediate(resolve));
    return prevented;
  };
  return { field, tree, find, key, changes, target, snapshot };
}
for (const [file, name] of components) {
  test(`${name}: Escape then Tab allows native focus navigation without edits or saves`, async () => {
    const h = harness(file, name); const initial = h.snapshot();
    assert.equal(await h.key('Escape'), false);
    assert.equal(await h.key('Tab'), false, 'the browser must receive an uncancelled Tab');
    assert.deepEqual(h.snapshot(), initial); assert.deepEqual(h.changes, []);
    assert.equal(await h.key('Tab'), true, 'the escape applies to one Tab only');
    assert.equal(h.changes.length, 1);
  });
  test(`${name}: Escape then Shift+Tab permits backward navigation`, async () => {
    const h = harness(file, name); const initial = h.snapshot();
    await h.key('Escape'); await h.key('Shift', { shiftKey: true });
    assert.equal(await h.key('Tab', { shiftKey: true }), false);
    assert.deepEqual(h.snapshot(), initial); assert.deepEqual(h.changes, []);
  });
  test(`${name}: blur and intervening typing reset the one-shot escape`, async () => {
    const h = harness(file, name);
    await h.key('Escape'); h.field.props.onBlur();
    assert.equal(await h.key('Tab'), true);
    await h.key('Escape'); await h.key('a');
    assert.equal(await h.key('Tab'), true); assert.equal(h.changes.length, 2);
  });
  test(`${name}: IME events never arm escape or modify source`, async () => {
    const h = harness(file, name); const initial = h.snapshot();
    await h.key('Escape', { nativeEvent: { isComposing: true } });
    assert.equal(await h.key('Tab', { nativeEvent: { isComposing: true } }), false);
    assert.deepEqual(h.snapshot(), initial); assert.deepEqual(h.changes, []);
    assert.equal(await h.key('Tab'), true, 'composition Escape must not arm the bypass');
    await h.key('Escape'); await h.key('Process', { nativeEvent: { keyCode: 229 } });
    assert.equal(await h.key('Tab'), true, 'composition resets a previously armed bypass');
  });
  test(`${name}: modified Tab keeps browser shortcuts without editing`, async () => {
    const h = harness(file, name); const initial = h.snapshot();
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) assert.equal(await h.key('Tab', { [modifier]: true }), false);
    assert.deepEqual(h.snapshot(), initial); assert.deepEqual(h.changes, []);
  });
  test(`${name}: named source field describes the visible escape and indentation shortcuts`, () => {
    const h = harness(file, name);
    assert.equal(h.field.props['aria-label'], '마크다운 소스');
    const description = h.find(h.tree, node => node.props.id === h.field.props['aria-describedby']);
    assert.ok(h.field.props['aria-describedby']); assert.ok(description);
    const text = description.children.join('');
    assert.match(text, /Esc.*Tab\/Shift\+Tab/); assert.match(text, /들여쓰기/);
    assert.equal(description.props.hidden, undefined);
  });
}
