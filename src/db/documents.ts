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

export interface PdfDocumentInput {
  title: string;
  file: Blob;
  fileName: string;
  pageCount: number;
  excerpt?: string;
  folderId?: string | null;
  tags?: string[];
}

/** PDF 원본과 문서 메타데이터를 한 트랜잭션으로 저장한다. 어느 한쪽만 남는 일이 없게 한다. */
export async function createPdfDocument(input: PdfDocumentInput): Promise<string> {
  const now = new Date();
  const id = nanoid();
  const doc: Document = {
    id,
    kind: 'pdf',
    pageCount: input.pageCount,
    fileSize: input.file.size,
    title: input.title || '제목 없음',
    content: '',
    htmlContent: '',
    excerpt: input.excerpt ?? '',
    folderId: input.folderId ?? null,
    tags: input.tags ?? [],
    isFavorite: false,
    isPinned: false,
    wordCount: 0,
    charCount: 0,
    readingTime: 0,
    sortOrder: Date.now(),
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };

  await db.transaction('rw', db.documents, db.files, async () => {
    await db.documents.add(doc);
    await db.files.add({
      id,
      name: input.fileName,
      mimeType: 'application/pdf',
      size: input.file.size,
      blob: input.file,
      createdAt: now,
    });
  });
  return id;
}

/** Copy the persisted document and its associated data as one consistent snapshot. */
export async function duplicateDocument(id: string): Promise<string> {
  const newId = nanoid();
  const now = new Date();
  await db.transaction('rw', db.documents, db.files, db.chunks, async () => {
    const original = await db.documents.get(id);
    if (!original) throw new Error('문서를 찾을 수 없습니다.');
    const file = original.kind === 'pdf' ? await db.files.get(id) : undefined;
    if (original.kind === 'pdf' && !file) throw new Error('원본 PDF 파일이 없습니다.');
    const chunks = original.isChunked
      ? await db.chunks.where('docId').equals(id).sortBy('chunkIndex')
      : [];
    if (original.isChunked && (chunks.length !== original.chunkCount || chunks.some((chunk, index) => chunk.chunkIndex !== index))) {
      throw new Error('문서 페이지가 누락되어 복사할 수 없습니다.');
    }
    await db.documents.add({
      ...original, id: newId, title: `${original.title} (복사본)`,
      tags: [...original.tags], isFavorite: false, isPinned: false,
      createdAt: now, updatedAt: now, lastOpenedAt: now, sortOrder: now.getTime(),
    });
    if (file) await db.files.add({ ...file, id: newId, createdAt: now });
    if (chunks.length) await db.chunks.bulkAdd(chunks.map((chunk) => ({
      docId: newId, chunkIndex: chunk.chunkIndex, markdown: chunk.markdown,
      htmlContent: chunk.htmlContent, updatedAt: now,
    })));
  });
  return newId;
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
  // Keep every part of the document intact if any deletion fails.
  await db.transaction('rw', db.documents, db.files, db.chunks, async () => {
    await db.chunks.where('docId').equals(id).delete();
    await db.documents.delete(id);
    await db.files.delete(id);
  });
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
