import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { EditorState } from '@tiptap/pm/state';
import { history, undo } from '@tiptap/pm/history';

const schema = getSchema([StarterKit, Table, TableRow, TableCell, TableHeader, TaskList, TaskItem]);

test('updated editor schema preserves Korean headings, lists, merged tables and undo', () => {
  const paragraph = text => schema.nodes.paragraph.create(null, schema.text(text));
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.heading.create({ level: 2 }, schema.text('한글 제목')),
    schema.nodes.bulletList.create(null, schema.nodes.listItem.create(null, paragraph('목록'))),
    schema.nodes.table.create(null, schema.nodes.tableRow.create(null, schema.nodes.tableCell.create({ colspan: 2 }, paragraph('병합 표')))),
    schema.nodes.taskList.create(null, schema.nodes.taskItem.create({ checked: true }, paragraph('완료'))),
  ]);
  doc.check();
  assert.deepEqual(schema.nodeFromJSON(doc.toJSON()).toJSON(), doc.toJSON());
  let state = EditorState.create({ schema, doc, plugins: [history()] });
  state = state.apply(state.tr.insertText('수정 ', 1));
  assert.match(state.doc.textContent, /^수정 한글 제목/);
  assert.equal(undo(state, tr => { state = state.apply(tr); }), true);
  assert.deepEqual(state.doc.toJSON(), doc.toJSON());
});

