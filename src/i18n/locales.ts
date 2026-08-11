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
  viewModeUndoWarning: string;

  // File operations
  unsavedWarning: string;
  docOpenInAnotherWindow: string;
  revealNoFile: string;
  revealFailed: string;
  fileName: string;
  newFile: string;
  newFolder: string;
  createFailed: string;
  createFolderFailed: string;
  folderOpenFailed: string;
  fileOpenFailed: string;
  fileTreeRefreshFailed: string;
  webdavNotConfigured: string;
  empty: string;
  loadRemoteFailed: string;
  syncUploadFailed: string;
  syncDownloadFailed: string;
  syncFailed: string;
  exportFailed: string;
  mathLoadFailed: string;
  remoteRefreshFailed: string;

  // Sidebar
  newFileMenu: string;

  // Clipboard
  copyFailed: string;

  // PlantUML
  plantumlPlaceholder: string;
  plantumlPreviewTitle: string;
  plantumlSourcePlaceholder: string;
  plantumlRendering: string;
  plantumlRenderFailed: string;
  plantumlCheckNetwork: string;
  plantumlCopySVG: string;
  plantumlCopyPNG: string;
  plantumlCopyFailed: string;
  plantumlDone: string;
  mermaidPlaceholder: string;
  mermaidPreviewTitle: string;
  mermaidSourcePlaceholder: string;
  mermaidRendering: string;
  mermaidSyntaxHint: string;
  mermaidDone: string;

  // Math
  mathPlaceholder: string;
  mathToggleSource: string;

  // Frontmatter card
  frontmatterTitle: string;
  frontmatterUntitled: string;
  frontmatterName: string;
  frontmatterDescription: string;
  frontmatterType: string;
  frontmatterRaw: string;
  frontmatterStructured: string;
  frontmatterCollapse: string;
  frontmatterInvalidWarn: string;

  // Menu (native)
  menuFile: string;
  menuEdit: string;
  menuView: string;
  menuHelp: string;
  menuNew: string;
  menuOpen: string;
  menuOpenFolder: string;
  menuRevealFile: string;
  menuSave: string;
  menuSaveAs: string;
  menuExportHTML: string;
  menuExportPDF: string;
  menuToggleSidebar: string;
  menuToggleTheme: string;
  menuToggleFullscreen: string;
  menuImageStorage: string;
  menuImageBase64: string;
  menuImageLocal: string;
  menuImageUrl: string;

  // Settings
  menuSettings: string;
  settings: string;
  plantumlServerUrl: string;
  plantumlServerUrlPlaceholder: string;
  plantumlServerUrlInvalid: string;
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
  searchRegex: string;
  searchCaseSensitive: string;
  searchWholeWord: string;
  localizeSaveFirst: string;
  localizeDone: string;
  localizeFailed: string;
  localizeImages: string;
  imageStorageConverted: string;
  imageStorageConverting: string;
  imageStorageConversionFailed: string;
  imageStorageUrlUploadRequired: string;
  imageStorageWysiwygOnly: string;

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
  refreshFileTree: string;
  dropToOpen: string;
  downloadToLocal: string;
  syncToWebdav: string;
  unsyncFromWebdav: string;
  syncCurrentFile: string;
  chooseLocalPath: string;
  syncStatusSynced: string;
  menuSyncFile: string;
  menuMarkSync: string;

  // Editor settings
  editorSettings: string;
  autoSaveEnabled: string;
  autoSaveDelay: string;
  seconds: string;
  pageMargin: string;
  pageMarginNormal: string;
  pageMarginNarrow: string;
  pageMarginNone: string;

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
  remoteFileUpdated: string;
  mergeConflict: string;
  useLocalAll: string;
  useRemoteAll: string;
  saveMergeResult: string;
  localVersion: string;
  remoteVersion: string;
  syncStatusIdle: string;
  syncStatusSyncing: string;
  syncStatusError: string;
  tauriFeatureUnavailable: string;
  externalChangeCheckFailed: string;
  dropFileCheckFailed: string;
  appInitFailed: string;
  reload: string;
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
  viewModeUndoWarning: 'Switching modes will clear undo history. Continue?',
  unsavedWarning: 'You have unsaved changes. Discard them?',
  docOpenInAnotherWindow: 'This document is already open in another window; switched to it.',
  revealNoFile: 'Save the document first — it has no folder yet.',
  revealFailed: 'Could not open the file manager.',
  fileName: 'File name:',
  newFile: 'New File',
  newFolder: 'New Folder',
  createFailed: 'Failed to create file',
  createFolderFailed: 'Failed to create folder',
  folderOpenFailed: 'Failed to open folder',
  fileOpenFailed: 'Failed to open file',
  fileTreeRefreshFailed: 'Failed to refresh files',
  webdavNotConfigured: 'Configure WebDAV in Settings',
  empty: '(empty)',
  loadRemoteFailed: 'Failed to load remote files',
  syncUploadFailed: 'Failed to upload to WebDAV',
  syncDownloadFailed: 'Failed to download from WebDAV',
  syncFailed: 'WebDAV sync failed',
  exportFailed: 'Export failed',
  mathLoadFailed: 'Failed to load math editor',
  remoteRefreshFailed: 'Failed to refresh remote files',
  newFileMenu: 'New File',
  copyFailed: 'Copy failed',
  plantumlPlaceholder: 'Enter PlantUML code to preview',
  plantumlPreviewTitle: 'Click to edit, right-click to copy',
  plantumlSourcePlaceholder: '@startuml\nAlice -> Bob: Hello\n@enduml',
  plantumlRendering: 'Rendering...',
  plantumlRenderFailed: 'Rendering failed',
  plantumlCheckNetwork: 'Check network or configure PlantUML server',
  plantumlCopySVG: 'Copy as SVG',
  plantumlCopyPNG: 'Copy as PNG',
  plantumlCopyFailed: 'Failed to copy PlantUML image',
  plantumlDone: 'Done',
  mermaidPlaceholder: 'Enter Mermaid code to preview',
  mermaidPreviewTitle: 'Click to edit, right-click to copy',
  mermaidSourcePlaceholder: 'graph TD\n  A[Start] --> B[End]',
  mermaidRendering: 'Rendering...',
  mermaidSyntaxHint: 'Check the Mermaid diagram syntax',
  mermaidDone: 'Done',
  mathPlaceholder: 'Enter LaTeX...',
  mathToggleSource: 'Toggle LaTeX source',
  frontmatterTitle: 'Frontmatter',
  frontmatterUntitled: '(no name)',
  frontmatterName: 'Name',
  frontmatterDescription: 'Description',
  frontmatterType: 'Type',
  frontmatterRaw: 'View YAML',
  frontmatterStructured: 'View fields',
  frontmatterCollapse: 'Collapse',
  frontmatterInvalidWarn: 'YAML contains constructs not editable as fields — use raw mode to edit.',
  menuFile: 'File',
  menuEdit: 'Edit',
  menuView: 'View',
  menuHelp: 'Help',
  menuNew: 'New',
  menuOpen: 'Open...',
  menuOpenFolder: 'Open Folder...',
  menuRevealFile: 'Show in File Manager',
  menuSave: 'Save',
  menuSaveAs: 'Save As...',
  menuExportHTML: 'Export HTML',
  menuExportPDF: 'Export PDF',
  menuToggleSidebar: 'Toggle Sidebar',
  menuToggleTheme: 'Toggle Theme',
  menuToggleFullscreen: 'Toggle Fullscreen',
  menuImageStorage: 'Image Storage',
  menuImageBase64: 'Embed as Base64',
  menuImageLocal: 'Local Asset Files',
  menuImageUrl: 'Online URLs',
  menuSettings: 'Settings...',
  settings: 'Settings',
  plantumlServerUrl: 'PlantUML Server URL',
  plantumlServerUrlPlaceholder: 'https://www.plantuml.com/plantuml',
  plantumlServerUrlInvalid: 'PlantUML server URL must be a valid HTTPS URL.',
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
  searchRegex: 'Use Regular Expression',
  searchCaseSensitive: 'Match Case',
  searchWholeWord: 'Match Whole Word',
  localizeSaveFirst: 'Save the file first to localize images',
  localizeDone: 'Localized {n} image(s), {f} failed',
  localizeFailed: 'Image localization failed',
  localizeImages: 'Localize images',
  imageStorageConverted: 'Converted {n} image(s), {f} failed',
  imageStorageConverting: 'Image conversion is already in progress',
  imageStorageConversionFailed: 'Image storage conversion failed',
  imageStorageUrlUploadRequired: 'Converting image files to online URLs requires an upload service',
  imageStorageWysiwygOnly: 'Switch to WYSIWYG mode before converting images',
  menuAbout: 'About',
  aboutTitle: 'About Milkdown Editor',
  aboutDescription: 'A modern WYSIWYG Markdown editor',
  aboutVersion: 'Version',
  aboutBuiltWith: 'Built with',
  aboutOk: 'OK',
  tabFiles: 'Files',
  tabOutline: 'Outline',
  tabRemote: 'Remote',
  refreshFileTree: 'Refresh',
  dropToOpen: 'Drop markdown file to open',
  downloadToLocal: 'Download to local',
  syncToWebdav: 'Sync to WebDAV',
  unsyncFromWebdav: 'Unsync',
  syncCurrentFile: 'Sync Current File',
  chooseLocalPath: 'Choose save location',
  syncStatusSynced: 'Synced',
  menuSyncFile: 'Sync Current File',
  menuMarkSync: 'Mark for Sync',
  editorSettings: 'Editor',
  autoSaveEnabled: 'Auto-save',
  autoSaveDelay: 'Auto-save delay',
  seconds: 'seconds',
  pageMargin: 'Page margin',
  pageMarginNormal: 'Normal',
  pageMarginNarrow: 'Narrow',
  pageMarginNone: 'None',
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
  remoteFileUpdated: '"{file}" has been updated remotely. Download latest version?',
  mergeConflict: 'Sync Conflict',
  useLocalAll: 'Use Local',
  useRemoteAll: 'Use Remote',
  saveMergeResult: 'Save Merged',
  localVersion: 'Local Version',
  remoteVersion: 'Remote Version',
  syncStatusIdle: 'Synced',
  syncStatusSyncing: 'Syncing...',
  syncStatusError: 'Sync error',
  tauriFeatureUnavailable: 'Some desktop features are unavailable',
  externalChangeCheckFailed: 'Could not check external file changes',
  dropFileCheckFailed: 'Could not read dropped item',
  appInitFailed: 'App init failed',
  reload: 'Reload',
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
  viewModeUndoWarning: '切换模式将清空撤销历史，是否继续？',
  unsavedWarning: '有未保存的更改，是否丢弃？',
  docOpenInAnotherWindow: '该文档已在另一个窗口中打开，已切换过去。',
  revealNoFile: '请先保存文档——它还没有所在文件夹。',
  revealFailed: '无法打开文件管理器。',
  fileName: '文件名：',
  newFile: '新建文件',
  newFolder: '新建文件夹',
  createFailed: '创建文件失败',
  createFolderFailed: '创建文件夹失败',
  folderOpenFailed: '打开文件夹失败',
  fileOpenFailed: '打开文件失败',
  fileTreeRefreshFailed: '刷新文件列表失败',
  webdavNotConfigured: '请先在设置中配置 WebDAV',
  empty: '空',
  loadRemoteFailed: '加载远程文件失败',
  syncUploadFailed: '上传到 WebDAV 失败',
  syncDownloadFailed: '从 WebDAV 下载失败',
  syncFailed: 'WebDAV 同步失败',
  exportFailed: '导出失败',
  mathLoadFailed: '加载数学公式编辑器失败',
  remoteRefreshFailed: '刷新远程文件失败',
  newFileMenu: '新建文件',
  copyFailed: '复制失败',
  plantumlPlaceholder: '输入 PlantUML 代码以预览',
  plantumlPreviewTitle: '点击编辑，右键复制',
  plantumlSourcePlaceholder: '@startuml\nAlice -> Bob: Hello\n@enduml',
  plantumlRendering: '渲染中...',
  plantumlRenderFailed: '渲染失败',
  plantumlCheckNetwork: '请检查网络或配置 PlantUML 服务器',
  plantumlCopySVG: '复制为 SVG',
  plantumlCopyPNG: '复制为 PNG',
  plantumlCopyFailed: '复制 PlantUML 图片失败',
  plantumlDone: '完成',
  mermaidPlaceholder: '输入 Mermaid 代码以预览',
  mermaidPreviewTitle: '点击编辑，右键复制',
  mermaidSourcePlaceholder: 'graph TD\n  A[开始] --> B[结束]',
  mermaidRendering: '渲染中...',
  mermaidSyntaxHint: '请检查 Mermaid 图表语法',
  mermaidDone: '完成',
  mathPlaceholder: '输入 LaTeX...',
  mathToggleSource: '切换 LaTeX 源码',
  frontmatterTitle: '元信息',
  frontmatterUntitled: '(未命名)',
  frontmatterName: '名称',
  frontmatterDescription: '描述',
  frontmatterType: '类型',
  frontmatterRaw: '查看 YAML',
  frontmatterStructured: '查看字段',
  frontmatterCollapse: '收起',
  frontmatterInvalidWarn: 'YAML 中存在无法用表单字段表达的内容，请切到原始 YAML 编辑。',
  menuFile: '文件',
  menuEdit: '编辑',
  menuView: '视图',
  menuHelp: '帮助',
  menuNew: '新建',
  menuOpen: '打开...',
  menuOpenFolder: '打开文件夹...',
  menuRevealFile: '打开文件所在文件夹',
  menuSave: '保存',
  menuSaveAs: '另存为...',
  menuExportHTML: '导出 HTML',
  menuExportPDF: '导出 PDF',
  menuToggleSidebar: '切换侧边栏',
  menuToggleTheme: '切换主题',
  menuToggleFullscreen: '切换全屏',
  menuImageStorage: '图片存储方式',
  menuImageBase64: '嵌入 Base64',
  menuImageLocal: '本地资源文件',
  menuImageUrl: '在线 URL',
  menuSettings: '设置...',
  settings: '设置',
  plantumlServerUrl: 'PlantUML 服务器地址',
  plantumlServerUrlPlaceholder: 'https://www.plantuml.com/plantuml',
  plantumlServerUrlInvalid: 'PlantUML 服务器地址必须是有效的 HTTPS 地址。',
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
  searchRegex: '使用正则表达式',
  searchCaseSensitive: '区分大小写',
  searchWholeWord: '全词匹配',
  localizeSaveFirst: '请先保存文件再本地化图片',
  localizeDone: '已本地化 {n} 张图片，失败 {f} 张',
  localizeFailed: '图片本地化失败',
  localizeImages: '本地化图片',
  imageStorageConverted: '已转换 {n} 张图片，失败 {f} 张',
  imageStorageConverting: '图片转换正在进行中',
  imageStorageConversionFailed: '图片存储方式转换失败',
  imageStorageUrlUploadRequired: '将图片文件转换为在线 URL 需要配置上传服务',
  imageStorageWysiwygOnly: '请切换到所见即所得模式后再转换图片',
  menuAbout: '关于',
  aboutTitle: '关于 Milkdown 编辑器',
  aboutDescription: '一个现代的所见即所得 Markdown 编辑器',
  aboutVersion: '版本',
  aboutBuiltWith: '构建技术',
  aboutOk: '确定',
  tabFiles: '文件',
  tabOutline: '大纲',
  tabRemote: '远程',
  refreshFileTree: '刷新',
  dropToOpen: '拖放 Markdown 文件以打开',
  downloadToLocal: '下载到本地',
  syncToWebdav: '同步到 WebDAV',
  unsyncFromWebdav: '取消同步',
  syncCurrentFile: '同步当前文件',
  chooseLocalPath: '选择保存位置',
  syncStatusSynced: '已同步',
  menuSyncFile: '同步当前文件',
  menuMarkSync: '标记同步',
  editorSettings: '编辑器',
  autoSaveEnabled: '自动保存',
  autoSaveDelay: '自动保存延时',
  seconds: '秒',
  pageMargin: '页边距',
  pageMarginNormal: '正常',
  pageMarginNarrow: '窄',
  pageMarginNone: '无',
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
  remoteFileUpdated: '"{file}" 远端已更新，是否下载最新版本？',
  mergeConflict: '同步冲突',
  useLocalAll: '使用本地',
  useRemoteAll: '使用远端',
  saveMergeResult: '保存合并',
  localVersion: '本地版本',
  remoteVersion: '远端版本',
  syncStatusIdle: '已同步',
  syncStatusSyncing: '同步中...',
  syncStatusError: '同步错误',
  tauriFeatureUnavailable: '部分桌面功能不可用',
  externalChangeCheckFailed: '无法检查外部文件变更',
  dropFileCheckFailed: '无法读取拖放项目',
  appInitFailed: '应用初始化失败 / App init failed',
  reload: '重启 / Reload',
  minutes: '分钟',
  welcomeTitle: '欢迎使用 Milkdown 编辑器',
  welcomeSubtitle: '在这里开始书写你的 Markdown...',
};

export const locales: Record<string, Locale> = { en, zh };
