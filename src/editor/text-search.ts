// Shared text-matching primitives.
//
// Used by both the find/replace bar (`search.ts`) and the multi-cursor
// "select next occurrence" command (`plugins/multi-cursor/occurrences.ts`) so
// the two features can never disagree about what counts as a match.

export interface SearchOptions {
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}

export interface SearchMatch {
  from: number;
  to: number;
  groups: string[];
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build the RegExp used for both highlighting and match collection. Plain-text
 *  (non-regex) queries are escaped so they match literally. Returns null for an
 *  empty query or an invalid user-supplied pattern. */
export function buildSearchRegExp(query: string, opts: SearchOptions): RegExp | null {
  if (!query) return null;
  let pattern = opts.regex ? query : escapeRegExp(query);
  if (opts.wholeWord) pattern = `\\b(?:${pattern})\\b`;
  const flags = 'g' + (opts.caseSensitive ? '' : 'i');
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/** Collect every match of `query` in a ProseMirror document, in document order.
 *  Positions are absolute document positions. */
export function findMatches(doc: any, query: string, opts: SearchOptions): SearchMatch[] {
  const re = buildSearchRegExp(query, opts);
  if (!re) return [];
  const matches: SearchMatch[] = [];
  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    const text = node.text as string;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      // Skip zero-width matches (e.g. `a*`) while keeping lastIndex advancing.
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      matches.push({ from: pos + m.index, to: pos + m.index + m[0].length, groups: m.slice() });
    }
  });
  return matches;
}

/** Same matcher as {@link findMatches}, but over a flat string (the source-mode
 *  CodeMirror document). Offsets are string indices. */
export function findMatchesInText(text: string, query: string, opts: SearchOptions): SearchMatch[] {
  const re = buildSearchRegExp(query, opts);
  if (!re) return [];
  const matches: SearchMatch[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    matches.push({ from: m.index, to: m.index + m[0].length, groups: m.slice() });
  }
  return matches;
}

/** Expand `$1`..`$99`, `$&` (whole match) and `$$` in a replacement string
 *  using the capture groups of a regex match. */
export function expandReplacement(template: string, groups: string[]): string {
  return template.replace(/\$(\$|&|\d{1,2})/g, (_, token: string) => {
    if (token === '$') return '$';
    if (token === '&') return groups[0] ?? '';
    return groups[Number(token)] ?? '';
  });
}

const WORD_RE = /[\p{L}\p{N}_]/u;

/** Expand `[from, to)` to the word boundaries around it within `text`.
 *  Returns null when the position is not inside a word. Mirrors VS Code's
 *  "Ctrl+D on an empty selection selects the word under the cursor". */
export function wordRangeAt(text: string, offset: number): { from: number; to: number } | null {
  let from = offset;
  let to = offset;
  while (from > 0 && WORD_RE.test(text[from - 1])) from--;
  while (to < text.length && WORD_RE.test(text[to])) to++;
  return to > from ? { from, to } : null;
}
