/// <reference lib="webworker" />

import JSZip from 'jszip';
import { marked } from 'marked';

declare const self: DedicatedWorkerGlobalScope;

interface GenerateMessage {
  type: 'generate';
  markdown: string;
  options: {
    paperSize: 'A4' | 'Letter' | 'B5';
    orientation: 'portrait' | 'landscape';
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    fontSize: number;
    fontFamily: string;
    lineHeight: number;
  };
}

interface ProgressResponse {
  type: 'progress';
  percent: number;
  message: string;
}

interface CompleteResponse {
  type: 'complete';
  buffer: ArrayBuffer;
}

interface ErrorResponse {
  type: 'error';
  error: string;
}

type WorkerResponse = ProgressResponse | CompleteResponse | ErrorResponse;

function postProgress(percent: number, message: string) {
  self.postMessage({ type: 'progress', percent, message } as WorkerResponse);
}

// ---------- Paper sizes (unit: 1/100mm per HWPX spec) ----------

const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  A4:     { width: 21000, height: 29700 },
  Letter: { width: 21590, height: 27940 },
  B5:     { width: 17600, height: 25000 },
};

// ---------- Heading font sizes (1/100 pt) ----------

const HEADING_SIZES: Record<number, number> = {
  1: 2400,
  2: 2000,
  3: 1600,
  4: 1400,
  5: 1200,
  6: 1100,
};

const BODY_SIZE = 1000;

// ---------- HTML to HWPX XML conversion ----------

interface HwpParagraph {
  text: string;
  headingLevel: number; // 0 = body
  bold: boolean;
  italic: boolean;
  isList: boolean;
  listPrefix: string;
  isCodeBlock: boolean;
  isBlockquote: boolean;
  isHr: boolean;
}

function htmlToHwpParagraphs(html: string): HwpParagraph[] {
  const paragraphs: HwpParagraph[] = [];

  // Simple regex-based HTML parser for worker context (no DOM)
  // Process block-level elements

  // Remove doctype, html, head, body wrappers
  let content = html.replace(/<\/?(?:html|head|body|!doctype)[^>]*>/gi, '');

  // Split by block elements
  const blockPattern = /<(h[1-6]|p|li|pre|blockquote|hr|div|ul|ol)(\s[^>]*)?>[\s\S]*?<\/\1>|<hr\s*\/?>|<(h[1-6]|p|li|pre|blockquote|div)(\s[^>]*)?>[\s\S]*?<\/\3>/gi;

  let match: RegExpExecArray | null;
  let lastIndex = 0;

  // Process line by line for simpler approach
  const lines = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n\n')
    .replace(/<\/li>\s*<li[^>]*>/gi, '\n')
    .split('\n');

  let inCodeBlock = false;
  let inOrderedList = false;
  let listCounter = 0;
  let inUnorderedList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push({
        text: '',
        headingLevel: 0,
        bold: false,
        italic: false,
        isList: false,
        listPrefix: '',
        isCodeBlock: false,
        isBlockquote: false,
        isHr: false,
      });
      continue;
    }

    // Check for headings
    const headingMatch = trimmed.match(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/i);
    if (headingMatch) {
      const level = parseInt(headingMatch[1], 10);
      const text = stripHtml(headingMatch[2]);
      if (text.trim()) {
        paragraphs.push({
          text: text.trim(),
          headingLevel: level,
          bold: true,
          italic: false,
          isList: false,
          listPrefix: '',
          isCodeBlock: false,
          isBlockquote: false,
          isHr: false,
        });
      }
      continue;
    }

    // Check for HR
    if (trimmed.match(/<hr\s*\/?>/i)) {
      paragraphs.push({
        text: '',
        headingLevel: 0,
        bold: false,
        italic: false,
        isList: false,
        listPrefix: '',
        isCodeBlock: false,
        isBlockquote: false,
        isHr: true,
      });
      continue;
    }

    // Check for code block
    if (trimmed.match(/<pre[^>]*>/i)) {
      inCodeBlock = true;
    }
    if (inCodeBlock) {
      if (trimmed.match(/<\/pre>/i)) {
        inCodeBlock = false;
      }
      const text = stripHtml(trimmed);
      if (text.trim()) {
        paragraphs.push({
          text: text.trim(),
          headingLevel: 0,
          bold: false,
          italic: false,
          isList: false,
          listPrefix: '',
          isCodeBlock: true,
          isBlockquote: false,
          isHr: false,
        });
      }
      continue;
    }

    // Check for ordered list
    if (trimmed.match(/<ol[^>]*>/i)) {
      inOrderedList = true;
      listCounter = 0;
    }
    if (trimmed.match(/<\/ol>/i)) {
      inOrderedList = false;
    }

    // Check for unordered list
    if (trimmed.match(/<ul[^>]*>/i)) {
      inUnorderedList = true;
    }
    if (trimmed.match(/<\/ul>/i)) {
      inUnorderedList = false;
    }

    // Check for list items
    const liMatch = trimmed.match(/<li[^>]*>([\s\S]*?)<\/li>/i);
    if (liMatch) {
      const text = stripHtml(liMatch[1]);
      if (text.trim()) {
        let prefix = '';
        if (inOrderedList) {
          listCounter++;
          prefix = `${listCounter}. `;
        } else {
          prefix = '\u2022 '; // bullet
        }
        paragraphs.push({
          text: text.trim(),
          headingLevel: 0,
          bold: false,
          italic: false,
          isList: true,
          listPrefix: prefix,
          isCodeBlock: false,
          isBlockquote: false,
          isHr: false,
        });
      }
      continue;
    }

    // Check for blockquote
    const bqMatch = trimmed.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
    if (bqMatch) {
      const text = stripHtml(bqMatch[1]);
      if (text.trim()) {
        paragraphs.push({
          text: text.trim(),
          headingLevel: 0,
          bold: false,
          italic: false,
          isList: false,
          listPrefix: '',
          isCodeBlock: false,
          isBlockquote: true,
          isHr: false,
        });
      }
      continue;
    }

    // Regular paragraph
    const text = stripHtml(trimmed);
    if (text.trim()) {
      // Detect inline formatting
      const hasBold = /<(?:strong|b)>/i.test(trimmed);
      const hasItalic = /<(?:em|i)>/i.test(trimmed);

      paragraphs.push({
        text: text.trim(),
        headingLevel: 0,
        bold: hasBold,
        italic: hasItalic,
        isList: inUnorderedList || inOrderedList,
        listPrefix: inUnorderedList ? '\u2022 ' : (inOrderedList ? `${++listCounter}. ` : ''),
        isCodeBlock: false,
        isBlockquote: false,
        isHr: false,
      });
    }
  }

  return paragraphs;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------- HWPX XML generation ----------

