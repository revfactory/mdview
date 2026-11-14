'use client';

import { getDirtyEditorSnapshot } from '@/lib/editor-dirty-snapshot';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Sidebar } from '@/components/layout/sidebar';
import { Toolbar } from '@/components/layout/toolbar';
import { StatusBar } from '@/components/layout/status-bar';
import { WelcomePanel } from '@/components/growth/welcome-panel';
import { readEntryAction, type EntryAction, type EntrySource } from '@/lib/entry-actions';
import { Editor } from '@/components/features/editor/editor';
import { PaginatedEditor } from '@/components/features/editor/paginated-editor';
import { PaginatedSplitView } from '@/components/features/editor/paginated-split-view';
import { DocumentTitle } from '@/components/features/editor/document-title';
import { TocPanel } from '@/components/features/editor/toc-panel';
import { HwpImport } from '@/components/features/import-export/hwp-import';
import { MarkdownImport } from '@/components/features/import-export/markdown-import';
import { PdfImport, type PdfImportResult } from '@/components/features/import-export/pdf-import';
import { PdfViewer } from '@/components/features/pdf/pdf-viewer';
import { HwpExport } from '@/components/features/import-export/hwp-export';
import { QuickOpen } from '@/components/features/quick-open/quick-open';
import { ToastContainer } from '@/components/ui/toast';
import { useEditorStore } from '@/stores/editor-store';
import { useUIStore } from '@/stores/ui-store';
import { useEditorManager } from '@/hooks/use-editor';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { SourceEditor } from '@/components/features/editor/source-editor';
import { htmlToMarkdown as savedHtmlToMarkdown } from '@/lib/markdown';
import { copyDocumentSnapshot } from '@/lib/copy-document-snapshot';
import { enqueueDocumentSave, enqueueDocumentOperation, awaitDocumentSaves } from '@/lib/document-save-queue';
import { SplitView } from '@/components/features/editor/split-view';
import { useRecentDocuments, useDocument } from '@/hooks/use-documents';
import {
  createDocument,
  createPdfDocument,
  updateDocument,
  deleteDocument,
  duplicateDocument,
  updateContent,
} from '@/db/documents';
import type { Editor as TipTapEditor } from '@tiptap/react';
import { analytics } from '@/lib/analytics';
import { createSampleDocument } from '@/lib/sample-document';
import { createImportedDocument } from '@/lib/import-document';

