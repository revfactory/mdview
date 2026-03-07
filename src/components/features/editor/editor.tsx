'use client';

import { useEditor, EditorContent } from '@tiptap/react';
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
import { useCallback, useEffect, useRef } from 'react';

import { htmlToMarkdown } from '@/lib/markdown';
import { TrailingNode } from '@/extensions/trailing-node';
import { UniqueID } from '@/extensions/unique-id';
import { EditorBubbleMenu } from '@/components/features/editor/bubble-menu';
import { useImageDrop, DropOverlay } from '@/components/features/editor/drop-zone';
import { useEditorStore } from '@/stores/editor-store';

interface EditorProps {
  content: string;
  onChange?: (markdown: string, html: string) => void;
  editable?: boolean;
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
}

export function Editor({ content, onChange, editable = true, onEditorReady }: EditorProps) {
  const { actions } = useEditorStore();
  const initialContentRef = useRef(content);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
      TrailingNode,
      UniqueID,
    ],
    content: initialContentRef.current || '<p></p>',
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const markdown = htmlToMarkdown(html);

      // Keep ref in sync to prevent content effect from re-setting content
      initialContentRef.current = html;

      // Update character/word counts
      const charCount = ed.storage.characterCount?.characters?.() ?? 0;
      const wordCount = ed.storage.characterCount?.words?.() ?? 0;
      actions.updateCounts(wordCount, charCount);

      onChangeRef.current?.(markdown, html);
    },
  });

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor) {
      onEditorReady?.(editor);
    }
  }, [editor, onEditorReady]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Update content when it changes externally (e.g. switching documents)
  useEffect(() => {
    if (!editor) return;
    if (content !== initialContentRef.current) {
      initialContentRef.current = content;
      editor.commands.setContent(content || '<p></p>', { emitUpdate: false });
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
