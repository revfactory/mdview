import Dexie, { type EntityTable } from 'dexie';
import type { Document, Folder, AppSettings } from '@/types';
import type { ChunkRecord } from './chunks';
import type { StoredFile } from './files';

const db = new Dexie('mdview') as Dexie & {
  documents: EntityTable<Document, 'id'>;
  folders: EntityTable<Folder, 'id'>;
  settings: EntityTable<AppSettings, 'id'>;
  chunks: EntityTable<ChunkRecord, 'id'>;
  files: EntityTable<StoredFile, 'id'>;
};

db.version(1).stores({
  documents: 'id, [folderId+sortOrder], updatedAt, isFavorite, *tags',
  folders: 'id, [parentId+sortOrder], name',
  settings: 'id',
});

db.version(2).stores({
  documents: 'id, [folderId+sortOrder], updatedAt, isFavorite, *tags',
  folders: 'id, [parentId+sortOrder], name',
  settings: 'id',
  chunks: '++id, docId, [docId+chunkIndex]',
});

// v3: PDF 원본 보관용 files 테이블. 기존 문서 데이터는 그대로 두고 테이블만 추가한다.
db.version(3).stores({
  documents: 'id, [folderId+sortOrder], updatedAt, isFavorite, *tags',
  folders: 'id, [parentId+sortOrder], name',
  settings: 'id',
  chunks: '++id, docId, [docId+chunkIndex]',
  files: 'id',
});

export { db };
