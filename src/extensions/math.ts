import { Node } from '@tiptap/core';
import katex from 'katex';

/** Keep source in the document schema; KaTeX's display DOM is not editable content. */
function mathNode(name: string, block: boolean) {
  const tag = block ? 'div' : 'span';
  const className = block ? 'math-block' : 'math-inline';
  return Node.create({
    name,
    group: block ? 'block' : 'inline',
    inline: !block,
    atom: true,
    selectable: true,
    addAttributes() {
      return {
        latex: {
          default: '',
          parseHTML: element => element.getAttribute('data-math') ?? '',
          renderHTML: attributes => ({ 'data-math': attributes.latex }),
        },
      };
    },
    parseHTML() {
      return [{ tag: `${tag}.${className}[data-math]`, priority: 1000 }];
    },
    renderHTML({ node }) {
      // Text fallback also keeps the formula visible in exported HTML.
      return [tag, { class: className, 'data-math': node.attrs.latex }, node.attrs.latex];
    },
    addNodeView() {
      return ({ node }) => {
        const dom = document.createElement(tag);
        dom.className = className;
        dom.setAttribute('data-math', node.attrs.latex);
        dom.setAttribute('aria-label', node.attrs.latex);
        dom.contentEditable = 'false';
        try {
          katex.render(node.attrs.latex, dom, { displayMode: block, throwOnError: false, trust: false });
        } catch {
          dom.textContent = node.attrs.latex;
        }
        return { dom };
      };
    },
  });
}

export const InlineMath = mathNode('inlineMath', false);
export const BlockMath = mathNode('blockMath', true);
