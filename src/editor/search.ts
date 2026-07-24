import type { Crepe } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from 'prosemirror-state';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { i18n } from '../i18n';

interface SearchOptions {
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}

interface SearchMatch {
  from: number;
  to: number;
  groups: string[];
}

interface SearchState extends SearchOptions {
  query: string;
  currentIndex: number;
}

const DEFAULT_STATE: SearchState = {
  query: '',
  currentIndex: -1,
  regex: false,
  caseSensitive: false,
  wholeWord: false,
};

export const searchPluginKey = new PluginKey<SearchState>('search');

export function createSearchPlugin(): Plugin {
  return new Plugin({
    key: searchPluginKey,
    state: {
      init() {
        return { ...DEFAULT_STATE };
      },
      apply(tr, prev) {
        const meta = tr.getMeta(searchPluginKey);
        if (meta) return meta;
        return prev;
      },
    },
    props: {
      decorations(state) {
        const s = searchPluginKey.getState(state) ?? DEFAULT_STATE;
        if (!s.query) return DecorationSet.empty;

        const matches = findMatches(state.doc, s.query, s);
        const decos: Decoration[] = [];
        matches.forEach((m, i) => {
          const cls = i === s.currentIndex ? 'search-highlight-current' : 'search-highlight';
          decos.push(Decoration.inline(m.from, m.to, { class: cls }));
        });
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build the RegExp used for both highlighting and match collection. Plain-text
 *  (non-regex) queries are escaped so they match literally. Returns null for an
 *  empty query or an invalid user-supplied pattern. */
function buildSearchRegExp(query: string, opts: SearchOptions): RegExp | null {
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

function findMatches(doc: any, query: string, opts: SearchOptions): SearchMatch[] {
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

/** Expand `$1`..`$99`, `$&` (whole match) and `$$` in a replacement string
 *  using the capture groups of a regex match. */
function expandReplacement(template: string, groups: string[]): string {
  return template.replace(/\$(\$|&|\d{1,2})/g, (_, token: string) => {
    if (token === '$') return '$';
    if (token === '&') return groups[0] ?? '';
    return groups[Number(token)] ?? '';
  });
}

export class SearchBar {
  private el: HTMLElement;
  private searchInput!: HTMLInputElement;
  private replaceInput!: HTMLInputElement;
  private replaceRow!: HTMLElement;
  private matchCountEl!: HTMLSpanElement;
  private crepe: Crepe | null = null;
  private matches: SearchMatch[] = [];
  private currentIndex = -1;
  private visible = false;
  private showReplace = false;
  private regexMode = false;
  private caseSensitive = false;
  private wholeWord = false;
  private caseBtn!: HTMLButtonElement;
  private wordBtn!: HTMLButtonElement;
  private regexBtn!: HTMLButtonElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'search-bar';
    this.el.style.cssText = `
      display: none;
      position: absolute;
      top: 0;
      right: 0;
      z-index: 50;
      background: var(--bg-elevated, #fff);
      border: 1px solid var(--border-color, #e8e8e8);
      border-radius: 6px;
      box-shadow: var(--shadow-md, 0 2px 8px rgba(0,0,0,0.1));
      padding: 8px 12px;
      flex-direction: column;
      gap: 6px;
      min-width: 320px;
    `;

    // Search row
    const searchRow = document.createElement('div');
    searchRow.style.cssText = 'display: flex; gap: 4px; align-items: center;';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = i18n.t.searchPlaceholder;
    this.searchInput.style.cssText = `
      flex: 1;
      padding: 4px 8px;
      font-size: 13px;
      border: 1px solid var(--border-color, #e8e8e8);
      border-radius: 3px;
      background: var(--bg-primary, #fff);
      color: var(--text-primary, #333);
      outline: none;
    `;
    this.searchInput.addEventListener('input', () => this.onSearchChange());
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) this.prev(); else this.next();
      }
      if (e.key === 'Escape') this.hide();
    });

    this.matchCountEl = document.createElement('span');
    this.matchCountEl.style.cssText = 'font-size: 11px; color: var(--text-muted, #999); white-space: nowrap; min-width: 50px; text-align: center;';

    this.caseBtn = this.createToggleBtn('Aa', i18n.t.searchCaseSensitive, () => {
      this.caseSensitive = !this.caseSensitive;
      this.syncToggleButtons();
      this.onSearchChange();
    });
    this.wordBtn = this.createToggleBtn('ab', i18n.t.searchWholeWord, () => {
      this.wholeWord = !this.wholeWord;
      this.syncToggleButtons();
      this.onSearchChange();
    });
    this.wordBtn.style.textDecoration = 'underline';
    this.regexBtn = this.createToggleBtn('.*', i18n.t.searchRegex, () => {
      this.regexMode = !this.regexMode;
      this.syncToggleButtons();
      this.onSearchChange();
    });

    const prevBtn = this.createBtn('\u2191', () => this.prev());
    const nextBtn = this.createBtn('\u2193', () => this.next());
    const closeBtn = this.createBtn('\u2715', () => this.hide());

    searchRow.appendChild(this.searchInput);
    searchRow.appendChild(this.caseBtn);
    searchRow.appendChild(this.wordBtn);
    searchRow.appendChild(this.regexBtn);
    searchRow.appendChild(this.matchCountEl);
    searchRow.appendChild(prevBtn);
    searchRow.appendChild(nextBtn);
    searchRow.appendChild(closeBtn);
    this.syncToggleButtons();

    // Replace row
    this.replaceRow = document.createElement('div');
    this.replaceRow.style.cssText = 'display: none; gap: 4px; align-items: center;';

    this.replaceInput = document.createElement('input');
    this.replaceInput.type = 'text';
    this.replaceInput.placeholder = i18n.t.replacePlaceholder;
    this.replaceInput.style.cssText = this.searchInput.style.cssText;
    this.replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.replaceCurrent(); }
      if (e.key === 'Escape') this.hide();
    });

    const replaceBtn = this.createBtn('Replace', () => this.replaceCurrent());
    replaceBtn.style.fontSize = '11px';
    replaceBtn.style.padding = '2px 6px';
    const replaceAllBtn = this.createBtn(i18n.t.replaceAll, () => this.replaceAllMatches());
    replaceAllBtn.style.fontSize = '11px';
    replaceAllBtn.style.padding = '2px 6px';

    this.replaceRow.appendChild(this.replaceInput);
    this.replaceRow.appendChild(replaceBtn);
    this.replaceRow.appendChild(replaceAllBtn);

    this.el.appendChild(searchRow);
    this.el.appendChild(this.replaceRow);

    // Add search highlight styles
    if (!document.getElementById('search-highlight-style')) {
      const style = document.createElement('style');
      style.id = 'search-highlight-style';
      style.textContent = `
        .search-highlight { background: rgba(255, 213, 0, 0.4); border-radius: 2px; }
        .search-highlight-current { background: rgba(255, 150, 0, 0.6); border-radius: 2px; }
      `;
      document.head.appendChild(style);
    }

    // Keep the bar pinned to the top-right of the editor viewport. #editor-root
    // is the scroll container, so an absolutely positioned child would scroll
    // away with the content. A zero-height `position: sticky` wrapper stays
    // fixed at the top while the document scrolls beneath it, and the bar
    // floats out of it as an overlay without shifting the content.
    parent.style.position = 'relative';
    const sticky = document.createElement('div');
    sticky.style.cssText = `
      position: sticky;
      top: 0;
      left: 0;
      height: 0;
      z-index: 50;
      overflow: visible;
    `;
    sticky.appendChild(this.el);
    parent.insertBefore(sticky, parent.firstChild);
  }

  setEditor(crepe: Crepe): void {
    this.crepe = crepe;
  }

  show(withReplace = false): void {
    this.visible = true;
    this.showReplace = withReplace;
    this.el.style.display = 'flex';
    this.replaceRow.style.display = withReplace ? 'flex' : 'none';
    this.searchInput.focus();
    this.searchInput.select();
  }

  hide(): void {
    this.visible = false;
    this.el.style.display = 'none';
    this.clearHighlights();
    this.matches = [];
    this.currentIndex = -1;
    this.matchCountEl.textContent = '';
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private get searchOptions(): SearchOptions {
    return { regex: this.regexMode, caseSensitive: this.caseSensitive, wholeWord: this.wholeWord };
  }

  private setInvalidRegex(invalid: boolean): void {
    this.searchInput.style.borderColor = invalid ? '#e5484d' : 'var(--border-color, #e8e8e8)';
  }

  private onSearchChange(): void {
    const query = this.searchInput.value;
    if (!this.crepe || !query) {
      this.setInvalidRegex(false);
      this.clearHighlights();
      this.matches = [];
      this.currentIndex = -1;
      this.matchCountEl.textContent = '';
      return;
    }

    // Invalid regex → flag the input instead of silently reporting no matches.
    if (this.regexMode && !buildSearchRegExp(query, this.searchOptions)) {
      this.setInvalidRegex(true);
      this.clearHighlights();
      this.matches = [];
      this.currentIndex = -1;
      this.matchCountEl.textContent = i18n.t.noMatches;
      return;
    }
    this.setInvalidRegex(false);

    this.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      this.matches = findMatches(view.state.doc, query, this.searchOptions);
      this.currentIndex = this.matches.length > 0 ? 0 : -1;
      this.updateDecorations();
      this.updateMatchCount();
      if (this.currentIndex >= 0) {
        this.scrollToCurrent();
      }
    });
  }

  private next(): void {
    if (this.matches.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.matches.length;
    this.updateDecorations();
    this.updateMatchCount();
    this.scrollToCurrent();
  }

  private prev(): void {
    if (this.matches.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.matches.length) % this.matches.length;
    this.updateDecorations();
    this.updateMatchCount();
    this.scrollToCurrent();
  }

  private replaceCurrent(): void {
    if (!this.crepe || this.currentIndex < 0 || this.currentIndex >= this.matches.length) return;
    const match = this.matches[this.currentIndex];
    const replacement = this.regexMode
      ? expandReplacement(this.replaceInput.value, match.groups)
      : this.replaceInput.value;

    this.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const tr = view.state.tr.replaceWith(
        match.from, match.to,
        replacement ? view.state.schema.text(replacement) : (view.state.schema as any).topNodeType.createAndFill()!.content
      );
      view.dispatch(tr);
    });

    // Re-search
    this.onSearchChange();
  }

  private replaceAllMatches(): void {
    if (!this.crepe || this.matches.length === 0) return;
    const rawReplacement = this.replaceInput.value;

    this.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      // Replace in reverse order to preserve positions
      let tr = view.state.tr;
      for (let i = this.matches.length - 1; i >= 0; i--) {
        const m = this.matches[i];
        const replacement = this.regexMode ? expandReplacement(rawReplacement, m.groups) : rawReplacement;
        if (replacement) {
          tr = tr.replaceWith(m.from, m.to, view.state.schema.text(replacement));
        } else {
          tr = tr.delete(m.from, m.to);
        }
      }
      view.dispatch(tr);
    });

    this.onSearchChange();
  }

  private updateDecorations(): void {
    if (!this.crepe) return;
    this.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const tr = view.state.tr.setMeta(searchPluginKey, {
        query: this.searchInput.value,
        currentIndex: this.currentIndex,
        regex: this.regexMode,
        caseSensitive: this.caseSensitive,
        wholeWord: this.wholeWord,
      });
      view.dispatch(tr);
    });
  }

  private clearHighlights(): void {
    if (!this.crepe) return;
    try {
      this.crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const tr = view.state.tr.setMeta(searchPluginKey, { ...DEFAULT_STATE });
        view.dispatch(tr);
      });
    } catch { /* editor not ready */ }
  }

  private scrollToCurrent(): void {
    if (!this.crepe || this.currentIndex < 0) return;
    const match = this.matches[this.currentIndex];
    this.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, match.from, match.to));
      view.dispatch(tr.scrollIntoView());
      // Scroll outer container
      setTimeout(() => {
        const domNode = view.domAtPos(match.from);
        const el = domNode.node instanceof HTMLElement ? domNode.node : domNode.node.parentElement;
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 50);
    });
  }

  private updateMatchCount(): void {
    if (this.matches.length === 0) {
      this.matchCountEl.textContent = this.searchInput.value ? i18n.t.noMatches : '';
    } else {
      this.matchCountEl.textContent = `${this.currentIndex + 1} ${i18n.t.matchOf} ${this.matches.length}`;
    }
  }

  private createBtn(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      border: 1px solid var(--border-color, #e8e8e8);
      background: transparent;
      color: var(--text-secondary, #666);
      cursor: pointer;
      font-size: 13px;
      padding: 2px 6px;
      border-radius: 3px;
      line-height: 1;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--sidebar-hover, #e8e8e8)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
    btn.addEventListener('click', onClick);
    return btn;
  }

  private createToggleBtn(text: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.title = title;
    btn.style.cssText = `
      border: 1px solid var(--border-color, #e8e8e8);
      background: transparent;
      color: var(--text-secondary, #666);
      cursor: pointer;
      font-size: 12px;
      font-family: monospace;
      padding: 2px 6px;
      border-radius: 3px;
      line-height: 1;
    `;
    btn.dataset.active = 'false';
    btn.addEventListener('mouseenter', () => {
      if (btn.dataset.active === 'false') btn.style.background = 'var(--sidebar-hover, #e8e8e8)';
    });
    btn.addEventListener('mouseleave', () => {
      if (btn.dataset.active === 'false') btn.style.background = 'transparent';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  private syncToggleButtons(): void {
    const apply = (btn: HTMLButtonElement, on: boolean) => {
      btn.dataset.active = String(on);
      btn.style.background = on ? 'var(--accent-color, #4a9eff)' : 'transparent';
      btn.style.color = on ? '#fff' : 'var(--text-secondary, #666)';
      btn.style.borderColor = on ? 'var(--accent-color, #4a9eff)' : 'var(--border-color, #e8e8e8)';
    };
    apply(this.caseBtn, this.caseSensitive);
    apply(this.wordBtn, this.wholeWord);
    apply(this.regexBtn, this.regexMode);
  }
}
