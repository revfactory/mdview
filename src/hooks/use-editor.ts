'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getDocument } from '@/db/documents';
import { useEditorStore } from '@/stores/editor-store';
import { useAutosave } from '@/hooks/use-autosave';
import { markdownToHtml, markdownToHtmlAsync } from '@/lib/markdown';

// Threshold: documents larger than this bypass WYSIWYG (TipTap can't handle it)
const LARGE_DOC_THRESHOLD = 300_000; // 300KB markdown

export function useEditorManager(documentId: string | null) {
  const [content, setContent] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLargeDocument, setIsLargeDocument] = useState(false);
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
          const raw = doc.content || '';
          setContent(raw);

          // Detect large documents — skip WYSIWYG HTML generation entirely
          const docIsLarge = raw.length > LARGE_DOC_THRESHOLD;
          setIsLargeDocument(docIsLarge);

          if (docIsLarge) {
            // Large doc: don't generate HTML at all (TipTap will freeze)
            // Source view will use the raw markdown directly
            setHtmlContent('');
          } else {
            // Normal doc: prefer stored htmlContent
            let html = doc.htmlContent || '';
            if (!html && raw) {
              if (raw.length > 100_000) {
                html = await markdownToHtmlAsync(raw);
              } else {
                html = markdownToHtml(raw);
              }
            }
            if (cancelled) return;
            setHtmlContent(html);
          }
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
    isLargeDocument,
    onChange,
  };
}
