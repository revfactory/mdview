/// <reference lib="webworker" />

declare const self: DedicatedWorkerGlobalScope;

import { marked } from 'marked';

// ============================================
// Marked (Markdown → HTML) — one-time config
// Worker only handles toHtml — Turndown (htmlToMarkdown)
// requires DOM (document) which is unavailable in Workers.
// ============================================

let markedConfigured = false;

function ensureMarkedConfigured(): void {
  if (markedConfigured) return;
  marked.setOptions({ gfm: true, breaks: true });
  markedConfigured = true;
}

interface ToHtmlMessage {
  type: 'toHtml';
  id: number;
  markdown: string;
}

self.onmessage = (e: MessageEvent<ToHtmlMessage>) => {
  const msg = e.data;

  try {
    if (msg.type === 'toHtml') {
      ensureMarkedConfigured();
      const html = marked.parse(msg.markdown, { async: false }) as string;
      self.postMessage({ type: 'result', id: msg.id, result: html });
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
