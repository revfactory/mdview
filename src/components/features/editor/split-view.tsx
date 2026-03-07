'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Editor } from '@/components/features/editor/editor';
import type { Editor as TipTapEditor } from '@tiptap/react';

interface SplitViewProps {
  content: string;
  htmlContent: string;
  onChange?: (markdown: string, html: string) => void;
  onEditorReady?: (editor: TipTapEditor | null) => void;
}

export function SplitView({
  content,
  htmlContent,
  onChange,
  onEditorReady,
}: SplitViewProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const updatingFromSource = useRef(false);
  const [dividerX, setDividerX] = useState(50); // percentage

  // Sync textarea when content changes externally (document switch or WYSIWYG edit)
  useEffect(() => {
    if (updatingFromSource.current) {
      updatingFromSource.current = false;
      return;
    }
    if (textareaRef.current && textareaRef.current.value !== content) {
      textareaRef.current.value = content;
    }
  }, [content]);

  // Handle source textarea change
  const handleSourceChange = useCallback(
    async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updatingFromSource.current = true;
      const markdown = e.target.value;
      const { markdownToHtml } = await import('@/lib/markdown');
      const html = markdownToHtml(markdown);
      onChangeRef.current?.(markdown, html);
    },
    []
  );

  // Handle WYSIWYG editor change
  const handleWysiwygChange = useCallback(
    (markdown: string, html: string) => {
      if (textareaRef.current) {
        textareaRef.current.value = markdown;
      }
      onChangeRef.current?.(markdown, html);
    },
    []
  );

  // Draggable divider
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
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
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (e.shiftKey) {
          // Outdent: remove leading 2 spaces from selected lines
          const value = textarea.value;
          const beforeSelection = value.substring(0, start);
          const lineStart = beforeSelection.lastIndexOf('\n') + 1;
          const selected = value.substring(lineStart, end);
          const outdented = selected.replace(/^  /gm, '');
          const diff = selected.length - outdented.length;

          textarea.value =
            value.substring(0, lineStart) + outdented + value.substring(end);
          textarea.selectionStart = Math.max(lineStart, start - (value.substring(lineStart, start).match(/^  /) ? 2 : 0));
          textarea.selectionEnd = end - diff;
        } else {
          // Indent: insert 2 spaces
          textarea.value =
            textarea.value.substring(0, start) +
            '  ' +
            textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }

        const syntheticEvent = {
          target: textarea,
        } as React.ChangeEvent<HTMLTextAreaElement>;
        handleSourceChange(syntheticEvent);
      }
    },
    [handleSourceChange]
  );

  return (
    <div className="flex h-full relative">
      {/* Left: WYSIWYG Editor */}
      <div
        className="h-full overflow-y-auto"
        style={{ width: `${dividerX}%` }}
      >
        <div className="flex items-center h-8 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
          <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Editor
          </span>
        </div>
        <div className="px-8 py-5">
          <Editor
            content={htmlContent}
            onChange={handleWysiwygChange}
            onEditorReady={onEditorReady}
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
      <div
        className="h-full overflow-y-auto flex flex-col"
        style={{ width: `${100 - dividerX}%` }}
      >
        <div className="flex items-center h-8 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
          <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Markdown Source
          </span>
        </div>
        <textarea
          ref={textareaRef}
          defaultValue={content}
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
  );
}
