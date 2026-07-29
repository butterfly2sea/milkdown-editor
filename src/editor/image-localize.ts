import { convertFileSrc } from '@tauri-apps/api/core';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection, Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Crepe } from '@milkdown/crepe';
import type { ImageStorageMode } from './image-storage';
import {
  baseName,
  bytesToDataUrl,
  dirOf,
  extFor,
  fileToDataUrl,
  isAbsolute,
  isTauri,
  mimeFor,
  saveToAssets,
} from './image-assets';

// Image localization.
//
// Storage/display split, powered by Crepe's ImageBlock feature:
//   - onUpload (paste / drop): encode or write bytes according to the active
//     document mode and return the source that serializes to Markdown.
//   - proxyDomURL (display): resolve a stored relative/absolute path to an
//     absolute one and run it through Tauri's asset protocol so the webview can
//     actually render a local file (a bare `./x.png` will not load otherwise).
// `localizeAllImages` converts already-inserted remote / absolute images the
// same way. Requires a saved file (for the target directory) and the Tauri
// runtime; otherwise images fall back to inline data URLs (no data loss).

/** Config for Crepe's ImageBlock feature. */
export function buildImageBlockConfig(
  getPath: () => string | null,
  getMode: () => ImageStorageMode = () => 'local',
  onUrlUploadRequired: () => void = () => undefined,
) {
  const onUpload = async (file: File): Promise<string> => {
    return fileToSrc(file, getPath, getMode, onUrlUploadRequired);
  };

  const proxyDomURL = (url: string): string => {
    if (!url) return url;
    // Remote / data / already-converted URLs display as-is.
    if (/^(https?:|data:|blob:|asset:)/i.test(url)) return url;
    const mdPath = getPath();
    if (!isTauri() || !mdPath) return url;
    const abs = isAbsolute(url) ? url : `${dirOf(mdPath)}/${url}`;
    return convertFileSrc(abs);
  };

  return { onUpload, blockOnUpload: onUpload, inlineOnUpload: onUpload, proxyDomURL };
}

export interface LocalizeResult {
  converted: number;
  failed: number;
  skipped: number;
}

/** Copy every remote / absolute-path image in the document into `<md>.assets/`
 *  and rewrite its src to a relative path. */
export async function localizeAllImages(
  crepe: Crepe,
  getPath: () => string | null,
): Promise<LocalizeResult> {
  const mdPath = getPath();
  if (!isTauri() || !mdPath) throw new Error('localize-unavailable');

  const targets: { pos: number; src: string; attrs: Record<string, any> }[] = [];
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    view.state.doc.descendants((node, pos) => {
      const src = node.attrs?.src;
      if (typeof src === 'string' && src && /image/i.test(node.type.name)) {
        targets.push({ pos, src, attrs: node.attrs });
      }
    });
  });

  const { readFile } = await import('@tauri-apps/plugin-fs');
  const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');

  const result: LocalizeResult = { converted: 0, failed: 0, skipped: 0 };
  const rewrites: { pos: number; attrs: Record<string, any> }[] = [];

  for (const t of targets) {
    const isRemote = /^https?:/i.test(t.src);
    if (!isRemote && !isAbsolute(t.src)) {
      result.skipped++; // already relative / data / blob
      continue;
    }
    try {
      let bytes: Uint8Array;
      let ext: string;
      if (isRemote) {
        const resp = await tauriFetch(t.src);
        bytes = new Uint8Array(await resp.arrayBuffer());
        ext = extFor(t.src.split('/').pop() ?? '', resp.headers.get('content-type') ?? '');
      } else {
        bytes = await readFile(t.src);
        ext = extFor(baseName(t.src), '');
      }
      const rel = await saveToAssets(mdPath, bytes, ext);
      rewrites.push({ pos: t.pos, attrs: { ...t.attrs, src: rel } });
      result.converted++;
    } catch (err) {
      console.error('[image] localize failed for', t.src, err);
      result.failed++;
    }
  }

  if (rewrites.length) {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      let tr = view.state.tr;
      for (const rw of rewrites) {
        // src changes don't resize the (atom) node, so positions stay valid.
        if (tr.doc.nodeAt(rw.pos)) tr = tr.setNodeMarkup(rw.pos, undefined, rw.attrs);
      }
      if (tr.docChanged) view.dispatch(tr);
    });
  }

  return result;
}

