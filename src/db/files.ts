import { db } from './index';

/** 문서에 딸린 원본 파일. 문서 하나에 파일 하나이므로 문서 id를 키로 쓴다. */
export interface StoredFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: Date;
}

export async function getStoredFile(documentId: string): Promise<StoredFile | undefined> {
  return db.files.get(documentId);
}

export async function deleteStoredFile(documentId: string): Promise<void> {
  await db.files.delete(documentId);
}
