'use client';

import { useCallback } from 'react';
import { Editor } from '@/components/features/editor/editor';
import { PageNavigator } from '@/components/features/editor/page-navigator';
import { DocumentTitle } from '@/components/features/editor/document-title';
import { usePaginatedChunks } from '@/hooks/use-paginated-chunks';
import { useUIStore } from '@/stores/ui-store';
import type { Editor as TipTapEditor } from '@tiptap/react';

interface PaginatedEditorProps {
  documentId: string;
  totalChunks: number;
  onEditorReady?: (editor: TipTapEditor | null) => void;
}

export function PaginatedEditor({
  documentId,
  totalChunks,
  onEditorReady,
}: PaginatedEditorProps) {
  const isMobile = useUIStore((s) => s.isMobile);
  const {
    currentPage,
    chunkHtml,
    isPageLoading,
    pageChanging,
    editorRef,
    handlePageChange,
    handleChange,
  } = usePaginatedChunks(documentId, totalChunks);

  const handleEditorReady = useCallback(
    (editor: TipTapEditor | null) => {
      editorRef.current = editor;
      onEditorReady?.(editor);
    },
    [editorRef, onEditorReady]
  );

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
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ padding: isMobile ? '20px 16px 64px 16px' : '40px 40px 96px 40px' }}
      >
        <DocumentTitle documentId={documentId} />
        <div className={pageChanging ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
          <Editor
            key={`${documentId}-${currentPage}`}
            content={chunkHtml}
            onChange={handleChange}
            onEditorReady={handleEditorReady}
          />
        </div>
      </div>

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
