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
const indent = (...args) => JSON.parse(JSON.stringify(helpers.indentSource(...args)));

test('Tab at a caret inserts spaces without changing surrounding text', () => {
  assert.deepEqual(indent('abc', 1, 1), { value: 'a  bc', selectionStart: 3, selectionEnd: 3 });
  assert.deepEqual(indent('', 0, 0), { value: '  ', selectionStart: 2, selectionEnd: 2 });
});

test('Tab preserves selected text on every selected line and supports repeated indent/outdent', () => {
  const value = 'first line\nsecond line';
  const once = indent(value, 0, value.length);
  assert.deepEqual(once, { value: '  first line\n  second line', selectionStart: 2, selectionEnd: value.length + 4 });
  const twice = indent(once.value, once.selectionStart, once.selectionEnd);
  assert.equal(twice.value, '    first line\n    second line');
  const back = indent(twice.value, twice.selectionStart, twice.selectionEnd, true);
  assert.deepEqual(back, once);
  assert.deepEqual(indent(back.value, back.selectionStart, back.selectionEnd, true), {
    value, selectionStart: 0, selectionEnd: value.length,
  });
});

test('partial selections indent whole lines, not replace the selection', () => {
  assert.deepEqual(indent('abcdef', 2, 4), { value: '  abcdef', selectionStart: 4, selectionEnd: 6 });
  assert.deepEqual(indent('abc\ndef\nghi', 1, 6), { value: '  abc\n  def\nghi', selectionStart: 3, selectionEnd: 10 });
});

test('the next line is excluded when the selection ends at its start', () => {
  assert.deepEqual(indent('one\ntwo\nthree', 0, 4), { value: '  one\ntwo\nthree', selectionStart: 2, selectionEnd: 6 });
  assert.deepEqual(indent('  one\n  two', 0, 6, true), { value: 'one\n  two', selectionStart: 0, selectionEnd: 4 });
});

test('outdent removes up to two leading spaces or one tab, even with a caret inside the indent', () => {
  assert.deepEqual(indent('  text', 1, 1, true), { value: 'text', selectionStart: 0, selectionEnd: 0 });
  assert.deepEqual(indent(' text', 0, 0, true), { value: 'text', selectionStart: 0, selectionEnd: 0 });
  assert.deepEqual(indent('\ttext', 3, 3, true), { value: 'text', selectionStart: 2, selectionEnd: 2 });
  assert.deepEqual(indent('text', 0, 0, true), { value: 'text', selectionStart: 0, selectionEnd: 0 });
});

test('empty lines, trailing newlines, CRLF, Korean and emoji are preserved', () => {
  for (const value of ['\n', '\n\n', '가나다\n😀 emoji\n', 'a\r\nb\r\n']) {
    const edited = indent(value, 0, value.length);
    assert.equal(edited.value, value.split('\n').map((line, index, lines) => index === lines.length - 1 && !line ? '' : '  ' + line).join('\n'));
    assert.deepEqual(indent(edited.value, edited.selectionStart, edited.selectionEnd, true), {
      value, selectionStart: 0, selectionEnd: value.length,
    });
  }
});

function textarea(value, start = 0, end = value.length, direction = 'backward') {
  return {
    value, selectionStart: start, selectionEnd: end, selectionDirection: direction,
    scrollTop: 120, scrollLeft: 30,
    setSelectionRange(start, end, direction) {
      this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction;
    },
  };
}

test('textarea application preserves reverse selection and scroll, and reports no-op outdent', () => {
  const target = textarea('one\ntwo');
  assert.equal(helpers.indentSourceTextarea(target), true);
  assert.equal(target.value, '  one\n  two');
  assert.equal(target.selectionDirection, 'backward');
  assert.equal(target.scrollTop, 120);
  assert.equal(target.scrollLeft, 30);
  assert.equal(helpers.indentSourceTextarea(target, true), true);
  assert.equal(helpers.indentSourceTextarea(target, true), false);
});

test('large selections preserve every line with valid selection positions', () => {
  const value = '한글 😀 line\n'.repeat(20000);
  const edited = indent(value, 0, value.length);
  assert.equal(edited.value, '  한글 😀 line\n'.repeat(20000));
  assert.equal(edited.selectionEnd, edited.value.length);
  assert.equal(indent(edited.value, edited.selectionStart, edited.selectionEnd, true).value, value);
});

for (const [file, name] of [
  ['source-editor', 'SourceEditor'], ['split-view', 'SplitView'], ['paginated-split-view', 'PaginatedSplitView'],
]) {
  test(`${name} handles selected Tab/Shift+Tab through the shared helper and saves once`, async () => {
    const changes = [];
    const react = {
      createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
      useRef: current => ({ current }), useCallback: fn => fn,
      useEffect() {}, useLayoutEffect: fn => fn(), useState: initial => [initial, () => {}],
    };
    const modules = {
      react: { ...react, default: react },
      '@/lib/source-indentation': helpers,
      '@/hooks/use-paginated-chunks': { usePaginatedChunks: () => ({
        currentPage: 0, chunkHtml: '', chunkMarkdown: '', editorRef: { current: null },
        handleChange: markdown => changes.push(markdown),
      }) },
      '@/lib/markdown': { markdownToHtml: value => value },
    };
    const Component = load(`../src/components/features/editor/${file}.tsx`, name => modules[name] ?? {})[name];
    const tree = Component({ content: '', htmlContent: '', documentId: 'test', totalChunks: 1,
      onSourceChange: markdown => changes.push(markdown),
    });
    const findTextarea = node => node?.type === 'textarea' ? node : node?.children?.flat().map(findTextarea).find(Boolean);
    const field = findTextarea(tree);
    assert.ok(field);
    const target = textarea('one\ntwo');
    let prevented = 0;
    const key = shiftKey => field.props.onKeyDown({ key: 'Tab', currentTarget: target, shiftKey,
      preventDefault() { prevented++; },
    });
    key(false);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(changes, ['  one\n  two']);
    assert.equal(target.selectionDirection, 'backward');
    key(true);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(changes, ['  one\n  two', 'one\ntwo']);
    key(true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(changes.length, 2, 'a no-op outdent must not trigger a save');
    assert.equal(prevented, 3);
  });
}