export default function Home() {
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const { actions } = useEditorStore();
  const viewMode = useUIStore((s) => s.viewMode);
  const focusMode = useUIStore((s) => s.focusMode);
  const isMobile = useUIStore((s) => s.isMobile);
  const pageFlushRef = useRef<(() => Promise<void>) | null>(null);
  const copyingRef = useRef(false);
  const handleFlushReady = useCallback((flush: (() => Promise<void>) | null) => { pageFlushRef.current = flush; }, []);
  const [tiptapEditor, setTiptapEditor] = useState<TipTapEditor | null>(null);
  const [hwpImportOpen, setHwpImportOpen] = useState(false);
  const [mdImportOpen, setMdImportOpen] = useState(false);
  const [pdfImportOpen, setPdfImportOpen] = useState(false);
  const [hwpExportOpen, setHwpExportOpen] = useState(false);
  const [preparingExport, setPreparingExport] = useState(false);
  const preparingExportRef = useRef(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);

  const activeDocument = useDocument(activeDocumentId);
  // 페이지 로드 시 가장 최근 문서 자동 선택
  const recentDocs = useRecentDocuments(1);
  useEffect(() => {
    if (!activeDocumentId && recentDocs && recentDocs.length > 0) {
      actions.setActiveDocument(recentDocs[0].id);
    }
  }, [activeDocumentId, recentDocs, actions]);


  const { content, htmlContent, isLoading, isLargeDocument, isChunked, chunkCount, documentKind, onChange, onSourceChange, sourcePending, saveCurrent, canSave } =
    useEditorManager(activeDocumentId);
  const isPdf = !!activeDocumentId && !isLoading && documentKind === 'pdf';

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

  const handleStart = useCallback((action: EntryAction, source: EntrySource) => {
    analytics.startAction(action, source);
    if (action === 'import-hwp') setHwpImportOpen(true);
    if (action === 'import-markdown') setMdImportOpen(true);
    if (action === 'import-pdf') setPdfImportOpen(true);
    if (action === 'new' || action === 'sample') {
      useUIStore.getState().actions.setViewMode('wysiwyg');
      void (action === 'new' ? handleNewDocument() : handleSampleDocument());
    }
  }, [handleNewDocument, handleSampleDocument]);

  const entryHandled = useRef(false);
  useEffect(() => {
    // Defer until mounted; cancel the first Strict Mode effect before performing an action.
    const timer = window.setTimeout(() => {
      if (entryHandled.current) return;
      entryHandled.current = true;
      const url = new URL(window.location.href);
      const entry = readEntryAction(url.searchParams);
      if (!entry) return;
      // Consume once so refresh, dismissal and Back do not duplicate the action.
      url.searchParams.delete('action');
      url.searchParams.delete('source');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      handleStart(entry.action, entry.source);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [handleStart]);

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
          // 삭제 후 남은 문서가 있으면 선택, 없으면 빈 상태 표시
          const { db } = await import('@/db');
          const remaining = await db.documents.orderBy('updatedAt').reverse().limit(1).toArray();
          actions.setActiveDocument(remaining.length > 0 ? remaining[0].id : null);
        }
      } catch (error) {
        console.error('Failed to delete document:', error);
      }
    },
    [activeDocumentId, actions]
  );

  const handleDuplicateDocument = useCallback(
    async (id: string) => {
      if (copyingRef.current) return;
      copyingRef.current = true;
      try {
        await copyDocumentSnapshot(id, async () => {
          if (id === activeDocumentId && documentKind !== 'pdf') {
            if (isLoading || !canSave) throw new Error('문서를 불러오는 중입니다.');
            if (isChunked && viewMode !== 'source') {
              if (!pageFlushRef.current) throw new Error('페이지를 불러오는 중입니다.');
              await pageFlushRef.current();
            } else if (!isChunked && viewMode !== 'source' && !sourcePending) {
              if (!tiptapEditor) throw new Error('편집기를 불러오는 중입니다.');
              const html = getDirtyEditorSnapshot(tiptapEditor);
              if (html !== null) await enqueueDocumentSave(id, savedHtmlToMarkdown(html), html);
            }
          }
        }, awaitDocumentSaves, duplicateDocument);
        // Stay on the original: edits made while the snapshot was saving must
        // not be unmounted/cancelled by an automatic document switch.
        analytics.documentDuplicate();
        const { useToastStore } = await import('@/stores/toast-store');
        useToastStore.getState().actions.addToast('복사본을 만들었습니다. 문서 목록에서 확인하세요.', 'success');
      } catch (error) {
        console.error('Failed to duplicate document:', error);
        const { useToastStore } = await import('@/stores/toast-store');
        useToastStore.getState().actions.addToast('문서를 복사하지 못했습니다. 원본을 유지합니다. 저장 상태를 확인하고 다시 시도하세요.', 'error');
      } finally { copyingRef.current = false; }
    },
    [activeDocumentId, documentKind, isLoading, canSave, isChunked, viewMode, sourcePending, tiptapEditor]
  );

  // For chunked documents: merged content for export and source view
  const [exportContent, setExportContent] = useState('');
  const [exportDocumentTitle, setExportDocumentTitle] = useState('MDView');
  const [mergedSourceContent, setMergedSourceContent] = useState('');
  const [mergedSourceLoading, setMergedSourceLoading] = useState(false);

  const prepareExportContent = useCallback(async () => {
    if (isChunked && viewMode === 'source') {
      setExportContent(mergedSourceContent);
    } else if (isChunked && activeDocumentId) {
      const { getAllChunksMarkdown } = await import('@/db/chunks');
      const merged = await getAllChunksMarkdown(activeDocumentId);
      setExportContent(merged);
    } else {
      const { htmlToMarkdown } = await import('@/lib/markdown');
      setExportContent(viewMode !== 'source' && tiptapEditor ? htmlToMarkdown(tiptapEditor.getHTML()) : content);
    }
  }, [isChunked, activeDocumentId, content, viewMode, tiptapEditor, mergedSourceContent]);

  const handleOpenExport = useCallback(async () => {
    if (preparingExportRef.current || !activeDocumentId || sourcePending) return;
    const exportDocumentId = activeDocumentId;
    const title = activeDocument?.title ?? 'MDView';
    preparingExportRef.current = true;
    setPreparingExport(true);
    try {
      await prepareExportContent();
      // The user may navigate while a large document is being merged.
      if (useEditorStore.getState().activeDocumentId !== exportDocumentId) return;
      setExportDocumentTitle(title);
      setHwpExportOpen(true);
    } catch {
      const { useToastStore } = await import('@/stores/toast-store');
      useToastStore.getState().actions.addToast('문서를 내보낼 준비를 하지 못했습니다. 다시 시도해주세요.', 'error');
    } finally {
      preparingExportRef.current = false;
      setPreparingExport(false);
    }
  }, [prepareExportContent, activeDocumentId, activeDocument?.title, sourcePending]);

  // Load merged chunks when switching to source view for chunked docs
  useEffect(() => {
    if (!isChunked || !activeDocumentId || viewMode !== 'source') return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The loading flag synchronizes the async IndexedDB chunk read with the current document.
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
    (markdown: string) => {
      if (!activeDocumentId) return;
      setMergedSourceContent(markdown);
      const id = activeDocumentId;
      void enqueueDocumentOperation(id, async () => {
        const { db } = await import('@/db');
        const { chunkDocument } = await import('@/lib/chunk-document');
        const { saveChunks } = await import('@/db/chunks');
        const chunks = chunkDocument(markdown);
        await db.transaction('rw', db.documents, db.chunks, async () => {
          await saveChunks(id, chunks);
          await updateDocument(id, { content: markdown, htmlContent: '', isChunked: true, chunkCount: chunks.length });
        });
      }).catch(error => console.error('Failed to save source:', error));
    },
    [activeDocumentId]
  );

  const handleForceSave = useCallback(async () => {
    if (!activeDocumentId || isLoading || !canSave) return;
    if (!isChunked && (viewMode === 'source' || sourcePending || !tiptapEditor)) { await saveCurrent(); return; }
    if (!tiptapEditor) return;
    actions.setSaveStatus('saving');
    try {
      const html = tiptapEditor.getHTML();
      const md = savedHtmlToMarkdown(html);
      if (isChunked) await updateContent(activeDocumentId, md, html);
      else await enqueueDocumentSave(activeDocumentId, md, html);
      if (useEditorStore.getState().activeDocumentId === activeDocumentId) actions.setSaveStatus('saved');
    } catch {
      if (useEditorStore.getState().activeDocumentId === activeDocumentId) actions.setSaveStatus('error');
    }
  }, [activeDocumentId, tiptapEditor, actions, isChunked, saveCurrent, viewMode, sourcePending, isLoading, canSave]);

  const handleEditorReady = useCallback((editor: TipTapEditor | null) => {
    setTiptapEditor(editor ?? null);
  }, []);

  const openImportedDocument = useCallback(
    async (importedContent: string, title: string, folderId?: string | null) => {
      const { id, chunkCount: importedChunks } = await createImportedDocument(importedContent, title, { folderId });
      actions.setActiveDocument(id);
      if (importedChunks !== null) {
        import('@/stores/toast-store').then(({ useToastStore }) => {
          useToastStore.getState().actions.addToast(
            `대용량 문서가 ${importedChunks}개 페이지로 분할되었습니다.`,
            'success'
          );
        });
      }
      return importedChunks;
    },
    [actions]
  );

  const handleImportComplete = useCallback(
    async (importedContent: string, title: string) => {
      await openImportedDocument(importedContent, title);
      setHwpImportOpen(false);
      analytics.importHwp();
    },
    [openImportedDocument]
  );

  const handleMdImportComplete = useCallback(
    async (importedContent: string, title: string) => {
      await openImportedDocument(importedContent, title);
      setMdImportOpen(false);
      analytics.importMarkdown();
    },
    [openImportedDocument]
  );

  const handlePdfImportComplete = useCallback(
    async ({ file, title, pageCount, excerpt }: PdfImportResult) => {
      const id = await createPdfDocument({ title, file, fileName: file.name, pageCount, excerpt });
      actions.setActiveDocument(id);
      analytics.importPdf();
      if (useUIStore.getState().isMobile) {
        useUIStore.getState().actions.closeSidebar();
      }
    },
    [actions]
  );

  const activePdfTitle = activeDocument?.title ?? '';
  const activePdfFolderId = activeDocument?.folderId ?? null;
  const handlePdfConvert = useCallback(
    async (markdown: string) => {
      const importedChunks = await openImportedDocument(markdown, activePdfTitle || '제목 없음', activePdfFolderId);
      analytics.convertPdf();
      if (importedChunks === null) {
        const { useToastStore } = await import('@/stores/toast-store');
        useToastStore.getState().actions.addToast(
          '마크다운 문서를 만들었습니다. 표와 여러 단으로 된 부분은 원본과 비교해 확인해 주세요.',
          'success'
        );
      }
    },
    [openImportedDocument, activePdfTitle, activePdfFolderId]
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
          onImportPdf={() => setPdfImportOpen(true)}
        />
      }
      focusMode={focusMode}
    >
      <div className="flex h-full overflow-hidden">
        {isPdf && activeDocumentId ? (
          <PdfViewer
            key={activeDocumentId}
            documentId={activeDocumentId}
            title={activePdfTitle}
            onConvert={handlePdfConvert}
          />
        ) : (
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* Toolbar - allow mobile rows to size naturally outside focus mode. */}
            <div
              className="shrink-0 transition-opacity duration-300 ease-in-out overflow-hidden"
              inert={focusMode}
              aria-hidden={focusMode}
              style={{
                maxHeight: focusMode ? 0 : 'none',
                opacity: focusMode ? 0 : 1,
              }}
            >
              <Toolbar
                editor={tiptapEditor}
                onExport={handleOpenExport}
                onToggleToc={() => useUIStore.getState().actions.toggleToc()}
                documentTitle={activeDocument?.title}
                documentId={activeDocumentId}
                isChunked={isChunked}
                markdown={isChunked ? mergedSourceContent : content}
                disabled={!activeDocumentId || isLoading || sourcePending || (isChunked && viewMode === 'source' && mergedSourceLoading) || preparingExport}
              />
            </div>

            {sourcePending && !isLoading && (
              <div role="status" className="px-4 py-2 text-sm text-[var(--color-text-muted)]">
                미리보기를 갱신하는 동안 시각 편집이 잠겨 있습니다. 소스 보기에서 원문을 계속 편집할 수 있습니다.
              </div>
            )}
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
                      onFlushReady={handleFlushReady}
                      onEditorReady={handleEditorReady}
                    />
                  ) : (
                    <div style={{ margin: '0 auto', padding: isMobile ? '20px 16px 64px 16px' : '40px 40px 96px 40px' }}>
                      <DocumentTitle documentId={activeDocumentId} />
                      <Editor
                        key={activeDocumentId}
                        sourceContent={content}
                        editable={!sourcePending}
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
                          onSourceChange={isChunked ? handleChunkedSourceChange : onSourceChange}
                          content={isChunked ? mergedSourceContent : content}
                          onChange={onChange}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  isChunked ? (
                    <PaginatedSplitView
                      documentId={activeDocumentId}
                      totalChunks={chunkCount}
                      onFlushReady={handleFlushReady}
                      onEditorReady={handleEditorReady}
                    />
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="px-4 pt-4 shrink-0">
                        <DocumentTitle documentId={activeDocumentId} />
                      </div>
                      <div className="flex-1 min-h-0">
                        <SplitView
                          key={activeDocumentId}
                          content={content}
                          htmlContent={htmlContent}
                          onSourceChange={onSourceChange}
                          previewPending={sourcePending}
                          onChange={onChange}
                          onEditorReady={handleEditorReady}
                        />
                      </div>
                    </div>
                  )
                )
              ) : (
                <WelcomePanel onStart={(action) => handleStart(action, 'home')} />
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
              <StatusBar sourceContent={viewMode === 'source' ? (isChunked ? mergedSourceContent : content) : viewMode === 'split' && !isChunked ? content : undefined} />
            </div>
          </div>
        )}

        {/* TOC Panel - hidden in focus mode, mobile and PDF documents */}
        {!focusMode && !isMobile && !isPdf && <TocPanel editor={tiptapEditor} />}
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

      <PdfImport
        open={pdfImportOpen}
        onClose={() => setPdfImportOpen(false)}
        onImportComplete={handlePdfImportComplete}
      />

      <HwpExport
        open={hwpExportOpen}
        onClose={() => setHwpExportOpen(false)}
        markdown={exportContent}
        documentTitle={exportDocumentTitle}
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
