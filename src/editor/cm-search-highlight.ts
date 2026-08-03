// Find/replace highlighting for the CodeMirror source editor.
//
// The app's find bar (`search.ts`) owns the query state for both editors, so
// this deliberately does *not* use `@codemirror/search`'s own panel or query —
// it is just a decoration sink the bar pushes match ranges into. The class
// names are the same ones the ProseMirror side uses, so both modes share the
// stylesheet injected by `SearchBar`.

import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

export interface CmMatchRange {
  from: number;
  to: number;
}

export const setSearchMatches = StateEffect.define<{ matches: CmMatchRange[]; current: number }>();

const matchMark = Decoration.mark({ class: 'search-highlight' });
const currentMark = Decoration.mark({ class: 'search-highlight-current' });

export const cmSearchHighlight = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSearchMatches)) {
        const { matches, current } = effect.value;
        return Decoration.set(
          matches.map((m, i) => (i === current ? currentMark : matchMark).range(m.from, m.to)),
          true,
        );
      }
    }
    return tr.docChanged ? decorations.map(tr.changes) : decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});
