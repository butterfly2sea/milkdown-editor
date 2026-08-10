// Ctrl/Cmd+click on a link opens it in the system browser.
//
// Both editors need the same two things: "is this URL safe to hand to the OS?"
// and "where are the links in this line of Markdown?". Source mode has no <a>
// elements to hit-test, so the spans have to be found in the raw text.

/** Only schemes a browser is the right handler for. Anything else — `file:`,
 *  `javascript:` — is left to the editor. */
const OPENABLE = /^(?:https?|mailto):/i;

/** Any scheme at all, used to tell "no scheme, so possibly a bare host" from "a
 *  scheme we deliberately refuse". The lookahead keeps `example.com:8080` out:
 *  a colon followed by digits is a port, not a scheme. */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;

/** A bare host, optionally with port and path — `example.com`,
 *  `www.example.com:8080/a?b=c`. The last label must be letters so that a
 *  version number or a stray decimal does not read as a domain. */
const BARE_HOST = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i;

/** Extensions that mean "a file sitting next to this document". Markdown is
 *  full of `[docs](README.md)` and `[图](img/a.png)`, and without this `md` and
 *  `png` would read as top-level domains. */
const LOCAL_FILE =
  /\.(?:md|markdown|txt|rst|png|jpe?g|gif|svg|webp|bmp|ico|pdf|docx?|xlsx?|pptx?|zip|tar|gz|mp[34]|mov|css|js|jsx|ts|tsx|json|ya?ml|toml|xml|csv|sh|py|rs|go|java|c|cpp|h)$/i;

/** The URL to hand the OS, or null if this link belongs to the editor.
 *
 *  Markdown is routinely written as `[百度](www.baidu.com)` with the scheme
 *  left implicit — a browser's address bar accepts that, so the editor should
 *  too. Relative paths and anchors point inside the document and stay put. */
export function normalizeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (OPENABLE.test(url)) return url;
  if (HAS_SCHEME.test(url)) return null;
  // Relative links (`./a.md`, `/img/x`) and anchors (`#section`).
  if (/^[./#?]/.test(url)) return null;
  if (LOCAL_FILE.test(url.split(/[?#]/, 1)[0])) return null;
  if (!BARE_HOST.test(url)) return null;
  return `https://${url}`;
}

/** Trailing punctuation that almost always belongs to the sentence, not the
 *  URL. A closing paren only counts as punctuation if it is unbalanced, so
 *  `https://en.wikipedia.org/wiki/Foo_(bar)` survives intact. */
const TRAILING = /[.,;:!?'"，。；：！？、）】]+$/;

export interface LinkSpan {
  /** Offsets within the line the span was found in. */
  from: number;
  to: number;
  url: string;
}

export const isModifierClick = (e: MouseEvent): boolean =>
  (e.ctrlKey || e.metaKey) && !e.altKey && e.button === 0;

/** Whether a keyboard/mouse event currently has the "open link" modifier held. */
export const hasModifier = (e: KeyboardEvent | MouseEvent): boolean =>
  (e.ctrlKey || e.metaKey) && !e.altKey;

export function canOpen(url: string): boolean {
  return normalizeUrl(url) !== null;
}

/** Hand the URL to the OS. Falls back to a normal window open outside Tauri,
 *  which is what the dev server in a browser gets.
 *
 *  The Tauri path is tried first without sniffing for `__TAURI_INTERNALS__`:
 *  in a browser `invoke` simply rejects, and that is the only environment
 *  where `window.open` does anything. Inside the WebView it is a no-op, so
 *  failing over to it silently would look exactly like nothing happening —
 *  hence the log. */
export async function openExternalUrl(url: string): Promise<void> {
  // Normalised, not raw: `www.baidu.com` must reach the OS as a real URL.
  const target = normalizeUrl(url);
  if (!target) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_url', { url: target });
    return;
  } catch (err) {
    if ('__TAURI_INTERNALS__' in window) {
      console.error('[link] open_url failed:', err);
    }
  }
  window.open(target, '_blank', 'noopener,noreferrer');
}

/** Strip `<...>` wrappers and trailing sentence punctuation off a raw URL. */
function cleanUrl(raw: string): string {
  let url = raw.trim();
  if (url.startsWith('<') && url.endsWith('>')) url = url.slice(1, -1);
  return url;
}

/** Drop trailing punctuation, keeping parens that the URL itself opened. */
function trimBareUrl(raw: string): string {
  let url = raw;
  for (;;) {
    const trimmed = url.replace(TRAILING, '');
    if (trimmed !== url) {
      url = trimmed;
      continue;
    }
    if (url.endsWith(')')) {
      const opens = (url.match(/\(/g) ?? []).length;
      const closes = (url.match(/\)/g) ?? []).length;
      if (closes > opens) {
        url = url.slice(0, -1);
        continue;
      }
    }
    return url;
  }
}

// `[text](url "title")` / `![alt](url)`. The URL alternative allows one level of
// balanced parens so Wikipedia-style links parse.
const INLINE_LINK = /!?\[[^\]]*\]\(\s*(<[^>]*>|[^\s()]*(?:\([^\s()]*\)[^\s()]*)*)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
// `<https://example.com>`
const AUTOLINK = /<((?:https?|mailto):[^>\s]+)>/g;
// `[label]: https://example.com "title"` — a reference definition.
const REF_DEFINITION = /^[ \t]{0,3}\[[^\]]+\]:[ \t]*(<[^>]+>|\S+)/;
// A URL sitting on its own in the text. CJK and full-width punctuation are
// excluded so `见https://a.com的说明` does not swallow the rest of the sentence.
const BARE_URL = /(?:https?:\/\/|mailto:)[^\s<>[\]{}"'`　-〿一-鿿＀-￯]+/g;

/** Every openable link in one line of Markdown, as offsets into that line.
 *  The span covers the whole construct (`[text](url)`, not just the URL) so
 *  clicking the label works the way it does in an editor's preview. */
export function findLinksInLine(text: string): LinkSpan[] {
  const spans: LinkSpan[] = [];
  const covered: Array<[number, number]> = [];
  const overlaps = (from: number, to: number) =>
    covered.some(([a, b]) => from < b && to > a);

  const add = (from: number, to: number, raw: string) => {
    const url = cleanUrl(raw);
    covered.push([from, to]);
    if (canOpen(url)) spans.push({ from, to, url });
  };

  const ref = REF_DEFINITION.exec(text);
  if (ref) add(ref.index, ref.index + ref[0].length, ref[1]);

  for (const m of text.matchAll(INLINE_LINK)) {
    const from = m.index;
    add(from, from + m[0].length, m[1]);
  }

  for (const m of text.matchAll(AUTOLINK)) {
    const from = m.index;
    if (overlaps(from, from + m[0].length)) continue;
    add(from, from + m[0].length, m[1]);
  }

  for (const m of text.matchAll(BARE_URL)) {
    const url = trimBareUrl(m[0]);
    const from = m.index;
    const to = from + url.length;
    if (overlaps(from, to)) continue;
    add(from, to, url);
  }

  return spans.sort((a, b) => a.from - b.from);
}

/** The link containing `col`, if any. */
export function linkAt(text: string, col: number): LinkSpan | null {
  return findLinksInLine(text).find((s) => col >= s.from && col <= s.to) ?? null;
}
