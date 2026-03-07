export type ViewMode = 'wysiwyg' | 'split' | 'source';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'blockquote'
  | 'codeBlock'
  | 'table'
  | 'image'
  | 'horizontalRule'
  | 'math'
  | 'mermaid';

export interface SlashCommandItem {
  label: string;
  description: string;
  icon: string;
  command: string;
  aliases?: string[];
  group?: string;
}

export interface BubbleMenuItem {
  label: string;
  icon: string;
  action: string;
  isActive?: boolean;
  shortcut?: string;
}

export interface EditorState {
  viewMode: ViewMode;
  saveStatus: SaveStatus;
  isSlashMenuOpen: boolean;
  isBubbleMenuOpen: boolean;
  activeBlockType: BlockType;
  selectedText: string;
  cursorPosition: { line: number; column: number };
}

export interface EditorConfig {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  maxWidth: number;
  showLineNumbers: boolean;
  spellCheck: boolean;
  placeholder: string;
}

export interface TableSize {
  rows: number;
  cols: number;
}

export interface ImageAttributes {
  src: string;
  alt: string;
  title?: string;
  width?: number;
  height?: number;
}

export interface CodeBlockAttributes {
  language: string;
}
