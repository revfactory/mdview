'use client';

import React, { useCallback } from 'react';
import { FileDown, FileText, Code, Printer } from 'lucide-react';
import { saveAs } from 'file-saver';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { usePdfExport } from './pdf-export';
import { markdownToHtml } from '@/lib/markdown';

interface ExportMenuProps {
  markdown: string;
  documentTitle: string;
  documentId?: string | null;
  isChunked?: boolean;
}

export function ExportMenu({ markdown, documentTitle, documentId, isChunked }: ExportMenuProps) {
  const { exportPdf } = usePdfExport({ documentTitle });

  const safeName = (documentTitle || '문서').replace(/[<>:"/\\|?*]/g, '_');

  /** 청크 문서면 모든 청크를 병합, 아니면 현재 markdown 그대로 반환 */
  const getFullMarkdown = useCallback(async (): Promise<string> => {
    if (isChunked && documentId) {
      const { getAllChunksMarkdown } = await import('@/db/chunks');
      return getAllChunksMarkdown(documentId);
    }
    return markdown;
  }, [markdown, documentId, isChunked]);

  const handleExportMarkdown = useCallback(async () => {
    const fullMd = await getFullMarkdown();
    const blob = new Blob([fullMd], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `${safeName}.md`);
  }, [getFullMarkdown, safeName]);

  const handleExportHtml = useCallback(async () => {
    const fullMd = await getFullMarkdown();
    const htmlBody = markdownToHtml(fullMd);
    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(documentTitle || '문서')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.75;
      color: #1a1a1a;
      background: #fff;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    h1 { font-size: 2em; font-weight: 700; margin: 1.5em 0 0.5em; }
    h2 { font-size: 1.5em; font-weight: 600; margin: 1.25em 0 0.5em; }
    h3 { font-size: 1.25em; font-weight: 600; margin: 1em 0 0.5em; }
    h4, h5, h6 { font-size: 1em; font-weight: 600; margin: 1em 0 0.5em; }
    p { margin: 0.75em 0; }
    ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
    li { margin: 0.25em 0; }
    blockquote {
      border-left: 3px solid #d1d5db;
      padding: 0.5em 1em;
      margin: 0.75em 0;
      color: #6b7280;
    }
    pre {
      background: #f3f4f6;
      padding: 1em;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.875em;
      margin: 0.75em 0;
    }
    code {
      background: #f3f4f6;
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.875em;
    }
    pre code { background: none; padding: 0; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5em 0; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.75em 0;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 0.5em 0.75em;
      text-align: left;
    }
    th { background: #f9fafb; font-weight: 600; }
    img { max-width: 100%; height: auto; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    saveAs(blob, `${safeName}.html`);
  }, [getFullMarkdown, documentTitle, safeName]);

  const menuItems: DropdownMenuItem[] = [
    {
      label: 'PDF (인쇄)',
      icon: Printer,
      onClick: exportPdf,
    },
{
      label: '마크다운 (.md)',
      icon: FileText,
      onClick: handleExportMarkdown,
    },
    {
      label: 'HTML (.html)',
      icon: Code,
      onClick: handleExportHtml,
    },
  ];

  return (
    <>
      <DropdownMenu
        trigger={
          <Button variant="ghost" size="sm" icon={FileDown}>
            내보내기
          </Button>
        }
        items={menuItems}
        align="end"
      />

    </>
  );
}

// ---------- Helpers ----------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

