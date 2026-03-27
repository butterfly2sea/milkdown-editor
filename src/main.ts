import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './styles/global.css';
import './styles/editor-overrides.css';

import { createEditor, getCursorInfo, editorUndo, editorRedo, getHeadings, scrollToPos } from './editor/setup';
import { SearchBar } from './editor/search';
import { SidebarTabs } from './sidebar/sidebar-tabs';
import { TableOfContents } from './sidebar/toc';
import { RemoteFileTree } from './sidebar/remote-tree';
import { TitleBar } from './titlebar/titlebar';
import { StatusBar } from './statusbar/statusbar';
import { registerKeymap } from './editor/keymap';
import { FileManager } from './file/fs';
import { FileTree } from './sidebar/file-tree';
import { exportHTML } from './file/export-html';

import { i18n } from './i18n';
import { initPlantUMLServerFromStorage, showSettingsModal, setOnSyncConfigChange } from './settings/settings-modal';
import { SyncManager } from './sync/sync-manager';
import { showAboutModal } from './about/about-modal';

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

  // Platform detection & disable native context menu in Tauri (desktop app)
  if ('__TAURI_INTERNALS__' in window) {
    import('@tauri-apps/plugin-os').then(({ platform }) => {
      const os = platform();
      document.body.classList.add(`platform-${os}`);
    }).catch(() => {});

    // Prevent WebView native context menu (Reload, Inspect, etc.)
    // Custom context menus use stopPropagation + their own preventDefault
    document.addEventListener('contextmenu', (e) => {
      // Allow custom context menus on file tree items (they handle their own preventDefault)
      if (!(e.target as HTMLElement).closest('.ctx-menu')) {
        e.preventDefault();
      }
    });
  }

  // Initialize UI components
  const titleBar = new TitleBar(titlebarEl);
  const statusBar = new StatusBar(statusbarEl);
  const fileManager = new FileManager();

  // Initialize sidebar tabs first, then create FileTree inside the files container
  const sidebarTabs = new SidebarTabs(sidebarEl);
  const fileTree = new FileTree(sidebarTabs.filesEl);

  // Initialize editor (use let + reassign to avoid referencing before init)
  let editorReady = false;
  let onContentChange: (() => void) | null = null;
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

    // Notify content change listeners (e.g., TOC update)
    onContentChange?.();
  });
  editorInstance = editor;
  // Expose for testing/debugging
  (window as any).__editor = editor;
  // Mark editor as ready after initial setup to avoid false "unsaved" state
  requestAnimationFrame(() => { editorReady = true; });

  // Update cursor position on click/key navigation
  const updateCursorPos = () => {
    if (editorInstance) {
      const { line, col } = getCursorInfo(editorInstance.crepe);
      statusBar.updateCursorPosition(line, col);
    }
  };
  root.addEventListener('click', updateCursorPos);
  root.addEventListener('keyup', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      updateCursorPos();
    }
  });

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
      editorReady = false;  // Suppress onChange during load
      editor.setMarkdown(content);
      root.scrollTop = 0;
      titleBar.setFileName(fileManager.currentFileName);
      titleBar.setUnsaved(false);
      statusBar.updateWordCount(content);
      requestAnimationFrame(() => { editorReady = true; });
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
      // Upload to WebDAV after save
      if (fileManager.currentPath) {
        syncManager.uploadFile(fileManager.currentPath, md).catch(console.error);
      }
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
    editorReady = false;  // Suppress onChange during load
    editor.setMarkdown(newContent);
    root.scrollTop = 0;
    fileManager.setBaseContent(newContent);
    titleBar.setFileName(i18n.t.untitled);
    titleBar.setUnsaved(false);
    requestAnimationFrame(() => { editorReady = true; });
  };

  const openFolder = async () => {
    const tree = await fileManager.openFolder();
    if (tree) {
      sidebarEl.classList.add('open');
      fileTree.render(tree);
      sidebarTabs.setActiveTab('files');
    }
  };

  // File tree click handler
  fileTree.onFileSelect = (path) => {
    openFile(path);
  };

  // File tree refresh handler
  fileTree.onRefresh = async () => {
    if (fileManager.hasFolderOpen) {
      const tree = await fileManager.refreshFolder();
      if (tree) {
        fileTree.render(tree);
        if (fileManager.currentPath) {
          fileTree.setActiveFile(fileManager.currentPath);
        }
      }
    }
  };

  // -- WebDAV Sync --
  const syncManager = new SyncManager();
  syncManager.onStatusChange = (status) => {
    statusBar.updateSyncStatus(status);
  };
  syncManager.onFileStatusChange = (statuses) => {
    fileTree.updateSyncStatuses(statuses);
  };
  syncManager.onRemoteChanged = async (fileName) => {
    return confirm(i18n.t.remoteFileUpdated.replace('{file}', fileName))
      ? 'download' : 'ignore';
  };
  syncManager.onConflict = async (fileName, localContent, remoteContent) => {
    const { showMergeModal } = await import('./sync/merge-modal');
    return showMergeModal(fileName, localContent, remoteContent);
  };
  syncManager.init();
  fileTree.syncEnabled = syncManager.isConfigured;
  sidebarTabs.setTabVisible('remote', syncManager.isConfigured);
  statusBar.onSyncClick = () => syncManager.sync();

  // File tree sync callbacks
  fileTree.onSyncFile = async (path) => {
    if (!syncManager.isConfigured) return;
    const config = (await import('./sync/sync-config')).getSyncConfig();
    if (!config) return;
    // Show remote folder picker for user to choose destination
    const { showRemoteFolderPicker } = await import('./sync/remote-folder-picker');
    const remoteFolder = await showRemoteFolderPicker(syncManager.webdavClient, config.remotePath || '/');
    if (!remoteFolder) return;
    const fileName = path.replace(/\\/g, '/').split('/').pop() || '';
    const remotePath = remoteFolder.replace(/\/+$/, '') + '/' + fileName;
    await syncManager.markForSync(path, remotePath);
  };
  fileTree.onUnsyncFile = (path) => {
    syncManager.unmarkSync(path);
  };

  // Re-init sync when config changes in settings
  setOnSyncConfigChange(() => {
    syncManager.restart();
    fileTree.syncEnabled = syncManager.isConfigured;
    sidebarTabs.setTabVisible('remote', syncManager.isConfigured);
    initRemoteTree();
  });

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

  // -- Search bar --
  const searchBar = new SearchBar(root);
  searchBar.setEditor(editor.crepe);

  // -- TOC --
  const toc = new TableOfContents(sidebarTabs.tocEl);
  toc.onHeadingClick = (pos) => {
    scrollToPos(editor.crepe, pos);
  };

  // Update TOC on content changes (debounced)
  let tocTimer: ReturnType<typeof setTimeout> | null = null;
  const updateToc = () => {
    if (tocTimer) clearTimeout(tocTimer);
    tocTimer = setTimeout(() => {
      const headings = getHeadings(editor.crepe);
      toc.update(headings);
    }, 300);
  };
  // Wire up TOC updates on content change
  onContentChange = updateToc;
  // Initial TOC
  updateToc();

  // -- Remote file tree --
  const remoteTree = new RemoteFileTree(sidebarTabs.remoteEl);
  remoteTree.onDownload = async (remotePath, fileName) => {
    // Ask user where to save
    const { save: saveDlg } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const localPath = await saveDlg({
      defaultPath: fileName,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    if (!localPath) return;
    await syncManager.downloadAndMap(remotePath, localPath);
    // Open the downloaded file
    await openFile(localPath);
  };

  // Initialize remote tree when sync is configured
  const initRemoteTree = async () => {
    if (syncManager.isConfigured) {
      const config = (await import('./sync/sync-config')).getSyncConfig();
      remoteTree.setClient(syncManager.webdavClient, config?.remotePath || '/');
    }
  };
  initRemoteTree();

  // Refresh remote tree when switching to Remote tab
  sidebarTabs.onTabChange = (tab) => {
    if (tab === 'remote' && syncManager.isConfigured) {
      remoteTree.refresh().catch(console.error);
    }
  };

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
  statusBar.onExport = async (format) => {
    if (format === 'html') {
      const theme = (document.documentElement.getAttribute('data-theme') || 'light') as 'light' | 'dark';
      const title = fileManager.currentFileName;
      await exportHTML(getContent(), theme, title);
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
    find: () => searchBar.show(false),
    findReplace: () => searchBar.show(true),
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
          exportHTML(getContent(), theme, fileManager.currentFileName).catch(console.error);
        },
        'menu-undo': () => editorUndo(editor.crepe),
        'menu-redo': () => editorRedo(editor.crepe),
        'menu-find': () => searchBar.show(false),
        'menu-find-replace': () => searchBar.show(true),
        'menu-sync-file': () => {
          if (fileManager.currentPath) {
            syncManager.sync().catch(console.error);
          }
        },
        'menu-mark-sync': () => {
          if (fileManager.currentPath) {
            const isSynced = syncManager.fileStatuses.has(fileManager.currentPath);
            if (isSynced) {
              syncManager.unmarkSync(fileManager.currentPath);
            } else {
              fileTree.onSyncFile?.(fileManager.currentPath);
            }
          }
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
        'menu-about': () => showAboutModal(),
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

      // Check for pending file from OS launch (file association / double-click)
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke<string | null>('take_pending_file').then((path) => {
          if (path) {
            console.log('[pending-file] opening:', path);
            openFile(path);
          }
        });
      });

      // Drag-and-drop file support
      import('@tauri-apps/api/webview').then(({ getCurrentWebview }) => {
        const dropOverlay = document.createElement('div');
        dropOverlay.id = 'drop-overlay';
        const dropLabel = document.createElement('div');
        dropLabel.className = 'drop-overlay-content';
        dropLabel.textContent = i18n.t.dropToOpen;
        dropOverlay.appendChild(dropLabel);
        document.body.appendChild(dropOverlay);

        i18n.onChange(() => {
          dropLabel.textContent = i18n.t.dropToOpen;
        });

        let lastDropTime = 0;
        getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            dropOverlay.classList.add('visible');
          } else if (event.payload.type === 'drop') {
            dropOverlay.classList.remove('visible');
            const now = Date.now();
            if (now - lastDropTime < 500) return;
            lastDropTime = now;
            const mdFile = event.payload.paths.find(
              (p: string) => p.endsWith('.md') || p.endsWith('.markdown')
            );
            if (mdFile) {
              openFile(mdFile);
            }
          } else if (event.payload.type === 'leave') {
            dropOverlay.classList.remove('visible');
          }
        });
      });
    });
  }
}

main().catch(console.error);
