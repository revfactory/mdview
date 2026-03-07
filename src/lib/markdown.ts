import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { marked } from 'marked';

let turndownInstance: TurndownService | null = null;

function getTurndownService(): TurndownService {
  if (turndownInstance) return turndownInstance;

  const service = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  service.use(gfm);

  // Underline -> custom marker
  service.addRule('underline', {
    filter: ['u'],
    replacement: (content) => `<u>${content}</u>`,
  });

  // Superscript
  service.addRule('superscript', {
    filter: ['sup'],
    replacement: (content) => `<sup>${content}</sup>`,
  });

  // Subscript
  service.addRule('subscript', {
    filter: ['sub'],
    replacement: (content) => `<sub>${content}</sub>`,
  });

  // Highlight / mark
  service.addRule('highlight', {
    filter: ['mark'],
    replacement: (content) => `==${content}==`,
  });

  turndownInstance = service;
  return service;
}

export function htmlToMarkdown(html: string): string {
  if (!html || html === '<p></p>') return '';

  const service = getTurndownService();
  return service.turndown(html);
}

let markedConfigured = false;

function ensureMarkedConfigured(): void {
  if (markedConfigured) return;

  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  markedConfigured = true;
}

export function markdownToHtml(md: string): string {
  if (!md) return '';

  ensureMarkedConfigured();
  const result = marked.parse(md);

  // marked.parse can return string | Promise<string>
  // with async: false (default), it returns string
  return result as string;
}
