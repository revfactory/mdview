import { db } from './index';

export interface ChunkRecord {
  id?: number;
  docId: string;
  chunkIndex: number;
  markdown: string;
  htmlContent: string;
  updatedAt: Date;
}

/**
 * 청크 배열 일괄 저장 (기존 청크 삭제 후 새로 저장)
 */
export async function saveChunks(
  docId: string,
  chunks: { index: number; markdown: string }[]
): Promise<void> {
  const now = new Date();
  const records: ChunkRecord[] = chunks.map((chunk) => ({
    docId,
    chunkIndex: chunk.index,
    markdown: chunk.markdown,
    htmlContent: '',
    updatedAt: now,
  }));

  await db.transaction('rw', db.chunks, async () => {
    await db.chunks.where('docId').equals(docId).delete();
    await db.chunks.bulkAdd(records);
  });
}

/**
 * 특정 청크 로드
 */
export async function getChunk(
  docId: string,
  chunkIndex: number
): Promise<ChunkRecord | undefined> {
  return db.chunks
    .where('[docId+chunkIndex]')
    .equals([docId, chunkIndex])
    .first();
}

/**
 * 청크 수 조회
 */
export async function getChunkCount(docId: string): Promise<number> {
  return db.chunks.where('docId').equals(docId).count();
}

/**
 * 청크 업데이트
 */
export async function updateChunk(
  docId: string,
  chunkIndex: number,
  markdown: string,
  htmlContent: string,
  expectedChunkId: number,
): Promise<void> {
  // Editing is not creation. Serialize validation with the write so a late
  // save cannot recreate a deleted document's or removed page's records.
  await db.transaction('rw', db.documents, db.chunks, async () => {
    const document = await db.documents.get(docId);
    if (!document || !document.isChunked || !Number.isInteger(chunkIndex) ||
        chunkIndex < 0 || chunkIndex >= (document.chunkCount ?? 0)) {
      throw new Error('문서 또는 페이지가 변경되어 저장할 수 없습니다.');
    }
    const record = await db.chunks
      .where('[docId+chunkIndex]')
      .equals([docId, chunkIndex])
      .first();
    if (!record || record.id === undefined) {
      throw new Error('페이지가 누락되어 저장할 수 없습니다. 원본을 확인해주세요.');
    }
    if (!Number.isInteger(expectedChunkId) || record.id !== expectedChunkId) {
      throw new Error('페이지가 다시 구성되어 저장할 수 없습니다. 편집 내용을 백업한 후 다시 열어주세요.');
    }
    const updated = await db.chunks.update(record.id, { markdown, htmlContent, updatedAt: new Date() });
    if (updated !== 1) throw new Error('페이지가 변경되어 저장할 수 없습니다.');
  });
}

/**
 * 전체 청크 마크다운 병합 (내보내기용)
 */
export async function getAllChunksMarkdown(docId: string): Promise<string> {
  const chunks = await db.chunks
    .where('docId')
    .equals(docId)
    .sortBy('chunkIndex');

  return chunks.map((c) => c.markdown).join('\n');
}

/**
 * 문서의 모든 청크 삭제
 */
export async function deleteChunks(docId: string): Promise<void> {
  await db.chunks.where('docId').equals(docId).delete();
}
