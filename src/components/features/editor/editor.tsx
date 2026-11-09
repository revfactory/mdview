'use client';

import { useEditor, EditorContent, type EditorEvents } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Image } from '@tiptap/extension-image';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Typography } from '@tiptap/extension-typography';
import { CharacterCount } from '@tiptap/extension-character-count';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { Link } from '@tiptap/extension-link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { htmlToMarkdown, htmlToMarkdownAsync } from '@/lib/markdown';
import { InlineMath, BlockMath } from '@/extensions/math';
import { TrailingNode } from '@/extensions/trailing-node';
import { UniqueID } from '@/extensions/unique-id';
import { EditorBubbleMenu } from '@/components/features/editor/bubble-menu';
import { useImageDrop, DropOverlay } from '@/components/features/editor/drop-zone';
import { useEditorStore } from '@/stores/editor-store';

interface EditorProps {
  content: string;
  onChange?: (markdown: string, html: string) => void;
  editable?: boolean;
  sourceContent?: string;
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
}

export function Editor({ content, onChange, editable = true, onEditorReady, sourceContent }: EditorProps) {
  const { actions } = useEditorStore();
  const [initialContent] = useState(content);
  const initialContentRef = useRef(content);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const markdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editRevision = useRef(0);

  // A source edit, document replacement or read-only transition supersedes any
  // debounced visual-editor snapshot. Invalidate before timers can run.
  useLayoutEffect(() => {
    editRevision.current++;
    if (markdownTimerRef.current) clearTimeout(markdownTimerRef.current);
    markdownTimerRef.current = null;
    return () => {
      // Invalidate the live counter, not a captured revision (this is not a DOM ref).
      // eslint-disable-next-line react-hooks/exhaustive-deps
      editRevision.current++;
      if (markdownTimerRef.current) clearTimeout(markdownTimerRef.current);
      markdownTimerRef.current = null;
    };
  }, [content, editable, sourceContent]);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return '제목을 입력하세요';
          }
          return '내용을 입력하세요';
        },
      }),
      Typography,
      CharacterCount,
      Color,
      TextStyle,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      Superscript,
      Subscript,
      Link.configure({
        openOnClick: false,
      }),
      InlineMath,
      BlockMath,
      TrailingNode,
      UniqueID,
    ],
    content: initialContent || '<p></p>',
    onUpdate: ({ editor: ed }) => {
      if (!ed.isEditable) return;
      const revision = ++editRevision.current;
      const html = ed.getHTML();

      // Keep ref in sync to prevent content effect from re-setting content
      initialContentRef.current = html;

      // Debounce the expensive htmlToMarkdown conversion (300ms) via Worker
      if (markdownTimerRef.current) clearTimeout(markdownTimerRef.current);
      markdownTimerRef.current = setTimeout(() => {
        markdownTimerRef.current = null;
        if (revision !== editRevision.current) return;
        if (html.length > 50_000) {
          // Large docs: use Worker to avoid blocking main thread
          htmlToMarkdownAsync(html).then((markdown) => {
            if (revision !== editRevision.current) return;
            onChangeRef.current?.(markdown, html);
          });
        } else {
          // Small docs: sync is fine
          const markdown = htmlToMarkdown(html);
          onChangeRef.current?.(markdown, html);
        }
      }, 300);
    },
  });

  // Loading a document is intentionally silent for autosave, but its counts
  // still belong to the newly visible document, even when it is empty.
  useEffect(() => {
    if (!editor) return;
    const syncCounts = () => {
      actions.updateCounts(
        editor.storage.characterCount?.words?.() ?? 0,
        editor.storage.characterCount?.characters?.() ?? 0,
      );
    };
    const onTransaction = ({ transaction }: EditorEvents['transaction']) => {
      if (transaction.docChanged) syncCounts();
    };
    editor.on('transaction', onTransaction);
    syncCounts();
    return () => { editor.off('transaction', onTransaction); };
  }, [editor, actions]);

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor) {
      onEditorReady?.(editor);
    }
  }, [editor, onEditorReady]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable, false);
    }
  }, [editor, editable]);

  // Update content when it changes externally (e.g. switching documents)
  // Safety: refuse to load content that would freeze the browser
  useEffect(() => {
    if (!editor) return;
    if (content !== initialContentRef.current) {
      initialContentRef.current = content;
      if (content.length > 500_000) {
        // Too large for TipTap — show placeholder instead
        editor.commands.setContent(
          '<p><em>이 문서는 너무 커서 WYSIWYG 에디터에서 표시할 수 없습니다. 소스 뷰를 사용해주세요.</em></p>',
          { emitUpdate: false }
        );
      } else {
        editor.commands.setContent(content || '<p></p>', { emitUpdate: false });
      }
    }
  }, [content, editor]);

  const { isDragging, dropZoneProps } = useImageDrop(editor);

  if (!editor) {
    return null;
  }

  return (
    <div className="editor-wrapper relative w-full min-w-0 flex-1" {...dropZoneProps}>
      <DropOverlay visible={isDragging} />
      <EditorBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
