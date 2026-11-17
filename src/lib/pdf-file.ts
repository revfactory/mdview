/** 한 번에 메모리에 올려 렌더링하므로 크기를 제한한다. */
export const PDF_MAX_FILE_SIZE = 100 * 1024 * 1024;

const PDF_EXTENSION = /\.pdf$/i;
const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
/** PDF 명세상 헤더 앞에 다른 바이트가 붙은 파일도 있어 앞부분 1024바이트 안에서 찾는다. */
export const PDF_HEADER_SEARCH_BYTES = 1024;

export function isPdfFileName(name: string): boolean {
  return PDF_EXTENSION.test(name);
}

export function pdfTitleFromFileName(name: string): string {
  return name.replace(PDF_EXTENSION, '').trim() || '제목 없음';
}

export function hasPdfHeader(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, PDF_HEADER_SEARCH_BYTES) - PDF_HEADER.length;
  for (let start = 0; start <= limit; start++) {
    let matched = true;
    for (let i = 0; i < PDF_HEADER.length; i++) {
      if (bytes[start + i] !== PDF_HEADER[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

/** 파일을 읽기 전에 확인할 수 있는 조건만 검사한다. 통과하면 null. */
export function validatePdfFileMeta(file: { name: string; size: number; type?: string }): string | null {
  if (!isPdfFileName(file.name) && file.type !== 'application/pdf') {
    return 'PDF 파일(.pdf)만 열 수 있습니다.';
  }
  if (file.size === 0) return '빈 파일입니다.';
  if (file.size > PDF_MAX_FILE_SIZE) {
    return `파일이 너무 큽니다. ${formatFileSize(PDF_MAX_FILE_SIZE)} 이하의 PDF만 열 수 있습니다.`;
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
