'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { FilePlus2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Sidebar } from '@/components/layout/sidebar';
import { Toolbar } from '@/components/layout/toolbar';
import { StatusBar } from '@/components/layout/status-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Editor } from '@/components/features/editor/editor';
import { DocumentTitle } from '@/components/features/editor/document-title';
import { TocPanel } from '@/components/features/editor/toc-panel';
import { HwpImport } from '@/components/features/import-export/hwp-import';
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

export default function Home() {
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const { actions } = useEditorStore();
  const viewMode = useUIStore((s) => s.viewMode);
  const focusMode = useUIStore((s) => s.focusMode);
  const isMobile = useUIStore((s) => s.isMobile);
  const [tiptapEditor, setTiptapEditor] = useState<TipTapEditor | null>(null);
  const [hwpImportOpen, setHwpImportOpen] = useState(false);
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

  const { content, htmlContent, isLoading, isLargeDocument, onChange } =
    useEditorManager(activeDocumentId);

  // Auto-switch to source view for large documents (TipTap can't handle them)
  useEffect(() => {
    if (isLargeDocument && viewMode !== 'source') {
      useUIStore.getState().actions.setViewMode('source');
      // Notify user
      import('@/stores/toast-store').then(({ useToastStore }) => {
        useToastStore.getState().actions.addToast('대용량 문서는 소스 뷰에서 편집됩니다.', 'info');
      });
    }
  }, [isLargeDocument, viewMode]);

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
      let htmlContent = '';

      // Only pre-convert HTML for small/medium documents
      // Large documents will use source view directly
      if (importedContent.length <= 300_000) {
        try {
          const { markdownToHtmlAsync } = await import('@/lib/markdown');
          htmlContent = await markdownToHtmlAsync(importedContent);
        } catch {
          // Fallback: store without htmlContent
        }
      }

      const id = await createDocument({ title, content: importedContent, htmlContent });
      actions.setActiveDocument(id);
      setHwpImportOpen(false);
      analytics.importHwp();
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
              onExport={() => setHwpExportOpen(true)}
              onToggleToc={() => useUIStore.getState().actions.toggleToc()}
              documentTitle={activeDocument?.title}
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
                <div style={{ margin: '0 auto', padding: isMobile ? '20px 16px 64px 16px' : '40px 40px 96px 40px' }}>
                  <DocumentTitle documentId={activeDocumentId} />
                  <Editor
                    content={htmlContent}
                    onChange={onChange}
                    onEditorReady={handleEditorReady}
                  />
                </div>
              ) : viewMode === 'source' ? (
                <div className="h-full flex flex-col">
                  <div className={`w-full mx-auto ${isMobile ? 'px-4 pt-4' : 'px-[60px] pt-6'} shrink-0`}>
                    <DocumentTitle documentId={activeDocumentId} />
                  </div>
                  <div className="flex-1 min-h-0 w-full mx-auto">
                    <SourceEditor
                      content={content}
                      onChange={onChange}
                    />
                  </div>
                </div>
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

      <HwpExport
        open={hwpExportOpen}
        onClose={() => setHwpExportOpen(false)}
        markdown={content}
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
