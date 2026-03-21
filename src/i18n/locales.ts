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
  welcomeTitle: '欢迎使用 Milkdown 编辑器',
  welcomeSubtitle: '在这里开始书写你的 Markdown...',
};

export const locales: Record<string, Locale> = { en, zh };
