'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ClipboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { IMPORT_CHUNK_THRESHOLD } from '@/lib/import-document';
import { clipboardTableToMarkdown, isLiteralMarkdownTable } from '@/lib/clipboard-table';

interface PasteMarkdownFormProps {
  onCreate: (markdown: string) => Promise<void>;
}

function PasteFields({ onCreate, onCancel }: PasteMarkdownFormProps & { onCancel?: () => void }) {
  const generatedId = useId();
  const id = onCancel ? generatedId : 'welcome-markdown';
  const helpId = onCancel ? `${id}-help` : 'welcome-paste-help';
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const pendingTable = useRef<{ plain: string; markdown: string } | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [tableAlternative, setTableAlternative] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const tooLong = markdown.length > IMPORT_CHUNK_THRESHOLD;
  const blocked = tooLong || !markdown.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || pending.current) return;

    pending.current = true;
    setSaving(true);
    setError(false);
    try {
      await onCreate(markdown);
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (pending.current) return;
    pendingTable.current = null;
    setTableAlternative(null);
    const field = event.currentTarget;
    // Never replace or reinterpret one snippet pasted into a larger draft.
    if (field.selectionStart !== 0 || field.selectionEnd !== field.value.length) return;
    const plain = event.clipboardData.getData('text/plain');
    if (plain.length > IMPORT_CHUNK_THRESHOLD || isLiteralMarkdownTable(plain)) return;
    try {
      const alternative = clipboardTableToMarkdown(event.clipboardData.getData('text/html'), field.ownerDocument);
      if (!alternative || alternative.length > IMPORT_CHUNK_THRESHOLD) return;
      const normalized = plain.replace(/\r\n?/g, '\n');
      if (!normalized) {
        // With HTML-only clipboard data, leave any selected draft intact.
        event.preventDefault();
        setTableAlternative(alternative);
        return;
      }
      // Let the browser perform ordinary text paste, including native Undo.
      pendingTable.current = { plain: normalized, markdown: alternative };
      if (field.value === normalized) setTableAlternative(alternative);
    } catch {
      // Clipboard formatting is optional. The browser's plain paste stays available.
    }
  }

  return (
    <form className="mt-3 flex flex-col gap-3" aria-busy={saving} onSubmit={handleSubmit}>
      <label htmlFor={id} className="text-sm">마크다운 텍스트</label>
      <textarea
        ref={fieldRef}
        id={id}
        aria-describedby={helpId}
        aria-invalid={tooLong || undefined}
        className="w-full min-w-0 resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 font-mono text-base focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        rows={4}
        autoFocus={onCancel !== undefined}
        spellCheck={false}
        placeholder="# 제목"
        value={markdown}
        readOnly={saving}
        onChange={(event) => {
          const value = event.target.value;
          const rich = pendingTable.current;
          pendingTable.current = null;
          setMarkdown(value);
          setTableAlternative((event.nativeEvent as InputEvent).inputType === 'insertFromPaste'
            && rich?.plain === value ? rich.markdown : null);
          setError(false);
        }}
        onPaste={handlePaste}
      />
      <p id={helpId} className="text-xs leading-5 text-[var(--color-text-secondary)]">
        파일 없이 편집을 시작하세요. 문서는 현재 브라우저에 저장됩니다.
      </p>
      {tableAlternative && (
        <Button type="button" variant="secondary" className="w-fit" disabled={saving}
          onClick={() => { setMarkdown(tableAlternative); setTableAlternative(null); setError(false); fieldRef.current?.focus(); }}>
          복사한 표 살리기
        </Button>
      )}
      {tooLong && <p role="alert" className="text-sm text-[var(--color-danger)]">붙여넣을 수 있는 길이를 넘었습니다. .md 파일로 저장한 뒤 마크다운 열기를 사용하세요.</p>}
      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">문서를 저장하지 못했습니다. 입력한 내용은 그대로입니다. 다시 시도해 주세요.</p>}
      <Button type="submit" className="w-fit" loading={saving} disabled={blocked}>
        {saving ? '저장 중…' : '편집 시작'}
      </Button>
      {onCancel && <Button type="button" variant="secondary" disabled={saving} className="w-fit" onClick={onCancel}>취소</Button>}
    </form>
  );
}

export function PasteMarkdownForm(props: PasteMarkdownFormProps) {
  return (
    <details className="mt-5 rounded-xl border border-[var(--color-border)] p-4">
      <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]">
        마크다운 붙여넣기
      </summary>
      <PasteFields {...props} />
    </details>
  );
}

export function PasteMarkdownDialog({ onCreate, onCancel }: PasteMarkdownFormProps & { onCancel: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 text-[var(--color-text)] shadow-xl backdrop:bg-black/45"
      onCancel={(event) => {
        event.preventDefault();
        if (!dialogRef.current?.querySelector('form[aria-busy="true"]')) onCancel();
      }}
    >
      <h2 id={titleId} className="text-lg font-semibold">마크다운 붙여넣기</h2>
      <PasteFields onCreate={onCreate} onCancel={onCancel} />
    </dialog>
  );
}
