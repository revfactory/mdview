import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { DOMParser, DOMSerializer } from '@tiptap/pm/model';
import domino from '@mixmark-io/domino';
const require = createRequire(import.meta.url);
function load(path, overrides = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8').split('// Worker-based async API')[0];
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: name => overrides[name] || require(name) });
  return exports;
}
const api = load('../src/lib/markdown.ts', { './marked-extensions': load('../src/lib/marked-extensions.ts') });
const schema = getSchema([StarterKit, Table.configure({ resizable: true }), TableRow, TableHeader, TableCell]);
function table(cell, header = 'Name') {
  return `<table><thead><tr><th>${header}</th><th>Value</th></tr></thead><tbody><tr><td>${cell}</td><td>1</td></tr></tbody></table>`;
}
function cells(html) {
  const doc = domino.createDocument(html);
  return Array.from(doc.querySelectorAll('th,td')).map(node => node.textContent);
}
function editorRoundtrip(html) {
  const doc = domino.createDocument(html);
  const parsed = DOMParser.fromSchema(schema).parse(doc.body);
  parsed.check();
  const restored = schema.nodeFromJSON(JSON.parse(JSON.stringify(parsed.toJSON())));
  const host = doc.createElement('div');
  host.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(restored.content, { document: doc }));
  return host.innerHTML;
}
for (const cell of ['A | B', '<code>A|B</code>', '한글 | 값', '<strong>A|B</strong>', 'A \\| B', ...[1,2,3].map(n => `<code>A${'\\'.repeat(n)}|B</code>`)]) {
  test(`table cell survives real conversion and editor schema cycles: ${cell}`, () => {
    let html = table(cell, 'Name|Label');
    const expected = cells(html);
    for (let i = 0; i < 3; i++) {
      html = editorRoundtrip(html);
      assert.deepEqual(cells(html), expected);
      const md = api.htmlToMarkdown(html);
      html = api.markdownToHtml(md);
      assert.deepEqual(cells(html), expected);
      if (cell.includes('<code>')) assert.equal(domino.createDocument(html).querySelectorAll('code').length, 1);
    }
  });
}
test('ordinary GFM tables retain delimiters, alignment and formatting', () => {
  const html = '<table><thead><tr><th align="right">Name</th><th>Value</th></tr></thead><tbody><tr><td><strong>bold</strong></td><td><code>code</code></td></tr></tbody></table>';
  assert.equal(api.htmlToMarkdown(html), '| Name | Value |\n| --: | --- |\n| **bold** | `code` |');
});
test('empty cells and multiple rows retain their exact values', () => {
  const html = '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td></td><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody></table>';
  assert.deepEqual(cells(api.markdownToHtml(api.htmlToMarkdown(html))), cells(html));
});
test('headerless tables remain HTML and non-table pipes are unchanged', () => {
  const html = '<table><tbody><tr><td>A|B</td><td>1</td></tr></tbody></table>';
  assert.equal(api.htmlToMarkdown(html), html);
  assert.equal(api.htmlToMarkdown('<p>outside | table <code>A|B</code></p>'), 'outside | table `A|B`');
});
