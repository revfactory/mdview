import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const template = readFileSync(new URL('../.github/ISSUE_TEMPLATE/bug_report.md', import.meta.url), 'utf8');
test('bug reports collect storage context without private URLs or account names', () => {
  assert.match(template, /접속 주소의 origin/);
  assert.match(template, /쿼리 문자열은 제외/);
  assert.match(template, /개인 계정 이름은 제외/);
});
test('storage troubleshooting protects original documents and explains isolated profiles', () => {
  assert.match(template, /저장소를 초기화하지 마세요/);
  assert.match(template, /내보내기로 백업/);
  assert.match(template, /원래 문서가 있는 창은 유지/);
  assert.match(template, /`mdview.kr`과 `www.mdview.kr`은 서로 다른 저장소/);
  assert.match(template, /기존 문서가 자동으로 나타나지 않습니다/);
  assert.match(template, /새 합성 문서로 비교/);
});
