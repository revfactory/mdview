'use client';

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { getDocument, updateDocument } from '@/db/documents';
import { getChunkCount, saveChunks } from '@/db/chunks';
import { chunkDocument } from '@/lib/chunk-document';
import { useEditorStore } from '@/stores/editor-store';
import { awaitDocumentSaves } from '@/lib/document-save-queue';
import { useAutosave } from '@/hooks/use-autosave';
import { markdownToHtml, markdownToHtmlAsync } from '@/lib/markdown';
import type { DocumentKind } from '@/types';

// Threshold: documents larger than this bypass WYSIWYG (TipTap can't handle it)
const LARGE_DOC_THRESHOLD = 300_000; // 300KB markdown

export function useEditorManager(documentId: string | null) {
  const [content, setContent] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [isLargeDocument, setIsLargeDocument] = useState(false);
  const [isChunked, setIsChunked] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);
  const [documentKind, setDocumentKind] = useState<DocumentKind>('markdown');
  const { actions } = useEditorStore();
  const [sourcePending, setSourcePending] = useState(false);
  const sourceRevision = useRef(0);
  const currentDocument = useRef(documentId);
  const loadedDocumentId = useRef(documentId);
  useLayoutEffect(() => {
    if (currentDocument.current !== documentId) loadedDocumentId.current = null;
    currentDocument.current = documentId;
    sourceRevision.current++;
    return () => { sourceRevision.current++; };
  }, [documentId]);
  const save = useAutosave(documentId);
  const prevDocId = useRef<string | null>(null);

  // Load document when ID changes
  useEffect(() => {
    if (documentId === prevDocId.current) return;
    prevDocId.current = documentId;

    if (!documentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clearing the external document selection must reset the editor before another document loads.
      setContent('');
      setHtmlContent('');
      setIsChunked(false);
      setChunkCount(0);
      setDocumentKind('markdown');
      return;
    }

    let cancelled = false;
    loadedDocumentId.current = null;
    setLoadedId(null);
    setIsLoading(true);
    setSourcePending(false);

    (async () => {
      try {
        try {
          await awaitDocumentSaves(documentId);
        } catch (error) {
          console.error('Previous save failed; loading last stored document:', error);
          if (!cancelled) {
            const { useToastStore } = await import('@/stores/toast-store');
            useToastStore.getState().actions.addToast('이전 변경을 저장하지 못했습니다. 마지막 저장된 문서를 불러옵니다.', 'error');
          }
        }
        if (cancelled) return;
        const doc = await getDocument(documentId);
        if (cancelled) return;

        if (doc?.kind === 'pdf') {
          // PDF는 원본을 뷰어가 직접 읽는다. 편집기·자동저장이 마크다운으로 덮어쓰지 않게 내용은 비워 둔다.
          setContent('');
          setHtmlContent('');
          setIsChunked(false);
          setChunkCount(0);
          setIsLargeDocument(false);
          setDocumentKind('pdf');
          actions.setActiveDocument(documentId);
          actions.setSaveStatus('saved');
          loadedDocumentId.current = documentId;
          setLoadedId(documentId);
          return;
        }
        setDocumentKind('markdown');

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
              setLoadedId(documentId);
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
              setLoadedId(documentId);
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
        loadedDocumentId.current = documentId;
        setLoadedId(documentId);
      } catch (error) {
        if (cancelled) return;
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

  // Source text is authoritative: persist before any asynchronous preview work.
  const onSourceChange = useCallback((markdown: string) => {
    if (!documentId || currentDocument.current !== documentId || loadedDocumentId.current !== documentId || isChunked || documentKind === 'pdf') return;
    const revision = ++sourceRevision.current;
    setContent(markdown);
    setSourcePending(true);
    // Empty HTML invalidates the derived cache; reopening reconstructs it from Markdown.
    void save(markdown, '');
    const conversion = markdown.length > 50_000
      ? markdownToHtmlAsync(markdown)
      : Promise.resolve().then(() => markdownToHtml(markdown));
    void conversion.then(html => {
      if (currentDocument.current !== documentId || revision !== sourceRevision.current) return;
      setHtmlContent(html);
      setSourcePending(false);
      void save(markdown, html);
    }).catch(error => {
      if (currentDocument.current !== documentId || revision !== sourceRevision.current) return;
      console.error('Preview conversion failed; source is preserved:', error);
      // Keep the stale visual editor read-only rather than letting it overwrite the source.
      import('@/stores/toast-store').then(({ useToastStore }) => {
        useToastStore.getState().actions.addToast('미리보기 변환에 실패했습니다. 저장 상태를 확인하고 소스 보기에서 계속 편집하세요.', 'error');
      });
    });
  }, [documentId, isChunked, documentKind, save]);

  const onChange = useCallback((markdown: string, html: string) => {
    if (!documentId || currentDocument.current !== documentId || loadedDocumentId.current !== documentId || isChunked || sourcePending || documentKind === 'pdf') return;
    sourceRevision.current++;
    setContent(markdown);
    setHtmlContent(html);
    void save(markdown, html);
  }, [documentId, isChunked, sourcePending, documentKind, save]);

  return {
    content,
    htmlContent,
    isLoading,
    isLargeDocument,
    isChunked,
    chunkCount,
    // 문서를 바꾼 직후 한 번의 렌더에서는 이전 문서의 종류가 남아 있으므로, 불러오기를 마친 뒤에만 알려 준다.
    documentKind: loadedId === documentId ? documentKind : null,
    onChange,
    onSourceChange,
    sourcePending,
    canSave: loadedId === documentId && !isLoading && documentKind !== 'pdf',
    saveCurrent: () => loadedDocumentId.current === documentId && documentKind !== 'pdf' ? save(content, sourcePending ? '' : htmlContent) : Promise.resolve(),
  };
}
