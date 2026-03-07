/// <reference lib="webworker" />

import * as CFB from 'cfb';
import pako from 'pako';

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

// =============================================
// HWP Binary Record Parser
// =============================================

interface HwpRecord {
  tagId: number;
  level: number;
  size: number;
  data: Uint8Array;
}

const HWPTAG_PARA_HEADER = 66;
const HWPTAG_PARA_TEXT = 67;
const HWPTAG_CTRL_HEADER = 71;
const HWPTAG_LIST_HEADER = 72;
const HWPTAG_TABLE = 77;  // HWPTAG_BEGIN(16) + 61

function parseRecords(data: Uint8Array): HwpRecord[] {
  const records: HwpRecord[] = [];
  let offset = 0;

  while (offset < data.length - 3) {
    const header =
      data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24);
    offset += 4;

    const tagId = header & 0x3ff;
    const level = (header >> 10) & 0x3ff;
    let size = (header >> 20) & 0xfff;

    if (size === 0xfff) {
      if (offset + 4 > data.length) break;
      size =
        data[offset] |
        (data[offset + 1] << 8) |
        (data[offset + 2] << 16) |
        (data[offset + 3] << 24);
      offset += 4;
    }

    if (offset + size > data.length) break;

    records.push({
      tagId,
      level,
      size,
      data: data.slice(offset, offset + size),
    });

    offset += size;
  }

  return records;
}

function extractParaText(data: Uint8Array): string {
  const chars: string[] = [];
  let i = 0;

  while (i < data.length - 1) {
    const ch = data[i] | (data[i + 1] << 8);
    if (ch === 0) break;

    // Control characters
    if (ch < 32) {
      if (ch === 9) {
        chars.push('\t');
        i += 2;
      } else if (ch === 10) {
        chars.push('\n');
        i += 2;
      } else if (ch === 13) {
        // Paragraph end - ignore
        i += 2;
      } else if (ch === 11) {
        // Table/drawing object placeholder (8 uint16 = 16 bytes total)
        chars.push('\x0B'); // marker for table
        i += 16;
      } else if ((ch >= 1 && ch <= 8) || (ch >= 14 && ch <= 23)) {
        // Extended inline controls (8 uint16 = 16 bytes total)
        i += 16;
      } else if (ch === 24) {
        chars.push('-'); // hyphen
        i += 2;
      } else if (ch === 30) {
        chars.push(' '); // non-breaking space
        i += 2;
      } else if (ch === 31) {
        chars.push(' '); // fixed-width space
        i += 2;
      } else {
        i += 2;
      }
    } else {
      chars.push(String.fromCharCode(ch));
      i += 2;
    }
  }

  return chars.join('');
}

// =============================================
// Image extraction helpers
// =============================================

function getImageMimeType(filename: string, data?: Uint8Array): string | null {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
  };
  if (mimeMap[ext]) return mimeMap[ext];

  // Detect from magic bytes if extension is unknown
  if (data && data.length >= 4) {
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'image/png';
    if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
    if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return 'image/gif';
    if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) return 'image/webp';
    if (data[0] === 0x42 && data[1] === 0x4d) return 'image/bmp';
  }
  return null;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

/**
 * Extract images from BinData/ entries in an HWP OLE2 (CFB) container.
 * Returns a Map from BinData ID (e.g., "BIN0001") to data URL string.
 */
