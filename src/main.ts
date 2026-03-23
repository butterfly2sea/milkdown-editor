import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './styles/global.css';
import './styles/editor-overrides.css';

import { createEditor, getCursorInfo } from './editor/setup';
import { TitleBar } from './titlebar/titlebar';
import { StatusBar } from './statusbar/statusbar';
import { registerKeymap } from './editor/keymap';
import { FileManager } from './file/fs';
import { FileTree } from './sidebar/file-tree';
import { exportHTML } from './file/export-html';
import { exportPDF } from './file/export-pdf';
import { i18n } from './i18n';
import { initPlantUMLServerFromStorage, showSettingsModal } from './settings/settings-modal';

const defaultContent = '';

async function main() {
  // Initialize i18n before anything else
  i18n.init();
  // Restore PlantUML server URL from localStorage
  initPlantUMLServerFromStorage();

  const root = document.getElementById('editor-root');
  const titlebarEl = document.getElementById('titlebar');
  const statusbarEl = document.getElementById('statusbar');
  const sidebarEl = document.getElementById('sidebar');

  if (!root || !titlebarEl || !statusbarEl || !sidebarEl) {
    throw new Error('Required DOM elements not found');
  }

  // Platform detection
  if ('__TAURI_INTERNALS__' in window) {
    import('@tauri-apps/plugin-os').then(({ platform }) => {
      const os = platform();
      document.body.classList.add(`platform-${os}`);
    }).catch(() => {});
  }

  // Initialize UI components
  const titleBar = new TitleBar(titlebarEl);
  const statusBar = new StatusBar(statusbarEl);
  const fileTree = new FileTree(sidebarEl);
  const fileManager = new FileManager();

  // Initialize editor (use let + reassign to avoid referencing before init)
  let editorReady = false;
  let editorInstance: Awaited<ReturnType<typeof createEditor>> | null = null;
  const editor = await createEditor(root, defaultContent, (markdown) => {
    // Skip change tracking during initial editor creation
    if (!editorReady) return;

    const reallyChanged = fileManager.hasRealChanges(markdown);
    fileManager.hasUnsavedChanges = reallyChanged;
    titleBar.setUnsaved(reallyChanged);
    statusBar.updateWordCount(markdown);

    if (editorInstance) {
      const { line, col } = getCursorInfo(editorInstance.crepe);
      statusBar.updateCursorPosition(line, col);
    }

    // Schedule auto-save only if content actually changed
    if (reallyChanged) {
      fileManager.scheduleAutoSave(markdown);
    }
  });
  editorInstance = editor;
  // Expose for testing/debugging
  (window as any).__editor = editor;
  // Mark editor as ready after initial setup to avoid false "unsaved" state
  requestAnimationFrame(() => { editorReady = true; });

  // Set base content for change tracking
  fileManager.setBaseContent(defaultContent);

  // Auto-save callback
  // Reset initial unsaved state
  titleBar.setUnsaved(false);

  fileManager.onAutoSave = () => {
    titleBar.setUnsaved(false);
  };

  // Initial word count
  statusBar.updateWordCount(defaultContent);

  // -- File operations --

  const openFile = async (path?: string) => {
    if (fileManager.hasUnsavedChanges) {
      if (!confirm(i18n.t.unsavedWarning)) return;
    }
    const content = await fileManager.openFile(path);
    if (content !== undefined) {
      editor.setMarkdown(content);
      root.scrollTop = 0;
      titleBar.setFileName(fileManager.currentFileName);
      titleBar.setUnsaved(false);
      statusBar.updateWordCount(content);
    }
  };

  const getContent = () => {
    return statusBar.viewMode === 'source'
      ? sourceTextarea.value
      : editor.getMarkdown();
  };

  const saveFile = async () => {
    const md = getContent();
    const success = await fileManager.saveFile(md);
    if (success) {
      titleBar.setFileName(fileManager.currentFileName);
      titleBar.setUnsaved(false);
    }
  };

  const saveAs = async () => {
    const md = getContent();
    const success = await fileManager.saveAs(md);
    if (success) {
      titleBar.setFileName(fileManager.currentFileName);
      titleBar.setUnsaved(false);
    }
  };

  const newFile = () => {
    if (fileManager.hasUnsavedChanges) {
      if (!confirm(i18n.t.unsavedWarning)) return;
    }
    fileManager.newFile();
    const newContent = '# Untitled\n\n';
    editor.setMarkdown(newContent);
    root.scrollTop = 0;
    fileManager.setBaseContent(newContent);
    titleBar.setFileName(i18n.t.untitled);
    titleBar.setUnsaved(false);
  };

  const openFolder = async () => {
    const tree = await fileManager.openFolder();
    if (tree) {
      sidebarEl.classList.add('open');
      fileTree.render(tree);
    }
  };

  // File tree click handler
  fileTree.onFileSelect = (path) => {
    openFile(path);
  };

  // -- Theme --

  const toggleTheme = () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    localStorage.setItem('theme', html.getAttribute('data-theme')!);
    statusBar.updateThemeIcon();
  };

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  statusBar.updateThemeIcon();

  // -- Sidebar --

  const toggleSidebar = () => {
    sidebarEl.classList.toggle('open');
  };

  // -- Source / WYSIWYG toggle --

  // Source code textarea (hidden by default)
  const sourceTextarea = document.createElement('textarea');
  sourceTextarea.id = 'source-editor';
  sourceTextarea.spellcheck = false;
  sourceTextarea.style.cssText = `
    display: none;
    width: 100%;
    height: 100%;
    padding: 24px 48px;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 14px;
    line-height: 1.6;
    border: none;
    outline: none;
    resize: none;
    background: var(--bg-primary);
    color: var(--text-primary);
    tab-size: 4;
    box-sizing: border-box;
  `;
  root.parentElement?.appendChild(sourceTextarea);

  statusBar.onViewModeToggle = (mode) => {
    const editorDiv = root.querySelector('.milkdown') as HTMLElement || root.firstElementChild as HTMLElement;
    if (mode === 'source') {
      // Switch to source mode
      const md = editor.getMarkdown();
      sourceTextarea.value = md;
      if (editorDiv) editorDiv.style.display = 'none';
      sourceTextarea.style.display = 'block';
      sourceTextarea.focus();
    } else {
      // Switch back to WYSIWYG
      const md = sourceTextarea.value;
      sourceTextarea.style.display = 'none';
      if (editorDiv) editorDiv.style.display = '';
      editor.setMarkdown(md);
    }
  };

  // Sync source textarea changes for word count
  sourceTextarea.addEventListener('input', () => {
    const reallyChanged = fileManager.hasRealChanges(sourceTextarea.value);
    fileManager.hasUnsavedChanges = reallyChanged;
    titleBar.setUnsaved(reallyChanged);
    statusBar.updateWordCount(sourceTextarea.value);
  });

  // -- Status bar callbacks --

  statusBar.onThemeToggle = toggleTheme;
  statusBar.onExport = (format) => {
    const theme = (document.documentElement.getAttribute('data-theme') || 'light') as 'light' | 'dark';
    const title = fileManager.currentFileName;
    if (format === 'html') {
      exportHTML(root, theme, title);
    } else {
      exportPDF(root, theme, title);
    }
  };

  // -- Keyboard shortcuts --

  registerKeymap({
    save: saveFile,
    saveAs,
    open: () => openFile(),
    newFile,
    toggleSidebar,
    toggleTheme,
    exportMenu: () => {
      const exportBtn = document.querySelector(
        '.statusbar-btn[title*="Export"]',
      ) as HTMLButtonElement;
      exportBtn?.click();
    },
  });

  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (fileManager.hasUnsavedChanges) {
      e.preventDefault();
    }
  });

  // -- External file change detection & file tree refresh on window focus --
  window.addEventListener('focus', async () => {
    // Check if current file was modified externally
    if (fileManager.currentPath) {
      const changed = await fileManager.checkExternalChange();
      if (changed) {
        const message = fileManager.hasUnsavedChanges
          ? i18n.t.fileChangedDiscardReload
          : i18n.t.fileChangedReload;
        if (confirm(message)) {
          const content = await fileManager.reloadFile();
          if (content !== null) {
            editor.setMarkdown(content);
            root.scrollTop = 0;
            titleBar.setFileName(fileManager.currentFileName);
            titleBar.setUnsaved(false);
            statusBar.updateWordCount(content);
          }
        } else {
          await fileManager.dismissExternalChange();
        }
      }
    }

    // Refresh file tree if a folder is open
    if (fileManager.hasFolderOpen) {
      const tree = await fileManager.refreshFolder();
      if (tree) {
        fileTree.render(tree);
        // Re-highlight active file
        if (fileManager.currentPath) {
          fileTree.setActiveFile(fileManager.currentPath);
        }
      }
    }
  });

  // -- Tauri menu events --
  if ('__TAURI_INTERNALS__' in window) {
    import('@tauri-apps/api/event').then(({ listen }) => {
      const menuHandlers: Record<string, () => void> = {
        'menu-new': () => newFile(),
        'menu-open': () => openFile(),
        'menu-open-folder': () => openFolder(),
        'menu-save': () => saveFile(),
        'menu-save-as': () => saveAs(),
        'menu-export-html': () => {
          const theme = (document.documentElement.getAttribute('data-theme') || 'light') as 'light' | 'dark';
          exportHTML(root, theme, fileManager.currentFileName);
        },
        'menu-export-pdf': () => {
          const theme = (document.documentElement.getAttribute('data-theme') || 'light') as 'light' | 'dark';
          exportPDF(root, theme, fileManager.currentFileName);
        },
        'menu-toggle-sidebar': () => toggleSidebar(),
        'menu-toggle-theme': () => toggleTheme(),
        'menu-toggle-fullscreen': async () => {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const win = getCurrentWindow();
          const isFullscreen = await win.isFullscreen();
          await win.setFullscreen(!isFullscreen);
        },
        'menu-lang-en': () => i18n.setLang('en'),
        'menu-lang-zh': () => i18n.setLang('zh'),
        'menu-settings': () => showSettingsModal(),
      };

      for (const [event, handler] of Object.entries(menuHandlers)) {
        listen(event, () => {
          console.log('[menu] received:', event);
          handler();
        });
      }

      // Listen for file open from OS file association / single-instance
      listen<string>('open-file', (event) => {
        console.log('[open-file] received:', event.payload);
        openFile(event.payload);
      });
    });
  }
}

main().catch(console.error);
