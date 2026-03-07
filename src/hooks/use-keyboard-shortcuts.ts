'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/stores/ui-store';

interface KeyboardShortcutsOptions {
  onNewDocument: () => void;
  onForceSave?: () => void;
  onSearchFocus?: () => void;
  onQuickOpen?: () => void;
}

export function useKeyboardShortcuts({
  onNewDocument,
  onForceSave,
  onSearchFocus,
  onQuickOpen,
}: KeyboardShortcutsOptions) {
  const { actions } = useUIStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      if (isMeta && e.key === 'n') {
        e.preventDefault();
        onNewDocument();
        return;
      }

      if (isMeta && e.key === '\\') {
        e.preventDefault();
        actions.toggleSidebar();
        return;
      }

      if (isMeta && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        const viewModes: Array<'wysiwyg' | 'split' | 'source'> = [
          'wysiwyg',
          'split',
          'source',
        ];
        const current = useUIStore.getState().viewMode;
        const idx = viewModes.indexOf(current);
        const next = viewModes[(idx + 1) % viewModes.length];
        actions.setViewMode(next);
        return;
      }

      if (isMeta && e.key === 's') {
        e.preventDefault();
        onForceSave?.();
        return;
      }

      if (isMeta && e.key === 'k') {
        e.preventDefault();
        onSearchFocus?.();
        return;
      }

      if (isMeta && e.key === 'p') {
        e.preventDefault();
        onQuickOpen?.();
        return;
      }

      // Cmd+Shift+F: Toggle focus mode
      if (isMeta && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        actions.toggleFocusMode();
        return;
      }

      // ESC: Exit focus mode
      if (e.key === 'Escape') {
        const { focusMode } = useUIStore.getState();
        if (focusMode) {
          e.preventDefault();
          actions.toggleFocusMode();
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions, onNewDocument, onForceSave, onSearchFocus, onQuickOpen]);
}
