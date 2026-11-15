import { db } from '@/db';
import { updateContent } from '@/db/documents';
import { updateChunk, replaceChunkedSource } from '@/db/chunks';
import { chunkDocument } from '@/lib/chunk-document';
import { ContentConflictError } from '@/lib/content-save-session';
import type { Document, DocumentKind } from '@/types';

export interface PlainBaseline {
  id: string; kind?: DocumentKind; isChunked?: boolean; content: string; htmlContent: string;
}
interface PageState { id: number; index: number; markdown: string; htmlContent: string }
interface ChunkedOwner { docId: string; kind?: DocumentKind; isChunked?: boolean; chunkCount?: number }
export interface PageBaseline extends ChunkedOwner, PageState {}
export interface SourceBaseline extends ChunkedOwner { pages: PageState[] }
export interface ContentSnapshot { markdown: string; html: string }

function same(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
function conflict(): never { throw new ContentConflictError(); }

export function plainBaselineFromDocument(doc: Document): PlainBaseline {
  if (doc.kind === 'pdf' || doc.isChunked) return conflict();
  return { id: doc.id, kind: doc.kind, isChunked: doc.isChunked, content: doc.content || '', htmlContent: doc.htmlContent || '' };
}

export async function readPlainBaseline(id: string): Promise<PlainBaseline> {
  return db.transaction('r', db.documents, async () => {
    const doc = await db.documents.get(id);
    if (!doc) return conflict();
    return plainBaselineFromDocument(doc);
  });
}

export async function readSourceBaseline(docId: string): Promise<SourceBaseline> {
  return db.transaction('r', db.documents, db.chunks, async () => {
    const doc = await db.documents.get(docId);
    if (!doc || doc.kind === 'pdf' || !doc.isChunked) return conflict();
    const chunks = await db.chunks.where('docId').equals(docId).sortBy('chunkIndex');
    if (!chunks.length || chunks.length !== doc.chunkCount || chunks.some((c, i) =>
      c.chunkIndex !== i || !Number.isSafeInteger(c.id) || c.id! <= 0)) return conflict();
    return { docId, kind: doc.kind, isChunked: doc.isChunked, chunkCount: doc.chunkCount,
      pages: chunks.map(c => ({ id: c.id!, index: c.chunkIndex, markdown: c.markdown || '', htmlContent: c.htmlContent || '' })) };
  });
}

export async function readPageBaseline(docId: string, index: number): Promise<PageBaseline> {
  return db.transaction('r', db.documents, db.chunks, async () => {
    const doc = await db.documents.get(docId);
    if (!doc || doc.kind === 'pdf' || !doc.isChunked || !Number.isInteger(index) || index < 0 ||
      !Number.isInteger(doc.chunkCount) || index >= doc.chunkCount!) return conflict();
    const matches = await db.chunks.where('[docId+chunkIndex]').equals([docId, index]).toArray();
    const page = matches[0];
    if (matches.length !== 1 || !Number.isSafeInteger(page.id) || page.id! <= 0) return conflict();
    return { docId, kind: doc.kind, isChunked: doc.isChunked, chunkCount: doc.chunkCount,
      id: page.id!, index, markdown: page.markdown || '', htmlContent: page.htmlContent || '' };
  });
}

export async function savePlainBaseline(expected: PlainBaseline, snapshot: ContentSnapshot): Promise<PlainBaseline> {
  return db.transaction('rw', db.documents, async () => {
    const current = await readPlainBaseline(expected.id);
    // Compare named fields, independent of caller property insertion order.
    if (current.kind !== expected.kind || current.isChunked !== expected.isChunked ||
      current.content !== expected.content || current.htmlContent !== expected.htmlContent) return conflict();
    await updateContent(expected.id, snapshot.markdown, snapshot.html);
    return readPlainBaseline(expected.id);
  });
}

export async function savePageBaseline(expected: PageBaseline, snapshot: ContentSnapshot): Promise<PageBaseline> {
  return db.transaction('rw', db.documents, db.chunks, async () => {
    const current = await readPageBaseline(expected.docId, expected.index);
    if (current.kind !== expected.kind || current.isChunked !== expected.isChunked || current.chunkCount !== expected.chunkCount ||
      current.id !== expected.id || current.markdown !== expected.markdown || current.htmlContent !== expected.htmlContent) return conflict();
    await updateChunk(expected.docId, expected.index, snapshot.markdown, snapshot.html, expected.id);
    return readPageBaseline(expected.docId, expected.index);
  });
}

export async function saveSourceBaseline(expected: SourceBaseline, snapshot: ContentSnapshot): Promise<SourceBaseline> {
  return db.transaction('rw', db.documents, db.chunks, async () => {
    const current = await readSourceBaseline(expected.docId);
    const pages = expected.pages.map(p => ({ id: p.id, index: p.index, markdown: p.markdown, htmlContent: p.htmlContent }));
    if (current.kind !== expected.kind || current.isChunked !== expected.isChunked || current.chunkCount !== expected.chunkCount ||
      !same(current.pages, pages)) return conflict();
    await replaceChunkedSource(expected.docId, snapshot.markdown, chunkDocument(snapshot.markdown));
    return readSourceBaseline(expected.docId);
  });
}
