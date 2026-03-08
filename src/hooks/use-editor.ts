'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getDocument, updateDocument } from '@/db/documents';
import { getChunkCount, saveChunks } from '@/db/chunks';
import { chunkDocument } from '@/lib/chunk-document';
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
  const [isChunked, setIsChunked] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);
  const { actions } = useEditorStore();
  const prevDocId = useRef<string | null>(null);

  // Load document when ID changes
  useEffect(() => {
    if (documentId === prevDocId.current) return;
    prevDocId.current = documentId;

    if (!documentId) {
      setContent('');
      setHtmlContent('');
      setIsChunked(false);
      setChunkCount(0);
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

          // Check if document is chunked (paginated mode)
          if (doc.isChunked && doc.chunkCount && doc.chunkCount > 0) {
            // Verify chunks actually exist in DB
            const actualCount = await getChunkCount(documentId);
            if (cancelled) return;

            if (actualCount > 0) {
              setIsChunked(true);
              setChunkCount(actualCount);
              setIsLargeDocument(false);
              setHtmlContent('');
              actions.setActiveDocument(documentId);
              actions.setSaveStatus('saved');
              setIsLoading(false);
              return;
            }
            // Chunks don't exist — fall through to normal loading
          }

          setIsChunked(false);
          setChunkCount(0);

          // Detect large documents
          const docIsLarge = raw.length > LARGE_DOC_THRESHOLD;

          if (docIsLarge) {
            // Auto-chunk: split large document into chunks on the fly
            try {
              const chunks = chunkDocument(raw);
              await saveChunks(documentId, chunks);
              await updateDocument(documentId, {
                isChunked: true,
                chunkCount: chunks.length,
              } as Partial<import('@/types').Document>);
              if (cancelled) return;

              setIsChunked(true);
              setChunkCount(chunks.length);
              setIsLargeDocument(false);
              setHtmlContent('');
              actions.setActiveDocument(documentId);
              actions.setSaveStatus('saved');
              setIsLoading(false);

              // Notify user
              import('@/stores/toast-store').then(({ useToastStore }) => {
                useToastStore.getState().actions.addToast(
                  `대용량 문서를 ${chunks.length}개 페이지로 자동 분할했습니다.`,
                  'info'
                );
              });
              return;
            } catch (chunkErr) {
              console.error('Auto-chunking failed, falling back to source view:', chunkErr);
              setIsLargeDocument(true);
              setHtmlContent('');
            }
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
          setIsChunked(false);
          setChunkCount(0);
        }
      } catch (error) {
        console.error('Failed to load document:', error);
        setContent('');
        setHtmlContent('');
        setIsChunked(false);
        setChunkCount(0);
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

  // Autosave (only for non-chunked documents; chunked docs save per-chunk)
  useAutosave(documentId, isChunked ? '' : content, isChunked ? '' : htmlContent);

  return {
    content,
    htmlContent,
    isLoading,
    isLargeDocument,
    isChunked,
    chunkCount,
    onChange,
  };
}
