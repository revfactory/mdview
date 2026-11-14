type SnapshotEditor = { getHTML(): string; isEditable: boolean };
const dirtyEditors = new WeakSet<SnapshotEditor>();
export function markEditorDirty(editor: SnapshotEditor) { dirtyEditors.add(editor); }
export function resetEditorDirty(editor: SnapshotEditor) { dirtyEditors.delete(editor); }
/** Never serialize a derived preview/placeholder over authoritative Markdown. */
export function getDirtyEditorSnapshot(editor: SnapshotEditor): string | null {
  return editor.isEditable && dirtyEditors.has(editor) ? editor.getHTML() : null;
}
