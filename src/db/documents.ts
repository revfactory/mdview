import Dexie from 'dexie';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { calculateWordCount, extractExcerpt } from '@/lib/utils';
import type { Document } from '@/types';

function computeCharCount(content: string): number {
  return content.replace(/<[^>]*>/g, '').length;
}

function computeReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200));
}

export async function createDocument(partial?: Partial<Document>): Promise<string> {
  const now = new Date();
  const id = partial?.id ?? nanoid();
  const content = partial?.content ?? '';
  const wordCount = partial?.wordCount ?? calculateWordCount(content);
  const charCount = partial?.charCount ?? computeCharCount(content);

  const doc: Document = {
    id,
    title: partial?.title ?? '제목 없음',
    content,
    htmlContent: partial?.htmlContent ?? '',
    excerpt: partial?.excerpt ?? extractExcerpt(content),
    folderId: partial?.folderId ?? null,
    tags: partial?.tags ?? [],
    isFavorite: partial?.isFavorite ?? false,
    isPinned: partial?.isPinned ?? false,
    wordCount,
    charCount,
    readingTime: partial?.readingTime ?? computeReadingTime(wordCount),
    sortOrder: partial?.sortOrder ?? Date.now(),
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
    lastOpenedAt: partial?.lastOpenedAt ?? now,
  };

  await db.documents.add(doc);
  return id;
}

export async function getDocument(id: string): Promise<Document | undefined> {
  return db.documents.get(id);
}

export async function updateDocument(id: string, changes: Partial<Document>): Promise<void> {
  await db.documents.update(id, {
    ...changes,
    updatedAt: new Date(),
  });
}

export async function deleteDocument(id: string): Promise<void> {
  await db.documents.delete(id);
}

export async function getDocumentsByFolder(folderId: string | null): Promise<Document[]> {
  if (folderId === null) {
    const all = await db.documents.toArray();
    return all
      .filter((d) => d.folderId === null || d.folderId === undefined)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return db.documents
    .where('[folderId+sortOrder]')
    .between([folderId, Dexie.minKey], [folderId, Dexie.maxKey])
    .toArray();
}

export async function getFavorites(): Promise<Document[]> {
  return db.documents.filter((d) => !!d.isFavorite).toArray();
}

export async function getRecentDocuments(limit: number = 10): Promise<Document[]> {
  return db.documents
    .orderBy('updatedAt')
    .reverse()
    .limit(limit)
    .toArray();
}

export async function reorderDocuments(folderId: string | null, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.documents, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.documents.update(orderedIds[i], { sortOrder: i });
    }
  });
}

export async function updateContent(
  id: string,
  content: string,
  htmlContent: string,
): Promise<void> {
  // For very large documents, skip expensive metadata computation
  const isLarge = content.length > 500_000;
  const sampleContent = isLarge ? content.slice(0, 100_000) : content;

  const wordCount = calculateWordCount(sampleContent);
  const charCount = isLarge ? content.length : computeCharCount(content);
  const readingTime = computeReadingTime(isLarge ? wordCount * Math.ceil(content.length / 100_000) : wordCount);
  const excerpt = extractExcerpt(content);

  await db.documents.update(id, {
    content,
    htmlContent,
    excerpt,
    wordCount: isLarge ? wordCount * Math.ceil(content.length / 100_000) : wordCount,
    charCount,
    readingTime,
    updatedAt: new Date(),
  });
}
