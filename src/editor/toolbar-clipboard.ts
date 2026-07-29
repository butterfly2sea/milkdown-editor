import type { Ctx } from '@milkdown/kit/ctx';
import type { ToolbarFeatureConfig } from '@milkdown/crepe/feature/toolbar';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import {
  emphasisSchema,
  isMarkSelectedCommand,
  strongSchema,
  toggleEmphasisCommand,
  toggleStrongCommand,
} from '@milkdown/kit/preset/commonmark';
import {
  strikethroughSchema,
  toggleStrikethroughCommand,
} from '@milkdown/kit/preset/gfm';
import { highlightSchema, toggleHighlightCommand } from './plugins/highlight-plugin';

const boldIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M8.86 18.63a1.52 1.52 0 0 1-1.52-1.52V6.89a1.52 1.52 0 0 1 1.52-1.52h3.34c2.04 0 4 1.27 4 3.52 0 1.5-.72 2.4-1.71 2.85 1.03.35 2.17 1.4 2.17 3.16 0 2.56-1.88 3.73-4.26 3.73H8.86Zm.63-2h2.83c1.58 0 2.16-.87 2.16-1.91 0-1.05-.59-1.92-2.2-1.92H9.49v3.83Zm0-5.75h2.59c1.22 0 1.98-.7 1.98-1.77 0-1.1-.82-1.76-1.95-1.76H9.49v3.53Z" />
</svg>`;

const italicIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M6.3 18.63a.9.9 0 1 1 0-1.81h2.91l3.24-9.64H9.54a.9.9 0 1 1 0-1.81h7.34a.9.9 0 1 1 0 1.81h-2.6l-3.24 9.64h2.6a.9.9 0 1 1 0 1.81H6.3Z" />
</svg>`;

const strikethroughIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M3.25 13.74a.75.75 0 0 1 0-1.5h17.5a.75.75 0 0 1 0 1.5H3.25Zm7.69-3.48V6.63H6.57a1.06 1.06 0 1 1 0-2.13h10.87a1.06 1.06 0 1 1 0 2.13h-4.37v3.63h-2.13Zm0 5.46h2.13v2.72a1.06 1.06 0 1 1-2.13 0v-2.72Z" />
</svg>`;

const copyIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
  <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Z" />
</svg>
`;

const cutIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
  <path d="M760-120 520-360l-80 80 120 120v40H360v-40l120-120-80-80-240 240q-17 17-40.5 17T79-120q-17-17-17-40.5T79-201l240-240-80-80q-20 11-42.5 16T150-500q-75 0-127.5-52.5T-30-680q0-75 52.5-127.5T150-860q75 0 127.5 52.5T330-680q0 24-5 46.5T309-591l171 171 171-171q-11-20-16-42.5t-5-46.5q0-75 52.5-127.5T810-860q75 0 127.5 52.5T990-680q0 75-52.5 127.5T810-500q-24 0-46.5-5T721-521l-80 80 240 240q17 17 17 40.5T881-120q-17 17-40.5 17T800-120h-40ZM150-580q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29Zm660 0q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29Z" />
</svg>
`;

const pasteIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
  <path d="M320-800q0-33 23.5-56.5T400-880h160q33 0 56.5 23.5T640-800h80q33 0 56.5 23.5T800-720v560q0 33-23.5 56.5T720-80H240q-33 0-56.5-23.5T160-160v-560q0-33 23.5-56.5T240-800h80Zm80 80h160v-80H400v80ZM240-160h480v-560h-80v80H320v-80h-80v560Zm120-160h240v-80H360v80Zm0-160h240v-80H360v80Z" />
</svg>
`;

const highlightIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
  <path d="M80 0v-160h800V0H80Zm140-280h44l340-340-44-44-340 340v44Zm-60 60v-128l406-408q11-11 25.5-17t30.5-6q16 0 31 6t26 18l42 44q12 11 17.5 26t5.5 30q0 15-5.5 29.5T765-582L360-176H160Zm586-490-42-44 42 44ZM624-560l-22-22-44-44 66 66Z" />
