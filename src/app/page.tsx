'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { FilePlus2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Sidebar } from '@/components/layout/sidebar';
import { Toolbar } from '@/components/layout/toolbar';
import { StatusBar } from '@/components/layout/status-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Editor } from '@/components/features/editor/editor';
import { PaginatedEditor } from '@/components/features/editor/paginated-editor';
import { PaginatedSplitView } from '@/components/features/editor/paginated-split-view';
import { DocumentTitle } from '@/components/features/editor/document-title';
import { TocPanel } from '@/components/features/editor/toc-panel';
import { HwpImport } from '@/components/features/import-export/hwp-import';
import { MarkdownImport } from '@/components/features/import-export/markdown-import';
import { HwpExport } from '@/components/features/import-export/hwp-export';
import { ExportMenu } from '@/components/features/import-export/export-menu';
import { QuickOpen } from '@/components/features/quick-open/quick-open';
import { ToastContainer } from '@/components/ui/toast';
import { useEditorStore } from '@/stores/editor-store';
import { useUIStore } from '@/stores/ui-store';
import { useEditorManager } from '@/hooks/use-editor';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { SourceEditor } from '@/components/features/editor/source-editor';
import { SplitView } from '@/components/features/editor/split-view';
import { useRecentDocuments, useDocument } from '@/hooks/use-documents';
import {
  createDocument,
  updateDocument,
  deleteDocument,
  updateContent,
} from '@/db/documents';
import type { Editor as TipTapEditor } from '@tiptap/react';
import { analytics } from '@/lib/analytics';
import { createSampleDocument } from '@/lib/sample-document';

