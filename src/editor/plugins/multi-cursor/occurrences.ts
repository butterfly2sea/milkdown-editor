// Alt+J / Shift+Alt+J for the WYSIWYG editor — VS Code's "add selection to
// next/previous occurrence" (Ctrl+D). Matching goes through the same
// `findMatches` the find bar uses, so the two can never disagree.

import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { findMatches, wordRangeAt, type SearchOptions } from '../../text-search';
import { clearExtraRanges, dedupe, extraRanges, setExtraRanges, isEditableRange, type CursorRange } from './state';

/** Occurrence hunting is literal and case-sensitive, matching VS Code's Ctrl+D
 *  rather than the find bar's user-configurable options. */
const MATCH_OPTS: SearchOptions = { regex: false, caseSensitive: true, wholeWord: false };

/**
 * Grow the cursor set by one occurrence of the current selection.
 * `dir` is 1 for the next occurrence, -1 for the previous one.
 */
export function selectOccurrence(view: EditorView, dir: 1 | -1): boolean {
  const { state } = view;
  const sel = state.selection;

  // Nothing selected yet: start from the word under the caret.
  if (sel.empty) return selectWordUnderCursor(view);

  // A selection spanning blocks has no meaningful literal text to hunt for
  // (`textBetween` drops the block boundaries).
  if (!sel.$from.sameParent(sel.$to)) return false;

  const query = state.doc.textBetween(sel.from, sel.to);
  if (!query.trim()) return false;

  const selected = dedupe([{ from: sel.from, to: sel.to }, ...extraRanges(state)]);
  const taken = new Set(selected.map((range) => `${range.from}:${range.to}`));
  const candidates = findMatches(state.doc, query, MATCH_OPTS).filter(
    (match) => !taken.has(`${match.from}:${match.to}`) && isEditableRange(state.doc, match.from, match.to),
  );
  if (candidates.length === 0) return false;

  const target = pickTarget(candidates, selected, dir);
  const tr = state.tr;
  try {
    tr.setSelection(TextSelection.create(tr.doc, target.from, target.to));
  } catch {
    return false;
  }
  // The occurrence just found becomes primary; the previous cursors all stay.
  setExtraRanges(tr, selected);
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** Search forward from the last cursor (or backward from the first), wrapping
 *  around the document like the find bar does. */
function pickTarget(
  candidates: CursorRange[],
  selected: CursorRange[],
  dir: 1 | -1,
): CursorRange {
  if (dir > 0) {
    const after = selected[selected.length - 1].from;
    return candidates.find((match) => match.from > after) ?? candidates[0];
  }
  const before = selected[0].from;
  for (let i = candidates.length - 1; i >= 0; i--) {
    if (candidates[i].from < before) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/** VS Code's first Ctrl+D press: select the word the caret sits in. */
function selectWordUnderCursor(view: EditorView): boolean {
  const { state } = view;
  const $pos = state.selection.$from;
  if (!$pos.parent.isTextblock) return false;

  // A one-character placeholder for inline leaves keeps string offsets aligned
  // with ProseMirror positions.
  const text = $pos.parent.textBetween(0, $pos.parent.content.size, undefined, '￼');
  const word = wordRangeAt(text, $pos.parentOffset);
  if (!word) return false;

  const base = $pos.start();
  const tr = state.tr;
  try {
    tr.setSelection(TextSelection.create(tr.doc, base + word.from, base + word.to));
  } catch {
    return false;
  }
  clearExtraRanges(tr);
  view.dispatch(tr.scrollIntoView());
  return true;
}
