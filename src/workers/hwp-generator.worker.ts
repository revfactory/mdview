/// <reference lib="webworker" />

import JSZip from 'jszip';
import { marked } from 'marked';
import { getSmallEmbeddedRasterSize } from '../lib/embedded-raster';

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

// ---------- Paper sizes in hundredths of a millimetre ----------

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

// ---------- HTML to HWPX XML conversion ----------

type CellPart = { text: string } | { image: HwpImageData; pixels: [number, number] };

interface HwpTableCell {
  text: string;
  parts?: CellPart[];
  colspan: number;
  rowspan: number;
}

interface PositionedTableCell extends HwpTableCell {
  row: number;
  col: number;
}

interface HwpTable {
  rows: PositionedTableCell[][];
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

const imageTagPattern = /<img\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const MAX_CELL_IMAGES = 30;

function cellParts(
  html: string,
  register: (src: string) => Extract<CellPart, { image: HwpImageData }> | undefined,
): CellPart[] | undefined {
  let cursor = 0;
  let found = false;
  const parts: CellPart[] = [];
  for (const match of html.matchAll(imageTagPattern)) {
    const src = [...match[1].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
      .find(([, name]) => name.toLowerCase() === 'src');
    const picture = src && register(src[2] ?? src[3] ?? src[4]);
    if (!picture) continue;
    const before = stripHtml(html.slice(cursor, match.index)).trim();
    if (before) parts.push({ text: before });
    parts.push(picture);
    cursor = match.index + match[0].length;
    found = true;
  }
  if (!found) return;
  const after = stripHtml(html.slice(cursor)).trim();
  if (after) parts.push({ text: after });
  return parts;
}

function parseHtmlTable(
  tableHtml: string,
  register: (src: string) => Extract<CellPart, { image: HwpImageData }> | undefined,
): HwpTable {
  const groups: HwpTableCell[][][] = [[]];
  // Treat consecutive ungrouped rows as one implicit group. A zero rowspan
  // extends through the last row of its own group, not through the entire table.
  const rowOrBoundary = /<\/?(?:thead|tbody|tfoot)\b[^>]*>|<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const [, rowHtml] of tableHtml.matchAll(rowOrBoundary)) {
    const group = groups[groups.length - 1];
    if (rowHtml === undefined) {
      if (group.length) groups.push([]);
      continue;
    }
    const cells: HwpTableCell[] = [];
    const tdPattern = /<(?:td|th)\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/(?:td|th)>/gi;
    for (const [, attrs, cellHtml] of rowHtml.matchAll(tdPattern)) {
      let colspan = 1;
      let rowspan = 1;
      for (const [, name, double, single, unquoted] of attrs.matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g)) {
        const value = (double ?? single ?? unquoted ?? '').match(/^\s*\+?(\d+)/);
        if (!value) continue;
        if (name.toLowerCase() === 'colspan') colspan = Math.min(Number(value[1]) || 1, 1000);
        if (name.toLowerCase() === 'rowspan') rowspan = Math.min(Number(value[1]), 65534);
      }
      cells.push({ text: stripHtml(cellHtml).trim(), parts: cellParts(cellHtml, register), colspan, rowspan });
    }
    group.push(cells);
  }

  return layoutTableRows(groups);
}

