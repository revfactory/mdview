import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { nanoid } from 'nanoid';

const ATTR_NAME = 'data-id';

export const UniqueID = Extension.create({
  name: 'uniqueID',

  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph',
          'heading',
          'bulletList',
          'orderedList',
          'listItem',
          'taskList',
          'taskItem',
          'blockquote',
          'codeBlock',
          'table',
          'tableRow',
          'tableCell',
          'tableHeader',
          'image',
          'horizontalRule',
        ],
        attributes: {
          [ATTR_NAME]: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.getAttribute(ATTR_NAME),
            renderHTML: (attributes: Record<string, string | null>) => {
              if (!attributes[ATTR_NAME]) {
                return {};
              }
              return { [ATTR_NAME]: attributes[ATTR_NAME] };
            },
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey('uniqueID');

    return [
      new Plugin({
        key: pluginKey,
        appendTransaction: (transactions, _oldState, newState) => {
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) return null;

          const { tr } = newState;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (
              node.isBlock &&
              node.attrs[ATTR_NAME] === null &&
              node.type.spec.attrs?.[ATTR_NAME] !== undefined
            ) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                [ATTR_NAME]: nanoid(10),
              });
              modified = true;
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});
