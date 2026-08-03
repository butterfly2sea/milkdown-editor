import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { editorViewCtx, parserCtx } from '@milkdown/kit/core';
import { undo as pmUndo, redo as pmRedo } from 'prosemirror-history';
import { TextSelection } from 'prosemirror-state';
import { Slice } from 'prosemirror-model';
import { mathPlugins } from './plugins/math-plugin';
import { plantumlPlugins } from './plugins/plantuml-plugin';
import { mermaidPlugins } from './plugins/mermaid-plugin';
import { highlightPlugins } from './plugins/highlight-plugin';
import { createSearchPlugin } from './search';
import { createFrontmatterCard, splitFrontmatter, composeFrontmatter } from './frontmatter';
import { clipboardToolbarConfig, createClipboardContextMenuPlugin } from './toolbar-clipboard';
import { buildImageBlockConfig, createImagePasteDropPlugin } from './image-localize';
import { formatShortcutPlugin } from './format-shortcuts';
import { codeBlockMultiCursorExtensions } from './cm-multi-cursor';
import { createMultiCursorPlugin } from './plugins/multi-cursor';
import type { ImageStorageMode } from './image-storage';

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
  getCurrentFilePath: () => string | null = () => null,
  getImageStorageMode: () => ImageStorageMode = () => 'local',
  onUrlUploadRequired: () => void = () => undefined,
): Promise<EditorInstance> {
  const frontmatter = createFrontmatterCard();
  const { yaml: initYaml, body: initBody } = splitFrontmatter(defaultValue);
  frontmatter.setYaml(initYaml);

  const crepe = new Crepe({
    root,
    defaultValue: initBody,
    features: {
      [CrepeFeature.Latex]: false,
    },
    featureConfigs: {
      [CrepeFeature.Toolbar]: clipboardToolbarConfig,
      [CrepeFeature.ImageBlock]: buildImageBlockConfig(
        getCurrentFilePath,
        getImageStorageMode,
        onUrlUploadRequired,
      ),
      [CrepeFeature.CodeMirror]: { extensions: codeBlockMultiCursorExtensions },
    },
  });

  const compose = () => composeFrontmatter(frontmatter.getYaml(), crepe.getMarkdown());

  crepe.editor
    .config((ctx) => {
      ctx.get(listenerCtx).markdownUpdated(() => {
        onChange?.(compose());
      });
    })
    .use(listener);

  // Add custom plugins
  for (const plugin of [...mathPlugins, ...plantumlPlugins, ...mermaidPlugins, ...highlightPlugins]) {
    crepe.editor.use(plugin);
  }
  crepe.editor.use(formatShortcutPlugin);

  // Register search decoration plugin via Milkdown's prose plugin wrapper
  const { $prose } = await import('@milkdown/kit/utils');
  crepe.editor.use($prose(() => createSearchPlugin()));
  crepe.editor.use($prose(() => createClipboardContextMenuPlugin()));
  crepe.editor.use($prose(() => createImagePasteDropPlugin(
    getCurrentFilePath,
    getImageStorageMode,
    onUrlUploadRequired,
  )));
  // Registered last on purpose: its Backspace/Delete handling must only run
  // after the preset keymaps have declined the key.
  crepe.editor.use($prose(() => createMultiCursorPlugin()));

  await crepe.create();
  frontmatter.mount(root);
  frontmatter.onChange(() => onChange?.(compose()));

  const getMarkdown = (): string => compose();

  const setMarkdown = (md: string): void => {
    const { yaml, body } = splitFrontmatter(md);
    frontmatter.setYaml(yaml);
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const parser = ctx.get(parserCtx);
      const doc = parser(body);
      if (!doc) return;
      const tr = view.state.tr.replace(
        0, view.state.doc.content.size,
        new Slice(doc.content, 0, 0)
      );
      tr.setMeta('addToHistory', false);
      view.dispatch(tr);
    });
  };

  const destroy = async (): Promise<void> => {
    frontmatter.destroy();
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
      const targetPos = Math.min(pos + 1, view.state.doc.content.size);
      const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(targetPos)));
      view.dispatch(tr.scrollIntoView());
      view.focus();
      // Also scroll the outer container
      setTimeout(() => {
        const domNode = view.domAtPos(targetPos);
        const el = domNode.node instanceof HTMLElement ? domNode.node : domNode.node.parentElement;
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 50);
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
