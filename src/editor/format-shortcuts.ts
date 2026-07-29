import { toggleLinkCommand } from '@milkdown/kit/component/link-tooltip';
import { commandsCtx } from '@milkdown/kit/core';
import {
  toggleInlineCodeCommand,
  wrapInHeadingCommand,
} from '@milkdown/kit/preset/commonmark';
import { toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import { $shortcut } from '@milkdown/kit/utils';
import { toggleHighlightCommand } from './plugins/highlight-plugin';

export const formatShortcutPlugin = $shortcut((ctx) => {
  const commands = ctx.get(commandsCtx);
  const headings = Object.fromEntries(
    Array.from({ length: 6 }, (_, index) => {
      const level = index + 1;
      return [`Mod-${level}`, () => commands.call(wrapInHeadingCommand.key, level)];
    }),
  );

  return {
    ...headings,
    'Mod-Shift-h': () => commands.call(toggleHighlightCommand.key),
    'Mod-Shift-x': () => commands.call(toggleStrikethroughCommand.key),
    'Mod-Shift-k': () => commands.call(toggleInlineCodeCommand.key),
    'Mod-k': () => commands.call(toggleLinkCommand.key),
  };
});
