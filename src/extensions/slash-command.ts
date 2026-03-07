import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { SlashCommandItem } from '@/types/editor';
import { SLASH_COMMANDS } from '@/lib/constants';

export interface SlashCommandStorage {
  query: string;
  active: boolean;
  range: { from: number; to: number } | null;
  decorationPosition: { top: number; left: number } | null;
  filteredItems: SlashCommandItem[];
  selectedIndex: number;
}

const slashCommandPluginKey = new PluginKey('slashCommand');

function filterCommands(query: string): SlashCommandItem[] {
  if (!query) return SLASH_COMMANDS;

  const lower = query.toLowerCase();
  return SLASH_COMMANDS.filter(
    (item) =>
      item.label.toLowerCase().includes(lower) ||
      item.command.toLowerCase().includes(lower) ||
      item.description.toLowerCase().includes(lower) ||
      item.aliases?.some((alias) => alias.toLowerCase().includes(lower))
  );
}

function getCaretPosition(view: EditorView, from: number) {
  const coords = view.coordsAtPos(from);
  const editorRect = view.dom.closest('.editor-wrapper')?.getBoundingClientRect() ??
    view.dom.getBoundingClientRect();

  return {
    top: coords.bottom - editorRect.top + 4,
    left: coords.left - editorRect.left,
  };
}

export function executeSlashCommand(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any,
  command: string,
  range: { from: number; to: number }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain = (editor as any).chain().focus().deleteRange(range);

  switch (command) {
    case 'heading1':
      chain.setNode('heading', { level: 1 }).run();
      break;
    case 'heading2':
      chain.setNode('heading', { level: 2 }).run();
      break;
    case 'heading3':
      chain.setNode('heading', { level: 3 }).run();
      break;
    case 'bulletList':
      chain.toggleBulletList().run();
      break;
    case 'orderedList':
      chain.toggleOrderedList().run();
      break;
    case 'taskList':
      chain.toggleTaskList().run();
      break;
    case 'blockquote':
      chain.toggleBlockquote().run();
      break;
    case 'horizontalRule':
      chain.setHorizontalRule().run();
      break;
    case 'codeBlock':
      chain.setCodeBlock().run();
      break;
    case 'table':
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      break;
    case 'image': {
      const url = prompt('이미지 URL을 입력하세요:');
      if (url) {
        chain.setImage({ src: url }).run();
      }
      break;
    }
    case 'math':
      chain.insertContent('$$\n\n$$').run();
      break;
    case 'mermaid':
      chain.setCodeBlock({ language: 'mermaid' }).run();
      break;
    default:
      chain.run();
  }
}

export const SlashCommand = Extension.create<object, SlashCommandStorage>({
  name: 'slashCommand',

  addStorage() {
    return {
      query: '',
      active: false,
      range: null,
      decorationPosition: null,
      filteredItems: SLASH_COMMANDS,
      selectedIndex: 0,
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    return [
      new Plugin({
        key: slashCommandPluginKey,
        props: {
          handleKeyDown(view, event) {
            const storage = extensionThis.storage as SlashCommandStorage;

            if (!storage.active) {
              return false;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              const maxIndex = storage.filteredItems.length - 1;
              storage.selectedIndex = Math.min(
                storage.selectedIndex + 1,
                maxIndex
              );
              // Dispatch a dummy transaction to trigger React re-render
              view.dispatch(view.state.tr.setMeta('slashCommandUpdate', true));
              return true;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              storage.selectedIndex = Math.max(storage.selectedIndex - 1, 0);
              view.dispatch(view.state.tr.setMeta('slashCommandUpdate', true));
              return true;
            }

            if (event.key === 'Enter') {
              event.preventDefault();
              const item = storage.filteredItems[storage.selectedIndex];
              if (item && storage.range) {
                executeSlashCommand(
                  extensionThis.editor as Parameters<typeof executeSlashCommand>[0],
                  item.command,
                  storage.range
                );
                storage.active = false;
                storage.query = '';
                storage.range = null;
                storage.decorationPosition = null;
                storage.filteredItems = SLASH_COMMANDS;
                storage.selectedIndex = 0;
              }
              return true;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              storage.active = false;
              storage.query = '';
              storage.range = null;
              storage.decorationPosition = null;
              storage.filteredItems = SLASH_COMMANDS;
              storage.selectedIndex = 0;
              view.dispatch(view.state.tr.setMeta('slashCommandUpdate', true));
              return true;
            }

            return false;
          },
        },
        view() {
          return {
            update(view) {
              const storage = extensionThis.storage as SlashCommandStorage;
              const { state } = view;
              const { $from } = state.selection;
              const textBefore = $from.parent.textContent.slice(
                0,
                $from.parentOffset
              );

              const slashMatch = textBefore.match(/\/([^\s]*)$/);

              if (slashMatch) {
                const query = slashMatch[1];
                const from = $from.pos - query.length - 1;
                const to = $from.pos;

                storage.active = true;
                storage.query = query;
                storage.range = { from, to };
                storage.filteredItems = filterCommands(query);
                storage.selectedIndex = 0;
                storage.decorationPosition = getCaretPosition(view, from);
              } else if (storage.active) {
                storage.active = false;
                storage.query = '';
                storage.range = null;
                storage.decorationPosition = null;
                storage.filteredItems = SLASH_COMMANDS;
                storage.selectedIndex = 0;
              }
            },
          };
        },
      }),
    ];
  },
});