function layoutTableRows(groups: HwpTableCell[][][]): HwpTable {
  const rows: PositionedTableCell[][] = [];
  let colCount = 1;
  for (const group of groups) {
    // Store occupied column intervals only, not a full row × column grid.
    let active: { start: number; end: number; endRow: number }[] = [];
    for (const [groupRow, cells] of group.entries()) {
      const row = rows.length;
      active = active.filter(span => span.endRow > row);
      const additions: typeof active = [];
      let col = 0;
      let spanIndex = 0;
      rows.push(cells.map(cell => {
        while (spanIndex < active.length && active[spanIndex].start < col + cell.colspan) {
          col = Math.max(col, active[spanIndex++].end);
        }
        // Bound spans to physical rows so malformed HTML cannot inflate the
        // output with thousands of implied empty rows or cross into another group.
        const remaining = group.length - groupRow;
        const rowspan = cell.rowspan === 0 ? remaining : Math.min(cell.rowspan, remaining);
        const positioned = { ...cell, rowspan, row, col };
        col += cell.colspan;
        colCount = Math.max(colCount, col);
        if (rowspan > 1) additions.push({ start: positioned.col, end: col, endRow: row + rowspan });
        return positioned;
      }));
      if (additions.length) active = active.concat(additions).sort((a, b) => a.start - b.start);
    }
  }

  return { rows, colCount };
}

