'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { updateContent } from '@/db/documents';
import { DEFAULT_SETTINGS } from '@/lib/constants';

export function useAutosave(
  documentId: string | null,
  content: string,
  htmlContent: string
) {
  const { actions } = useEditorStore();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevContentRef = useRef(content);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const save = useCallback(
    async (md: string, html: string) => {
      if (!documentId) return;

      actions.setSaveStatus('saving');

      try {
        const doSave = () => updateContent(documentId, md, html);

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          await new Promise<void>((resolve, reject) => {
            window.requestIdleCallback(async () => {
              try {
                await doSave();
                resolve();
              } catch (err) {
                reject(err);
              }
            });
          });
        } else {
          await doSave();
        }

        if (isMountedRef.current) {
          actions.setSaveStatus('saved');
        }
      } catch (error) {
        console.error('Autosave failed:', error);
        if (isMountedRef.current) {
          actions.setSaveStatus('error');
        }
      }
    },
    [documentId, actions]
  );

  useEffect(() => {
    // Skip initial mount or if content hasn't changed
    if (content === prevContentRef.current) return;
    prevContentRef.current = content;

    if (!documentId) return;

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce save by 1 second
    timeoutRef.current = setTimeout(() => {
      save(content, htmlContent);
    }, DEFAULT_SETTINGS.autosaveInterval);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, htmlContent, documentId, save]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}
