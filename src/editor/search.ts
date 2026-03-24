import type { Crepe } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from 'prosemirror-state';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { i18n } from '../i18n';

interface SearchMatch {
  from: number;
  to: number;
}

export const searchPluginKey = new PluginKey<{ query: string; currentIndex: number }>('search');

export function createSearchPlugin(): Plugin {
  return new Plugin({
    key: searchPluginKey,
    state: {
      init() {
        return { query: '', currentIndex: -1 };
      },
      apply(tr, prev) {
        const meta = tr.getMeta(searchPluginKey);
        if (meta) return meta;
        return prev;
      },
    },
    props: {
      decorations(state) {
        const { query, currentIndex } = searchPluginKey.getState(state) ?? { query: '', currentIndex: -1 };
        if (!query) return DecorationSet.empty;

        const matches = findMatches(state.doc, query);
        const decos: Decoration[] = [];
        matches.forEach((m, i) => {
          const cls = i === currentIndex ? 'search-highlight-current' : 'search-highlight';
          decos.push(Decoration.inline(m.from, m.to, { class: cls }));
        });
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}

function findMatches(doc: any, query: string): SearchMatch[] {
  if (!query) return [];
  const matches: SearchMatch[] = [];
  const lowerQuery = query.toLowerCase();
  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      const text = node.text!.toLowerCase();
      let index = 0;
      while ((index = text.indexOf(lowerQuery, index)) !== -1) {
        matches.push({ from: pos + index, to: pos + index + query.length });
        index += query.length;
      }
    }
  });
  return matches;
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

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'search-bar';
    this.el.style.cssText = `
      display: none;
      position: absolute;
      top: 0;
      right: 24px;
      z-index: 50;
      background: var(--bg-elevated, #fff);
      border: 1px solid var(--border-color, #e8e8e8);
      border-top: none;
      border-radius: 0 0 6px 6px;
      box-shadow: var(--shadow-md, 0 2px 8px rgba(0,0,0,0.1));
      padding: 8px 12px;
      display: none;
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

    const prevBtn = this.createBtn('\u2191', () => this.prev());
    const nextBtn = this.createBtn('\u2193', () => this.next());
    const closeBtn = this.createBtn('\u2715', () => this.hide());

    searchRow.appendChild(this.searchInput);
    searchRow.appendChild(this.matchCountEl);
    searchRow.appendChild(prevBtn);
    searchRow.appendChild(nextBtn);
    searchRow.appendChild(closeBtn);

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

    parent.style.position = 'relative';
    parent.appendChild(this.el);
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

  private onSearchChange(): void {
    const query = this.searchInput.value;
    if (!this.crepe || !query) {
      this.clearHighlights();
      this.matches = [];
      this.currentIndex = -1;
      this.matchCountEl.textContent = '';
      return;
    }

    this.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      this.matches = findMatches(view.state.doc, query);
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
    const replacement = this.replaceInput.value;

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
    const replacement = this.replaceInput.value;

    this.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      // Replace in reverse order to preserve positions
      let tr = view.state.tr;
      for (let i = this.matches.length - 1; i >= 0; i--) {
        const m = this.matches[i];
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
      });
      view.dispatch(tr);
    });
  }

  private clearHighlights(): void {
    if (!this.crepe) return;
    try {
      this.crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const tr = view.state.tr.setMeta(searchPluginKey, { query: '', currentIndex: -1 });
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
}
