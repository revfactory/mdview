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

function trackFileAction(action: 'import' | 'convert', label: 'hwp' | 'markdown' | 'pdf', source?: EntrySource) {
  const params = { event_category: 'file', event_label: label };
  // Reject arbitrary values at the telemetry boundary; unknown sources remain unlabelled.
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
  importMarkdown: (source?: EntrySource) =>
    trackFileAction('import', 'markdown', source),

  pasteMarkdown: (source: EntrySource = 'home') =>
    gtag('event', 'markdown_paste_complete', { entry_source: ENTRY_SOURCES.includes(source) ? source : 'direct' }),

  importHwp: (source?: EntrySource) =>
    trackFileAction('import', 'hwp', source),

  importPdf: (source: EntrySource) =>
    trackFileAction('import', 'pdf', source),

  convertPdf: (source?: EntrySource) =>
    trackFileAction('convert', 'pdf', source),

  pdfExampleComplete: () =>
    gtag('event', 'pdf_example_complete', {}),

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
