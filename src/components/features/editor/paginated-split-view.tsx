'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Editor } from '@/components/features/editor/editor';
import { PageNavigator } from '@/components/features/editor/page-navigator';
import { usePaginatedChunks } from '@/hooks/use-paginated-chunks';
import { updateChunk } from '@/db/chunks';
import type { Editor as TipTapEditor } from '@tiptap/react';

interface PaginatedSplitViewProps {
  documentId: string;
  totalChunks: number;
  onEditorReady?: (editor: TipTapEditor | null) => void;
}

export function PaginatedSplitView({
  documentId,
  totalChunks,
  onEditorReady,
}: PaginatedSplitViewProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updatingFromSource = useRef(false);
  const [dividerX, setDividerX] = useState(50);

  const {
    currentPage,
    chunkHtml,
    chunkMarkdown,
    isPageLoading,
    pageChanging,
    editorRef,
    handlePageChange,
    handleChange,
  } = usePaginatedChunks(documentId, totalChunks);

  // Sync textarea when chunk markdown changes (page switch or WYSIWYG edit)
  useEffect(() => {
    if (updatingFromSource.current) {
      updatingFromSource.current = false;
      return;
    }
    if (textareaRef.current && textareaRef.current.value !== chunkMarkdown) {
      textareaRef.current.value = chunkMarkdown;
    }
  }, [chunkMarkdown]);

  const handleEditorReady = useCallback(
    (editor: TipTapEditor | null) => {
      editorRef.current = editor;
      onEditorReady?.(editor);
    },
    [editorRef, onEditorReady]
  );

  // WYSIWYG → source sync
  const handleWysiwygChange = useCallback(
    (markdown: string, html: string) => {
      if (textareaRef.current) {
        textareaRef.current.value = markdown;
      }
      handleChange(markdown, html);
    },
    [handleChange]
  );

  // Source → WYSIWYG sync
  const handleSourceChange = useCallback(
    async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updatingFromSource.current = true;
      const markdown = e.target.value;
      const { markdownToHtmlAsync, markdownToHtml } = await import('@/lib/markdown');
      const html = markdown.length > 50_000
        ? await markdownToHtmlAsync(markdown)
        : markdownToHtml(markdown);
      handleChange(markdown, html);
    },
    [handleChange]
  );

  // Tab key handling in source textarea
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (e.shiftKey) {
          const value = textarea.value;
          const lineStart = value.substring(0, start).lastIndexOf('\n') + 1;
          const selected = value.substring(lineStart, end);
          const outdented = selected.replace(/^  /gm, '');
          const diff = selected.length - outdented.length;
          textarea.value = value.substring(0, lineStart) + outdented + value.substring(end);
          textarea.selectionStart = Math.max(lineStart, start - (value.substring(lineStart, start).match(/^  /) ? 2 : 0));
          textarea.selectionEnd = end - diff;
        } else {
          textarea.value =
            textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }

        const syntheticEvent = { target: textarea } as React.ChangeEvent<HTMLTextAreaElement>;
        handleSourceChange(syntheticEvent);
      }
    },
    [handleSourceChange]
  );

  // Draggable divider
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = (e.target as HTMLElement).parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onMouseMove = (ev: MouseEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setDividerX(Math.min(80, Math.max(20, pct)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  if (isPageLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
        <div className="text-sm text-[var(--color-text-muted)]">청크 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0 relative">
        {/* Left: WYSIWYG Editor */}
        <div className="h-full overflow-y-auto" style={{ width: `${dividerX}%` }}>
          <div className="flex items-center h-8 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
            <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Editor
            </span>
            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
              ({currentPage + 1}/{totalChunks})
            </span>
          </div>
          <div className={`px-8 py-5 ${pageChanging ? 'opacity-50 pointer-events-none' : ''} transition-opacity`}>
            <Editor
              key={`split-${documentId}-${currentPage}`}
              content={chunkHtml}
              onChange={handleWysiwygChange}
              onEditorReady={handleEditorReady}
            />
          </div>
        </div>

        {/* Draggable Divider */}
        <div
          onMouseDown={handleMouseDown}
          className="
            w-1 shrink-0 cursor-col-resize
            bg-[var(--color-border)]
            hover:bg-[var(--color-accent)] hover:w-1.5
            active:bg-[var(--color-accent)]
            transition-all duration-150
            relative z-10
          "
        />

        {/* Right: Source */}
        <div className="h-full overflow-y-auto flex flex-col" style={{ width: `${100 - dividerX}%` }}>
          <div className="flex items-center h-8 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
            <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Markdown Source
            </span>
            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
              ({currentPage + 1}/{totalChunks})
            </span>
          </div>
          <textarea
            ref={textareaRef}
            defaultValue={chunkMarkdown}
            onChange={handleSourceChange}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="
              flex-1 w-full resize-none outline-none
              px-6 py-5
              font-mono text-sm leading-relaxed
              text-[var(--color-text)]
              bg-[var(--color-bg)]
              placeholder:text-[var(--color-text-muted)]
              selection:bg-[var(--color-accent-light)]
            "
            style={{ caretColor: 'var(--color-accent)' }}
            placeholder="마크다운을 입력하세요..."
          />
        </div>
      </div>

      {/* Page Navigator */}
      <div className="shrink-0">
        <PageNavigator
          currentPage={currentPage}
          totalPages={totalChunks}
          onPageChange={handlePageChange}
          disabled={pageChanging}
        />
      </div>
    </div>
  );
}
