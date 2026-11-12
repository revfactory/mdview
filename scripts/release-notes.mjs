import { readFileSync, writeFileSync } from 'node:fs';

export function releaseNotes(version, changelog) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Invalid version');
  const header = `## [${version}] - `;
  const sections = changelog.split(/(?=^## \[)/m);
  const matches = sections.filter(section => section.startsWith(header));
  if (matches.length !== 1) throw new Error('Expected exactly one dated version section');
  const text = matches[0].replace(/\n---\s*$/, '').trim();
  const [title, ...lines] = text.split(/\r?\n/);
  const date = title.slice(header.length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Release date must be YYYY-MM-DD');
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error('Release date is invalid');
  }
  const body = lines.join('\n').replace(/<!--[\s\S]*?-->/g, '');
  const hasContent = body.split('\n').some(line => {
    const value = line.trim();
    return value && !/^#{1,6}(?:\s|$)/.test(value) && !/^(?:[-*+]|\d+[.)])(?:\s+\[[ xX]\])?$/.test(value) && !/^(?:[-*_]\s*){3,}$/.test(value);
  });
  if (!hasContent) throw new Error('Release notes are empty');
  return text + '\n';
}

if (process.argv[1]?.endsWith('/release-notes.mjs')) {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  writeFileSync('/tmp/mdview-release-notes.md', releaseNotes(version, readFileSync('CHANGELOG.md', 'utf8')));
  process.stdout.write(`v${version}`);
}
