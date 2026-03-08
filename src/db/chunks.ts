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
  htmlContent: string
): Promise<void> {
  const record = await db.chunks
    .where('[docId+chunkIndex]')
    .equals([docId, chunkIndex])
    .first();

  if (record && record.id !== undefined) {
    await db.chunks.update(record.id, {
      markdown,
      htmlContent,
      updatedAt: new Date(),
    });
  } else {
    await db.chunks.add({
      docId,
      chunkIndex,
      markdown,
      htmlContent,
      updatedAt: new Date(),
    });
  }
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
