import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { marked } from 'marked';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/sample-document.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

async function createSample() {
  const writes = [];
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require(name) {
      assert.equal(name, '@/db/documents');
      return { createDocument: async (document) => { writes.push(document); return 'sample-id'; } };
    },
  });
  assert.equal(await exports.createSampleDocument(), 'sample-id');
  assert.equal(writes.length, 1);
  return writes[0];
}

test('sample creation preserves its title, tags and representative Markdown examples', async () => {
  const document = await createSample();
  assert.equal(document.title, 'MDView 시작 가이드');
  assert.deepEqual(Array.from(document.tags), ['샘플', '가이드']);
  const html = await marked.parse(document.content);
  for (const tag of ['h1', 'h2', 'table', 'blockquote', 'code']) assert.match(html, new RegExp(`<${tag}[ >]`));
  assert.match(document.content, /```javascript[\s\S]*?```/);
  assert.match(document.content, /- \[x\]/);
  assert.match(document.content, /\$E = mc\^2\$/);
});

test('sample product links retain the current storage origin', async () => {
  const { content } = await createSample();
  assert.doesNotMatch(content, /mdview\.app/);
  const links = [...content.matchAll(/\[MDView[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
  assert.deepEqual(links, ['/', '/guides']);
  for (const origin of ['https://mdview.kr', 'https://www.mdview.kr']) {
    for (const href of links) assert.equal(new URL(href, origin).origin, origin);
  }
});

test('sample distinguishes local storage and file backups from offline availability', async () => {
  const { content } = await createSample();
  assert.match(content, /기기·브라우저 프로필·사이트 주소/);
  assert.match(content, /자동으로 동기화되지 않습니다/);
  assert.match(content, /내보내기 → 마크다운 \(\.md\)/);
  assert.match(content, /브라우저 데이터를 지우면 저장한 문서가 사라질 수/);
  assert.match(content, /오프라인에서 다시 여는 동작은 보장하지 않습니다/);
  assert.doesNotMatch(content, /인터넷 없이도 사용 가능|앱처럼 설치하여 사용|\*\*PWA\*\*/);
});

test('sample explains HWPX, PDF and external-image export limits', async () => {
  const { content } = await createSample();
  assert.match(content, /바이너리 \*\*\.hwp\*\* 파일 생성은 지원하지 않습니다/);
  assert.match(content, /일반 문서의 WYSIWYG 모드에서 브라우저 인쇄/);
  assert.match(content, /대용량 문서는 PDF 인쇄를 지원하지 않/);
  assert.match(content, /외부 이미지 주소는 HWPX 파일에 포함되지 않습니다/);
  assert.doesNotMatch(content, /마크다운\/HWP\/PDF/);
});
