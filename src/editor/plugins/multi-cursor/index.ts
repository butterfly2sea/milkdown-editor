// Multi-cursor / column selection for the WYSIWYG (ProseMirror) editor.
//
// Alt+click adds a cursor, Alt+drag (or Shift+Alt+drag) selects a rectangular
// block, and typing / Backspace / Delete / paste are replayed onto every
// cursor in one transaction. Alt+J adds the next occurrence of the selection.
//
// See `state.ts` for why the primary cursor stays a plain `TextSelection`.

import { Plugin, TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import type { Node as ProseNode } from 'prosemirror-model';
import {
  EMPTY,
  clampOverlaps,
  clearExtraRanges,
  dedupe,
  extraRanges,
  hasMultiCursor,
  isEditableRange,
  multiCursorKey,
  setExtraRanges,
  type CursorRange,
  type MultiCursorState,
} from './state';
import { selectOccurrence } from './occurrences';

/** Pointer travel below this (in px) counts as a click, not a drag. */
const DRAG_THRESHOLD = 3;
/** Upper bound on sampled rows, so a stray coordinate cannot spin the loop. */
const MAX_SAMPLED_ROWS = 500;

export function createMultiCursorPlugin(): Plugin<MultiCursorState> {
  return new Plugin<MultiCursorState>({
    key: multiCursorKey,

    state: {
      init: () => EMPTY,
      apply(tr, prev, oldState, newState) {
        const meta = tr.getMeta(multiCursorKey) as MultiCursorState | 'clear' | undefined;
        if (meta === 'clear') return EMPTY;
        if (meta) {
          const ranges = dedupe(meta.ranges).filter((r) => isEditableRange(newState.doc, r.from, r.to));
          return ranges.length ? { ranges } : EMPTY;
        }
        if (prev.ranges.length === 0) return EMPTY;

        // Any selection move we did not author ourselves (a plain click, the
        // arrow keys, another plugin) collapses back to a single cursor —
        // the same escape hatch every editor with multi-cursor has.
        if (tr.selectionSet && !oldState.selection.eq(newState.selection)) return EMPTY;
        if (!tr.docChanged) return prev;

        const ranges = prev.ranges
          .map((range) => mapRange(tr, range))
          .filter((range) => isEditableRange(newState.doc, range.from, range.to));
        return ranges.length ? { ranges: dedupe(ranges) } : EMPTY;
      },
    },

    props: {
      decorations: drawCursors,
      handleKeyDown,
      handleTextInput,
      handlePaste,
      handleDOMEvents: {
        mousedown: handleMouseDown,
        // Composed text only ever reaches the primary cursor, so collapse
        // rather than silently letting the secondaries drift out of sync.
        compositionstart: (view) => {
          if (hasMultiCursor(view.state)) view.dispatch(clearExtraRanges(view.state.tr));
          return false;
        },
      },
    },
  });
}

function mapRange(tr: Transaction, range: CursorRange): CursorRange {
  if (range.from === range.to) {
    const pos = tr.mapping.map(range.from, 1);
    return { from: pos, to: pos };
  }
  const from = tr.mapping.map(range.from, 1);
  const to = tr.mapping.map(range.to, -1);
  return { from, to: Math.max(from, to) };
}

// -- painting ---------------------------------------------------------------

function drawCursors(state: EditorState): DecorationSet | null {
  const ranges = extraRanges(state);
  if (ranges.length === 0) return null;

  const decorations = ranges.map((range) =>
    range.to > range.from
      ? Decoration.inline(range.from, range.to, { class: 'pm-multi-range' })
      : Decoration.widget(range.from, caretWidget, {
          side: -1,
          key: `pm-multi-caret-${range.from}`,
          ignoreSelection: true,
        }),
  );
  return DecorationSet.create(state.doc, decorations);
}

function caretWidget(): HTMLElement {
  const caret = document.createElement('span');
  caret.className = 'pm-multi-caret';
  caret.setAttribute('aria-hidden', 'true');
  return caret;
}

// -- editing ----------------------------------------------------------------

/** Replay `text` (empty string deletes) across every cursor in one
 *  transaction and rebuild the cursor set from the resulting positions. */
function editAll(view: EditorView, primary: CursorRange, text: string): boolean {
  const { state } = view;
  const raw = dedupe([primary, ...extraRanges(state)]);
  if (raw.length < 2) return false;

  const primaryIndex = raw.findIndex((r) => r.from === primary.from && r.to === primary.to);
  if (primaryIndex < 0) return false;

  const targets = clampOverlaps(raw);
  if (targets.some((r) => !isEditableRange(state.doc, r.from, r.to))) return false;

  const tr = state.tr;
  // Descending, so the positions of the not-yet-edited ranges stay valid.
  for (let i = targets.length - 1; i >= 0; i--) {
    const range = targets[i];
    if (text) tr.insertText(text, range.from, range.to);
    else if (range.to > range.from) tr.delete(range.from, range.to);
  }
  if (!tr.docChanged) return false;

  // Mapping the *end* of each range with assoc 1 lands after the inserted
  // text, or at the start of what a deletion removed — the caret either way.
  return commitCursors(view, tr, targets.map((r) => tr.mapping.map(r.to, 1)), primaryIndex);
}

function commitCursors(
  view: EditorView,
  tr: Transaction,
  carets: number[],
  primaryIndex: number,
): boolean {
  const selection = safeTextSelection(tr.doc, carets[primaryIndex]);
  if (!selection) return false;
  tr.setSelection(selection);
  setExtraRanges(
    tr,
    carets.filter((_, i) => i !== primaryIndex).map((pos) => ({ from: pos, to: pos })),
  );
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** Backspace / Delete across every cursor. Empty cursors eat one character in
 *  `dir`; a cursor already at the block edge is left alone rather than joining
 *  blocks, which has no sane multi-cursor meaning. */
function deleteAll(view: EditorView, dir: -1 | 1): boolean {
  const { state } = view;
  const primary: CursorRange = { from: state.selection.from, to: state.selection.to };
  const raw = dedupe([primary, ...extraRanges(state)]);
  if (raw.length < 2) return false;

  const primaryIndex = raw.findIndex((r) => r.from === primary.from && r.to === primary.to);
  if (primaryIndex < 0) return false;

  const targets = clampOverlaps(raw.map((range) => grow(state.doc, range, dir)));
  if (targets.some((r) => !isEditableRange(state.doc, r.from, r.to))) return false;
  if (targets.every((r) => r.to === r.from)) return false;

  const tr = state.tr;
  for (let i = targets.length - 1; i >= 0; i--) {
    const range = targets[i];
    if (range.to > range.from) tr.delete(range.from, range.to);
  }
  if (!tr.docChanged) return false;

  return commitCursors(view, tr, targets.map((r) => tr.mapping.map(r.to, 1)), primaryIndex);
}

function grow(doc: ProseNode, range: CursorRange, dir: -1 | 1): CursorRange {
  if (range.to > range.from) return range;
  const $pos = doc.resolve(range.from);
  if (!$pos.parent.isTextblock) return range;
  if (dir < 0) {
    return $pos.parentOffset > 0 ? { from: range.from - 1, to: range.to } : range;
  }
  return $pos.parentOffset < $pos.parent.content.size ? { from: range.from, to: range.to + 1 } : range;
}

function safeTextSelection(doc: ProseNode, pos: number): TextSelection | null {
  try {
    return TextSelection.create(doc, pos);
  } catch {
    return null;
  }
}

// -- props ------------------------------------------------------------------

function handleTextInput(view: EditorView, from: number, to: number, text: string): boolean {
  if (view.composing || !hasMultiCursor(view.state)) return false;
  return editAll(view, { from, to }, text);
}

function handlePaste(view: EditorView, event: ClipboardEvent): boolean {
  if (!hasMultiCursor(view.state)) return false;
  const text = event.clipboardData?.getData('text/plain');
  if (!text) return false;
  const { selection } = view.state;
  return editAll(view, { from: selection.from, to: selection.to }, text);
}

function handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
  // `event.code` rather than `event.key`: Alt is a dead/compose modifier on
  // several layouts (macOS turns Alt+J into "∆"), but the physical key is stable.
  if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyJ') {
    event.preventDefault();
    return selectOccurrence(view, event.shiftKey ? -1 : 1);
  }

  if (!hasMultiCursor(view.state)) return false;

  switch (event.key) {
    case 'Escape':
      view.dispatch(clearExtraRanges(view.state.tr));
      return true;
    case 'Backspace':
      return deleteAll(view, -1);
    case 'Delete':
      return deleteAll(view, 1);
    case 'Enter':
      // Splitting a block per cursor has no well-defined meaning in rich text
      // (lists, headings, tables all differ), so collapse and let the normal
      // Enter handling run on the primary cursor.
      view.dispatch(clearExtraRanges(view.state.tr));
      return false;
    default:
      return false;
  }
}

