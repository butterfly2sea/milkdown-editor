import { i18n } from '../i18n';
import type { SyncStatus } from '../app/store';

export type ViewMode = 'wysiwyg' | 'source';

export class StatusBar {
  private el: HTMLElement;
  private leftEl: HTMLDivElement;
  private rightEl: HTMLDivElement;
  private wordCountEl: HTMLSpanElement;
  private cursorPosEl: HTMLSpanElement;
  private zoomEl: HTMLSpanElement;
  private themeBtn: HTMLButtonElement;
  private exportBtn: HTMLButtonElement;
  private localizeBtn: HTMLButtonElement;
  private modeBtn: HTMLButtonElement;
  private langBtn: HTMLButtonElement;
  private syncBtn: HTMLButtonElement;
  private _viewMode: ViewMode = 'wysiwyg';
  private _lastWordCount = 0;
  private _lastCharCount = 0;
  private _lastLine = 1;
  private _lastCol = 1;
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  public onThemeToggle?: () => void;
  public onExport?: (format: 'html' | 'pdf') => void;
  public onViewModeToggle?: (mode: ViewMode) => boolean;
  public onSyncClick?: () => void;
  public onLocalizeImages?: () => void;

  constructor(container: HTMLElement) {
    this.el = container;
    this.el.innerHTML = '';

    this.leftEl = document.createElement('div');
    this.leftEl.className = 'statusbar-left';
    this.leftEl.style.cssText = 'display: flex; gap: 12px; align-items: center;';

    this.rightEl = document.createElement('div');
    this.rightEl.className = 'statusbar-right';
    this.rightEl.style.cssText = 'display: flex; gap: 8px; align-items: center;';

    // View mode toggle
    this.modeBtn = document.createElement('button');
    this.modeBtn.className = 'statusbar-btn';
    this.modeBtn.title = i18n.t.sourceMode;
    this.modeBtn.textContent = '</>';
    this.modeBtn.style.cssText = `
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 3px;
      font-family: monospace;
    `;
    this.modeBtn.addEventListener('mouseenter', () => {
      if (this._viewMode !== 'source') this.modeBtn.style.background = 'var(--sidebar-hover)';
    });
    this.modeBtn.addEventListener('mouseleave', () => {
      if (this._viewMode !== 'source') this.modeBtn.style.background = 'transparent';
    });
    this.modeBtn.addEventListener('click', () => {
      const nextMode = this._viewMode === 'wysiwyg' ? 'source' : 'wysiwyg';
      if (this.onViewModeToggle?.(nextMode) === false) return;
      this._viewMode = nextMode;
      this.updateModeButton();
    });

    this.wordCountEl = document.createElement('span');
    this.cursorPosEl = document.createElement('span');
    this.zoomEl = document.createElement('span');

    this.leftEl.appendChild(this.modeBtn);
    this.leftEl.appendChild(this.wordCountEl);
    this.leftEl.appendChild(this.cursorPosEl);
    this.leftEl.appendChild(this.zoomEl);

    // Language button
    this.langBtn = document.createElement('button');
    this.langBtn.className = 'statusbar-btn';
    this.langBtn.title = 'Language';
    this.langBtn.textContent = i18n.lang.toUpperCase();
    this.applyBtnStyles(this.langBtn);
    this.langBtn.addEventListener('click', () => this.showLangMenu());

    // Theme toggle
    this.themeBtn = document.createElement('button');
    this.themeBtn.className = 'statusbar-btn';
    this.themeBtn.title = i18n.t.toggleTheme;
    this.themeBtn.textContent = this.getThemeIcon();
    this.themeBtn.addEventListener('click', () => this.onThemeToggle?.());
    this.applyBtnStyles(this.themeBtn);

    // Localize-images button
    this.localizeBtn = document.createElement('button');
    this.localizeBtn.className = 'statusbar-btn';
    this.localizeBtn.title = i18n.t.localizeImages;
    this.localizeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Z"/></svg>`;
    this.localizeBtn.style.display = 'flex';
    this.localizeBtn.style.alignItems = 'center';
    this.localizeBtn.addEventListener('click', () => this.onLocalizeImages?.());
    this.applyBtnStyles(this.localizeBtn);

    // Export button
    this.exportBtn = document.createElement('button');
    this.exportBtn.className = 'statusbar-btn';
    this.exportBtn.title = i18n.t.export;
    this.exportBtn.textContent = i18n.t.export;
    this.exportBtn.addEventListener('click', () => this.showExportMenu());
    this.applyBtnStyles(this.exportBtn);

    // Sync status button
    this.syncBtn = document.createElement('button');
    this.syncBtn.className = 'statusbar-btn';
    this.syncBtn.title = i18n.t.syncStatusIdle;
    this.syncBtn.textContent = '';
    this.syncBtn.style.cssText = 'display: none;';
    this.applyBtnStyles(this.syncBtn);
    this.syncBtn.addEventListener('click', () => this.onSyncClick?.());

    this.rightEl.appendChild(this.syncBtn);
    this.rightEl.appendChild(this.langBtn);
    this.rightEl.appendChild(this.themeBtn);
    this.rightEl.appendChild(this.localizeBtn);
    this.rightEl.appendChild(this.exportBtn);

    this.el.appendChild(this.leftEl);
    this.el.appendChild(this.rightEl);

    // Update text on language change
    this.refreshTexts();
    i18n.onChange(() => this.refreshTexts());
  }

