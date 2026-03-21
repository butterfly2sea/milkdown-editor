import { $nodeSchema, $inputRule, $remark, $view } from '@milkdown/kit/utils';
import { nodeRule } from '@milkdown/kit/prose';
import { InputRule } from '@milkdown/kit/prose/inputrules';
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

// Inline math: typing $content$ triggers inline math node
export const mathInlineInputRule = $inputRule((ctx) =>
  nodeRule(/(?:\$)([^$]+)(?:\$)$/, mathInlineSchema.type(ctx), {
    getAttr: (match) => ({ value: match[1] ?? '' }),
  })
);

// Block math: typing $$ at start of line then space/enter
export const mathBlockInputRule = $inputRule((ctx) => {
  const type = mathBlockSchema.type(ctx);
  return new InputRule(/^\$\$\s$/, (state, _match, start, end) => {
    return state.tr.replaceRangeWith(start, end, type.create({ value: '' }));
  });
});

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
  mathInlineInputRule,
  mathBlockInputRule,
  mathInlineView,
  mathBlockView,
];
