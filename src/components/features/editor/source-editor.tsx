'use client';

import React, { useCallback, useRef, useEffect } from 'react';

interface SourceEditorProps {
  content: string;
  onChange?: (markdown: string, html: string) => void;
}

export function SourceEditor({ content, onChange }: SourceEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Sync content from external changes (e.g. document switch)
  useEffect(() => {
    if (textareaRef.current && textareaRef.current.value !== content) {
      textareaRef.current.value = content;
    }
  }, [content]);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const markdown = e.target.value;
      const { markdownToHtml } = await import('@/lib/markdown');
      const html = markdownToHtml(markdown);
      onChangeRef.current?.(markdown, html);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Tab key support for indentation
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

        // Fire change event
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        const syntheticEvent = {
          target: textarea,
        } as React.ChangeEvent<HTMLTextAreaElement>;
        handleChange(syntheticEvent);
      }
    },
    [handleChange]
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center h-8 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          Markdown Source
        </span>
      </div>
      <textarea
        ref={textareaRef}
        defaultValue={content}
        onChange={handleChange}
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
  );
}
