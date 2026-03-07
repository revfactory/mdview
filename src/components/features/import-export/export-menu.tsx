'use client';

import React, { useState, useCallback } from 'react';
import { FileDown, FileText, Code, FileType } from 'lucide-react';
import { saveAs } from 'file-saver';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { HwpExport } from './hwp-export';

interface ExportMenuProps {
  markdown: string;
  documentTitle: string;
}

export function ExportMenu({ markdown, documentTitle }: ExportMenuProps) {
  const [hwpExportOpen, setHwpExportOpen] = useState(false);

  const safeName = (documentTitle || '문서').replace(/[<>:"/\\|?*]/g, '_');

  const handleExportMarkdown = useCallback(() => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `${safeName}.md`);
  }, [markdown, safeName]);

  const handleExportHtml = useCallback(() => {
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
${markdownToBasicHtml(markdown)}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    saveAs(blob, `${safeName}.html`);
  }, [markdown, documentTitle, safeName]);

  const menuItems: DropdownMenuItem[] = [
    {
      label: 'HWP (.hwpx)',
      icon: FileType,
      onClick: () => setHwpExportOpen(true),
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

      <HwpExport
        open={hwpExportOpen}
        onClose={() => setHwpExportOpen(false)}
        markdown={markdown}
        documentTitle={documentTitle}
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

/**
 * Very basic markdown-to-HTML conversion for HTML export.
 * Uses simple regex transforms; not a full parser.
 */
function markdownToBasicHtml(md: string): string {
  let html = md;

  // Code blocks (fenced)
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr>');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote><p>$1</p></blockquote>');

  // Unordered lists (simple)
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>\n$1</ul>');

  // Paragraphs: wrap remaining lines that are not block elements
  const lines = html.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith('<h') ||
      trimmed.startsWith('<p') ||
      trimmed.startsWith('<ul') ||
      trimmed.startsWith('<ol') ||
      trimmed.startsWith('<li') ||
      trimmed.startsWith('</') ||
      trimmed.startsWith('<pre') ||
      trimmed.startsWith('<blockquote') ||
      trimmed.startsWith('<hr') ||
      trimmed.startsWith('<img') ||
      trimmed.startsWith('<table')
    ) {
      result.push(line);
    } else {
      result.push(`<p>${trimmed}</p>`);
    }
  }

  return result.join('\n');
}