export default function Home() {
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const { actions } = useEditorStore();
  const viewMode = useUIStore((s) => s.viewMode);
  const focusMode = useUIStore((s) => s.focusMode);
  const isMobile = useUIStore((s) => s.isMobile);
  const [tiptapEditor, setTiptapEditor] = useState<TipTapEditor | null>(null);
  const [hwpImportOpen, setHwpImportOpen] = useState(false);
  const [mdImportOpen, setMdImportOpen] = useState(false);
  const [hwpExportOpen, setHwpExportOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);

  const activeDocument = useDocument(activeDocumentId);
  // 페이지 로드 시 가장 최근 문서 자동 선택
  const recentDocs = useRecentDocuments(1);
  useEffect(() => {
    if (!activeDocumentId && recentDocs && recentDocs.length > 0) {
      actions.setActiveDocument(recentDocs[0].id);
    }
  }, [activeDocumentId, recentDocs, actions]);

  const { content, htmlContent, isLoading, isLargeDocument, isChunked, chunkCount, onChange } =
    useEditorManager(activeDocumentId);

  // Auto-switch to source view for large non-chunked documents
  useEffect(() => {
    if (isLargeDocument && !isChunked && viewMode !== 'source') {
      useUIStore.getState().actions.setViewMode('source');
      import('@/stores/toast-store').then(({ useToastStore }) => {
        useToastStore.getState().actions.addToast('대용량 문서는 소스 뷰에서 편집됩니다.', 'info');
      });
    }
  }, [isLargeDocument, isChunked, viewMode]);

  const handleNewDocument = useCallback(async () => {
    try {
      const id = await createDocument({ title: '제목 없음' });
      actions.setActiveDocument(id);
      analytics.documentCreate();
      if (useUIStore.getState().isMobile) {
        useUIStore.getState().actions.closeSidebar();
      }
    } catch (error) {
      console.error('Failed to create document:', error);
    }
  }, [actions]);

  const handleSampleDocument = useCallback(async () => {
    try {
      const id = await createSampleDocument();
      actions.setActiveDocument(id);
      analytics.documentCreate();
      if (useUIStore.getState().isMobile) {
        useUIStore.getState().actions.closeSidebar();
      }
    } catch (error) {
      console.error('Failed to create sample document:', error);
    }
  }, [actions]);

  const handleSelectDocument = useCallback(
    (id: string) => {
      actions.setActiveDocument(id);
      analytics.documentOpen();
      if (useUIStore.getState().isMobile) {
        useUIStore.getState().actions.closeSidebar();
      }
    },
    [actions]
  );

  const handleToggleFavorite = useCallback(async (id: string) => {
    try {
      const { db } = await import('@/db');
      const doc = await db.documents.get(id);
      if (doc) {
        await updateDocument(id, { isFavorite: !doc.isFavorite });
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  }, []);

  const handleDeleteDocument = useCallback(
    async (id: string) => {
      try {
        // Clean up chunks if the document was chunked
        const { deleteChunks } = await import('@/db/chunks');
        await deleteChunks(id);
        await deleteDocument(id);
        analytics.documentDelete();
        if (activeDocumentId === id) {
          actions.setActiveDocument(null);
        }
      } catch (error) {
        console.error('Failed to delete document:', error);
      }
    },
    [activeDocumentId, actions]
  );

  const handleDuplicateDocument = useCallback(
    async (id: string) => {
      try {
        const { db } = await import('@/db');
        const doc = await db.documents.get(id);
        if (doc) {
          const newId = await createDocument({
            title: `${doc.title} (복사본)`,
            content: doc.content,
            htmlContent: doc.htmlContent,
            folderId: doc.folderId,
            tags: [...doc.tags],
          });
          actions.setActiveDocument(newId);
          analytics.documentDuplicate();
        }
      } catch (error) {
        console.error('Failed to duplicate document:', error);
      }
    },
    [actions]
  );

  // For chunked documents: merged content for export and source view
  const [exportContent, setExportContent] = useState('');
  const [mergedSourceContent, setMergedSourceContent] = useState('');
  const [mergedSourceLoading, setMergedSourceLoading] = useState(false);

  const prepareExportContent = useCallback(async () => {
    if (isChunked && activeDocumentId) {
      const { getAllChunksMarkdown } = await import('@/db/chunks');
      const merged = await getAllChunksMarkdown(activeDocumentId);
      setExportContent(merged);
    } else {
      setExportContent(content);
    }
  }, [isChunked, activeDocumentId, content]);

  // Load merged chunks when switching to source view for chunked docs
  useEffect(() => {
    if (!isChunked || !activeDocumentId || viewMode !== 'source') return;
    let cancelled = false;
    setMergedSourceLoading(true);

    (async () => {
      const { getAllChunksMarkdown } = await import('@/db/chunks');
      const merged = await getAllChunksMarkdown(activeDocumentId);
      if (!cancelled) {
        setMergedSourceContent(merged);
        setMergedSourceLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isChunked, activeDocumentId, viewMode]);

  // Handle source editor changes for chunked documents — re-chunk and save
  const handleChunkedSourceChange = useCallback(
    async (markdown: string, _html: string) => {
      if (!activeDocumentId) return;
      setMergedSourceContent(markdown);

      const { chunkDocument } = await import('@/lib/chunk-document');
      const { saveChunks } = await import('@/db/chunks');
      const { updateDocument } = await import('@/db/documents');

      const chunks = chunkDocument(markdown);
      await saveChunks(activeDocumentId, chunks);
      await updateDocument(activeDocumentId, {
        content: markdown,
        isChunked: true,
        chunkCount: chunks.length,
      });
    },
    [activeDocumentId]
  );

  const handleForceSave = useCallback(async () => {
    if (!activeDocumentId || !tiptapEditor) return;
    actions.setSaveStatus('saving');
    try {
      const html = tiptapEditor.getHTML();
      const { htmlToMarkdown } = await import('@/lib/markdown');
      const md = htmlToMarkdown(html);
      await updateContent(activeDocumentId, md, html);
      actions.setSaveStatus('saved');
    } catch {
      actions.setSaveStatus('error');
    }
  }, [activeDocumentId, tiptapEditor, actions]);

  const handleEditorReady = useCallback((editor: TipTapEditor | null) => {
    setTiptapEditor(editor ?? null);
  }, []);

  const handleImportComplete = useCallback(
    async (importedContent: string, title: string) => {
      const CHUNK_THRESHOLD = 300_000; // 300KB

      if (importedContent.length > CHUNK_THRESHOLD) {
        // Large document: chunk and save
        const { chunkDocument } = await import('@/lib/chunk-document');
        const { saveChunks } = await import('@/db/chunks');

        const chunks = chunkDocument(importedContent);
        const id = await createDocument({
          title,
          content: importedContent,
          isChunked: true,
          chunkCount: chunks.length,
        });
        await saveChunks(id, chunks);
        actions.setActiveDocument(id);

        import('@/stores/toast-store').then(({ useToastStore }) => {
          useToastStore.getState().actions.addToast(
            `대용량 문서가 ${chunks.length}개 페이지로 분할되었습니다.`,
            'success'
          );
        });
      } else {
        // Normal document
        let htmlContent = '';
        try {
          const { markdownToHtmlAsync } = await import('@/lib/markdown');
          htmlContent = await markdownToHtmlAsync(importedContent);
        } catch {
          // Fallback: store without htmlContent
        }
        const id = await createDocument({ title, content: importedContent, htmlContent });
        actions.setActiveDocument(id);
      }

      setHwpImportOpen(false);
      analytics.importHwp();
    },
    [actions]
  );

  const handleMdImportComplete = useCallback(
    async (importedContent: string, title: string) => {
      const CHUNK_THRESHOLD = 300_000;

      if (importedContent.length > CHUNK_THRESHOLD) {
        const { chunkDocument } = await import('@/lib/chunk-document');
        const { saveChunks } = await import('@/db/chunks');

        const chunks = chunkDocument(importedContent);
        const id = await createDocument({
          title,
          content: importedContent,
          isChunked: true,
          chunkCount: chunks.length,
        });
        await saveChunks(id, chunks);
        actions.setActiveDocument(id);

        import('@/stores/toast-store').then(({ useToastStore }) => {
          useToastStore.getState().actions.addToast(
            `대용량 문서가 ${chunks.length}개 페이지로 분할되었습니다.`,
            'success'
          );
        });
      } else {
        let htmlContent = '';
        try {
          const { markdownToHtmlAsync } = await import('@/lib/markdown');
          htmlContent = await markdownToHtmlAsync(importedContent);
        } catch {
          // Fallback
        }
        const id = await createDocument({ title, content: importedContent, htmlContent });
        actions.setActiveDocument(id);
      }

      setMdImportOpen(false);
      analytics.importMarkdown();
    },
    [actions]
  );

  useKeyboardShortcuts({
    onNewDocument: handleNewDocument,
    onForceSave: handleForceSave,
    onSearchFocus: () => {
      // Focus search input in sidebar - we'll use a DOM query as a simple approach
      const searchInput = document.querySelector(
        '[data-search-input]'
      ) as HTMLInputElement | null;
      searchInput?.focus();
    },
    onQuickOpen: () => { setQuickOpenOpen(true); analytics.quickOpen(); },
  });

  return (
    <AppShell
      sidebar={
        <Sidebar
          activeDocumentId={activeDocumentId}
          onNewDocument={handleNewDocument}
          onSelectDocument={handleSelectDocument}
          onToggleFavorite={handleToggleFavorite}
          onDeleteDocument={handleDeleteDocument}
          onDuplicateDocument={handleDuplicateDocument}
          onImport={() => setHwpImportOpen(true)}
          onImportMarkdown={() => setMdImportOpen(true)}
        />
      }
      focusMode={focusMode}
    >
      <div className="flex h-full overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Toolbar - hidden in focus mode */}
          <div
            className="shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
            style={{
              maxHeight: focusMode ? 0 : 44,
              opacity: focusMode ? 0 : 1,
            }}
          >
            <Toolbar
              editor={tiptapEditor}
              onExport={() => { prepareExportContent().then(() => setHwpExportOpen(true)); }}
              onToggleToc={() => useUIStore.getState().actions.toggleToc()}
              documentTitle={activeDocument?.title}
              documentId={activeDocumentId}
              isChunked={isChunked}
            />
          </div>

          <div className={`flex-1 min-h-0 ${viewMode === 'split' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            {activeDocumentId ? (
              isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                  <div className="text-sm text-[var(--color-text-muted)]">
                    문서 로딩 중...
                  </div>
                </div>
              ) : viewMode === 'wysiwyg' ? (
                isChunked ? (
                  <PaginatedEditor
                    documentId={activeDocumentId}
                    totalChunks={chunkCount}
                    onEditorReady={handleEditorReady}
                  />
                ) : (
                  <div style={{ margin: '0 auto', padding: isMobile ? '20px 16px 64px 16px' : '40px 40px 96px 40px' }}>
                    <DocumentTitle documentId={activeDocumentId} />
                    <Editor
                      content={htmlContent}
                      onChange={onChange}
                      onEditorReady={handleEditorReady}
                    />
                  </div>
                )
              ) : viewMode === 'source' ? (
                <div className="h-full flex flex-col">
                  <div className={`w-full mx-auto ${isMobile ? 'px-4 pt-4' : 'px-[60px] pt-6'} shrink-0`}>
                    <DocumentTitle documentId={activeDocumentId} />
                  </div>
                  {isChunked && mergedSourceLoading ? (
                    <div className="flex flex-col items-center justify-center flex-1 gap-3">
                      <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                      <div className="text-sm text-[var(--color-text-muted)]">청크 병합 중...</div>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 w-full mx-auto">
                      <SourceEditor
                        content={isChunked ? mergedSourceContent : content}
                        onChange={isChunked ? handleChunkedSourceChange : onChange}
                      />
                    </div>
                  )}
                </div>
              ) : (
                isChunked ? (
                  <PaginatedSplitView
                    documentId={activeDocumentId}
                    totalChunks={chunkCount}
                    onEditorReady={handleEditorReady}
                  />
                ) : (
                  <div className="h-full flex flex-col">
                    <div className="px-4 pt-4 shrink-0">
                      <DocumentTitle documentId={activeDocumentId} />
                    </div>
                    <div className="flex-1 min-h-0">
                      <SplitView
                        content={content}
                        htmlContent={htmlContent}
                        onChange={onChange}
                        onEditorReady={handleEditorReady}
                      />
                    </div>
                  </div>
                )
              )
            ) : (
              <div className="flex items-center justify-center h-full">
                <EmptyState
                  icon={FilePlus2}
                  title="새 문서를 만들어보세요"
                  subtitle="마크다운 문서를 작성하고 관리할 수 있습니다. 왼쪽 상단의 + 버튼을 눌러 시작하세요."
                  actions={[
                    {
                      label: '새 문서 만들기',
                      onClick: handleNewDocument,
                      variant: 'primary',
                    },
                    {
                      label: '샘플 문서 보기',
                      onClick: handleSampleDocument,
                      variant: 'secondary',
                    },
                  ]}
                />
              </div>
            )}
          </div>

          {/* StatusBar - hidden in focus mode */}
          <div
            className="shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
            style={{
              maxHeight: focusMode ? 0 : 32,
              opacity: focusMode ? 0 : 1,
            }}
          >
            <StatusBar />
          </div>
        </div>

        {/* TOC Panel - hidden in focus mode and mobile */}
        {!focusMode && !isMobile && <TocPanel editor={tiptapEditor} />}
      </div>

      <HwpImport
        open={hwpImportOpen}
        onClose={() => setHwpImportOpen(false)}
        onImportComplete={handleImportComplete}
      />

      <MarkdownImport
        open={mdImportOpen}
        onClose={() => setMdImportOpen(false)}
        onImportComplete={handleMdImportComplete}
      />

      <HwpExport
        open={hwpExportOpen}
        onClose={() => setHwpExportOpen(false)}
        markdown={exportContent || content}
        documentTitle={
          activeDocument?.title ?? 'MDView'
        }
      />
      <QuickOpen
        open={quickOpenOpen}
        onClose={() => setQuickOpenOpen(false)}
        onSelectDocument={handleSelectDocument}
      />

      <ToastContainer />
    </AppShell>
  );
}
