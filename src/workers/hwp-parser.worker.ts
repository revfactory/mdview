/// <reference lib="webworker" />

import JSZip from 'jszip';

declare const self: DedicatedWorkerGlobalScope;

interface ParseMessage {
  type: 'parse';
  file: ArrayBuffer;
  options?: {
    preserveStyles: boolean;
    convertTables: boolean;
    extractImages: boolean;
    imageFormat: 'base64' | 'blob';
  };
}

interface ProgressResponse {
  type: 'progress';
  percent: number;
  message: string;
}

interface CompleteResponse {
  type: 'complete';
  content: string;
  warnings: string[];
}

interface ErrorResponse {
  type: 'error';
  error: string;
}

type WorkerResponse = ProgressResponse | CompleteResponse | ErrorResponse;

function postProgress(percent: number, message: string) {
  self.postMessage({ type: 'progress', percent, message } as WorkerResponse);
}

function postComplete(content: string, warnings: string[]) {
  self.postMessage({ type: 'complete', content, warnings } as WorkerResponse);
}

function postError(error: string) {
  self.postMessage({ type: 'error', error } as WorkerResponse);
}

// ---------- HWPX (ZIP-based) parser ----------

function parseHwpxXmlToMarkdown(xml: string): string {
  const lines: string[] = [];

  // Extract text from <hp:t> tags within <hp:p> paragraphs
  const paragraphs = xml.split(/<hp:p[\s>]/);

  for (let i = 1; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const paraEnd = para.indexOf('</hp:p>');
    const paraContent = paraEnd >= 0 ? para.substring(0, paraEnd) : para;

    // Detect paragraph style/heading level
    let headingLevel = 0;
    const styleMatch = paraContent.match(/hp:style\s+val="([^"]*)"/) ||
                       paraContent.match(/ParaShape\s+id="([^"]*)"/);
    if (styleMatch) {
      const style = styleMatch[1].toLowerCase();
      if (style.includes('heading') || style.includes('제목')) {
        const levelMatch = style.match(/(\d)/);
        if (levelMatch) {
          headingLevel = Math.min(parseInt(levelMatch[1], 10), 6);
        } else {
          headingLevel = 1;
        }
      }
    }

    // Check font size for heading detection
    const szMatch = paraContent.match(/<hp:sz\s+val="(\d+)"/);
    if (szMatch && headingLevel === 0) {
      const size = parseInt(szMatch[1], 10);
      if (size >= 2400) headingLevel = 1;
      else if (size >= 2000) headingLevel = 2;
      else if (size >= 1600) headingLevel = 3;
    }

    // Extract all text runs
    const textParts: string[] = [];
    const runs = paraContent.split(/<hp:run[\s>]/);

    for (let j = 1; j < runs.length; j++) {
      const run = runs[j];
      // Extract text from <hp:t> tags
      const tMatches = run.match(/<hp:t>([^<]*)<\/hp:t>/g);
      if (tMatches) {
        for (const tMatch of tMatches) {
          const textContent = tMatch.replace(/<hp:t>/, '').replace(/<\/hp:t>/, '');
          if (textContent) {
            // Check for bold
            const isBold = run.includes('<hp:bold') || run.includes('bold="true"');
            // Check for italic
            const isItalic = run.includes('<hp:italic') || run.includes('italic="true"');

            let formatted = textContent;
            if (isBold && isItalic) formatted = `***${formatted}***`;
            else if (isBold) formatted = `**${formatted}**`;
            else if (isItalic) formatted = `*${formatted}*`;

            textParts.push(formatted);
          }
        }
      }
    }

    // Also try to get text directly from <hp:t> without run wrapper (simpler docs)
    if (textParts.length === 0) {
      const directTextMatches = paraContent.match(/<hp:t>([^<]*)<\/hp:t>/g);
      if (directTextMatches) {
        for (const m of directTextMatches) {
          const t = m.replace(/<hp:t>/, '').replace(/<\/hp:t>/, '');
          if (t) textParts.push(t);
        }
      }
    }

    const lineText = textParts.join('');

    if (lineText.trim() === '') {
      lines.push('');
    } else if (headingLevel > 0) {
      lines.push(`${'#'.repeat(headingLevel)} ${lineText}`);
    } else {
      lines.push(lineText);
    }
  }

  // Clean up excessive blank lines
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function parseHwpx(buffer: ArrayBuffer, _options?: ParseMessage['options']): Promise<{ content: string; warnings: string[] }> {
  const warnings: string[] = [];

  postProgress(10, 'HWPX 파일 압축 해제 중...');

  const zip = await JSZip.loadAsync(buffer);

  postProgress(30, 'HWPX 구조 분석 중...');

  // Find section files
  const sectionFiles: string[] = [];
  zip.forEach((relativePath) => {
    if (relativePath.match(/Contents\/section\d+\.xml$/i) ||
        relativePath.match(/Contents\/Section\d+\.xml$/i)) {
      sectionFiles.push(relativePath);
    }
  });

  // Also check for content.xml
  if (sectionFiles.length === 0) {
    const contentXml = zip.file(/content\.xml$/i);
    if (contentXml.length > 0) {
      sectionFiles.push(contentXml[0].name);
    }
  }

  if (sectionFiles.length === 0) {
    // Try to find any XML with text content
    const allXml = zip.file(/\.xml$/i);
    for (const f of allXml) {
      const content = await f.async('text');
      if (content.includes('<hp:t>') || content.includes('<hp:p>')) {
        sectionFiles.push(f.name);
      }
    }
  }

  if (sectionFiles.length === 0) {
    throw new Error('HWPX 파일에서 본문 섹션을 찾을 수 없습니다.');
  }

  sectionFiles.sort();

  postProgress(60, '텍스트 변환 중...');

  const allMarkdown: string[] = [];

  for (const sectionPath of sectionFiles) {
    const file = zip.file(sectionPath);
    if (!file) continue;

    const xmlContent = await file.async('text');
    const markdown = parseHwpxXmlToMarkdown(xmlContent);
    if (markdown) {
      allMarkdown.push(markdown);
    }
  }

  if (allMarkdown.length === 0) {
    warnings.push('본문 텍스트를 추출하지 못했습니다. 파일이 비어있거나 지원하지 않는 형식일 수 있습니다.');
  }

  postProgress(90, '서식 적용 중...');

  const content = allMarkdown.join('\n\n---\n\n');

  postProgress(100, '변환 완료');

  return { content, warnings };
}

