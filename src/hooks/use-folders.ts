'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import type { Document, Folder } from '@/types';

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
  documents: Document[];
}

export function useFolders(): Folder[] | undefined {
  return useLiveQuery(
    () => db.folders.orderBy('sortOrder').toArray(),
  );
}

export function useFolderTree(): FolderTreeNode[] | undefined {
  return useLiveQuery(async () => {
    const [folders, documents] = await Promise.all([
      db.folders.toArray(),
      db.documents.toArray(),
    ]);

    const folderMap = new Map<string, FolderTreeNode>();

    for (const folder of folders) {
      folderMap.set(folder.id, {
        ...folder,
        children: [],
        documents: [],
      });
    }

    for (const doc of documents) {
      if (doc.folderId && folderMap.has(doc.folderId)) {
        folderMap.get(doc.folderId)!.documents.push(doc);
      }
    }

    for (const node of folderMap.values()) {
      node.documents.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    const roots: FolderTreeNode[] = [];

    for (const node of folderMap.values()) {
      if (node.parentId && folderMap.has(node.parentId)) {
        folderMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortChildren = (nodes: FolderTreeNode[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder);
      for (const n of nodes) {
        sortChildren(n.children);
      }
    };

    sortChildren(roots);
    return roots;
  });
}
