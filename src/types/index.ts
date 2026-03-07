export interface Document {
  id: string;
  title: string;
  content: string;
  htmlContent: string;
  excerpt: string;
  folderId: string | null;
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  wordCount: number;
  charCount: number;
  readingTime: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt: Date;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  color: string;
  icon: string;
  isExpanded: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppSettings {
  id: string;
  theme: 'light' | 'dark' | 'system';
  editorFontSize: number;
  editorFontFamily: 'pretendard' | 'system' | 'serif';
  editorLineHeight: number;
  editorMaxWidth: number;
  showLineNumbers: boolean;
  autosaveInterval: number;
  defaultViewMode: 'wysiwyg' | 'split' | 'source';
  sidebarWidth: number;
  spellCheck: boolean;
  lastOpenDocumentId: string | null;
}

export type DocumentCreateInput = Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'lastOpenedAt' | 'excerpt' | 'wordCount' | 'charCount' | 'readingTime' | 'htmlContent'> & {
  id?: string;
};

export type DocumentUpdateInput = Partial<Omit<Document, 'id' | 'createdAt'>>;

export type FolderCreateInput = Omit<Folder, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export type FolderUpdateInput = Partial<Omit<Folder, 'id' | 'createdAt'>>;

export type SortField = 'updatedAt' | 'createdAt' | 'title' | 'sortOrder';
export type SortDirection = 'asc' | 'desc';

export interface SortOption {
  field: SortField;
  direction: SortDirection;
}
