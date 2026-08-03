// Shared state for the WYSIWYG multi-cursor support.
//
// Design note: ProseMirror renders exactly one native selection, so the
// *primary* cursor stays an ordinary `TextSelection`. Everything the browser
// does well — caret painting, arrow keys, IME composition, accessibility —
// therefore keeps working untouched. Only the *secondary* cursors live here,
// in plugin state, and are painted with decorations. Editing commands replay
// the primary edit onto them inside the same transaction.

import { PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import type { Node as ProseNode } from 'prosemirror-model';

/** A secondary cursor. `from === to` means a bare caret. */
export interface CursorRange {
  from: number;
  to: number;
}

export interface MultiCursorState {
  ranges: readonly CursorRange[];
}

export const multiCursorKey = new PluginKey<MultiCursorState>('milkdown-multi-cursor');

export const EMPTY: MultiCursorState = { ranges: [] };

/** Secondary ranges only — the primary cursor is `state.selection`. */
export function extraRanges(state: EditorState): readonly CursorRange[] {
  return multiCursorKey.getState(state)?.ranges ?? EMPTY.ranges;
}

export function hasMultiCursor(state: EditorState): boolean {
  return extraRanges(state).length > 0;
}

/** Sort into document order and drop exact duplicates. */
export function dedupe(ranges: readonly CursorRange[]): CursorRange[] {
  const seen = new Set<string>();
  const out: CursorRange[] = [];
  for (const range of [...ranges].sort((a, b) => a.from - b.from || a.to - b.to)) {
    const key = `${range.from}:${range.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(range);
  }
  return out;
}

/** Trim overlaps in an ascending, deduped list so that replaying an edit on
 *  every range can never produce steps with crossing positions. A range fully
 *  swallowed by its predecessor collapses to a no-op caret. */
export function clampOverlaps(ranges: CursorRange[]): CursorRange[] {
  let end = -1;
  return ranges.map((range) => {
    const from = Math.max(range.from, end);
    const to = Math.max(range.to, from);
    end = to;
    return { from, to };
  });
}

export function setExtraRanges(tr: Transaction, ranges: readonly CursorRange[]): Transaction {
  return tr.setMeta(multiCursorKey, { ranges });
}

export function clearExtraRanges(tr: Transaction): Transaction {
  return tr.setMeta(multiCursorKey, 'clear');
}

/** True when `[from, to]` is plain editable text inside one textblock.
 *  Code blocks are excluded: they are rendered by a CodeMirror NodeView that
 *  runs its own (native, more precise) multi-cursor implementation. Atoms like
 *  math / mermaid / plantuml are not textblocks, so they fail the first test. */
export function isEditableRange(doc: ProseNode, from: number, to: number): boolean {
  if (from < 0 || to < from || to > doc.content.size) return false;
  const $from = doc.resolve(from);
  if (!$from.parent.isTextblock || $from.parent.type.spec.code) return false;
  return $from.sameParent(doc.resolve(to));
}
