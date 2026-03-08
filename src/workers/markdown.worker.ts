/// <reference lib="webworker" />

declare const self: DedicatedWorkerGlobalScope;

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { marked } from 'marked';

// ============================================
// Turndown (HTML → Markdown) — singleton
// ============================================

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

  service.addRule('underline', {
    filter: ['u'],
    replacement: (content) => `<u>${content}</u>`,
  });
  service.addRule('superscript', {
    filter: ['sup'],
    replacement: (content) => `<sup>${content}</sup>`,
  });
  service.addRule('subscript', {
    filter: ['sub'],
    replacement: (content) => `<sub>${content}</sub>`,
  });
  service.addRule('highlight', {
    filter: ['mark'],
    replacement: (content) => `==${content}==`,
  });

  turndownInstance = service;
  return service;
}

// ============================================
// Marked (Markdown → HTML) — one-time config
// ============================================

let markedConfigured = false;

function ensureMarkedConfigured(): void {
  if (markedConfigured) return;
  marked.setOptions({ gfm: true, breaks: true });
  markedConfigured = true;
}

// ============================================
// Message handler
// ============================================

interface ToHtmlMessage {
  type: 'toHtml';
  id: number;
  markdown: string;
}

interface ToMarkdownMessage {
  type: 'toMarkdown';
  id: number;
  html: string;
}

type WorkerMessage = ToHtmlMessage | ToMarkdownMessage;

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  try {
    if (msg.type === 'toHtml') {
      ensureMarkedConfigured();
      const html = marked.parse(msg.markdown, { async: false }) as string;
      self.postMessage({ type: 'result', id: msg.id, result: html });
    } else if (msg.type === 'toMarkdown') {
      if (!msg.html || msg.html === '<p></p>') {
        self.postMessage({ type: 'result', id: msg.id, result: '' });
        return;
      }
      const service = getTurndownService();
      const markdown = service.turndown(msg.html);
      self.postMessage({ type: 'result', id: msg.id, result: markdown });
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      id: msg.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export {};