/** Handle OS-level image files dropped onto the window (Tauri intercepts these
 *  before ProseMirror sees them): copy each into `<md>.assets/` and insert an
 *  image node at the drop point (or the current selection). Returns the count. */
export async function dropLocalImages(
  crepe: Crepe,
  getPath: () => string | null,
  absPaths: string[],
  clientCoords?: { left: number; top: number },
  mode: ImageStorageMode = 'local',
): Promise<number> {
  if (mode === 'url') throw new Error('image-upload-required');
  const mdPath = getPath();
  if (!isTauri() || (mode === 'local' && !mdPath)) throw new Error('localize-unavailable');
  const { readFile } = await import('@tauri-apps/plugin-fs');

  let inserted = 0;
  for (const abs of absPaths) {
    try {
      const bytes = await readFile(abs);
      let src: string;
      if (mode === 'base64') {
        src = await bytesToDataUrl(bytes, mimeFor(abs));
      } else {
        if (!mdPath) throw new Error('localize-unavailable');
        src = await saveToAssets(mdPath, bytes, extFor(baseName(abs), ''));
      }
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const imageType = view.state.schema.nodes.image;
        if (!imageType) return;
        let tr = view.state.tr;
        if (clientCoords) {
          const at = view.posAtCoords(clientCoords);
          if (at) tr = tr.setSelection(TextSelection.near(view.state.doc.resolve(at.pos)));
        }
        tr = tr.replaceSelectionWith(imageType.create({ src }), false);
        view.dispatch(tr.scrollIntoView());
      });
      inserted++;
    } catch (err) {
      console.error('[image] drop insert failed for', abs, err);
    }
  }
  return inserted;
}

// -- Paste / in-webview drop of image DATA (Crepe's onUpload only fires from
//    the image component's upload button, so it does not cover pasting a
//    screenshot or dropping an image file into the editor). --

function imageFilesFrom(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const out: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  if (!out.length) {
    for (const f of Array.from(dt.files ?? [])) {
      if (f.type.startsWith('image/')) out.push(f);
    }
  }
  return out;
}

async function fileToSrc(
  file: File,
  getPath: () => string | null,
  getMode: () => ImageStorageMode,
  onUrlUploadRequired: () => void,
): Promise<string> {
  const mode = getMode();
  if (mode === 'base64') return fileToDataUrl(file);
  if (mode === 'url') {
    onUrlUploadRequired();
    throw new Error('image-upload-required');
  }
  const mdPath = getPath();
  if (isTauri() && mdPath) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return await saveToAssets(mdPath, bytes, extFor(file.name, file.type));
    } catch (err) {
      console.error('[image] paste/drop save failed, using data URL:', err);
    }
  }
  return fileToDataUrl(file);
}

async function insertImageFiles(
  view: EditorView,
  getPath: () => string | null,
  getMode: () => ImageStorageMode,
  onUrlUploadRequired: () => void,
  files: File[],
  pos?: number,
): Promise<void> {
  const imageType = view.state.schema.nodes.image;
  if (!imageType) return;
  for (const file of files) {
    const src = await fileToSrc(file, getPath, getMode, onUrlUploadRequired);
    const at = pos ?? view.state.selection.from;
    view.dispatch(view.state.tr.insert(at, imageType.create({ src })).scrollIntoView());
  }
}

/** Capture pasted / dropped image data and localize it (Crepe doesn't). */
export function createImagePasteDropPlugin(
  getPath: () => string | null,
  getMode: () => ImageStorageMode = () => 'local',
  onUrlUploadRequired: () => void = () => undefined,
): Plugin {
  return new Plugin({
    key: new PluginKey('imagePasteDropLocalize'),
    props: {
      handlePaste: (view, event) => {
        const files = imageFilesFrom(event.clipboardData);
        if (!files.length) return false;
        event.preventDefault();
        void insertImageFiles(view, getPath, getMode, onUrlUploadRequired, files)
          .catch((err) => console.warn('[image] paste insert failed:', err));
        return true;
      },
      handleDrop: (view, event) => {
        const files = imageFilesFrom(event.dataTransfer);
        if (!files.length) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
        void insertImageFiles(view, getPath, getMode, onUrlUploadRequired, files, at?.pos)
          .catch((err) => console.warn('[image] drop insert failed:', err));
        return true;
      },
    },
  });
}
