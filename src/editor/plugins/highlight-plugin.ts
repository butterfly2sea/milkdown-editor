import { markRule } from '@milkdown/kit/prose';
import { toggleMark } from '@milkdown/kit/prose/commands';
import { $command, $inputRule, $markSchema, $remark } from '@milkdown/kit/utils';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import { findAndReplace } from 'mdast-util-find-and-replace';

// `==highlight==` single-color mark.
//
// Markdown has no native highlight syntax, so a small remark plugin parses
// `==text==` into a custom mdast `highlight` node and serialises it back to
// `==text==` — the document stays pure Markdown, never HTML. The mark itself is
// a structural clone of the GFM strikethrough mark (openMark/next/closeMark for
// parsing, withMark for serialising). Rendered as `<mark class="highlight">`,
// styled via a single fixed color in editor-overrides.css.

const MDAST_TYPE = 'highlight';
const MARK_ID = 'highlight';

// -- Remark: `==text==` <-> mdast `highlight` node --

export const remarkHighlight = $remark('remarkHighlight', () => {
  return function attach(this: any) {
    const data = this.data();
    const toMarkdownExtensions = data.toMarkdownExtensions || (data.toMarkdownExtensions = []);
    toMarkdownExtensions.push({
      handlers: {
        [MDAST_TYPE]: (node: any, _parent: unknown, state: any, info: any) => {
          const tracker = state.createTracker(info);
          let value = tracker.move('==');
          value += state.containerPhrasing(node, {
            ...tracker.current(),
            before: '=',
            after: '=',
          });
          value += tracker.move('==');
          return value;
        },
      },
    });

    return (tree: any) => {
      findAndReplace(tree, [
        [
          /==(?=\S)([\s\S]*?\S)==/g,
          // `highlight` is a custom (non-standard) mdast node, so cast past the
          // built-in PhrasingContent typing.
          ((_full: string, inner: string) => ({
            type: MDAST_TYPE,
            children: [{ type: 'text', value: inner }],
          })) as any,
        ],
      ]);
    };
  };
});

// -- Mark schema --

export const highlightSchema = $markSchema(MARK_ID, () => ({
  parseDOM: [{ tag: 'mark' }],
  toDOM: () => ['mark', { class: 'highlight' }, 0],
  parseMarkdown: {
    match: (node) => node.type === MDAST_TYPE,
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === MARK_ID,
    runner: (state, mark) => {
      state.withMark(mark, MDAST_TYPE);
    },
  },
}));

// -- Toggle command --

export const toggleHighlightCommand = $command(
  'ToggleHighlight',
  (ctx) => () => toggleMark(highlightSchema.type(ctx)),
);

// -- Input rule: typing ==text== applies the highlight mark --

export const highlightInputRule = $inputRule((ctx) =>
  markRule(/(?<![\w:/])==([^=\n]+?)==(?!=)/, highlightSchema.type(ctx)),
);

export const highlightPlugins: MilkdownPlugin[] = [
  // $remark returns a tuple [optionsCtx, plugin]; spread both.
  ...remarkHighlight,
  highlightSchema.mark,
  highlightSchema.ctx,
  toggleHighlightCommand,
  highlightInputRule,
];