// -- pointer ----------------------------------------------------------------

function handleMouseDown(view: EditorView, event: MouseEvent): boolean {
  if (!event.altKey || event.button !== 0) return false;

  const doc = view.dom.ownerDocument;
  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;

  const onMove = (moveEvent: MouseEvent): void => {
    if (
      !dragging &&
      Math.abs(moveEvent.clientX - startX) < DRAG_THRESHOLD &&
      Math.abs(moveEvent.clientY - startY) < DRAG_THRESHOLD
    ) {
      return;
    }
    dragging = true;
    applyColumnSelection(view, startX, startY, moveEvent.clientX, moveEvent.clientY);
  };

  const onUp = (upEvent: MouseEvent): void => {
    doc.removeEventListener('mousemove', onMove, true);
    doc.removeEventListener('mouseup', onUp, true);
    if (!dragging) addCursorAt(view, upEvent.clientX, upEvent.clientY);
  };

  doc.addEventListener('mousemove', onMove, true);
  doc.addEventListener('mouseup', onUp, true);
  event.preventDefault();
  return true;
}

/** Alt+click: toggle a caret at the clicked position. */
function addCursorAt(view: EditorView, x: number, y: number): void {
  const found = view.posAtCoords({ left: x, top: y });
  if (!found) return;

  const { state } = view;
  const pos = found.pos;
  if (!isEditableRange(state.doc, pos, pos)) return;

  const extras = extraRanges(state);
  const existing = extras.findIndex((range) => range.from === pos && range.to === pos);
  if (existing >= 0) {
    view.dispatch(setExtraRanges(state.tr, extras.filter((_, i) => i !== existing)));
    return;
  }

  const { selection } = state;
  if (selection.empty && selection.from === pos) return;

  const tr = state.tr;
  const next = safeTextSelection(state.doc, pos);
  if (!next) return;
  tr.setSelection(next);
  setExtraRanges(tr, dedupe([...extras, { from: selection.from, to: selection.to }]));
  view.dispatch(tr);
  view.focus();
}

