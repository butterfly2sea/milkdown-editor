import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { editorViewCtx } from '@milkdown/kit/core';
import { replaceAll } from '@milkdown/kit/utils';
import { undo as pmUndo, redo as pmRedo } from 'prosemirror-history';
import { TextSelection } from 'prosemirror-state';
import { mathPlugins } from './plugins/math-plugin';
import { plantumlPlugins } from './plugins/plantuml-plugin';
import { createSearchPlugin } from './search';

export interface EditorInstance {
  crepe: Crepe;
  getMarkdown: () => string;
  setMarkdown: (md: string) => void;
  destroy: () => Promise<void>;
}

export type ChangeCallback = (markdown: string) => void;

export async function createEditor(
  root: HTMLElement,
  defaultValue: string,
  onChange?: ChangeCallback,
): Promise<EditorInstance> {
  const crepe = new Crepe({
    root,
    defaultValue,
    features: {
      [CrepeFeature.Latex]: false,
    },
  });

  crepe.editor
    .config((ctx) => {
      ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
        onChange?.(markdown);
      });
    })
    .use(listener);

  // Add custom plugins
  for (const plugin of [...mathPlugins, ...plantumlPlugins]) {
    crepe.editor.use(plugin);
  }

  // Register search decoration plugin via Milkdown's prose plugin wrapper
  const { $prose } = await import('@milkdown/kit/utils');
  crepe.editor.use($prose(() => createSearchPlugin()));

  await crepe.create();

  const getMarkdown = (): string => {
    return crepe.getMarkdown();
  };

  const setMarkdown = (md: string): void => {
    crepe.editor.action(replaceAll(md));
  };

  const destroy = async (): Promise<void> => {
    await crepe.destroy();
  };

  return { crepe, getMarkdown, setMarkdown, destroy };
}

export interface TocEntry {
  level: number;
  text: string;
  pos: number;
}

export function editorUndo(crepe: Crepe): boolean {
  let result = false;
  try {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      result = pmUndo(view.state, view.dispatch);
    });
  } catch { /* editor not ready */ }
  return result;
}

export function editorRedo(crepe: Crepe): boolean {
  let result = false;
  try {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      result = pmRedo(view.state, view.dispatch);
    });
  } catch { /* editor not ready */ }
  return result;
}

export function getHeadings(crepe: Crepe): TocEntry[] {
  const entries: TocEntry[] = [];
  try {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          entries.push({
            level: node.attrs.level ?? 1,
            text: node.textContent,
            pos,
          });
        }
      });
    });
  } catch { /* editor not ready */ }
  return entries;
}

export function scrollToPos(crepe: Crepe, pos: number): void {
  try {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos)));
      view.dispatch(tr.scrollIntoView());
      view.focus();
    });
  } catch { /* editor not ready */ }
}

export function getCursorInfo(crepe: Crepe): { line: number; col: number } {
  let line = 1;
  let col = 1;
  try {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { from } = view.state.selection;
      const doc = view.state.doc;
      const resolved = doc.resolve(from);
      line = resolved.depth > 0 ? resolved.index(0) + 1 : 1;
      // Calculate column as offset within the current text block
      const parentOffset = from - resolved.start(resolved.depth);
      col = parentOffset + 1;
    });
  } catch {
    // Editor not ready yet
  }
  return { line, col };
}
