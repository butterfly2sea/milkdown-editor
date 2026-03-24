export interface Locale {
  // Titlebar
  untitled: string;

  // Statusbar
  words: string;
  chars: string;
  line: string;
  col: string;
  toggleTheme: string;
  export: string;
  exportHTML: string;
  exportPDF: string;
  sourceMode: string;

  // File operations
  unsavedWarning: string;
  fileName: string;
  newFile: string;
  newFolder: string;
  createFailed: string;

  // Sidebar
  newFileMenu: string;

  // PlantUML
  plantumlPlaceholder: string;
  plantumlRendering: string;
  plantumlRenderFailed: string;
  plantumlCheckNetwork: string;
  plantumlCopySVG: string;
  plantumlCopyPNG: string;
  plantumlDone: string;

  // Math
  mathPlaceholder: string;
  mathToggleSource: string;

  // Menu (native)
  menuFile: string;
  menuEdit: string;
  menuView: string;
  menuHelp: string;
  menuNew: string;
  menuOpen: string;
  menuOpenFolder: string;
  menuSave: string;
  menuSaveAs: string;
  menuExportHTML: string;
  menuExportPDF: string;
  menuToggleSidebar: string;
  menuToggleTheme: string;
  menuToggleFullscreen: string;

  // Settings
  menuSettings: string;
  settings: string;
  plantumlServerUrl: string;
  plantumlServerUrlPlaceholder: string;
  save: string;
  cancel: string;
  resetDefault: string;

  // File change detection
  fileChangedReload: string;
  fileChangedDiscardReload: string;

  // Edit menu
  menuUndo: string;
  menuRedo: string;
  menuFind: string;
  menuFindReplace: string;

  // Search
  searchPlaceholder: string;
  replacePlaceholder: string;
  noMatches: string;
  matchOf: string;
  replaceAll: string;

  // About
  menuAbout: string;
  aboutTitle: string;
  aboutDescription: string;
  aboutVersion: string;
  aboutBuiltWith: string;
  aboutOk: string;

  // Sidebar tabs
  tabFiles: string;
  tabOutline: string;
  tabRemote: string;
  downloadToLocal: string;
  syncToWebdav: string;
  unsyncFromWebdav: string;
  syncCurrentFile: string;
  chooseLocalPath: string;
  syncStatusSynced: string;
  menuSyncFile: string;
  menuMarkSync: string;

  // WebDAV sync
  webdavSettings: string;
  webdavServerUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavRemotePath: string;
  webdavSyncInterval: string;
  webdavTestConnection: string;
  webdavConnectionSuccess: string;
  webdavConnectionFailed: string;
  webdavSyncEnabled: string;
  webdavConflict: string;
  webdavKeepLocal: string;
  webdavKeepRemote: string;
  webdavKeepBoth: string;
  syncStatusIdle: string;
  syncStatusSyncing: string;
  syncStatusError: string;
  minutes: string;

  // Default content
  welcomeTitle: string;
  welcomeSubtitle: string;
}

export const en: Locale = {
  untitled: 'Untitled',
  words: 'words',
  chars: 'chars',
  line: 'Ln',
  col: 'Col',
  toggleTheme: 'Toggle theme',
  export: 'Export',
  exportHTML: 'Export HTML',
  exportPDF: 'Export PDF',
  sourceMode: 'Source code / WYSIWYG',
  unsavedWarning: 'You have unsaved changes. Discard them?',
  fileName: 'File name:',
  newFile: 'New File',
  newFolder: 'New Folder',
  createFailed: 'Failed to create file',
  newFileMenu: 'New File',
  plantumlPlaceholder: 'Enter PlantUML code to preview',
  plantumlRendering: 'Rendering...',
  plantumlRenderFailed: 'Rendering failed',
  plantumlCheckNetwork: 'Check network or configure PlantUML server',
  plantumlCopySVG: 'Copy as SVG',
  plantumlCopyPNG: 'Copy as PNG',
  plantumlDone: 'Done',
  mathPlaceholder: 'Enter LaTeX...',
  mathToggleSource: 'Toggle LaTeX source',
  menuFile: 'File',
  menuEdit: 'Edit',
  menuView: 'View',
  menuHelp: 'Help',
  menuNew: 'New',
  menuOpen: 'Open...',
  menuOpenFolder: 'Open Folder...',
  menuSave: 'Save',
  menuSaveAs: 'Save As...',
  menuExportHTML: 'Export HTML',
  menuExportPDF: 'Export PDF',
  menuToggleSidebar: 'Toggle Sidebar',
  menuToggleTheme: 'Toggle Theme',
  menuToggleFullscreen: 'Toggle Fullscreen',
  menuSettings: 'Settings...',
  settings: 'Settings',
  plantumlServerUrl: 'PlantUML Server URL',
  plantumlServerUrlPlaceholder: 'https://www.plantuml.com/plantuml',
  save: 'Save',
  cancel: 'Cancel',
  resetDefault: 'Reset to default',
  fileChangedReload: 'File has been changed on disk. Reload?',
  fileChangedDiscardReload: 'File has been changed on disk. You have unsaved changes. Discard and reload?',
  menuUndo: 'Undo',
  menuRedo: 'Redo',
  menuFind: 'Find...',
  menuFindReplace: 'Find and Replace...',
  searchPlaceholder: 'Find...',
  replacePlaceholder: 'Replace...',
  noMatches: 'No matches',
  matchOf: 'of',
  replaceAll: 'Replace All',
  menuAbout: 'About',
  aboutTitle: 'About Milkdown Editor',
  aboutDescription: 'A modern WYSIWYG Markdown editor',
  aboutVersion: 'Version',
  aboutBuiltWith: 'Built with',
  aboutOk: 'OK',
  tabFiles: 'Files',
  tabOutline: 'Outline',
  tabRemote: 'Remote',
  downloadToLocal: 'Download to local',
  syncToWebdav: 'Sync to WebDAV',
  unsyncFromWebdav: 'Unsync',
  syncCurrentFile: 'Sync Current File',
  chooseLocalPath: 'Choose save location',
  syncStatusSynced: 'Synced',
  menuSyncFile: 'Sync Current File',
  menuMarkSync: 'Mark for Sync',
  webdavSettings: 'WebDAV Sync',
  webdavServerUrl: 'Server URL',
  webdavUsername: 'Username',
  webdavPassword: 'Password',
  webdavRemotePath: 'Remote Path',
  webdavSyncInterval: 'Sync Interval',
  webdavTestConnection: 'Test Connection',
  webdavConnectionSuccess: 'Connection successful',
  webdavConnectionFailed: 'Connection failed',
  webdavSyncEnabled: 'Enable Sync',
  webdavConflict: 'Sync Conflict',
  webdavKeepLocal: 'Keep Local',
  webdavKeepRemote: 'Keep Remote',
  webdavKeepBoth: 'Keep Both',
  syncStatusIdle: 'Synced',
  syncStatusSyncing: 'Syncing...',
  syncStatusError: 'Sync error',
  minutes: 'minutes',
  welcomeTitle: 'Welcome to Milkdown Editor',
  welcomeSubtitle: 'Start typing your markdown here...',
};

