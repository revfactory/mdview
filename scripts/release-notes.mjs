import { readFileSync, writeFileSync } from 'node:fs';

export function releaseNotes(version, changelog) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Invalid version');
  const header = `## [${version}] - `;
  const sections = changelog.split(/(?=^## \[)/m);
  const matches = sections.filter(section => section.startsWith(header));
  if (matches.length !== 1) throw new Error('Expected exactly one dated version section');
  const text = matches[0].replace(/\n---\s*$/, '').trim();
  if (text.split('\n').length < 3) throw new Error('Release notes are empty');
  return text + '\n';
}

if (process.argv[1]?.endsWith('/release-notes.mjs')) {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  writeFileSync('/tmp/mdview-release-notes.md', releaseNotes(version, readFileSync('CHANGELOG.md', 'utf8')));
  process.stdout.write(`v${version}`);
}
