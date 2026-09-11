// Links that point inside the workspace: `[说明](./other.md)`, `[见上文](#设计)`,
// `[报告](./r.pdf)`.
//
// `link-open.ts` deliberately refuses these — they are not the OS's business —
// but until now nothing picked them up either, so they were simply inert. This
// module is the missing half: work out what a local href names, and resolve it
// against the document that contains it.

import { dirOf, isAbsolute } from './image-assets';
import { isDocLink } from './link-open';

export type DocLinkTarget =
  /** A heading in the document already on screen. */
  | { kind: 'anchor'; anchor: string }
  /** Another Markdown document, optionally at one of its headings. */
  | { kind: 'markdown'; path: string; anchor: string | null }
  /** A PDF, an image, a spreadsheet — something the OS opens. */
  | { kind: 'file'; path: string };

const MARKDOWN_EXT = /\.(?:md|markdown)$/i;

/** A trailing extension of one to eight characters, which is what separates
 *  `report.pdf` from a bare `docs/2026-plan`. */
const HAS_EXT = /\.[A-Za-z0-9]{1,8}$/;

/** Markdown routinely spells non-ASCII paths percent-encoded (`%E4%B8%AD`),
 *  which the filesystem knows nothing about. A malformed escape is left alone
 *  rather than throwing. */
function decode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

/** Collapse `.` and `..` segments.
 *
 *  The OS would resolve them on its own, but the resulting string is also a
 *  document's *identity* here — the file tree highlights by it and the
 *  cross-window registry keys on it — so `a/../b.md` and `b.md` have to come
 *  out as the same path. */
function normalizePath(path: string): string {
  const drive = /^[a-zA-Z]:/.exec(path)?.[0] ?? '';
  const body = path.slice(drive.length);
  const rooted = body.startsWith('/');
  const out: string[] = [];
  for (const segment of body.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop();
      else if (!rooted) out.push('..');
      continue;
    }
    out.push(segment);
  }
  return drive + (rooted ? '/' : '') + out.join('/');
}

/**
 * What a local href names, with any relative path resolved against `docPath`.
 *
 * Returns null when the href is not a local link at all, or when it is relative
 * and `docPath` is null — an unsaved document sits nowhere, so there is nothing
 * for `./` to mean.
 */
export function resolveDocLink(href: string, docPath: string | null): DocLinkTarget | null {
  const url = href.trim();
  if (!isDocLink(url)) return null;

  const hash = url.indexOf('#');
  const anchor = hash === -1 ? null : decode(url.slice(hash + 1)) || null;
  const rawPath = hash === -1 ? url : url.slice(0, hash);
  if (!rawPath) return anchor ? { kind: 'anchor', anchor } : null;

  const relative = decode(rawPath.split('?', 1)[0]);
  if (!relative) return anchor ? { kind: 'anchor', anchor } : null;

  let path: string;
  if (isAbsolute(relative)) {
    path = normalizePath(relative.replace(/\\/g, '/'));
  } else {
    if (!docPath) return null;
    path = normalizePath(`${dirOf(docPath)}/${relative.replace(/\\/g, '/')}`);
  }

  // No extension reads as Markdown too: `[设计](./design)` is a common way to
  // write it, and the opener gives `.md` a try before calling the link broken.
  if (MARKDOWN_EXT.test(path) || !HAS_EXT.test(path)) {
    return { kind: 'markdown', path, anchor };
  }
  return { kind: 'file', path };
}

/** GitHub's heading anchors: lowercased, punctuation dropped, spaces to dashes.
 *  CJK survives — `\p{L}` is not `[a-z]` — which is what makes `#设计目标` work. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

/**
 * Index of the heading `anchor` names among `texts`, or -1.
 *
 * Two spellings are accepted, because both are written in practice: the GitHub
 * slug (`#设计-目标`, what a generated table of contents emits) and the heading
 * text itself (`#设计 目标`, what people type by hand).
 */
export function findHeadingIndex(texts: string[], anchor: string): number {
  const wanted = anchor.replace(/^#/, '').trim();
  if (!wanted) return -1;

  // Repeats are disambiguated with `-1`, `-2` … in document order, so the slugs
  // have to be assigned in one pass before any of them can be compared.
  const seen = new Map<string, number>();
  const slugs = texts.map((text) => {
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  });

  const bySlug = slugs.indexOf(slugify(wanted));
  if (bySlug !== -1) return bySlug;

  const lower = wanted.toLowerCase();
  return texts.findIndex((text) => text.trim().toLowerCase() === lower);
}

type DocLinkHandler = (href: string) => void;

let handler: DocLinkHandler | null = null;

/** Following a link means loading a document, which only the coordinator can
 *  do — but the three places a click is caught (a ProseMirror plugin, a
 *  CodeMirror extension, a document-level listener for the link tooltip) are
 *  all built without access to it. Same module-level hand-off as
 *  `setOnSyncConfigChange` in `settings/settings-modal.ts`. */
export function setDocLinkHandler(fn: DocLinkHandler | null): void {
  handler = fn;
}

export function openDocLink(href: string): void {
  if (!handler) {
    console.warn('[doc-link] no handler registered, ignoring:', href);
    return;
  }
  handler(href);
}
