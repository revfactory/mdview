import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function harness(file, component, convertAsync) {
  const source = readFileSync(new URL(`../src/components/features/editor/${file}.tsx`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const refs = [];
  let cursor = 0, layoutEffects = [];
  const react = {
    useRef(initial) { const index = cursor++; return refs[index] ??= { current: initial }; },
    useCallback: fn => fn,
    useState: initial => [initial, () => {}],
    useEffect() {},
    useLayoutEffect: fn => layoutEffects.push(fn),
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  vm.runInNewContext(js, { exports, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/lib/markdown') return { markdownToHtml: value => `<p>${value}</p>`, markdownToHtmlAsync: convertAsync ?? (async value => `<p>${value}</p>`) };
    return {};
  } });
  function textarea(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.map(textarea).find(Boolean);
    if (node.type === 'textarea') return node;
    return textarea(node.props?.children);
  }
  return {
    render(onChange) { cursor = 0; layoutEffects = []; return textarea(exports[component]({ content: '', htmlContent: '', onChange })); },
    commit() { layoutEffects.forEach(fn => fn()); },
  };
}

for (const [file, component] of [['source-editor', 'SourceEditor'], ['split-view', 'SplitView']]) {
  test(`${component} publishes callbacks only on commit and pending conversion uses latest committed callback`, async () => {
    const h = harness(file, component);
    const calls = [];
    const old = h.render(value => calls.push(`old:${value}`)); h.commit();
    h.render(value => calls.push(`abandoned:${value}`)); // render is deliberately not committed
    await old.props.onChange({ target: { value: 'before' } });
    assert.deepEqual(calls, ['old:before']);
    const pending = old.props.onChange({ target: { value: 'after' } });
    h.render(value => calls.push(`new:${value}`)); h.commit();
    await pending;
    assert.deepEqual(calls, ['old:before', 'new:after']);
  });
}


test('SplitView ignores older conversions that complete after a newer edit', async () => {
  const pending = [];
  const h = harness('split-view', 'SplitView', value => new Promise(resolve => pending.push({value, resolve})));
  const calls = [];
  const textarea = h.render((md, html) => calls.push({md, html})); h.commit();
  const older = textarea.props.onChange({target: {value: 'a'.repeat(50001)}});
  await Promise.resolve(); await Promise.resolve();
  const newer = textarea.props.onChange({target: {value: 'b'.repeat(50001)}});
  await Promise.resolve(); await Promise.resolve();
  pending[1].resolve('<p>new</p>'); await newer;
  pending[0].resolve('<p>old</p>'); await older;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].md, 'b'.repeat(50001));
});
