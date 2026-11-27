import { ENTRY_SOURCES, type EntryAction, type EntrySource } from './entry-actions';

type GtagEvent = {
  action: string;
  category: string;
  label?: string;
  value?: number;
};

function gtag(...args: unknown[]) {
  if (typeof window === 'undefined') return;
  const analyticsWindow = window as Window & { gtag?: (...values: unknown[]) => void };
  try {
    if (typeof analyticsWindow.gtag === 'function') analyticsWindow.gtag(...args);
  } catch {
    // Optional tracking must never interrupt a successful product operation.
  }
}

export function trackEvent({ action, category, label, value }: GtagEvent) {
  gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  });
}

function trackPdfAction(action: 'import' | 'convert', source?: EntrySource) {
  const params = { event_category: 'file', event_label: 'pdf' };
  // Reject unknown values at the telemetry boundary; do not guess a source for a reopened PDF.
  gtag('event', action, source && ENTRY_SOURCES.includes(source)
    ? { ...params, entry_source: source }
    : params);
}

// Document
export const analytics = {
  // Fixed values only. Never include document names, contents, URLs, or raw search parameters.
  startAction: (action: EntryAction, source: EntrySource) =>
    gtag('event', 'editor_start', { entry_action: action, entry_source: source }),

  documentCreate: () =>
    trackEvent({ action: 'create', category: 'document' }),

  documentDelete: () =>
    trackEvent({ action: 'delete', category: 'document' }),

  documentDuplicate: () =>
    trackEvent({ action: 'duplicate', category: 'document' }),

  documentOpen: () =>
    trackEvent({ action: 'open', category: 'document' }),

  // Import / Export
  importMarkdown: () =>
    trackEvent({ action: 'import', category: 'file', label: 'markdown' }),

  pasteMarkdown: (source: EntrySource = 'home') =>
    gtag('event', 'markdown_paste_complete', { entry_source: ENTRY_SOURCES.includes(source) ? source : 'direct' }),

  importHwp: () =>
    trackEvent({ action: 'import', category: 'file', label: 'hwp' }),

  importPdf: (source: EntrySource) =>
    trackPdfAction('import', source),

  convertPdf: (source?: EntrySource) =>
    trackPdfAction('convert', source),

  exportMarkdown: () =>
    trackEvent({ action: 'export', category: 'file', label: 'markdown' }),

  exportHwp: () =>
    trackEvent({ action: 'export', category: 'file', label: 'hwp' }),

  // Editor
  viewModeChange: (mode: string) =>
    trackEvent({ action: 'view_mode', category: 'editor', label: mode }),

  formatUse: (format: string) =>
    trackEvent({ action: 'format', category: 'editor', label: format }),

  // Folder
  folderCreate: () =>
    trackEvent({ action: 'create', category: 'folder' }),

  folderDelete: () =>
    trackEvent({ action: 'delete', category: 'folder' }),

  // UI
  themeToggle: (theme: string) =>
    trackEvent({ action: 'theme', category: 'ui', label: theme }),

  tocToggle: () =>
    trackEvent({ action: 'toc_toggle', category: 'ui' }),

  quickOpen: () =>
    trackEvent({ action: 'quick_open', category: 'ui' }),
};
