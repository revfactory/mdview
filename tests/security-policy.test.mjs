import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const policy = readFileSync(new URL('../SECURITY.md', import.meta.url), 'utf8');
test('security support follows latest release without a stale fixed version promise', () => {
  assert.match(policy, /최신 minor 버전만 지원/);
  assert.match(policy, /\| 최신 릴리즈의 minor 계열 \| ✅/);
  assert.match(policy, /\| 이전 minor 계열 \| ❌/);
  assert.match(policy, /https:\/\/github.com\/revfactory\/mdview\/releases\/latest/);
  assert.doesNotMatch(policy, /\|\s*\d+\.\d+\.x\s*\|\s*✅/);
});
test('security reports still use the private channel rather than public issues', () => {
  assert.match(policy, /공개 이슈로 신고하지 마세요/);
  assert.match(policy, /https:\/\/github.com\/revfactory\/mdview\/security\/advisories\/new/);
});
