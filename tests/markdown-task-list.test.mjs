import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { marked } from 'marked';
import domino from '@mixmark-io/domino';
import { getSchema } from '@tiptap/core';
import { DOMParser, DOMSerializer } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';

const require = createRequire(import.meta.url);
const load = (path, transform = s => s) => {
  const source = transform(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require });
  return exports;
};
const { MarkdownTaskList, MarkdownTaskItem } = load('../src/extensions/markdown-task-list.ts');
const { htmlToMarkdown } = load('../src/lib/markdown.ts', s => s
  .split('// Worker-based async API')[0].replace(/^import .* from '.\/marked-extensions';$/m, ''));
const schema = getSchema([StarterKit, MarkdownTaskList, MarkdownTaskItem.configure({ nested: true })]);
const parse = html => DOMParser.fromSchema(schema).parse(domino.createWindow(html).document.body);
const fromMd = md => parse(marked.parse(md));
const serialize = doc => {
  const document = domino.createWindow('').document;
  const wrapper = document.createElement('div');
  wrapper.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(doc.content, { document }));
  return wrapper.innerHTML;
};
const describe = node => {
  const out = [];
  node.descendants(item => {
    if (item.type.name === 'taskItem') out.push([item.attrs.checked, item.firstChild.textContent]);
  });
  return out;
};
test('marked checkboxes import in tight, nested and loose checklist groups', () => {
  const md = '- [x] 완료 **강조**\n  - [ ] 하위\n- [ ] 미완료\n\n' +
    '문단\n\n- [ ] 첫 항목\n\n  추가 문단\n\n- [X] 둘째\n';
  const doc = fromMd(md);
  doc.check();
  assert.deepEqual(describe(doc), [
    [true, '완료 강조'], [false, '하위'], [false, '미완료'], [false, '첫 항목'], [true, '둘째'],
  ]);
  assert.match(serialize(doc), /<strong>강조<\/strong>/);
  assert.match(serialize(doc), /<p>추가 문단<\/p>/);
  const roundTrip = fromMd(htmlToMarkdown(serialize(doc)));
  assert.deepEqual(roundTrip.toJSON(), doc.toJSON());
});
test('cached TipTap HTML retains checkbox states, including unchecked and nested items', () => {
  const imported = fromMd('- [ ] 부모\n  - [x] 자식');
  assert.deepEqual(parse(serialize(imported)).toJSON(), imported.toJSON());
  const edited = parse(serialize(imported).replace('data-checked="false"', 'data-checked="true"'));
  assert.match(htmlToMarkdown(serialize(edited)), /- +\[x\] 부모/);
  assert.match(htmlToMarkdown(serialize(edited)), /^ {4}- +\[x\] 자식/m);
});
test('ordinary, mixed and numbered list structures are not reclassified', () => {
  for (const [input, type] of [
    ['- 일반\n- 목록', 'bulletList'],
    ['- 일반\n- [x] 같이 쓰는 항목', 'bulletList'],
    ['1. [x] 번호 목록\n2. [ ] 순서 유지', 'orderedList'],
    ['<ul><li>글 뒤의 <input type="checkbox" disabled checked></li></ul>', 'bulletList'],
    ['<ul><li><input type="checkbox" checked>일반 입력 폼</li></ul>', 'bulletList'],
  ]) {
    const doc = fromMd(input);
    assert.equal(doc.firstChild.type.name, type);
    assert.deepEqual(describe(doc), []);
  }
});
test('a newly emptied visual item does not lose its checkbox or following subtree', () => {
  const doc = parse('<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><div><p></p>' +
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>하위</p></div></li></ul>' +
    '</div></li><li data-type="taskItem" data-checked="false"><div><p>다음</p></div></li></ul>');
  const markdown = htmlToMarkdown(serialize(doc));
  assert.match(markdown, /^- +\[x\] &nbsp;/);
  assert.match(markdown, /^ {4}- +\[ \] 하위/m);
  assert.deepEqual(describe(fromMd(markdown)).map(([checked, text]) => [checked, text.trim()]),
    [[true, ''], [false, '하위'], [false, '다음']]);
});
