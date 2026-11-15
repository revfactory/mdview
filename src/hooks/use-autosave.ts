'use client';

import { useCallback, useRef, type RefObject } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { enqueueDocumentOperation } from '@/lib/document-save-queue';

/** Save only user edits, never a render containing the previous document's state. */
export function useAutosave(documentId: string | null, session: RefObject<{ save: (snapshot: { markdown: string; html: string }) => Promise<void>; hasConflict?: () => boolean } | null>, onConflict?: () => void) {
  const revision = useRef(0);
  return useCallback(async (content: string, htmlContent: string) => {
    if (!documentId) return;
    const owner = session.current;
    const request = ++revision.current;
    const { actions } = useEditorStore.getState();
    const report = (status: 'saving' | 'saved' | 'error') => {
      if (revision.current === request && useEditorStore.getState().activeDocumentId === documentId) actions.setSaveStatus(status);
    };
    report('saving');
    try {
      await enqueueDocumentOperation(documentId, async () => {
        if (!owner) throw new Error('저장할 문서 원본을 불러오지 못했습니다.');
        await owner.save({ markdown: content, html: htmlContent });
      }, { scope: 'document' });
      report('saved');
    } catch (error) {
      console.error('Autosave failed:', error);
      if (owner?.hasConflict?.() && session.current === owner && useEditorStore.getState().activeDocumentId === documentId) onConflict?.();
      report('error');
    }
  }, [documentId, session, onConflict]);
}
