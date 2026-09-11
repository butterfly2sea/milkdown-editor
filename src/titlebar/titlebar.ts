import { i18n } from '../i18n';

const ARROW_LEFT =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M15 5l-7 7 7 7"/></svg>';

const ARROW_RIGHT =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M9 5l7 7-7 7"/></svg>';

export class TitleBar {
  private el: HTMLElement;
  private nameEl: HTMLSpanElement;
  private dotEl: HTMLSpanElement;
  private navEl: HTMLDivElement;
  private backBtn: HTMLButtonElement;
  private forwardBtn: HTMLButtonElement;

  /** Set by the coordinator, which owns the document history. */
  onNavigate?: (direction: 'back' | 'forward') => void;

  constructor(container: HTMLElement) {
    this.el = container;
    this.el.innerHTML = '';

    // Back / forward. Absolutely positioned (see `.titlebar-nav` in
    // global.css) so that adding them leaves the file name centred.
    this.navEl = document.createElement('div');
    this.navEl.className = 'titlebar-nav';
    this.backBtn = this.createNavButton(ARROW_LEFT, 'back');
    this.forwardBtn = this.createNavButton(ARROW_RIGHT, 'forward');
    this.navEl.append(this.backBtn, this.forwardBtn);
    this.setNavState(false, false);

    this.dotEl = document.createElement('span');
    this.dotEl.className = 'titlebar-dot';
    this.dotEl.textContent = '';
    this.dotEl.style.cssText = 'font-size: 13px; color: var(--accent); margin-right: 2px;';

    this.nameEl = document.createElement('span');
    this.nameEl.className = 'titlebar-name';
    this.nameEl.textContent = i18n.t.untitled;
    this.nameEl.style.cssText = 'font-size: 13px; color: var(--text-secondary);';

    this.el.appendChild(this.navEl);
    this.el.appendChild(this.dotEl);
    this.el.appendChild(this.nameEl);

    // Update on language change
    i18n.onChange(() => {
      if (this.nameEl.textContent === 'Untitled' || this.nameEl.textContent === '未命名') {
        this.nameEl.textContent = i18n.t.untitled;
      }
      this.backBtn.title = i18n.t.navBack;
      this.forwardBtn.title = i18n.t.navForward;
    });
  }

  private createNavButton(icon: string, direction: 'back' | 'forward'): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'titlebar-nav-btn';
    button.innerHTML = icon;
    button.title = direction === 'back' ? i18n.t.navBack : i18n.t.navForward;
    button.addEventListener('click', () => this.onNavigate?.(direction));
    return button;
  }

  /** Hidden rather than removed while there is nowhere to go, so the titlebar
   *  never reflows the moment a first navigation becomes possible. */
  setNavState(canGoBack: boolean, canGoForward: boolean): void {
    this.backBtn.disabled = !canGoBack;
    this.forwardBtn.disabled = !canGoForward;
    this.navEl.classList.toggle('hidden', !canGoBack && !canGoForward);
  }

  setFileName(name: string): void {
    this.nameEl.textContent = name;
    if ('__TAURI_INTERNALS__' in window) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        import('@tauri-apps/plugin-os').then(({ platform }) => {
          const isUntitled = name === i18n.t.untitled;
          const title = platform() === 'macos' ? '' : (isUntitled ? 'Milkdown Editor' : `${name} — Milkdown Editor`);
          getCurrentWindow().setTitle(title);
        }).catch(() => {
          const isUntitled = name === i18n.t.untitled;
          getCurrentWindow().setTitle(isUntitled ? 'Milkdown Editor' : `${name} — Milkdown Editor`);
        });
      });
    }
  }

  setUnsaved(dirty: boolean): void {
    this.dotEl.textContent = dirty ? '●' : '';
  }
}
