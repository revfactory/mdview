/** markdown: 편집 가능한 문서, pdf: 원본 PDF를 보관하고 읽기 전용으로 보여 주는 문서 */
export type DocumentKind = 'markdown' | 'pdf';

export interface Document {
  id: string;
  /** 없으면 markdown. v0.2.18 이전에 만든 문서에는 이 필드가 없다. */
  kind?: DocumentKind;
  /** kind === 'pdf' 일 때 페이지 수 */
  pageCount?: number;
  /** kind === 'pdf' 일 때 원본 파일 크기(바이트) */
  fileSize?: number;
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
  isChunked?: boolean;
  chunkCount?: number;
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