</svg>
`;

function isHighlightActive(ctx: Ctx): boolean {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const type = highlightSchema.type(ctx);
  const { from, to, empty, $from } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks || $from.marks());
  return state.doc.rangeHasMark(from, to, type);
}

function selectedText(ctx: Ctx): string {
  const view = ctx.get(editorViewCtx);
  const { from, to, empty } = view.state.selection;
  if (empty) return '';
  return view.state.doc.textBetween(from, to, '\n\n');
}

function runNativeCommand(ctx: Ctx, command: 'copy' | 'cut'): boolean {
  const view = ctx.get(editorViewCtx);
  view.focus();
  try {
    return document.execCommand(command);
  } catch {
    return false;
  }
}

async function copySelectedText(ctx: Ctx, deleteAfterCopy: boolean): Promise<void> {
  const view = ctx.get(editorViewCtx);
  const selection = view.state.selection;
  const text = selectedText(ctx);
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    if (deleteAfterCopy && view.state.selection.eq(selection)) {
      view.dispatch(view.state.tr.deleteSelection().scrollIntoView());
    }
  } catch (err) {
    console.warn('[editor] clipboard write failed:', err);
  }
}

function copySelection(ctx: Ctx): void {
  if (runNativeCommand(ctx, 'copy')) return;
  void copySelectedText(ctx, false);
}

function cutSelection(ctx: Ctx): void {
  if (runNativeCommand(ctx, 'cut')) return;
  void copySelectedText(ctx, true);
}

async function pasteIntoView(view: EditorView): Promise<void> {
  view.focus();

  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    view.pasteText(text);
  } catch (err) {
    console.warn('[editor] clipboard read failed:', err);
  }
}

async function pasteSelection(ctx: Ctx): Promise<void> {
  await pasteIntoView(ctx.get(editorViewCtx));
}

export const clipboardToolbarConfig: ToolbarFeatureConfig = {
  buildToolbar: (builder) => {
    const formatting = builder.getGroup('formatting').clear();
    formatting
      .addItem('bold', {
        icon: boldIcon,
        active: (ctx: Ctx) => ctx.get(commandsCtx).call(
          isMarkSelectedCommand.key,
          strongSchema.type(ctx),
        ),
        onRun: (ctx: Ctx) => ctx.get(commandsCtx).call(toggleStrongCommand.key),
      })
      .addItem('italic', {
        icon: italicIcon,
        active: (ctx: Ctx) => ctx.get(commandsCtx).call(
          isMarkSelectedCommand.key,
          emphasisSchema.type(ctx),
        ),
        onRun: (ctx: Ctx) => ctx.get(commandsCtx).call(toggleEmphasisCommand.key),
      })
      .addItem('highlight', {
        icon: highlightIcon,
        active: isHighlightActive,
        onRun: (ctx: Ctx) => ctx.get(commandsCtx).call(toggleHighlightCommand.key),
      })
      .addItem('strikethrough', {
        icon: strikethroughIcon,
        active: (ctx: Ctx) => ctx.get(commandsCtx).call(
          isMarkSelectedCommand.key,
          strikethroughSchema.type(ctx),
        ),
        onRun: (ctx: Ctx) => ctx.get(commandsCtx).call(toggleStrikethroughCommand.key),
      });
    builder
      .addGroup('clipboard', 'Clipboard')
      .addItem('copy', {
        icon: copyIcon,
        active: () => false,
        onRun: copySelection,
      })
      .addItem('cut', {
        icon: cutIcon,
        active: () => false,
        onRun: cutSelection,
      })
      .addItem('paste', {
        icon: pasteIcon,
        active: () => false,
        onRun: (ctx: Ctx) => void pasteSelection(ctx),
      });
  },
};

function removeExistingCursorMenu(): void {
  document.querySelector('.editor-cursor-clipboard-menu')?.remove();
}

function placeMenu(menu: HTMLElement, clientX: number, clientY: number): void {
  const gap = 8;
  const rect = menu.getBoundingClientRect();
  const left = Math.min(clientX, window.innerWidth - rect.width - gap);
  const top = Math.min(clientY, window.innerHeight - rect.height - gap);

  menu.style.left = `${Math.max(gap, left)}px`;
  menu.style.top = `${Math.max(gap, top)}px`;
}

function showCursorPasteMenu(view: EditorView, event: MouseEvent): () => void {
  removeExistingCursorMenu();

  const menu = document.createElement('div');
  menu.className = 'milkdown-toolbar editor-cursor-clipboard-menu';
  menu.style.position = 'fixed';
  menu.style.zIndex = '1000';

  const pasteButton = document.createElement('button');
  pasteButton.type = 'button';
  pasteButton.className = 'toolbar-item';
  pasteButton.ariaLabel = 'Paste';
  pasteButton.title = 'Paste';
  pasteButton.innerHTML = pasteIcon;
  pasteButton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void pasteIntoView(view);
    close();
  });

  menu.appendChild(pasteButton);
  const host = view.dom.closest('.milkdown') ?? document.body;
  host.appendChild(menu);
  placeMenu(menu, event.clientX, event.clientY);

  const close = () => {
    document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('resize', close, true);
    window.removeEventListener('scroll', close, true);
    menu.remove();
  };

  function handleOutsidePointerDown(e: PointerEvent) {
    if (!menu.contains(e.target as Node | null)) close();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  document.addEventListener('pointerdown', handleOutsidePointerDown, true);
  document.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('resize', close, true);
  window.addEventListener('scroll', close, true);

  return close;
}

export function createClipboardContextMenuPlugin(): Plugin {
  let closeCursorMenu: (() => void) | null = null;

  return new Plugin({
    key: new PluginKey('editorClipboardContextMenu'),
    props: {
      handleDOMEvents: {
        contextmenu: (view, event) => {
          closeCursorMenu?.();
          closeCursorMenu = null;

          event.preventDefault();
          event.stopPropagation();

          if (!view.state.selection.empty) return true;

          const pos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (pos) {
            const $pos = view.state.doc.resolve(pos.pos);
            const selection = TextSelection.near($pos);
            view.dispatch(view.state.tr.setSelection(selection));
          }

          closeCursorMenu = showCursorPasteMenu(view, event);
          return true;
        },
      },
    },
    view: () => ({
      destroy: () => {
        closeCursorMenu?.();
        closeCursorMenu = null;
      },
    }),
  });
}
