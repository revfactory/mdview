'use client';

import { getDirtyEditorSnapshot } from '@/lib/editor-dirty-snapshot';

import { useState, useCallback, useEffect, useRef } from 'react';
import { enqueueDocumentOperation, awaitDocumentSaves } from '@/lib/document-save-queue';
import { getChunk, updateChunk } from '@/db/chunks';
import { markdownToHtml, htmlToMarkdown, markdownToHtmlAsync } from '@/lib/markdown';
import type { Editor as TipTapEditor } from '@tiptap/react';

export function usePaginatedChunks(documentId: string, totalChunks: number, transitionBlocked = false) {
  const [currentPage, setCurrentPage] = useState(0);
  const [chunkHtml, setChunkHtml] = useState('');
  const [chunkMarkdown, setChunkMarkdown] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [pageChanging, setPageChanging] = useState(false);
  const transitionInFlight = useRef(false);
  const editorRef = useRef<TipTapEditor | null>(null);
  // Content publication is not a write acknowledgement. Retain the exact raw
  // snapshot even when React resets the editor's dirty marker before DB settles.
  const pendingSnapshot = useRef<{ documentId: string; page: number; markdown: string; html: string } | null>(null);

  const persistSnapshot = useCallback(async (snapshot: NonNullable<typeof pendingSnapshot.current>) => {
    await enqueueDocumentOperation(snapshot.documentId,
      () => updateChunk(snapshot.documentId, snapshot.page, snapshot.markdown, snapshot.html),
      { scope: 'page', page: snapshot.page });
    if (pendingSnapshot.current === snapshot) pendingSnapshot.current = null;
  }, []);

  const saveCurrentPage = useCallback(async () => {
    const html = editorRef.current ? getDirtyEditorSnapshot(editorRef.current) : null;
    if (html !== null) {
      pendingSnapshot.current = { documentId, page: currentPage, markdown: htmlToMarkdown(html), html };
    }
    const pending = pendingSnapshot.current;
    if (pending?.documentId === documentId && pending.page === currentPage) await persistSnapshot(pending);
    await awaitDocumentSaves(documentId);
  }, [documentId, currentPage, persistSnapshot]);

  // Load a chunk and return { html, markdown }
  const loadChunk = useCallback(async (page: number) => {
    const chunk = await getChunk(documentId, page);
    if (!chunk) return { html: '<p></p>', markdown: '' };

    let html = chunk.htmlContent;
    if (!html && chunk.markdown) {
      html = chunk.markdown.length > 100_000
        ? await markdownToHtmlAsync(chunk.markdown)
        : markdownToHtml(chunk.markdown);
      // Cache HTML
      // Derived HTML need not write back: an edit may have happened during conversion.
    }
    return { html: html || '<p></p>', markdown: chunk.markdown || '' };
  }, [documentId]);

  // Load first chunk on mount / document switch
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- A new external document selection resets pagination before its async IndexedDB read.
    setCurrentPage(0);
    setIsPageLoading(true);

    (async () => {
      try {
        const { html, markdown } = await loadChunk(0);
        if (cancelled) return;
        setChunkHtml(html);
        setChunkMarkdown(markdown);
      } catch (err) {
        console.error('Failed to load chunk:', err);
        if (!cancelled) {
          setChunkHtml('<p></p>');
          setChunkMarkdown('');
        }
      } finally {
        if (!cancelled) setIsPageLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [documentId, loadChunk]);

  // Save current chunk, then load new one
  const handlePageChange = useCallback(
    async (newPage: number) => {
      if (transitionInFlight.current || transitionBlocked || newPage === currentPage || newPage < 0 || newPage >= totalChunks) return;
      transitionInFlight.current = true;
      setPageChanging(true);

      try {
        await saveCurrentPage();

        // Load new page
        const { html, markdown } = await loadChunk(newPage);
        setChunkHtml(html);
        setChunkMarkdown(markdown);
        setCurrentPage(newPage);
      } catch (err) {
        console.error('Failed to change page:', err);
      } finally {
        transitionInFlight.current = false;
        setPageChanging(false);
      }
    },
    [currentPage, totalChunks, loadChunk, transitionBlocked, saveCurrentPage]
  );

  // Handle editor content change (both markdown and html)
  const handleChange = useCallback(
    (markdown: string, html: string) => {
      const snapshot = { documentId, page: currentPage, markdown, html };
      pendingSnapshot.current = snapshot;
      setChunkMarkdown(markdown);
      setChunkHtml(html);
      persistSnapshot(snapshot).catch((err) =>
        console.error('Failed to save chunk:', err)
      );
    },
    [documentId, currentPage, persistSnapshot]
  );

  const flush = useCallback(async () => {
    if (isPageLoading || pageChanging || !editorRef.current) throw new Error('페이지를 불러오는 중입니다.');
    await saveCurrentPage();
  }, [isPageLoading, pageChanging, saveCurrentPage]);

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
    currentPage,
    chunkHtml,
    chunkMarkdown,
    isPageLoading,
    pageChanging,
    editorRef,
    handlePageChange,
    handleChange,
  };
}
