import { editorViewCtx } from '@milkdown/kit/core';
import type { Crepe } from '@milkdown/crepe';
import {
  baseName,
  bytesToDataUrl,
  dirOf,
  extFor,
  isAbsolute,
  isTauri,
  mimeFor,
  saveToAssets,
} from './image-assets';

export type ImageStorageMode = 'base64' | 'local' | 'url';
export type ImageStorageState = ImageStorageMode | 'mixed';

interface ImageTarget {
  pos: number;
  src: string;
  attrs: Record<string, unknown>;
}

interface ImageData {
  bytes: Uint8Array;
  mime: string;
  ext: string;
}

export interface ImageConversionResult {
  converted: number;
  failed: number;
  skipped: number;
  unsupported: number;
}

function classifySource(src: string): ImageStorageMode {
  if (/^data:image\//i.test(src)) return 'base64';
  if (/^https?:/i.test(src)) return 'url';
  return 'local';
}

function collectImages(crepe: Crepe): ImageTarget[] {
  const targets: ImageTarget[] = [];
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    view.state.doc.descendants((node, pos) => {
      const src = node.attrs?.src;
      if (typeof src === 'string' && src && /image/i.test(node.type.name)) {
        targets.push({ pos, src, attrs: { ...node.attrs } });
      }
    });
  });
  return targets;
}

export function detectImageStorageState(crepe: Crepe): ImageStorageState | null {
  const modes = new Set(collectImages(crepe).map((target) => classifySource(target.src)));
  if (modes.size === 0) return null;
  if (modes.size > 1) return 'mixed';
  return modes.values().next().value ?? null;
}

async function fetchRemote(src: string): Promise<Response> {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    return tauriFetch(src);
  }
  return fetch(src);
}

async function readImage(src: string, mdPath: string | null): Promise<ImageData> {
  if (/^data:image\//i.test(src)) {
    const response = await fetch(src);
    const mime = response.headers.get('content-type') ?? 'image/png';
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mime,
      ext: extFor('', mime),
    };
  }

  if (/^https?:/i.test(src)) {
    const response = await fetchRemote(src);
    if (!response.ok) throw new Error(`image-download-${response.status}`);
    const mime = response.headers.get('content-type') ?? mimeFor(src);
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mime,
      ext: extFor(src.split('/').pop() ?? '', mime),
    };
  }

  if (!isTauri() || !mdPath) throw new Error('local-image-unavailable');
  const path = isAbsolute(src) ? src : `${dirOf(mdPath)}/${src}`;
  const { readFile } = await import('@tauri-apps/plugin-fs');
  return {
    bytes: await readFile(path),
    mime: mimeFor(path),
    ext: extFor(baseName(path), ''),
  };
}

async function convertSource(
  src: string,
  target: ImageStorageMode,
  mdPath: string | null,
): Promise<string | null> {
  if (classifySource(src) === target) return null;
  if (target === 'url') throw new Error('image-upload-required');

  const image = await readImage(src, mdPath);
  if (target === 'base64') return bytesToDataUrl(image.bytes, image.mime);
  if (!mdPath || !isTauri()) throw new Error('local-image-unavailable');
  return saveToAssets(mdPath, image.bytes, image.ext);
}

export async function convertImageStorage(
  crepe: Crepe,
  getPath: () => string | null,
  target: ImageStorageMode,
): Promise<ImageConversionResult> {
  const mdPath = getPath();
  const targets = collectImages(crepe);
  const result: ImageConversionResult = {
    converted: 0,
    failed: 0,
    skipped: 0,
    unsupported: 0,
  };
  const rewrites: Array<ImageTarget & { nextSrc: string }> = [];

  for (const image of targets) {
    try {
      const nextSrc = await convertSource(image.src, target, mdPath);
      if (nextSrc === null) {
        result.skipped++;
      } else {
        rewrites.push({ ...image, nextSrc });
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'image-upload-required') {
        result.unsupported++;
      } else {
        console.error('[image] storage conversion failed for', image.src, err);
        result.failed++;
      }
    }
  }

  if (rewrites.length) {
    let applied = 0;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      let tr = view.state.tr;
      for (const rewrite of rewrites) {
        let pos: number | null = rewrite.pos;
        if (tr.doc.nodeAt(pos)?.attrs.src !== rewrite.src) {
          pos = null;
          tr.doc.descendants((node, candidatePos) => {
            if (pos === null && /image/i.test(node.type.name) && node.attrs.src === rewrite.src) {
              pos = candidatePos;
            }
          });
        }
        if (pos === null) continue;
        tr = tr.setNodeMarkup(pos, undefined, {
          ...rewrite.attrs,
          src: rewrite.nextSrc,
        });
        applied++;
      }
      if (tr.docChanged) view.dispatch(tr);
    });
    result.converted = applied;
    result.failed += rewrites.length - applied;
  }

  return result;
}