  get viewMode(): ViewMode {
    return this._viewMode;
  }

  updateWordCount(markdown: string): void {
    const text = StatusBar.stripMarkdown(markdown);
    this._lastWordCount = StatusBar.countWords(text);
    this._lastCharCount = StatusBar.countChars(text);
    this.renderWordCount();
  }

  // Matches CJK ideographs, Japanese kana and Korean syllables — each counts as one "word".
  private static readonly CJK_RE =
    /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯ｦ-ﾟ]/gu;

  /** Strip markdown syntax to an approximate plain-text representation for counting. */
  private static stripMarkdown(md: string): string {
    return md
      .replace(/```[\s\S]*?```/g, ' ')          // fenced code blocks
      .replace(/~~~[\s\S]*?~~~/g, ' ')
      .replace(/`[^`]*`/g, ' ')                  // inline code
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')     // images -> drop
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // links -> keep text
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')  // reference links -> keep text
      .replace(/<[^>]+>/g, ' ')                  // html tags
      .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '') // heading/quote/list markers
      .replace(/[*_~|]/g, ' ');                  // emphasis/strikethrough/table pipes
  }

  /** CJK characters count individually; runs of non-CJK text count as whitespace-separated words. */
  private static countWords(text: string): number {
    const cjk = (text.match(StatusBar.CJK_RE) || []).length;
    const rest = text.replace(StatusBar.CJK_RE, ' ').trim();
    const words = rest ? rest.split(/\s+/).length : 0;
    return cjk + words;
  }

  /** Count characters of the plain text, excluding whitespace. */
  private static countChars(text: string): number {
    return [...text.replace(/\s+/g, '')].length;
  }

  /** Show the current zoom percentage; hidden at 100% to reduce clutter. */
  updateZoom(percent: number): void {
    this.zoomEl.textContent = percent === 100 ? '' : `${percent}%`;
  }

  updateCursorPosition(line: number, col: number): void {
    this._lastLine = line;
    this._lastCol = col;
    this.renderCursorPos();
  }

  updateSyncStatus(status: SyncStatus): void {
    if (status === 'disabled') {
      this.syncBtn.style.display = 'none';
      return;
    }
    this.syncBtn.style.display = '';
    const icons: Record<string, string> = { idle: '\u2601', syncing: '\u21bb', error: '\u2601\u2717' };
    this.syncBtn.textContent = icons[status] || '';
    const titles: Record<string, string> = {
      idle: i18n.t.syncStatusIdle,
      syncing: i18n.t.syncStatusSyncing,
      error: i18n.t.syncStatusError,
    };
    this.syncBtn.title = titles[status] || '';
    this.syncBtn.style.color = status === 'error' ? '#e53e3e' : 'var(--text-secondary)';
  }

  showMessage(message: string, level: 'info' | 'warn' | 'error' = 'info', duration = 3000): void {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
    }

    const colors: Record<typeof level, string> = {
      info: 'var(--text-secondary)',
      warn: '#d69e2e',
      error: '#e53e3e',
    };
    this.wordCountEl.textContent = message;
    this.wordCountEl.style.color = colors[level];
    this.messageTimer = setTimeout(() => {
      this.wordCountEl.style.color = '';
      this.renderWordCount();
      this.messageTimer = null;
    }, duration);
  }

  updateThemeIcon(): void {
    this.themeBtn.textContent = this.getThemeIcon();
  }

  private refreshTexts(): void {
    this.modeBtn.title = i18n.t.sourceMode;
    this.themeBtn.title = i18n.t.toggleTheme;
    this.localizeBtn.title = i18n.t.localizeImages;
    this.exportBtn.textContent = i18n.t.export;
    this.exportBtn.title = i18n.t.export;
    this.langBtn.textContent = i18n.lang.toUpperCase();
    this.renderWordCount();
    this.renderCursorPos();
  }

  private renderWordCount(): void {
    this.wordCountEl.textContent = `${this._lastWordCount} ${i18n.t.words}, ${this._lastCharCount} ${i18n.t.chars}`;
  }

  private renderCursorPos(): void {
    this.cursorPosEl.textContent = `${i18n.t.line} ${this._lastLine}, ${i18n.t.col} ${this._lastCol}`;
  }

  private updateModeButton(): void {
    if (this._viewMode === 'source') {
      this.modeBtn.style.background = 'var(--accent)';
      this.modeBtn.style.color = '#fff';
      this.modeBtn.style.borderColor = 'var(--accent)';
    } else {
      this.modeBtn.style.background = 'transparent';
      this.modeBtn.style.color = 'var(--text-secondary)';
      this.modeBtn.style.borderColor = 'var(--border-color)';
    }
  }

  private getThemeIcon(): string {
    const theme = document.documentElement.getAttribute('data-theme');
    return theme === 'dark' ? '☾' : '☀';
  }

  private showLangMenu(): void {
    document.querySelector('.lang-menu')?.remove();

    const menu = document.createElement('div');
    menu.className = 'lang-menu';
    menu.style.cssText = `
      position: absolute;
      bottom: 32px;
      right: 80px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      box-shadow: var(--shadow-md);
      overflow: hidden;
      z-index: 100;
    `;

    for (const lang of i18n.availableLanguages) {
      const btn = document.createElement('button');
      btn.textContent = lang.label;
      btn.style.cssText = `
        display: block;
        width: 100%;
        padding: 8px 16px;
        border: none;
        background: ${i18n.lang === lang.code ? 'var(--sidebar-hover)' : 'transparent'};
        color: var(--text-primary);
        cursor: pointer;
        font-size: 12px;
        text-align: left;
        white-space: nowrap;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'var(--sidebar-hover)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = i18n.lang === lang.code ? 'var(--sidebar-hover)' : 'transparent';
      });
      btn.addEventListener('click', () => {
        menu.remove();
        i18n.setLang(lang.code);
      });
      menu.appendChild(btn);
    }

    document.body.appendChild(menu);

    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node) && e.target !== this.langBtn) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  private showExportMenu(): void {
    const existing = document.querySelector('.export-menu');
    if (existing) { existing.remove(); return; }

    const menu = document.createElement('div');
    menu.className = 'export-menu';
    menu.style.cssText = `
      position: absolute;
      bottom: 32px;
      right: 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      box-shadow: var(--shadow-md);
      overflow: hidden;
      z-index: 100;
    `;

    const items = [
      { label: i18n.t.exportHTML, format: 'html' as const },
    ];

    for (const item of items) {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      btn.style.cssText = `
        display: block;
        width: 100%;
        padding: 8px 16px;
        border: none;
        background: transparent;
        color: var(--text-primary);
        cursor: pointer;
        font-size: 12px;
        text-align: left;
        white-space: nowrap;
      `;
      btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--sidebar-hover)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
      btn.addEventListener('click', () => { menu.remove(); this.onExport?.(item.format); });
      menu.appendChild(btn);
    }

    document.body.appendChild(menu);
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node) && e.target !== this.exportBtn) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  private applyBtnStyles(btn: HTMLButtonElement): void {
    btn.style.cssText = `
      border: none;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 12px;
      padding: 2px 6px;
      border-radius: 3px;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--sidebar-hover)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
  }
}
