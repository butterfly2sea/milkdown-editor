export const MenuEvents = {
  NEW: 'menu-new',
  OPEN: 'menu-open',
  OPEN_FOLDER: 'menu-open-folder',
  SAVE: 'menu-save',
  SAVE_AS: 'menu-save-as',
  EXPORT_HTML: 'menu-export-html',
  UNDO: 'menu-undo',
  REDO: 'menu-redo',
  FIND: 'menu-find',
  FIND_REPLACE: 'menu-find-replace',
  SYNC_FILE: 'menu-sync-file',
  MARK_SYNC: 'menu-mark-sync',
  TOGGLE_SIDEBAR: 'menu-toggle-sidebar',
  TOGGLE_THEME: 'menu-toggle-theme',
  TOGGLE_FULLSCREEN: 'menu-toggle-fullscreen',
  LANG_EN: 'menu-lang-en',
  LANG_ZH: 'menu-lang-zh',
  SETTINGS: 'menu-settings',
  ABOUT: 'menu-about',
} as const;

export type MenuEvent = typeof MenuEvents[keyof typeof MenuEvents];