/** Alt+drag / Shift+Alt+drag: one range per visual row between the two points.
 *  Rich text has no columns, so rows are sampled at the anchor's line height
 *  and hit-tested with `posAtCoords` — close to a real column selection in
 *  running prose, exact only where the text happens to line up. */
function applyColumnSelection(view: EditorView, x1: number, y1: number, x2: number, y2: number): void {
  const rows = columnRanges(view, x1, y1, x2, y2);
  if (rows.length === 0) return;

  // The row under the pointer stays primary so the native caret tracks the drag.
  const primaryIndex = y2 >= y1 ? rows.length - 1 : 0;
  const primary = rows[primaryIndex];

  const { state } = view;
  const current = dedupe([{ from: state.selection.from, to: state.selection.to }, ...extraRanges(state)]);
  if (sameRanges(current, rows)) return;

  const tr = state.tr;
  let selection: TextSelection;
  try {
    selection = TextSelection.create(state.doc, primary.from, primary.to);
  } catch {
    return;
  }
  tr.setSelection(selection);
  setExtraRanges(tr, rows.filter((_, i) => i !== primaryIndex));
  view.dispatch(tr);
}

function columnRanges(view: EditorView, x1: number, y1: number, x2: number, y2: number): CursorRange[] {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  const step = sampleLineHeight(view, x1, y1);

  const rows: CursorRange[] = [];
  for (let i = 0; i < MAX_SAMPLED_ROWS; i++) {
    const y = Math.min(top + i * step, bottom);
    const start = view.posAtCoords({ left, top: y });
    const end = view.posAtCoords({ left: right, top: y });
    if (start && end) {
      const from = Math.min(start.pos, end.pos);
      const to = Math.max(start.pos, end.pos);
      if (isEditableRange(view.state.doc, from, to)) rows.push({ from, to });
    }
    if (y >= bottom) break;
  }
  return dedupe(rows);
}

function sampleLineHeight(view: EditorView, x: number, y: number): number {
  const found = view.posAtCoords({ left: x, top: y });
  if (found) {
    try {
      const coords = view.coordsAtPos(found.pos);
      const height = coords.bottom - coords.top;
      if (height > 4) return height;
    } catch {
      // Position no longer renderable; fall through to the default.
    }
  }
  return 20;
}

function sameRanges(a: readonly CursorRange[], b: readonly CursorRange[]): boolean {
  return a.length === b.length && a.every((range, i) => range.from === b[i].from && range.to === b[i].to);
}
