import { i18n } from '../i18n';

export class TitleBar {
  private el: HTMLElement;
  private nameEl: HTMLSpanElement;
  private dotEl: HTMLSpanElement;

  constructor(container: HTMLElement) {
    this.el = container;
    this.el.innerHTML = '';

    this.dotEl = document.createElement('span');
    this.dotEl.className = 'titlebar-dot';
    this.dotEl.textContent = '';
    this.dotEl.style.cssText = 'font-size: 13px; color: var(--accent); margin-right: 2px;';

    this.nameEl = document.createElement('span');
    this.nameEl.className = 'titlebar-name';
    this.nameEl.textContent = i18n.t.untitled;
    this.nameEl.style.cssText = 'font-size: 13px; color: var(--text-secondary);';

    this.el.appendChild(this.dotEl);
    this.el.appendChild(this.nameEl);

    // Update on language change
    i18n.onChange(() => {
      if (this.nameEl.textContent === 'Untitled' || this.nameEl.textContent === '未命名') {
        this.nameEl.textContent = i18n.t.untitled;
      }
    });
  }

  setFileName(name: string): void {
    this.nameEl.textContent = name;
    if ('__TAURI_INTERNALS__' in window) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        const isUntitled = name === i18n.t.untitled;
        const title = isUntitled ? 'Milkdown Editor' : `${name} — Milkdown Editor`;
        getCurrentWindow().setTitle(title);
      });
    }
  }

  setUnsaved(dirty: boolean): void {
    this.dotEl.textContent = dirty ? '●' : '';
  }
}