function generateMimetype(): string {
  return 'application/hwp+zip';
}

function generateManifest(sections: number): string {
  let manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:media-type="application/hwp+zip" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="Contents/content.hpf"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="Contents/header.xml"/>`;

  for (let i = 0; i < sections; i++) {
    manifest += `
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="Contents/section${i}.xml"/>`;
  }

  manifest += `
</manifest:manifest>`;
  return manifest;
}

function generateContentHpf(sections: number): string {
  let items = '';
  for (let i = 0; i < sections; i++) {
    items += `
    <opf:item id="section${i}" href="section${i}.xml" media-type="text/xml"/>`;
  }

  let itemRefs = '';
  for (let i = 0; i < sections; i++) {
    itemRefs += `
    <opf:itemref idref="section${i}"/>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="1.0">
  <opf:metadata>
    <opf:title>MDView Document</opf:title>
    <opf:language>ko</opf:language>
    <opf:meta name="creator" content="MDView"/>
    <opf:meta name="date" content="${new Date().toISOString().split('T')[0]}"/>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="header" href="header.xml" media-type="text/xml"/>${items}
  </opf:manifest>
  <opf:spine>${itemRefs}
  </opf:spine>
</opf:package>`;
}

function generateHeader(options: GenerateMessage['options']): string {
  const paper = PAPER_SIZES[options.paperSize] || PAPER_SIZES.A4;
  const width = options.orientation === 'landscape' ? paper.height : paper.width;
  const height = options.orientation === 'landscape' ? paper.width : paper.height;

  // Convert margin from mm to 1/100mm
  const marginTop = options.marginTop * 100;
  const marginBottom = options.marginBottom * 100;
  const marginLeft = options.marginLeft * 100;
  const marginRight = options.marginRight * 100;

  return `<?xml version="1.0" encoding="UTF-8"?>
<hp:head xmlns:hp="http://www.hancom.co.kr/hwpml/2016/HwpMl"
         xmlns:ha="http://www.hancom.co.kr/hwpml/2016/HwpMl/Attr">
  <hp:beginNum ha:page="1" ha:footnote="1" ha:endnote="1"/>
  <hp:refList>
    <hp:fontfaces>
      <hp:fontface ha:lang="HANGUL">
        <hp:font ha:face="${escapeXml(options.fontFamily)}" ha:type="TTF"/>
      </hp:fontface>
      <hp:fontface ha:lang="LATIN">
        <hp:font ha:face="${escapeXml(options.fontFamily)}" ha:type="TTF"/>
      </hp:fontface>
    </hp:fontfaces>
    <hp:charProperties>
      <hp:charPr ha:id="0">
        <hp:sz ha:val="${Math.round(options.fontSize * 100)}"/>
      </hp:charPr>
      <hp:charPr ha:id="1">
        <hp:sz ha:val="2400"/>
        <hp:bold/>
      </hp:charPr>
      <hp:charPr ha:id="2">
        <hp:sz ha:val="2000"/>
        <hp:bold/>
      </hp:charPr>
      <hp:charPr ha:id="3">
        <hp:sz ha:val="1600"/>
        <hp:bold/>
      </hp:charPr>
    </hp:charProperties>
    <hp:paraProperties>
      <hp:paraPr ha:id="0">
        <hp:lineSpacing ha:type="PERCENT" ha:value="${Math.round(options.lineHeight * 100)}"/>
      </hp:paraPr>
    </hp:paraProperties>
  </hp:refList>
  <hp:secDef>
    <hp:pageDef ha:width="${width}" ha:height="${height}"
                ha:marginTop="${marginTop}" ha:marginBottom="${marginBottom}"
                ha:marginLeft="${marginLeft}" ha:marginRight="${marginRight}"
                ha:headerMargin="0" ha:footerMargin="0"/>
  </hp:secDef>
</hp:head>`;
}

function generateSection(paragraphs: HwpParagraph[], options: GenerateMessage['options']): string {
  const bodySize = Math.round(options.fontSize * 100);

  let paraXml = '';

  for (const para of paragraphs) {
    if (para.isHr) {
      // Horizontal rule as a paragraph with dashes
      paraXml += `
  <hp:p>
    <hp:run>
      <hp:rPr><hp:sz val="${bodySize}"/></hp:rPr>
      <hp:t>────────────────────────────────</hp:t>
    </hp:run>
  </hp:p>`;
      continue;
    }

    if (para.text === '') {
      // Empty paragraph
      paraXml += `
  <hp:p>
    <hp:run>
      <hp:rPr><hp:sz val="${bodySize}"/></hp:rPr>
      <hp:t></hp:t>
    </hp:run>
  </hp:p>`;
      continue;
    }

    const fontSize = para.headingLevel > 0
      ? (HEADING_SIZES[para.headingLevel] || bodySize)
      : (para.isCodeBlock ? Math.round(bodySize * 0.9) : bodySize);

    const displayText = para.isList ? `${para.listPrefix}${para.text}` :
                        para.isBlockquote ? `\u2502 ${para.text}` :
                        para.text;

    let rPr = `<hp:sz val="${fontSize}"/>`;
    if (para.bold || para.headingLevel > 0) {
      rPr += '<hp:bold/>';
    }
    if (para.italic) {
      rPr += '<hp:italic/>';
    }

    paraXml += `
  <hp:p>
    <hp:run>
      <hp:rPr>${rPr}</hp:rPr>
      <hp:t>${escapeXml(displayText)}</hp:t>
    </hp:run>
  </hp:p>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<hp:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2016/HwpMl"
        xmlns:ha="http://www.hancom.co.kr/hwpml/2016/HwpMl/Attr">${paraXml}
</hp:sec>`;
}

// ---------- Main generation pipeline ----------

async function generateHwpx(markdown: string, options: GenerateMessage['options']): Promise<ArrayBuffer> {
  postProgress(10, '마크다운 변환 중...');

  // Convert markdown to HTML
  const html = await marked(markdown, { async: true });

  postProgress(30, 'HTML 구조 분석 중...');

  // Convert HTML to paragraph structures
  const paragraphs = htmlToHwpParagraphs(html);

  postProgress(50, 'HWPX XML 생성 중...');

  // Generate HWPX structure
  const zip = new JSZip();

  // mimetype (must be first, uncompressed)
  zip.file('mimetype', generateMimetype(), { compression: 'STORE' });

  // META-INF/manifest.xml
  zip.file('META-INF/manifest.xml', generateManifest(1));

  // Contents/
  zip.file('Contents/content.hpf', generateContentHpf(1));
  zip.file('Contents/header.xml', generateHeader(options));
  zip.file('Contents/section0.xml', generateSection(paragraphs, options));

  postProgress(80, 'HWPX 파일 패키징 중...');

  // Generate zip
  const buffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    mimeType: 'application/hwp+zip',
  });

  postProgress(100, '생성 완료');

  return buffer;
}

// ---------- Message handler ----------

self.onmessage = async (e: MessageEvent<GenerateMessage>) => {
  const { type, markdown, options } = e.data;

  if (type !== 'generate') {
    self.postMessage({ type: 'error', error: `알 수 없는 메시지 타입: ${type}` } as WorkerResponse);
    return;
  }

  try {
    const buffer = await generateHwpx(markdown, options);
    self.postMessage({ type: 'complete', buffer } as WorkerResponse, [buffer]);
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
    self.postMessage({ type: 'error', error: message } as WorkerResponse);
  }
};

export {};
