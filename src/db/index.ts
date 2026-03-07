import Dexie, { type EntityTable } from 'dexie';
import type { Document, Folder, AppSettings } from '@/types';

const db = new Dexie('mdview') as Dexie & {
  documents: EntityTable<Document, 'id'>;
  folders: EntityTable<Folder, 'id'>;
  settings: EntityTable<AppSettings, 'id'>;
};

db.version(1).stores({
  documents: 'id, [folderId+sortOrder], updatedAt, isFavorite, *tags',
  folders: 'id, [parentId+sortOrder], name',
  settings: 'id',
});

export { db };
