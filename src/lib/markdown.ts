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
  const result = marked.parse(md, { async: false });

  return result;
}

// =============================================
// Worker-based async API (non-blocking)
// =============================================

let mdWorker: Worker | null = null;
let msgIdCounter = 0;
const pendingCallbacks = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void }>();

function getMarkdownWorker(): Worker {
  if (mdWorker) return mdWorker;

  mdWorker = new Worker(
    new URL('../workers/markdown.worker.ts', import.meta.url)
  );

  mdWorker.onmessage = (e: MessageEvent) => {
    const { id, type, result, error } = e.data;
    const cb = pendingCallbacks.get(id);
    if (!cb) return;
    pendingCallbacks.delete(id);

    if (type === 'error') {
      cb.reject(new Error(error));
    } else {
      cb.resolve(result);
    }
  };

  return mdWorker;
}

/** Non-blocking markdown → HTML conversion via Web Worker */
export function markdownToHtmlAsync(md: string): Promise<string> {
  if (!md) return Promise.resolve('');

  return new Promise((resolve, reject) => {
    const id = ++msgIdCounter;
    pendingCallbacks.set(id, { resolve, reject });
    getMarkdownWorker().postMessage({ type: 'toHtml', id, markdown: md });
  });
}

/**
 * HTML → markdown runs on main thread (Turndown requires DOM).
 * Wrapped as async for API consistency.
 */
export function htmlToMarkdownAsync(html: string): Promise<string> {
  return Promise.resolve(htmlToMarkdown(html));
}