export const zh: Locale = {
  untitled: '未命名',
  words: '字',
  chars: '字符',
  line: '行',
  col: '列',
  toggleTheme: '切换主题',
  export: '导出',
  exportHTML: '导出 HTML',
  exportPDF: '导出 PDF',
  sourceMode: '源码 / 所见即所得',
  unsavedWarning: '有未保存的更改，是否丢弃？',
  fileName: '文件名：',
  newFile: '新建文件',
  newFolder: '新建文件夹',
  createFailed: '创建文件失败',
  newFileMenu: '新建文件',
  plantumlPlaceholder: '输入 PlantUML 代码以预览',
  plantumlRendering: '渲染中...',
  plantumlRenderFailed: '渲染失败',
  plantumlCheckNetwork: '请检查网络或配置 PlantUML 服务器',
  plantumlCopySVG: '复制为 SVG',
  plantumlCopyPNG: '复制为 PNG',
  plantumlDone: '完成',
  mathPlaceholder: '输入 LaTeX...',
  mathToggleSource: '切换 LaTeX 源码',
  menuFile: '文件',
  menuEdit: '编辑',
  menuView: '视图',
  menuHelp: '帮助',
  menuNew: '新建',
  menuOpen: '打开...',
  menuOpenFolder: '打开文件夹...',
  menuSave: '保存',
  menuSaveAs: '另存为...',
  menuExportHTML: '导出 HTML',
  menuExportPDF: '导出 PDF',
  menuToggleSidebar: '切换侧边栏',
  menuToggleTheme: '切换主题',
  menuToggleFullscreen: '切换全屏',
  menuSettings: '设置...',
  settings: '设置',
  plantumlServerUrl: 'PlantUML 服务器地址',
  plantumlServerUrlPlaceholder: 'https://www.plantuml.com/plantuml',
  save: '保存',
  cancel: '取消',
  resetDefault: '恢复默认',
  fileChangedReload: '文件已在磁盘上被修改，是否重新加载？',
  fileChangedDiscardReload: '文件已在磁盘上被修改，有未保存的更改，是否丢弃并重新加载？',
  menuUndo: '撤销',
  menuRedo: '重做',
  menuFind: '查找...',
  menuFindReplace: '查找和替换...',
  searchPlaceholder: '查找...',
  replacePlaceholder: '替换...',
  noMatches: '无匹配',
  matchOf: '/',
  replaceAll: '全部替换',
  menuAbout: '关于',
  aboutTitle: '关于 Milkdown 编辑器',
  aboutDescription: '一个现代的所见即所得 Markdown 编辑器',
  aboutVersion: '版本',
  aboutBuiltWith: '构建技术',
  aboutOk: '确定',
  tabFiles: '文件',
  tabOutline: '大纲',
  tabRemote: '远程',
  downloadToLocal: '下载到本地',
  syncToWebdav: '同步到 WebDAV',
  unsyncFromWebdav: '取消同步',
  syncCurrentFile: '同步当前文件',
  chooseLocalPath: '选择保存位置',
  syncStatusSynced: '已同步',
  menuSyncFile: '同步当前文件',
  menuMarkSync: '标记同步',
  webdavSettings: 'WebDAV 同步',
  webdavServerUrl: '服务器地址',
  webdavUsername: '用户名',
  webdavPassword: '密码',
  webdavRemotePath: '远程路径',
  webdavSyncInterval: '同步间隔',
  webdavTestConnection: '测试连接',
  webdavConnectionSuccess: '连接成功',
  webdavConnectionFailed: '连接失败',
  webdavSyncEnabled: '启用同步',
  webdavConflict: '同步冲突',
  webdavKeepLocal: '保留本地',
  webdavKeepRemote: '保留远程',
  webdavKeepBoth: '保留两者',
  syncStatusIdle: '已同步',
  syncStatusSyncing: '同步中...',
  syncStatusError: '同步错误',
  minutes: '分钟',
  welcomeTitle: '欢迎使用 Milkdown 编辑器',
  welcomeSubtitle: '在这里开始书写你的 Markdown...',
};

export const locales: Record<string, Locale> = { en, zh };
