import { en, locales, type Locale } from './locales';

export type { Locale };

type ChangeListener = (locale: Locale, lang: string) => void;

class I18n {
  private _lang: string = 'en';
  private _locale: Locale = en;
  private listeners: ChangeListener[] = [];

  get lang(): string {
    return this._lang;
  }

  get t(): Locale {
    return this._locale;
  }

  init(): void {
    const saved = localStorage.getItem('lang');
    if (saved && locales[saved]) {
      this.setLang(saved, false);
      return;
    }

    const sysLang = navigator.language.toLowerCase();
    if (sysLang.startsWith('zh')) {
      this.setLang('zh', false);
    } else {
      this.setLang('en', false);
    }
  }

  setLang(lang: string, persist = true): void {
    if (!locales[lang]) return;
    this._lang = lang;
    this._locale = locales[lang];
    if (persist) {
      localStorage.setItem('lang', lang);
    }
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : lang);
    this.syncNativeMenu();
    this.listeners.forEach((fn) => fn(this._locale, lang));
  }

  onChange(fn: ChangeListener): void {
    this.listeners.push(fn);
  }

  get availableLanguages(): { code: string; label: string }[] {
    return [
      { code: 'en', label: 'English' },
      { code: 'zh', label: '中文' },
    ];
  }

  private syncNativeMenu(): void {
    if (!('__TAURI_INTERNALS__' in window)) return;

    import('@tauri-apps/api/core').then(({ invoke }) => {
      console.log('[i18n] syncing native menu to:', this._lang);
      invoke('update_menu', {
        labels: {
          menuFile: this._locale.menuFile,
          menuEdit: this._locale.menuEdit,
          menuView: this._locale.menuView,
          menuHelp: this._locale.menuHelp,
          menuNew: this._locale.menuNew,
          menuOpen: this._locale.menuOpen,
          menuOpenFolder: this._locale.menuOpenFolder,
          menuSave: this._locale.menuSave,
          menuSaveAs: this._locale.menuSaveAs,
          menuExportHtml: this._locale.menuExportHTML,
          menuToggleSidebar: this._locale.menuToggleSidebar,
          menuToggleTheme: this._locale.menuToggleTheme,
          menuToggleFullscreen: this._locale.menuToggleFullscreen,
          menuSettings: this._locale.menuSettings,
          menuAbout: this._locale.menuAbout,
          menuUndo: this._locale.menuUndo,
          menuRedo: this._locale.menuRedo,
          menuFind: this._locale.menuFind,
          menuFindReplace: this._locale.menuFindReplace,
          menuSyncFile: this._locale.menuSyncFile,
          menuMarkSync: this._locale.menuMarkSync,
        },
      }).then(() => {
        console.log('[i18n] native menu updated successfully');
      }).catch((err) => {
        console.error('[i18n] Failed to update native menu:', err);
      });
    });
  }
}

export const i18n = new I18n();
