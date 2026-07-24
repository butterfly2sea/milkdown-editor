import { convertFileSrc } from '@tauri-apps/api/core';
import { editorViewCtx } from '@milkdown/kit/core';
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
