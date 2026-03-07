import { Extension } from '@tiptap/core';
import { PluginKey, Plugin } from '@tiptap/pm/state';

export const TrailingNode = Extension.create({
  name: 'trailingNode',

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey('trailingNode');

    return [
      new Plugin({
        key: pluginKey,
        appendTransaction: (_, __, state) => {
          const { doc, tr, schema } = state;
          const shouldInsert = pluginKey.getState(state);

          if (!shouldInsert) return null;

          const lastNode = doc.lastChild;
          if (!lastNode) return null;

          const endPos = doc.content.size;
          const type = schema.nodes.paragraph;
          if (!type) return null;

          return tr.insert(endPos, type.create());
        },
        state: {
          init: (_, state) => {
            const lastNode = state.doc.lastChild;
            return lastNode ? lastNode.type.name !== 'paragraph' : false;
          },
          apply: (tr, value) => {
            if (!tr.docChanged) return value;
            const lastNode = tr.doc.lastChild;
            return lastNode ? lastNode.type.name !== 'paragraph' : false;
          },
        },
      }),
    ];
  },
});
