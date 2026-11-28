import type { Attributes } from '@tiptap/core';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';

// Marked emits a disabled checkbox at the start of an item, inside its first
// paragraph for loose lists. Recognize that shape without changing exported HTML
// or requiring a migration of previously cached Markdown-derived HTML.
function leadingCheckbox(item: HTMLElement): Element | null {
  const first = firstMeaningfulChild(item);
  const marker = first?.nodeType === 1 && (first as Element).tagName === 'P'
    ? firstMeaningfulChild(first) : first;
  return marker?.nodeType === 1 && (marker as Element).matches('input[type="checkbox"][disabled]')
    ? marker as Element : null;
}

function firstMeaningfulChild(parent: Node): ChildNode | null {
  for (const child of parent.childNodes) {
    if (child.nodeType === 8 || (child.nodeType === 3 && !child.textContent?.trim())) continue;
    return child;
  }
  return null;
}

export const MarkdownTaskList = TaskList.extend({
  parseHTML() {
    return [
      ...(this.parent?.() ?? []),
      {
        tag: 'ul:not([data-type])',
        priority: 52,
        getAttrs: (node) => node.children.length > 0
          && Array.from(node.children).every(child => child.tagName === 'LI' && leadingCheckbox(child as HTMLElement))
          ? null : false,
      },
    ];
  },
});

export const MarkdownTaskItem = TaskItem.extend({
  addAttributes() {
    const inherited: Attributes | undefined = this.parent?.();
    return {
      ...inherited,
      checked: {
        ...inherited?.checked,
        parseHTML: (element) => element.hasAttribute('data-type')
          ? inherited?.checked?.parseHTML?.(element)
          : leadingCheckbox(element)?.hasAttribute('checked') ?? false,
      },
    };
  },
  parseHTML() {
    return [
      ...(this.parent?.() ?? []),
      {
        tag: 'li:not([data-type])',
        context: 'taskList/',
        priority: 52,
        getAttrs: (node) => leadingCheckbox(node) ? null : false,
      },
    ];
  },
});
