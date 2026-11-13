import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseNotes } from '../scripts/release-notes.mjs';

test('release notes include only the selected version', () => {
 const source='## [Unreleased]\nnext\n## [0.2.0] - 2026-11-09\n\n### Fixed\n- fixed\n\n---\n\n## [0.1.0] - 2026-05-28\nold';
 const result=releaseNotes('0.2.0',source);
 assert.match(result, /fixed/); assert.doesNotMatch(result,/next|old|---/);
});
test('invalid, missing, empty or duplicate versions fail closed', () => {
 for (const [v,s] of [['../x',''],['1.0.0',''],['1.0.0','## [1.0.0] - date'],['1.0.0','## [1.0.0] - date\ntext\n\n## [1.0.0] - date\ntext']]) assert.throws(()=>releaseNotes(v,s));
});


test('release notes reject malformed and impossible calendar dates', () => {
  for (const date of ['date', '2026-2-01', '2026-02-30', '2026-02-29', '2026-13-01', '2026-00-10', '2026-11-12 trailing']) {
    assert.throws(() => releaseNotes('1.0.0', `## [1.0.0] - ${date}\n\n- Fixed a bug`), /Release date/);
  }
});

test('release notes require content, not only headings, comments or dividers', () => {
  for (const body of ['\n### Fixed', '- <!-- placeholder -->', '1. <!-- placeholder -->', '- [ ] <!-- placeholder -->', '\n### Fixed\n\n<!-- explain changes here -->', '\n### Fixed\n\n---\n***', '<!-- multi-line\nplaceholder -->']) {
    assert.throws(() => releaseNotes('1.0.0', `## [1.0.0] - 2026-11-12\n${body}`), /empty/);
  }
});

test('release notes accept leap dates, CRLF and substantive prose without rewriting notes', () => {
  const source = '## [1.0.0] - 2028-02-29\r\n\r\n### Fixed\r\n한글 변경 내용을 기록합니다.';
  assert.equal(releaseNotes('1.0.0', source), source + '\n');
});
