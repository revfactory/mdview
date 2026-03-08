'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { getChunk, updateChunk } from '@/db/chunks';
import { markdownToHtml, htmlToMarkdown, markdownToHtmlAsync } from '@/lib/markdown';
import type { Editor as TipTapEditor } from '@tiptap/react';

export function usePaginatedChunks(documentId: string, totalChunks: number) {
  const [currentPage, setCurrentPage] = useState(0);
  const [chunkHtml, setChunkHtml] = useState('');
  const [chunkMarkdown, setChunkMarkdown] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [pageChanging, setPageChanging] = useState(false);
  const editorRef = useRef<TipTapEditor | null>(null);

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
      await updateChunk(documentId, page, chunk.markdown, html);
    }
    return { html: html || '<p></p>', markdown: chunk.markdown || '' };
  }, [documentId]);

  // Load first chunk on mount / document switch
  useEffect(() => {
    let cancelled = false;
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
      if (newPage === currentPage || newPage < 0 || newPage >= totalChunks) return;
      setPageChanging(true);

      try {
        // Save current page from editor
        if (editorRef.current) {
          const html = editorRef.current.getHTML();
          const md = htmlToMarkdown(html);
          await updateChunk(documentId, currentPage, md, html);
        }

        // Load new page
        const { html, markdown } = await loadChunk(newPage);
        setChunkHtml(html);
        setChunkMarkdown(markdown);
        setCurrentPage(newPage);
      } catch (err) {
        console.error('Failed to change page:', err);
      } finally {
        setPageChanging(false);
      }
    },
    [documentId, currentPage, totalChunks, loadChunk]
  );

  // Handle editor content change (both markdown and html)
  const handleChange = useCallback(
    (markdown: string, html: string) => {
      setChunkMarkdown(markdown);
      setChunkHtml(html);
      updateChunk(documentId, currentPage, markdown, html).catch((err) =>
        console.error('Failed to save chunk:', err)
      );
    },
    [documentId, currentPage]
  );

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
