interface SourceIndentation {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Indent selected lines without replacing their text; a caret inserts two spaces. */
export function indentSource(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  outdent = false,
): SourceIndentation {
  if (!outdent && selectionStart === selectionEnd) {
    return {
      value: value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd),
      selectionStart: selectionStart + 2,
      selectionEnd: selectionEnd + 2,
    };
  }

  const firstLine = value.slice(0, selectionStart).lastIndexOf('\n') + 1;
  // A selection ending at the next line's start does not include that line.
  const lastPosition = selectionEnd > selectionStart ? selectionEnd - 1 : selectionEnd;
  const parts: string[] = [];
  let cursor = 0;
  let start = selectionStart;
  let end = selectionEnd;

  for (let line = firstLine; line <= lastPosition;) {
    const removed = outdent ? (value.slice(line, line + 2).match(/^(?:\t| {1,2})/)?.[0].length ?? 0) : 0;
    const inserted = outdent ? '' : '  ';
    parts.push(value.slice(cursor, line), inserted);
    cursor = line + removed;
    start += (line <= selectionStart ? inserted.length : 0) - Math.min(removed, Math.max(0, selectionStart - line));
    end += inserted.length - Math.min(removed, Math.max(0, selectionEnd - line));

    const newline = value.indexOf('\n', line);
    if (newline === -1) break;
    line = newline + 1;
  }

  parts.push(value.slice(cursor));
  return { value: parts.join(''), selectionStart: start, selectionEnd: end };
}

/** Apply the edit while keeping backwards selections and the viewport intact. */
export function indentSourceTextarea(textarea: HTMLTextAreaElement, outdent = false): boolean {
  const result = indentSource(textarea.value, textarea.selectionStart, textarea.selectionEnd, outdent);
  if (result.value === textarea.value) return false;
  const direction = textarea.selectionDirection;
  const { scrollTop, scrollLeft } = textarea;
  textarea.value = result.value;
  textarea.setSelectionRange(result.selectionStart, result.selectionEnd, direction);
  textarea.scrollTop = scrollTop;
  textarea.scrollLeft = scrollLeft;
  return true;
}
