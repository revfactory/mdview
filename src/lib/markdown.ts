import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { marked } from 'marked';
import { markedMathExtension, markedFootnoteExtension } from './marked-extensions';

let turndownInstance: TurndownService | null = null;

function isInTableCell(node: Node): boolean {
  for (let parent = node.parentNode; parent; parent = parent.parentNode) {
    if (parent.nodeName === 'TD' || parent.nodeName === 'TH') return true;
    if (parent.nodeName === 'TABLE') return false;
  }
  return false;
}

function escapeTableCellPipes(content: string): string {
  if (!content.includes('|')) return content;
  const parts: string[] = [];
  let start = 0;
  for (let pipe = content.indexOf('|'); pipe !== -1; pipe = content.indexOf('|', start)) {
    let backslashStart = pipe;
    while (backslashStart > start && content[backslashStart - 1] === '\\') backslashStart--;
    parts.push(content.slice(start, pipe), (pipe - backslashStart) % 2 === 0 ? '\\|' : '|');
    start = pipe + 1;
  }
  parts.push(content.slice(start));
  return parts.join('');
}

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

  // Marked splits GFM cells on unescaped pipes even inside backtick code.
  // Turndown already escaped ordinary text backslashes; add a separator
  // escape only when the converted cell has an even backslash run.
  service.addRule('tableCellPipes', {
    filter: ['th', 'td'],
    replacement: (content, node) => {
      const prefix = node.previousSibling ? ' ' : '| ';
      return prefix + escapeTableCellPipes(content) + ' |';
    },
  });

  // A literal backslash before a pipe in code can be mistaken for the
  // separator escape. Render only that code span as fixed HTML with escaped
  // text; do not copy table markup or input-derived attributes.
  service.addRule('tableCodeBackslashPipes', {
    filter: (node) => node.nodeName === 'CODE' &&
      !node.textContent?.includes('\n') &&
      /\\\|/.test(node.textContent ?? '') && isInTableCell(node),
    replacement: (_content, node) => {
      const value = (node.textContent ?? '').replace(/[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/g, (char) =>
        '&#' + char.charCodeAt(0) + ';'
      );
      return '<code>' + value + '</code>';
    },
  });

  // Underline -> custom marker
  service.addRule('underline', {
    filter: ['u'],
    replacement: (content) => `<u>${content}</u>`,
  });

  // Superscript (exclude footnote refs)
  service.addRule('superscript', {
    filter: (node) => {
      return node.nodeName === 'SUP' && !node.classList.contains('footnote-ref');
    },
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

  // Math inline: <span class="math-inline" data-math="...">
  service.addRule('mathInline', {
    filter: (node) => {
      return node.nodeName === 'SPAN' && node.classList.contains('math-inline');
    },
    replacement: (_content, node) => {
      const math = (node as HTMLElement).getAttribute('data-math') || '';
      return `$${math}$`;
    },
  });

  // Math block: <div class="math-block" data-math="...">
  service.addRule('mathBlock', {
    filter: (node) => {
      return node.nodeName === 'DIV' && node.classList.contains('math-block');
    },
    replacement: (_content, node) => {
      const math = (node as HTMLElement).getAttribute('data-math') || '';
      return `\n\n$$\n${math}\n$$\n\n`;
    },
  });

  // Footnote ref: <sup class="footnote-ref"><a ...>[n]</a></sup>
  service.addRule('footnoteRef', {
    filter: (node) => {
      return node.nodeName === 'SUP' && node.classList.contains('footnote-ref');
    },
    replacement: (_content, node) => {
      const link = (node as HTMLElement).querySelector('a');
      const text = link?.textContent || '';
      // Extract ID from [n] format
      const id = text.replace(/[\[\]]/g, '');
      return `[^${id}]`;
    },
  });

  // Footnote section
  service.addRule('footnoteSection', {
    filter: (node) => {
      return node.nodeName === 'SECTION' && node.classList.contains('footnotes');
    },
    replacement: (_content, node) => {
      const items = (node as HTMLElement).querySelectorAll('li');
      let result = '\n';
      items.forEach((li) => {
        const id = li.id.replace('fn-', '');
        // Get text content without the backref link
        const p = li.querySelector('p');
        if (p) {
          const backref = p.querySelector('.footnote-backref');
          if (backref) backref.remove();
          result += `[^${id}]: ${p.textContent?.trim() || ''}\n`;
        }
      });
      return result;
    },
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

  marked.use(markedMathExtension());
  marked.use(markedFootnoteExtension());

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
const pendingCallbacks = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();

function resetMarkdownWorker(reason: Error): void {
  mdWorker?.terminate();
  mdWorker = null;
  for (const callback of pendingCallbacks.values()) {
    clearTimeout(callback.timer);
    callback.reject(reason);
  }
  pendingCallbacks.clear();
}

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
    clearTimeout(cb.timer);

    if (type === 'error') {
      cb.reject(new Error(error));
    } else {
      cb.resolve(result);
    }
  };

  mdWorker.onerror = () => resetMarkdownWorker(new Error('Markdown worker failed'));
  mdWorker.onmessageerror = () => resetMarkdownWorker(new Error('Markdown worker response could not be read'));
  return mdWorker;
}

/** Non-blocking markdown → HTML conversion via Web Worker */
export function markdownToHtmlAsync(md: string): Promise<string> {
  if (!md) return Promise.resolve('');

  return new Promise<string>((resolve, reject) => {
    try {
      const worker = getMarkdownWorker();
      const id = ++msgIdCounter;
      const timer = setTimeout(() => resetMarkdownWorker(new Error('Markdown worker timed out')), 15_000);
      pendingCallbacks.set(id, { resolve, reject, timer });
      worker.postMessage({ type: 'toHtml', id, markdown: md });
    } catch (error) {
      resetMarkdownWorker(error instanceof Error ? error : new Error('Markdown worker unavailable'));
      reject(error);
    }
  }).catch(() => markdownToHtml(md));
}

/**
 * HTML → markdown runs on main thread (Turndown requires DOM).
 * Wrapped as async for API consistency.
 */
export function htmlToMarkdownAsync(html: string): Promise<string> {
  return Promise.resolve(htmlToMarkdown(html));
}
