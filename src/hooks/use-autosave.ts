'use client';

import { useCallback, useRef } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { enqueueDocumentSave } from '@/lib/document-save-queue';

/** Save only user edits, never a render containing the previous document's state. */
export function useAutosave(documentId: string | null) {
  const revision = useRef(0);
  return useCallback(async (content: string, htmlContent: string) => {
    if (!documentId) return;
    const request = ++revision.current;
    const { actions } = useEditorStore.getState();
    const report = (status: 'saving' | 'saved' | 'error') => {
      if (revision.current === request && useEditorStore.getState().activeDocumentId === documentId) actions.setSaveStatus(status);
    };
    report('saving');
    try {
      await enqueueDocumentSave(documentId, content, htmlContent);
      report('saved');
    } catch (error) {
      console.error('Autosave failed:', error);
      report('error');
    }
  }, [documentId]);
}
