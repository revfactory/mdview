import { nanoid } from 'nanoid';
import { db } from '@/db';
import type { Document, Folder } from '@/types';

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
  documents: Document[];
}

export async function createFolder(partial?: Partial<Folder>): Promise<string> {
  const now = new Date();
  const id = partial?.id ?? nanoid();

  const folder: Folder = {
    id,
    name: partial?.name ?? '새 폴더',
    parentId: partial?.parentId ?? null,
    color: partial?.color ?? '#6B7280',
    icon: partial?.icon ?? 'folder',
    isExpanded: partial?.isExpanded ?? true,
    sortOrder: partial?.sortOrder ?? Date.now(),
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
  };

  await db.folders.add(folder);
  return id;
}

export async function getFolder(id: string): Promise<Folder | undefined> {
  return db.folders.get(id);
}

export async function updateFolder(id: string, changes: Partial<Folder>): Promise<void> {
  await db.folders.update(id, {
    ...changes,
    updatedAt: new Date(),
  });
}

export async function deleteFolder(id: string): Promise<void> {
  const folder = await db.folders.get(id);
  if (!folder) return;

  await db.transaction('rw', db.folders, db.documents, async () => {
    // 하위 문서를 부모 폴더로 이동
    const childDocs = await db.documents
      .where('folderId')
      .equals(id)
      .toArray();

    for (const doc of childDocs) {
      await db.documents.update(doc.id, { folderId: folder.parentId });
    }

    // 하위 폴더를 부모 폴더로 이동
    const childFolders = await db.folders.toArray();
    const subFolders = childFolders.filter((f) => f.parentId === id);

    for (const sub of subFolders) {
      await db.folders.update(sub.id, { parentId: folder.parentId });
    }

    await db.folders.delete(id);
  });
}

export async function getFolderTree(): Promise<FolderTreeNode[]> {
  const [folders, documents] = await Promise.all([
    db.folders.toArray(),
    db.documents.toArray(),
  ]);

  const folderMap = new Map<string, FolderTreeNode>();

  // 모든 폴더를 트리 노드로 변환
  for (const folder of folders) {
    folderMap.set(folder.id, {
      ...folder,
      children: [],
      documents: [],
    });
  }

  // 문서를 해당 폴더에 배치
  for (const doc of documents) {
    if (doc.folderId && folderMap.has(doc.folderId)) {
      folderMap.get(doc.folderId)!.documents.push(doc);
    }
  }

  // 각 폴더의 문서를 sortOrder로 정렬
  for (const node of folderMap.values()) {
    node.documents.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // 트리 구조 구성
  const roots: FolderTreeNode[] = [];

  for (const node of folderMap.values()) {
    if (node.parentId && folderMap.has(node.parentId)) {
      folderMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // 각 레벨을 sortOrder로 정렬
  const sortChildren = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };

  sortChildren(roots);
  return roots;
}

export async function reorderFolders(parentId: string | null, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.folders, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.folders.update(orderedIds[i], { sortOrder: i });
    }
  });
}