// ---------- Legacy HWP (OLE2 binary) parser ----------

const HWP_SIGNATURE = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
const HWP_MAGIC = 'HWP Document File';

function isOle2(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer, 0, 8);
  for (let i = 0; i < HWP_SIGNATURE.length; i++) {
    if (view[i] !== HWP_SIGNATURE[i]) return false;
  }
  return true;
}

function extractTextFromOle2(buffer: ArrayBuffer): { content: string; warnings: string[] } {
  const warnings: string[] = [];
  const view = new Uint8Array(buffer);

  // Check for HWP magic string in the file
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const fullText = decoder.decode(view);

  if (!fullText.includes(HWP_MAGIC) && !isOle2(buffer)) {
    throw new Error('유효한 HWP 파일이 아닙니다.');
  }

  warnings.push('레거시 HWP 바이너리 형식은 제한적으로 지원됩니다. 서식 정보가 손실될 수 있습니다.');

  // Try to extract readable text using multiple encodings
  // HWP files typically use EUC-KR or UTF-16LE encoding
  const textChunks: string[] = [];

  // Strategy 1: Look for UTF-16LE text runs
  try {
    const utf16Decoder = new TextDecoder('utf-16le', { fatal: false });
    for (let offset = 0; offset < view.length - 4; offset += 2) {
      // Look for sequences of printable UTF-16LE characters
      const charCode = view[offset] | (view[offset + 1] << 8);
      if (
        (charCode >= 0x20 && charCode <= 0x7E) || // ASCII printable
        (charCode >= 0xAC00 && charCode <= 0xD7A3) || // Korean syllables
        (charCode >= 0x3131 && charCode <= 0x318E) || // Korean compatibility Jamo
        (charCode >= 0x4E00 && charCode <= 0x9FFF)    // CJK
      ) {
        // Found a potentially readable character, try to read a run
        let endOffset = offset + 2;
        let runLength = 1;
        while (endOffset < view.length - 1 && runLength < 10000) {
          const nextChar = view[endOffset] | (view[endOffset + 1] << 8);
          if (
            (nextChar >= 0x20 && nextChar <= 0x7E) ||
            (nextChar >= 0xAC00 && nextChar <= 0xD7A3) ||
            (nextChar >= 0x3131 && nextChar <= 0x318E) ||
            (nextChar >= 0x4E00 && nextChar <= 0x9FFF) ||
            nextChar === 0x000A || nextChar === 0x000D // newlines
          ) {
            endOffset += 2;
            runLength++;
          } else {
            break;
          }
        }

        if (runLength >= 4) { // Minimum 4 chars to be meaningful
          const slice = buffer.slice(offset, endOffset);
          const text = utf16Decoder.decode(slice).trim();
          if (text.length >= 4) {
            textChunks.push(text);
          }
          offset = endOffset - 2; // Skip past the run
        }
      }
    }
  } catch {
    // UTF-16LE extraction failed
  }

  // Strategy 2: Fallback to EUC-KR if no UTF-16 text found
  if (textChunks.length === 0) {
    try {
      const euckrDecoder = new TextDecoder('euc-kr', { fatal: false });
      const euckrText = euckrDecoder.decode(view);
      // Extract readable portions
      const readableRuns = euckrText.match(/[\uAC00-\uD7A3\u3131-\u318E\u4E00-\u9FFF\x20-\x7E\n\r]{4,}/g);
      if (readableRuns) {
        textChunks.push(...readableRuns);
      }
    } catch {
      // EUC-KR extraction failed
    }
  }

  if (textChunks.length === 0) {
    throw new Error('HWP 파일에서 텍스트를 추출할 수 없습니다. HWPX 형식으로 변환 후 다시 시도해주세요.');
  }

  // Join and clean up
  let content = textChunks.join('\n\n');
  // Remove control characters
  content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  // Clean up excessive whitespace
  content = content.replace(/\n{3,}/g, '\n\n').trim();

  warnings.push('텍스트만 추출되었습니다. 표, 이미지, 특수 서식은 포함되지 않습니다.');

  return { content, warnings };
}

