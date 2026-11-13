import { createDocument } from '@/db/documents';

/** 이보다 긴 마크다운은 TipTap 한 화면에 올리지 않고 페이지 단위로 나눠 저장한다. */
export const IMPORT_CHUNK_THRESHOLD = 300_000;

export interface ImportedDocument {
  id: string;
  /** 페이지로 나눠 저장했으면 페이지 수, 아니면 null */
  chunkCount: number | null;
}

/** 가져오거나 변환한 마크다운으로 새 문서를 만든다(HWP·마크다운·PDF 변환 공통). */
export async function createImportedDocument(
  content: string,
  title: string,
  { folderId = null }: { folderId?: string | null } = {},
): Promise<ImportedDocument> {
  if (content.length > IMPORT_CHUNK_THRESHOLD) {
    const { chunkDocument } = await import('@/lib/chunk-document');
    const { saveChunks } = await import('@/db/chunks');
    const chunks = chunkDocument(content);
    const id = await createDocument({
      title,
      content,
      folderId,
      isChunked: true,
      chunkCount: chunks.length,
    });
    await saveChunks(id, chunks);
    return { id, chunkCount: chunks.length };
  }

  let htmlContent = '';
  try {
    const { markdownToHtmlAsync } = await import('@/lib/markdown');
    htmlContent = await markdownToHtmlAsync(content);
  } catch {
    // htmlContent 없이 저장하면 문서를 열 때 마크다운에서 다시 만든다.
  }
  const id = await createDocument({ title, content, htmlContent, folderId });
  return { id, chunkCount: null };
}
