import TurndownService from 'turndown';

const MAX_HTML = 500_000;
const MAX_NODES = 4000;
const MAX_DEPTH = 50;
const MAX_CELLS = 400;
const HTML_NS = 'http://www.w3.org/1999/xhtml';
const BLOCKED = new Set(['script', 'style', 'template', 'iframe', 'object', 'embed', 'noscript', 'svg', 'math', 'canvas']);
const CELL_SEPARATORS = new Set(['br', 'p', 'div', 'li', 'pre']);
const STRUCTURE = new Set(['p', 'div', 'article', 'section', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'em', 'i', 'strong', 'b', 'hr', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td']);

export function isLiteralMarkdownTable(text: string) {
  return text.split(/\r?\n/).some(line => {
    if (line.length > 4096 || !line.includes('|')) return false;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|');
    return cells.length > 1 && cells.every(cell => /^:?-{2,}:?$/.test(cell.trim()));
  });
}

function cellContent(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (node.nodeType !== 1) return '';
  const text = Array.from(node.childNodes, cellContent).join('');
  return CELL_SEPARATORS.has((node as Element).localName) ? text + ' ' : text;
}

function tableText(value: string) {
  // XML-like text and Markdown punctuation stay literal through the editor's
  // Markdown parse. No copied attributes or raw markup enter the output.
  return value.replace(/\s+/g, ' ').trim()
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replace(/[\\|`*_~[\]!]/g, '\\$&');
}

export function clipboardTableToMarkdown(html: string, doc: Document = document): string | null {
  if (!html || html.length > MAX_HTML || !/<table[\s>]/i.test(html)) return null;
  // Template contents use an inert document. Nothing supplied by the
  // clipboard is mounted or used for navigation, loading images, or scripts.
  const input = doc.createElement('template');
  input.innerHTML = html;
  const owner = input.content.ownerDocument;
  const clean = owner.createElement('div');
  const tables: HTMLTableElement[] = [];
  let nodeCount = 0;
  let invalid = false;

  function project(source: Node, target: Node, depth: number) {
    if (++nodeCount > MAX_NODES || depth > MAX_DEPTH) {
      invalid = true;
      return;
    }
    if (source.nodeType === 3) {
      target.appendChild(owner.createTextNode(source.nodeValue ?? ''));
      return;
    }
    if (source.nodeType !== 1) return;
    const el = source as Element;
    const tag = el.localName;
    if (el.namespaceURI !== HTML_NS || BLOCKED.has(tag)) return;

    let destination = target;
    if (STRUCTURE.has(tag)) {
      const cell = tag === 'th' || tag === 'td' ? el as HTMLTableCellElement : null;
      if (cell && (cell.colSpan !== 1 || cell.rowSpan !== 1)) {
        invalid = true;
        return;
      }
      const copy = owner.createElement(tag);
      if (tag === 'table') tables.push(copy as HTMLTableElement);
      target.appendChild(copy);
      destination = copy;
    }
    for (const child of source.childNodes) {
      if (invalid) break;
      project(child, destination, depth + 1);
    }
  }

  for (const child of input.content.childNodes) {
    if (invalid) break;
    project(child, clean, 0);
  }
  if (invalid || !tables.length) return null;
  for (const table of tables) {
    const rows = Array.from(table.rows);
    const columns = rows[0]?.cells.length ?? 0;
    if (rows.length < 2 || columns < 2 || rows.length * columns > MAX_CELLS
        || Array.from(rows[0].cells).some(cell => cell.localName !== 'th')
        || rows.some(row => row.cells.length !== columns)
        || table.querySelector('table')) return null;
  }

  const converter = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  converter.addRule('safeClipboardTable', {
    filter: 'table',
    replacement: (_children, node) => {
      const rows = Array.from((node as HTMLTableElement).rows);
      const printable = rows.map(row => `| ${Array.from(row.cells, cell => tableText(cellContent(cell))).join(' | ')} |`);
      printable.splice(1, 0, `| ${Array(rows[0].cells.length).fill('---').join(' | ')} |`);
      return `\n\n${printable.join('\n')}\n\n`;
    },
  });
  const markdown = converter.turndown(clean).trim();
  // Turndown can preserve literal angle brackets from text nodes outside the
  // table. Fall back rather than offering alternative text that can become HTML.
  return markdown && !/[<>]/.test(markdown) && isLiteralMarkdownTable(markdown) ? markdown : null;
}