function htmlToHwpParagraphs(html: string): HwpParagraph[] {
  const paragraphs: HwpParagraph[] = [];

  // Simple regex-based HTML parser for worker context (no DOM)
  // Process block-level elements

  // Remove doctype, html, head, body wrappers
  let content = html.replace(/<\/?(?:html|head|body|!doctype)[^>]*>/gi, '');

  const images: HwpImageData[] = [];
  function registerImage(src: string): HwpImageData | undefined {
    const dataUrlMatch = src.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/i);
    if (!dataUrlMatch) return;
    const mimeSubtype = dataUrlMatch[1].toLowerCase().replace(/^jpg$/, 'jpeg');
    const imageData = {
      base64: dataUrlMatch[2],
      mimeType: `image/${mimeSubtype}`,
      id: `image${images.length + 1}`,
      extension: mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype,
    };
    images.push(imageData);
    return imageData;
  }

  // Extract tables before replacing body images. Cell images remain within
  // their cell and share the same unique package image IDs as body images.
  let cellImageCount = 0;
  const tables: HwpTable[] = [];
  const tablePattern = /<table[^>]*>[\s\S]*?<\/table>/gi;
  content = content.replace(tablePattern, (tableHtml) => {
    const table = parseHtmlTable(tableHtml, src => {
      if (cellImageCount >= MAX_CELL_IMAGES) return;
      const pixels = getSmallEmbeddedRasterSize(src);
      if (!pixels) return;
      const image = registerImage(src);
      if (!image) return;
      cellImageCount++;
      return { image, pixels };
    });
    const idx = tables.length;
    tables.push(table);
    return `\n__HWPTABLE_${idx}__\n`;
  });

  // Existing behavior for body pictures.
  const imgPattern = /<img[^>]*>/gi;
  content = content.replace(imgPattern, (imgTag) => {
    const src = imgTag.match(/src\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!src) return '';
    const idx = images.length;
    if (!registerImage(src)) return '\n__HWPIMG_SKIP__\n';
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
    <opf:item id="section${i}" href="Contents/section${i}.xml" media-type="application/xml"/>`;
  }

  for (const img of imageEntries) {
    items += `
    <opf:item id="${img.id}" href="BinData/${img.id}.${img.extension}" media-type="${img.mimeType}" isEmbeded="1"/>`;
  }

  let itemRefs = '';
  for (let i = 0; i < sections; i++) {
    itemRefs += `
    <opf:itemref idref="section${i}" linear="yes"/>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" version="1.0">
  <opf:metadata>
    <opf:title>MDView Document</opf:title>
    <opf:language>ko</opf:language>
    <opf:meta name="creator" content="MDView"/>
    <opf:meta name="date" content="${new Date().toISOString().split('T')[0]}"/>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>${items}
  </opf:manifest>
  <opf:spine><opf:itemref idref="header" linear="yes"/>${itemRefs}
  </opf:spine>
</opf:package>`;
}

const HWPML = 'http://www.hancom.co.kr/hwpml/2011';

function hwpUnits(mm: number): number {
  return Math.round(mm * 7200 / 25.4);
}

function pageGeometry(options: GenerateMessage['options']) {
  const paper = PAPER_SIZES[options.paperSize] || PAPER_SIZES.A4;
  const landscape = options.orientation === 'landscape';
  // pagePr stores the nominal portrait dimensions. Its orientation flag
  // applies rotation; positioned objects use the rotated content rectangle.
  const nominalWidth = hwpUnits(paper.width / 100);
  const nominalHeight = hwpUnits(paper.height / 100);
  const width = landscape ? nominalHeight : nominalWidth;
  const height = landscape ? nominalWidth : nominalHeight;
  const left = hwpUnits(options.marginLeft);
  const right = hwpUnits(options.marginRight);
  return { width, height, nominalWidth, nominalHeight, left, right, top: hwpUnits(options.marginTop), bottom: hwpUnits(options.marginBottom), contentWidth: Math.max(1, width - left - right) };
}

function generateContainer(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <ocf:rootfiles>
    <ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>
  </ocf:rootfiles>
</ocf:container>`;
}

function characterStyles(options: GenerateMessage['options']) {
  const body = Math.round(options.fontSize * 100);
  return [
    { height: body, bold: false, italic: false },
    ...Object.values(HEADING_SIZES).map(height => ({ height, bold: true, italic: false })),
    { height: body, bold: true, italic: false },
    { height: body, bold: false, italic: true },
    { height: body, bold: true, italic: true },
    { height: Math.round(body * 0.9), bold: false, italic: false },
  ];
}

function generateHeader(options: GenerateMessage['options']): string {
  const face = escapeXml(options.fontFamily);
  const languages = ['hangul', 'latin', 'hanja', 'japanese', 'other', 'symbol', 'user'];
  const langAttrs = (value: number) => languages.map(lang => `${lang}="${value}"`).join(' ');
  const styles = characterStyles(options);
  const fonts = languages.map(lang => `<hh:fontface lang="${lang.toUpperCase()}" fontCnt="1"><hh:font id="0" face="${face}" type="TTF" isEmbedded="0"/></hh:fontface>`).join('\n');
  const charPr = styles.map(({ height, bold, italic }, id) =>
    `<hh:charPr id="${id}" height="${height}" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" borderFillIDRef="1">
      <hh:fontRef ${langAttrs(0)}/><hh:ratio ${langAttrs(100)}/><hh:spacing ${langAttrs(0)}/>
      <hh:relSz ${langAttrs(100)}/><hh:offset ${langAttrs(0)}/>${bold ? '<hh:bold/>' : ''}${italic ? '<hh:italic/>' : ''}
    </hh:charPr>`).join('\n');
  const borders = (id: number, type: string) => `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">
    ${['left', 'right', 'top', 'bottom'].map(side => `<hh:${side}Border type="${type}" width="0.12 mm" color="#000000"/>`).join('')}
    <hh:diagonal type="NONE" width="0.12 mm" color="#000000"/>
  </hh:borderFill>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="${HWPML}/head" version="1.2" secCnt="1">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="${languages.length}">${fonts}</hh:fontfaces>
    <hh:borderFills itemCnt="2">${borders(1, 'NONE')}${borders(2, 'SOLID')}</hh:borderFills>
    <hh:charProperties itemCnt="${styles.length}">${charPr}</hh:charProperties>
    <hh:paraProperties itemCnt="1"><hh:paraPr id="0">
      <hh:align horizontal="LEFT" vertical="BASELINE"/>
      <hh:lineSpacing type="PERCENT" value="${Math.round(options.lineHeight * 100)}" unit="HWPUNIT"/>
    </hh:paraPr></hh:paraProperties>
    <hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>
  </hh:refList>
</hh:head>`;
}

function paragraph(content: string, charPrIDRef = 0): string {
  return `<hp:p paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${charPrIDRef}">${content}</hp:run></hp:p>`;
}

function shapeAttributes(id: number, numberingType: 'TABLE' | 'PICTURE'): string {
  return `id="${id}" zOrder="${id}" numberingType="${numberingType}" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0"`;
}

function shapePosition(width: number, height: number, inline: boolean): string {
  const inlineFlag = inline ? 1 : 0;
  return `<hp:sz width="${width}" height="${height}" widthRelTo="ABSOLUTE" heightRelTo="ABSOLUTE" protect="0"/>
    <hp:pos treatAsChar="${inlineFlag}" affectLSpacing="${inlineFlag}" flowWithText="1" allowOverlap="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>
    <hp:outMargin left="0" right="0" top="0" bottom="0"/>`;
}

function generateTableXml(table: HwpTable, options: GenerateMessage['options'], id: number, nextObjectId: () => number): string {
  const { contentWidth, height, top, bottom } = pageGeometry(options);
  const edge = (col: number) => Math.round(col * contentWidth / table.colCount);
  const cellMargin = hwpUnits(1);
  const textLine = Math.max(1, Math.round(options.fontSize * 100 * options.lineHeight));
  const cellHeight = textLine + cellMargin * 2;
  const rowHeights = table.rows.map(() => cellHeight);
  const heightsIn = (row: number, count: number) => rowHeights.slice(row, row + count).reduce((a, b) => a + b, 0);

  const prepared = table.rows.map(row => row.map(cell => {
    const width = Math.max(1, edge(cell.col + cell.colspan) - edge(cell.col));
    let content = paragraph(`<hp:t>${escapeXml(cell.text)}</hp:t>`);
    if (cell.parts) {
      let heightNeeded = cellMargin * 2;
      const maxWidth = Math.max(1, width - cellMargin * 2);
      const maxHeight = Math.max(1, Math.floor((height - top - bottom) / 4));
      content = cell.parts.map(part => {
        if ('text' in part) {
          heightNeeded += textLine;
          return paragraph(`<hp:t>${escapeXml(part.text)}</hp:t>`);
        }
        const [pw, ph] = part.pixels;
        // At most the native 96 DPI size, shrink within cell width and page.
        const scale = Math.min(75, maxWidth / pw, maxHeight / ph);
        const w = Math.max(1, Math.floor(pw * scale));
        const h = Math.max(1, Math.floor(ph * scale));
        heightNeeded += Math.max(textLine, h);
        return generatePictureParagraph(part.image, nextObjectId(), w, h);
      }).join('');
      rowHeights[cell.row] += Math.max(0, heightNeeded - heightsIn(cell.row, cell.rowspan));
    }
    return { cell, width, content };
  }));

  const rowOffsets = rowHeights.reduce<number[]>((offsets, h) => {
    offsets.push(offsets[offsets.length - 1] + h);
    return offsets;
  }, [0]);
  const heightFor = (row: number, span: number) => rowOffsets[row + span] - rowOffsets[row];
  const rows = prepared.map(row => `<hp:tr>${row.map(({ cell, width, content }) => `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" borderFillIDRef="2">
      <hp:subList textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" textWidth="0" textHeight="0">${content}</hp:subList>
      <hp:cellAddr colAddr="${cell.col}" rowAddr="${cell.row}"/>
      <hp:cellSpan colSpan="${cell.colspan}" rowSpan="${cell.rowspan}"/>
      <hp:cellSz width="${width}" height="${heightFor(cell.row, cell.rowspan)}"/>
      <hp:cellMargin left="${cellMargin}" right="${cellMargin}" top="${cellMargin}" bottom="${cellMargin}"/>
    </hp:tc>`).join('')}</hp:tr>`).join('\n');

  return paragraph(`<hp:tbl ${shapeAttributes(id, 'TABLE')} rowCnt="${table.rows.length}" colCnt="${table.colCount}" borderFillIDRef="2" cellSpacing="0" pageBreak="CELL" repeatHeader="0">
    ${shapePosition(contentWidth, heightFor(0, rowHeights.length), false)}
    <hp:inMargin left="0" right="0" top="0" bottom="0"/>${rows}
  </hp:tbl>`);
}

function generateImageXml(imageData: HwpImageData, options: GenerateMessage['options'], id: number): string {
  const { width: pageWidth, height: pageHeight, contentWidth, top, bottom } = pageGeometry(options);
  const width = Math.min(pageWidth, contentWidth, Math.round((pageHeight - top - bottom) * 4 / 3));
  return generatePictureParagraph(imageData, id, width, Math.round(width * 3 / 4));
}

function generatePictureParagraph(imageData: HwpImageData, id: number, width: number, height: number): string {
  return paragraph(`<hp:pic ${shapeAttributes(id, 'PICTURE')} instid="${id}" reverse="0">
    <hp:offset x="0" y="0"/><hp:orgSz width="${width}" height="${height}"/>
    <hp:curSz width="${width}" height="${height}"/><hp:flip horizontal="0" vertical="0"/>
    <hp:rotationInfo angle="0" centerX="${Math.round(width / 2)}" centerY="${Math.round(height / 2)}" rotateimage="1"/>
    <hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${width}" y="0"/><hc:pt2 x="${width}" y="${height}"/><hc:pt3 x="0" y="${height}"/></hp:imgRect>
    <hp:imgClip left="0" right="${width}" top="0" bottom="${height}"/>
    <hp:inMargin left="0" right="0" top="0" bottom="0"/>
    <hp:imgDim dimwidth="${width}" dimheight="${height}"/>
    <hc:img binaryItemIDRef="${imageData.id}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>
    ${shapePosition(width, height, true)}
  </hp:pic>`);
}

function generateSection(paragraphs: HwpParagraph[], options: GenerateMessage['options']): string {
  const { nominalWidth, nominalHeight, left, right, top, bottom } = pageGeometry(options);
  const sectionProperties = `<hp:secPr textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="0" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">
    <hp:pagePr landscape="${options.orientation === 'landscape' ? 'NARROWLY' : 'WIDELY'}" width="${nominalWidth}" height="${nominalHeight}" gutterType="LEFT_ONLY">
      <hp:margin header="0" footer="0" gutter="0" left="${left}" right="${right}" top="${top}" bottom="${bottom}"/>
    </hp:pagePr>
  </hp:secPr><hp:ctrl><hp:colPr type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>`;
  let objectId = 1;
  const body = paragraphs.map(para => {
    if (para.isTable && para.table) return generateTableXml(para.table, options, objectId++, () => objectId++);
    if (para.isImage && para.imageData) return generateImageXml(para.imageData, options, objectId++);
    const text = para.isHr ? '────────────────────────────────' :
      para.isList ? `${para.listPrefix}${para.text}` :
      para.isBlockquote ? `\u2502 ${para.text}` : para.text;
    const style = para.headingLevel || (para.isCodeBlock ? 10 : para.bold && para.italic ? 9 : para.bold ? 7 : para.italic ? 8 : 0);
    return paragraph(`<hp:t>${escapeXml(text)}</hp:t>`, style);
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="${HWPML}/section" xmlns:hp="${HWPML}/paragraph" xmlns:hc="${HWPML}/core">
  ${paragraph(sectionProperties)}
  ${body}
</hs:sec>`;
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
    if (para.isImage && para.imageData) imageEntries.push(para.imageData);
    for (const row of para.table?.rows ?? []) {
      for (const cell of row) {
        for (const part of cell.parts ?? []) {
          if ('image' in part) imageEntries.push(part.image);
        }
      }
    }
  }

  // Generate HWPX structure
  const zip = new JSZip();

  // mimetype (must be first, uncompressed)
  zip.file('mimetype', generateMimetype(), { compression: 'STORE' });

  zip.file('META-INF/container.xml', generateContainer());

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