function extractBinDataImages(
  cfb: CFB.CFB$Container,
  isCompressed: boolean,
  warnings: string[]
): Map<string, string> {
  const imageMap = new Map<string, string>();

  for (let i = 0; i < cfb.FullPaths.length; i++) {
    const fullPath = cfb.FullPaths[i];
    // Match BinData entries like /Root Entry/BinData/BIN0001.jpg
    const binMatch = fullPath.match(/BinData\/(BIN\d+)\.(\w+)$/i);
    if (!binMatch) continue;

    const binId = binMatch[1].toUpperCase(); // e.g., "BIN0001"

    try {
      const entry = cfb.FileIndex[i];
      if (!entry || !entry.content) continue;

      let rawData = new Uint8Array(entry.content as unknown as ArrayBuffer);

      // BinData in HWP can be compressed even when the body is not, or vice versa
      // Try decompression if it looks compressed
      if (isCompressed || (rawData.length > 2 && (rawData[0] & 0x0f) === 0x08)) {
        try {
          const decompressed = pako.inflate(rawData);
          rawData = decompressed;
        } catch {
          try {
            const decompressed = pako.inflateRaw(rawData);
            rawData = decompressed;
          } catch {
            // Use raw data as-is (might not be compressed)
          }
        }
      }

      const mime = getImageMimeType(fullPath, rawData);
      if (!mime) {
        warnings.push(`BinData/${binId}: 지원하지 않는 이미지 형식`);
        continue;
      }

      const base64 = uint8ArrayToBase64(rawData);
      imageMap.set(binId, `data:${mime};base64,${base64}`);
    } catch (err) {
      warnings.push(`BinData/${binId} 이미지 추출 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return imageMap;
}

// =============================================
// Tree-based document structure builder
// =============================================

interface DocNode {
  type: 'paragraph' | 'table' | 'cell' | 'textbox' | 'image';
  text: string;
  children: DocNode[];
  tableRows?: number;
  tableCols?: number;
  cellCol?: number;
  cellRow?: number;
  cellColSpan?: number;
  cellRowSpan?: number;
  imageDataUrl?: string;
  _originalContent?: DocNode[]; // Preserved for container table unwrapping
}

function buildDocTree(records: HwpRecord[], imageMap?: Map<string, string>): DocNode[] {
  const nodes = processRecordRange(records, 0, records.length, imageMap, { imageRefIndex: 0 });
  return unwrapContainerTables(nodes);
}

// Shared mutable state for image reference tracking across recursive calls
interface ParseState {
  imageRefIndex: number;
}

/**
 * Recursively process a range of HWP records [start, end) into DocNodes.
 * Handles nested tables by recursing into cell content.
 */
function processRecordRange(
  records: HwpRecord[],
  start: number,
  end: number,
  imageMap: Map<string, string> | undefined,
  state: ParseState
): DocNode[] {
  const nodes: DocNode[] = [];
  let i = start;

  while (i < end) {
    const rec = records[i];

    if (rec.tagId !== HWPTAG_PARA_HEADER) {
      i++;
      continue;
    }

    const paraLevel = rec.level;
    // Find the extent of this paragraph (all records with level > paraLevel)
    let paraEnd = i + 1;
    while (paraEnd < end && records[paraEnd].level > paraLevel) {
      paraEnd++;
    }

    const textRec = (i + 1 < paraEnd && records[i + 1].tagId === HWPTAG_PARA_TEXT)
      ? records[i + 1] : null;

    if (!textRec) {
      i = paraEnd;
      continue;
    }

    const text = extractParaText(textRec.data);

    if (text.includes('\x0B')) {
      // Paragraph contains table/drawing placeholders
      // Add any non-control text as a paragraph
      const cleanText = text.replace(/\x0B/g, '').trim();
      if (cleanText) {
        nodes.push({ type: 'paragraph', text: cleanText, children: [] });
      }

      // Process each CTRL_HEADER within this paragraph
      let j = i + 2;
      while (j < paraEnd) {
        if (records[j].tagId !== HWPTAG_CTRL_HEADER) {
          j++;
          continue;
        }

        const ctrlLevel = records[j].level;
        let ctrlEnd = j + 1;
        while (ctrlEnd < paraEnd && records[ctrlEnd].level > ctrlLevel) {
          ctrlEnd++;
        }

        const ctrlData = records[j].data;
        const ctrlId = ctrlData.length >= 4
          ? (ctrlData[0] | (ctrlData[1] << 8) | (ctrlData[2] << 16) | (ctrlData[3] << 24))
          : 0;

        if (ctrlId === 0x74626c20) {
          // "tbl " - Table control
          const tableNode = parseTableControl(records, j + 1, ctrlEnd, imageMap, state);
          if (tableNode) nodes.push(tableNode);
        } else if (ctrlId === 0x67736f20) {
          // "gso " - General Shape Object (image)
          const imgNode = parseImageControl(records, j, ctrlEnd, imageMap, state);
          if (imgNode) {
            nodes.push(imgNode);
          }
        } else {
          // Other control (section def, column def, etc.) - collect text as textbox
          const boxTexts: string[] = [];
          for (let k = j + 1; k < ctrlEnd; k++) {
            if (records[k].tagId === HWPTAG_PARA_TEXT) {
              const t = extractParaText(records[k].data).trim();
              if (t) boxTexts.push(t);
            }
          }
          if (boxTexts.length > 0) {
            nodes.push({ type: 'textbox', text: boxTexts.join('\n'), children: [] });
          }
        }

        j = ctrlEnd;
      }

      i = paraEnd;
    } else {
      // Regular paragraph
      const cleanText = text.trim();
      if (cleanText) {
        nodes.push({ type: 'paragraph', text: cleanText, children: [] });
      }
      i = paraEnd;
    }
  }

  return nodes;
}

/**
 * Parse a TABLE control block (records after CTRL_HEADER) into a DocNode.
 * Recursively processes cell content to handle nested tables.
 */
function parseTableControl(
  records: HwpRecord[],
  start: number,
  end: number,
  imageMap: Map<string, string> | undefined,
  state: ParseState
): DocNode | null {
  // Find TABLE record
  let tableRecIdx = -1;
  for (let i = start; i < end; i++) {
    if (records[i].tagId === HWPTAG_TABLE) {
      tableRecIdx = i;
      break;
    }
  }
  if (tableRecIdx < 0) return null;

  const tableRec = records[tableRecIdx];
  let nRows = 0;
  let nCols = 0;
  if (tableRec.data.length >= 8) {
    nRows = tableRec.data[4] | (tableRec.data[5] << 8);
    nCols = tableRec.data[6] | (tableRec.data[7] << 8);
    if (nRows === 0 || nCols === 0 || nRows > 500 || nCols > 100) {
      const altRows = tableRec.data[2] | (tableRec.data[3] << 8);
      const altCols = tableRec.data[4] | (tableRec.data[5] << 8);
      if (altRows > 0 && altRows <= 500 && altCols > 0 && altCols <= 100) {
        nRows = altRows;
        nCols = altCols;
      }
    }
    if (nRows === 0 || nCols === 0 || nRows > 500 || nCols > 100) {
      const altRows = tableRec.data[0] | (tableRec.data[1] << 8);
      const altCols = tableRec.data[2] | (tableRec.data[3] << 8);
      if (altRows > 0 && altRows <= 500 && altCols > 0 && altCols <= 100) {
        nRows = altRows;
        nCols = altCols;
      }
    }
  }

  const tableNode: DocNode = {
    type: 'table',
    text: '',
    children: [],
    tableRows: nRows,
    tableCols: nCols,
  };

  // Find the first LIST_HEADER to determine cell level
  const tableLevel = tableRec.level;
  let cellLevel = -1;
  for (let i = tableRecIdx + 1; i < end; i++) {
    if (records[i].tagId === HWPTAG_LIST_HEADER) {
      cellLevel = records[i].level;
      break;
    }
  }
  if (cellLevel < 0) return tableNode;

  // Iterate cells
  let cellIndex = 0;
  let i = tableRecIdx + 1;
  while (i < end) {
    if (records[i].tagId === HWPTAG_LIST_HEADER && records[i].level === cellLevel) {
      const lhData = records[i].data;
      let cellColAddr = nCols > 0 ? cellIndex % nCols : 0;
      let cellRowAddr = nCols > 0 ? Math.floor(cellIndex / nCols) : 0;
      let cellColSpan = 1;
      let cellRowSpan = 1;

      if (lhData.length >= 16) {
        cellColAddr = lhData[8] | (lhData[9] << 8);
        cellRowAddr = lhData[10] | (lhData[11] << 8);
        cellColSpan = lhData[12] | (lhData[13] << 8);
        cellRowSpan = lhData[14] | (lhData[15] << 8);
        if (cellColSpan < 1 || cellColSpan > (nCols || 100)) cellColSpan = 1;
        if (cellRowSpan < 1 || cellRowSpan > (nRows || 500)) cellRowSpan = 1;
      }

      // Find cell content range (until next LIST_HEADER at same level or end)
      let cellEnd = i + 1;
      while (cellEnd < end) {
        if (records[cellEnd].tagId === HWPTAG_LIST_HEADER && records[cellEnd].level <= cellLevel) break;
        cellEnd++;
      }

      // Recursively process cell content to handle nested tables
      const cellContent = processRecordRange(records, i + 1, cellEnd, imageMap, state);

      // Separate text and nested structures
      const textParts: string[] = [];
      const nestedChildren: DocNode[] = [];
      for (const node of cellContent) {
        if (node.type === 'paragraph' || node.type === 'textbox') {
          if (node.text) textParts.push(node.text);
        } else {
          nestedChildren.push(node);
        }
      }

      tableNode.children.push({
        type: 'cell',
        text: textParts.join(' '),
        children: nestedChildren,
        cellRow: cellRowAddr,
        cellCol: cellColAddr,
        cellColSpan,
        cellRowSpan,
        _originalContent: cellContent,
      });

      cellIndex++;
      i = cellEnd;
    } else {
      i++;
    }
  }

  // Infer rows/cols if needed
  if (tableNode.children.length > 0 && (nRows === 0 || nCols === 0)) {
    let maxCol = 0;
    let maxRow = 0;
    for (const cell of tableNode.children) {
      maxCol = Math.max(maxCol, (cell.cellCol ?? 0) + (cell.cellColSpan ?? 1));
      maxRow = Math.max(maxRow, (cell.cellRow ?? 0) + (cell.cellRowSpan ?? 1));
    }
    if (maxCol > 0) tableNode.tableCols = maxCol;
    if (maxRow > 0) tableNode.tableRows = maxRow;
    if (!tableNode.tableCols || !tableNode.tableRows) {
      const totalCells = tableNode.children.length;
      tableNode.tableCols = tableNode.tableCols || Math.ceil(Math.sqrt(totalCells));
      tableNode.tableRows = tableNode.tableRows || Math.ceil(totalCells / tableNode.tableCols);
    }
  }

  return tableNode;
}

/**
 * Parse a GSO (General Shape Object) control for images.
 */
function parseImageControl(
  records: HwpRecord[],
  ctrlIdx: number,
  ctrlEnd: number,
  imageMap: Map<string, string> | undefined,
  state: ParseState
): DocNode | null {
  if (!imageMap || imageMap.size === 0) return null;

  const ctrlLevel = records[ctrlIdx].level;
  const HWPTAG_SHAPE_COMPONENT = 76;
  const HWPTAG_SHAPE_COMPONENT_PICTURE = 79;

  // Scan for shape component / picture references
  for (let k = ctrlIdx + 1; k < ctrlEnd; k++) {
    const tagId = records[k].tagId;
    if (tagId === HWPTAG_SHAPE_COMPONENT_PICTURE && records[k].data.length >= 4) {
      const binItemId = records[k].data[0] | (records[k].data[1] << 8);
      const binKey = `BIN${String(binItemId).padStart(4, '0')}`;
      const dataUrl = imageMap.get(binKey);
      if (dataUrl) {
        return { type: 'image', text: '', children: [], imageDataUrl: dataUrl };
      }
    }
  }

  // Fallback: sequential assignment
  state.imageRefIndex++;
  const binKey = `BIN${String(state.imageRefIndex).padStart(4, '0')}`;
  const dataUrl = imageMap.get(binKey);
  if (dataUrl) {
    return { type: 'image', text: '', children: [], imageDataUrl: dataUrl };
  }

  return null;
}

/**
 * Unwrap 1x1 container tables (border boxes) by extracting their cell content.
 */
function unwrapContainerTables(nodes: DocNode[]): DocNode[] {
  const result: DocNode[] = [];
  for (const node of nodes) {
    if (node.type === 'table' && isContainerTable(node)) {
      const cell = node.children[0];
      if (cell) {
        // Re-process the cell: we need the individual paragraphs, not the joined text.
        // The cell's _cellContent field has the original nodes if available.
        // Otherwise, split the joined text back into paragraphs from cell._originalContent
        if (cell._originalContent) {
          for (const orig of cell._originalContent) {
            if (orig.type === 'table' && isContainerTable(orig)) {
              result.push(...unwrapContainerTables([orig]));
            } else {
              result.push(orig);
            }
          }
        } else {
          // Fallback: use joined text + nested children
          if (cell.text.trim()) {
            result.push({ type: 'paragraph', text: cell.text.trim(), children: [] });
          }
          for (const child of cell.children) {
            if (child.type === 'table' && isContainerTable(child)) {
              result.push(...unwrapContainerTables([child]));
            } else {
              result.push(child);
            }
          }
        }
      }
    } else {
      result.push(node);
    }
  }
  return result;
}

function isContainerTable(node: DocNode): boolean {
  const rows = node.tableRows || 0;
  const cols = node.tableCols || 0;
  // A 1x1 table in HWP is always a visual container/border box, not a data table
  return rows === 1 && cols === 1 && node.children.length === 1;
}

// =============================================
// Table complexity detection & renderers
// =============================================

function isComplexTable(tableNode: DocNode): boolean {
  const nRows = tableNode.tableRows || 0;
  const nCols = tableNode.tableCols || 0;

  // Check 1: Any cell has colspan or rowspan > 1
  for (const cell of tableNode.children) {
    if ((cell.cellColSpan ?? 1) > 1 || (cell.cellRowSpan ?? 1) > 1) {
      return true;
    }
  }

  // Check 2: Cell count doesn't match rows * cols (indicates merged cells)
  if (nRows > 0 && nCols > 0 && tableNode.children.length !== nRows * nCols) {
    return true;
  }

  return false;
}

function escapeHtml(text: string): string {
  return text
    .replace(/\s{2,}/g, ' ') // Collapse multiple whitespace (HWP visual spacing)
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderAsHtmlTable(tableNode: DocNode): string {
  const lines: string[] = [];
  const nRows = tableNode.tableRows || 0;
  const nCols = tableNode.tableCols || 0;

  lines.push('<table>');

  if (nRows === 0 || nCols === 0) {
    // Fallback: dump all cells in a single-column table
    for (const cell of tableNode.children) {
      if (cell.text) {
        lines.push(`  <tr><td>${escapeHtml(cell.text)}</td></tr>`);
      }
    }
    lines.push('</table>');
    return lines.join('\n');
  }

  // Group cells by row
  const rowMap = new Map<number, DocNode[]>();
  for (const cell of tableNode.children) {
    const r = cell.cellRow ?? 0;
    if (!rowMap.has(r)) rowMap.set(r, []);
    rowMap.get(r)!.push(cell);
  }

  // Sort rows and render
  const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);
  for (const rowIdx of sortedRows) {
    const cells = rowMap.get(rowIdx)!;
    // Sort cells by column
    cells.sort((a, b) => (a.cellCol ?? 0) - (b.cellCol ?? 0));

    lines.push('  <tr>');
    for (const cell of cells) {
      const attrs: string[] = [];
      const cs = cell.cellColSpan ?? 1;
      const rs = cell.cellRowSpan ?? 1;
      if (cs > 1) attrs.push(`colspan="${cs}"`);
      if (rs > 1) attrs.push(`rowspan="${rs}"`);
      const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
      // Render cell content including any nested tables
      let cellContent = escapeHtml(cell.text);
      if (cell.children.length > 0) {
        for (const child of cell.children) {
          if (child.type === 'table') {
            cellContent += (cellContent ? '<br>' : '') + renderAsHtmlTable(child);
          }
        }
      }
      lines.push(`    <td${attrStr}>${cellContent}</td>`);
    }
    lines.push('  </tr>');
  }

  lines.push('</table>');
  return lines.join('\n');
}

function renderAsMarkdownTable(tableNode: DocNode): string {
  const lines: string[] = [];
  const rows = tableNode.tableRows || 0;
  const cols = tableNode.tableCols || 0;

  if (rows === 0 || cols === 0) {
    for (const cell of tableNode.children) {
      if (cell.text) lines.push(cell.text);
    }
    return lines.join('\n');
  }

  // Build 2D grid
  const grid: string[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => '')
  );

  for (const cell of tableNode.children) {
    const r = cell.cellRow ?? 0;
    const c = cell.cellCol ?? 0;
    if (r < rows && c < cols) {
      grid[r][c] = cell.text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    }
  }

  // Calculate column widths for alignment
  const colWidths = Array.from({ length: cols }, (_, c) => {
    let maxW = 3; // minimum "---"
    for (let r = 0; r < rows; r++) {
      maxW = Math.max(maxW, grid[r][c].length);
    }
    return maxW;
  });

  // Render markdown table
  for (let r = 0; r < rows; r++) {
    const cells = grid[r].map((text, c) => text.padEnd(colWidths[c]));
    lines.push('| ' + cells.join(' | ') + ' |');

    // Header separator after first row
    if (r === 0) {
      const sep = colWidths.map((w) => '-'.repeat(w));
      lines.push('| ' + sep.join(' | ') + ' |');
    }
  }

  return lines.join('\n');
}

// =============================================
// Markdown converter
// =============================================

function docTreeToMarkdown(nodes: DocNode[]): string {
  const lines: string[] = [];

  for (const node of nodes) {
    if (node.type === 'paragraph') {
      lines.push(node.text);
      lines.push('');
    } else if (node.type === 'textbox') {
      lines.push(node.text);
      lines.push('');
    } else if (node.type === 'image') {
      if (node.imageDataUrl) {
        lines.push(`![이미지](${node.imageDataUrl})`);
        lines.push('');
      }
    } else if (node.type === 'table') {
      if (isComplexTable(node)) {
        lines.push(renderAsHtmlTable(node));
      } else {
        lines.push(renderAsMarkdownTable(node));
      }
      lines.push('');
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// =============================================
// HWP Binary Parser (main entry)
// =============================================

function parseHwpBinary(
  buffer: ArrayBuffer
): { content: string; warnings: string[] } {
  const warnings: string[] = [];

  postProgress(10, 'HWP 파일 구조 분석 중...');

  const cfb = CFB.read(new Uint8Array(buffer), { type: 'array' });

  // Read FileHeader
  let isCompressed = true;
  const fileHeader = CFB.find(cfb, '/FileHeader');
  if (fileHeader && fileHeader.content) {
    const fhData = new Uint8Array(fileHeader.content as unknown as ArrayBuffer);
    if (fhData.length >= 40) {
      const flags =
        fhData[36] | (fhData[37] << 8) | (fhData[38] << 16) | (fhData[39] << 24);
      isCompressed = !!(flags & 1);
      const isEncrypted = !!(flags & 2);
      if (isEncrypted) {
        throw new Error(
          '암호화된 HWP 파일은 지원하지 않습니다. 암호를 해제한 후 다시 시도해주세요.'
        );
      }
    }
  }

  postProgress(20, '이미지 데이터 추출 중...');

  // Extract images from BinData/ entries
  const imageMap = extractBinDataImages(cfb, isCompressed, warnings);
  if (imageMap.size > 0) {
    postProgress(25, `이미지 ${imageMap.size}개 추출 완료`);
  }

  postProgress(30, '본문 데이터 읽는 중...');

  // Find all section streams
  const sectionPaths: string[] = [];
  for (let i = 0; i < cfb.FullPaths.length; i++) {
    if (cfb.FullPaths[i].match(/Section\d+$/i)) {
      sectionPaths.push(cfb.FullPaths[i]);
    }
  }

  if (sectionPaths.length === 0) {
    throw new Error('HWP 파일에서 본문 섹션을 찾을 수 없습니다.');
  }

  sectionPaths.sort();

  const allMarkdown: string[] = [];

  for (let si = 0; si < sectionPaths.length; si++) {
    const sectionEntry = CFB.find(cfb, sectionPaths[si]);
    if (!sectionEntry || !sectionEntry.content) continue;

    const percent = 30 + Math.round((si / sectionPaths.length) * 50);
    postProgress(percent, `섹션 ${si + 1}/${sectionPaths.length} 처리 중...`);

    let sectionData: Uint8Array;
    const raw = new Uint8Array(sectionEntry.content as unknown as ArrayBuffer);

    if (isCompressed) {
      try {
        sectionData = pako.inflate(raw);
      } catch {
        try {
          sectionData = pako.inflateRaw(raw);
        } catch {
          warnings.push(`섹션 ${si} 압축 해제 실패, 원본 데이터 사용`);
          sectionData = raw;
        }
      }
    } else {
      sectionData = raw;
    }

    postProgress(percent + 10, '레코드 파싱 중...');

    const records = parseRecords(sectionData);
    const docTree = buildDocTree(records, imageMap);
    const markdown = docTreeToMarkdown(docTree);

    if (markdown) {
      allMarkdown.push(markdown);
    }
  }

  postProgress(90, '변환 완료 중...');

  if (allMarkdown.length === 0) {
    throw new Error(
      'HWP 파일에서 텍스트를 추출할 수 없습니다.'
    );
  }

  const content = allMarkdown.join('\n\n---\n\n');

  postProgress(100, '변환 완료');
  return { content, warnings };
}

// =============================================
// HWPX (ZIP-based) parser
// =============================================

async function parseHwpx(
  buffer: ArrayBuffer
): Promise<{ content: string; warnings: string[] }> {
  const warnings: string[] = [];
  const { default: JSZip } = await import('jszip');

  postProgress(10, 'HWPX 파일 압축 해제 중...');
  const zip = await JSZip.loadAsync(buffer);

  postProgress(20, 'HWPX 이미지 추출 중...');

  // Extract images from BinData/ directory in the ZIP
  const hwpxImageMap = new Map<string, string>();
  const binDataFiles: string[] = [];
  zip.forEach((relativePath) => {
    if (/BinData\//i.test(relativePath) && !/\/$/.test(relativePath)) {
      binDataFiles.push(relativePath);
    }
  });

  for (const binPath of binDataFiles) {
    try {
      const binFile = zip.file(binPath);
      if (!binFile) continue;

      const binData = await binFile.async('uint8array');
      const mime = getImageMimeType(binPath, binData);
      if (!mime) continue;

      const base64 = uint8ArrayToBase64(binData);
      const dataUrl = `data:${mime};base64,${base64}`;

      // Store with multiple key formats for flexible matching
      // e.g., "BinData/image1.png" -> extract "image1.png" and "image1"
      const fileName = binPath.split('/').pop() || '';
      const fileNameNoExt = fileName.replace(/\.\w+$/, '');
      hwpxImageMap.set(fileName, dataUrl);
      hwpxImageMap.set(fileNameNoExt, dataUrl);
      hwpxImageMap.set(binPath, dataUrl);
      // Also store by the relative path inside the HWPX (e.g., "BinData/image1.png")
      const relMatch = binPath.match(/(BinData\/.*)/i);
      if (relMatch) {
        hwpxImageMap.set(relMatch[1], dataUrl);
      }
    } catch (err) {
      warnings.push(`HWPX 이미지 추출 실패 (${binPath}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (hwpxImageMap.size > 0) {
    postProgress(25, `이미지 ${binDataFiles.length}개 추출 완료`);
  }

  postProgress(30, 'HWPX 구조 분석 중...');

  // Find section files
  const sectionFiles: string[] = [];
  zip.forEach((relativePath) => {
    if (/Contents\/[Ss]ection\d+\.xml$/i.test(relativePath)) {
      sectionFiles.push(relativePath);
    }
  });

  if (sectionFiles.length === 0) {
    const contentXml = zip.file(/content\.xml$/i);
    if (contentXml.length > 0) sectionFiles.push(contentXml[0].name);
  }

  if (sectionFiles.length === 0) {
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
    const markdown = parseHwpxXml(xmlContent, hwpxImageMap);
    if (markdown) allMarkdown.push(markdown);
  }

  postProgress(100, '변환 완료');

  if (allMarkdown.length === 0) {
    warnings.push('본문 텍스트를 추출하지 못했습니다.');
  }

  return { content: allMarkdown.join('\n\n---\n\n'), warnings };
}

/**
 * Find all top-level occurrences of a balanced XML tag.
 * Handles nested tags of the same name correctly.
 */
function findBalancedTags(xml: string, tagName: string): { start: number; end: number; content: string }[] {
  const results: { start: number; end: number; content: string }[] = [];
  const openPattern = new RegExp(`<${tagName}[\\s>]`, 'g');
  const closeTag = `</${tagName}>`;
  let match;

  while ((match = openPattern.exec(xml)) !== null) {
    const startPos = match.index;
    let depth = 1;
    let searchPos = match.index + match[0].length;

    while (depth > 0 && searchPos < xml.length) {
      const nextOpen = xml.indexOf(`<${tagName}`, searchPos);
      const nextClose = xml.indexOf(closeTag, searchPos);

      if (nextClose === -1) break; // No more closing tags

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Check it's actually an opening tag (not a different tag like <hp:tblPr>)
        const charAfter = xml[nextOpen + tagName.length + 1];
        if (charAfter === '>' || charAfter === ' ' || charAfter === '\t' || charAfter === '\n' || charAfter === '\r') {
          depth++;
        }
        searchPos = nextOpen + tagName.length + 2;
      } else {
        depth--;
        if (depth === 0) {
          const endPos = nextClose + closeTag.length;
          results.push({
            start: startPos,
            end: endPos,
            content: xml.substring(startPos, endPos),
          });
        }
        searchPos = nextClose + closeTag.length;
      }
    }
  }

  return results;
}

function parseHwpxXml(xml: string, imageMap?: Map<string, string>): string {
  const lines: string[] = [];

  // Split XML into text and table segments using balanced tag matching
  let lastIndex = 0;
  const segments: { type: 'text' | 'table'; content: string }[] = [];

  // Find all table positions using balanced tag finder
  const tablePositions = findBalancedTags(xml, 'hp:tbl');

  // Build segments
  for (const tp of tablePositions) {
    if (tp.start > lastIndex) {
      segments.push({ type: 'text', content: xml.substring(lastIndex, tp.start) });
    }
    segments.push({ type: 'table', content: tp.content });
    lastIndex = tp.end;
  }
  if (lastIndex < xml.length) {
    segments.push({ type: 'text', content: xml.substring(lastIndex) });
  }

  for (const segment of segments) {
    if (segment.type === 'table') {
      // Parse table with merge detection
      interface HwpxCell {
        text: string;
        colspan: number;
        rowspan: number;
      }
      const parsedRows: HwpxCell[][] = [];
      let hasComplexMerge = false;

      const trTags = findBalancedTags(segment.content, 'hp:tr');
      for (const trTag of trTags) {
        const trContent = trTag.content;
        const row: HwpxCell[] = [];
        const tcTags = findBalancedTags(trContent, 'hp:tc');
        for (const tcTag of tcTags) {
          const tcContent = tcTag.content;
          // Extract attributes from the opening <hp:tc ...> tag
          const tcOpenMatch = tcContent.match(/^<hp:tc([^>]*)>/);
          const tcAttrs = tcOpenMatch ? tcOpenMatch[1] : '';
          const tcBody = tcContent;
          const cellText = extractHwpxText(tcBody);

          // Parse colspan/rowspan from <hp:cellAddr> or <hp:cellSpan> or tc attributes
          let colspan = 1;
          let rowspan = 1;

          // Check for colspan/rowspan attributes on hp:tc
          const colspanMatch = tcAttrs.match(/colspan\s*=\s*["']?(\d+)["']?/i);
          const rowspanMatch = tcAttrs.match(/rowspan\s*=\s*["']?(\d+)["']?/i);
          if (colspanMatch) colspan = parseInt(colspanMatch[1], 10);
          if (rowspanMatch) rowspan = parseInt(rowspanMatch[1], 10);

          // Also check for <hp:cellSpan> inside the tc body
          const cellSpanMatch = tcBody.match(/<hp:cellSpan[^>]*\bcol\s*=\s*["']?(\d+)["']?[^>]*\brow\s*=\s*["']?(\d+)["']?/);
          if (cellSpanMatch) {
            colspan = parseInt(cellSpanMatch[1], 10) || 1;
            rowspan = parseInt(cellSpanMatch[2], 10) || 1;
          }

          // Check for colSpan/rowSpan attributes in <hp:cellAddr> or similar elements
          const spanAttrMatch = tcBody.match(/colSpan\s*=\s*["']?(\d+)["']?/);
          const rSpanAttrMatch = tcBody.match(/rowSpan\s*=\s*["']?(\d+)["']?/);
          if (spanAttrMatch) colspan = parseInt(spanAttrMatch[1], 10) || 1;
          if (rSpanAttrMatch) rowspan = parseInt(rSpanAttrMatch[1], 10) || 1;

          if (colspan > 1 || rowspan > 1) hasComplexMerge = true;

          row.push({ text: cellText, colspan, rowspan });
        }
        if (row.length > 0) parsedRows.push(row);
      }

      if (parsedRows.length > 0) {
        // Also detect complexity by cell count vs expected grid
        if (!hasComplexMerge) {
          const maxCols = Math.max(...parsedRows.map(r =>
            r.reduce((sum, c) => sum + c.colspan, 0)
          ));
          const expectedCells = parsedRows.length * maxCols;
          const actualCells = parsedRows.reduce((sum, r) => sum + r.length, 0);
          if (actualCells !== expectedCells) hasComplexMerge = true;
        }

        if (hasComplexMerge) {
          // Render as HTML table
          lines.push('<table>');
          for (const row of parsedRows) {
            lines.push('  <tr>');
            for (const cell of row) {
              const attrs: string[] = [];
              if (cell.colspan > 1) attrs.push(`colspan="${cell.colspan}"`);
              if (cell.rowspan > 1) attrs.push(`rowspan="${cell.rowspan}"`);
              const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
              lines.push(`    <td${attrStr}>${escapeHtml(cell.text)}</td>`);
            }
            lines.push('  </tr>');
          }
          lines.push('</table>');
          lines.push('');
        } else {
          // Simple table: render as GFM markdown
          const maxCols = Math.max(...parsedRows.map((r) => r.length));
          const rows: string[][] = parsedRows.map(r =>
            r.map(c => c.text.replace(/\|/g, '\\|').replace(/\n/g, ' '))
          );
          // Normalize rows
          for (const row of rows) {
            while (row.length < maxCols) row.push('');
          }

          for (let r = 0; r < rows.length; r++) {
            lines.push('| ' + rows[r].join(' | ') + ' |');
            if (r === 0) {
              lines.push('| ' + rows[r].map(() => '---').join(' | ') + ' |');
            }
          }
          lines.push('');
        }
      }
    } else {
      // Parse paragraphs
      let pMatch;
      const pRegex = /<hp:p[\s>]([\s\S]*?)<\/hp:p>/g;
      while ((pMatch = pRegex.exec(segment.content)) !== null) {
        const paraContent = pMatch[1];

        // Detect images in this paragraph
        // Look for <hp:img>, <dr:img>, <hp:drawing>, <dr:pict>, <pic:pic> elements
        // with binaryItemIDRef or binItemIDRef attributes
        if (imageMap && imageMap.size > 0) {
          const imgRefPatterns = [
            /binaryItemIDRef\s*=\s*["']([^"']+)["']/gi,
            /binItemIDRef\s*=\s*["']([^"']+)["']/gi,
            /href\s*=\s*["']([^"']*BinData[^"']*)["']/gi,
          ];

          let hasImage = false;
          for (const pattern of imgRefPatterns) {
            let imgMatch;
            while ((imgMatch = pattern.exec(paraContent)) !== null) {
              const ref = imgMatch[1];
              // Try various key formats
              const dataUrl = imageMap.get(ref)
                || imageMap.get(ref.replace(/^BinData\//, ''))
                || imageMap.get(ref.replace(/\.\w+$/, ''));
              if (dataUrl) {
                lines.push(`![이미지](${dataUrl})`);
                lines.push('');
                hasImage = true;
              }
            }
          }

          // Also detect drawing elements that may contain image references
          if (!hasImage) {
            const drawingMatch = paraContent.match(/<(?:hp:drawing|dr:pict|hp:img|dr:img)[\s>]/);
            if (drawingMatch) {
              // Try to find any binItem reference in the drawing subtree
              const binItemMatch = paraContent.match(/(?:binaryItemIDRef|binItemIDRef|binItem)\s*=\s*["']([^"']+)["']/i);
              if (binItemMatch) {
                const ref = binItemMatch[1];
                const dataUrl = imageMap.get(ref)
                  || imageMap.get(ref.replace(/^BinData\//, ''))
                  || imageMap.get(ref.replace(/\.\w+$/, ''));
                if (dataUrl) {
                  lines.push(`![이미지](${dataUrl})`);
                  lines.push('');
                  hasImage = true;
                }
              }
            }
          }

          if (hasImage) continue;
        }

        // Detect heading
        let headingLevel = 0;
        const styleMatch = paraContent.match(/hp:style\s+val="([^"]*)"/);
        if (styleMatch) {
          const style = styleMatch[1].toLowerCase();
          if (style.includes('heading') || style.includes('제목')) {
            const levelMatch = style.match(/(\d)/);
            headingLevel = levelMatch ? Math.min(parseInt(levelMatch[1], 10), 6) : 1;
          }
        }

        const text = extractHwpxText(paraContent);

        if (text.trim() === '') {
          lines.push('');
        } else if (headingLevel > 0) {
          lines.push(`${'#'.repeat(headingLevel)} ${text}`);
        } else {
          lines.push(text);
        }
      }
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extractHwpxText(xml: string): string {
  const parts: string[] = [];
  const tRegex = /<hp:t>([\s\S]*?)<\/hp:t>/g;
  let m;
  while ((m = tRegex.exec(xml)) !== null) {
    if (m[1]) parts.push(m[1]);
  }
  return parts.join('');
}

// =============================================
// Main message handler
// =============================================

self.onmessage = async (e: MessageEvent<ParseMessage>) => {
  const { type, file } = e.data;

  if (type !== 'parse') {
    postError(`알 수 없는 메시지 타입: ${type}`);
    return;
  }

  try {
    const view = new Uint8Array(file);
    const isZip = view[0] === 0x50 && view[1] === 0x4b;
    const isOle =
      view[0] === 0xd0 &&
      view[1] === 0xcf &&
      view[2] === 0x11 &&
      view[3] === 0xe0;

    let result: { content: string; warnings: string[] };

    if (isZip) {
      result = await parseHwpx(file);
    } else if (isOle) {
      result = parseHwpBinary(file);
    } else {
      throw new Error(
        '지원하지 않는 파일 형식입니다. HWP 또는 HWPX 파일을 선택해주세요.'
      );
    }

    postComplete(result.content, result.warnings);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
    postError(message);
  }
};

export {};
