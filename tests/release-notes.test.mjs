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
