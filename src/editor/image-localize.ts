import { convertFileSrc } from '@tauri-apps/api/core';
import { editorViewCtx } from '@milkdown/kit/core';
import { Fragment, Slice } from '@milkdown/kit/prose/model';
import { TextSelection, Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Crepe } from '@milkdown/crepe';

// Image localization.
//
// Storage/display split, powered by Crepe's ImageBlock feature:
//   - onUpload (paste / drop): write bytes into `<md-name>.assets/` next to the
//     current file and return a RELATIVE path — that is what serializes to .md.
//   - proxyDomURL (display): resolve a stored relative/absolute path to an
//     absolute one and run it through Tauri's asset protocol so the webview can
//     actually render a local file (a bare `./x.png` will not load otherwise).
// `localizeAllImages` converts already-inserted remote / absolute images the
// same way. Requires a saved file (for the target directory) and the Tauri
// runtime; otherwise images fall back to inline data URLs (no data loss).

const isTauri = (): boolean => '__TAURI_INTERNALS__' in window;

const normalize = (p: string): string => p.replace(/\\/g, '/');
const dirOf = (p: string): string => normalize(p).split('/').slice(0, -1).join('/');
const baseName = (p: string): string => normalize(p).split('/').pop() ?? '';

/** `/path/note.md` -> `note.assets` */
function assetsDirName(mdPath: string): string {
  return baseName(mdPath).replace(/\.(md|markdown)$/i, '') + '.assets';
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/avif': 'avif',
};

function extFor(name: string, mime: string): string {
  const m = name.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
  if (m) return m[1].toLowerCase();
  return MIME_EXT[mime.toLowerCase()] ?? 'png';
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Write bytes into `<md>.assets/` and return the path relative to the md file. */
async function saveToAssets(mdPath: string, bytes: Uint8Array, ext: string): Promise<string> {
  const { mkdir, writeFile, exists } = await import('@tauri-apps/plugin-fs');
  const dirName = assetsDirName(mdPath);
  const dir = `${dirOf(mdPath)}/${dirName}`;
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const fileName = `img-${unique}.${ext}`;
  await writeFile(`${dir}/${fileName}`, bytes);
  return `${dirName}/${fileName}`;
}

const isAbsolute = (p: string): boolean => /^([a-zA-Z]:[\\/]|\/)/.test(p);

function insertImageBlocks(view: EditorView, sources: string[], pos?: number): boolean {
  const imageType = view.state.schema.nodes['image-block'];
  if (!imageType || sources.length === 0) return false;

  const nodes = sources.map((src) => imageType.create({ src, caption: '', ratio: 1 }));
  let tr = view.state.tr;
  if (pos !== undefined) {
    const safePos = Math.min(Math.max(pos, 0), tr.doc.content.size);
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(safePos)));
  }
  tr = tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0));
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** Config for Crepe's ImageBlock feature. */
export function buildImageBlockConfig(getPath: () => string | null) {
  const onUpload = async (file: File): Promise<string> => {
    const mdPath = getPath();
    if (!isTauri() || !mdPath) {
      // Unsaved file or web build: keep the image inline as a data URL so
      // nothing is lost; localizeAllImages can convert it once the file is saved.
      return fileToDataUrl(file);
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return await saveToAssets(mdPath, bytes, extFor(file.name, file.type));
    } catch (err) {
      console.error('[image] save failed, falling back to data URL:', err);
      return fileToDataUrl(file);
    }
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
): Promise<number> {
  const mdPath = getPath();
  if (!isTauri() || !mdPath) throw new Error('localize-unavailable');
  const { readFile } = await import('@tauri-apps/plugin-fs');

  const sources: string[] = [];
  for (const abs of absPaths) {
    try {
      const bytes = await readFile(abs);
      sources.push(await saveToAssets(mdPath, bytes, extFor(baseName(abs), '')));
    } catch (err) {
      console.error('[image] drop insert failed for', abs, err);
    }
  }

  if (sources.length) {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const at = clientCoords ? view.posAtCoords(clientCoords)?.pos : undefined;
      insertImageBlocks(view, sources, at);
    });
  }
  return sources.length;
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

async function fileToSrc(file: File, getPath: () => string | null): Promise<string> {
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
  files: File[],
  pos?: number,
): Promise<void> {
  const sources = await Promise.all(files.map((file) => fileToSrc(file, getPath)));
  insertImageBlocks(view, sources, pos);
}

/** Capture pasted / dropped image data and localize it (Crepe doesn't). */
export function createImagePasteDropPlugin(getPath: () => string | null): Plugin {
  return new Plugin({
    key: new PluginKey('imagePasteDropLocalize'),
    props: {
      handlePaste: (view, event) => {
        const files = imageFilesFrom(event.clipboardData);
        if (!files.length) return false;
        event.preventDefault();
        void insertImageFiles(view, getPath, files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = imageFilesFrom(event.dataTransfer);
        if (!files.length) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
        void insertImageFiles(view, getPath, files, at?.pos);
        return true;
      },
    },
  });
}
