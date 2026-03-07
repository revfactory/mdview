'use client';

import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { useCallback, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  Highlighter,
} from 'lucide-react';

interface EditorBubbleMenuProps {
  editor: Editor;
}

export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const toggleBold = useCallback(() => {
    editor.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleUnderline = useCallback(() => {
    editor.chain().focus().toggleUnderline().run();
  }, [editor]);

  const toggleStrike = useCallback(() => {
    editor.chain().focus().toggleStrike().run();
  }, [editor]);

  const toggleCode = useCallback(() => {
    editor.chain().focus().toggleCode().run();
  }, [editor]);

  const toggleHighlight = useCallback(() => {
    editor.chain().focus().toggleHighlight().run();
  }, [editor]);

  const handleLink = useCallback(() => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    setShowLinkInput(true);
    setLinkUrl('');
  }, [editor]);

  const submitLink = useCallback(() => {
    if (linkUrl) {
      editor
        .chain()
        .focus()
        .setLink({ href: linkUrl })
        .run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const buttons = [
    {
      icon: Bold,
      action: toggleBold,
      isActive: editor.isActive('bold'),
      title: '굵게 (Cmd+B)',
    },
    {
      icon: Italic,
      action: toggleItalic,
      isActive: editor.isActive('italic'),
      title: '기울임 (Cmd+I)',
    },
    {
      icon: Underline,
      action: toggleUnderline,
      isActive: editor.isActive('underline'),
      title: '밑줄 (Cmd+U)',
    },
    {
      icon: Strikethrough,
      action: toggleStrike,
      isActive: editor.isActive('strike'),
      title: '취소선',
    },
    {
      icon: Code,
      action: toggleCode,
      isActive: editor.isActive('code'),
      title: '인라인 코드 (Cmd+E)',
    },
    {
      icon: Link,
      action: handleLink,
      isActive: editor.isActive('link'),
      title: '링크 (Cmd+K)',
    },
    {
      icon: Highlighter,
      action: toggleHighlight,
      isActive: editor.isActive('highlight'),
      title: '하이라이트',
    },
  ];

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: ed, from, to }) => {
        if (from === to) return false;
        if (ed.isActive('codeBlock')) return false;
        return true;
      }}
      options={{
        placement: 'top',
        offset: { mainAxis: 8 },
      }}
    >
      <div
        className="flex items-center gap-0.5 rounded-lg px-1 py-1 shadow-lg"
        style={{ backgroundColor: 'var(--color-bubble-menu-bg, #292929)' }}
      >
        {showLinkInput ? (
          <div className="flex items-center gap-1 px-1">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitLink();
                }
                if (e.key === 'Escape') {
                  setShowLinkInput(false);
                  setLinkUrl('');
                }
              }}
              placeholder="URL 입력..."
              autoFocus
              className="w-48 bg-transparent text-white text-sm outline-none border-b border-white/30 px-1 py-0.5"
            />
            <button
              onClick={submitLink}
              className="text-white/80 hover:text-white text-xs px-1 cursor-pointer"
            >
              확인
            </button>
          </div>
        ) : (
          buttons.map((btn, index) => {
            const Icon = btn.icon;
            return (
              <button
                key={index}
                onClick={btn.action}
                title={btn.title}
                aria-label={btn.title}
                className="flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer"
                style={{
                  backgroundColor: btn.isActive
                    ? 'var(--color-accent)'
                    : 'transparent',
                  color: 'white',
                }}
                onMouseEnter={(e) => {
                  if (!btn.isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'rgba(255,255,255,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!btn.isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'transparent';
                  }
                }}
              >
                <Icon size={16} />
              </button>
            );
          })
        )}
      </div>
    </BubbleMenu>
  );
}
