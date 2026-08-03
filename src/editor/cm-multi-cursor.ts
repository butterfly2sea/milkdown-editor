// Multi-cursor / column-selection support shared by the two CodeMirror
// surfaces in the app: the whole-document source mode (`source-editor.ts`) and
// the code blocks inside the WYSIWYG editor (wired up in `setup.ts`).
//
// Crepe only ships `defaultKeymap + indentWithTab` for its code blocks, so none
// of this is on by default.

import { EditorState, EditorSelection, type Extension } from '@codemirror/state';
import {
  drawSelection,
  rectangularSelection,
  crosshairCursor,
  keymap,
  type Command,
  type KeyBinding,
} from '@codemirror/view';
import { SearchCursor, selectNextOccurrence } from '@codemirror/search';
import { wordRangeAt } from './text-search';

/** Alt+click adds a cursor, Alt+drag / Shift+Alt+drag selects a column. */
export const multiCursorExtensions: Extension[] = [
  EditorState.allowMultipleSelections.of(true),
  drawSelection(),
  rectangularSelection(),
  crosshairCursor(),
];

/** `@codemirror/search` only ships `selectNextOccurrence`. This is its mirror:
 *  it adds the closest occurrence *before* the current selection. */
export const selectPreviousOccurrence: Command = (view) => {
  const { state } = view;
  const main = state.selection.main;

  // Empty selection → select the word under the cursor first, same as
  // selectNextOccurrence does.
  if (main.empty) {
    const line = state.doc.lineAt(main.head);
    const word = wordRangeAt(line.text, main.head - line.from);
    if (!word) return false;
    view.dispatch({
      selection: EditorSelection.single(line.from + word.from, line.from + word.to),
      scrollIntoView: true,
    });
    return true;
  }

  const query = state.sliceDoc(main.from, main.to);
  if (!query || /\n/.test(query)) return false;

  // Scan the whole document and keep the last match that starts before the
  // earliest range we already have; wrap around to the end if there is none.
  const earliest = state.selection.ranges.reduce((min, r) => Math.min(min, r.from), main.from);
  const taken = new Set(state.selection.ranges.map((r) => `${r.from}:${r.to}`));
  let before: { from: number; to: number } | null = null;
  let last: { from: number; to: number } | null = null;

  const cursor = new SearchCursor(state.doc, query);
  while (!cursor.next().done) {
    const { from, to } = cursor.value;
    if (taken.has(`${from}:${to}`)) continue;
    last = { from, to };
    if (from < earliest) before = { from, to };
  }

  const target = before ?? last;
  if (!target) return false;

  view.dispatch({
    selection: EditorSelection.create(
      [...state.selection.ranges, EditorSelection.range(target.from, target.to)],
      state.selection.ranges.length,
    ),
    scrollIntoView: true,
  });
  return true;
};

export const multiCursorKeymap: KeyBinding[] = [
  { key: 'Alt-j', run: selectNextOccurrence, preventDefault: true },
  { key: 'Shift-Alt-j', run: selectPreviousOccurrence, preventDefault: true },
];

/** Everything needed to turn a bare CodeMirror instance into a multi-cursor one. */
export const multiCursorSupport: Extension[] = [
  ...multiCursorExtensions,
  keymap.of(multiCursorKeymap),
];

/** What Crepe's code blocks need on top of what they already have. They are
 *  built on `basicSetup`, which already enables multiple selections, rectangular
 *  selection and the crosshair cursor — only the Alt+J bindings are missing. */
export const codeBlockMultiCursorExtensions: Extension[] = [keymap.of(multiCursorKeymap)];
