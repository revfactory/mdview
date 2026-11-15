'use client';

import { getDirtyEditorSnapshot } from '@/lib/editor-dirty-snapshot';

import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { enqueueDocumentOperation, awaitDocumentSaves } from '@/lib/document-save-queue';
import { getChunk, updateChunk } from '@/db/chunks';
import { markdownToHtml, htmlToMarkdown, markdownToHtmlAsync } from '@/lib/markdown';
import type { Editor as TipTapEditor } from '@tiptap/react';

export function usePaginatedChunks(documentId: string, totalChunks: number, transitionBlocked = false) {
  const [currentPage, setCurrentPage] = useState(0);
  const [chunkHtml, setChunkHtml] = useState('');
  const [chunkMarkdown, setChunkMarkdown] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pageChanging, setPageChanging] = useState(false);
  const transitionInFlight = useRef(false);
  const ownerGeneration = useRef(0);
  const loadedChunk = useRef<{ documentId: string; page: number; id: number } | null>(null);
  // Invalidate old asynchronous transitions before the next document is painted.
  useLayoutEffect(() => {
    ownerGeneration.current++;
    loadedChunk.current = null;
    transitionInFlight.current = false;
    return () => {
      // Invalidate the live ownership counter, not a captured generation.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ownerGeneration.current++;
      loadedChunk.current = null;
    };
  }, [documentId]);
  const editorRef = useRef<TipTapEditor | null>(null);
  // Content publication is not a write acknowledgement. Retain the exact raw
  // snapshot even when React resets the editor's dirty marker before DB settles.
  const pendingSnapshot = useRef<{ documentId: string; page: number; chunkId: number; markdown: string; html: string } | null>(null);

  const persistSnapshot = useCallback(async (snapshot: NonNullable<typeof pendingSnapshot.current>) => {
    await enqueueDocumentOperation(snapshot.documentId,
      () => updateChunk(snapshot.documentId, snapshot.page, snapshot.markdown, snapshot.html, snapshot.chunkId),
      { scope: 'page', page: snapshot.page });
    if (pendingSnapshot.current === snapshot) pendingSnapshot.current = null;
  }, []);

  const getCurrentChunkId = useCallback(() => {
    const loaded = loadedChunk.current;
    if (!loaded || loaded.documentId !== documentId || loaded.page !== currentPage) {
      throw new Error('페이지를 불러오는 중이거나 페이지 식별자가 없습니다.');
    }
    return loaded.id;
  }, [documentId, currentPage]);

  const saveCurrentPage = useCallback(async () => {
    const chunkId = getCurrentChunkId();
    const html = editorRef.current ? getDirtyEditorSnapshot(editorRef.current) : null;
    if (html !== null) {
      pendingSnapshot.current = { documentId, page: currentPage, chunkId, markdown: htmlToMarkdown(html), html };
    }
    const pending = pendingSnapshot.current;
    if (pending?.documentId === documentId && pending.page === currentPage) await persistSnapshot(pending);
    await awaitDocumentSaves(documentId);
  }, [documentId, currentPage, persistSnapshot, getCurrentChunkId]);

  // Load a chunk and return { html, markdown }
  const loadChunk = useCallback(async (page: number) => {
    const chunk = await getChunk(documentId, page);
    if (!chunk || !Number.isSafeInteger(chunk.id) || chunk.id! <= 0) throw new Error('페이지가 없거나 식별자가 유효하지 않습니다.');
    const id = chunk.id as number;

    let html = chunk.htmlContent;
    if (!html && chunk.markdown) {
      html = chunk.markdown.length > 100_000
        ? await markdownToHtmlAsync(chunk.markdown)
        : markdownToHtml(chunk.markdown);
      // Cache HTML
      // Derived HTML need not write back: an edit may have happened during conversion.
    }
    return { id, html: html || '<p></p>', markdown: chunk.markdown || '' };
  }, [documentId]);

  // Load first chunk on mount / document switch
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- A new external document selection resets pagination before its async IndexedDB read.
    setCurrentPage(0);
    setPageChanging(false);
    setIsPageLoading(true);
    setLoadError(null);
    loadedChunk.current = null;

    (async () => {
      try {
        const { id, html, markdown } = await loadChunk(0);
        if (cancelled) return;
        loadedChunk.current = { documentId, page: 0, id };
        setIsPageLoading(false);
        setChunkHtml(html);
        setChunkMarkdown(markdown);
      } catch (err) {
        console.error('Failed to load chunk:', err);
        if (!cancelled) {
          // A failed read is not an empty document. Keep editors unavailable.
          setLoadError('페이지를 불러오지 못했습니다. 저장된 내용은 변경하지 않았습니다.');
          setIsPageLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [documentId, loadChunk, loadAttempt]);

  const retryLoad = useCallback(() => {
    if (!loadError || isPageLoading) return;
    setIsPageLoading(true);
    setLoadAttempt(attempt => attempt + 1);
  }, [loadError, isPageLoading]);

  // Save current chunk, then load new one
  const handlePageChange = useCallback(
    async (newPage: number) => {
      if (!loadedChunk.current || transitionInFlight.current || transitionBlocked || newPage === currentPage || newPage < 0 || newPage >= totalChunks) return;
      transitionInFlight.current = true;
      const generation = ownerGeneration.current;
      setPageChanging(true);

      try {
        await saveCurrentPage();
        if (generation !== ownerGeneration.current) return;

        // Load new page
        const { id, html, markdown } = await loadChunk(newPage);
        if (generation !== ownerGeneration.current) return;
        loadedChunk.current = { documentId, page: newPage, id };
        setChunkHtml(html);
        setChunkMarkdown(markdown);
        setCurrentPage(newPage);
      } catch (err) {
        console.error('Failed to change page:', err);
      } finally {
        if (generation === ownerGeneration.current) {
          transitionInFlight.current = false;
          setPageChanging(false);
        }
      }
    },
    [documentId, currentPage, totalChunks, loadChunk, transitionBlocked, saveCurrentPage]
  );

  // Handle editor content change (both markdown and html)
  const handleChange = useCallback(
    (markdown: string, html: string) => {
      const snapshot = { documentId, page: currentPage, chunkId: getCurrentChunkId(), markdown, html };
      pendingSnapshot.current = snapshot;
      setChunkMarkdown(markdown);
      setChunkHtml(html);
      persistSnapshot(snapshot).catch((err) =>
        console.error('Failed to save chunk:', err)
      );
    },
    [documentId, currentPage, persistSnapshot, getCurrentChunkId]
  );

  // Raw source is authoritative. Keep a retry snapshot without publishing an
  // empty preview, and never treat derived conversion as another user write.
  const handleSourceInput = useCallback(async (markdown: string) => {
    const snapshot = { documentId, page: currentPage, chunkId: getCurrentChunkId(), markdown, html: '' };
    pendingSnapshot.current = snapshot;
    setChunkMarkdown(markdown);
    await persistSnapshot(snapshot);
  }, [documentId, currentPage, getCurrentChunkId, persistSnapshot]);

  const publishSourcePreview = useCallback((html: string) => {
    getCurrentChunkId();
    setChunkHtml(html);
  }, [getCurrentChunkId]);

  const flush = useCallback(async () => {
    if (loadError || isPageLoading || pageChanging || !editorRef.current) throw new Error('페이지를 불러오는 중입니다.');
    await saveCurrentPage();
  }, [loadError, isPageLoading, pageChanging, saveCurrentPage]);

  const prepareLeave = useCallback(async () => {
    // Initial read failure has no editable page, but earlier failed writes
    // must still prevent losing their recovery state.
    if (!loadedChunk.current && !pendingSnapshot.current) {
      await awaitDocumentSaves(documentId);
      return;
    }
    await flush();
  }, [documentId, flush]);

  // Keyboard shortcuts: Ctrl+PageUp/PageDown
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'PageUp') {
        e.preventDefault();
        handlePageChange(currentPage - 1);
      } else if (e.ctrlKey && e.key === 'PageDown') {
        e.preventDefault();
        handlePageChange(currentPage + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentPage, handlePageChange]);

  return {
    flush,
    prepareLeave,
    getCurrentChunkId,
    currentPage,
    chunkHtml,
    chunkMarkdown,
    isPageLoading,
    loadError,
    retryLoad,
    pageChanging,
    editorRef,
    handlePageChange,
    handleChange,
    handleSourceInput,
    publishSourcePreview,
  };
}