async function parseHwpLegacy(buffer: ArrayBuffer): Promise<{ content: string; warnings: string[] }> {
  postProgress(10, 'HWP 파일 분석 시작...');
  postProgress(30, '바이너리 구조 분석 중...');

  const result = extractTextFromOle2(buffer);

  postProgress(60, '텍스트 추출 중...');
  postProgress(90, '정리 중...');
  postProgress(100, '변환 완료');

  return result;
}

// ---------- Main message handler ----------

self.onmessage = async (e: MessageEvent<ParseMessage>) => {
  const { type, file, options } = e.data;

  if (type !== 'parse') {
    postError(`알 수 없는 메시지 타입: ${type}`);
    return;
  }

  try {
    const view = new Uint8Array(file);

    // Detect file type
    // HWPX (ZIP) starts with PK (0x50, 0x4B)
    const isZip = view[0] === 0x50 && view[1] === 0x4B;
    // HWP (OLE2) starts with D0 CF 11 E0
    const isOle = isOle2(file);

    let result: { content: string; warnings: string[] };

    if (isZip) {
      result = await parseHwpx(file, options);
    } else if (isOle) {
      result = await parseHwpLegacy(file);
    } else {
      throw new Error('지원하지 않는 파일 형식입니다. HWP 또는 HWPX 파일을 선택해주세요.');
    }

    postComplete(result.content, result.warnings);
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
    postError(message);
  }
};

export {};
