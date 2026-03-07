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

interface HwpTableCell {
  text: string;
  colspan: number;
  rowspan: number;
}

interface HwpTable {
  rows: HwpTableCell[][];
  colCount: number;
}

interface HwpImageData {
  base64: string;
  mimeType: string;
  id: string;
  extension: string;
}

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
  isTable: boolean;
  table?: HwpTable;
  isImage: boolean;
  imageData?: HwpImageData;
}

function parseHtmlTable(tableHtml: string): HwpTable {
  const rows: HwpTableCell[][] = [];
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trPattern.exec(tableHtml)) !== null) {
    const rowHtml = trMatch[1];
    const cells: HwpTableCell[] = [];
    const tdPattern = /<(?:td|th)([^>]*)>([\s\S]*?)<\/(?:td|th)>/gi;
    let tdMatch: RegExpExecArray | null;

    while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
      const attrs = tdMatch[1];
      const cellText = stripHtml(tdMatch[2]).trim();

      const colspanMatch = attrs.match(/colspan\s*=\s*["']?(\d+)["']?/i);
      const rowspanMatch = attrs.match(/rowspan\s*=\s*["']?(\d+)["']?/i);

      cells.push({
        text: cellText,
        colspan: colspanMatch ? parseInt(colspanMatch[1], 10) : 1,
        rowspan: rowspanMatch ? parseInt(rowspanMatch[1], 10) : 1,
      });
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  // Determine column count (max logical columns considering colspan)
  let colCount = 0;
  for (const row of rows) {
    let count = 0;
    for (const cell of row) {
      count += cell.colspan;
    }
    if (count > colCount) colCount = count;
  }

  return { rows, colCount: colCount || 1 };
}

function htmlToHwpParagraphs(html: string): HwpParagraph[] {
  const paragraphs: HwpParagraph[] = [];

  // Simple regex-based HTML parser for worker context (no DOM)
  // Process block-level elements

  // Remove doctype, html, head, body wrappers
  let content = html.replace(/<\/?(?:html|head|body|!doctype)[^>]*>/gi, '');

  // Extract tables first and replace with placeholders
  const tables: HwpTable[] = [];
  const tablePattern = /<table[^>]*>[\s\S]*?<\/table>/gi;
  content = content.replace(tablePattern, (tableHtml) => {
    const table = parseHtmlTable(tableHtml);
    const idx = tables.length;
    tables.push(table);
    return `\n__HWPTABLE_${idx}__\n`;
  });

  // Extract images and replace with placeholders
  const images: HwpImageData[] = [];
  const imgPattern = /<img[^>]*>/gi;
  content = content.replace(imgPattern, (imgTag) => {
    const srcMatch = imgTag.match(/src\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) return '';

    const src = srcMatch[1];

    // Only handle base64 data URLs
    const dataUrlMatch = src.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/i);
    if (!dataUrlMatch) {
      // External URL — skip with warning
      console.warn('[HWP Export] Skipping external image URL:', src.substring(0, 80));
      return '\n__HWPIMG_SKIP__\n';
    }

    let mimeSubtype = dataUrlMatch[1].toLowerCase();
    // Normalize jpeg
    if (mimeSubtype === 'jpg') mimeSubtype = 'jpeg';
    const extension = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype;
    const base64Data = dataUrlMatch[2];
    const id = `image${images.length + 1}`;

    const imageData: HwpImageData = {
      base64: base64Data,
      mimeType: `image/${mimeSubtype}`,
      id,
      extension,
    };
    const idx = images.length;
    images.push(imageData);
    return `\n__HWPIMAGE_${idx}__\n`;
  });

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
        isTable: false,
        isImage: false,
      });
      continue;
    }

    // Check for table placeholder
    const tablePlaceholder = trimmed.match(/^__HWPTABLE_(\d+)__$/);
    if (tablePlaceholder) {
      const tableIdx = parseInt(tablePlaceholder[1], 10);
      if (tableIdx < tables.length) {
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
          isTable: true,
          table: tables[tableIdx],
          isImage: false,
        });
      }
      continue;
    }

    // Check for image placeholder
    const imagePlaceholder = trimmed.match(/^__HWPIMAGE_(\d+)__$/);
    if (imagePlaceholder) {
      const imgIdx = parseInt(imagePlaceholder[1], 10);
      if (imgIdx < images.length) {
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
          isTable: false,
          isImage: true,
          imageData: images[imgIdx],
        });
      }
      continue;
    }

    // Skip placeholder for external images
    if (trimmed === '__HWPIMG_SKIP__') {
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
          isTable: false,
          isImage: false,
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
        isTable: false,
        isImage: false,
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
          isTable: false,
          isImage: false,
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
          isTable: false,
          isImage: false,
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
          isTable: false,
          isImage: false,
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
        isTable: false,
        isImage: false,
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

function generateManifest(sections: number, imageEntries: HwpImageData[] = []): string {
  let manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:media-type="application/hwp+zip" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="Contents/content.hpf"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="Contents/header.xml"/>`;

  for (let i = 0; i < sections; i++) {
    manifest += `
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="Contents/section${i}.xml"/>`;
  }

  for (const img of imageEntries) {
    manifest += `
  <manifest:file-entry manifest:media-type="${img.mimeType}" manifest:full-path="BinData/${img.id}.${img.extension}"/>`;
  }

  manifest += `
</manifest:manifest>`;
  return manifest;
}

function generateContentHpf(sections: number, imageEntries: HwpImageData[] = []): string {
  let items = '';
  for (let i = 0; i < sections; i++) {
    items += `
    <opf:item id="section${i}" href="section${i}.xml" media-type="text/xml"/>`;
  }

  for (const img of imageEntries) {
    items += `
    <opf:item id="${img.id}" href="../BinData/${img.id}.${img.extension}" media-type="${img.mimeType}"/>`;
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
      <hp:fontface ha:lang="HANJA">
        <hp:font ha:face="${escapeXml(options.fontFamily)}" ha:type="TTF"/>
      </hp:fontface>
      <hp:fontface ha:lang="SYMBOL">
        <hp:font ha:face="${escapeXml(options.fontFamily)}" ha:type="TTF"/>
      </hp:fontface>
    </hp:fontfaces>
    <hp:borderFills>
      <hp:borderFill ha:id="1">
        <hp:slash ha:type="NONE"/>
        <hp:leftBorder ha:type="NONE" ha:width="0.1mm" ha:color="#000000"/>
        <hp:rightBorder ha:type="NONE" ha:width="0.1mm" ha:color="#000000"/>
        <hp:topBorder ha:type="NONE" ha:width="0.1mm" ha:color="#000000"/>
        <hp:bottomBorder ha:type="NONE" ha:width="0.1mm" ha:color="#000000"/>
      </hp:borderFill>
      <hp:borderFill ha:id="2">
        <hp:slash ha:type="NONE"/>
        <hp:leftBorder ha:type="SOLID" ha:width="0.12mm" ha:color="#000000"/>
        <hp:rightBorder ha:type="SOLID" ha:width="0.12mm" ha:color="#000000"/>
        <hp:topBorder ha:type="SOLID" ha:width="0.12mm" ha:color="#000000"/>
        <hp:bottomBorder ha:type="SOLID" ha:width="0.12mm" ha:color="#000000"/>
      </hp:borderFill>
    </hp:borderFills>
    <hp:charProperties>
      <hp:charPr ha:id="0" ha:height="${Math.round(options.fontSize * 100)}" ha:textColor="#000000">
        <hp:fontRef ha:hangul="0" ha:latin="0"/>
      </hp:charPr>
      <hp:charPr ha:id="1" ha:height="2400" ha:textColor="#000000" ha:bold="true">
        <hp:fontRef ha:hangul="0" ha:latin="0"/>
      </hp:charPr>
      <hp:charPr ha:id="2" ha:height="2000" ha:textColor="#000000" ha:bold="true">
        <hp:fontRef ha:hangul="0" ha:latin="0"/>
      </hp:charPr>
      <hp:charPr ha:id="3" ha:height="1600" ha:textColor="#000000" ha:bold="true">
        <hp:fontRef ha:hangul="0" ha:latin="0"/>
      </hp:charPr>
    </hp:charProperties>
    <hp:paraProperties>
      <hp:paraPr ha:id="0">
        <hp:align ha:horizontal="JUSTIFY" ha:vertical="BASELINE"/>
        <hp:lineSpacing ha:type="PERCENT" ha:value="${Math.round(options.lineHeight * 100)}"/>
      </hp:paraPr>
    </hp:paraProperties>
  </hp:refList>
  <hp:secDef>
    <hp:pageDef ha:width="${width}" ha:height="${height}"
                ha:marginTop="${marginTop}" ha:marginBottom="${marginBottom}"
                ha:marginLeft="${marginLeft}" ha:marginRight="${marginRight}"
                ha:headerMargin="0" ha:footerMargin="0"
                ha:gutterType="LEFT_ONLY"/>
  </hp:secDef>
</hp:head>`;
}

function generateTableXml(table: HwpTable, options: GenerateMessage['options']): string {
  const paper = PAPER_SIZES[options.paperSize] || PAPER_SIZES.A4;
  const pageWidth = options.orientation === 'landscape' ? paper.height : paper.width;
  const marginLeft = options.marginLeft * 100;
  const marginRight = options.marginRight * 100;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const bodySize = Math.round(options.fontSize * 100);

  const colWidth = Math.round(contentWidth / table.colCount);
  const cellHeight = 1000;
  const cellMargin = 51;

  let xml = `
  <hp:p>
    <hp:pPr><hp:paraPrIDRef ha:val="0"/></hp:pPr>
    <hp:run>
      <hp:rPr><hp:charPrIDRef ha:val="0"/></hp:rPr>
      <hp:tbl ha:borderFillIDRef="2" ha:cellSpacing="0" ha:pageBreak="CELL" ha:repeatHeader="false">
        <hp:inMargin ha:left="${cellMargin}" ha:right="${cellMargin}" ha:top="0" ha:bottom="0"/>
        <hp:tblPr>
          <hp:tblSize ha:width="${contentWidth}" ha:widthRelTo="paper"/>
        </hp:tblPr>`;

  for (const row of table.rows) {
    xml += `
        <hp:tr>`;
    for (const cell of row) {
      const cellWidth = colWidth * cell.colspan;
      xml += `
          <hp:tc ha:name="" ha:header="false" ha:hasMargin="false" ha:protect="false" ha:editable="false">
            <hp:cellAddr ha:colAddr="0" ha:rowAddr="0"/>
            <hp:cellSpan ha:colSpan="${cell.colspan}" ha:rowSpan="${cell.rowspan}"/>
            <hp:cellSz ha:width="${cellWidth}" ha:height="${cellHeight}"/>
            <hp:cellMargin ha:left="${cellMargin}" ha:right="${cellMargin}" ha:top="0" ha:bottom="0"/>
            <hp:cellBorderFill ha:borderFillIDRef="2"/>
            <hp:subList ha:textDirection="HORIZONTAL" ha:lineWrap="BREAK" ha:vertAlign="CENTER" ha:textWidth="${cellWidth - cellMargin * 2}" ha:textHeight="${cellHeight}">
              <hp:p>
                <hp:pPr><hp:paraPrIDRef ha:val="0"/></hp:pPr>
                <hp:run>
                  <hp:rPr><hp:sz ha:val="${bodySize}"/></hp:rPr>
                  <hp:t>${escapeXml(cell.text)}</hp:t>
                </hp:run>
              </hp:p>
            </hp:subList>
          </hp:tc>`;
    }
    xml += `
        </hp:tr>`;
  }

  xml += `
      </hp:tbl>
    </hp:run>
  </hp:p>`;

  return xml;
}

function generateImageXml(imageData: HwpImageData, options: GenerateMessage['options']): string {
  const paper = PAPER_SIZES[options.paperSize] || PAPER_SIZES.A4;
  const pageWidth = options.orientation === 'landscape' ? paper.height : paper.width;
  const marginLeft = options.marginLeft * 100;
  const marginRight = options.marginRight * 100;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // Default image size: fit to content width, maintain a 4:3 aspect ratio as fallback
  const imgWidth = contentWidth;
  const imgHeight = Math.round(contentWidth * 3 / 4);

  const binItemId = imageData.id;

  return `
  <hp:p>
    <hp:pPr><hp:paraPrIDRef ha:val="0"/></hp:pPr>
    <hp:run>
      <hp:rPr><hp:charPrIDRef ha:val="0"/></hp:rPr>
      <hp:drawing>
        <hp:anchor ha:type="inline">
          <hp:sz ha:width="${imgWidth}" ha:height="${imgHeight}" ha:widthRelTo="paper" ha:heightRelTo="paper"/>
          <hp:pos ha:treatAsChar="true"/>
          <hp:shapeComment>image</hp:shapeComment>
          <hp:pic>
            <hp:picRect/>
            <hp:img ha:binaryItemIDRef="${binItemId}"/>
          </hp:pic>
        </hp:anchor>
      </hp:drawing>
    </hp:run>
  </hp:p>`;
}

function generateSection(paragraphs: HwpParagraph[], options: GenerateMessage['options']): string {
  const bodySize = Math.round(options.fontSize * 100);

  let paraXml = '';

  for (const para of paragraphs) {
    // Handle table
    if (para.isTable && para.table) {
      paraXml += generateTableXml(para.table, options);
      continue;
    }

    // Handle image
    if (para.isImage && para.imageData) {
      paraXml += generateImageXml(para.imageData, options);
      continue;
    }

    if (para.isHr) {
      paraXml += `
  <hp:p>
    <hp:pPr><hp:paraPrIDRef ha:val="0"/></hp:pPr>
    <hp:run>
      <hp:rPr><hp:sz ha:val="${bodySize}"/></hp:rPr>
      <hp:t>────────────────────────────────</hp:t>
    </hp:run>
  </hp:p>`;
      continue;
    }

    if (para.text === '') {
      paraXml += `
  <hp:p>
    <hp:pPr><hp:paraPrIDRef ha:val="0"/></hp:pPr>
    <hp:run>
      <hp:rPr><hp:sz ha:val="${bodySize}"/></hp:rPr>
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

    let rPr = `<hp:sz ha:val="${fontSize}"/>`;
    if (para.bold || para.headingLevel > 0) {
      rPr += '<hp:bold/>';
    }
    if (para.italic) {
      rPr += '<hp:italic/>';
    }

    paraXml += `
  <hp:p>
    <hp:pPr><hp:paraPrIDRef ha:val="0"/></hp:pPr>
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

  // Collect all image data from paragraphs
  const imageEntries: HwpImageData[] = [];
  for (const para of paragraphs) {
    if (para.isImage && para.imageData) {
      imageEntries.push(para.imageData);
    }
  }

  // Generate HWPX structure
  const zip = new JSZip();

  // mimetype (must be first, uncompressed)
  zip.file('mimetype', generateMimetype(), { compression: 'STORE' });

  // META-INF/manifest.xml
  zip.file('META-INF/manifest.xml', generateManifest(1, imageEntries));

  // Contents/
  zip.file('Contents/content.hpf', generateContentHpf(1, imageEntries));
  zip.file('Contents/header.xml', generateHeader(options));
  zip.file('Contents/section0.xml', generateSection(paragraphs, options));

  // BinData/ — embed images as binary
  for (const img of imageEntries) {
    // Decode base64 to binary
    const binaryString = atob(img.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    zip.file(`BinData/${img.id}.${img.extension}`, bytes, { binary: true });
  }

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
