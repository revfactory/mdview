type GtagEvent = {
  action: string;
  category: string;
  label?: string;
  value?: number;
};

function gtag(...args: unknown[]) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag(...args);
  }
}

export function trackEvent({ action, category, label, value }: GtagEvent) {
  gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  });
}

// Document
export const analytics = {
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

  importHwp: () =>
    trackEvent({ action: 'import', category: 'file', label: 'hwp' }),

  importPdf: () =>
    trackEvent({ action: 'import', category: 'file', label: 'pdf' }),

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
