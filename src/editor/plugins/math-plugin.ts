import { $nodeSchema, $inputRule, $remark, $view, $prose } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { NodeSelection, Plugin } from '@milkdown/kit/prose/state';
import type { EditorState, Transaction } from '@milkdown/kit/prose/state';
import type { NodeType } from '@milkdown/kit/prose/model';
import remarkMath from 'remark-math';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import { createMathNodeView } from './math-node-view';

// -- Remark plugin for parsing $...$ and $$...$$ --

export const remarkMathPlugin = $remark('remarkMathPlugin', () => remarkMath);

// -- Inline math node schema --

export const mathInlineId = 'math_inline';

export const mathInlineSchema = $nodeSchema(mathInlineId, () => ({
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,
  attrs: {
    value: { default: '' },
  },
  parseDOM: [
    {
      tag: `span[data-type="${mathInlineId}"]`,
      getAttrs: (dom) => ({
        value: (dom as HTMLElement).dataset.value ?? '',
      }),
    },
  ],
  toDOM: (node) => {
    const span = document.createElement('span');
    span.dataset.type = mathInlineId;
    span.dataset.value = node.attrs.value;
    span.textContent = node.attrs.value || '(math)';
    return span;
  },
  parseMarkdown: {
    match: (node) => node.type === 'inlineMath',
    runner: (state, node, type) => {
      state.addNode(type, { value: node.value as string });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === mathInlineId,
    runner: (state, node) => {
      state.addNode('inlineMath', undefined, node.attrs.value);
    },
  },
}));

// -- Block math node schema --

export const mathBlockId = 'math_block';

export const mathBlockSchema = $nodeSchema(mathBlockId, () => ({
  group: 'block',
  atom: true,
  draggable: true,
  attrs: {
    value: { default: '' },
  },
  parseDOM: [
    {
      tag: `div[data-type="${mathBlockId}"]`,
      getAttrs: (dom) => ({
        value: (dom as HTMLElement).dataset.value ?? '',
      }),
    },
  ],
  toDOM: (node) => {
    const div = document.createElement('div');
    div.dataset.type = mathBlockId;
    div.dataset.value = node.attrs.value;
    div.textContent = node.attrs.value || '(math block)';
    return div;
  },
  parseMarkdown: {
    match: (node) => node.type === 'math',
    runner: (state, node, type) => {
      state.addNode(type, { value: node.value as string });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === mathBlockId,
    runner: (state, node) => {
      state.addNode('math', undefined, node.attrs.value);
    },
  },
}));

// -- Input rules --

/* An input rule's regex only ever sees the text to the *left* of the caret —
 * `prosemirror-inputrules` builds it from the current block's content up to
 * `parentOffset`, plus the character just typed. So a `$` the user parked to
 * the right of the caret is invisible to the pattern, and every rule that wants
 * to close over it has to read the document itself. That is what `charAt` and
 * the `...CursorInputRule` pairs below are for. */

/** The single character at `pos`, or `''` when `pos` is outside the document or
 *  lands on a node boundary rather than text. */
function charAt(state: EditorState, pos: number): string {
  if (pos < 0 || pos >= state.doc.content.size) return '';
  return state.doc.textBetween(pos, pos + 1);
}

/** Point a transaction's selection at the math node that was just written
 *  around `around`. `replaceRangeWith` may shift the node a little (a block
 *  atom typed inside a paragraph gets lifted out of it), so search outwards
 *  instead of trusting the mapped position. */
export function selectMathNode(tr: Transaction, type: NodeType, around: number): void {
  for (let delta = 0; delta <= 3; delta++) {
    const candidates = delta === 0 ? [around] : [around - delta, around + delta];
    for (const pos of candidates) {
      if (pos < 0 || pos > tr.doc.content.size) continue;
      if (tr.doc.nodeAt(pos)?.type === type) {
        tr.setSelection(NodeSelection.create(tr.doc, pos));
        return;
      }
    }
  }
}

/** Replace `[from, to)` with a math node. Selecting it is what makes the node
 *  view drop the caret into MathLive, so it is reserved for formulas the user
 *  is still in the middle of writing — after a formula they have already closed
 *  themselves, the caret stays in the text where their next keystroke belongs. */
function replaceWithMath(
  state: EditorState,
  type: NodeType,
  from: number,
  to: number,
  value: string,
  select = true,
): Transaction {
  const tr = state.tr.replaceRangeWith(from, to, type.create({ value }));
  if (select) selectMathNode(tr, type, tr.mapping.map(from, -1));
  return tr;
}

// Block math, `$$` then a space — an empty formula to fill in.
export const mathBlockInputRule = $inputRule((ctx) => {
  const type = mathBlockSchema.type(ctx);
  return new InputRule(/^\$\$\s$/, (state, _match, start, end) =>
    replaceWithMath(state, type, start, end, '')
  );
});

// Block math typed straight through: `$$x=1$$`.
export const mathBlockPairInputRule = $inputRule((ctx) => {
  const type = mathBlockSchema.type(ctx);
  return new InputRule(/^\$\$([^$\n]+)\$\$$/, (state, match, start, end) => {
    // `^` anchors the *matched text*, which starts 500 characters back in a long
    // paragraph — check the real block offset instead.
    if (state.doc.resolve(start).parentOffset !== 0) return null;
    return replaceWithMath(state, type, start, end, match[1] ?? '');
  });
});

// Block math typed out of order: `$$$$` first, then back into the middle.
export const mathBlockCursorInputRule = $inputRule((ctx) => {
  const type = mathBlockSchema.type(ctx);
  return new InputRule(/^\$\$([^$\n]+)$/, (state, match, start, end) => {
    if (state.doc.resolve(start).parentOffset !== 0) return null;
    if (charAt(state, end) !== '$' || charAt(state, end + 1) !== '$') return null;
    return replaceWithMath(state, type, start, end + 2, match[1] ?? '');
  });
});

// Inline math typed straight through: `$x$`.
export const mathInlineInputRule = $inputRule((ctx) => {
  const type = mathInlineSchema.type(ctx);
  return new InputRule(/\$([^$\n]+)\$$/, (state, match, start, end) => {
    // `$$x$` is the halfway point of typing a block formula. Letting the inline
    // rule fire there is what used to make `$$x=1$$` impossible to type: it ate
    // the trailing `$` and left a stray one behind.
    if (charAt(state, start - 1) === '$') return null;
    // The one rule that does not steal the caret: `见 $x$ 的说明` is written in
    // one pass, and jumping into the formula would swallow the rest of the line.
    return replaceWithMath(state, type, start, end, match[1] ?? '', false);
  });
});

// Inline math typed out of order: `$$` first, then back into the middle.
// Trade-off: this also fires in prose that merely happens to have a `$` sitting
// to the right of the caret (`see $FOO$ below`, edited from the middle). Rare,
// and Backspace right after undoes it like any other input rule.
export const mathInlineCursorInputRule = $inputRule((ctx) => {
  const type = mathInlineSchema.type(ctx);
  return new InputRule(/\$([^$\n]+)$/, (state, match, start, end) => {
    if (charAt(state, start - 1) === '$') return null;
    if (charAt(state, end) !== '$') return null;
    return replaceWithMath(state, type, start, end + 1, match[1] ?? '');
  });
});

// -- Typing into a selected formula --

/* A formula inserted by an input rule is left selected so its node view can
 * take the caret, but MathLive builds its editable interior behind an
 * IntersectionObserver — roughly 60ms during which the selection is still
 * ProseMirror's, and anything typed would *replace* the brand new formula.
 * Feed those characters into the formula instead of destroying it. */
export const mathTypeThrough = $prose(() => new Plugin({
  props: {
    handleTextInput: (view, _from, _to, text) => {
      const { selection } = view.state;
      if (!(selection instanceof NodeSelection)) return false;
      const node = selection.node;
      if (node.type.name !== mathInlineId && node.type.name !== mathBlockId) return false;
      const tr = view.state.tr.setNodeMarkup(selection.from, undefined, {
        ...node.attrs,
        value: `${node.attrs.value ?? ''}${text}`,
      });
      tr.setSelection(NodeSelection.create(tr.doc, selection.from));
      view.dispatch(tr);
      return true;
    },
  },
}));

// -- Node views --

export const mathInlineView = $view(mathInlineSchema.node, () =>
  createMathNodeView('inline')
);

export const mathBlockView = $view(mathBlockSchema.node, () =>
  createMathNodeView('block')
);

// -- Export all plugins as array --

export const mathPlugins: MilkdownPlugin[] = [
  // $remark returns a tuple [optionsCtx, plugin], spread both
  ...remarkMathPlugin,
  mathInlineSchema.node,
  mathInlineSchema.ctx,
  mathBlockSchema.node,
  mathBlockSchema.ctx,
  // Each rule guards itself against the others' shapes, so registration order
  // does not matter.
  mathBlockInputRule,
  mathBlockPairInputRule,
  mathBlockCursorInputRule,
  mathInlineInputRule,
  mathInlineCursorInputRule,
  mathTypeThrough,
  mathInlineView,
  mathBlockView,
];
