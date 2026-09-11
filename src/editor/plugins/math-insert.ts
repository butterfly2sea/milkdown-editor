/**
 * The "Math Block" / "Inline Math" entries for the slash menu — the same menu
 * the `+` handle in the left margin opens. Crepe ships a math entry of its own
 * but gates it behind `CrepeFeature.Latex`, which this editor turns off (that
 * entry only inserts a `language: LaTex` code block; we have real math nodes).
 */

import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark';
import type { BlockEditFeatureConfig } from '@milkdown/crepe/feature/block-edit';
import { mathBlockSchema, mathInlineSchema, selectMathNode } from './math-plugin';

type MenuBuilder = Parameters<NonNullable<BlockEditFeatureConfig['buildMenu']>>[0];

/** Matches the weight and 24px box of Crepe's own menu icons. */
const mathBlockIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M4 4h16v2h-6.2l-2.3 5.6L16 20h-2.3l-3.1-6.2L7.5 20H5.2l4.1-8.3L6.8 6H4V4z"/></svg>`;

const mathInlineIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8.6 6.5 6.4 11.9l2.2 5.6H6.9l-1.7-4.4-1.7 4.4H2l2.2-5.6L2 6.5h1.5l1.7 4.3 1.7-4.3h1.7zM12 5h9v1.6h-9V5zm0 6.2h9v1.6h-9v-1.6zM12 17.4h9V19h-9v-1.6z"/></svg>`;

/**
 * Replace the slash query with a fresh, empty math node and select it — the
 * node view's `selectNode` then drops the caret straight into MathLive.
 *
 * Clearing the whole block is safe: the slash menu only opens when the block's
 * entire text starts with `/`, and the `+` handle opens it on a blank paragraph.
 */
function insertMathNode(ctx: Ctx, display: 'block' | 'inline'): void {
  ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key);

  const view = ctx.get(editorViewCtx);
  const type = display === 'block' ? mathBlockSchema.type(ctx) : mathInlineSchema.type(ctx);
  const from = view.state.selection.from;
  // `replaceSelectionWith` handles both kinds of atom: the inline one lands at
  // the caret, the block one splits out of the paragraph.
  const tr = view.state.tr.replaceSelectionWith(type.create({ value: '' }));
  selectMathNode(tr, type, tr.mapping.map(from, -1));
  view.dispatch(tr);
  view.focus();
}

/** Labels stay English to match the rest of Crepe's menu — and because the menu
 *  filters on the label, so `/math` finds both entries. */
export function buildMathMenu(builder: MenuBuilder): void {
  const advanced = builder.getGroup('advanced');
  advanced.addItem('math-block', {
    label: 'Math Block',
    icon: mathBlockIcon,
    onRun: (ctx) => insertMathNode(ctx, 'block'),
  });
  advanced.addItem('math-inline', {
    label: 'Inline Math',
    icon: mathInlineIcon,
    onRun: (ctx) => insertMathNode(ctx, 'inline'),
  });
}
