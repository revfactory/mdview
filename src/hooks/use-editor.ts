'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getDocument } from '@/db/documents';
import { useEditorStore } from '@/stores/editor-store';
import { useAutosave } from '@/hooks/use-autosave';
import { markdownToHtml } from '@/lib/markdown';

export function useEditorManager(documentId: string | null) {
  const [content, setContent] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { actions } = useEditorStore();
  const prevDocId = useRef<string | null>(null);

  // Load document when ID changes
  useEffect(() => {
    if (documentId === prevDocId.current) return;
    prevDocId.current = documentId;

    if (!documentId) {
      setContent('');
      setHtmlContent('');
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const doc = await getDocument(documentId);
        if (cancelled) return;

        if (doc) {
          setContent(doc.content || '');
          // If htmlContent exists, use it; otherwise convert markdown to HTML
          const html = doc.htmlContent || (doc.content ? markdownToHtml(doc.content) : '');
          setHtmlContent(html);
          actions.setActiveDocument(documentId);
          actions.setSaveStatus('saved');
        } else {
          setContent('');
          setHtmlContent('');
        }
      } catch (error) {
        console.error('Failed to load document:', error);
        setContent('');
        setHtmlContent('');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, actions]);

  // onChange handler for the editor
  const onChange = useCallback(
    (markdown: string, html: string) => {
      setContent(markdown);
      setHtmlContent(html);
    },
    []
  );

  // Autosave
  useAutosave(documentId, content, htmlContent);

  return {
    content,
    htmlContent,
    isLoading,
    onChange,
  };
}
