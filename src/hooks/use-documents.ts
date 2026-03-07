'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import type { Document } from '@/types';

export function useDocuments(): Document[] | undefined {
  return useLiveQuery(
    () => db.documents.orderBy('updatedAt').reverse().toArray(),
  );
}

export function useDocument(id: string | null): Document | undefined {
  return useLiveQuery(
    () => (id ? db.documents.get(id) : undefined),
    [id],
  );
}

export function useDocumentsByFolder(folderId: string | null): Document[] | undefined {
  return useLiveQuery(
    async () => {
      if (folderId === null) {
        const all = await db.documents.toArray();
        return all
          .filter((d) => d.folderId === null || d.folderId === undefined)
          .sort((a, b) => a.sortOrder - b.sortOrder);
      }
      return db.documents
        .where('folderId')
        .equals(folderId)
        .sortBy('sortOrder');
    },
    [folderId],
  );
}

export function useFavorites(): Document[] | undefined {
  return useLiveQuery(
    () => db.documents.filter((d) => !!d.isFavorite).toArray(),
  );
}

export function useRecentDocuments(limit: number = 10): Document[] | undefined {
  return useLiveQuery(
    () => db.documents.orderBy('updatedAt').reverse().limit(limit).toArray(),
    [limit],
  );
}
