'use client';

import { create } from 'zustand';

interface EditorState {
  activeDocumentId: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  wordCount: number;
  charCount: number;
  cursorPosition: { line: number; col: number };
}

interface EditorActions {
  setActiveDocument: (id: string | null) => void;
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
  updateCounts: (wordCount: number, charCount: number) => void;
  setCursorPosition: (line: number, col: number) => void;
}

export type EditorStore = EditorState & { actions: EditorActions };

export const useEditorStore = create<EditorStore>()((set) => ({
  activeDocumentId: null,
  saveStatus: 'idle',
  wordCount: 0,
  charCount: 0,
  cursorPosition: { line: 1, col: 1 },
  actions: {
    setActiveDocument: (id) => set({ activeDocumentId: id }),
    setSaveStatus: (status) => set({ saveStatus: status }),
    updateCounts: (wordCount, charCount) => set({ wordCount, charCount }),
    setCursorPosition: (line, col) => set({ cursorPosition: { line, col } }),
  },
}));
