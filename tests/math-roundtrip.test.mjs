import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { DOMParser, DOMSerializer } from '@tiptap/pm/model';
import { Marked } from 'marked';
import domino from '@mixmark-io/domino';

const require = createRequire(import.meta.url);
function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require });
  return exports;
}
const { InlineMath, BlockMath } = load('../src/extensions/math.ts');
const { markedMathExtension } = load('../src/lib/marked-extensions.ts');
const schema = getSchema([StarterKit, InlineMath, BlockMath]);
const parser = new Marked(markedMathExtension());
const markdownSource = readFileSync(new URL('../src/lib/markdown.ts', import.meta.url), 'utf8').split('// Worker-based async API')[0];
const markdownJs = ts.transpileModule(markdownSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const markdownExports = {};
vm.runInNewContext(markdownJs, { exports: markdownExports, require: name => name === './marked-extensions' ? load('../src/lib/marked-extensions.ts') : require(name) });
function roundtrip(md) {
  const doc = domino.createWindow(parser.parse(md)).document;
  const parsed = DOMParser.fromSchema(schema).parse(doc.body);
  parsed.check();
  const restored = schema.nodeFromJSON(JSON.parse(JSON.stringify(parsed.toJSON())));
  const host = doc.createElement('div');
  host.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(restored.content, { document: doc }));
  return { parsed, html: host.innerHTML, md: markdownExports.htmlToMarkdown(host.innerHTML) };
}
test('actual editor schema preserves inline/block LaTeX across repeated parse, serialize and save cycles', () => {
  const inline = String.raw`x^2 + \frac{1}{2}`;
  const block = String.raw`\begin{aligned}a&=b\\c&=d\end{aligned}`;
  let text = `한글 $${inline}$ 끝\n\n$$${block}$$`;
  for (let i=0; i<3; i++) {
    const result = roundtrip(text);
    const math=[];
    result.parsed.descendants(n => { if (/Math$/.test(n.type.name)) math.push(n.attrs.latex); });
    assert.deepEqual(math, [inline, block]);
    assert.match(result.md, /한글/);
    assert.ok(result.md.includes(inline));
    assert.ok(result.md.includes(block));
    assert.doesNotMatch(result.md, /katex|mord|aria-hidden/);
    text=result.md;
  }
});
test('unknown commands and hostile-looking strings preserve literal source without active HTML', () => {
  const formula = String.raw`\unknown{<img src=x onerror=alert(1)>}&"`;
  const result=roundtrip(`전 $${formula}$ 후`);
  assert.ok(result.md.includes(formula));
  assert.doesNotMatch(result.html, /<img\b/);
});
test('ordinary code and currency-like text stay outside math nodes', () => {
  const result=roundtrip('`$x^2$` 그리고 가격 100원');
  let count=0;
  result.parsed.descendants(n => {if (/Math$/.test(n.type.name)) count++;});
  assert.equal(count, 0);
});
